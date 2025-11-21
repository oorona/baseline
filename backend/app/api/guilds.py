from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from pydantic import BaseModel

from app.db.session import get_db
from app.models import Guild, GuildSettings, AuthorizedUser, User
from app.schemas import GuildCreate, Guild as GuildSchema
from app.api.deps import get_current_user

router = APIRouter()



class SettingsUpdate(BaseModel):
    settings: Dict[str, Any]

class AddUserRequest(BaseModel):
    user_id: int

# --- Settings Endpoints (Must be defined BEFORE generic /{guild_id}) ---

@router.get("/{guild_id}/settings")
async def get_guild_settings(
    guild_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get settings for a guild."""
    user_id = int(current_user["user_id"])
    
    # Check if guild exists
    guild = await db.get(Guild, guild_id)
    if not guild:
        raise HTTPException(status_code=404, detail="Guild not found")

    # Check if user has access (Owner or Authorized)
    is_owner = guild.owner_id == user_id
    
    if not is_owner:
        auth_check = await db.execute(
            select(AuthorizedUser).where(
                AuthorizedUser.guild_id == guild_id,
                AuthorizedUser.user_id == user_id
            )
        )
        if not auth_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this guild"
            )
    
    # Get or create settings
    settings_result = await db.execute(
        select(GuildSettings).where(GuildSettings.guild_id == guild_id)
    )
    settings = settings_result.scalar_one_or_none()
    
    if not settings:
        # Create default settings
        settings = GuildSettings(guild_id=guild_id, settings_json={})
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    
    return {
        "guild_id": guild_id,
        "settings": settings.settings_json,
        "updated_at": settings.updated_at
    }

@router.put("/{guild_id}/settings")
async def update_guild_settings(
    guild_id: int,
    settings_update: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update settings for a guild."""
    user_id = int(current_user["user_id"])
    
    # Check if guild exists
    guild = await db.get(Guild, guild_id)
    if not guild:
        raise HTTPException(status_code=404, detail="Guild not found")

    # Check if user has access (Owner or Authorized)
    is_owner = guild.owner_id == user_id
    
    if not is_owner:
        auth_check = await db.execute(
            select(AuthorizedUser).where(
                AuthorizedUser.guild_id == guild_id,
                AuthorizedUser.user_id == user_id
            )
        )
        if not auth_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this guild"
            )
    
    # Get or create settings
    settings_result = await db.execute(
        select(GuildSettings).where(GuildSettings.guild_id == guild_id)
    )
    settings = settings_result.scalar_one_or_none()
    
    if not settings:
        settings = GuildSettings(
            guild_id=guild_id,
            settings_json=settings_update.settings,
            updated_by=user_id
        )
        db.add(settings)
    else:
        settings.settings_json = settings_update.settings
        settings.updated_by = user_id
    
    await db.commit()
    await db.refresh(settings)
    
    return {
        "guild_id": guild_id,
        "settings": settings.settings_json,
        "updated_at": settings.updated_at
    }

@router.get("/{guild_id}/authorized-users")
async def get_authorized_users(
    guild_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get list of authorized users for a guild."""
    user_id = int(current_user["user_id"])
    
    # Check if guild exists
    guild = await db.get(Guild, guild_id)
    if not guild:
        raise HTTPException(status_code=404, detail="Guild not found")

    # Check if user has access (Owner or Authorized)
    is_owner = guild.owner_id == user_id
    
    if not is_owner:
        auth_check = await db.execute(
            select(AuthorizedUser).where(
                AuthorizedUser.guild_id == guild_id,
                AuthorizedUser.user_id == user_id
            )
        )
        if not auth_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this guild"
            )
    
    # Get all authorized users
    authorized_users_result = await db.execute(
        select(AuthorizedUser).where(AuthorizedUser.guild_id == guild_id)
    )
    authorized_users = authorized_users_result.scalars().all()
    
    return [
        {
            "user_id": au.user_id,
            "permission_level": au.permission_level.value,
            "created_at": au.created_at
        }
        for au in authorized_users
    ]

@router.post("/{guild_id}/authorized-users")
async def add_authorized_user(
    guild_id: int,
    request: AddUserRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Add an authorized user to a guild."""
    user_id = int(current_user["user_id"])
    
    # Check if guild exists
    guild = await db.get(Guild, guild_id)
    if not guild:
        raise HTTPException(status_code=404, detail="Guild not found")

    # Check if user has permission (Owner or Authorized)
    # Note: Currently only owners should probably add users, but let's allow authorized users too for now
    is_owner = guild.owner_id == user_id
    
    if not is_owner:
        auth_check = await db.execute(
            select(AuthorizedUser).where(
                AuthorizedUser.guild_id == guild_id,
                AuthorizedUser.user_id == user_id
            )
        )
        if not auth_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to add users"
            )
    
    # Check if user is already authorized
    existing_result = await db.execute(
        select(AuthorizedUser).where(
            AuthorizedUser.guild_id == guild_id,
            AuthorizedUser.user_id == request.user_id
        )
    )
    existing = existing_result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already authorized for this guild"
        )
    
    # Check if user exists in DB, if not create stub
    user_stmt = select(User).where(User.id == request.user_id)
    user_result = await db.execute(user_stmt)
    target_user = user_result.scalar_one_or_none()
    
    if not target_user:
        target_user = User(
            id=request.user_id,
            username="Pending Login",
            discriminator="0000",
            avatar_url=None
        )
        db.add(target_user)
        # Flush to ensure ID exists for foreign key
        await db.flush()

    # Add new authorized user
    new_auth = AuthorizedUser(
        guild_id=guild_id,
        user_id=request.user_id,
        created_by=user_id
    )
    db.add(new_auth)
    await db.commit()
    
    return {"message": "User authorized successfully"}

@router.delete("/{guild_id}/authorized-users/{user_id}")
async def remove_authorized_user(
    guild_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Remove an authorized user from a guild."""
    current_user_id = int(current_user["user_id"])
    
    # Check if guild exists
    guild = await db.get(Guild, guild_id)
    if not guild:
        raise HTTPException(status_code=404, detail="Guild not found")

    # Check if requester has permission (Owner or Authorized)
    is_owner = guild.owner_id == current_user_id
    
    if not is_owner:
        auth_check = await db.execute(
            select(AuthorizedUser).where(
                AuthorizedUser.guild_id == guild_id,
                AuthorizedUser.user_id == current_user_id
            )
        )
        if not auth_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to remove users"
            )
    
    # Find the user to remove
    target_auth_result = await db.execute(
        select(AuthorizedUser).where(
            AuthorizedUser.guild_id == guild_id,
            AuthorizedUser.user_id == user_id
        )
    )
    target_auth = target_auth_result.scalar_one_or_none()
    
    if not target_auth:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not authorized for this guild"
        )
    
    # Prevent removing the guild owner (though owner isn't in authorized_users usually)
    if user_id == guild.owner_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the guild owner"
        )
    
    await db.delete(target_auth)
    await db.commit()
    
    return {"message": "User removed successfully"}

# --- Generic Guild Endpoints (Must be defined AFTER specific /{guild_id}/*) ---

@router.get("/", response_model=List[GuildSchema])
async def list_guilds(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List guilds the user has access to."""
    user_id = int(current_user["user_id"])
    
    # Get guilds where user is owner
    stmt_owner = select(Guild).where(Guild.owner_id == user_id)
    result_owner = await db.execute(stmt_owner)
    owned_guilds = result_owner.scalars().all()
    
    # Get guilds where user is authorized
    stmt_auth = select(Guild).join(AuthorizedUser).where(AuthorizedUser.user_id == user_id)
    result_auth = await db.execute(stmt_auth)
    authorized_guilds = result_auth.scalars().all()
    
    # Combine and deduplicate
    all_guilds = {g.id: g for g in owned_guilds + authorized_guilds}
    return list(all_guilds.values())

@router.post("/", response_model=GuildSchema)
async def create_or_update_guild(
    guild_in: GuildCreate,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Guild).where(Guild.id == guild_in.id)
    result = await db.execute(stmt)
    guild = result.scalar_one_or_none()

    if not guild:
        guild = Guild(**guild_in.model_dump())
        db.add(guild)
    else:
        guild.name = guild_in.name
        guild.icon_url = guild_in.icon_url
        guild.owner_id = guild_in.owner_id
        guild.is_active = True
    
    await db.commit()
    await db.refresh(guild)
    return guild

@router.get("/{guild_id}", response_model=GuildSchema)
async def read_guild(
    guild_id: int,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Guild).where(Guild.id == guild_id)
    result = await db.execute(stmt)
    guild = result.scalar_one_or_none()
    
    if not guild:
        raise HTTPException(status_code=404, detail="Guild not found")
    return guild
