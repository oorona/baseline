import discord
from discord import app_commands
from discord.ext import commands
import structlog
import time
import datetime
from typing import Optional

logger = structlog.get_logger()

class Status(commands.Cog):
    """
    Status command to show bot health and metrics.
    """
    def __init__(self, bot):
        self.bot = bot
        self.start_time = time.time()

    @app_commands.command(name="status", description="Show bot status and health")
    async def status(self, interaction: discord.Interaction):
        """
        Show bot status and health.
        """
        # Calculate uptime
        uptime_seconds = int(time.time() - self.start_time)
        uptime_str = str(datetime.timedelta(seconds=uptime_seconds))
        
        # Get guild count
        guild_count = len(self.bot.guilds)
        
        # Get shard info
        shard_id = interaction.guild.shard_id if interaction.guild else 0
        shard = self.bot.get_shard(shard_id)
        latency = round(shard.latency * 1000) if shard else 0
        
        # Create embed
        embed = discord.Embed(
            title="Bot Status",
            color=discord.Color.green(),
            timestamp=datetime.datetime.utcnow()
        )
        
        embed.add_field(name="Uptime", value=uptime_str, inline=True)
        embed.add_field(name="Guilds", value=str(guild_count), inline=True)
        embed.add_field(name="Shard ID", value=str(shard_id), inline=True)
        embed.add_field(name="Latency", value=f"{latency}ms", inline=True)
        
        # Service Health (Mocked for now, or check actual services if possible)
        # We can check self.bot.services.redis.ping() but it's async
        
        redis_status = "🟢 Online"
        try:
            await self.bot.services.redis.ping()
        except Exception:
            redis_status = "🔴 Offline"
            
        embed.add_field(name="Redis", value=redis_status, inline=True)
        
        # Database check?
        # db_status = "🟢 Online"
        # try:
        #     # Simple query
        #     pass
        # except Exception:
        #     db_status = "🔴 Offline"
            
        # embed.add_field(name="Database", value=db_status, inline=True)
        
        await interaction.response.send_message(embed=embed, ephemeral=True)

async def setup(bot):
    await bot.add_cog(Status(bot))
