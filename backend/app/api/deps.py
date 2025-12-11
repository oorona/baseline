from typing import Generator, Optional
from fastapi import Depends, HTTPException, status, Cookie, Header
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis
import json

from app.db.session import get_db
from app.db.redis import get_redis
from app.models import User

async def get_current_user(
    cookie_session_id: Optional[str] = Cookie(None, alias="session_id"),
    authorization: Optional[str] = Header(None),
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db)
) -> dict:
    session_id = None

    # Prioritize Authorization header
    if authorization:
        if authorization.startswith("Bearer "):
            session_id = authorization.split(" ")[1]
        elif authorization.startswith("Bot "):
            # Bot Authentication
            from app.core.config import settings
            token = authorization.split(" ")[1]
            if token == settings.DISCORD_BOT_TOKEN:
                # Return a synthetic system user
                return {
                    "user_id": 0, # System ID
                    "username": "System Bot",
                    "discriminator": "0000",
                    "avatar_url": None,
                    "permission_level": "admin", # Bot is admin
                    "system": True
                }
    
    
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

async def verify_platform_admin(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """Verify that the user has Level 3 (Platform Admin) access."""
    from app.core.config import settings
    from app.core.discord import discord_client
    
    user_id = current_user["user_id"]
    dev_guild_id = settings.DISCORD_GUILD_ID
    dev_role_id = settings.DEVELOPER_ROLE_ID
    
    if not dev_guild_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Platform not configured (DISCORD_GUILD_ID missing)"
        )
        
    has_access = False
    
    try:
        # Check if user is the Owner of the Developer Guild
        dev_guild = await discord_client.get_guild(str(dev_guild_id))
        if str(user_id) == dev_guild.get("owner_id"):
            has_access = True
        
        # Check user's roles in the Developer Guild
        if not has_access and dev_role_id:
            member_data = await discord_client.get_guild_member(str(dev_guild_id), str(user_id))
            if dev_role_id in member_data.get("roles", []):
                has_access = True
    except Exception as e:
        print(f"Platform admin check failed: {e}")
        pass
        
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requires Platform Admin privileges"
        )
        
    return current_user
