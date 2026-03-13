from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import datetime

class UserBase(BaseModel):
    id: int
    username: str
    discriminator: Optional[str] = None
    avatar_url: Optional[str] = None

class UserCreate(UserBase):
    pass

class User(UserBase):
    model_config = ConfigDict(from_attributes=True)

    created_at: datetime
    updated_at: Optional[datetime] = None
    preferences: Dict[str, Any] = {}

class GuildBase(BaseModel):
    id: str
    name: str
    icon_url: Optional[str] = None
    owner_id: str

    @field_validator('id', 'owner_id', mode='before')
    @classmethod
    def coerce_to_str(cls, v):
        return str(v)

class GuildCreate(GuildBase):
    pass

class Guild(GuildBase):
    model_config = ConfigDict(from_attributes=True)

    joined_at: datetime
    is_active: bool
    permission_level: Optional[str] = None

class AuthorizedUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    permission_level: str
    created_at: datetime

class AddUserRequest(BaseModel):
    user_id: int

class AuthorizedRole(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role_id: str
    guild_id: int
    permission_level: str
    created_at: datetime
    created_by: Optional[int] = None

class AddRoleRequest(BaseModel):
    role_id: str

class GuildSettings(BaseModel):
    allowed_channels: list[str] = []
    system_prompt: Optional[str] = None
    model: Optional[str] = "openai"
    admin_role_id: Optional[str] = None # Level 3 Access Control
    
    # Level 2 Access Control
    level_2_allow_everyone: bool = True
    level_2_roles: List[str] = []

class SettingsUpdate(BaseModel):
    settings: Dict[str, Any]

class AuditLogBase(BaseModel):
    guild_id: int
    user_id: int
    action: str
    details: Dict[str, Any] = {}

class AuditLogCreate(AuditLogBase):
    pass

class AuditLog(AuditLogBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime

class DiscordChannel(BaseModel):
    id: str
    name: str
    type: int

class DiscordRole(BaseModel):
    id: str
    name: str
    color: int
    position: int

class DiscordMember(BaseModel):
    id: str
    username: str
    discriminator: Optional[str] = None
    avatar: Optional[str] = None
    roles: List[str] = []
    
    # Computed/Optional fields
    avatar_url: Optional[str] = None

class LLMRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=8000)
    system_prompt: Optional[str] = Field(default="You are a helpful assistant.", max_length=2000)
    provider: Optional[str] = "openai"
    model: Optional[str] = None
    guild_id: Optional[int] = None

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    context_id: str = Field(..., min_length=1, max_length=128)
    name: Optional[str] = Field(default=None, max_length=64)
    provider: Optional[str] = "openai"
    model: Optional[str] = None
    guild_id: Optional[int] = None

class LLMResponseBase(BaseModel):
    content: str

# ── Structured Output ─────────────────────────────────────────────────────────

STRUCTURED_SCHEMAS = ["user_intent", "discord_moderation_action", "server_health_report"]

class StructuredOutputRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=4000)
    schema_name: str = Field(..., min_length=1, max_length=64)  # one of STRUCTURED_SCHEMAS
    provider: Optional[str] = "openai"
    model: Optional[str] = None
    guild_id: Optional[int] = None

class StructuredOutputResponse(BaseModel):
    schema_name: str
    prompt: str
    output: Dict[str, Any]
    raw_content: str

# ── Function Calling ──────────────────────────────────────────────────────────

FUNCTION_SCENARIOS = ["weather", "calculator", "discord_query"]

class FunctionCallRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
    scenario: str = Field(default="weather", min_length=1, max_length=64)  # one of FUNCTION_SCENARIOS
    provider: Optional[str] = "openai"
    model: Optional[str] = None
    guild_id: Optional[int] = None

class FunctionCallResponse(BaseModel):
    scenario: str
    prompt: str
    available_functions: List[str]
    function_called: str
    arguments: Dict[str, Any]
    function_result: Any
    final_answer: str
    raw_tool_turn: str

