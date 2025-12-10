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
    
    # Check if token needs refresh
    expires_at = user_data.get("expires_at")
    refresh_token = user_data.get("refresh_token")
    
    import datetime
    from app.core.config import settings
    import httpx
    from sqlalchemy import update
    
    # Refresh if no expiry (legacy session) or expiring within 5 minutes
    should_refresh = False
    if expires_at:
        # expires_at is float timestamp
        exp_dt = datetime.datetime.fromtimestamp(expires_at)
        if datetime.datetime.utcnow() > exp_dt - datetime.timedelta(minutes=5):
            should_refresh = True
    elif refresh_token: 
        # No expiry but has refresh token (migration case?), try clear or refresh? 
        # Safer to refresh if we can, or just let it be until 401 elsewhere.
        pass

    if should_refresh and refresh_token:
        async with httpx.AsyncClient() as client:
            data = {
                "client_id": settings.DISCORD_CLIENT_ID,
                "client_secret": settings.DISCORD_CLIENT_SECRET,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            }
            headers = {"Content-Type": "application/x-www-form-urlencoded"}
            
            try:
                token_res = await client.post("https://discord.com/api/v10/oauth2/token", data=data, headers=headers)
                
                if token_res.status_code == 200:
                    token_data = token_res.json()
                    new_access_token = token_data["access_token"]
                    new_refresh_token = token_data.get("refresh_token")
                    expires_in = token_data.get("expires_in", 604800)
                    new_expires_at = datetime.datetime.utcnow() + datetime.timedelta(seconds=expires_in)
                    
                    # Update session data
                    user_data["access_token"] = new_access_token
                    user_data["refresh_token"] = new_refresh_token
                    user_data["expires_at"] = new_expires_at.timestamp()
                    
                    # Update Redis
                    await redis.setex(f"session:{session_id}", 60 * 60 * 24 * 30, json.dumps(user_data))
                    
                    # Update DB (fire and forget mostly, but good to keep in sync)
                    # We need to construct a new session for DB operation if the dependency one is closed or busy, 
                    # but 'db' here is AsyncSession from dependency, so we can use it.
                    stmt = update(User).where(User.id == int(user_data["user_id"])).values(
                        refresh_token=new_refresh_token,
                        token_expires_at=new_expires_at
                    )
                    await db.execute(stmt)
                    await db.commit()
                    
                else:
                    # Refresh failed (revoked?), clear session
                    await redis.delete(f"session:{session_id}")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Session expired and refresh failed",
                    )
            except Exception as e:
                print(f"Error checking refresh token: {e}")
                # Don't block requests on transient errors, but token might be dead
                pass

    return user_data
