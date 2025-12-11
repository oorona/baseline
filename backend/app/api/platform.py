from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import Dict, Any, Optional
from pydantic import BaseModel
import structlog

from app.db.session import get_db
from app.models import GuildSettings
from app.core.config import settings as app_settings
from app.api.deps import verify_platform_admin

router = APIRouter()
logger = structlog.get_logger()

class PlatformSettingsUpdate(BaseModel):
    settings: Dict[str, Any]

@router.get("/settings")
async def get_platform_settings(
    db: Session = Depends(get_db),
    admin: dict = Depends(verify_platform_admin)
):
    """Get global platform settings (stored in Developer Guild settings)."""
    dev_guild_id = app_settings.DISCORD_GUILD_ID
    if not dev_guild_id:
        raise HTTPException(503, "Developer Guild ID not configured")
        
    # Get or create settings for the developer guild
    settings = await db.execute(
        select(GuildSettings).where(GuildSettings.guild_id == int(dev_guild_id))
    )
    settings = settings.scalar_one_or_none()
    
    if not settings:
        settings = GuildSettings(guild_id=int(dev_guild_id), settings_json={})
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    
    return {
        "settings": settings.settings_json,
        "updated_at": settings.updated_at
    }

@router.put("/settings")
async def update_platform_settings(
    update_data: PlatformSettingsUpdate,
    db: Session = Depends(get_db),
    admin: dict = Depends(verify_platform_admin)
):
    """Update global platform settings."""
    dev_guild_id = app_settings.DISCORD_GUILD_ID
    if not dev_guild_id:
        raise HTTPException(503, "Developer Guild ID not configured")
        
    settings = await db.execute(
        select(GuildSettings).where(GuildSettings.guild_id == int(dev_guild_id))
    )
    settings = settings.scalar_one_or_none()
    
    if not settings:
        settings = GuildSettings(
            guild_id=int(dev_guild_id),
            settings_json=update_data.settings,
            updated_by=int(admin["user_id"])
        )
        db.add(settings)
    else:
        # Merge or replace? Usually merge top-level keys
        # For simplicty, let's update the keys provided
        current = settings.settings_json or {}
        current.update(update_data.settings)
        settings.settings_json = current
        settings.updated_by = int(admin["user_id"])
    
    await db.commit()
    await db.refresh(settings)
    
    return {
        "settings": settings.settings_json,
        "updated_at": settings.updated_at
    }
