import uuid
import json
from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie
from fastapi.responses import RedirectResponse
import httpx
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.db.redis import get_redis
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models import User

router = APIRouter()

DISCORD_API_BASE = "https://discord.com/api/v10"

@router.get("/discord/login")
async def login_discord():
    if not settings.DISCORD_CLIENT_ID or not settings.DISCORD_REDIRECT_URI:
        raise HTTPException(status_code=500, detail="Discord OAuth not configured")
    
    scope = "identify guilds"
    login_url = (
        f"{DISCORD_API_BASE}/oauth2/authorize"
        f"?client_id={settings.DISCORD_CLIENT_ID}"
        f"&redirect_uri={settings.DISCORD_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope={scope}"
    )
    return RedirectResponse(login_url)

@router.get("/discord/callback")
async def callback_discord(
    code: str,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis)
):
    if not settings.DISCORD_CLIENT_ID or not settings.DISCORD_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Discord OAuth not configured")

    # Exchange code for token
    async with httpx.AsyncClient() as client:
        data = {
            "client_id": settings.DISCORD_CLIENT_ID,
            "client_secret": settings.DISCORD_CLIENT_SECRET,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings.DISCORD_REDIRECT_URI,
        }
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        
        token_res = await client.post(f"{DISCORD_API_BASE}/oauth2/token", data=data, headers=headers)
        if token_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to authenticate with Discord")
        
        token_data = token_res.json()
        access_token = token_data["access_token"]
        
        # Get user info
        user_res = await client.get(
            f"{DISCORD_API_BASE}/users/@me",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if user_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch user info")
            
        discord_user = user_res.json()
        
    # Create or update user in DB
    user_id = int(discord_user["id"])
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        user = User(
            id=user_id,
            username=discord_user["username"],
            discriminator=discord_user.get("discriminator"),
            avatar_url=f"https://cdn.discordapp.com/avatars/{user_id}/{discord_user['avatar']}.png" if discord_user.get("avatar") else None
        )
        db.add(user)
    else:
        user.username = discord_user["username"]
        user.discriminator = discord_user.get("discriminator")
        user.avatar_url = f"https://cdn.discordapp.com/avatars/{user_id}/{discord_user['avatar']}.png" if discord_user.get("avatar") else None
    
    await db.commit()
    
    # Create session
    session_id = str(uuid.uuid4())
    session_data = {
        "user_id": str(user.id),
        "username": user.username,
        "access_token": access_token
    }
    
    # Store in Redis (expire in 7 days)
    await redis.setex(f"session:{session_id}", 60 * 60 * 24 * 7, json.dumps(session_data))
    
    # Set cookie
    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        max_age=60 * 60 * 24 * 7,
        samesite="lax",
        secure=False # Set to True in production with HTTPS
    )
    
    return {"message": "Login successful", "user": session_data}

@router.get("/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return current_user

@router.post("/logout")
async def logout(
    response: Response,
    session_id: str = Cookie(None),
    redis: Redis = Depends(get_redis)
):
    if session_id:
        await redis.delete(f"session:{session_id}")
    
    response.delete_cookie("session_id")
    return {"message": "Logged out"}
