# Adding New Bot Cogs

This guide explains how to add new commands and functionality to the Discord bot by creating custom cogs.

## What is a Cog?

A cog is a modular extension that contains related commands and event listeners. Cogs allow you to organize bot functionality into logical groups.

## Step 1: Create a New Cog File

Create a new Python file in `bot/cogs/` directory:

```bash
# Example: creating a moderation cog
touch bot/cogs/moderation.py
```

## Step 2: Define Your Cog Class

```python
import discord
from discord import app_commands
from discord.ext import commands

class Moderation(commands.Cog):
    """Moderation commands for server management."""
    
    def __init__(self, bot):
        self.bot = bot
        
    @app_commands.command(name="kick", description="Kick a user from the server")
    @app_commands.describe(member="The member to kick", reason="Reason for kick")
    async def kick(
        self,
        interaction: discord.Interaction,
        member: discord.Member,
        reason: str = "No reason provided"
    ):
        """Kick a member from the server."""
        # Check permissions
        if not interaction.user.guild_permissions.kick_members:
            await interaction.response.send_message(
                "You don't have permission to kick members.",
                ephemeral=True
            )
            return
            
        # Perform the kick
        await member.kick(reason=reason)
        await interaction.response.send_message(
            f"Kicked {member.mention} - Reason: {reason}"
        )

# Required: setup function
async def setup(bot):
    await bot.add_cog(Moderation(bot))
```

## Step 3: Register the Cog

The bot automatically loads all cogs from the `bot/cogs/` directory. Just ensure your file:
1. Is in the `bot/cogs/` directory
2. Has an `async def setup(bot)` function
3. Calls `await bot.add_cog(YourCog(bot))`

## Step 4: Access Bot Services

Your cog can access various services through `self.bot.services`:

```python
class MyCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        
    @app_commands.command()
    async def example(self, interaction: discord.Interaction):
        # Access LLM service
        response = await self.bot.services.llm.chat("Hello!")
        
        # Access database
        # (if you add a database service)
        # data = await self.bot.services.db.query(...)
        
        # Access shard monitor
        status = self.bot.services.shard_monitor.get_status()
```

## Step 5: Environment Variables

Access environment variables safely:

```python
import os

class MyCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        # Get from environment
        self.api_key = os.getenv("MY_API_KEY", "default_value")
        
        # Or from bot config
        # self.config = self.bot.config
```

## Step 6: Logging

Use structured logging in your cog:

```python
import structlog

logger = structlog.get_logger()

class MyCog(commands.Cog):
    @app_commands.command()
    async def example(self, interaction: discord.Interaction):
        logger.info(
            "command_executed",
            command="example",
            user=interaction.user.id,
            guild=interaction.guild_id
        )
```

## Step 7: Restart the Bot

After creating your cog, restart the bot:

```bash
make restart-bot
# or
docker compose restart bot
```

## Best Practices

1. **Error Handling**: Always handle errors gracefully
   ```python
   try:
       # your code
   except Exception as e:
       logger.error("command_failed", error=str(e))
       await interaction.response.send_message("An error occurred!", ephemeral=True)
   ```

2. **Permission Checks**: Verify permissions before sensitive operations
3. **Defer Responses**: For long-running commands, defer the interaction
   ```python
   await interaction.response.defer()
   # ... long operation
   await interaction.followup.send("Done!")
   ```

4. **Use Ephemeral Messages**: For errors or sensitive info
   ```python
   await interaction.response.send_message("Error!", ephemeral=True)
   ```

## Example: Complete Working Cog

```python
import discord
from discord import app_commands
from discord.ext import commands
import structlog

logger = structlog.get_logger()

class Example(commands.Cog):
    """Example cog with various features."""
    
    def __init__(self, bot):
        self.bot = bot
        logger.info("cog_loaded", cog="Example")
        
    @app_commands.command(name="hello", description="Say hello")
    async def hello(self, interaction: discord.Interaction):
        """Simple greeting command."""
        await interaction.response.send_message(
            f"Hello, {interaction.user.mention}!"
        )
    
    @app_commands.command(name="info", description="Get server info")
    async def info(self, interaction: discord.Interaction):
        """Get information about the server."""
        guild = interaction.guild
        
        embed = discord.Embed(
            title=f"{guild.name} Info",
            color=discord.Color.blue()
        )
        embed.add_field(name="Members", value=guild.member_count)
        embed.add_field(name="Channels", value=len(guild.channels))
        embed.add_field(name="Roles", value=len(guild.roles))
        
        await interaction.response.send_message(embed=embed)
    
    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        """Event listener for when a member joins."""
        logger.info("member_joined", user=member.id, guild=member.guild.id)

async def setup(bot):
    await bot.add_cog(Example(bot))
```

## Next Steps

- Review existing cogs in `bot/cogs/` for more examples
- Read [Discord.py documentation](https://discordpy.readthedocs.io/)
- See `docs/integration/llm-integration.md` for using AI features
