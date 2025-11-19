import asyncio
import os
import structlog
import discord
from discord.ext import commands
from aiohttp import web
from services import BotServices

logger = structlog.get_logger()

class BaselineBot(commands.AutoShardedBot):
    def __init__(self):
        self.services = BotServices()
        
        # Configure intents
        intents = discord.Intents.default()
        # Always enable message content for this bot as it's core functionality
        intents.message_content = True
        
        # Parse additional intents from config
        if self.services.config.DISCORD_INTENTS:
            requested_intents = [i.strip() for i in self.services.config.DISCORD_INTENTS.split(',')]
            for intent_name in requested_intents:
                if hasattr(intents, intent_name):
                    setattr(intents, intent_name, True)
                    logger.info(f"Enabled intent: {intent_name}")
                else:
                    logger.warning(f"Unknown intent requested: {intent_name}")

        super().__init__(command_prefix="!", intents=intents)

    async def setup_hook(self):
        await self.services.initialize()
        # Load cogs
        await self.load_extension("cogs.simple_llm")
        logger.info("Cogs loaded")

    async def close(self):
        await self.services.close()
        await super().close()

    async def on_ready(self):
        logger.info("Bot is ready", user=self.user.name, id=self.user.id)

# Health check server
async def health_check(request):
    return web.json_response({"status": "ok", "service": "bot"})

async def start_health_server():
    app = web.Application()
    app.router.add_get('/health', health_check)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', 8080)
    await site.start()
    logger.info("Health check server started on port 8080")

async def main():
    # Start health check server
    await start_health_server()
    
    # Start Bot
    bot = BaselineBot()
    
    token = bot.services.config.DISCORD_BOT_TOKEN
    if not token or token == "dummy_bot_token":
        logger.warning("No valid Discord token found. Bot will not connect to Discord.")
        # Keep alive for container health check if token is missing (dev mode)
        while True:
            await asyncio.sleep(3600)
    else:
        async with bot:
            await bot.start(token)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
