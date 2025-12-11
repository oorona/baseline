from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import Dict, Any, Optional
from pydantic import BaseModel
import structlog

from app.db.session import get_db
from app.db.redis import get_redis
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
    
    await db.refresh(settings)
    
    return {
        "settings": settings.settings_json,
        "updated_at": settings.updated_at
    }

@router.get("/db-status")
async def get_db_status(
    db: Session = Depends(get_db),
    redis: Any = Depends(get_redis), # Redis dependency
    admin: dict = Depends(verify_platform_admin)
):
    """
    Get status of Database and Redis.
    """
    # Check Postgres
    postgres_status = {"status": "unknown", "version": "unknown"}
    try:
        from sqlalchemy import text
        # 1. Version
        result = await db.execute(text("SELECT version();"))
        version = result.scalar()

        # 2. Database Size
        result = await db.execute(text("SELECT pg_size_pretty(pg_database_size(current_database()));"))
        db_size = result.scalar()

        # 3. Cache Hit Ratio
        # (sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)))
        result = await db.execute(text("""
            SELECT 
              sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read) + 1)::float 
            FROM pg_statio_user_tables;
        """))
        cache_ratio = result.scalar()
        cache_ratio_formatted = f"{cache_ratio * 100:.2f}%" if cache_ratio else "N/A"

        # 4. Active Connections
        result = await db.execute(text("SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"))
        active_connections = result.scalar()
        
        result = await db.execute(text("SELECT count(*) FROM pg_stat_activity WHERE state = 'idle';"))
        idle_connections = result.scalar()

        postgres_status = {
            "status": "connected", 
            "version": version,
            "size": db_size,
            "cache_hit_ratio": cache_ratio_formatted,
            "connections": {
                "active": active_connections,
                "idle": idle_connections
            }
        }
    except Exception as e:
        postgres_status = {"status": "error", "error": str(e)}
        logger.error("Postgres health check failed", error=str(e))

    # Check Redis
    redis_status = {"status": "unknown", "info": {}}
    try:
        info = await redis.info()
        redis_status = {
            "status": "connected",
            "info": {
                "redis_version": info.get("redis_version"),
                "used_memory_human": info.get("used_memory_human"),
                "connected_clients": info.get("connected_clients"),
                "uptime_in_days": info.get("uptime_in_days")
            }
        }
    except Exception as e:
        redis_status = {"status": "error", "error": str(e)}
        logger.error("Redis health check failed", error=str(e))
        
    return {
        "postgres": postgres_status,
        "redis": redis_status
    }

class HeartbeatData(BaseModel):
    id: str
    uptime: float
    timestamp: float

@router.post("/heartbeat")
async def receive_heartbeat(
    data: HeartbeatData,
    redis: Any = Depends(get_redis) # Public endpoint, maybe protected by internal key? For now open/admin.
    # Actually, instrumentation is server-side, it has no user context. 
    # We should probably allow this without user auth or use a shared secret.
    # For simplicity in this "baseline" framework, we'll allow it but maybe limit to internal network if possible?
    # Let's just make it open but require a specific header or just rely on network isolation for now (Docker).
):
    """
    Receive heartbeat from a frontend instance.
    """
    # Store with 30s TTL
    key = f"frontend:heartbeat:{data.id}"
    await redis.set(key, data.json(), ex=30)
    return {"status": "ok"}

@router.get("/frontend-status")
async def get_frontend_status(
    redis: Any = Depends(get_redis),
    admin: dict = Depends(verify_platform_admin)
):
    """
    Get list of active frontend instances.
    """
    import json
    instances = []
    # Scan for keys
    cursor = b'0'
    while cursor:
        cursor, keys = await redis.scan(cursor, match="frontend:heartbeat:*", count=100)
        if keys:
            values = await redis.mget(keys)
            for val in values:
                if val:
                    try:
                        instances.append(json.loads(val))
                    except:
                        pass
        if cursor == b'0':
            break
            
    # Sort by uptime or ID
    instances.sort(key=lambda x: x.get('id'))
    return instances

@router.get("/backend-status")
async def get_backend_status(
    redis: Any = Depends(get_redis),
    admin: dict = Depends(verify_platform_admin)
):
    """
    Get list of active backend instances.
    """
    import json
    instances = []
    # Scan for keys
    cursor = b'0'
    while cursor:
        cursor, keys = await redis.scan(cursor, match="backend:heartbeat:*", count=100)
        if keys:
            values = await redis.mget(keys)
            for val in values:
                if val:
                    try:
                        instances.append(json.loads(val))
                    except:
                        pass
        if cursor == b'0':
            break
            
    # Sort by uptime or ID
    instances.sort(key=lambda x: x.get('id'))
    return instances
