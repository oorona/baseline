from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import structlog
import asyncio
import uuid
import time
import json
import re
import subprocess
import os
import redis.asyncio as redis

from app.core.encrypted_settings import is_setup_complete
from app.db.redis import redis_pool

# ── Structlog — JSON renderer for Loki compatibility ──────────────────────────
_SERVICE = "backend"
_ENV = os.getenv("ENVIRONMENT", "production")

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(0),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)
# Bind service-level fields so every log line carries them for Loki label extraction
structlog.contextvars.bind_contextvars(service=_SERVICE, env=_ENV)

# ── Setup-mode flag ───────────────────────────────────────────────────────────
# Computed once at startup.  When True only /setup/* and /health endpoints work.
SETUP_MODE: bool = not is_setup_complete()

if SETUP_MODE:
    print(
        "\n" + "=" * 70 + "\n"
        "  WIZARD MODE — no encrypted settings file found.\n"
        "  Only /api/v1/setup/* and /api/v1/health are available.\n"
        "  Open the web UI and follow the setup wizard to configure the app.\n"
        + "=" * 70 + "\n"
    )


def run_alembic_migrations():
    """Run Alembic database migrations on startup."""
    import os
    
    # Load secrets from _FILE environment variables before running migrations
    for key, value in os.environ.items():
        if key.endswith("_FILE"):
            env_var = key[:-5]
            try:
                with open(value, "r") as f:
                    os.environ[env_var] = f.read().strip()
            except Exception as e:
                print(f"Failed to load secret {env_var}: {e}")
    
    # Map POSTGRES_PASSWORD to DB_PASSWORD for alembic
    if "POSTGRES_PASSWORD" in os.environ:
        os.environ["DB_PASSWORD"] = os.environ["POSTGRES_PASSWORD"]
    
    try:
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
            cwd="/app"
        )
        if result.returncode == 0:
            print(f"Alembic migrations completed successfully:\n{result.stdout}")
        else:
            print(f"Alembic migration warning (may be normal if DB is up to date):\n{result.stderr}")
            # Don't fail startup on migration issues - tables might already exist
    except Exception as e:
        print(f"Failed to run Alembic migrations: {e}")

# Generate unique ID for this instance
INSTANCE_ID = str(uuid.uuid4())[:8]
START_TIME = time.time()

async def send_heartbeats():
    if redis_pool is None:
        return
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
    app.state.setup_mode = SETUP_MODE
    logger.info("Starting up Backend Instance", instance_id=INSTANCE_ID, setup_mode=SETUP_MODE)

    # Only run migrations when the app is properly configured
    if not SETUP_MODE:
        logger.info("Running Alembic database migrations...")
        run_alembic_migrations()
    
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

# Rate Limiting
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.limiter import limiter

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

logger = structlog.get_logger()

# ==============================================================================
# Security Middleware for Sensitive Endpoints
# ==============================================================================
# Ensures that Gemini/LLM endpoints are only accessible through trusted sources
# (gateway, internal Docker network, or local development)

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from app.core.security import is_trusted_request, get_client_info, log_security_event

SENSITIVE_PREFIXES = ["/api/v1/llm"]

class SecurityMiddleware(BaseHTTPMiddleware):
    """
    Middleware to enforce network-level security for sensitive endpoints.

    Sensitive endpoints (Gemini, LLM) require requests to come from:
    1. The nginx gateway (X-Gateway-Request header)
    2. Internal Docker network IPs (172.x.x.x, 192.168.x.x, etc.)
    3. Localhost (for development)

    This provides defense-in-depth beyond authentication and rate limiting.
    """

    async def dispatch(self, request, call_next):
        path = request.url.path

        # ── Wizard-mode gate ─────────────────────────────────────────────────
        # When no settings file exists, block every endpoint except setup/*
        # and health so the wizard can always be reached.
        if SETUP_MODE:
            WIZARD_ALLOWED = (
                f"{settings.API_V1_STR}/setup",
                f"{settings.API_V1_STR}/health",
            )
            if not any(path.startswith(p) for p in WIZARD_ALLOWED):
                return JSONResponse(
                    status_code=503,
                    content={
                        "detail": "Platform not configured. Complete the setup wizard first.",
                        "setup_required": True,
                        "setup_url": "/setup",
                    },
                )

        # ── Sensitive-endpoint gate ───────────────────────────────────────────
        is_sensitive = any(path.startswith(prefix) for prefix in SENSITIVE_PREFIXES)
        if is_sensitive:
            if not is_trusted_request(request):
                client_info = get_client_info(request)
                logger.warning(
                    "blocked_untrusted_access",
                    endpoint=path,
                    reason="Request did not originate from trusted source",
                    **client_info,
                )
                return JSONResponse(
                    status_code=403,
                    content={
                        "detail": "Access denied. This endpoint requires internal network access.",
                        "code": "NETWORK_ACCESS_DENIED",
                    },
                )

        return await call_next(request)


# ==============================================================================
# Metrics Middleware — records per-request latency for Prometheus + DB
# ==============================================================================

# Paths excluded from metric recording to keep noise low
_METRICS_SKIP = {
    f"{settings.API_V1_STR}/health",
    f"{settings.API_V1_STR}/metrics",
}
_METRICS_SKIP_PREFIX = f"{settings.API_V1_STR}/setup"

# Regex to normalise dynamic path segments (UUIDs, snowflake IDs, integers)
_ID_RE = re.compile(r"/\d{6,}|/[0-9a-f]{8}-[0-9a-f-]{27}")


def _normalise_path(path: str) -> str:
    return _ID_RE.sub("/:id", path)


class MetricsMiddleware(BaseHTTPMiddleware):
    """Records HTTP request latency to Prometheus and the request_metrics DB table."""

    async def dispatch(self, request, call_next):
        path = request.url.path
        if path in _METRICS_SKIP or path.startswith(_METRICS_SKIP_PREFIX):
            return await call_next(request)

        start = time.monotonic()
        response = await call_next(request)
        duration_s = time.monotonic() - start
        duration_ms = duration_s * 1000

        method = request.method
        norm_path = _normalise_path(path)
        status = str(response.status_code)

        # Prometheus (synchronous, always safe)
        from app.api.prom_metrics import http_requests_total, http_request_duration_seconds
        http_requests_total.labels(method=method, path=norm_path, status=status).inc()
        http_request_duration_seconds.labels(method=method, path=norm_path).observe(duration_s)

        # DB write (fire-and-forget; skip if DB is not yet configured)
        if not SETUP_MODE:
            asyncio.create_task(_write_request_metric(norm_path, method, response.status_code, duration_ms))

        return response


async def _write_request_metric(path: str, method: str, status_code: int, duration_ms: float):
    """Fire-and-forget coroutine — writes one RequestMetrics row."""
    try:
        from app.db.session import AsyncSessionLocal
        from app.models import RequestMetrics
        if AsyncSessionLocal is None:
            return
        async with AsyncSessionLocal() as session:
            session.add(RequestMetrics(path=path, method=method, status_code=status_code, duration_ms=duration_ms))
            await session.commit()
    except Exception:
        pass  # Never let metric recording crash the request


# Add metrics middleware (runs BEFORE security middleware)
app.add_middleware(MetricsMiddleware)

# Add security middleware (runs BEFORE other middleware)
app.add_middleware(SecurityMiddleware)

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
        allow_headers=["Authorization", "Content-Type", "Set-Cookie", "Access-Control-Allow-Headers", "Access-Control-Allow-Origin"],
    )
else:
    # Default for dev
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
        allow_headers=["Authorization", "Content-Type", "Set-Cookie", "Access-Control-Allow-Headers", "Access-Control-Allow-Origin"],
    )

app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(guilds_router, prefix=f"{settings.API_V1_STR}/guilds", tags=["guilds"])
app.include_router(platform_router, prefix=f"{settings.API_V1_STR}/platform", tags=["platform"])
app.include_router(users_router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
app.include_router(shards_router, prefix=f"{settings.API_V1_STR}")

from app.api.bot_info import router as bot_info_router
app.include_router(bot_info_router, prefix=f"{settings.API_V1_STR}/bot-info", tags=["bot"])

# Instrumentation — card clicks, bot commands, guild events, stats, Prometheus metrics
from app.api.instrumentation import router as instrumentation_router
app.include_router(instrumentation_router, prefix=f"{settings.API_V1_STR}/instrumentation", tags=["instrumentation"])

from app.api.llm import router as llm_router
app.include_router(llm_router, prefix=f"{settings.API_V1_STR}/llm", tags=["llm"])

# System configuration (Level 5 — Platform Admin only)
from app.api.config import router as config_router
app.include_router(config_router, prefix=f"{settings.API_V1_STR}/config", tags=["config"])

# Database management (Level 5 — Platform Admin only)
from app.api.database_mgmt import router as db_mgmt_router
app.include_router(db_mgmt_router, prefix=f"{settings.API_V1_STR}/database", tags=["database"])

# Bot command reference (GET = public, POST /refresh = admin only)
from app.api.commands import router as commands_router
app.include_router(commands_router, prefix=f"{settings.API_V1_STR}/commands", tags=["commands"])

# Setup wizard — always registered (needed in wizard mode)
from app.api.setup import router as setup_router
app.include_router(setup_router, prefix=f"{settings.API_V1_STR}/setup", tags=["setup"])


@app.get(f"{settings.API_V1_STR}/health")
async def health_check():
    return {
        "status": "ok",
        "service": "backend",
        "instance_id": INSTANCE_ID,
        "setup_mode": SETUP_MODE,
        "configured": settings.is_configured,
    }
