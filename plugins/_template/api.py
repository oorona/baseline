"""
my_plugin — Backend API Router
Staging template: replace all references to 'my_plugin' / 'MyPlugin'.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_permission
from app.db.guild_session import get_guild_db       # Required for guild-scoped endpoints
from app.models import AuditLog, User
from app.core.permissions import PermissionLevel
from pydantic import BaseModel

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class MyPluginSettings(BaseModel):
    enabled: bool = True
    channel_id: str | None = None


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/{guild_id}/my-plugin/settings")
async def get_settings(
    guild_id: int,
    db: AsyncSession = Depends(get_guild_db),           # RLS enforced automatically
    current_user: User = Depends(require_permission(PermissionLevel.AUTHORIZED)),
):
    """Retrieve plugin settings for a guild."""
    # ... query db for settings ...
    return {"enabled": True, "channel_id": None}


@router.post("/{guild_id}/my-plugin/settings")
async def update_settings(
    guild_id: int,
    payload: MyPluginSettings,
    db: AsyncSession = Depends(get_guild_db),
    current_user: User = Depends(require_permission(PermissionLevel.AUTHORIZED)),
):
    """Update plugin settings — writes an AuditLog entry (required by framework)."""
    # ... persist settings to db ...

    # AuditLog is mandatory for every mutation endpoint.
    audit = AuditLog(
        guild_id=guild_id,
        user_id=current_user.id,
        action="my_plugin.settings.update",
        details=payload.model_dump(),
    )
    db.add(audit)
    await db.commit()

    return {"success": True}
