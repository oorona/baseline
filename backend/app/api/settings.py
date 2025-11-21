from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import Dict, Any
from pydantic import BaseModel

from ..db.session import get_db
from ..models import GuildSettings, Guild, AuthorizedUser
from .deps import get_current_user

router = APIRouter(tags=["settings"])

class SettingsUpdate(BaseModel):
    settings: Dict[str, Any]

class AddUserRequest(BaseModel):
    user_id: int

@router.get("/{guild_id}/settings")
async def get_guild_settings(
    guild_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get settings for a guild."""
    # Check if user has access to this guild
    auth_check = db.execute(
        select(AuthorizedUser).where(
            AuthorizedUser.guild_id == guild_id,
            AuthorizedUser.user_id == current_user["id"]
        )
    ).scalar_one_or_none()
    
    if not auth_check:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this guild"
        )
    
    # Get or create settings
    settings = db.execute(
        select(GuildSettings).where(GuildSettings.guild_id == guild_id)
    ).scalar_one_or_none()
    
    if not settings:
        # Create default settings
        settings = GuildSettings(guild_id=guild_id, settings_json={})
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return {
        "guild_id": guild_id,
        "settings": settings.settings_json,
        "updated_at": settings.updated_at
    }

@router.put("/{guild_id}/settings")
async def update_guild_settings(
    guild_id: int,
    settings_update: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update settings for a guild."""
    # Check if user has access to this guild
    auth_check = db.execute(
        select(AuthorizedUser).where(
            AuthorizedUser.guild_id == guild_id,
            AuthorizedUser.user_id == current_user["id"]
        )
    ).scalar_one_or_none()
    
    if not auth_check:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this guild"
        )
    
    # Get or create settings
    settings = db.execute(
        select(GuildSettings).where(GuildSettings.guild_id == guild_id)
    ).scalar_one_or_none()
    
    if not settings:
        settings = GuildSettings(
            guild_id=guild_id,
            settings_json=settings_update.settings,
            updated_by=current_user["id"]
        )
        db.add(settings)
    else:
        settings.settings_json = settings_update.settings
        settings.updated_by=current_user["id"]
    
    db.commit()
    db.refresh(settings)
    
    return {
        "guild_id": guild_id,
        "settings": settings.settings_json,
        "updated_at": settings.updated_at
    }

@router.get("/{guild_id}/authorized-users")
async def get_authorized_users(
    guild_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get list of authorized users for a guild."""
    # Check if user has access
    auth_check = db.execute(
        select(AuthorizedUser).where(
            AuthorizedUser.guild_id == guild_id,
            AuthorizedUser.user_id == current_user["id"]
        )
    ).scalar_one_or_none()
    
    if not auth_check:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this guild"
        )
    
    # Get all authorized users
    authorized_users = db.execute(
        select(AuthorizedUser).where(AuthorizedUser.guild_id == guild_id)
    ).scalars().all()
    
    return [
        {
            "user_id": au.user_id,
            "permission_level": au.permission_level.value,
            "created_at": au.created_at
        }
        for au in authorized_users
    ]

@router.post("/{guild_id}/authorized-users")
async def add_authorized_user(
    guild_id: int,
    request: AddUserRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Add an authorized user to a guild."""
    # Check if requester is authorized
    auth_check = db.execute(
        select(AuthorizedUser).where(
            AuthorizedUser.guild_id == guild_id,
            AuthorizedUser.user_id == current_user["id"]
        )
    ).scalar_one_or_none()
    
    if not auth_check:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to add users"
        )
    
    # Check if user is already authorized
    existing = db.execute(
        select(AuthorizedUser).where(
            AuthorizedUser.guild_id == guild_id,
            AuthorizedUser.user_id == request.user_id
        )
    ).scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already authorized for this guild"
        )
    
    # Add new authorized user
    new_auth = AuthorizedUser(
        guild_id=guild_id,
        user_id=request.user_id,
        created_by=current_user["id"]
    )
    db.add(new_auth)
    db.commit()
    
    return {"message": "User authorized successfully"}

@router.delete("/{guild_id}/authorized-users/{user_id}")
async def remove_authorized_user(
    guild_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Remove an authorized user from a guild."""
    # Check if requester is authorized
    auth_check = db.execute(
        select(AuthorizedUser).where(
            AuthorizedUser.guild_id == guild_id,
            AuthorizedUser.user_id == current_user["id"]
        )
    ).scalar_one_or_none()
    
    if not auth_check:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to remove users"
        )
    
    # Find the user to remove
    target_auth = db.execute(
        select(AuthorizedUser).where(
            AuthorizedUser.guild_id == guild_id,
            AuthorizedUser.user_id == user_id
        )
    ).scalar_one_or_none()
    
    if not target_auth:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not authorized for this guild"
        )
    
    # Prevent removing the guild owner
    guild = db.execute(
        select(Guild).where(Guild.id == guild_id)
    ).scalar_one()
    
    if user_id == guild.owner_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the guild owner"
        )
    
    db.delete(target_auth)
    db.commit()
    
    return {"message": "User removed successfully"}
