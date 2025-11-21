from typing import Generator, Optional
from fastapi import Depends, HTTPException, status, Cookie, Header
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis
import json

from app.db.session import get_db
from app.db.redis import get_redis
from app.models import User

async def get_current_user(
    session_id: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db)
) -> dict:
    # Try to get session_id from Authorization header if not in cookie
    if not session_id and authorization:
        if authorization.startswith("Bearer "):
            session_id = authorization.split(" ")[1]
            
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    # Check Redis for session
    session_data = await redis.get(f"session:{session_id}")
    if not session_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid",
        )

    user_data = json.loads(session_data)
    return user_data
