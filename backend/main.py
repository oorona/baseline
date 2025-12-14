from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import structlog
import asyncio
import uuid
import time
import json
import redis.asyncio as redis

from app.db.redis import redis_pool

# Generate unique ID for this instance
INSTANCE_ID = str(uuid.uuid4())[:8]
START_TIME = time.time()

async def send_heartbeats():
    client = redis.Redis(connection_pool=redis_pool)
    try:
        while True:
            try:
                data = {
                    "id": INSTANCE_ID,
                    "uptime": time.time() - START_TIME,
                    "timestamp": time.time()
                }
                # 30s TTL, update every 10s
                await client.setex(f"backend:heartbeat:{INSTANCE_ID}", 30, json.dumps(data))
            except Exception as e:
                print(f"Failed to send heartbeat: {e}")
            
            await asyncio.sleep(10)
    finally:
        await client.close()

from app.api.auth import router as auth_router
from app.api.guilds import router as guilds_router
from app.api.platform import router as platform_router
from app.api.shards import router as shards_router
from app.api.users import router as users_router
from app.core.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up Backend Instance", instance_id=INSTANCE_ID)
    
    # Start heartbeat task
    task = asyncio.create_task(send_heartbeats())
    
    # Log routes
    for route in app.routes:
        if hasattr(route, "methods"):
            logger.info(f"Route: {route.path} {route.methods}")
        else:
            logger.info(f"Route: {route.path}")
            
    yield
    
    # Shutdown
    logger.info("Shutting down Backend Instance", instance_id=INSTANCE_ID)
    task.cancel()
    try:
        await task

        # Remove heartbeat key immediately on clean shutdown
        import redis.asyncio as redis
        from app.db.redis import redis_pool
        client = redis.Redis(connection_pool=redis_pool)
        await client.delete(f"backend:heartbeat:{INSTANCE_ID}")
        await client.close()
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title=settings.PROJECT_NAME, 
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)
logger = structlog.get_logger()

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # Default for dev
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(guilds_router, prefix=f"{settings.API_V1_STR}/guilds", tags=["guilds"])
app.include_router(platform_router, prefix=f"{settings.API_V1_STR}/platform", tags=["platform"])
app.include_router(users_router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
app.include_router(shards_router, prefix=f"{settings.API_V1_STR}")

from app.api.bot_info import router as bot_info_router
app.include_router(bot_info_router, prefix=f"{settings.API_V1_STR}/bot", tags=["bot"])

from app.api.llm import router as llm_router
app.include_router(llm_router, prefix=f"{settings.API_V1_STR}/llm", tags=["llm"])


@app.get(f"{settings.API_V1_STR}/health")
async def health_check():
    return {"status": "ok", "service": "backend", "instance_id": INSTANCE_ID}
