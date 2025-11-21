from typing import Optional
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

    class Config:
        from_attributes = True
