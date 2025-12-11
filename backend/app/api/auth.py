import uuid
import json
from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie
from fastapi.responses import RedirectResponse, HTMLResponse
import httpx
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.db.redis import get_redis
from app.db.session import get_db
from app.db.session import get_db
from app.models import User

router = APIRouter()

DISCORD_API_BASE = "https://discord.com/api/v10"

@router.get("/discord/login")
async def login_discord(state: str = "redirect", prompt: str = "none"):
    if not settings.DISCORD_CLIENT_ID or not settings.DISCORD_REDIRECT_URI:
        raise HTTPException(status_code=500, detail="Discord OAuth not configured")
    
    from urllib.parse import urlencode, quote
    
    scope = "identify guilds"
    base_params = {
        "client_id": settings.DISCORD_CLIENT_ID,
        "redirect_uri": settings.DISCORD_REDIRECT_URI,
        "response_type": "code",
        "scope": scope,
        "state": state,
    }
    
    # Try with prompt=none first to skip consent if already authorized
    params = base_params.copy()
    if prompt:
        params["prompt"] = prompt
    
    # Use standard web URL, not API endpoint, to avoid app triggering issues
    login_url = f"https://discord.com/oauth2/authorize?{urlencode(params, quote_via=quote)}"
    print(f"DEBUG: Login URL: {login_url}")
    print(f"DEBUG: Redirect URI: {settings.DISCORD_REDIRECT_URI}")
    return RedirectResponse(login_url)

@router.get("/discord/callback")
async def callback_discord(
    code: str = None,
    error: str = None,
    state: str = "redirect",
    response: Response = None,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis)
):
    print(f"DEBUG: Callback received. Code: {code}, Error: {error}, State: {state}")
    
    def return_silent_error(error_msg: str):
        print(f"DEBUG: Silent Login Error: {error_msg}")
        html_content = f"""
        <html>
            <body>
                <script>
                    window.parent.postMessage({{
                        type: 'DISCORD_SILENT_LOGIN_FAILED',
                        error: '{error_msg}'
                    }}, '*');
                </script>
            </body>
        </html>
        """
        return HTMLResponse(content=html_content)
    
    if error == "interaction_required":
        print("DEBUG: Interaction required from Discord. Redirecting to consent flow.")
        if state == "silent":
             return HTMLResponse(content="""
            <html><body><script>
                window.parent.postMessage({type: 'DISCORD_SILENT_LOGIN_REQUIRED'}, '*');
            </script></body></html>
            """)

        # User needs to consent, redirect to auth without prompt=none
        from urllib.parse import urlencode, quote
        scope = "identify guilds"
        params = {
            "client_id": settings.DISCORD_CLIENT_ID,
            "redirect_uri": settings.DISCORD_REDIRECT_URI,
            "response_type": "code",
            "scope": scope,
            "state": state,
        }
        # Use standard web URL
        login_url = f"https://discord.com/oauth2/authorize?{urlencode(params, quote_via=quote)}"
        return RedirectResponse(login_url)
        
    if error:
        if state == "silent":
             return return_silent_error(error)
        # Redirect to frontend access denied page
        frontend_url = "http://localhost:3000"
        return RedirectResponse(f"{frontend_url}/access-denied?error={error}")
        
    if not code:
        if state == "silent":
             return return_silent_error("No code provided")
        raise HTTPException(status_code=400, detail="No code provided")

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
        
        try:
            token_res = await client.post(f"{DISCORD_API_BASE}/oauth2/token", data=data, headers=headers)
            
            if token_res.status_code != 200:
                print(f"DEBUG: Discord Token Exchange Failed: {token_res.status_code} {token_res.text}")
                if state == "silent":
                    return return_silent_error(f"Token exchange failed: {token_res.text}")
                    
                # Redirect to frontend with error
                from urllib.parse import quote
                error_details = quote(token_res.text)
                return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=discord_error&details={error_details}")
                
            token_data = token_res.json()
            access_token = token_data["access_token"]
            refresh_token = token_data.get("refresh_token")
            expires_in = token_data.get("expires_in", 604800) # Default to 7 days
            
            from datetime import datetime, timedelta
            token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            
        except Exception as e:
            print(f"DEBUG: Exception during token exchange: {e}")
            if state == "silent":
                return return_silent_error(f"Exception: {str(e)}")
            from urllib.parse import quote
            error_details = quote(str(e))
            return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=internal_error&details={error_details}")
        
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
            avatar_url=f"https://cdn.discordapp.com/avatars/{user_id}/{discord_user['avatar']}.png" if discord_user.get("avatar") else None,
            refresh_token=refresh_token,
            token_expires_at=token_expires_at
        )
        db.add(user)
    else:
        user.username = discord_user["username"]
        user.discriminator = discord_user.get("discriminator")
        user.avatar_url = f"https://cdn.discordapp.com/avatars/{user_id}/{discord_user['avatar']}.png" if discord_user.get("avatar") else None
        user.refresh_token = refresh_token
        user.token_expires_at = token_expires_at
    
    await db.commit()
    
    # Create session
    session_id = str(uuid.uuid4())
    session_data = {
        "user_id": str(user.id),
        "username": user.username,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_at": token_expires_at.timestamp()
    }
    
    # Store in Redis (expire in 30 days)
    # Using 30 days allows us to refresh the Discord token (which usually expires in 7 days) logic in the backend
    await redis.setex(f"session:{session_id}", 60 * 60 * 24 * 30, json.dumps(session_data))
    
    # Set cookie
    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        max_age=60 * 60 * 24 * 30,
        samesite="lax",
        secure=False # Set to True in production with HTTPS
    )
    
    if state == "popup" or state == "silent":
        message_type = 'DISCORD_LOGIN_SUCCESS' if state == "popup" else 'DISCORD_SILENT_LOGIN_SUCCESS'
        html_content = f"""
        <html>
            <body>
                <script>
                    window.parent.postMessage({{
                        type: '{message_type}',
                        token: '{session_id}'
                    }}, '*');
                    if (window.opener) {{
                        window.opener.postMessage({{
                            type: '{message_type}',
                            token: '{session_id}'
                        }}, '*');
                        window.close();
                    }}
                </script>
                <p>Login successful! Closing window...</p>
            </body>
        </html>
        """
        return HTMLResponse(content=html_content)
    
    # Redirect to frontend with token
    frontend_url = "http://localhost:3000"
    return RedirectResponse(f"{frontend_url}?token={session_id}")

from app.api.deps import get_current_user, check_is_admin

@router.get("/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    # Check admin status
    try:
        is_admin = await check_is_admin(current_user["user_id"])
        current_user["is_admin"] = is_admin
    except Exception:
        current_user["is_admin"] = False
        
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
