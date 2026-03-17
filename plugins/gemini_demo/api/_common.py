"""
Gemini API Common Module
========================

Shared utilities, schemas, and configuration used across all Gemini API modules.

Pricing: https://ai.google.dev/gemini-api/docs/pricing
Models: https://ai.google.dev/gemini-api/docs/models
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import time
import uuid
import json

from app.api.deps import get_db, get_current_user
from app.core.limiter import limiter
from sqlalchemy.orm import Session

import structlog

logger = structlog.get_logger()


# ============================================================================
# Shared Schemas
# ============================================================================

class UsageStats(BaseModel):
    """
    Usage statistics from Gemini API calls.
    
    Provides token counts, cost estimation, and latency metrics for monitoring
    and billing purposes. All Gemini endpoints return this in their response.
    
    Attributes:
        prompt_tokens: Input token count
        completion_tokens: Output token count  
        thoughts_tokens: Tokens used for thinking (Gemini 3 with thinking enabled)
        cached_tokens: Tokens served from cache (25% cost)
        total_tokens: Total tokens consumed
        estimated_cost: Cost in USD based on model pricing
        latency_ms: Request latency in milliseconds
    """
    prompt_tokens: int = 0
    completion_tokens: int = 0
    thoughts_tokens: int = 0
    cached_tokens: int = 0
    total_tokens: int = 0
    estimated_cost: float = 0.0
    latency_ms: float = 0.0


# ============================================================================
# Model Pricing Configuration
# Per https://ai.google.dev/gemini-api/docs/pricing
# Prices in USD per 1 million tokens (updated Jan 2026)
# ============================================================================

MODEL_PRICING = {
    # Gemini 3.1 Models (Latest)
    "gemini-3.1-flash-lite-preview": {
        "input": 0.10,
        "output": 0.40,
        "description": "Gemini 3.1 Flash-Lite Preview — fast, efficient text generation"
    },
    "gemini-3.1-flash-image-preview": {
        "input": 0.50,
        "output_per_image": 0.134,
        "output": 3.0,
        "description": "Gemini 3.1 Flash Image Preview — image understanding and generation"
    },
    # Gemini 3 Models
    "gemini-3-flash-preview": {
        "input": 0.50,
        "output": 3.0,
        "description": "Fast, efficient model for most tasks"
    },
    "gemini-3-pro-preview": {
        "input": 2.0,
        "output": 12.0,
        "description": "Most capable model for complex reasoning"
    },
    "gemini-3-pro-image-preview": {
        "input": 2.0,
        "output_per_image": 0.134,
        "output": 12.0,
        "description": "Image generation with Nano Banana Pro"
    },

    # Gemini 2.5 Models
    "gemini-2.5-flash": {
        "input": 0.075,
        "output": 0.30,
        "description": "Cost-effective for high-volume tasks"
    },
    "gemini-2.5-flash-001": {
        "input": 0.075,
        "output": 0.30,
        "description": "Versioned flash model"
    },
    "gemini-2.5-flash-image": {
        "input": 0.075,
        "output": 0.30,
        "description": "Image generation with Nano Banana (258 tokens/image)"
    },
    "gemini-2.5-pro": {
        "input": 1.25, 
        "output": 5.0,
        "description": "Advanced reasoning with extended context"
    },
    
    # TTS Models
    "gemini-2.5-flash-preview-tts": {
        "input": 0.075, 
        "output": 0.30,
        "description": "Text-to-speech synthesis"
    },
    "gemini-2.5-pro-preview-tts": {
        "input": 1.25, 
        "output": 5.0,
        "description": "High-quality TTS"
    },
    
    # Embedding Models (Free tier)
    "gemini-embedding-001": {
        "input": 0.0, 
        "output": 0.0,
        "description": "Text embeddings (3072 dimensions)"
    },
    "text-embedding-004": {
        "input": 0.0, 
        "output": 0.0,
        "description": "Legacy embedding model"
    },
}


# ============================================================================
# Supported Image Formats
# Per https://ai.google.dev/gemini-api/docs/image-understanding#supported-image-formats
# ============================================================================

SUPPORTED_IMAGE_FORMATS = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"]


# ============================================================================
# Supported Audio Formats
# Per https://ai.google.dev/gemini-api/docs/audio
# ============================================================================

SUPPORTED_AUDIO_FORMATS = ["audio/wav", "audio/mp3", "audio/aiff", "audio/aac", "audio/ogg", "audio/flac"]


# ============================================================================
# Image Aspect Ratios
# Per https://ai.google.dev/gemini-api/docs/image-generation
# ============================================================================

IMAGE_ASPECT_RATIOS = {
    "1:1": "Square (1024x1024 or 1536x1536)",
    "3:4": "Portrait (896x1152 or 1344x1792)", 
    "4:3": "Landscape (1152x896 or 1792x1344)",
    "9:16": "Tall portrait/mobile (768x1344 or 1152x2016)",
    "16:9": "Widescreen (1344x768 or 2016x1152)",
    "2:3": "Classic portrait (896x1344 or 1344x2016)",
    "3:2": "Classic landscape (1344x896 or 2016x1344)",
    "9:21": "Ultra-tall banner (640x1536 or 960x2240)",
    "21:9": "Ultra-wide cinematic (1536x640 or 2240x960)",
    "1:2": "Double-tall (768x1536 or 1024x2048)",
}


# ============================================================================
# TTS Voices
# Per https://ai.google.dev/gemini-api/docs/speech-generation
# ============================================================================

TTS_VOICES = {
    "Zephyr": "Bright",
    "Puck": "Upbeat", 
    "Charon": "Informative",
    "Kore": "Firm",
    "Fenrir": "Excitable",
    "Leda": "Youthful",
    "Orus": "Firm",
    "Aoede": "Breezy",
}


# ============================================================================
# Utility Functions
# ============================================================================

def calculate_cost(model: str, usage: UsageStats, image_count: int = 0) -> float:
    """
    Calculate estimated cost based on model pricing.
    
    Args:
        model: Model name (e.g., "gemini-3-flash-preview")
        usage: UsageStats with token counts
        image_count: Number of images generated (for image generation models)
        
    Returns:
        Estimated cost in USD
        
    Note:
        - Cached tokens are billed at 25% of normal input cost
        - Image outputs have per-image pricing for generation models
        - For gemini-2.5-flash-image: ~258 output tokens per image
        - For gemini-3-pro-image-preview: $0.134 per image
    """
    pricing = MODEL_PRICING.get(model, {"input": 0.50, "output": 3.0})
    input_cost = (usage.prompt_tokens / 1_000_000) * pricing["input"]
    
    # Check if this is an image generation model with per-image pricing
    if "output_per_image" in pricing and image_count > 0:
        # Per-image pricing (e.g., Gemini 3 Pro Image: $0.134/image)
        output_cost = image_count * pricing["output_per_image"]
    else:
        # Standard token-based pricing
        output_cost = (usage.completion_tokens / 1_000_000) * pricing["output"]
    
    # Cached tokens are 25% of normal input cost
    cached_cost = (usage.cached_tokens / 1_000_000) * pricing["input"] * 0.25
    return input_cost + output_cost + cached_cost


def calculate_image_cost(model: str, usage: UsageStats, image_count: int) -> float:
    """
    Calculate cost specifically for image generation.
    
    For image generation models:
    - gemini-2.5-flash-image: Token-based (~258 tokens/image, $0.30/M output)
    - gemini-3-pro-image-preview: Per-image pricing ($0.134/image)
    
    Args:
        model: Image generation model name
        usage: UsageStats with token counts
        image_count: Number of images generated
        
    Returns:
        Estimated cost in USD
    """
    pricing = MODEL_PRICING.get(model, {"input": 0.50, "output": 3.0})
    input_cost = (usage.prompt_tokens / 1_000_000) * pricing["input"]
    
    if "output_per_image" in pricing:
        # Per-image pricing (Gemini 3 Pro Image)
        output_cost = image_count * pricing["output_per_image"]
    elif model == "gemini-2.5-flash-image":
        # Gemini 2.5 Flash Image uses token-based pricing
        # Each image is approximately 258 output tokens
        tokens_per_image = 258
        estimated_output_tokens = image_count * tokens_per_image
        output_cost = (estimated_output_tokens / 1_000_000) * pricing["output"]
    else:
        # Fallback to standard token pricing
        output_cost = (usage.completion_tokens / 1_000_000) * pricing["output"]
    
    return input_cost + output_cost


def extract_usage(response, model: str, start_time: float) -> UsageStats:
    """
    Extract usage statistics from Gemini API response.
    
    Args:
        response: Raw response from google.genai
        model: Model name for cost calculation
        start_time: Request start timestamp
        
    Returns:
        UsageStats with all metrics populated
    """
    usage = UsageStats()
    if hasattr(response, 'usage_metadata') and response.usage_metadata:
        meta = response.usage_metadata
        usage.prompt_tokens = getattr(meta, 'prompt_token_count', 0) or 0
        usage.completion_tokens = getattr(meta, 'candidates_token_count', 0) or 0
        usage.thoughts_tokens = getattr(meta, 'thoughts_token_count', 0) or 0
        usage.cached_tokens = getattr(meta, 'cached_content_token_count', 0) or 0
        usage.total_tokens = getattr(meta, 'total_token_count', 0) or 0
    usage.latency_ms = (time.time() - start_time) * 1000
    usage.estimated_cost = calculate_cost(model, usage)
    return usage


def get_gemini_client():
    """
    Get configured Gemini client.
    
    Returns:
        google.genai.Client configured with API key
        
    Raises:
        HTTPException: If GOOGLE_API_KEY not configured
    """
    import os
    from google import genai
    
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GOOGLE_API_KEY not configured"
        )
    return genai.Client(api_key=api_key)


async def fetch_url_content(url: str, max_size_mb: int = 20) -> tuple[bytes, str]:
    """
    Fetch content from URL with size limit.
    
    Args:
        url: URL to fetch
        max_size_mb: Maximum file size in MB
        
    Returns:
        Tuple of (content_bytes, mime_type)
        
    Raises:
        HTTPException: If fetch fails or size exceeded
    """
    import httpx
    
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as http_client:
        response = await http_client.get(url)
        response.raise_for_status()
        
        content_length = int(response.headers.get('content-length', 0))
        if content_length > max_size_mb * 1024 * 1024:
            raise HTTPException(
                status_code=400,
                detail=f"File too large (max {max_size_mb}MB)"
            )
        
        content_type = response.headers.get('content-type', 'application/octet-stream')
        mime_type = content_type.split(';')[0].strip()
        
        return response.content, mime_type


# ============================================================================
# In-Memory Cache Storage (for demo/development)
# Production should use Redis or similar
# ============================================================================

_cache_storage: Dict[str, Any] = {}


def get_cache_storage() -> Dict[str, Any]:
    """Get the in-memory cache storage."""
    return _cache_storage


# ============================================================================
# LLM Call Logging (Redis)
# ============================================================================

LLM_LOG_TTL = 7 * 24 * 60 * 60  # 7 days in seconds
LLM_LOGS_SORTED_SET = "llm:logs"
LLM_LOGS_MAX_ENTRIES = 10_000


async def log_llm_call(
    redis_client,
    endpoint: str,
    model: str,
    user_id: str,
    prompt_preview: str,
    output_preview: str,
    usage: "UsageStats",
    extra: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Fire-and-forget: store LLM call metadata in Redis with 7-day TTL.

    Args:
        redis_client: Redis client from get_redis_optional() — pass None to skip logging.
        endpoint: Endpoint label e.g. "generate", "structured", "function_calling".
        model: Model name used for the call.
        user_id: Caller's user ID (for cost attribution).
        prompt_preview: First 500 chars of the prompt.
        output_preview: First 500 chars of the LLM output.
        usage: UsageStats with token counts and cost.
        extra: Optional dict of additional metadata (schema_id, function_set_id, etc.).
    """
    if redis_client is None:
        return
    try:
        log_id = str(uuid.uuid4())
        ts = datetime.utcnow().timestamp()
        entry = {
            "id": log_id,
            "endpoint": endpoint,
            "model": model,
            "user_id": str(user_id),
            "prompt_preview": (prompt_preview or "")[:500],
            "output_preview": (output_preview or "")[:500],
            "prompt_tokens": usage.prompt_tokens,
            "completion_tokens": usage.completion_tokens,
            "thoughts_tokens": usage.thoughts_tokens,
            "total_tokens": usage.total_tokens,
            "estimated_cost": round(usage.estimated_cost, 8),
            "latency_ms": round(usage.latency_ms, 2),
            "timestamp": datetime.utcnow().isoformat(),
            **(extra or {}),
        }
        await redis_client.setex(f"llm:log:{log_id}", LLM_LOG_TTL, json.dumps(entry))
        await redis_client.zadd(LLM_LOGS_SORTED_SET, {log_id: ts})
        # Keep index bounded
        await redis_client.zremrangebyrank(LLM_LOGS_SORTED_SET, 0, -(LLM_LOGS_MAX_ENTRIES + 1))
    except Exception as e:
        logger.warning("llm_log_store_failed", error=str(e))
