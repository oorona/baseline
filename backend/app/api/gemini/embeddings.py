"""
Gemini Embeddings API Module
============================

This module provides embedding-related Gemini API endpoints.

**Embeddings**
- Generate: Create embeddings for text content
- Batch: Process multiple texts at once

**Models:**
- gemini-embedding-001: 3072 dimensions (recommended)
- text-embedding-004: Legacy model

**Task Types:**
- RETRIEVAL_DOCUMENT: For documents to be searched
- RETRIEVAL_QUERY: For search queries
- SEMANTIC_SIMILARITY: For comparing text similarity
- CLASSIFICATION: For text classification
- CLUSTERING: For grouping similar texts

Documentation: https://ai.google.dev/gemini-api/docs/embeddings
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List

from app.api.deps import get_current_user
from app.core.limiter import limiter
from app.api.gemini._common import (
    UsageStats,
    extract_usage,
    logger
)

router = APIRouter(tags=["gemini-embeddings"])


# ============================================================================
# Request Schemas
# ============================================================================

class EmbeddingRequest(BaseModel):
    """
    Embedding generation request.
    
    **Models:**
    - gemini-embedding-001: 3072 dimensions (free tier)
    - text-embedding-004: Legacy model (free tier)
    
    **Task Types:**
    - RETRIEVAL_DOCUMENT: For documents being indexed for search
    - RETRIEVAL_QUERY: For search queries
    - SEMANTIC_SIMILARITY: For comparing text similarity
    - CLASSIFICATION: For text classification tasks
    - CLUSTERING: For grouping similar texts
    
    **Truncation:**
    The model automatically truncates text that exceeds the limit.
    Maximum input depends on model (typically 2048 tokens).
    
    See: https://ai.google.dev/gemini-api/docs/embeddings
    """
    texts: List[str] = Field(
        ...,
        description="List of texts to embed",
        min_length=1,
        max_length=100
    )
    model: str = Field(
        "gemini-embedding-001",
        description="Model: gemini-embedding-001 or text-embedding-004"
    )
    task_type: Optional[str] = Field(
        None,
        description="Task type: RETRIEVAL_DOCUMENT, RETRIEVAL_QUERY, SEMANTIC_SIMILARITY, CLASSIFICATION, CLUSTERING"
    )
    title: Optional[str] = Field(
        None,
        description="Optional title for RETRIEVAL_DOCUMENT task type"
    )
    output_dimensionality: Optional[int] = Field(
        None,
        description="Reduce output dimensions (only for models that support it)"
    )


class EmbeddingResponse(BaseModel):
    """Embedding generation response."""
    embeddings: List[List[float]]
    dimensions: int
    model: str
    count: int
    usage: Optional[UsageStats] = None


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/embeddings", response_model=EmbeddingResponse)
@limiter.limit("30/minute")
async def generate_embeddings(
    request: Request,
    body: EmbeddingRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate embeddings for text content.
    
    Returns high-dimensional vectors (3072 for gemini-embedding-001)
    suitable for semantic search, clustering, and similarity comparison.
    
    **Free tier:** Both embedding models are currently free.
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
    
    start_time = time.time()
    client = genai.Client(api_key=api_key)
    
    # Build config
    config_kwargs = {}
    if body.task_type:
        config_kwargs["task_type"] = body.task_type
    if body.title:
        config_kwargs["title"] = body.title
    if body.output_dimensionality:
        config_kwargs["output_dimensionality"] = body.output_dimensionality
    
    config = types.EmbedContentConfig(**config_kwargs) if config_kwargs else None
    
    try:
        embeddings = []
        
        for text in body.texts:
            response = client.models.embed_content(
                model=body.model,
                contents=text,
                config=config
            )
            
            if hasattr(response, 'embeddings') and response.embeddings:
                embeddings.append(response.embeddings[0].values)
            elif hasattr(response, 'embedding'):
                embeddings.append(response.embedding.values)
        
        # Calculate dimensions
        dimensions = len(embeddings[0]) if embeddings else 0
        
        # Create usage stats (embeddings are free but track for consistency)
        usage = UsageStats(
            prompt_tokens=sum(len(t) // 4 for t in body.texts),
            completion_tokens=0,
            total_tokens=sum(len(t) // 4 for t in body.texts),
            latency_ms=(time.time() - start_time) * 1000,
            estimated_cost=0.0  # Free tier
        )
        
        return EmbeddingResponse(
            embeddings=embeddings,
            dimensions=dimensions,
            model=body.model,
            count=len(embeddings),
            usage=usage
        )
        
    except Exception as e:
        logger.error("embeddings_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
