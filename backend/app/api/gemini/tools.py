"""
Gemini Tools API Module
=======================

This module provides tool-related Gemini API endpoints:

**Function Calling**
- Call functions based on user prompts
- AUTO, ANY, NONE, VALIDATED modes
- Parallel function calling support (multiple functions in one turn)
- Compositional/sequential calling (chained function workflows)
- Multi-tool use (combine with Google Search, Code Execution)
- Multi-turn conversations with function results
- Structured output integration (Gemini 3)

**URL Context**
- Ground responses in web content
- Fetch and analyze URLs
- Citation support

**Predefined Scenarios**
- Weather: Get weather for locations
- Smart Home: Control lights, thermostat, music
- Calendar: Schedule and manage meetings  
- E-commerce: Search products, manage cart, checkout
- Database: Query and update records
- API Integration: Multi-step API workflows

Documentation:
- Function Calling: https://ai.google.dev/gemini-api/docs/function-calling
- URL Context: https://ai.google.dev/gemini-api/docs/url-context
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from enum import Enum

from app.api.deps import get_current_user
from app.core.limiter import limiter
from app.api.gemini._common import (
    UsageStats,
    extract_usage,
    log_llm_call,
    logger,
)
from app.db.redis import get_redis_optional

router = APIRouter(tags=["gemini-tools"])


# ============================================================================
# Enums
# ============================================================================

class FunctionCallingMode(str, Enum):
    """Function calling mode options."""
    AUTO = "AUTO"       # Model decides when to call functions
    ANY = "ANY"         # Force function call, optionally restricted
    NONE = "NONE"       # Disable function calling
    VALIDATED = "VALIDATED"  # Like ANY but allows text responses too


# ============================================================================
# Request Schemas
# ============================================================================

class FunctionParameter(BaseModel):
    """Individual function parameter definition."""
    type: str = Field(..., description="Parameter type: string, number, integer, boolean, array, object")
    description: str = Field(..., description="What this parameter does")
    enum: Optional[List[str]] = Field(None, description="Allowed values (for constrained parameters)")
    items: Optional[Dict[str, Any]] = Field(None, description="Array item schema (for array type)")
    properties: Optional[Dict[str, Any]] = Field(None, description="Nested properties (for object type)")
    required: Optional[List[str]] = Field(None, description="Required nested properties (for object type)")


class FunctionDeclaration(BaseModel):
    """
    Function declaration for function calling.
    
    **Best Practices:**
    - Use clear, descriptive function names (verb_noun format)
    - Write detailed descriptions explaining what the function does
    - Use strong typing with specific parameter types
    - Use enums for constrained parameters
    - Mark parameters as required when they must be provided
    
    **Example:**
    ```json
    {
        "name": "get_weather",
        "description": "Get the current weather conditions for a specified location. Returns temperature, conditions, humidity, and wind speed.",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "City and country, e.g., 'London, UK' or 'New York, USA'"
                },
                "unit": {
                    "type": "string",
                    "enum": ["celsius", "fahrenheit"],
                    "description": "Temperature unit preference"
                }
            },
            "required": ["location"]
        }
    }
    ```
    """
    name: str = Field(
        ..., 
        description="Function name (use snake_case, e.g., 'get_weather', 'search_products')"
    )
    description: str = Field(
        ..., 
        description="Detailed description of what the function does and when to use it"
    )
    parameters: Dict[str, Any] = Field(
        ...,
        description="JSON Schema for function parameters with type, properties, required"
    )


class FunctionResult(BaseModel):
    """Result from executing a function."""
    name: str = Field(..., description="Name of the function that was called")
    result: Dict[str, Any] = Field(..., description="The function's return value as JSON")


class ConversationTurn(BaseModel):
    """A single turn in multi-turn conversation."""
    role: Literal["user", "model", "function"] = Field(..., description="Who sent this message")
    content: Optional[str] = Field(None, description="Text content (for user/model)")
    function_call: Optional[Dict[str, Any]] = Field(None, description="Function call from model")
    function_response: Optional[FunctionResult] = Field(None, description="Function result from user")


class FunctionCallRequest(BaseModel):
    """
    Comprehensive function calling request with all features.
    
    **Modes:**
    - AUTO (default): Model decides whether to call functions or respond with text
    - ANY: Force function call, optionally restricted to allowed_function_names
    - NONE: Disable function calling (use functions only as context)
    - VALIDATED: Like ANY but allows natural language responses when appropriate
    
    **Features:**
    1. **Parallel Function Calling**: Model can call multiple functions in one turn
       - Example: "What's the weather in Tokyo and New York?" → 2 parallel calls
    
    2. **Compositional Calling**: Chain functions across turns
       - Turn 1: Search for flights
       - Turn 2: Book the selected flight
       - Turn 3: Send confirmation email
    
    3. **Multi-Tool Use**: Combine function calling with other tools
       - Google Search: Ground responses in search results
       - Code Execution: Run code to compute results
    
    4. **Multi-Turn Workflow**: Complete conversation flow:
       - Send prompt → Get function calls → Execute locally → Return results → Get final response
    
    5. **Function Simulation**: Built-in mock execution for demos
    
    **Example Workflow:**
    ```
    1. Request: {"prompt": "Book a meeting with John tomorrow"}
    2. Response: function_calls: [{name: "check_calendar", args: {...}}]
    3. Execute check_calendar locally
    4. Request: {"prompt": "...", "function_results": [{"name": "check_calendar", "result": {...}}]}
    5. Response: function_calls: [{name: "schedule_meeting", args: {...}}] or text response
    ```
    
    See: https://ai.google.dev/gemini-api/docs/function-calling
    """
    # Core fields
    prompt: str = Field(..., description="User prompt or query")
    model: str = Field(
        "gemini-2.5-flash",
        description="Model: gemini-2.5-flash, gemini-2.5-pro"
    )
    
    # Mode configuration
    mode: FunctionCallingMode = Field(
        FunctionCallingMode.AUTO,
        description="Function calling mode: AUTO, ANY, NONE, VALIDATED"
    )
    allowed_function_names: Optional[List[str]] = Field(
        None,
        description="Restrict to these function names only (for ANY/VALIDATED modes)"
    )
    
    # Function declarations
    function_set_id: Optional[str] = Field(
        None,
        description="ID of a function set stored in the framework's function store (backend/functions/{id}.json). "
                    "Takes priority over 'functions' and 'scenario'. "
                    "Use GET /api/v1/gemini/function-sets to list available sets."
    )
    functions: Optional[List[FunctionDeclaration]] = Field(
        None,
        description="Custom function declarations. If not provided, uses demo functions."
    )
    scenario: Optional[str] = Field(
        None,
        description="Use predefined scenario: weather, smart_home, calendar, ecommerce, database, api_workflow"
    )
    
    # Multi-turn conversation
    function_results: Optional[List[FunctionResult]] = Field(
        None,
        description="Results from previous function calls to continue the conversation"
    )
    conversation_history: Optional[List[ConversationTurn]] = Field(
        None,
        description="Full conversation history for multi-turn workflows"
    )
    
    # Multi-tool use
    enable_google_search: bool = Field(
        False,
        description="Also enable Google Search grounding alongside function calling"
    )
    enable_code_execution: bool = Field(
        False,
        description="Also enable code execution tool alongside function calling"
    )
    
    # Simulation
    simulate_execution: bool = Field(
        False,
        description="Automatically execute functions with mock data (for demos)"
    )
    
    # Advanced options
    temperature: float = Field(
        0.0,
        ge=0.0,
        le=2.0,
        description="Lower temperature (0.0) recommended for function calling accuracy"
    )
    max_tokens: Optional[int] = Field(
        None,
        description="Maximum tokens in response"
    )


class URLContextRequest(BaseModel):
    """
    URL context grounding request.
    
    Ground model responses in the content of specified URLs.
    The model will fetch, analyze, and cite the URL content.
    
    **Features:**
    - Automatic content extraction
    - Source citations in response
    - Support for multiple URLs
    - Dynamic content grounding
    - Optional Google Search combination
    - System instructions for response style
    
    **Use Cases:**
    - Research and summarization
    - Fact-checking against sources
    - Document analysis
    - News aggregation
    
    See: https://ai.google.dev/gemini-api/docs/url-context
    """
    prompt: str = Field(
        ...,
        description="Question or instruction about the URL content"
    )
    urls: List[str] = Field(
        ...,
        description="URLs to ground the response in",
        min_length=1,
        max_length=20
    )
    model: str = Field(
        "gemini-2.5-flash",
        description="Model: gemini-2.5-flash, gemini-2.5-pro, gemini-3-flash-preview"
    )
    include_citations: bool = Field(
        True,
        description="Include source citations in response"
    )
    dynamic_retrieval_threshold: Optional[float] = Field(
        None,
        description="Threshold for dynamic retrieval (0.0-1.0). Lower = more retrieval."
    )
    system_instruction: Optional[str] = Field(
        None,
        description="System instruction to guide the model's response style"
    )
    combine_with_search: bool = Field(
        False,
        description="Also include Google Search results for broader context"
    )


# ============================================================================
# Predefined Function Scenarios
# ============================================================================

# Weather scenario - demonstrates basic function calling
WEATHER_FUNCTIONS = [
    {
        "name": "get_current_weather",
        "description": "Get the current weather conditions for a location. Returns temperature, conditions, humidity, wind speed, and feels-like temperature.",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The city and country, e.g., 'London, UK' or 'Tokyo, Japan'"
                },
                "unit": {
                    "type": "string",
                    "enum": ["celsius", "fahrenheit"],
                    "description": "Temperature unit preference"
                }
            },
            "required": ["location"]
        }
    },
    {
        "name": "get_weather_forecast",
        "description": "Get the weather forecast for the next 5 days for a location.",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The city and country"
                },
                "days": {
                    "type": "integer",
                    "description": "Number of days to forecast (1-5)",
                    "minimum": 1,
                    "maximum": 5
                }
            },
            "required": ["location"]
        }
    }
]

# Smart Home scenario - demonstrates parallel function calling
SMART_HOME_FUNCTIONS = [
    {
        "name": "control_lights",
        "description": "Control smart lights in a room. Can turn on/off, set brightness, and change color.",
        "parameters": {
            "type": "object",
            "properties": {
                "room": {
                    "type": "string",
                    "description": "Room name: living_room, bedroom, kitchen, bathroom, office"
                },
                "action": {
                    "type": "string",
                    "enum": ["on", "off", "dim", "brighten"],
                    "description": "Light action to perform"
                },
                "brightness": {
                    "type": "integer",
                    "description": "Brightness level 0-100 (for dim action)",
                    "minimum": 0,
                    "maximum": 100
                },
                "color": {
                    "type": "string",
                    "description": "Light color (for smart RGB lights): red, blue, green, warm, cool, white"
                }
            },
            "required": ["room", "action"]
        }
    },
    {
        "name": "set_thermostat",
        "description": "Set the home thermostat temperature and mode.",
        "parameters": {
            "type": "object",
            "properties": {
                "temperature": {
                    "type": "number",
                    "description": "Target temperature in the configured unit"
                },
                "mode": {
                    "type": "string",
                    "enum": ["heat", "cool", "auto", "off"],
                    "description": "Thermostat mode"
                },
                "unit": {
                    "type": "string",
                    "enum": ["celsius", "fahrenheit"],
                    "description": "Temperature unit"
                }
            },
            "required": ["temperature"]
        }
    },
    {
        "name": "control_music",
        "description": "Control music playback on smart speakers.",
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["play", "pause", "skip", "previous", "volume_up", "volume_down"],
                    "description": "Music control action"
                },
                "room": {
                    "type": "string",
                    "description": "Room where the speaker is located"
                },
                "query": {
                    "type": "string",
                    "description": "Song, artist, or playlist to play (for play action)"
                },
                "volume": {
                    "type": "integer",
                    "description": "Volume level 0-100",
                    "minimum": 0,
                    "maximum": 100
                }
            },
            "required": ["action"]
        }
    },
    {
        "name": "lock_doors",
        "description": "Control smart door locks.",
        "parameters": {
            "type": "object",
            "properties": {
                "door": {
                    "type": "string",
                    "enum": ["front", "back", "garage", "all"],
                    "description": "Which door to control"
                },
                "action": {
                    "type": "string",
                    "enum": ["lock", "unlock"],
                    "description": "Lock action"
                }
            },
            "required": ["door", "action"]
        }
    }
]

# Calendar scenario - demonstrates compositional/sequential calling
CALENDAR_FUNCTIONS = [
    {
        "name": "check_calendar",
        "description": "Check calendar availability for a specific date and time range.",
        "parameters": {
            "type": "object",
            "properties": {
                "date": {
                    "type": "string",
                    "description": "Date to check (YYYY-MM-DD or 'today', 'tomorrow')"
                },
                "start_time": {
                    "type": "string",
                    "description": "Start of time range (HH:MM)"
                },
                "end_time": {
                    "type": "string",
                    "description": "End of time range (HH:MM)"
                }
            },
            "required": ["date"]
        }
    },
    {
        "name": "create_event",
        "description": "Create a new calendar event.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Event title"
                },
                "date": {
                    "type": "string",
                    "description": "Event date (YYYY-MM-DD)"
                },
                "start_time": {
                    "type": "string",
                    "description": "Start time (HH:MM)"
                },
                "end_time": {
                    "type": "string",
                    "description": "End time (HH:MM)"
                },
                "attendees": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of attendee emails"
                },
                "location": {
                    "type": "string",
                    "description": "Event location or meeting link"
                },
                "description": {
                    "type": "string",
                    "description": "Event description"
                }
            },
            "required": ["title", "date", "start_time"]
        }
    },
    {
        "name": "update_event",
        "description": "Update an existing calendar event.",
        "parameters": {
            "type": "object",
            "properties": {
                "event_id": {
                    "type": "string",
                    "description": "ID of the event to update"
                },
                "title": {
                    "type": "string",
                    "description": "New event title"
                },
                "date": {
                    "type": "string",
                    "description": "New date"
                },
                "start_time": {
                    "type": "string",
                    "description": "New start time"
                },
                "attendees": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Updated attendee list"
                }
            },
            "required": ["event_id"]
        }
    },
    {
        "name": "send_invite",
        "description": "Send calendar invites to attendees.",
        "parameters": {
            "type": "object",
            "properties": {
                "event_id": {
                    "type": "string",
                    "description": "Event ID to send invites for"
                },
                "message": {
                    "type": "string",
                    "description": "Custom message to include in invite"
                }
            },
            "required": ["event_id"]
        }
    }
]

# E-commerce scenario - demonstrates complex multi-step workflows
ECOMMERCE_FUNCTIONS = [
    {
        "name": "search_products",
        "description": "Search for products in the catalog with filters.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query"
                },
                "category": {
                    "type": "string",
                    "enum": ["electronics", "clothing", "home", "sports", "books", "toys"],
                    "description": "Product category filter"
                },
                "min_price": {
                    "type": "number",
                    "description": "Minimum price filter"
                },
                "max_price": {
                    "type": "number",
                    "description": "Maximum price filter"
                },
                "sort_by": {
                    "type": "string",
                    "enum": ["relevance", "price_asc", "price_desc", "rating", "newest"],
                    "description": "Sort order"
                },
                "in_stock_only": {
                    "type": "boolean",
                    "description": "Only show in-stock items"
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "get_product_details",
        "description": "Get detailed information about a specific product.",
        "parameters": {
            "type": "object",
            "properties": {
                "product_id": {
                    "type": "string",
                    "description": "Product ID"
                },
                "include_reviews": {
                    "type": "boolean",
                    "description": "Include customer reviews"
                }
            },
            "required": ["product_id"]
        }
    },
    {
        "name": "add_to_cart",
        "description": "Add a product to the shopping cart.",
        "parameters": {
            "type": "object",
            "properties": {
                "product_id": {
                    "type": "string",
                    "description": "Product ID to add"
                },
                "quantity": {
                    "type": "integer",
                    "description": "Quantity to add",
                    "minimum": 1
                },
                "variant": {
                    "type": "string",
                    "description": "Product variant (size, color, etc.)"
                }
            },
            "required": ["product_id", "quantity"]
        }
    },
    {
        "name": "get_cart",
        "description": "Get current shopping cart contents and total.",
        "parameters": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "apply_coupon",
        "description": "Apply a coupon code to the cart.",
        "parameters": {
            "type": "object",
            "properties": {
                "code": {
                    "type": "string",
                    "description": "Coupon code"
                }
            },
            "required": ["code"]
        }
    },
    {
        "name": "checkout",
        "description": "Initiate checkout process.",
        "parameters": {
            "type": "object",
            "properties": {
                "shipping_address": {
                    "type": "object",
                    "properties": {
                        "street": {"type": "string"},
                        "city": {"type": "string"},
                        "state": {"type": "string"},
                        "zip": {"type": "string"},
                        "country": {"type": "string"}
                    },
                    "description": "Shipping address"
                },
                "payment_method": {
                    "type": "string",
                    "enum": ["credit_card", "paypal", "apple_pay"],
                    "description": "Payment method"
                }
            },
            "required": ["shipping_address", "payment_method"]
        }
    }
]

# Database scenario - demonstrates data operations
DATABASE_FUNCTIONS = [
    {
        "name": "query_users",
        "description": "Query the users table with filters.",
        "parameters": {
            "type": "object",
            "properties": {
                "filters": {
                    "type": "object",
                    "description": "Filter conditions as key-value pairs"
                },
                "fields": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Fields to return"
                },
                "limit": {
                    "type": "integer",
                    "description": "Max results to return"
                },
                "order_by": {
                    "type": "string",
                    "description": "Field to sort by"
                }
            }
        }
    },
    {
        "name": "insert_record",
        "description": "Insert a new record into a table.",
        "parameters": {
            "type": "object",
            "properties": {
                "table": {
                    "type": "string",
                    "description": "Table name"
                },
                "data": {
                    "type": "object",
                    "description": "Record data as key-value pairs"
                }
            },
            "required": ["table", "data"]
        }
    },
    {
        "name": "update_record",
        "description": "Update an existing record.",
        "parameters": {
            "type": "object",
            "properties": {
                "table": {
                    "type": "string",
                    "description": "Table name"
                },
                "id": {
                    "type": "string",
                    "description": "Record ID"
                },
                "data": {
                    "type": "object",
                    "description": "Fields to update"
                }
            },
            "required": ["table", "id", "data"]
        }
    },
    {
        "name": "delete_record",
        "description": "Delete a record from a table.",
        "parameters": {
            "type": "object",
            "properties": {
                "table": {
                    "type": "string",
                    "description": "Table name"
                },
                "id": {
                    "type": "string",
                    "description": "Record ID"
                }
            },
            "required": ["table", "id"]
        }
    },
    {
        "name": "run_aggregation",
        "description": "Run aggregation queries (count, sum, avg, etc.).",
        "parameters": {
            "type": "object",
            "properties": {
                "table": {
                    "type": "string",
                    "description": "Table name"
                },
                "operation": {
                    "type": "string",
                    "enum": ["count", "sum", "avg", "min", "max"],
                    "description": "Aggregation operation"
                },
                "field": {
                    "type": "string",
                    "description": "Field to aggregate (except for count)"
                },
                "group_by": {
                    "type": "string",
                    "description": "Field to group by"
                },
                "filters": {
                    "type": "object",
                    "description": "Filter conditions"
                }
            },
            "required": ["table", "operation"]
        }
    }
]

# API workflow scenario - demonstrates external API integration
API_WORKFLOW_FUNCTIONS = [
    {
        "name": "fetch_api",
        "description": "Make an HTTP request to an external API.",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "API endpoint URL"
                },
                "method": {
                    "type": "string",
                    "enum": ["GET", "POST", "PUT", "DELETE"],
                    "description": "HTTP method"
                },
                "headers": {
                    "type": "object",
                    "description": "Request headers"
                },
                "body": {
                    "type": "object",
                    "description": "Request body (for POST/PUT)"
                }
            },
            "required": ["url", "method"]
        }
    },
    {
        "name": "parse_response",
        "description": "Parse and extract data from an API response.",
        "parameters": {
            "type": "object",
            "properties": {
                "response_data": {
                    "type": "object",
                    "description": "The API response to parse"
                },
                "extract_fields": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Fields to extract from response"
                },
                "transform": {
                    "type": "string",
                    "description": "Transformation to apply: 'flatten', 'filter', 'map'"
                }
            },
            "required": ["response_data"]
        }
    },
    {
        "name": "store_result",
        "description": "Store processed data for later use.",
        "parameters": {
            "type": "object",
            "properties": {
                "key": {
                    "type": "string",
                    "description": "Storage key"
                },
                "data": {
                    "type": "object",
                    "description": "Data to store"
                },
                "ttl_seconds": {
                    "type": "integer",
                    "description": "Time-to-live in seconds"
                }
            },
            "required": ["key", "data"]
        }
    },
    {
        "name": "send_notification",
        "description": "Send a notification via various channels.",
        "parameters": {
            "type": "object",
            "properties": {
                "channel": {
                    "type": "string",
                    "enum": ["email", "slack", "sms", "push"],
                    "description": "Notification channel"
                },
                "recipient": {
                    "type": "string",
                    "description": "Recipient identifier"
                },
                "subject": {
                    "type": "string",
                    "description": "Notification subject"
                },
                "message": {
                    "type": "string",
                    "description": "Notification body"
                }
            },
            "required": ["channel", "recipient", "message"]
        }
    }
]

# Map scenario names to function lists
PREDEFINED_SCENARIOS: Dict[str, Dict[str, Any]] = {
    "weather": {
        "name": "Weather",
        "description": "Get weather information and forecasts. Demonstrates basic function calling.",
        "functions": WEATHER_FUNCTIONS,
        "example_prompts": [
            "What's the weather in Tokyo?",
            "Will it rain in London tomorrow?",
            "Compare weather in New York and Los Angeles",
            "Get a 5-day forecast for Paris"
        ]
    },
    "smart_home": {
        "name": "Smart Home",
        "description": "Control smart home devices. Demonstrates parallel function calling with multiple devices.",
        "functions": SMART_HOME_FUNCTIONS,
        "example_prompts": [
            "Turn on the living room lights and set thermostat to 72",
            "Start a disco party: colorful lights and music",
            "I'm leaving - lock all doors and turn off lights",
            "Movie night: dim lights to 20% and play relaxing music"
        ]
    },
    "calendar": {
        "name": "Calendar",
        "description": "Manage calendar events and meetings. Demonstrates compositional/sequential calling.",
        "functions": CALENDAR_FUNCTIONS,
        "example_prompts": [
            "Schedule a meeting with John tomorrow at 2pm",
            "Am I free Friday afternoon?",
            "Move my 3pm meeting to 4pm",
            "Check if Sarah is available and schedule a sync"
        ]
    },
    "ecommerce": {
        "name": "E-commerce",
        "description": "Complete shopping workflows. Demonstrates complex multi-step operations.",
        "functions": ECOMMERCE_FUNCTIONS,
        "example_prompts": [
            "Find wireless headphones under $100",
            "Add the Sony WH-1000XM4 to my cart",
            "Apply coupon SAVE20 and checkout",
            "Compare prices of gaming laptops"
        ]
    },
    "database": {
        "name": "Database",
        "description": "Database CRUD operations. Demonstrates data manipulation patterns.",
        "functions": DATABASE_FUNCTIONS,
        "example_prompts": [
            "Find all users created this month",
            "What's the average order value by category?",
            "Update user 123's email address",
            "Count active subscriptions"
        ]
    },
    "api_workflow": {
        "name": "API Workflow",
        "description": "External API integration patterns. Demonstrates multi-step API workflows.",
        "functions": API_WORKFLOW_FUNCTIONS,
        "example_prompts": [
            "Fetch data from the users API and notify me of results",
            "Get the latest exchange rates and store them",
            "Check the status of order #12345",
            "Sync customer data to Salesforce"
        ]
    }
}

# Default functions (legacy compatibility)
DEMO_FUNCTIONS = WEATHER_FUNCTIONS + SMART_HOME_FUNCTIONS[:2]


# ============================================================================
# Mock Function Execution (for demos)
# ============================================================================

def simulate_function_execution(function_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Simulate function execution with realistic mock data.
    Used for demos when simulate_execution=True.
    """
    import random
    from datetime import datetime, timedelta
    
    if function_name == "get_current_weather":
        location = args.get("location", "Unknown")
        unit = args.get("unit", "celsius")
        temp = random.randint(15, 30) if unit == "celsius" else random.randint(59, 86)
        return {
            "location": location,
            "temperature": temp,
            "unit": unit,
            "conditions": random.choice(["sunny", "cloudy", "partly_cloudy", "rainy"]),
            "humidity": random.randint(40, 80),
            "wind_speed": random.randint(5, 25),
            "feels_like": temp + random.randint(-3, 3)
        }
    
    elif function_name == "get_weather_forecast":
        location = args.get("location", "Unknown")
        days = args.get("days", 5)
        forecast = []
        base_date = datetime.now()
        for i in range(days):
            date = base_date + timedelta(days=i+1)
            forecast.append({
                "date": date.strftime("%Y-%m-%d"),
                "high": random.randint(20, 30),
                "low": random.randint(10, 19),
                "conditions": random.choice(["sunny", "cloudy", "rainy", "partly_cloudy"]),
                "precipitation_chance": random.randint(0, 100)
            })
        return {"location": location, "forecast": forecast}
    
    elif function_name == "control_lights":
        return {
            "success": True,
            "room": args.get("room"),
            "state": args.get("action"),
            "brightness": args.get("brightness", 100),
            "color": args.get("color", "white"),
            "message": f"Lights in {args.get('room')} set to {args.get('action')}"
        }
    
    elif function_name == "set_thermostat":
        return {
            "success": True,
            "temperature": args.get("temperature"),
            "mode": args.get("mode", "auto"),
            "message": f"Thermostat set to {args.get('temperature')}°"
        }
    
    elif function_name == "control_music":
        return {
            "success": True,
            "action": args.get("action"),
            "now_playing": "Relaxing Jazz Playlist" if args.get("action") == "play" else None,
            "volume": args.get("volume", 50),
            "message": f"Music {args.get('action')} in {args.get('room', 'all rooms')}"
        }
    
    elif function_name == "lock_doors":
        return {
            "success": True,
            "door": args.get("door"),
            "state": args.get("action") + "ed",
            "message": f"{args.get('door').title()} door {args.get('action')}ed"
        }
    
    elif function_name == "check_calendar":
        date = args.get("date", "today")
        events = [
            {"time": "09:00", "title": "Team Standup", "duration": 30},
            {"time": "14:00", "title": "Project Review", "duration": 60},
        ]
        return {
            "date": date,
            "events": events,
            "available_slots": ["10:00-12:00", "15:00-17:00"]
        }
    
    elif function_name == "create_event":
        return {
            "success": True,
            "event_id": f"evt_{random.randint(10000, 99999)}",
            "title": args.get("title"),
            "date": args.get("date"),
            "start_time": args.get("start_time"),
            "message": f"Event '{args.get('title')}' created successfully"
        }
    
    elif function_name == "search_products":
        products = [
            {"id": "prod_001", "name": "Sony WH-1000XM5 Headphones", "price": 349.99, "rating": 4.8},
            {"id": "prod_002", "name": "Bose QuietComfort 45", "price": 279.99, "rating": 4.7},
            {"id": "prod_003", "name": "Apple AirPods Max", "price": 449.99, "rating": 4.6},
        ]
        return {
            "query": args.get("query"),
            "results": products[:3],
            "total_results": 156,
            "filters_applied": {k: v for k, v in args.items() if k != "query"}
        }
    
    elif function_name == "add_to_cart":
        return {
            "success": True,
            "product_id": args.get("product_id"),
            "quantity": args.get("quantity", 1),
            "cart_total": 349.99,
            "cart_items": 1
        }
    
    elif function_name == "get_cart":
        return {
            "items": [
                {"product_id": "prod_001", "name": "Sony WH-1000XM5", "quantity": 1, "price": 349.99}
            ],
            "subtotal": 349.99,
            "tax": 28.00,
            "total": 377.99
        }
    
    elif function_name == "query_users":
        return {
            "results": [
                {"id": "user_1", "name": "John Doe", "email": "john@example.com", "created_at": "2024-01-15"},
                {"id": "user_2", "name": "Jane Smith", "email": "jane@example.com", "created_at": "2024-02-20"},
            ],
            "total": 2,
            "query": args
        }
    
    elif function_name == "run_aggregation":
        return {
            "operation": args.get("operation"),
            "field": args.get("field"),
            "result": random.randint(100, 10000) if args.get("operation") != "avg" else round(random.uniform(10, 500), 2),
            "table": args.get("table")
        }
    
    elif function_name == "fetch_api":
        return {
            "status": 200,
            "data": {"message": "API call successful", "timestamp": datetime.now().isoformat()},
            "headers": {"content-type": "application/json"}
        }
    
    elif function_name == "send_notification":
        return {
            "success": True,
            "channel": args.get("channel"),
            "recipient": args.get("recipient"),
            "message_id": f"msg_{random.randint(10000, 99999)}",
            "sent_at": datetime.now().isoformat()
        }
    
    # Default response for unknown functions
    return {
        "success": True,
        "function": function_name,
        "args": args,
        "message": f"Function {function_name} executed successfully"
    }


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/function-calling/scenarios")
async def list_function_scenarios(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    List all predefined function calling scenarios.
    
    Each scenario contains:
    - name: Human-readable scenario name
    - description: What the scenario demonstrates
    - functions: List of function declarations
    - example_prompts: Sample prompts to try
    """
    return {
        "scenarios": {
            key: {
                "name": value["name"],
                "description": value["description"],
                "function_count": len(value["functions"]),
                "functions": [f["name"] for f in value["functions"]],
                "example_prompts": value["example_prompts"]
            }
            for key, value in PREDEFINED_SCENARIOS.items()
        }
    }


@router.get("/function-calling/scenarios/{scenario_id}")
async def get_function_scenario(
    request: Request,
    scenario_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed information about a specific scenario including full function declarations."""
    if scenario_id not in PREDEFINED_SCENARIOS:
        raise HTTPException(
            status_code=404, 
            detail=f"Scenario '{scenario_id}' not found. Available: {list(PREDEFINED_SCENARIOS.keys())}"
        )
    
    scenario = PREDEFINED_SCENARIOS[scenario_id]
    return {
        "id": scenario_id,
        "name": scenario["name"],
        "description": scenario["description"],
        "functions": scenario["functions"],
        "example_prompts": scenario["example_prompts"]
    }


@router.post("/function-calling/simulate")
@limiter.limit("20/minute")
async def simulate_function(
    request: Request,
    function_name: str,
    args: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """
    Simulate execution of a function with mock data.
    Useful for testing and demos without real integrations.
    """
    result = simulate_function_execution(function_name, args)
    return {
        "success": True,
        "function": function_name,
        "args": args,
        "result": result
    }


@router.post("/function-calling")
@limiter.limit("10/minute")
async def function_calling(
    request: Request,
    body: FunctionCallRequest,
    current_user: dict = Depends(get_current_user),
    redis=Depends(get_redis_optional),
):
    """
    Execute comprehensive function calling with Gemini.
    
    **Features:**
    - 4 modes: AUTO, ANY, NONE, VALIDATED
    - 6 predefined scenarios with 25+ functions
    - Parallel function calling (multiple functions per turn)
    - Compositional calling (chained function workflows)
    - Multi-tool use (combine with Google Search, Code Execution)
    - Automatic simulation for demos
    - Multi-turn conversation support
    
    **Workflow:**
    1. Send prompt with function declarations
    2. Model returns function_calls array
    3. Execute functions locally or use simulate_execution=True
    4. Return results via function_results for next turn
    5. Model provides final response
    """
    import os
    import time
    
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise HTTPException(status_code=501, detail="google-genai SDK required")
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")
    
    start_time = time.time()
    client = genai.Client(api_key=api_key)
    
    # Determine which functions to use
    functions_list = []
    if body.function_set_id:
        # Load from framework function store (highest priority)
        from app.api.gemini.llm_store import load_function_set_from_store
        stored_set = load_function_set_from_store(body.function_set_id)
        if stored_set is None:
            raise HTTPException(
                status_code=404,
                detail=f"Function set '{body.function_set_id}' not found. "
                       "Use GET /api/v1/gemini/function-sets to list available sets."
            )
        functions_list = stored_set.get("functions", [])
        if not functions_list:
            raise HTTPException(status_code=422, detail=f"Function set '{body.function_set_id}' contains no functions.")
    elif body.functions:
        # Use custom functions from request body
        functions_list = [f.model_dump() for f in body.functions]
    elif body.scenario and body.scenario in PREDEFINED_SCENARIOS:
        # Use predefined scenario functions
        functions_list = PREDEFINED_SCENARIOS[body.scenario]["functions"]
    else:
        # Use default demo functions
        functions_list = DEMO_FUNCTIONS
    
    # Build function declarations for API
    function_declarations = []
    for func in functions_list:
        function_declarations.append(types.FunctionDeclaration(**func))
    
    # Build tools list
    tools = [types.Tool(function_declarations=function_declarations)]
    
    # Add Google Search if enabled
    if body.enable_google_search:
        tools.append(types.Tool(google_search=types.GoogleSearch()))
    
    # Add Code Execution if enabled
    if body.enable_code_execution:
        tools.append(types.Tool(code_execution=types.ToolCodeExecution()))
    
    # Build tool config based on mode
    tool_config_kwargs = {}
    mode_value = body.mode.value if hasattr(body.mode, 'value') else body.mode
    
    if mode_value == "AUTO":
        tool_config_kwargs["function_calling_config"] = types.FunctionCallingConfig(
            mode="AUTO"
        )
    elif mode_value == "ANY":
        config_kwargs = {"mode": "ANY"}
        if body.allowed_function_names:
            config_kwargs["allowed_function_names"] = body.allowed_function_names
        tool_config_kwargs["function_calling_config"] = types.FunctionCallingConfig(**config_kwargs)
    elif mode_value == "NONE":
        tool_config_kwargs["function_calling_config"] = types.FunctionCallingConfig(
            mode="NONE"
        )
    elif mode_value == "VALIDATED":
        config_kwargs = {"mode": "VALIDATED"}
        if body.allowed_function_names:
            config_kwargs["allowed_function_names"] = body.allowed_function_names
        tool_config_kwargs["function_calling_config"] = types.FunctionCallingConfig(**config_kwargs)
    
    # Build config
    config_kwargs = {
        "tools": tools,
        "temperature": body.temperature
    }
    if tool_config_kwargs:
        config_kwargs["tool_config"] = types.ToolConfig(**tool_config_kwargs)
    if body.max_tokens:
        config_kwargs["max_output_tokens"] = body.max_tokens
    
    config = types.GenerateContentConfig(**config_kwargs)
    
    try:
        # Build contents - support multi-turn
        contents = []
        
        # Add conversation history if provided
        if body.conversation_history:
            for turn in body.conversation_history:
                if turn.role == "user":
                    contents.append(types.Content(
                        role="user",
                        parts=[types.Part.from_text(turn.content or "")]
                    ))
                elif turn.role == "model":
                    parts = []
                    if turn.content:
                        parts.append(types.Part.from_text(turn.content))
                    if turn.function_call:
                        parts.append(types.Part.from_function_call(
                            name=turn.function_call.get("name"),
                            args=turn.function_call.get("args", {})
                        ))
                    contents.append(types.Content(role="model", parts=parts))
                elif turn.role == "function" and turn.function_response:
                    contents.append(types.Content(
                        role="user",
                        parts=[types.Part.from_function_response(
                            name=turn.function_response.name,
                            response=turn.function_response.result
                        )]
                    ))
        
        # Add current prompt
        contents.append(types.Content(
            role="user",
            parts=[types.Part.from_text(body.prompt)]
        ))
        
        # Add function results from previous turn if provided
        if body.function_results:
            for fr in body.function_results:
                contents.append(types.Content(
                    role="user",
                    parts=[types.Part.from_function_response(
                        name=fr.name,
                        response=fr.result
                    )]
                ))
        
        response = client.models.generate_content(
            model=body.model,
            contents=contents,
            config=config
        )
        
        usage = extract_usage(response, body.model, start_time)
        
        # Extract function calls and text
        function_calls = []
        text_response = None
        code_execution_result = None
        search_results = None
        
        if hasattr(response, 'candidates') and response.candidates:
            for candidate in response.candidates:
                if hasattr(candidate, 'content') and candidate.content:
                    for part in candidate.content.parts:
                        if hasattr(part, 'function_call') and part.function_call:
                            fc = part.function_call
                            function_calls.append({
                                "name": fc.name,
                                "args": dict(fc.args) if fc.args else {}
                            })
                        elif hasattr(part, 'text') and part.text:
                            text_response = part.text
                        elif hasattr(part, 'executable_code') and part.executable_code:
                            code_execution_result = {
                                "code": part.executable_code.code,
                                "language": getattr(part.executable_code, 'language', 'python')
                            }
                        elif hasattr(part, 'code_execution_result') and part.code_execution_result:
                            if code_execution_result:
                                code_execution_result["output"] = part.code_execution_result.output
        
        # Simulate function execution if requested
        simulated_results = None
        if body.simulate_execution and function_calls:
            simulated_results = []
            for fc in function_calls:
                result = simulate_function_execution(fc["name"], fc["args"])
                simulated_results.append({
                    "function": fc["name"],
                    "result": result
                })
        
        # Build response
        result = {
            "success": True,
            "function_calls": function_calls,
            "parallel_calls": len(function_calls) > 1,
            "text_response": text_response,
            "mode": mode_value,
            "model": body.model,
            "scenario": body.scenario,
            "available_functions": [f["name"] for f in functions_list],
            "usage": usage.model_dump()
        }
        
        if simulated_results:
            result["simulated_results"] = simulated_results
        if code_execution_result:
            result["code_execution"] = code_execution_result
        if search_results:
            result["search_results"] = search_results
        if body.enable_google_search:
            result["google_search_enabled"] = True
        if body.enable_code_execution:
            result["code_execution_enabled"] = True

        # Fire-and-forget: log call to Redis
        import asyncio, json as _json
        asyncio.create_task(log_llm_call(
            redis_client=redis,
            endpoint="function_calling",
            model=body.model,
            user_id=str(current_user.get("id", "")),
            prompt_preview=body.prompt,
            output_preview=_json.dumps(function_calls)[:500] if function_calls else (text_response or ""),
            usage=usage,
            extra={
                "function_set_id": body.function_set_id,
                "scenario": body.scenario,
                "mode": mode_value,
                "function_count": len(function_calls),
            },
        ))

        return result

    except Exception as e:
        logger.error("function_calling_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/url-context")
@limiter.limit("5/minute")
async def url_context(
    request: Request,
    body: URLContextRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Ground responses in URL content.
    
    Fetches and analyzes the content of specified URLs to provide
    grounded responses with optional citations.
    """
    import os
    import time
    
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise HTTPException(status_code=501, detail="google-genai SDK required")
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")
    
    start_time = time.time()
    client = genai.Client(api_key=api_key)
    
    # Build tools list
    tools_list = [types.Tool(url_context=types.UrlContext())]
    
    # Optionally add Google Search for broader context
    if body.combine_with_search:
        tools_list.append(types.Tool(google_search=types.GoogleSearch()))
    
    # Build config
    config_kwargs = {
        "tools": tools_list
    }
    
    if body.dynamic_retrieval_threshold is not None:
        config_kwargs["dynamic_retrieval_config"] = types.DynamicRetrievalConfig(
            threshold=body.dynamic_retrieval_threshold
        )
    
    try:
        # Build prompt with URLs
        url_list = "\n".join(f"- {url}" for url in body.urls)
        
        # Build the user prompt
        user_prompt = f"Based on the following URLs:\n{url_list}\n\n{body.prompt}"
        
        # For models with tools, system_instruction works best as part of the content
        # when using certain tool configurations
        if body.system_instruction:
            # Use a multi-turn format with system instruction as context
            contents = [
                types.Content(
                    role="user",
                    parts=[types.Part(text=f"System context: {body.system_instruction}\n\n{user_prompt}")]
                )
            ]
        else:
            contents = user_prompt
        
        response = client.models.generate_content(
            model=body.model,
            contents=contents,
            config=types.GenerateContentConfig(**config_kwargs)
        )
        
        usage = extract_usage(response, body.model, start_time)
        
        # Extract citations if available
        citations = []
        search_suggestions = []
        if hasattr(response, 'candidates') and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
                gm = candidate.grounding_metadata
                # Extract grounding chunks (URL content citations)
                if hasattr(gm, 'grounding_chunks') and gm.grounding_chunks:
                    for chunk in gm.grounding_chunks:
                        if hasattr(chunk, 'web') and chunk.web:
                            citations.append({
                                "url": getattr(chunk.web, 'uri', ''),
                                "title": getattr(chunk.web, 'title', '')
                            })
                # Extract search suggestions if google search was used
                if hasattr(gm, 'web_search_queries') and gm.web_search_queries:
                    search_suggestions = list(gm.web_search_queries)
        
        result = {
            "success": True,
            "response": response.text,
            "urls_analyzed": body.urls,
            "model": body.model,
            "usage": usage.model_dump()
        }
        
        if body.include_citations:
            result["citations"] = citations
        if body.combine_with_search:
            result["google_search_used"] = True
            result["search_suggestions"] = search_suggestions
        
        return result
        
    except Exception as e:
        logger.error("url_context_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
