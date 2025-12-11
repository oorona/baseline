from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog

from app.api.auth import router as auth_router
from app.api.guilds import router as guilds_router
from app.api.platform import router as platform_router
from app.api.shards import router as shards_router
from app.api.users import router as users_router
from app.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME, openapi_url=f"{settings.API_V1_STR}/openapi.json")
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

@app.on_event("startup")
async def startup_event():
    for route in app.routes:
        if hasattr(route, "methods"):
            logger.info(f"Route: {route.path} {route.methods}")
        else:
            logger.info(f"Route: {route.path}")



@app.get(f"{settings.API_V1_STR}/health")
async def health_check():
    return {"status": "ok", "service": "backend"}
