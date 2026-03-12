"""
LLM Store API Module
====================

Manages file-based stores for:
- **Output Schemas** — JSON Schema files used by the structured-output endpoint.
  Bots reference a schema by ID so the LLM returns data in a predictable shape.
- **Function Sets** — JSON files containing tool/function declarations used by the
  function-calling endpoint. Each function set bundles one or more function
  definitions that the model can invoke.
- **LLM Call Logs** — Recent LLM call records stored in Redis (7-day TTL).
  Includes prompt/output previews and full token + cost stats.

Storage Layout
--------------
  backend/schemas/{id}.json     — output schema files
  backend/functions/{id}.json   — function set files

Schema File Format
------------------
  {
    "id": "recipe",
    "name": "Recipe",
    "description": "Extract a structured recipe from text",
    "schema": { ...JSON Schema object... },
    "example_prompt": "Extract the recipe from: ..."
  }

Function Set File Format
------------------------
  {
    "id": "weather_tools",
    "name": "Weather Tools",
    "description": "Functions for fetching weather data",
    "functions": [
      {
        "name": "get_weather",
        "description": "...",
        "parameters": { "type": "object", "properties": {...}, "required": [...] }
      }
    ],
    "example_prompts": ["What's the weather in Tokyo?"]
  }

Adding Custom Functions
-----------------------
To add a new function set that your bot can use:

1. Create a JSON file at backend/functions/{your_id}.json following the format above.
2. Each entry in "functions" must conform to the Google GenAI FunctionDeclaration schema:
   - name: snake_case identifier
   - description: detailed description (model uses this to decide when to call)
   - parameters: standard JSON Schema with "type": "object" and "properties"
3. Pass "function_set_id": "{your_id}" to POST /api/v1/gemini/function-calling.
4. The framework loads the declarations and passes them to the Gemini API.
5. Implement the actual execution logic in your bot's command handler and return
   results via the "function_results" field in subsequent requests.

See: https://ai.google.dev/gemini-api/docs/function-calling
"""

import os
import json
import re
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.core.limiter import limiter
from app.db.redis import get_redis, get_redis_optional
from app.api.gemini._common import LLM_LOGS_SORTED_SET, logger

router = APIRouter(tags=["gemini-llm-store"])

# ============================================================================
# Storage Paths
# ============================================================================

# Resolve paths relative to the backend root (two levels up from this file)
_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent.parent
SCHEMAS_DIR = _BACKEND_ROOT / "schemas"
FUNCTIONS_DIR = _BACKEND_ROOT / "functions"

SCHEMAS_DIR.mkdir(exist_ok=True)
FUNCTIONS_DIR.mkdir(exist_ok=True)

_ID_RE = re.compile(r"^[a-zA-Z0-9_\-]{1,64}$")


def _valid_id(id_: str) -> bool:
    return bool(_ID_RE.match(id_))


# ============================================================================
# Permission helpers
# ============================================================================

def _require_developer(user: dict) -> None:
    """Raise 403 unless the caller is a platform admin (Level 5)."""
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Developer (Level 5) access required.")


# ============================================================================
# Schema Store — Request/Response Models
# ============================================================================

class SchemaEntry(BaseModel):
    id: str = Field(..., description="Unique identifier (alphanumeric, dashes, underscores)")
    name: str = Field(..., description="Human-readable display name")
    description: str = Field("", description="What this schema extracts or structures")
    schema_def: Dict[str, Any] = Field(..., alias="schema", description="JSON Schema object")
    example_prompt: str = Field("", description="Example prompt to use with this schema")

    model_config = {"populate_by_name": True}


class SchemaEntryOut(BaseModel):
    id: str
    name: str
    description: str
    schema_def: Dict[str, Any] = Field(alias="schema")
    example_prompt: str

    model_config = {"populate_by_name": True}


# ============================================================================
# Function Set — Request/Response Models
# ============================================================================

class FunctionDef(BaseModel):
    name: str
    description: str
    parameters: Dict[str, Any]


class FunctionSetEntry(BaseModel):
    id: str = Field(..., description="Unique identifier")
    name: str = Field(..., description="Human-readable display name")
    description: str = Field("", description="What these functions do")
    functions: List[FunctionDef] = Field(..., description="List of function declarations")
    example_prompts: List[str] = Field(default_factory=list, description="Example prompts")


# ============================================================================
# Internal helpers
# ============================================================================

def _load_json_file(path: Path) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _save_json_file(path: Path, data: Dict[str, Any]) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def load_schema_from_store(schema_id: str) -> Optional[Dict[str, Any]]:
    """Load a schema entry from disk. Returns None if not found. Public utility."""
    if not _valid_id(schema_id):
        return None
    return _load_json_file(SCHEMAS_DIR / f"{schema_id}.json")


def load_function_set_from_store(set_id: str) -> Optional[Dict[str, Any]]:
    """Load a function set from disk. Returns None if not found. Public utility."""
    if not _valid_id(set_id):
        return None
    return _load_json_file(FUNCTIONS_DIR / f"{set_id}.json")


# ============================================================================
# Schema Store Endpoints
# ============================================================================

@router.get("/schemas")
async def list_schemas(
    current_user: dict = Depends(get_current_user),
):
    """List all output schemas available in the schema store."""
    entries = []
    for path in sorted(SCHEMAS_DIR.glob("*.json")):
        data = _load_json_file(path)
        if data:
            entries.append({
                "id": data.get("id", path.stem),
                "name": data.get("name", path.stem),
                "description": data.get("description", ""),
                "example_prompt": data.get("example_prompt", ""),
                "properties": list(data.get("schema", {}).get("properties", {}).keys()),
            })
    return {"schemas": entries, "count": len(entries)}


@router.get("/schemas/{schema_id}")
async def get_schema(
    schema_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a specific schema by ID including the full JSON Schema definition."""
    if not _valid_id(schema_id):
        raise HTTPException(status_code=400, detail="Invalid schema ID format.")
    data = _load_json_file(SCHEMAS_DIR / f"{schema_id}.json")
    if data is None:
        raise HTTPException(status_code=404, detail=f"Schema '{schema_id}' not found.")
    return data


@router.post("/schemas/{schema_id}", status_code=200)
async def upsert_schema(
    schema_id: str,
    body: SchemaEntry,
    current_user: dict = Depends(get_current_user),
):
    """Create or update a schema file. Requires Level 5 (Developer)."""
    _require_developer(current_user)
    if not _valid_id(schema_id):
        raise HTTPException(status_code=400, detail="Invalid schema ID format.")
    if not body.schema_def or body.schema_def.get("type") not in ("object", "array", "string", "number", "integer", "boolean"):
        raise HTTPException(status_code=400, detail="Schema must include a valid 'type' field.")

    payload = {
        "id": schema_id,
        "name": body.name,
        "description": body.description,
        "schema": body.schema_def,
        "example_prompt": body.example_prompt,
    }
    _save_json_file(SCHEMAS_DIR / f"{schema_id}.json", payload)
    logger.info("schema_upserted", schema_id=schema_id, user=current_user.get("id"))
    return {"success": True, "id": schema_id}


@router.delete("/schemas/{schema_id}", status_code=200)
async def delete_schema(
    schema_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a schema file. Requires Level 5 (Developer)."""
    _require_developer(current_user)
    if not _valid_id(schema_id):
        raise HTTPException(status_code=400, detail="Invalid schema ID format.")
    path = SCHEMAS_DIR / f"{schema_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Schema '{schema_id}' not found.")
    path.unlink()
    logger.info("schema_deleted", schema_id=schema_id, user=current_user.get("id"))
    return {"success": True, "id": schema_id}


# ============================================================================
# Function Set Endpoints
# ============================================================================

@router.get("/function-sets")
async def list_function_sets(
    current_user: dict = Depends(get_current_user),
):
    """List all function sets available in the function store."""
    entries = []
    for path in sorted(FUNCTIONS_DIR.glob("*.json")):
        data = _load_json_file(path)
        if data:
            funcs = data.get("functions", [])
            entries.append({
                "id": data.get("id", path.stem),
                "name": data.get("name", path.stem),
                "description": data.get("description", ""),
                "function_count": len(funcs),
                "function_names": [f.get("name") for f in funcs],
                "example_prompts": data.get("example_prompts", []),
            })
    return {"function_sets": entries, "count": len(entries)}


@router.get("/function-sets/{set_id}")
async def get_function_set(
    set_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a specific function set including full function declarations."""
    if not _valid_id(set_id):
        raise HTTPException(status_code=400, detail="Invalid function set ID format.")
    data = _load_json_file(FUNCTIONS_DIR / f"{set_id}.json")
    if data is None:
        raise HTTPException(status_code=404, detail=f"Function set '{set_id}' not found.")
    return data


@router.post("/function-sets/{set_id}", status_code=200)
async def upsert_function_set(
    set_id: str,
    body: FunctionSetEntry,
    current_user: dict = Depends(get_current_user),
):
    """Create or update a function set file. Requires Level 5 (Developer)."""
    _require_developer(current_user)
    if not _valid_id(set_id):
        raise HTTPException(status_code=400, detail="Invalid function set ID format.")
    if not body.functions:
        raise HTTPException(status_code=400, detail="At least one function declaration is required.")

    payload = {
        "id": set_id,
        "name": body.name,
        "description": body.description,
        "functions": [f.model_dump() for f in body.functions],
        "example_prompts": body.example_prompts,
    }
    _save_json_file(FUNCTIONS_DIR / f"{set_id}.json", payload)
    logger.info("function_set_upserted", set_id=set_id, user=current_user.get("id"))
    return {"success": True, "id": set_id}


@router.delete("/function-sets/{set_id}", status_code=200)
async def delete_function_set(
    set_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a function set file. Requires Level 5 (Developer)."""
    _require_developer(current_user)
    if not _valid_id(set_id):
        raise HTTPException(status_code=400, detail="Invalid function set ID format.")
    path = FUNCTIONS_DIR / f"{set_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Function set '{set_id}' not found.")
    path.unlink()
    logger.info("function_set_deleted", set_id=set_id, user=current_user.get("id"))
    return {"success": True, "id": set_id}


# ============================================================================
# LLM Call Logs Endpoint
# ============================================================================

@router.get("/logs")
@limiter.limit("30/minute")
async def get_llm_logs(
    request: Request,
    limit: int = 50,
    offset: int = 0,
    model: Optional[str] = None,
    endpoint: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    redis=Depends(get_redis),
):
    """
    Retrieve recent LLM call logs from Redis.

    Logs are stored for 7 days and include prompt/output previews,
    full token counts (prompt, completion, thoughts, total), and estimated cost.

    Requires Level 5 (Developer).
    """
    _require_developer(current_user)

    # Get IDs from sorted set (newest first)
    total = await redis.zcard(LLM_LOGS_SORTED_SET)
    ids = await redis.zrevrange(LLM_LOGS_SORTED_SET, offset, offset + limit - 1)

    logs = []
    for log_id in ids:
        raw = await redis.get(f"llm:log:{log_id.decode() if isinstance(log_id, bytes) else log_id}")
        if raw:
            try:
                entry = json.loads(raw)
                # Apply optional filters
                if model and entry.get("model") != model:
                    continue
                if endpoint and entry.get("endpoint") != endpoint:
                    continue
                logs.append(entry)
            except Exception:
                pass

    # Aggregate summary stats
    return {
        "logs": logs,
        "count": len(logs),
        "total_indexed": total,
        "offset": offset,
        "limit": limit,
    }
