"""
event_logging — Bot Cog
Listens to guild events and posts structured embeds to a configured log channel.
Settings (enabled, channel, ignored events) are managed via the dashboard Settings page,
which auto-renders a form from SETTINGS_SCHEMA — no frontend code needed here.
"""

import discord
import structlog
from discord.ext import commands

logger = structlog.get_logger()


class EventLoggingCog(commands.Cog):
    """Posts guild events (message edits/deletes, member joins/leaves) to a log channel."""

    SETTINGS_SCHEMA = {
        "id": "event_logging",
        "label": "Event Logging",
        "description": "Configure which guild events are logged and where.",
        "fields": [
            {
                "key": "logging_enabled",
                "type": "boolean",
                "label": "Enable Event Logging",
                "default": False,
            },
            {
                "key": "logging_channel_id",
                "type": "channel_select",
                "label": "Log Channel",
                "description": "Channel where audit events are posted.",
                "default": None,
            },
            {
                "key": "logging_ignored_events",
                "type": "multiselect",
                "label": "Ignored Events",
                "description": "Events that will NOT be logged.",
                "choices": [
                    {"label": "Message Deleted", "value": "on_message_delete"},
                    {"label": "Message Edited",  "value": "on_message_edit"},
                    {"label": "Member Joined",   "value": "on_member_join"},
                    {"label": "Member Left",     "value": "on_member_remove"},
                ],
                "default": [],
            },
        ],
    }

    def __init__(self, bot: commands.Bot):
        self.bot = bot

    # ── Settings helper ──────────────────────────────────────────────────────

    async def _get_settings(self, guild_id: int) -> dict:
        """Fetch guild settings from the backend using the shared aiohttp session."""
        headers = {
            "Authorization": f"Bot {self.bot.services.config.DISCORD_BOT_TOKEN}"
        }
        try:
            async with self.bot.session.get(
                f"http://backend:8000/api/v1/guilds/{guild_id}/settings",
                headers=headers,
            ) as resp:
                if resp.status == 200:
                    return (await resp.json()).get("settings", {})
        except Exception as exc:
            logger.error("event_logging.settings_fetch_failed", guild_id=guild_id, error=str(exc))
        return {}

    # ── Event dispatcher ─────────────────────────────────────────────────────

    async def _dispatch(self, guild: discord.Guild, embed: discord.Embed, event_key: str):
        """Check settings and send an embed to the configured log channel."""
        if not guild:
            return

        settings = await self._get_settings(guild.id)

        if not settings.get("logging_enabled"):
            return

        ignored = settings.get("logging_ignored_events", [])
        if event_key in ignored:
            return

        channel_id = settings.get("logging_channel_id")
        if not channel_id:
            return

        try:
            channel = guild.get_channel(int(channel_id))
            if channel:
                await channel.send(embed=embed)
        except Exception as exc:
            logger.error(
                "event_logging.send_failed",
                guild_id=guild.id,
                channel_id=channel_id,
                event=event_key,
                error=str(exc),
            )

    # ── Discord event listeners ───────────────────────────────────────────────

    @commands.Cog.listener()
    async def on_message_delete(self, message: discord.Message):
        if message.author.bot:
            return
        embed = discord.Embed(title="Message Deleted", color=discord.Color.red())
        embed.add_field(name="Author",  value=message.author.mention, inline=True)
        embed.add_field(name="Channel", value=message.channel.mention, inline=True)
        embed.add_field(
            name="Content",
            value=message.content or "_No text content (embed or attachment)_",
            inline=False,
        )
        embed.set_footer(text=f"Message ID: {message.id}")
        await self._dispatch(message.guild, embed, "on_message_delete")

    @commands.Cog.listener()
    async def on_message_edit(self, before: discord.Message, after: discord.Message):
        if before.author.bot or before.content == after.content:
            return
        embed = discord.Embed(title="Message Edited", color=discord.Color.orange())
        embed.add_field(name="Author",  value=before.author.mention, inline=True)
        embed.add_field(name="Channel", value=before.channel.mention, inline=True)
        embed.add_field(name="Before",  value=before.content or "_empty_", inline=False)
        embed.add_field(name="After",   value=after.content  or "_empty_", inline=False)
        embed.set_footer(text=f"Message ID: {before.id}")
        await self._dispatch(before.guild, embed, "on_message_edit")

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        embed = discord.Embed(title="Member Joined", color=discord.Color.green())
        embed.add_field(name="Member", value=member.mention, inline=True)
        embed.add_field(name="ID",     value=str(member.id), inline=True)
        embed.set_thumbnail(url=member.display_avatar.url)
        await self._dispatch(member.guild, embed, "on_member_join")

    @commands.Cog.listener()
    async def on_member_remove(self, member: discord.Member):
        embed = discord.Embed(title="Member Left", color=discord.Color.red())
        embed.add_field(name="Member", value=str(member),    inline=True)
        embed.add_field(name="ID",     value=str(member.id), inline=True)
        embed.set_thumbnail(url=member.display_avatar.url)
        await self._dispatch(member.guild, embed, "on_member_remove")


async def setup(bot: commands.Bot):
    await bot.add_cog(EventLoggingCog(bot))
