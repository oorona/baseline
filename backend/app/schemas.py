from typing import Optional, Dict, Any, List
from pydantic import BaseModel, field_validator
from datetime import datetime

class UserBase(BaseModel):
    id: int
    username: str
    discriminator: Optional[str] = None
    avatar_url: Optional[str] = None

class UserCreate(UserBase):
    pass

class User(UserBase):
    created_at: datetime
    updated_at: Optional[datetime] = None
    preferences: Dict[str, Any] = {}

    class Config:
        from_attributes = True

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
    joined_at: datetime
    is_active: bool
    permission_level: Optional[str] = None

    class Config:
        from_attributes = True

class AuthorizedUser(BaseModel):
    user_id: int
    permission_level: str
    created_at: datetime

    class Config:
        from_attributes = True

class AddUserRequest(BaseModel):
    user_id: int

class AuthorizedRole(BaseModel):
    id: int
    role_id: str
    guild_id: int
    permission_level: str
    created_at: datetime
    created_by: Optional[int] = None

    class Config:
        from_attributes = True

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
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

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
    prompt: str
    system_prompt: Optional[str] = "You are a helpful assistant."
    provider: Optional[str] = "openai"
    model: Optional[str] = None
    guild_id: Optional[int] = None

class ChatRequest(BaseModel):
    message: str
    context_id: str
    name: Optional[str] = None
    provider: Optional[str] = "openai"
    model: Optional[str] = None
    guild_id: Optional[int] = None

class LLMResponseBase(BaseModel):
    content: str

