"""
event_logging — Backend API Router
Exposes settings read/write endpoints for the Event Logging plugin.
Settings are stored in the guild's generic settings store (no custom table needed).
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_permission
from app.db.guild_session import get_guild_db
from app.models import AuditLog, GuildSettings, User
from app.core.permissions import PermissionLevel

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

VALID_EVENTS = {"on_message_delete", "on_message_edit", "on_member_join", "on_member_remove"}


class EventLoggingSettings(BaseModel):
    logging_enabled: bool = False
    logging_channel_id: str | None = None
    logging_ignored_events: list[str] = []


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/{guild_id}/event-logging/settings")
async def get_settings(
    guild_id: int,
    db: AsyncSession = Depends(get_guild_db),
    current_user: User = Depends(require_permission(PermissionLevel.AUTHORIZED)),
):
    """Return the current event logging configuration for a guild."""
    result = await db.execute(
        select(GuildSettings).where(GuildSettings.guild_id == guild_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        return EventLoggingSettings().model_dump()

    raw = row.settings or {}
    return EventLoggingSettings(
        logging_enabled=raw.get("logging_enabled", False),
        logging_channel_id=raw.get("logging_channel_id"),
        logging_ignored_events=raw.get("logging_ignored_events", []),
    ).model_dump()


@router.post("/{guild_id}/event-logging/settings")
async def update_settings(
    guild_id: int,
    payload: EventLoggingSettings,
    db: AsyncSession = Depends(get_guild_db),
    current_user: User = Depends(require_permission(PermissionLevel.AUTHORIZED)),
):
    """Update event logging settings for a guild. Writes an AuditLog entry."""
    # Validate ignored events list
    unknown = set(payload.logging_ignored_events) - VALID_EVENTS
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown event keys: {unknown}")

    # Fetch existing settings row
    result = await db.execute(
        select(GuildSettings).where(GuildSettings.guild_id == guild_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Guild settings not found")

    # Merge updated keys into the existing settings JSON
    merged = {**(row.settings or {}), **payload.model_dump()}
    await db.execute(
        update(GuildSettings)
        .where(GuildSettings.guild_id == guild_id)
        .values(settings=merged)
    )

    # AuditLog is mandatory for every mutation endpoint (CLAUDE.md rule 5)
    db.add(
        AuditLog(
            guild_id=guild_id,
            user_id=current_user.id,
            action="event_logging.settings.update",
            details=payload.model_dump(),
        )
    )

    await db.commit()
    return {"success": True}
