"""
Gemini Context Caching API Module
==================================

This module provides context caching related Gemini API endpoints:

**Caching Types**

1. **Implicit Caching** (Automatic)
   - Enabled by default on all models
   - Automatically caches repeated content
   - No guaranteed savings (best-effort)
   - No code changes needed

2. **Explicit Caching** (Manual)
   - Create: Cache large contexts for guaranteed reuse
   - Query: Use cached context in requests  
   - List/Get: View cached contexts
   - Update: Extend cache TTL (ttl or expire_time)
   - Delete: Remove cached contexts

**Benefits:**
- 75% reduction in input token costs for cached tokens
- Faster response times for repeated queries
- Ideal for large documents, system instructions, few-shot examples
- File/video caching supported

**Model-Specific Minimum Token Counts:**
- gemini-2.5-flash: 1,024 tokens minimum
- gemini-2.5-pro: 4,096 tokens minimum

**Usage Metadata:**
- usage_metadata.cached_content_token_count shows cache hits

Documentation: https://ai.google.dev/gemini-api/docs/caching
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime

from app.api.deps import get_current_user
from app.core.limiter import limiter
from app.api.gemini._common import (
    UsageStats,
    extract_usage,
    get_cache_storage,
    logger
)

router = APIRouter(tags=["gemini-cache"])


# ============================================================================
# Constants
# ============================================================================

MODEL_MIN_TOKENS = {
    "gemini-2.5-flash": 1024,
    "gemini-2.5-flash-001": 1024,
    "gemini-2.5-flash-preview-04-17": 1024,
    "gemini-2.5-pro": 4096,
    "gemini-2.5-pro-001": 4096,
    "gemini-2.5-pro-preview-03-25": 4096,
}


# ============================================================================
# Request Schemas
# ============================================================================

class CacheCreateRequest(BaseModel):
    """
    Create a cached context for guaranteed reuse with 75% cost savings.
    
    **Implicit vs Explicit Caching:**
    - Implicit: Automatic, no guarantee, enabled by default
    - Explicit: Manual, guaranteed savings, this endpoint
    
    **What to Cache (Static Content):**
    - Large system instructions
    - Long reference documents
    - Few-shot examples (10+ examples)
    - Video/audio for repeated analysis
    - Code repositories for analysis
    
    **Minimum Token Requirements:**
    - Flash models: 1,024 tokens
    - Pro models: 4,096 tokens
    
    **TTL Options:**
    - ttl_seconds: Duration in seconds (e.g., 3600 = 1 hour)
    - expire_time: Specific datetime (ISO format)
    - Default: 1 hour, No maximum
    
    **Pricing:**
    - Storage: $1.00/million tokens/hour
    - Cached input: 25% of standard input price (75% savings)
    
    See: https://ai.google.dev/gemini-api/docs/caching
    """
    name: str = Field(
        ...,
        description="Unique name for this cache (for local reference)"
    )
    model: str = Field(
        "gemini-2.5-flash-001",
        description="Model (must use versioned model, e.g., gemini-2.5-flash-001)"
    )
    content: str = Field(
        None,
        description="Text content to cache"
    )
    file_uri: Optional[str] = Field(
        None,
        description="URI of uploaded file to cache (from File API)"
    )
    file_mime_type: Optional[str] = Field(
        None,
        description="MIME type of file (e.g., 'video/mp4', 'application/pdf')"
    )
    system_instruction: Optional[str] = Field(
        None,
        description="System instruction to cache with content"
    )
    ttl_seconds: Optional[int] = Field(
        None,
        description="Time-to-live in seconds"
    )
    expire_time: Optional[str] = Field(
        None,
        description="Specific expiration time (ISO 8601 format)"
    )
    display_name: Optional[str] = Field(
        None,
        description="Human-readable display name"
    )


class CacheQueryRequest(BaseModel):
    """
    Query using a cached context.
    
    Combine cached content with a new prompt for cost-effective processing.
    Response includes usage_metadata showing cached token usage.
    """
    cache_name: str = Field(
        ...,
        description="Name of the cache to use"
    )
    prompt: str = Field(
        ...,
        description="New prompt to combine with cached content"
    )
    temperature: Optional[float] = Field(
        None,
        description="Temperature for generation (0.0-2.0)"
    )
    max_tokens: Optional[int] = Field(
        None,
        description="Maximum output tokens"
    )


class CacheUpdateRequest(BaseModel):
    """
    Update cache TTL or expire_time.
    
    Extend or modify the expiration of an existing cache.
    Choose either ttl_seconds OR expire_time.
    """
    cache_name: str = Field(
        ...,
        description="Name of the cache to update"
    )
    ttl_seconds: Optional[int] = Field(
        None,
        description="New TTL in seconds"
    )
    expire_time: Optional[str] = Field(
        None,
        description="New expiration time (ISO 8601 format)"
    )


class CachingInfoResponse(BaseModel):
    """Information about caching types and requirements."""
    implicit_caching: Dict[str, Any] = Field(
        default_factory=lambda: {
            "description": "Automatic caching by Gemini API",
            "enabled_by_default": True,
            "guaranteed_savings": False,
            "how_it_works": "API automatically caches repeated prefixes",
            "setup_required": "None"
        }
    )
    explicit_caching: Dict[str, Any] = Field(
        default_factory=lambda: {
            "description": "Manual caching via this API",
            "guaranteed_savings": True,
            "cost_reduction": "75% on cached tokens",
            "storage_cost": "$1.00/million tokens/hour",
            "setup_required": "Create cache with content"
        }
    )
    model_requirements: Dict[str, int] = Field(
        default_factory=lambda: {
            "gemini-2.5-flash": 1024,
            "gemini-2.5-pro": 4096
        }
    )


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/cache-info")
@limiter.limit("30/minute")
async def get_caching_info(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Get information about caching types, requirements, and pricing.
    
    Returns details about implicit vs explicit caching,
    model-specific minimum token requirements, and cost savings.
    """
    return {
        "success": True,
        "caching_types": {
            "implicit": {
                "description": "Automatic caching by Gemini API",
                "enabled_by_default": True,
                "guaranteed_savings": False,
                "how_it_works": "API automatically detects and caches repeated content prefixes",
                "setup_required": "None - happens automatically",
                "use_case": "Repeated identical prompts in quick succession"
            },
            "explicit": {
                "description": "Manual caching via cache-create endpoint",
                "guaranteed_savings": True,
                "cost_reduction": "75% on cached tokens (pay 25% of input price)",
                "storage_cost": "$1.00 per million tokens per hour",
                "setup_required": "Create cache with content, then reference in queries",
                "use_case": "Large documents, system prompts, few-shot examples used repeatedly"
            }
        },
        "model_requirements": {
            "gemini-2.5-flash": {
                "min_tokens": 1024,
                "min_chars_approx": 4096,
                "note": "Use versioned model name: gemini-2.5-flash-001"
            },
            "gemini-2.5-pro": {
                "min_tokens": 4096,
                "min_chars_approx": 16384,
                "note": "Use versioned model name: gemini-2.5-pro-001"
            }
        },
        "what_to_cache": [
            "Large system instructions (static)",
            "Long reference documents",
            "Few-shot examples (10+ examples recommended)",
            "Video/audio files for repeated analysis",
            "Code repositories for analysis"
        ],
        "ttl_options": {
            "ttl": "Duration string (e.g., '3600s' for 1 hour)",
            "expire_time": "Specific datetime (ISO 8601 format)",
            "default": "1 hour",
            "maximum": "No maximum - can be extended"
        },
        "usage_metadata": {
            "field": "usage_metadata.cached_content_token_count",
            "description": "Number of tokens served from cache",
            "indicates": "Cache hit when > 0"
        }
    }


@router.post("/cache-create")
@limiter.limit("5/minute")
async def create_cache(
    request: Request,
    body: CacheCreateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a cached context for guaranteed reuse.
    
    Caching provides 75% cost savings on input tokens.
    Supports text content or file URIs (video, PDF, etc.).
    """
    import os
    import time
    
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise HTTPException(status_code=501, detail="google-genai SDK required")
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")
    
    # Determine minimum tokens for model
    min_tokens = MODEL_MIN_TOKENS.get(body.model, 1024)
    
    # Check content size (rough estimate: 4 chars per token)
    if body.content:
        estimated_tokens = len(body.content) // 4
        if estimated_tokens < min_tokens:
            raise HTTPException(
                status_code=400,
                detail=f"Content too small for caching. Estimated {estimated_tokens} tokens, minimum {min_tokens} required for {body.model}. Add more content (~{min_tokens * 4 - len(body.content)} more characters)."
            )
    elif not body.file_uri:
        raise HTTPException(
            status_code=400,
            detail="Either content or file_uri is required"
        )
    
    # Validate TTL options
    if body.ttl_seconds and body.expire_time:
        raise HTTPException(
            status_code=400,
            detail="Specify either ttl_seconds OR expire_time, not both"
        )
    
    client = genai.Client(api_key=api_key)
    start_time = time.time()
    
    try:
        # Build contents
        if body.content:
            contents = [body.content]
            estimated_tokens = len(body.content) // 4
        else:
            # File-based caching
            contents = [types.Part.from_uri(body.file_uri, body.file_mime_type)]
            estimated_tokens = 0  # Unknown for files
        
        # Build cache config
        cache_config = {
            "model": body.model,
            "contents": contents,
        }
        
        # TTL handling
        ttl_seconds = body.ttl_seconds or 3600  # Default 1 hour
        if body.ttl_seconds:
            cache_config["ttl"] = f"{body.ttl_seconds}s"
        elif body.expire_time:
            cache_config["expire_time"] = body.expire_time
        else:
            cache_config["ttl"] = "3600s"  # Default
        
        if body.system_instruction:
            cache_config["system_instruction"] = body.system_instruction
        
        if body.display_name:
            cache_config["display_name"] = body.display_name
        
        cached_content = client.caches.create(
            model=body.model,
            config=types.CreateCachedContentConfig(**cache_config)
        )
        
        # Store reference locally for management
        cache_storage = get_cache_storage()
        cache_storage[body.name] = {
            "api_name": cached_content.name if hasattr(cached_content, 'name') else None,
            "model": body.model,
            "display_name": body.display_name or body.name,
            "token_count": estimated_tokens,
            "content_type": "file" if body.file_uri else "text",
            "file_uri": body.file_uri,
            "created_at": time.time(),
            "expires_at": time.time() + ttl_seconds,
            "ttl_seconds": ttl_seconds
        }
        
        return {
            "success": True,
            "cache_name": body.name,
            "api_cache_name": cache_storage[body.name]["api_name"],
            "model": body.model,
            "content_type": "file" if body.file_uri else "text",
            "token_count": estimated_tokens if estimated_tokens > 0 else "file-based",
            "expires_at": datetime.fromtimestamp(cache_storage[body.name]["expires_at"]).isoformat(),
            "cost_info": {
                "storage": "$1.00/million tokens/hour",
                "input_savings": "75% (pay 25% of normal input price)",
                "estimated_hourly_storage": f"${estimated_tokens / 1_000_000:.6f}" if estimated_tokens > 0 else "varies"
            },
            "latency_ms": (time.time() - start_time) * 1000
        }
        
    except Exception as e:
        logger.error("cache_create_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cache-query")
@limiter.limit("10/minute")
async def query_cache(
    request: Request,
    body: CacheQueryRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Query using a cached context.
    
    The cached content is combined with your new prompt at 75% reduced cost.
    Response includes usage_metadata showing cached_content_token_count.
    """
    import os
    import time
    
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise HTTPException(status_code=501, detail="google-genai SDK required")
    
    cache_storage = get_cache_storage()
    
    if body.cache_name not in cache_storage:
        raise HTTPException(
            status_code=404,
            detail=f"Cache '{body.cache_name}' not found"
        )
    
    cache_info = cache_storage[body.cache_name]
    
    # Check if expired
    if time.time() > cache_info["expires_at"]:
        del cache_storage[body.cache_name]
        raise HTTPException(
            status_code=410,
            detail=f"Cache '{body.cache_name}' has expired"
        )
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")
    
    client = genai.Client(api_key=api_key)
    start_time = time.time()
    
    try:
        # Build config with cache reference
        config_kwargs = {
            "cached_content": cache_info["api_name"]
        }
        if body.temperature is not None:
            config_kwargs["temperature"] = body.temperature
        if body.max_tokens is not None:
            config_kwargs["max_output_tokens"] = body.max_tokens
        
        response = client.models.generate_content(
            model=cache_info["model"],
            contents=body.prompt,
            config=types.GenerateContentConfig(**config_kwargs)
        )
        
        usage = extract_usage(response, cache_info["model"], start_time)
        
        # Extract cached token info from usage_metadata
        cached_tokens_used = 0
        if hasattr(response, 'usage_metadata'):
            cached_tokens_used = getattr(
                response.usage_metadata, 
                'cached_content_token_count', 
                0
            )
        
        return {
            "success": True,
            "response": response.text,
            "cache_name": body.cache_name,
            "cache_info": {
                "cached_tokens_in_context": cache_info["token_count"],
                "cached_tokens_used": cached_tokens_used,
                "cache_hit": cached_tokens_used > 0,
                "estimated_savings": f"~${cached_tokens_used * 0.75 / 1_000_000:.6f}" if cached_tokens_used > 0 else "$0"
            },
            "usage": usage.model_dump()
        }
        
    except Exception as e:
        logger.error("cache_query_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cache-list")
@limiter.limit("30/minute")
async def list_caches(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    List all cached contexts.
    """
    import time
    
    cache_storage = get_cache_storage()
    caches = []
    
    for name, info in list(cache_storage.items()):
        # Check if expired
        if time.time() > info["expires_at"]:
            del cache_storage[name]
            continue
        
        caches.append({
            "name": name,
            "display_name": info.get("display_name", name),
            "model": info["model"],
            "token_count": info["token_count"],
            "created_at": datetime.fromtimestamp(info["created_at"]).isoformat(),
            "expires_at": datetime.fromtimestamp(info["expires_at"]).isoformat(),
            "time_remaining_seconds": int(info["expires_at"] - time.time())
        })
    
    return {
        "success": True,
        "caches": caches,
        "count": len(caches)
    }


@router.get("/cache-get/{cache_name:path}")
@limiter.limit("30/minute")
async def get_cache(
    request: Request,
    cache_name: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get details of a specific cache.
    """
    import time
    
    cache_storage = get_cache_storage()
    
    if cache_name not in cache_storage:
        raise HTTPException(
            status_code=404,
            detail=f"Cache '{cache_name}' not found"
        )
    
    info = cache_storage[cache_name]
    
    # Check if expired
    if time.time() > info["expires_at"]:
        del cache_storage[cache_name]
        raise HTTPException(
            status_code=410,
            detail=f"Cache '{cache_name}' has expired"
        )
    
    return {
        "success": True,
        "cache": {
            "name": cache_name,
            "display_name": info.get("display_name", cache_name),
            "model": info["model"],
            "token_count": info["token_count"],
            "created_at": datetime.fromtimestamp(info["created_at"]).isoformat(),
            "expires_at": datetime.fromtimestamp(info["expires_at"]).isoformat(),
            "time_remaining_seconds": int(info["expires_at"] - time.time())
        }
    }


@router.post("/cache-update")
@limiter.limit("10/minute")
async def update_cache(
    request: Request,
    body: CacheUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update cache TTL or expire_time to extend/modify expiration.
    
    You can specify either:
    - ttl_seconds: New duration from now
    - expire_time: Specific datetime (ISO 8601)
    """
    import os
    import time
    from datetime import datetime as dt
    
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise HTTPException(status_code=501, detail="google-genai SDK required")
    
    cache_storage = get_cache_storage()
    
    if body.cache_name not in cache_storage:
        raise HTTPException(
            status_code=404,
            detail=f"Cache '{body.cache_name}' not found"
        )
    
    if not body.ttl_seconds and not body.expire_time:
        raise HTTPException(
            status_code=400,
            detail="Specify either ttl_seconds or expire_time"
        )
    
    if body.ttl_seconds and body.expire_time:
        raise HTTPException(
            status_code=400,
            detail="Specify either ttl_seconds OR expire_time, not both"
        )
    
    info = cache_storage[body.cache_name]
    
    try:
        api_key = os.getenv("GOOGLE_API_KEY")
        if api_key and info.get("api_name"):
            client = genai.Client(api_key=api_key)
            
            update_config = {}
            if body.ttl_seconds:
                update_config["ttl"] = f"{body.ttl_seconds}s"
            elif body.expire_time:
                update_config["expire_time"] = body.expire_time
            
            # Update via API
            client.caches.update(
                name=info["api_name"],
                config=types.UpdateCachedContentConfig(**update_config)
            )
    except Exception as e:
        logger.warning("cache_api_update_error", error=str(e))
        # Continue with local update
    
    # Update local storage
    if body.ttl_seconds:
        info["expires_at"] = time.time() + body.ttl_seconds
        info["ttl_seconds"] = body.ttl_seconds
    elif body.expire_time:
        # Parse ISO datetime
        try:
            expire_dt = dt.fromisoformat(body.expire_time.replace('Z', '+00:00'))
            info["expires_at"] = expire_dt.timestamp()
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid expire_time format. Use ISO 8601 (e.g., 2024-12-31T23:59:59Z)"
            )
    
    return {
        "success": True,
        "cache_name": body.cache_name,
        "new_expires_at": datetime.fromtimestamp(info["expires_at"]).isoformat(),
        "ttl_seconds": body.ttl_seconds,
        "expire_time": body.expire_time
    }


@router.delete("/cache-delete/{cache_name:path}")
@limiter.limit("10/minute")
async def delete_cache(
    request: Request,
    cache_name: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a cached context.
    """
    cache_storage = get_cache_storage()
    
    if cache_name not in cache_storage:
        raise HTTPException(
            status_code=404,
            detail=f"Cache '{cache_name}' not found"
        )
    
    del cache_storage[cache_name]
    
    return {
        "success": True,
        "message": f"Cache '{cache_name}' deleted successfully"
    }
