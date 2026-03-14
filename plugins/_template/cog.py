"""
my_plugin — Bot Cog
Staging template: replace all references to 'my_plugin' / 'MyPlugin'.
"""
import discord
from discord import app_commands
from discord.ext import commands


class MyPlugin(commands.Cog):
    """My Plugin cog — brief description."""

    # Declare settings fields that the dashboard Settings page will render automatically.
    # Remove this if the plugin has no configurable settings.
    SETTINGS_SCHEMA = {
        "enabled": {
            "type": "boolean",
            "label": "Enable My Plugin",
            "default": True,
        },
        "channel_id": {
            "type": "channel_select",
            "label": "Target Channel",
            "required": False,
        },
    }

    def __init__(self, bot: commands.Bot):
        self.bot = bot
        # Always reference the shared LLM service — never instantiate your own client.
        self.llm = bot.services.llm

    # ── Example slash command ────────────────────────────────────────────────

    @app_commands.command(
        name="my_command",
        description="Does something useful in this plugin.",
    )
    async def my_command(self, interaction: discord.Interaction, query: str):
        await interaction.response.defer()

        settings = await self._get_settings(interaction.guild_id)
        if not settings.get("enabled", True):
            await interaction.followup.send("This feature is disabled for your server.")
            return

        # Use the shared LLM service for inference.
        response = await self.llm.complete(
            prompt=query,
            system="You are a helpful assistant.",
        )
        await interaction.followup.send(response.text)

    # ── Settings helper ──────────────────────────────────────────────────────

    async def _get_settings(self, guild_id: int) -> dict:
        """Fetch guild settings from the backend using the shared session."""
        async with self.bot.session.get(
            f"http://backend:8000/api/v1/guilds/{guild_id}/settings",
            headers={
                "Authorization": f"Bot {self.bot.services.config.DISCORD_BOT_TOKEN}"
            },
        ) as resp:
            if resp.status == 200:
                return (await resp.json()).get("settings", {})
        return {}


async def setup(bot: commands.Bot):
    await bot.add_cog(MyPlugin(bot))
