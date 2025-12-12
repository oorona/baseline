import discord
from discord.ext import commands
import structlog
from services.guild_logger import GuildLogger

logger = structlog.get_logger()

class LoggingCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.backend_url = f"http://backend:8000/api/v1"

    async def get_settings(self, guild_id: int):
        try:
            # Determine if we can use the GuildLogger's internal cache or just fetch freshly
            # For simplicity, we'll use a helper or the GuildLogger itself to just get settings?
            # GuildLogger _get_settings is internal.
            # We'll rely on the bot services or just fetch it.
            # But wait, I can use the GuildLogger for LOGGING, but for retrieval of "logging_channel_id",
            # I need the raw settings.
            
            # Let's instantiate a logger to use its cache if possible, or just duplicate the fetch logic
            # for robustness (or add a public get_settings to GuildLogger).
            # For now, let's just use the GuildLogger to fetching settings via a new method if I add it,
            # or just simple fetch.
            
            # Re-implementing simple fetch for now to ensure it works
            headers = {"Authorization": f"Bot {self.bot.services.config.DISCORD_BOT_TOKEN}"}
            async with self.bot.session.get(f"{self.backend_url}/guilds/{guild_id}/settings", headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("settings", {})
                return {}
        except Exception as e:
            logger.error(f"Error fetching settings: {e}")
            return {}

    async def log_event(self, guild, embed, event_key):
        if not guild: return
        settings = await self.get_settings(guild.id)
        
        if not settings.get("logging_enabled"):
            return

        ignored = settings.get("logging_ignored_events", [])
        if event_key in ignored:
            return

        channel_id = settings.get("logging_channel_id")
        if not channel_id:
            return

        try:
            channel_id = int(channel_id)
            channel = guild.get_channel(channel_id)
            if channel:
                await channel.send(embed=embed)
        except Exception as e:
            logger.error(f"Failed to send log to channel {channel_id}: {e}")

    @commands.Cog.listener()
    async def on_message_delete(self, message):
        if message.author.bot: return
        embed = discord.Embed(title="Message Deleted", color=discord.Color.red())
        embed.add_field(name="Author", value=message.author.mention, inline=True)
        embed.add_field(name="Channel", value=message.channel.mention, inline=True)
        embed.add_field(name="Content", value=message.content or "No content (Embed/Image)", inline=False)
        embed.set_footer(text=f"ID: {message.id}")
        await self.log_event(message.guild, embed, "on_message_delete")

    @commands.Cog.listener()
    async def on_message_edit(self, before, after):
        if before.author.bot: return
        if before.content == after.content: return
        
        embed = discord.Embed(title="Message Edited", color=discord.Color.orange())
        embed.add_field(name="Author", value=before.author.mention, inline=True)
        embed.add_field(name="Channel", value=before.channel.mention, inline=True)
        embed.add_field(name="Before", value=before.content or "No content", inline=False)
        embed.add_field(name="After", value=after.content or "No content", inline=False)
        embed.set_footer(text=f"ID: {before.id}")
        await self.log_event(before.guild, embed, "on_message_edit")

    @commands.Cog.listener()
    async def on_member_join(self, member):
        embed = discord.Embed(title="Member Joined", color=discord.Color.green())
        embed.add_field(name="Member", value=member.mention, inline=True)
        embed.add_field(name="ID", value=member.id, inline=True)
        embed.set_thumbnail(url=member.display_avatar.url)
        await self.log_event(member.guild, embed, "on_member_join")

    @commands.Cog.listener()
    async def on_member_remove(self, member):
        embed = discord.Embed(title="Member Left", color=discord.Color.red())
        embed.add_field(name="Member", value=member.mention, inline=True)
        embed.add_field(name="ID", value=member.id, inline=True)
        embed.set_thumbnail(url=member.display_avatar.url)
        await self.log_event(member.guild, embed, "on_member_remove")

async def setup(bot):
    await bot.add_cog(LoggingCog(bot))
