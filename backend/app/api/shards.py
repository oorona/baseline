from fastapi import APIRouter, Depends, HTTPException, status
from redis.asyncio import Redis
import json
from typing import List, Dict, Any

from ..db.redis import get_redis
from .deps import get_current_user

router = APIRouter(prefix="/shards", tags=["shards"])

@router.get("")
async def get_all_shards(
    redis: Redis = Depends(get_redis),
    current_user: dict = Depends(get_current_user)
):
    """Get status of all shards. Restricted to admins."""
    # Simple admin check via env var for now
    # In production, this should probably be a database flag or role
    from app.core.config import settings
    
    # Assuming settings.ADMIN_USER_IDS is a comma-separated string of IDs
    admin_ids = [int(id.strip()) for id in (settings.ADMIN_USER_IDS or "").split(",") if id.strip()]
    
    if int(current_user["user_id"]) not in admin_ids:
        # For now, let's allow it for testing if no admins are configured
        if admin_ids:
             raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view system status"
            )
    
    # Scan for all shard keys
    keys = []
    async for key in redis.scan_iter("shard:status:*"):
        keys.append(key)
        
    if not keys:
        return []
        
    # Get all values
    values = await redis.mget(keys)
    
    shards = []
    for value in values:
        if value:
            try:
                shards.append(json.loads(value))
            except json.JSONDecodeError:
                continue
                
    # Sort by shard_id
    shards.sort(key=lambda x: x.get("shard_id", 0))
    
    return shards

@router.get("/{shard_id}")
async def get_shard(
    shard_id: int,
    redis: Redis = Depends(get_redis),
    current_user: dict = Depends(get_current_user)
):
    """Get status of a specific shard."""
    key = f"shard:status:{shard_id}"
    value = await redis.get(key)
    
    if not value:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shard {shard_id} not found"
        )
    
    return json.loads(value)
