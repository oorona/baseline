from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from app.db.session import get_db
from app.models import Guild
from app.schemas import GuildCreate, Guild as GuildSchema

router = APIRouter()

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
