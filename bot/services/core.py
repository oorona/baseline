import structlog
import os
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from redis.asyncio import Redis
from pydantic_settings import BaseSettings
from typing import Optional

logger = structlog.get_logger()

class Config(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    DISCORD_BOT_TOKEN: str
    OPENAI_API_KEY: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    XAI_API_KEY: Optional[str] = None
    TARGET_USER_ID: Optional[str] = None
    DISCORD_INTENTS: Optional[str] = None

class BotServices:
    def __init__(self):
        self._load_secrets()
        self.config = Config()
        # Ensure we use asyncpg driver
        db_url = self.config.DATABASE_URL
        if db_url.startswith("postgresql://"):
            db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        self.db_engine = create_async_engine(db_url)
        self.session_factory = async_sessionmaker(self.db_engine, expire_on_commit=False)
        self.redis = Redis.from_url(self.config.REDIS_URL)
        self.llm = None

    def _load_secrets(self):
        """Load secrets from files specified in _FILE environment variables."""
        for key, value in os.environ.items():
            if key.endswith('_FILE'):
                env_var = key[:-5]
                if env_var not in os.environ:
                    try:
                        with open(value, 'r') as f:
                            os.environ[env_var] = f.read().strip()
                        logger.info(f"Loaded secret {env_var} from {value}")
                    except Exception as e:
                        logger.warning(f"Failed to load secret from {value}: {e}")

    async def initialize(self):
        from .llm import LLMService
        self.llm = LLMService(self.config)
        logger.info("Services initialized")

    async def close(self):
        await self.db_engine.dispose()
        await self.redis.close()
