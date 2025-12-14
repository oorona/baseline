from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from redis.asyncio import Redis
from typing import Optional, List, Dict, Any

from app.api.deps import get_db, get_redis, get_current_user, get_llm_service, verify_platform_admin
from app.services.llm import LLMService
from app.schemas import LLMRequest, ChatRequest, LLMResponseBase
from app.models import LLMUsage
from sqlalchemy import select, func

router = APIRouter()

@router.post("/generate", response_model=LLMResponseBase)
async def generate_text(
    request: LLMRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    redis: Redis = Depends(get_redis),
    llm_service: LLMService = Depends(get_llm_service)
):
    """
    Generate text from a prompt (single turn).
    """
    user_id = int(current_user["user_id"])
    
    response_text = await llm_service.generate_text(
        db=db,
        user_id=user_id,
        prompt=request.prompt,
        system_prompt=request.system_prompt,
        provider_name=request.provider,
        model=request.model,
        guild_id=request.guild_id
    )
    
    if response_text.startswith("Error:"):
        raise HTTPException(status_code=500, detail=response_text)
        
    return {"content": response_text}

@router.post("/chat", response_model=LLMResponseBase)
async def chat(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    redis: Redis = Depends(get_redis),
    llm_service: LLMService = Depends(get_llm_service)
):
    """
    Multi-turn chat within a context.
    """
    user_id = int(current_user["user_id"])
    
    # context_id should probably be scoped or validated? 
    # For now, we trust the client to provide a unique UUID for the context.
    
    response_text = await llm_service.chat(
        db=db,
        redis=redis,
        user_id=user_id,
        message=request.message,
        context_id=request.context_id,
        name=request.name,
        provider_name=request.provider,
        model=request.model,
        guild_id=request.guild_id
    )
    
    if response_text.startswith("Error:"):
        raise HTTPException(status_code=500, detail=response_text)
        
    return {"content": response_text}

@router.get("/stats")
async def get_stats(
    db: Session = Depends(get_db),
    admin: dict = Depends(verify_platform_admin)
):
    """
    Get aggregated LLM usage stats (Admin Only).
    """
    # Total Cost
    total_cost_result = await db.execute(select(func.sum(LLMUsage.cost)))
    total_cost = total_cost_result.scalar() or 0.0
    
    # Total Tokens
    total_tokens_result = await db.execute(select(func.sum(LLMUsage.tokens)))
    total_tokens = total_tokens_result.scalar() or 0
    
    # Usage by Provider
    provider_stmt = select(LLMUsage.provider, func.sum(LLMUsage.cost), func.count(LLMUsage.id))\
                    .group_by(LLMUsage.provider)
    provider_rows = await db.execute(provider_stmt)
    by_provider = [{"provider": row[0], "cost": row[1], "requests": row[2]} for row in provider_rows]
    
    # Recent Logs
    logs_stmt = select(LLMUsage).order_by(LLMUsage.timestamp.desc()).limit(50)
    logs_result = await db.execute(logs_stmt)
    logs = logs_result.scalars().all()
    
    return {
        "total_cost": total_cost,
        "total_tokens": total_tokens,
        "by_provider": by_provider,
        "recent_logs": logs
    }
