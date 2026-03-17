"""
Gemini Text API Module
======================

This module provides text-related Gemini API endpoints:

**Text Generation**
- Generate: Text generation with thinking control
- Structured: Generate structured JSON output
- Capabilities: List available model capabilities

**Token Management**
- Count Tokens: Count tokens in text content
- Estimate Multimodal: Estimate tokens for multimodal content
- Model Info: Get model specifications

Documentation:
- Text Generation: https://ai.google.dev/gemini-api/docs/text-generation
- Structured Output: https://ai.google.dev/gemini-api/docs/structured-output
- Token Counting: https://ai.google.dev/gemini-api/docs/tokens

Models:
- gemini-3.1-flash-lite-preview: Fast, efficient for most tasks (default)
- gemini-3-flash-preview: Previous generation flash
- gemini-3-pro-preview: Most capable for complex reasoning
- gemini-2.5-flash: Cost-effective for high volume
- gemini-2.5-pro: Advanced reasoning with extended context
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from app.api.deps import get_db, get_current_user
from app.core.limiter import limiter
from sqlalchemy.orm import Session
from app.api.gemini._common import (
    UsageStats,
    MODEL_PRICING,
    extract_usage,
    calculate_cost,
    log_llm_call,
    logger,
)
from app.db.redis import get_redis_optional

router = APIRouter(tags=["gemini-text"])


# ============================================================================
# Request/Response Schemas
# ============================================================================

class GenerateRequest(BaseModel):
    """
    Text generation request with thinking control.
    
    **Thinking Levels (Gemini 3 models):**
    - minimal: Flash only, may still think for complex tasks. Minimizes latency.
    - low: Pro and Flash. Minimizes latency and cost.
    - medium: Flash only. Balanced thinking.
    - high: Pro and Flash (default). Maximizes reasoning depth.
    
    **Thinking Budget (Gemini 2.5 models):**
    - -1: Dynamic thinking (default), model adjusts based on complexity
    - 0: Disable thinking (Flash only, Pro cannot disable)
    - 128-32768: Token budget for Pro
    - 0-24576: Token budget for Flash
    
    **Note:** Use thinking_level for Gemini 3, thinking_budget for Gemini 2.5
    
    See: https://ai.google.dev/gemini-api/docs/thinking
    """
    prompt: str = Field(..., description="The prompt text")
    thinking_level: Optional[str] = Field(
        None,
        description="Thinking level for Gemini 3: minimal (Flash only), low, medium (Flash only), high (default)"
    )
    thinking_budget: Optional[int] = Field(
        None,
        description="Token budget for Gemini 2.5: -1 (dynamic), 0 (off, Flash only), or specific token count"
    )
    model: str = Field(
        "gemini-3.1-flash-lite-preview",
        description="Model: gemini-3.1-flash-lite-preview, gemini-3-flash-preview, gemini-3-pro-preview, gemini-2.5-flash, gemini-2.5-pro"
    )
    include_thoughts: bool = Field(
        False,
        description="Include thinking summary in response"
    )
    system_instruction: Optional[str] = Field(
        None,
        description="System instruction/persona for the model"
    )
    temperature: Optional[float] = Field(
        None,
        description="Temperature 0-2 (default: 1.0, recommended to keep at 1.0 for Gemini 3)"
    )
    max_tokens: Optional[int] = Field(
        None,
        description="Maximum output tokens"
    )
    guild_id: Optional[str] = None


class GenerateResponse(BaseModel):
    """Text generation response."""
    text: Optional[str] = None
    thoughts_summary: Optional[str] = None
    usage: Optional[UsageStats] = None
    thinking_level: Optional[str] = None
    thinking_budget: Optional[int] = None
    model: str = ""


class TokenCountRequest(BaseModel):
    """
    Token counting request.
    
    Count tokens for text content to estimate costs and stay within limits.
    
    **Token Calculation:**
    - Text: ~4 characters per token (varies by language)
    - Images: 258 tokens if ≤384px, otherwise 258 per 768x768 tile
    - Audio: 32 tokens per second
    - Video: 258 tokens per frame (1 fps default)
    
    See: https://ai.google.dev/gemini-api/docs/tokens
    """
    text: str = Field(..., description="Text to count tokens for")
    model: str = Field(
        "gemini-3.1-flash-lite-preview",
        description="Model to use for counting"
    )
    include_system_instruction: bool = Field(
        False,
        description="Include system instruction in count"
    )
    system_instruction: Optional[str] = Field(
        None,
        description="System instruction to include"
    )


class TokenCountResponse(BaseModel):
    """Token counting response."""
    total_tokens: int
    text_tokens: int
    cached_tokens: int = 0
    model: str
    billable_characters: Optional[int] = None
    estimated_cost_1k_prompts: float = 0.0


class MultimodalTokenEstimate(BaseModel):
    """Multimodal token estimation result."""
    total_tokens: int
    text_tokens: int
    image_tokens: int
    audio_tokens: int
    video_tokens: int
    cached_tokens: int = 0


class MultimodalTokenRequest(BaseModel):
    """
    Request to estimate multimodal tokens.
    
    Estimate token usage for mixed content before sending.
    
    **Token Rates:**
    - Text: ~4 chars/token
    - Image: 258 base + 258 per 768x768 tile
    - Audio: 32 tokens/second
    - Video: 258 tokens/frame (1 fps)
    """
    text: Optional[str] = Field(None, description="Text content")
    image_urls: Optional[List[str]] = Field(None, description="Image URLs")
    audio_urls: Optional[List[str]] = Field(None, description="Audio URLs")
    video_urls: Optional[List[str]] = Field(None, description="Video URLs")
    model: str = Field(
        "gemini-3-flash-preview",
        description="Model for estimation"
    )


class StructuredRequest(BaseModel):
    """
    Structured output request - Generate JSON conforming to a schema.
    
    This endpoint provides full access to Gemini's structured output capabilities
    as documented at: https://ai.google.dev/gemini-api/docs/structured-output
    
    **Use Cases:**
    1. Data Extraction: Pull specific information from unstructured text
    2. Classification: Categorize content into predefined categories using enums
    3. Agentic Workflows: Generate structured inputs for tools or APIs
    
    **Schema Options:**
    1. `schema_name`: Use predefined schemas (person, recipe, article, review, feedback, event, product)
    2. `custom_schema`: Provide your own JSON Schema (required if schema_name='custom')
    3. `enum_values`: Simple classification mode - output constrained to one value
    
    **Supported JSON Schema Features:**
    - Types: string, number, integer, boolean, object, array, null
    - Properties: properties, required, additionalProperties
    - Strings: enum, format (date-time, date, time)
    - Numbers: enum, minimum, maximum
    - Arrays: items, prefixItems, minItems, maxItems
    - Descriptions: title, description (guides model output)
    - Nullable: Use ["string", "null"] for optional fields
    
    **Model Support:**
    - Gemini 3: Best support, natural key ordering
    - Gemini 2.5: Requires propertyOrdering hint in schema
    - Gemini 2.0: Basic support with propertyOrdering required
    
    **Best Practices:**
    - Use `description` fields to guide the model
    - Use `enum` for classification tasks
    - Use specific types (integer vs number) when possible
    - Keep schemas reasonably sized (avoid deeply nested structures)
    
    See: https://ai.google.dev/gemini-api/docs/structured-output
    """
    prompt: str = Field(..., description="Content to extract structured data from")
    schema_id: Optional[str] = Field(
        None,
        description="ID of a schema stored in the framework's schema store (backend/schemas/{id}.json). "
                    "Takes priority over schema_name and custom_schema. "
                    "Use GET /api/v1/gemini/schemas to list available schemas."
    )
    schema_name: str = Field(
        "custom",
        description="Predefined schema: person, recipe, article, review, feedback, event, product, custom"
    )
    custom_schema: Optional[Dict[str, Any]] = Field(
        None,
        description="Custom JSON Schema. Must be valid JSON Schema with 'type' and 'properties' for objects."
    )
    model: str = Field(
        "gemini-3-flash-preview",
        description="Model: gemini-3-flash-preview (recommended), gemini-3-pro-preview, gemini-2.5-flash, gemini-2.5-pro"
    )
    
    # Classification mode
    enum_values: Optional[List[str]] = Field(
        None,
        description="Simple enum mode: output constrained to exactly one of these string values"
    )
    enum_type: Optional[str] = Field(
        "string",
        description="Type for enum mode: 'string', 'integer', or 'number'"
    )
    
    # Enhanced features
    use_tools: Optional[List[str]] = Field(
        None,
        description="Combine with tools: 'google_search', 'url_context' (Gemini 3 only)"
    )
    strict_mode: bool = Field(
        True,
        description="Enforce strict schema validation (recommended)"
    )
    include_null: bool = Field(
        False,
        description="Allow null values for optional fields"
    )
    property_ordering: Optional[List[str]] = Field(
        None,
        description="Explicit property order (required for Gemini 2.0/2.5)"
    )
    
    # Response options
    return_schema: bool = Field(
        False,
        description="Include the resolved schema in response"
    )
    validate_response: bool = Field(
        True,
        description="Validate response against schema before returning"
    )


# ============================================================================
# Predefined Schemas - Comprehensive Examples
# ============================================================================

PREDEFINED_SCHEMAS = {
    "person": {
        "type": "object",
        "title": "Person",
        "description": "Information about a person",
        "properties": {
            "name": {"type": "string", "description": "Full name of the person"},
            "age": {"type": ["integer", "null"], "description": "Age in years", "minimum": 0, "maximum": 150},
            "occupation": {"type": "string", "description": "Current job or profession"},
            "email": {"type": ["string", "null"], "description": "Email address", "format": "email"},
            "phone": {"type": ["string", "null"], "description": "Phone number"},
            "skills": {
                "type": "array",
                "description": "List of professional skills",
                "items": {"type": "string"},
                "minItems": 0,
                "maxItems": 20
            },
            "education": {
                "type": "array",
                "description": "Educational background",
                "items": {
                    "type": "object",
                    "properties": {
                        "institution": {"type": "string"},
                        "degree": {"type": "string"},
                        "year": {"type": "integer"}
                    },
                    "required": ["institution"]
                }
            },
            "location": {
                "type": "object",
                "properties": {
                    "city": {"type": "string"},
                    "country": {"type": "string"}
                }
            }
        },
        "required": ["name"]
    },
    
    "recipe": {
        "type": "object",
        "title": "Recipe",
        "description": "A cooking recipe with ingredients and instructions",
        "properties": {
            "title": {"type": "string", "description": "Name of the recipe"},
            "description": {"type": "string", "description": "Brief description of the dish"},
            "prep_time_minutes": {"type": "integer", "minimum": 0, "description": "Preparation time in minutes"},
            "cook_time_minutes": {"type": "integer", "minimum": 0, "description": "Cooking time in minutes"},
            "total_time_minutes": {"type": "integer", "minimum": 0, "description": "Total time including prep and cook"},
            "servings": {"type": "integer", "minimum": 1, "description": "Number of servings"},
            "difficulty": {
                "type": "string",
                "enum": ["easy", "medium", "hard", "expert"],
                "description": "Difficulty level"
            },
            "cuisine": {"type": "string", "description": "Type of cuisine (e.g., Italian, Mexican)"},
            "diet_tags": {
                "type": "array",
                "items": {
                    "type": "string",
                    "enum": ["vegetarian", "vegan", "gluten-free", "dairy-free", "keto", "paleo", "low-carb"]
                },
                "description": "Dietary tags"
            },
            "ingredients": {
                "type": "array",
                "description": "List of ingredients",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Ingredient name"},
                        "quantity": {"type": "string", "description": "Amount needed"},
                        "unit": {"type": "string", "description": "Unit of measurement"},
                        "notes": {"type": ["string", "null"], "description": "Optional notes (e.g., 'finely chopped')"}
                    },
                    "required": ["name", "quantity"]
                },
                "minItems": 1
            },
            "instructions": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Step-by-step cooking instructions",
                "minItems": 1
            },
            "tips": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Optional cooking tips"
            },
            "nutrition": {
                "type": "object",
                "description": "Nutritional information per serving",
                "properties": {
                    "calories": {"type": "integer", "minimum": 0},
                    "protein_g": {"type": "number", "minimum": 0},
                    "carbs_g": {"type": "number", "minimum": 0},
                    "fat_g": {"type": "number", "minimum": 0},
                    "fiber_g": {"type": "number", "minimum": 0}
                }
            }
        },
        "required": ["title", "ingredients", "instructions"]
    },
    
    "article": {
        "type": "object",
        "title": "Article",
        "description": "Structured article or document analysis",
        "properties": {
            "title": {"type": "string", "description": "Article title"},
            "author": {"type": ["string", "null"], "description": "Author name if known"},
            "publication_date": {"type": ["string", "null"], "format": "date", "description": "Publication date"},
            "summary": {"type": "string", "description": "Brief summary of the article"},
            "main_topics": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Main topics covered",
                "minItems": 1,
                "maxItems": 10
            },
            "key_points": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Key takeaways or points"
            },
            "entities": {
                "type": "array",
                "description": "Named entities mentioned (people, places, organizations)",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "type": {"type": "string", "enum": ["person", "organization", "location", "product", "event", "other"]}
                    },
                    "required": ["name", "type"]
                }
            },
            "sentiment": {
                "type": "string",
                "enum": ["very_positive", "positive", "neutral", "negative", "very_negative"],
                "description": "Overall sentiment"
            },
            "category": {"type": "string", "description": "Article category"},
            "word_count": {"type": "integer", "minimum": 0},
            "reading_time_minutes": {"type": "integer", "minimum": 1}
        },
        "required": ["title", "summary"]
    },
    
    "review": {
        "type": "object",
        "title": "Review",
        "description": "Product or service review analysis",
        "properties": {
            "product_name": {"type": "string", "description": "Name of the product or service"},
            "product_category": {"type": "string", "description": "Category (e.g., Electronics, Software)"},
            "rating": {
                "type": "number",
                "minimum": 1,
                "maximum": 5,
                "description": "Rating from 1 to 5"
            },
            "rating_breakdown": {
                "type": "object",
                "description": "Detailed ratings by category",
                "properties": {
                    "quality": {"type": "number", "minimum": 1, "maximum": 5},
                    "value": {"type": "number", "minimum": 1, "maximum": 5},
                    "ease_of_use": {"type": "number", "minimum": 1, "maximum": 5},
                    "features": {"type": "number", "minimum": 1, "maximum": 5},
                    "support": {"type": ["number", "null"], "minimum": 1, "maximum": 5}
                }
            },
            "pros": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Positive aspects"
            },
            "cons": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Negative aspects"
            },
            "summary": {"type": "string", "description": "Brief review summary"},
            "detailed_review": {"type": ["string", "null"], "description": "Detailed review text"},
            "recommendation": {
                "type": "string",
                "enum": ["highly_recommend", "recommend", "neutral", "not_recommend", "strongly_avoid"],
                "description": "Recommendation level"
            },
            "best_for": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Who this product is best for"
            },
            "verified_purchase": {"type": "boolean", "description": "Whether this is a verified purchase"}
        },
        "required": ["product_name", "rating", "summary"]
    },
    
    "feedback": {
        "type": "object",
        "title": "Feedback",
        "description": "User feedback classification (from official docs example)",
        "properties": {
            "sentiment": {
                "type": "string",
                "enum": ["positive", "neutral", "negative"],
                "description": "Overall sentiment"
            },
            "confidence": {
                "type": "number",
                "minimum": 0,
                "maximum": 1,
                "description": "Confidence score 0-1"
            },
            "summary": {"type": "string", "description": "Brief summary of the feedback"},
            "key_themes": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Main themes in the feedback"
            },
            "action_items": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Suggested action items based on feedback"
            },
            "priority": {
                "type": "string",
                "enum": ["low", "medium", "high", "critical"],
                "description": "Priority level"
            }
        },
        "required": ["sentiment", "summary"]
    },
    
    "event": {
        "type": "object",
        "title": "Event",
        "description": "Event information extraction",
        "properties": {
            "name": {"type": "string", "description": "Event name"},
            "event_type": {
                "type": "string",
                "enum": ["conference", "meetup", "webinar", "workshop", "concert", "sports", "social", "other"],
                "description": "Type of event"
            },
            "date": {"type": ["string", "null"], "format": "date", "description": "Event date"},
            "start_time": {"type": ["string", "null"], "format": "time", "description": "Start time"},
            "end_time": {"type": ["string", "null"], "format": "time", "description": "End time"},
            "location": {
                "type": "object",
                "properties": {
                    "venue": {"type": "string"},
                    "address": {"type": "string"},
                    "city": {"type": "string"},
                    "country": {"type": "string"},
                    "is_virtual": {"type": "boolean"}
                }
            },
            "description": {"type": "string", "description": "Event description"},
            "organizer": {"type": "string", "description": "Event organizer"},
            "speakers": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "title": {"type": "string"},
                        "company": {"type": "string"}
                    }
                },
                "description": "List of speakers"
            },
            "price": {
                "type": "object",
                "properties": {
                    "amount": {"type": "number", "minimum": 0},
                    "currency": {"type": "string"},
                    "is_free": {"type": "boolean"}
                }
            },
            "registration_url": {"type": ["string", "null"], "description": "Registration link"},
            "capacity": {"type": ["integer", "null"], "minimum": 1},
            "tags": {"type": "array", "items": {"type": "string"}}
        },
        "required": ["name", "event_type"]
    },
    
    "product": {
        "type": "object",
        "title": "Product",
        "description": "Product information extraction",
        "properties": {
            "name": {"type": "string", "description": "Product name"},
            "brand": {"type": "string", "description": "Brand name"},
            "category": {"type": "string", "description": "Product category"},
            "subcategory": {"type": ["string", "null"], "description": "Subcategory"},
            "description": {"type": "string", "description": "Product description"},
            "price": {
                "type": "object",
                "properties": {
                    "amount": {"type": "number", "minimum": 0},
                    "currency": {"type": "string", "description": "3-letter currency code"},
                    "sale_price": {"type": ["number", "null"], "minimum": 0},
                    "discount_percent": {"type": ["number", "null"], "minimum": 0, "maximum": 100}
                }
            },
            "specifications": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "value": {"type": "string"}
                    },
                    "required": ["name", "value"]
                },
                "description": "Technical specifications"
            },
            "features": {"type": "array", "items": {"type": "string"}, "description": "Key features"},
            "availability": {
                "type": "string",
                "enum": ["in_stock", "low_stock", "out_of_stock", "pre_order", "discontinued"]
            },
            "sku": {"type": ["string", "null"], "description": "Product SKU"},
            "upc": {"type": ["string", "null"], "description": "UPC barcode"},
            "weight": {
                "type": "object",
                "properties": {
                    "value": {"type": "number", "minimum": 0},
                    "unit": {"type": "string", "enum": ["g", "kg", "oz", "lb"]}
                }
            },
            "dimensions": {
                "type": "object",
                "properties": {
                    "length": {"type": "number", "minimum": 0},
                    "width": {"type": "number", "minimum": 0},
                    "height": {"type": "number", "minimum": 0},
                    "unit": {"type": "string", "enum": ["cm", "in", "mm"]}
                }
            },
            "images": {"type": "array", "items": {"type": "string"}, "description": "Image URLs"},
            "rating": {"type": ["number", "null"], "minimum": 0, "maximum": 5},
            "review_count": {"type": ["integer", "null"], "minimum": 0}
        },
        "required": ["name", "description"]
    },
    
    # Simple classification schemas
    "sentiment": {
        "type": "object",
        "title": "Sentiment Classification",
        "description": "Simple sentiment analysis",
        "properties": {
            "sentiment": {
                "type": "string",
                "enum": ["positive", "neutral", "negative"],
                "description": "Detected sentiment"
            },
            "confidence": {
                "type": "number",
                "minimum": 0,
                "maximum": 1,
                "description": "Confidence score"
            }
        },
        "required": ["sentiment", "confidence"]
    },
    
    "language": {
        "type": "object",
        "title": "Language Detection",
        "description": "Detect language of text",
        "properties": {
            "language_code": {"type": "string", "description": "ISO 639-1 language code"},
            "language_name": {"type": "string", "description": "Full language name"},
            "confidence": {"type": "number", "minimum": 0, "maximum": 1}
        },
        "required": ["language_code", "language_name"]
    },
    
    "intent": {
        "type": "object",
        "title": "Intent Classification",
        "description": "Classify user intent",
        "properties": {
            "intent": {
                "type": "string",
                "enum": ["question", "command", "statement", "request", "complaint", "compliment", "other"],
                "description": "Primary intent"
            },
            "sub_intent": {"type": ["string", "null"], "description": "More specific intent"},
            "entities": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string"},
                        "value": {"type": "string"}
                    }
                },
                "description": "Extracted entities"
            },
            "confidence": {"type": "number", "minimum": 0, "maximum": 1}
        },
        "required": ["intent"]
    }
}


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/generate", response_model=GenerateResponse)
@limiter.limit("10/minute")
async def text_generate(
    request: Request,
    body: GenerateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    redis=Depends(get_redis_optional),
):
    """
    Generate text using Gemini with configurable thinking levels.
    
    Supports both Gemini 3 (thinking_level) and Gemini 2.5 (thinking_budget) models.
    Temperature is recommended to stay at 1.0 for Gemini 3 models.
    """
    import os
    import time
    
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="google-genai SDK not installed. Install with: pip install google-genai"
        )
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")
    
    start_time = time.time()
    client = genai.Client(api_key=api_key)
    
    # Determine model type
    is_gemini_3 = "gemini-3" in body.model
    is_gemini_pro = "-pro" in body.model
    is_gemini_flash = "-flash" in body.model
    
    # Build thinking config
    thinking_config_kwargs = {"include_thoughts": body.include_thoughts}
    actual_thinking_level = None
    actual_thinking_budget = None
    
    if is_gemini_3:
        # Gemini 3 uses thinking_level
        valid_levels = ["low", "high"] if is_gemini_pro else ["minimal", "low", "medium", "high"]
        actual_thinking_level = body.thinking_level if body.thinking_level in valid_levels else "high"
        thinking_config_kwargs["thinking_level"] = actual_thinking_level
    else:
        # Gemini 2.5 uses thinking_budget
        if body.thinking_budget is not None:
            if is_gemini_pro and body.thinking_budget == 0:
                actual_thinking_budget = 128  # Pro can't disable
            elif is_gemini_pro:
                actual_thinking_budget = max(128, min(32768, body.thinking_budget))
            elif is_gemini_flash:
                actual_thinking_budget = max(0, min(24576, body.thinking_budget))
            else:
                actual_thinking_budget = body.thinking_budget
        else:
            actual_thinking_budget = -1  # Dynamic
        thinking_config_kwargs["thinking_budget"] = actual_thinking_budget
    
    thinking_config = types.ThinkingConfig(**thinking_config_kwargs)
    
    # Build generation config
    config_kwargs = {"thinking_config": thinking_config}
    if body.system_instruction:
        config_kwargs["system_instruction"] = body.system_instruction
    if body.temperature is not None:
        config_kwargs["temperature"] = body.temperature
    if body.max_tokens is not None:
        config_kwargs["max_output_tokens"] = body.max_tokens
    
    config = types.GenerateContentConfig(**config_kwargs)
    
    try:
        response = client.models.generate_content(
            model=body.model,
            contents=body.prompt,
            config=config
        )
        
        # Extract text and thoughts
        text_content = None
        thoughts_summary = None
        
        if hasattr(response, 'candidates') and response.candidates:
            for candidate in response.candidates:
                if hasattr(candidate, 'content') and candidate.content:
                    for part in candidate.content.parts:
                        if hasattr(part, 'thought') and part.thought:
                            thoughts_summary = part.text
                        elif hasattr(part, 'text'):
                            text_content = part.text
        
        usage = extract_usage(response, body.model, start_time)

        # Fire-and-forget: log call to Redis
        import asyncio
        asyncio.create_task(log_llm_call(
            redis_client=redis,
            endpoint="generate",
            model=body.model,
            user_id=str(current_user.get("id", "")),
            prompt_preview=body.prompt,
            output_preview=text_content or "",
            usage=usage,
            extra={"guild_id": body.guild_id},
        ))

        return GenerateResponse(
            text=text_content or response.text,
            thoughts_summary=thoughts_summary,
            usage=usage,
            thinking_level=actual_thinking_level,
            thinking_budget=actual_thinking_budget,
            model=body.model
        )

    except Exception as e:
        logger.error("text_generate_error", error=str(e), model=body.model)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/count-tokens", response_model=TokenCountResponse)
@limiter.limit("30/minute")
async def count_tokens(
    request: Request,
    body: TokenCountRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Count tokens in text content.
    
    Use this to estimate costs and ensure content fits within model limits.
    """
    import os
    
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise HTTPException(status_code=501, detail="google-genai SDK required")
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")
    
    client = genai.Client(api_key=api_key)
    
    try:
        contents = [body.text]
        
        # Build config if system instruction needed
        config = None
        if body.include_system_instruction and body.system_instruction:
            config = types.GenerateContentConfig(
                system_instruction=body.system_instruction
            )
        
        response = client.models.count_tokens(
            model=body.model,
            contents=contents,
            config=config
        )
        
        total_tokens = getattr(response, 'total_tokens', 0)
        cached_tokens = getattr(response, 'cached_content_token_count', 0) or 0
        
        # Calculate estimated cost for 1000 prompts
        pricing = MODEL_PRICING.get(body.model, {"input": 0.50})
        cost_per_1k = (total_tokens / 1_000_000) * pricing["input"] * 1000
        
        return TokenCountResponse(
            total_tokens=total_tokens,
            text_tokens=total_tokens - cached_tokens,
            cached_tokens=cached_tokens,
            model=body.model,
            billable_characters=len(body.text),
            estimated_cost_1k_prompts=round(cost_per_1k, 4)
        )
        
    except Exception as e:
        logger.error("count_tokens_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/estimate-multimodal-tokens", response_model=MultimodalTokenEstimate)
@limiter.limit("20/minute")
async def estimate_multimodal_tokens(
    request: Request,
    body: MultimodalTokenRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Estimate tokens for multimodal content.
    
    Provides estimates based on content type:
    - Text: ~4 characters per token
    - Images: 258 base tokens + 258 per 768x768 tile
    - Audio: 32 tokens per second
    - Video: 258 tokens per frame
    """
    text_tokens = len(body.text) // 4 if body.text else 0
    
    # Estimate image tokens (258 per image as baseline)
    image_tokens = len(body.image_urls) * 258 if body.image_urls else 0
    
    # Estimate audio tokens (32 per second, assume 60 seconds average)
    audio_tokens = len(body.audio_urls) * 32 * 60 if body.audio_urls else 0
    
    # Estimate video tokens (258 per frame, assume 60 frames)
    video_tokens = len(body.video_urls) * 258 * 60 if body.video_urls else 0
    
    return MultimodalTokenEstimate(
        total_tokens=text_tokens + image_tokens + audio_tokens + video_tokens,
        text_tokens=text_tokens,
        image_tokens=image_tokens,
        audio_tokens=audio_tokens,
        video_tokens=video_tokens,
        cached_tokens=0
    )


@router.get("/model-info/{model_name}")
@limiter.limit("30/minute")
async def get_model_info(
    request: Request,
    model_name: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get information about a specific model.
    
    Returns context window size, capabilities, and pricing information.
    """
    import os
    
    try:
        from google import genai
    except ImportError:
        raise HTTPException(status_code=501, detail="google-genai SDK required")
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")
    
    client = genai.Client(api_key=api_key)
    
    try:
        model = client.models.get(model=model_name)
        
        pricing = MODEL_PRICING.get(model_name, {"input": 0.50, "output": 3.0})
        
        return {
            "success": True,
            "model": model_name,
            "display_name": getattr(model, 'display_name', model_name),
            "description": getattr(model, 'description', ''),
            "input_token_limit": getattr(model, 'input_token_limit', None),
            "output_token_limit": getattr(model, 'output_token_limit', None),
            "supported_generation_methods": getattr(model, 'supported_generation_methods', []),
            "pricing": pricing
        }
        
    except Exception as e:
        logger.error("get_model_info_error", error=str(e), model=model_name)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/structured")
@limiter.limit("10/minute")
async def structured_output(
    request: Request,
    body: StructuredRequest,
    current_user: dict = Depends(get_current_user),
    redis=Depends(get_redis_optional),
):
    """
    Generate structured JSON output conforming to a schema.
    
    **Features:**
    - Predefined schemas for common use cases
    - Custom JSON Schema support
    - Simple enum classification mode
    - Tool integration (Google Search, URL Context) for Gemini 3
    - Nullable field support
    - Schema validation
    
    **Modes:**
    1. Schema mode: Use schema_name or custom_schema for full JSON output
    2. Enum mode: Use enum_values for simple classification (single value output)
    
    **Documentation:** https://ai.google.dev/gemini-api/docs/structured-output
    """
    import os
    import time
    import json
    
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
    
    # Determine mode and build schema
    schema = None
    mode = "schema"
    
    # Simple enum mode - output is just one value from the list
    if body.enum_values:
        mode = "enum"
        if body.enum_type == "integer":
            enum_typed = [int(v) for v in body.enum_values if v.isdigit()]
            schema = {
                "type": "integer",
                "enum": enum_typed,
                "description": f"Select one of: {enum_typed}"
            }
        elif body.enum_type == "number":
            enum_typed = [float(v) for v in body.enum_values]
            schema = {
                "type": "number",
                "enum": enum_typed,
                "description": f"Select one of: {enum_typed}"
            }
        else:
            schema = {
                "type": "string",
                "enum": body.enum_values,
                "description": f"Classify into one of: {', '.join(body.enum_values)}"
            }
    # Schema store lookup — highest priority for named schemas
    elif body.schema_id:
        from app.api.gemini.llm_store import load_schema_from_store
        stored = load_schema_from_store(body.schema_id)
        if stored is None:
            raise HTTPException(
                status_code=404,
                detail=f"Schema '{body.schema_id}' not found in schema store. "
                       "Use GET /api/v1/gemini/schemas to list available schemas."
            )
        schema = stored.get("schema")
        if not schema:
            raise HTTPException(status_code=422, detail=f"Schema file '{body.schema_id}' has no 'schema' field.")
        schema = schema.copy()
        if "gemini-2" in body.model and "properties" in schema and "propertyOrdering" not in schema:
            schema["propertyOrdering"] = list(schema["properties"].keys())
    # Custom schema mode
    elif body.schema_name == "custom":
        if not body.custom_schema:
            raise HTTPException(
                status_code=400,
                detail="custom_schema required when schema_name is 'custom'. Provide a valid JSON Schema object."
            )
        schema = body.custom_schema
        
        # Add propertyOrdering for Gemini 2.0/2.5 if not present
        if body.property_ordering:
            schema["propertyOrdering"] = body.property_ordering
        elif "gemini-2" in body.model and "properties" in schema:
            # Auto-generate property ordering for Gemini 2.x
            schema["propertyOrdering"] = list(schema["properties"].keys())
    # Predefined schema mode
    else:
        schema = PREDEFINED_SCHEMAS.get(body.schema_name)
        if not schema:
            available = list(PREDEFINED_SCHEMAS.keys())
            raise HTTPException(
                status_code=400,
                detail=f"Unknown schema: '{body.schema_name}'. Available schemas: {available}"
            )
        schema = schema.copy()  # Don't modify the original
        
        # Add propertyOrdering for Gemini 2.0/2.5
        if "gemini-2" in body.model and "properties" in schema:
            if "propertyOrdering" not in schema:
                schema["propertyOrdering"] = list(schema["properties"].keys())
    
    # Build generation config
    config_kwargs = {
        "response_mime_type": "application/json",
        "response_schema": schema
    }
    
    # Add tools for Gemini 3 (if requested)
    if body.use_tools and "gemini-3" in body.model:
        tools = []
        for tool in body.use_tools:
            if tool == "google_search":
                tools.append({"google_search": {}})
            elif tool == "url_context":
                tools.append({"url_context": {}})
        if tools:
            config_kwargs["tools"] = tools
    
    config = types.GenerateContentConfig(**config_kwargs)
    
    try:
        response = client.models.generate_content(
            model=body.model,
            contents=body.prompt,
            config=config
        )
        
        # Parse response
        raw_text = response.text
        result = None
        parse_error = None
        
        try:
            result = json.loads(raw_text)
        except json.JSONDecodeError as e:
            parse_error = str(e)
            # Try to extract JSON from response if it contains additional text
            import re
            json_match = re.search(r'[\{\[].*[\}\]]', raw_text, re.DOTALL)
            if json_match:
                try:
                    result = json.loads(json_match.group())
                except json.JSONDecodeError:
                    result = {"_raw_text": raw_text, "_parse_error": parse_error}
            else:
                result = {"_raw_text": raw_text, "_parse_error": parse_error}
        
        # Schema validation (optional)
        validation_result = None
        if body.validate_response and result and not parse_error:
            validation_result = {"valid": True}
            # Basic validation: check required fields for objects
            if schema.get("type") == "object" and schema.get("required"):
                missing = [f for f in schema["required"] if f not in result]
                if missing:
                    validation_result = {
                        "valid": False,
                        "missing_required": missing
                    }
        
        usage = extract_usage(response, body.model, start_time)
        
        # Build response
        resolved_schema_name = (
            body.schema_id if body.schema_id else
            (body.schema_name if mode == "schema" else "enum")
        )
        response_data = {
            "success": True,
            "result": result,
            "mode": mode,
            "schema_name": resolved_schema_name,
            "model": body.model,
            "usage": usage.model_dump(),
            "cost": usage.estimated_cost
        }

        if body.return_schema:
            response_data["schema"] = schema

        if validation_result:
            response_data["validation"] = validation_result

        if body.use_tools and "gemini-3" in body.model:
            response_data["tools_used"] = body.use_tools

        # Fire-and-forget: log call to Redis
        import asyncio
        asyncio.create_task(log_llm_call(
            redis_client=redis,
            endpoint="structured",
            model=body.model,
            user_id=str(current_user.get("id", "")),
            prompt_preview=body.prompt,
            output_preview=json.dumps(result)[:500] if result else "",
            usage=usage,
            extra={"schema_id": body.schema_id, "schema_name": resolved_schema_name},
        ))

        return response_data

    except Exception as e:
        logger.error("structured_output_error", error=str(e), schema_name=body.schema_name, model=body.model)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/structured/schemas")
async def list_schemas():
    """
    List all available predefined schemas with their structure.
    
    Use this to understand what schemas are available and their expected output format.
    """
    schemas_info = {}
    for name, schema in PREDEFINED_SCHEMAS.items():
        schemas_info[name] = {
            "title": schema.get("title", name),
            "description": schema.get("description", ""),
            "required_fields": schema.get("required", []),
            "properties": list(schema.get("properties", {}).keys()),
            "full_schema": schema
        }
    
    return {
        "count": len(PREDEFINED_SCHEMAS),
        "schemas": schemas_info,
        "usage_example": {
            "predefined": {
                "prompt": "Extract information about the person from this text...",
                "schema_name": "person"
            },
            "custom": {
                "prompt": "Extract the color and size from this product description...",
                "schema_name": "custom",
                "custom_schema": {
                    "type": "object",
                    "properties": {
                        "color": {"type": "string"},
                        "size": {"type": "string", "enum": ["small", "medium", "large"]}
                    },
                    "required": ["color", "size"]
                }
            },
            "enum_classification": {
                "prompt": "Classify this customer feedback: I love this product!",
                "enum_values": ["positive", "neutral", "negative"]
            }
        },
        "documentation": "https://ai.google.dev/gemini-api/docs/structured-output"
    }


@router.get("/capabilities")
async def list_capabilities():
    """
    List all available Gemini API capabilities.
    
    Returns information about each capability, supported models,
    and documentation links.
    """
    return {
        "capabilities": [
            {
                "name": "Text Generation",
                "endpoint": "/gemini/generate",
                "models": ["gemini-3-flash-preview", "gemini-3-pro-preview", "gemini-2.5-flash", "gemini-2.5-pro"],
                "features": ["Thinking levels", "System instructions", "Temperature control"],
                "docs": "https://ai.google.dev/gemini-api/docs/text-generation"
            },
            {
                "name": "Image Generation",
                "endpoint": "/gemini/image-generate",
                "models": ["gemini-2.5-flash-image", "gemini-3-pro-image-preview"],
                "features": ["Text-to-image", "Image editing", "Multi-image composition"],
                "docs": "https://ai.google.dev/gemini-api/docs/image-generation"
            },
            {
                "name": "Image Understanding",
                "endpoint": "/gemini/image-understand",
                "models": ["gemini-3-flash-preview", "gemini-3-pro-preview"],
                "features": ["Object detection", "Segmentation", "Multi-image analysis"],
                "docs": "https://ai.google.dev/gemini-api/docs/image-understanding"
            },
            {
                "name": "Text-to-Speech",
                "endpoint": "/gemini/tts",
                "models": ["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"],
                "features": ["30+ voices", "Multi-speaker", "24 languages"],
                "docs": "https://ai.google.dev/gemini-api/docs/speech-generation"
            },
            {
                "name": "Audio Understanding",
                "endpoint": "/gemini/audio-transcribe",
                "models": ["gemini-3-flash-preview", "gemini-3-pro-preview"],
                "features": ["Transcription", "Speaker diarization", "Emotion detection"],
                "docs": "https://ai.google.dev/gemini-api/docs/audio"
            },
            {
                "name": "Embeddings",
                "endpoint": "/gemini/embeddings",
                "models": ["gemini-embedding-001", "text-embedding-004"],
                "features": ["3072 dimensions", "Task-specific", "Batch processing"],
                "docs": "https://ai.google.dev/gemini-api/docs/embeddings"
            },
            {
                "name": "Structured Output",
                "endpoint": "/gemini/structured",
                "schema_list_endpoint": "/gemini/structured/schemas",
                "models": ["gemini-3-flash-preview", "gemini-3-pro-preview", "gemini-2.5-flash", "gemini-2.5-pro"],
                "features": [
                    "10 predefined schemas (person, recipe, article, review, feedback, event, product, sentiment, language, intent)",
                    "Custom JSON Schema support",
                    "Enum classification mode",
                    "Tool integration (Google Search, URL Context) for Gemini 3",
                    "Nullable types (use [\"string\", \"null\"])",
                    "Array constraints (minItems, maxItems)",
                    "Number constraints (minimum, maximum)",
                    "Format validation (date-time, date, time)",
                    "Schema validation in response"
                ],
                "supported_schema_types": {
                    "primitives": ["string", "number", "integer", "boolean", "null"],
                    "complex": ["object", "array"],
                    "string_features": ["enum", "format"],
                    "number_features": ["enum", "minimum", "maximum"],
                    "array_features": ["items", "prefixItems", "minItems", "maxItems"],
                    "object_features": ["properties", "required", "additionalProperties"]
                },
                "docs": "https://ai.google.dev/gemini-api/docs/structured-output"
            },
            {
                "name": "Function Calling",
                "endpoint": "/gemini/function-calling",
                "models": ["gemini-3-flash-preview", "gemini-3-pro-preview"],
                "features": ["AUTO/ANY/NONE modes", "Parallel calls", "Custom functions"],
                "docs": "https://ai.google.dev/gemini-api/docs/function-calling"
            },
            {
                "name": "URL Context",
                "endpoint": "/gemini/url-context",
                "models": ["gemini-3-flash-preview", "gemini-3-pro-preview"],
                "features": ["Web grounding", "Real-time data", "Source citations"],
                "docs": "https://ai.google.dev/gemini-api/docs/url-context"
            },
            {
                "name": "Context Caching",
                "endpoint": "/gemini/cache-create",
                "models": ["gemini-2.5-flash-001", "gemini-2.5-pro"],
                "features": ["75% cost reduction", "TTL management", "Large context"],
                "docs": "https://ai.google.dev/gemini-api/docs/caching"
            },
            {
                "name": "File Search",
                "endpoint": "/gemini/file-search-store",
                "models": ["gemini-3-flash-preview", "gemini-3-pro-preview"],
                "features": ["Vector stores", "Semantic search", "RAG"],
                "docs": "https://ai.google.dev/gemini-api/docs/file-search"
            }
        ],
        "pricing_docs": "https://ai.google.dev/gemini-api/docs/pricing",
        "models_docs": "https://ai.google.dev/gemini-api/docs/models"
    }
