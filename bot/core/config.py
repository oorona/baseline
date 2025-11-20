from typing import Optional, List
from pydantic_settings import BaseSettings

class BotConfig(BaseSettings):
    """
    Configuration for the Discord bot.
    Reads from environment variables.
    """
    DISCORD_BOT_TOKEN: str
    DISCORD_BOT_PREFIX: str = "!"
    DISCORD_OWNER_ID: Optional[int] = None
    DISCORD_GUILD_ID: Optional[int] = None # Main development guild
    
    # Database & Redis
    POSTGRES_USER: str = "baseline"
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str = "baseline"
    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432
    
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    
    class Config:
        env_file = ".env"
        extra = "ignore"

config = BotConfig()
