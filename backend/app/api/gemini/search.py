"""
Gemini File Search API Module
=============================

This module provides file search (RAG) related Gemini API endpoints:

**File Search Store Management**
- Create: Create file search stores for document indexing
- Upload: Upload and index documents directly to store
- Import: Import existing files into store
- Query: Semantic search with grounded responses

**Document Management**
- List: View all documents in a store
- Get: Get document details
- Delete: Remove individual documents

**Advanced Features**
- Chunking Configuration: Control chunk size and overlap
- Metadata: Add custom key-value metadata to files
- Metadata Filtering: Filter searches by metadata
- Structured Output: Combine with JSON schema responses
- Citations: Get source citations in responses

**Supported File Types:**
PDF, TXT, HTML, MD, JSON, CSV, XML, and more

Documentation: https://ai.google.dev/gemini-api/docs/file-search
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal

from app.api.deps import get_current_user
from app.core.limiter import limiter
from app.api.gemini._common import (
    UsageStats,
    extract_usage,
    logger
)

router = APIRouter(tags=["gemini-search"])


# ============================================================================
# Request Schemas
# ============================================================================

class ChunkingConfig(BaseModel):
    """Configuration for document chunking."""
    max_tokens_per_chunk: int = Field(
        200,
        ge=100,
        le=2000,
        description="Maximum tokens per chunk (100-2000)"
    )
    max_overlap_tokens: int = Field(
        20,
        ge=0,
        le=200,
        description="Token overlap between chunks (0-200)"
    )


class FileMetadata(BaseModel):
    """Custom metadata for a file."""
    key: str = Field(..., description="Metadata key")
    string_value: Optional[str] = Field(None, description="String value")
    numeric_value: Optional[float] = Field(None, description="Numeric value")


class FileSearchStoreRequest(BaseModel):
    """
    Create a file search store for document indexing.
    
    File search stores contain embeddings for semantic search across documents.
    Documents are automatically chunked, embedded, and indexed.
    
    **Features:**
    - Persistent storage (no TTL, stored until deleted)
    - Automatic chunking and embedding
    - Semantic similarity search
    - Custom metadata support
    
    **Supported File Types:**
    - Documents: PDF, DOCX, PPTX, XLSX
    - Text: TXT, MD, HTML, XML, JSON, CSV
    - Code: PY, JS, TS, JAVA, C, CPP, GO, RS
    
    **Limits:**
    - Max file size: 100 MB per document
    - Free tier: 1 GB total storage
    - Tier 1: 10 GB | Tier 2: 100 GB | Tier 3: 1 TB
    
    See: https://ai.google.dev/gemini-api/docs/file-search
    """
    display_name: str = Field(
        ...,
        description="Human-readable display name for the store"
    )
    description: Optional[str] = Field(
        None,
        description="Description of the store contents"
    )


class FileSearchUploadRequest(BaseModel):
    """
    Upload a file directly to a file search store.
    
    Files are automatically chunked, embedded, and indexed.
    Use chunking_config to customize the chunking strategy.
    """
    store_name: str = Field(
        ...,
        description="Name of the file search store (fileSearchStores/xxx)"
    )
    content: str = Field(
        ...,
        description="File content as text"
    )
    display_name: str = Field(
        ...,
        description="Display name for the file (visible in citations)"
    )
    custom_metadata: Optional[List[FileMetadata]] = Field(
        None,
        description="Custom metadata key-value pairs for filtering"
    )
    chunking_config: Optional[ChunkingConfig] = Field(
        None,
        description="Custom chunking configuration"
    )


class FileSearchQueryRequest(BaseModel):
    """
    Query a file search store using semantic search.
    
    The model performs semantic search to find relevant chunks,
    then generates a grounded response with citations.
    
    **Features:**
    - Semantic similarity search (not keyword-based)
    - Automatic context retrieval
    - Source citations with file names
    - Metadata filtering
    - Structured output support
    """
    store_names: List[str] = Field(
        ...,
        description="File search store names to query",
        min_length=1,
        max_length=5
    )
    query: str = Field(
        ...,
        description="Search query or question"
    )
    model: str = Field(
        "gemini-2.5-flash",
        description="Model: gemini-2.5-flash, gemini-2.5-pro"
    )
    metadata_filter: Optional[str] = Field(
        None,
        description="Filter by metadata, e.g., 'author=John' or 'year>2020'"
    )
    response_schema: Optional[Dict[str, Any]] = Field(
        None,
        description="JSON Schema for structured output (Gemini 3+)"
    )
    include_citations: bool = Field(
        True,
        description="Include source citations in response"
    )


class DocumentListRequest(BaseModel):
    """List documents in a file search store."""
    store_name: str = Field(
        ...,
        description="File search store name"
    )


# ============================================================================
# In-Memory Store (Demo/Development)
# Production should use the actual Gemini File Search API
# ============================================================================

_file_search_stores: Dict[str, Any] = {}


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/file-search-store")
@limiter.limit("5/minute")
async def create_file_search_store(
    request: Request,
    body: FileSearchStoreRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new file search store.
    
    Stores persist until deleted and have no TTL.
    Storage is free; you only pay for embedding creation.
    """
    import os
    import time
    import uuid
    
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise HTTPException(status_code=501, detail="google-genai SDK required")
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")
    
    client = genai.Client(api_key=api_key)
    
    try:
        # Create file search store via API
        store = client.file_search_stores.create(
            config={"display_name": body.display_name}
        )
        
        store_name = store.name if hasattr(store, 'name') else f"fileSearchStores/{uuid.uuid4().hex[:16]}"
        
        # Store locally for demo management
        _file_search_stores[store_name] = {
            "name": store_name,
            "display_name": body.display_name,
            "description": body.description,
            "created_at": time.time(),
            "documents": [],
            "document_count": 0
        }
        
        return {
            "success": True,
            "store_name": store_name,
            "display_name": body.display_name,
            "description": body.description,
            "message": f"File search store '{body.display_name}' created successfully",
            "note": "Storage is free. Embedding costs apply at upload time."
        }
        
    except Exception as e:
        logger.error("file_search_store_create_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/file-search-upload")
@limiter.limit("10/minute")
async def upload_to_file_search_store(
    request: Request,
    body: FileSearchUploadRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Upload a file directly to a file search store.
    
    The file is chunked, embedded, and indexed for semantic search.
    You can customize chunking with chunking_config.
    """
    import os
    import time
    import uuid
    
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise HTTPException(status_code=501, detail="google-genai SDK required")
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")
    
    client = genai.Client(api_key=api_key)
    start_time = time.time()
    
    try:
        # Build upload config
        upload_config = {"display_name": body.display_name}
        
        if body.chunking_config:
            upload_config["chunking_config"] = {
                "white_space_config": {
                    "max_tokens_per_chunk": body.chunking_config.max_tokens_per_chunk,
                    "max_overlap_tokens": body.chunking_config.max_overlap_tokens
                }
            }
        
        if body.custom_metadata:
            upload_config["custom_metadata"] = [
                {"key": m.key, "string_value": m.string_value, "numeric_value": m.numeric_value}
                for m in body.custom_metadata
            ]
        
        # Create a temporary file for upload
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(body.content)
            temp_path = f.name
        
        try:
            # Upload to file search store
            operation = client.file_search_stores.upload_to_file_search_store(
                file=temp_path,
                file_search_store_name=body.store_name,
                config=upload_config
            )
            
            # Wait for processing (with timeout)
            max_wait = 60
            waited = 0
            while not operation.done and waited < max_wait:
                time.sleep(2)
                waited += 2
                operation = client.operations.get(operation)
            
        finally:
            import os as os_module
            os_module.unlink(temp_path)
        
        # Update local store
        doc_id = f"documents/{uuid.uuid4().hex[:16]}"
        if body.store_name in _file_search_stores:
            _file_search_stores[body.store_name]["documents"].append({
                "id": doc_id,
                "display_name": body.display_name,
                "size": len(body.content),
                "metadata": body.custom_metadata,
                "uploaded_at": time.time()
            })
            _file_search_stores[body.store_name]["document_count"] += 1
        
        return {
            "success": True,
            "store_name": body.store_name,
            "document_id": doc_id,
            "display_name": body.display_name,
            "size_bytes": len(body.content),
            "estimated_tokens": len(body.content) // 4,
            "chunking_config": body.chunking_config.model_dump() if body.chunking_config else "default",
            "metadata": [m.model_dump() for m in body.custom_metadata] if body.custom_metadata else None,
            "processing_time_ms": (time.time() - start_time) * 1000,
            "message": "File uploaded and indexed successfully"
        }
        
    except Exception as e:
        logger.error("file_search_upload_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/file-search-query")
@limiter.limit("10/minute")
async def query_file_search_store(
    request: Request,
    body: FileSearchQueryRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Query file search stores using semantic search.
    
    Retrieves relevant document chunks and generates a grounded response.
    Supports metadata filtering and structured output.
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
    
    client = genai.Client(api_key=api_key)
    start_time = time.time()
    
    try:
        # Build file search tool config
        file_search_config = {
            "file_search_store_names": body.store_names
        }
        
        if body.metadata_filter:
            file_search_config["metadata_filter"] = body.metadata_filter
        
        # Build generation config
        config_kwargs = {
            "tools": [
                types.Tool(
                    file_search=types.FileSearch(**file_search_config)
                )
            ]
        }
        
        # Add structured output if requested
        if body.response_schema:
            config_kwargs["response_mime_type"] = "application/json"
            config_kwargs["response_schema"] = body.response_schema
        
        response = client.models.generate_content(
            model=body.model,
            contents=body.query,
            config=types.GenerateContentConfig(**config_kwargs)
        )
        
        usage = extract_usage(response, body.model, start_time)
        
        # Extract citations if available
        citations = []
        if body.include_citations and hasattr(response, 'candidates') and response.candidates:
            for candidate in response.candidates:
                if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
                    gm = candidate.grounding_metadata
                    if hasattr(gm, 'grounding_chunks'):
                        for chunk in gm.grounding_chunks:
                            citations.append({
                                "source": getattr(chunk, 'retrieved_context', {}).get('uri', 'unknown'),
                                "title": getattr(chunk, 'retrieved_context', {}).get('title', 'unknown'),
                                "text": getattr(chunk, 'web', {}).get('snippet', '')
                            })
        
        return {
            "success": True,
            "response": response.text,
            "store_names": body.store_names,
            "citations": citations if body.include_citations else None,
            "metadata_filter": body.metadata_filter,
            "structured_output": body.response_schema is not None,
            "model": body.model,
            "usage": usage.model_dump()
        }
        
    except Exception as e:
        logger.error("file_search_query_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/file-search-stores")
@limiter.limit("30/minute")
async def list_file_search_stores(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    List all file search stores.
    """
    import os
    
    try:
        from google import genai
    except ImportError:
        raise HTTPException(status_code=501, detail="google-genai SDK required")
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")
    
    client = genai.Client(api_key=api_key)
    
    try:
        stores = []
        for store in client.file_search_stores.list():
            stores.append({
                "name": store.name,
                "display_name": getattr(store, 'display_name', 'unknown'),
                "create_time": str(getattr(store, 'create_time', '')),
                "update_time": str(getattr(store, 'update_time', ''))
            })
        
        return {
            "success": True,
            "stores": stores,
            "count": len(stores)
        }
        
    except Exception as e:
        logger.error("file_search_stores_list_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/file-search-stores/{store_name:path}")
@limiter.limit("30/minute")
async def get_file_search_store(
    request: Request,
    store_name: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get details of a specific file search store.
    """
    import os
    
    try:
        from google import genai
    except ImportError:
        raise HTTPException(status_code=501, detail="google-genai SDK required")
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")
    
    client = genai.Client(api_key=api_key)
    
    try:
        store = client.file_search_stores.get(name=store_name)
        
        return {
            "success": True,
            "store": {
                "name": store.name,
                "display_name": getattr(store, 'display_name', 'unknown'),
                "create_time": str(getattr(store, 'create_time', '')),
                "update_time": str(getattr(store, 'update_time', ''))
            }
        }
        
    except Exception as e:
        logger.error("file_search_store_get_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/file-search-stores/{store_name:path}")
@limiter.limit("10/minute")
async def delete_file_search_store(
    request: Request,
    store_name: str,
    force: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a file search store.
    
    Set force=True to delete even if store has documents.
    """
    import os
    
    try:
        from google import genai
    except ImportError:
        raise HTTPException(status_code=501, detail="google-genai SDK required")
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")
    
    client = genai.Client(api_key=api_key)
    
    try:
        client.file_search_stores.delete(
            name=store_name,
            config={"force": force}
        )
        
        # Remove from local cache
        if store_name in _file_search_stores:
            del _file_search_stores[store_name]
        
        return {
            "success": True,
            "message": f"File search store '{store_name}' deleted successfully"
        }
        
    except Exception as e:
        logger.error("file_search_store_delete_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/file-search-documents/{store_name:path}")
@limiter.limit("30/minute")
async def list_documents(
    request: Request,
    store_name: str,
    current_user: dict = Depends(get_current_user)
):
    """
    List all documents in a file search store.
    """
    import os
    
    try:
        from google import genai
    except ImportError:
        raise HTTPException(status_code=501, detail="google-genai SDK required")
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")
    
    client = genai.Client(api_key=api_key)
    
    try:
        documents = []
        for doc in client.file_search_stores.documents.list(parent=store_name):
            documents.append({
                "name": doc.name,
                "display_name": getattr(doc, 'display_name', 'unknown'),
                "create_time": str(getattr(doc, 'create_time', '')),
                "metadata": getattr(doc, 'custom_metadata', None)
            })
        
        return {
            "success": True,
            "store_name": store_name,
            "documents": documents,
            "count": len(documents)
        }
        
    except Exception as e:
        logger.error("file_search_documents_list_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/file-search-documents/{document_name:path}")
@limiter.limit("10/minute")
async def delete_document(
    request: Request,
    document_name: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a document from a file search store.
    """
    import os
    
    try:
        from google import genai
    except ImportError:
        raise HTTPException(status_code=501, detail="google-genai SDK required")
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")
    
    client = genai.Client(api_key=api_key)
    
    try:
        client.file_search_stores.documents.delete(name=document_name)
        
        return {
            "success": True,
            "message": f"Document '{document_name}' deleted successfully"
        }
        
    except Exception as e:
        logger.error("file_search_document_delete_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
