from fastapi import APIRouter, Depends, HTTPException, Body
from redis.asyncio import Redis
import json
import structlog
from typing import Dict, Any, List
from pydantic import BaseModel

from app.db.redis import get_redis
from app.api.deps import verify_platform_admin

router = APIRouter()
logger = structlog.get_logger()

class BotReport(BaseModel):
    commands: List[Dict[str, Any]]
    listeners: List[Dict[str, Any]]
    permissions: Dict[str, Any]
    timestamp: float

@router.post("/report")
async def report_bot_info(
    report: BotReport,
    redis: Redis = Depends(get_redis)
):
    """
    Endpoint for the bot to push its introspection data.
    Secured ideally by internal network or shared secret, 
    but for now we assume internal docker network trust or valid API token if we enforce it.
    """
    try:
        # Store in Redis with no expiration (or long expiration)
        await redis.set("bot:introspection", report.json())
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
            "timestamp": 0
        }
    
    return json.loads(data)
