"""
Gemini API Package
==================

This package provides a modular structure for all Gemini API endpoints.

**Modules:**
- text: Text generation, token counting, structured output
- image: Image generation, editing, understanding, detection, segmentation
- audio: Text-to-speech, audio transcription, processing
- embeddings: Text embeddings for semantic search
- tools: Function calling, URL context grounding
- search: File search with vector stores (RAG)
- cache: Context caching for cost reduction
- llm_store: Schema store, function set store, LLM call logs

**Usage:**
The package exports a combined router that includes all sub-routers.
Import and include in your FastAPI app:

```python
from app.api.gemini import router as gemini_router
app.include_router(gemini_router, prefix="/api/v1", tags=["gemini"])
```

**Documentation:**
- Full API docs: /docs/GEMINI_API.md
- Capabilities guide: /docs/GEMINI_CAPABILITIES.md
- Official docs: https://ai.google.dev/gemini-api/docs

**Models (Jan 2026):**
- gemini-3-flash-preview: Fast, efficient for most tasks
- gemini-3-pro-preview: Most capable for complex reasoning
- gemini-3-pro-image-preview: High-quality image generation (4K)
- gemini-2.5-flash: Cost-effective high-volume
- gemini-2.5-flash-image: Fast image generation (1K)
- gemini-2.5-pro: Advanced reasoning with extended context
"""

from fastapi import APIRouter

# Import sub-routers
from app.api.gemini.text import router as text_router
from app.api.gemini.image import router as image_router
from app.api.gemini.audio import router as audio_router
from app.api.gemini.embeddings import router as embeddings_router
from app.api.gemini.tools import router as tools_router
from app.api.gemini.search import router as search_router
from app.api.gemini.cache import router as cache_router
from app.api.gemini.llm_store import router as llm_store_router

# Import shared utilities for external use
from app.api.gemini._common import (
    UsageStats,
    MODEL_PRICING,
    SUPPORTED_IMAGE_FORMATS,
    SUPPORTED_AUDIO_FORMATS,
    IMAGE_ASPECT_RATIOS,
    TTS_VOICES,
    calculate_cost,
    extract_usage,
    get_gemini_client,
    fetch_url_content,
    get_cache_storage,
    log_llm_call,
    LLM_LOG_TTL,
)

# Create main router
router = APIRouter(prefix="/gemini", tags=["gemini"])

# Include all sub-routers
router.include_router(text_router)
router.include_router(image_router)
router.include_router(audio_router)
router.include_router(embeddings_router)
router.include_router(tools_router)
router.include_router(search_router)
router.include_router(cache_router)
router.include_router(llm_store_router)

# Export public API
__all__ = [
    # Router
    "router",

    # Schemas
    "UsageStats",

    # Constants
    "MODEL_PRICING",
    "SUPPORTED_IMAGE_FORMATS",
    "SUPPORTED_AUDIO_FORMATS",
    "IMAGE_ASPECT_RATIOS",
    "TTS_VOICES",

    # Utilities
    "calculate_cost",
    "extract_usage",
    "get_gemini_client",
    "fetch_url_content",
    "get_cache_storage",
    "log_llm_call",
    "LLM_LOG_TTL",
]
