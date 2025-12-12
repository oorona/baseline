# Baseline Bot Framework Guide

This guide explains how to develop a new bot using the Baseline Framework. The framework provides a robust foundation for multi-guild Discord bots with web management, sharding, and scale.

## Architecture Overview

1.  **Backend (FastAPI)**: Central API for managing guilds, settings, and auth.
2.  **Bot (Discord.py)**: The Discord bot instance (Scaleable, Sharded).
3.  **Frontend (Next.js)**: The web dashboard for users and developers.
4.  **Database (Postgres)**: Persistent data (Settings, Users).
5.  **Redis**: Cache and Pub/Sub for inter-service communication.

## Developing a New Bot (Adding Features)

Bots are composed of **Cogs** (Discord.py extensions). The framework handles loading, sharding, and settings.

### 1. Creating a Cog

Create a new file in `bot/cogs/`, e.g., `bot/cogs/moderation.py`.

> [!IMPORTANT]
> **Architecture Rule**: Before coding, read [PLUGIN_ARCHITECTURE.md](PLUGIN_ARCHITECTURE.md) to understand where your files should go and how to use the existing framework components.

```python
import discord
from discord.ext import commands
from services.guild_logger import GuildLogger

class ModerationCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        # Helper to get framework configs
        self.backend_url = "http://backend:8000/api/v1"
        self.logger = GuildLogger(
            guild_id=0, # Will be set per-context
            backend_url=self.backend_url,
            bot_token=self.bot.services.config.DISCORD_BOT_TOKEN
        )

    # ...
async def setup(bot):
    await bot.add_cog(ModerationCog(bot))
```

### 2. Standardized Logging (CRITICAL)

The framework is configured to allow developers to change the **Log Level** (DEBUG, INFO, ETC) per guild via the Developer Console.
Your logs MUST respect this setting. Use the `GuildLogger` service.

**Usage Pattern**:

```python
    @commands.Cog.listener()
    async def on_message(self, message):
        if not message.guild: return

        # 1. Instantiate Logger for this guild context
        guild_logger = GuildLogger(
            guild_id=message.guild.id,
            backend_url=self.backend_url,
            bot_token=self.bot.services.config.DISCORD_BOT_TOKEN
        )
        
        # 2. Log events (Debug level will only show if Developer enables it)
        await guild_logger.debug(f"Processing message {message.id}")
        
        # 3. Log important info
        await guild_logger.info("Message processed successfully")
```

### 3. Using Settings

Backend settings are stored as JSON blobs per guild.
To fetch/use settings:

```python
    async def get_settings(self, guild_id):
        # GuildLogger has a helper, or use direct API call
        # ...
```

## Frontend Integration

The Dashboard is designed to be pluggable.

### 1. Adding Settings

Edit `frontend/app/dashboard/[guildId]/settings/page.tsx`.
This file is a skeleton. Add your form fields inside the form.
The state `settings` is automatically loaded and saved to the backend.

```tsx
// Example: Adding a toggle
<input 
    type="checkbox"
    checked={settings?.my_feature_enabled || false}
    onChange={(e) => handleSettingChange('my_feature_enabled', e.target.checked)}
/>
```

### 2. Adding Navigation

To add new pages (e.g., `/dashboard/[guildId]/moderation`), update `frontend/app/components/Sidebar.tsx` (or use the plugin system in `frontend/app/plugins.ts`).

## Developer Tools

Navigate to `/dashboard/developer/logging` (Admin Only) to:
*   View all connected guilds.
*   Set the Log Level for specific guilds (useful for debugging your new features without spamming logs).
