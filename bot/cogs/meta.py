import discord
from discord import app_commands
from discord.ext import commands
import structlog
from typing import Optional

logger = structlog.get_logger()

class Meta(commands.Cog):
    """
    Meta commands for bot management.
    """
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="reload", description="Reloads a cog")
    @app_commands.describe(extension_name="The name of the extension to reload (e.g. cogs.simple_llm)")
    @app_commands.checks.has_permissions(administrator=True) # Or custom check for owner
    async def reload(self, interaction: discord.Interaction, extension_name: str):
        """
        Reloads a cog.
        """
        # Check if user is owner (manual check since is_owner is for prefix commands mostly, 
        # though app_commands has checks, simple owner check is safer for sensitive ops)
        if not await self.bot.is_owner(interaction.user):
             await interaction.response.send_message("❌ You do not have permission to use this command.", ephemeral=True)
             return

        try:
            await self.bot.reload_extension(extension_name)
            await interaction.response.send_message(f"✅ Reloaded `{extension_name}`", ephemeral=True)
            logger.info(f"Reloaded extension: {extension_name}", user_id=interaction.user.id)
        except Exception as e:
            await interaction.response.send_message(f"❌ Failed to reload `{extension_name}`: {e}", ephemeral=True)
            logger.error(f"Failed to reload extension {extension_name}: {e}")

    @app_commands.command(name="load", description="Loads a cog")
    @app_commands.describe(extension_name="The name of the extension to load")
    async def load(self, interaction: discord.Interaction, extension_name: str):
        """
        Loads a cog.
        """
        if not await self.bot.is_owner(interaction.user):
             await interaction.response.send_message("❌ You do not have permission to use this command.", ephemeral=True)
             return

        try:
            await self.bot.load_extension(extension_name)
            await interaction.response.send_message(f"✅ Loaded `{extension_name}`", ephemeral=True)
        except Exception as e:
            await interaction.response.send_message(f"❌ Failed to load `{extension_name}`: {e}", ephemeral=True)

    @app_commands.command(name="unload", description="Unloads a cog")
    @app_commands.describe(extension_name="The name of the extension to unload")
    async def unload(self, interaction: discord.Interaction, extension_name: str):
        """
        Unloads a cog.
        """
        if not await self.bot.is_owner(interaction.user):
             await interaction.response.send_message("❌ You do not have permission to use this command.", ephemeral=True)
             return

        try:
            await self.bot.unload_extension(extension_name)
            await interaction.response.send_message(f"✅ Unloaded `{extension_name}`", ephemeral=True)
        except Exception as e:
            await interaction.response.send_message(f"❌ Failed to unload `{extension_name}`: {e}", ephemeral=True)

async def setup(bot):
    await bot.add_cog(Meta(bot))
