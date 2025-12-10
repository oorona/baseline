# Adding Backend API Endpoints

This guide explains how to add new REST API endpoints to the FastAPI backend.

## Overview

The backend uses FastAPI with:
- **PostgreSQL** for data storage
- **Redis** for sessions and caching
- **SQLAlchemy** for ORM
- **Alembic** for migrations
- **Pydantic** for validation

## Step 1: Define Your Data Model

Create or update models in `backend/app/models.py`:

```python
from sqlalchemy import Column, String, BigInteger, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .db.session import Base

class CustomFeature(Base):
    __tablename__ = "custom_features"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    guild_id = Column(BigInteger, ForeignKey("guilds.id"), nullable=False)
    name = Column(String, nullable=False)
    config = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationship
    guild = relationship("Guild")
```

## Step 2: Create Database Migration

```bash
# Auto-generate migration
docker compose exec backend alembic revision --autogenerate -m "add_custom_feature"

# Apply migration
make migrate
```

## Step 3: Define Pydantic Schemas

Create schemas in `backend/app/schemas.py`:

```python
from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime

class CustomFeatureBase(BaseModel):
    name: str
    config: Dict[str, Any] = {}

class CustomFeatureCreate(CustomFeatureBase):
    guild_id: int

class CustomFeature(CustomFeatureBase):
    id: int
    guild_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
```

## Step 4: Create API Router

Create a new router file in `backend/app/api/`:

```python
# backend/app/api/custom_features.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from ..db.session import get_db
from ..models import CustomFeature as CustomFeatureModel, Guild
from ..schemas import CustomFeature, CustomFeatureCreate
from .deps import get_current_user

router = APIRouter()

@router.get("/{guild_id}/features", response_model=List[CustomFeature])
async def list_features(
    guild_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List all custom features for a guild."""
    user_id = int(current_user["user_id"])
    
    # Check access
    guild = await db.get(Guild, guild_id)
    if not guild:
        raise HTTPException(status_code=404, detail="Guild not found")
    
    # Check if user has access (simplified, add proper checks)
    if guild.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Fetch features
    result = await db.execute(
        select(CustomFeatureModel)
        .where(CustomFeatureModel.guild_id == guild_id)
    )
    return result.scalars().all()

@router.post("/{guild_id}/features", response_model=CustomFeature)
async def create_feature(
    guild_id: int,
    feature: CustomFeatureCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new custom feature."""
    user_id = int(current_user["user_id"])
    
    # Check access
    guild = await db.get(Guild, guild_id)
    if not guild or guild.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Create feature
    new_feature = CustomFeatureModel(**feature.model_dump())
    db.add(new_feature)
    await db.commit()
    await db.refresh(new_feature)
    
    return new_feature

@router.delete("/{guild_id}/features/{feature_id}")
async def delete_feature(
    guild_id: int,
    feature_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete a custom feature."""
    user_id = int(current_user["user_id"])
    
    # Check access
    guild = await db.get(Guild, guild_id)
    if not guild or guild.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Find and delete feature
    feature = await db.get(CustomFeatureModel, feature_id)
    if not feature or feature.guild_id != guild_id:
        raise HTTPException(status_code=404, detail="Feature not found")
    
    await db.delete(feature)
    await db.commit()
    
    return {"message": "Feature deleted"}
```

## Step 5: Register the Router

Add your router to `backend/main.py`:

```python
from app.api.custom_features import router as custom_features_router

# Include in app
app.include_router(
    custom_features_router,
    prefix="/api/v1/guilds",
    tags=["custom_features"]
)
```

## Step 6: Restart Backend

```bash
make restart-backend
```

## Advanced Patterns

### Pagination

```python
from fastapi import Query

@router.get("/items")
async def list_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=100),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Item).offset(skip).limit(limit)
    )
    return result.scalars().all()
```

### Filtering

```python
from typing import Optional

@router.get("/items")
async def list_items(
    category: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Item)
    
    if category:
        query = query.where(Item.category == category)
    if status:
        query = query.where(Item.status == status)
    
    result = await db.execute(query)
    return result.scalars().all()
```

### Background Tasks

```python
from fastapi import BackgroundTasks

def send_notification(user_id: int, message: str):
    # Send notification logic
    pass

@router.post("/items")
async def create_item(
    item: ItemCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    new_item = Item(**item.model_dump())
    db.add(new_item)
    await db.commit()
    
    # Schedule background task
    background_tasks.add_task(send_notification, item.user_id, "Item created")
    
    return new_item
```

### File Uploads

```python
from fastapi import File, UploadFile

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    contents = await file.read()
    # Process file
    return {"filename": file.filename, "size": len(contents)}
```

## Testing Your Endpoint

### Using curl

```bash
# Get features
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8000/api/v1/guilds/123/features

# Create feature
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"guild_id": 123, "name": "test", "config": {}}' \
     http://localhost:8000/api/v1/guilds/123/features
```

### Using Interactive Docs

Visit http://localhost:8000/docs to test your endpoints interactively.

## Best Practices

1. **Use Dependency Injection**: Leverage FastAPI's DI system
2. **Validate Input**: Use Pydantic models
3. **Handle Errors**: Return appropriate HTTP status codes
4. **Add Documentation**: Use docstrings and OpenAPI descriptions
   ```python
   @router.get("/items", summary="List all items")
   async def list_items(
       limit: int = Query(10, description="Max items to return")
   ):
       """
       Retrieve a list of items.
       
       - **limit**: Maximum number of items (default: 10)
       """
       ...
   ```
5. **Use Async**: All database operations should be async
6. **Log Important Events**: Use structlog for logging
   ```python
   import structlog
   logger = structlog.get_logger()
   
   @router.post("/items")
   async def create_item(item: ItemCreate):
       logger.info("item_created", item_id=new_item.id, user_id=user_id)
       ...
   ```

## Next Steps

- See `docs/integration/05-frontend-pages.md` to consume your API
- Review existing routers in `backend/app/api/`
- Read [FastAPI documentation](https://fastapi.tiangolo.com/)
