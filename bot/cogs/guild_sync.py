import discord
from discord.ext import commands
import structlog
import aiohttp
from services import BotServices

logger = structlog.get_logger()

class GuildSyncCog(commands.Cog):
    def __init__(self, bot, services: BotServices):
        self.bot = bot
        self.services = services
        self.backend_url = "http://backend:8000/api/v1"

    @commands.Cog.listener()
    async def on_guild_join(self, guild: discord.Guild):
        logger.info("Joined new guild", guild_id=guild.id, name=guild.name)
        await self.sync_guild(guild)

    @commands.Cog.listener()
    async def on_guild_remove(self, guild: discord.Guild):
        logger.info("Removed from guild", guild_id=guild.id, name=guild.name)
        # Ideally we mark it as inactive, but for now we just log
        # We could add an endpoint to mark inactive if needed

    async def sync_guild(self, guild: discord.Guild):
        payload = {
            "id": guild.id,
            "name": guild.name,
            "icon_url": str(guild.icon.url) if guild.icon else None,
            "owner_id": guild.owner_id
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(f"{self.backend_url}/guilds/", json=payload) as resp:
                    if resp.status == 200:
                        logger.info("Synced guild to backend", guild_id=guild.id)
                    else:
                        logger.error("Failed to sync guild", guild_id=guild.id, status=resp.status)
        except Exception as e:
            logger.error("Error syncing guild", guild_id=guild.id, error=str(e))

    @commands.Cog.listener()
    async def on_ready(self):
        # Sync all guilds on startup
        logger.info("Syncing all guilds...")
        for guild in self.bot.guilds:
            await self.sync_guild(guild)

async def setup(bot):
    if not hasattr(bot, 'services'):
        logger.error("Bot has no services attached")
        return
    await bot.add_cog(GuildSyncCog(bot, bot.services))
