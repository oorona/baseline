import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Baseline Bot Platform API"
    API_V1_STR: str = "/api/v1"
    
    BACKEND_CORS_ORIGINS: list[str] = []

    # Database configuration
    DB_HOST: str
    DB_PORT: int = 5432
    DB_USER: str
    DB_NAME: str
    DB_PASSWORD: Optional[str] = None  # Loaded from secret
    
    # Redis configuration
    REDIS_HOST: str
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: Optional[str] = None
    
    DISCORD_CLIENT_ID: Optional[str] = None
    DISCORD_CLIENT_SECRET: Optional[str] = None
    DISCORD_BOT_TOKEN: Optional[str] = None
    DISCORD_REDIRECT_URI: Optional[str] = None
    FRONTEND_URL: str = "http://localhost:3000"
    ADMIN_USER_IDS: Optional[str] = None
    
    SECRET_KEY: str = "development_secret_key" # Change in production
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 1 week
    
    @property
    def DATABASE_URL(self) -> str:
        """Construct DATABASE_URL from components"""
        password = self.DB_PASSWORD or ""
        password_part = f":{password}" if password else ""
        return f"postgresql://{self.DB_USER}{password_part}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    @property
    def REDIS_URL(self) -> str:
        """Construct REDIS_URL from components"""
        password_part = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"redis://{password_part}{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    class Config:
        case_sensitive = True
        env_file = ".env"

def load_secrets():
    """
    Load secrets from files if the environment variable ends with _FILE.
    This is useful for Docker secrets.
    """
    for key, value in os.environ.items():
        if key.endswith("_FILE"):
            env_var = key[:-5]  # Remove _FILE
            try:
                with open(value, "r") as f:
                    secret_value = f.read().strip()
                os.environ[env_var] = secret_value
            except Exception as e:
                print(f"Failed to load secret {env_var} from {value}: {e}")
    
    # Map POSTGRES_PASSWORD to DB_PASSWORD
    if "POSTGRES_PASSWORD" in os.environ:
        os.environ["DB_PASSWORD"] = os.environ["POSTGRES_PASSWORD"]

# Load secrets before initializing settings
load_secrets()
settings = Settings()
