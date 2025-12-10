# Loading Bot-Specific Configuration

This guide explains how to load and manage configuration specific to your custom bot.

## Overview

Configuration can come from multiple sources:
1. **Environment Variables**: System-level config
2. **Database (Guild Settings)**: Per-server configuration
3. **Config Files**: Static configuration files
4. **Secrets**: Sensitive data (API keys, tokens)

## Method 1: Environment Variables

Best for: Global bot configuration

```python
# bot/config.py
import os
from dataclasses import dataclass, field
from typing import List

@dataclass
class MyBotConfig:
    """Configuration for MyBot."""
    
    # Bot Identity
    bot_name: str = "MyBot"
    bot_version: str = "1.0.0"
    
    # Feature Flags
    enable_moderation: bool = True
    enable_custom_feature: bool = False
    
    # API Configuration
    external_api_url: str = "https://api.example.com"
    external_api_timeout: int = 30
    
    # Limits
    max_warnings_per_user: int = 3
    cooldown_seconds: int = 60
    
    @classmethod
    def from_env(cls):
        """Load configuration from environment variables."""
        return cls(
            bot_name=os.getenv("BOT_NAME", "MyBot"),
            bot_version=os.getenv("BOT_VERSION", "1.0.0"),
            enable_moderation=os.getenv("ENABLE_MODERATION", "true").lower() == "true",
            enable_custom_feature=os.getenv("ENABLE_CUSTOM_FEATURE", "false").lower() == "true",
            external_api_url=os.getenv("EXTERNAL_API_URL", "https://api.example.com"),
            external_api_timeout=int(os.getenv("EXTERNAL_API_TIMEOUT", "30")),
            max_warnings_per_user=int(os.getenv("MAX_WARNINGS_PER_USER", "3")),
            cooldown_seconds=int(os.getenv("COOLDOWN_SECONDS", "60"))
        )

# Load config at startup
config = MyBotConfig.from_env()
```

Use in your cogs:

```python
from bot.config import config

class MyCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.config = config
        
    @app_commands.command()
    async def status(self, interaction: discord.Interaction):
        await interaction.response.send_message(
            f"{self.config.bot_name} v{self.config.bot_version}\n"
            f"Moderation: {'Enabled' if self.config.enable_moderation else 'Disabled'}"
        )
```

## Method 2: Database (Guild Settings)

Best for: Per-server configuration that users can change

```python
import aiohttp
import structlog

logger = structlog.get_logger()

class MyCog(commands.Cog):
    async def get_guild_config(self, guild_id: int) -> dict:
        """Fetch guild-specific configuration from backend."""
        try:
            async with aiohttp.ClientSession() as session:
                url = f"http://backend:8000/api/v1/guilds/{guild_id}/settings"
                async with session.get(url) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data.get("settings", {})
        except Exception as e:
            logger.error("failed_to_fetch_guild_config", guild_id=guild_id, error=str(e))
        
        return {}  # Return empty dict as fallback
    
    @app_commands.command()
    async def configure_feature(self, interaction: discord.Interaction):
        # Get guild-specific settings
        guild_config = await self.get_guild_config(interaction.guild_id)
        
        # Use the settings
        custom_message = guild_config.get("custom_message", "Default message")
        await interaction.response.send_message(custom_message)
```

### Adding Custom Settings to Backend

1. Update the settings schema in `backend/app/schemas.py`:

```python
class GuildSettings(BaseModel):
    allowed_channels: list[str] = []
    system_prompt: Optional[str] = None
    model: Optional[str] = "openai"
    
    # Add your custom settings
    custom_message: Optional[str] = "Hello!"
    max_warnings: Optional[int] = 3
    banned_words: list[str] = []
```

2. Users can now update these via the frontend settings page

## Method 3: Config Files

Best for: Static configuration, presets, or complex nested config

```python
# bot/config/features.json
{
    "moderation": {
        "enabled": true,
        "auto_ban_threshold": 5,
        "warning_messages": [
            "First warning: Please follow the rules",
            "Second warning: This is your last warning",
            "Final warning: You will be banned next time"
        ]
    },
    "welcome": {
        "enabled": true,
        "message": "Welcome to {server_name}, {user_mention}!",
        "channel_id": null
    }
}
```

Load in your code:

```python
import json
from pathlib import Path

class ConfigLoader:
    @staticmethod
    def load_features_config() -> dict:
        """Load features configuration from JSON file."""
        config_path = Path(__file__).parent / "config" / "features.json"
        
        if config_path.exists():
            with open(config_path) as f:
                return json.load(f)
        
        return {}

# In your cog
class MyCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.features = ConfigLoader.load_features_config()
        
    @app_commands.command()
    async def check_moderation(self, interaction: discord.Interaction):
        mod_config = self.features.get("moderation", {})
        enabled = mod_config.get("enabled", False)
        
        await interaction.response.send_message(
            f"Moderation is {'enabled' if enabled else 'disabled'}"
        )
```

## Method 4: Secrets

Best for: API keys, tokens, passwords

```python
from pathlib import Path

class SecretManager:
    @staticmethod
    def read_secret(name: str) -> str:
        """Read a secret from Docker secrets or file."""
        # Try Docker secrets first
        secret_path = Path(f"/run/secrets/{name}")
        if secret_path.exists():
            return secret_path.read_text().strip()
        
        # Fallback to local secrets directory
        local_path = Path("secrets") / name
        if local_path.exists():
            return local_path.read_text().strip()
        
        # Fallback to environment variable
        import os
        return os.getenv(name.upper(), "")

# Usage
api_key = SecretManager.read_secret("my_api_key")
```

## Combining Multiple Sources

Create a unified configuration system:

```python
import os
import json
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional
import structlog

logger = structlog.get_logger()

@dataclass
class AppConfig:
    """Unified application configuration."""
    
    # From environment
    bot_name: str
    bot_version: str
    
    # From secrets
    api_key: str
    
    # From config file
    features: dict = field(default_factory=dict)
    
    @classmethod
    def load(cls):
        """Load configuration from all sources."""
        # Load from environment
        bot_name = os.getenv("BOT_NAME", "MyBot")
        bot_version = os.getenv("BOT_VERSION", "1.0.0")
        
        # Load from secrets
        api_key = cls._read_secret("my_api_key")
        
        # Load from file
        features = cls._load_features_config()
        
        logger.info(
            "config_loaded",
            bot_name=bot_name,
            version=bot_version,
            features_count=len(features)
        )
        
        return cls(
            bot_name=bot_name,
            bot_version=bot_version,
            api_key=api_key,
            features=features
        )
    
    @staticmethod
    def _read_secret(name: str) -> str:
        """Read secret from file or environment."""
        secret_path = Path(f"/run/secrets/{name}")
        if secret_path.exists():
            return secret_path.read_text().strip()
        return os.getenv(name.upper(), "")
    
    @staticmethod
    def _load_features_config() -> dict:
        """Load features configuration."""
        config_path = Path("bot/config/features.json")
        if config_path.exists():
            with open(config_path) as f:
                return json.load(f)
        return {}

# Initialize at startup
app_config = AppConfig.load()
```

## Per-Guild Configuration Cache

For better performance, cache guild settings:

```python
from typing import Dict, Optional
import aiohttp
import asyncio

class GuildConfigCache:
    def __init__(self):
        self._cache: Dict[int, dict] = {}
        self._ttl = 300  # 5 minutes
        
    async def get(self, guild_id: int) -> dict:
        """Get guild configuration (cached)."""
        # Check cache
        if guild_id in self._cache:
            return self._cache[guild_id]
        
        # Fetch from backend
        config = await self._fetch_from_backend(guild_id)
        
        # Cache it
        self._cache[guild_id] = config
        
        # Schedule cache invalidation
        asyncio.create_task(self._invalidate_after_ttl(guild_id))
        
        return config
    
    async def _fetch_from_backend(self, guild_id: int) -> dict:
        """Fetch configuration from backend API."""
        try:
            async with aiohttp.ClientSession() as session:
                url = f"http://backend:8000/api/v1/guilds/{guild_id}/settings"
                async with session.get(url) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data.get("settings", {})
        except Exception:
            pass
        return {}
    
    async def _invalidate_after_ttl(self, guild_id: int):
        """Remove from cache after TTL."""
        await asyncio.sleep(self._ttl)
        self._cache.pop(guild_id, None)
    
    def invalidate(self, guild_id: int):
        """Manually invalidate cache for a guild."""
        self._cache.pop(guild_id, None)

# Create global instance
guild_config_cache = GuildConfigCache()

# Use in cogs
class MyCog(commands.Cog):
    @app_commands.command()
    async def my_command(self, interaction: discord.Interaction):
        config = await guild_config_cache.get(interaction.guild_id)
        # Use config...
```

## Best Practices

1. **Validate Configuration**: Check required values at startup
2. **Provide Defaults**: Always have sensible fallback values
3. **Document Settings**: Keep a list of all configuration options
4. **Use Type Hints**: Make configuration type-safe
5. **Log Configuration**: Log loaded config (without secrets) at startup
6. **Hot Reload**: Consider reloading config without restart for some settings
7. **Environment-Specific**: Use different configs for dev/prod

## Example: Complete Configuration System

```python
# bot/core/config.py
import os
import json
from pathlib import Path
from dataclasses import dataclass
import structlog

logger = structlog.get_logger()

@dataclass
class BotConfiguration:
    """Complete bot configuration."""
    
    # Identity
    name: str = "MyBot"
    version: str = "1.0.0"
    
    # Features
    enable_moderation: bool = True
    enable_ai: bool = True
    
    # External APIs
    weather_api_key: str = ""
    news_api_key: str = ""
    
    # Limits
    max_message_length: int = 2000
    rate_limit_per_user: int = 5
    
    @classmethod
    def load_all(cls):
        """Load from all sources."""
        instance = cls()
        instance._load_from_env()
        instance._load_from_secrets()
        instance._validate()
        instance._log_config()
        return instance
    
    def _load_from_env(self):
        """Load from environment variables."""
        self.name = os.getenv("BOT_NAME", self.name)
        self.version = os.getenv("BOT_VERSION", self.version)
        self.enable_moderation = os.getenv("ENABLE_MODERATION", "true").lower() == "true"
        self.enable_ai = os.getenv("ENABLE_AI", "true").lower() == "true"
    
    def _load_from_secrets(self):
        """Load secrets."""
        self.weather_api_key = self._read_secret("weather_api_key")
        self.news_api_key = self._read_secret("news_api_key")
    
    def _read_secret(self, name: str) -> str:
        """Read a secret."""
        path = Path(f"/run/secrets/{name}")
        if path.exists():
            return path.read_text().strip()
        return os.getenv(name.upper(), "")
    
    def _validate(self):
        """Validate configuration."""
        if self.enable_ai and not self.weather_api_key:
            logger.warning("ai_enabled_but_no_api_key")
    
    def _log_config(self):
        """Log loaded configuration."""
        logger.info(
            "configuration_loaded",
            bot_name=self.name,
            version=self.version,
            moderation=self.enable_moderation,
            ai=self.enable_ai
        )

# Global config instance
config = BotConfiguration.load_all()
```

## Next Steps

- See `docs/integration/03-logging-environment.md` for environment variable details
- See `docs/ARCHITECTURE.md` for system design overview
