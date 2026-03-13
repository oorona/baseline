from fastapi import APIRouter, Depends, HTTPException, Body
from redis.asyncio import Redis
import json
import structlog
from typing import Dict, Any, List
from pydantic import BaseModel

from app.core.config import settings
from app.db.redis import get_redis
from app.api.deps import verify_platform_admin

router = APIRouter()
logger = structlog.get_logger()

@router.get("/public")
async def get_public_bot_info():
    """
    Public endpoint — no authentication required.
    Returns bot identity information for the public landing page.
    """
    return {
        "name":        settings.BOT_NAME,
        "tagline":     settings.BOT_TAGLINE,
        "description": settings.BOT_DESCRIPTION,
        "logo_url":    settings.BOT_LOGO_URL,
        "invite_url":  settings.BOT_INVITE_URL,
        "configured":  bool(settings.BOT_INVITE_URL),
    }


SETTINGS_SCHEMA_KEY = "bot:settings_schema"


class BotReport(BaseModel):
    commands: List[Dict[str, Any]]
    listeners: List[Dict[str, Any]]
    permissions: Dict[str, Any]
    settings_schemas: List[Dict[str, Any]] = []
    timestamp: float

@router.post("/report")
async def report_bot_info(
    report: BotReport,
    redis: Redis = Depends(get_redis)
):
    """
    Endpoint for the bot to push its introspection data.
    Secured by internal Docker network trust.
    """
    try:
        await redis.set("bot:introspection", report.model_dump_json())
        if report.settings_schemas:
            await redis.set(SETTINGS_SCHEMA_KEY, json.dumps(report.settings_schemas))
        logger.info("Received and stored bot introspection report")
        return {"status": "ok"}
    except Exception as e:
        logger.error("Failed to store bot report", error=str(e))
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("/report")
async def get_bot_info(
    redis: Redis = Depends(get_redis),
    admin: dict = Depends(verify_platform_admin)
):
    """
    Get the latest bot introspection report.
    Only accessible by platform admins.
    """
    data = await redis.get("bot:introspection")
    if not data:
        return {
            "commands": [],
            "listeners": [],
            "permissions": {},
            "settings_schemas": [],
            "timestamp": 0
        }

    return json.loads(data)


@router.get("/settings-schema")
async def get_settings_schema(
    redis: Redis = Depends(get_redis),
):
    """
    Return the aggregated settings schemas published by all loaded cogs.

    Security: L2 — any authenticated guild member may read schemas so the
    dashboard can render the settings form.  Actual value reads/writes still
    require guild-owner-level access via the guilds endpoints.
    """
    data = await redis.get(SETTINGS_SCHEMA_KEY)
    if not data:
        return {"schemas": []}
    return {"schemas": json.loads(data)}
