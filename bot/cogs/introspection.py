import discord
from discord.ext import commands
import structlog
import aiohttp
import time

logger = structlog.get_logger()

class IntrospectionCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.backend_url = "http://backend:8000/api/v1"

    @commands.Cog.listener()
    async def on_ready(self):
        logger.info("IntrospectionCog: Gathering bot info...")
        await self.report_bot_info()

    async def report_bot_info(self):
        # 1. Collect Commands
        commands_list = []
        for cmd in self.bot.tree.get_commands():
            commands_list.append({
                "name": cmd.name,
                "description": cmd.description,
                "type": "Slash Command"
            })
        
        # 2. Collect Listeners
        listeners_list = []
        # Default listeners
        listeners_list.append({"event": "on_ready", "cog": "Bot"})
        # Cog listeners
        for cog_name, cog in self.bot.cogs.items():
            for listener in cog.get_listeners():
                # listener is a tuple (name, function)
                listeners_list.append({
                    "event": listener[0],
                    "cog": cog_name
                })
        
        # 3. Collect Permissions (Example from first guild)
        permissions_data = {}
        if self.bot.guilds:
            guild = self.bot.guilds[0]
            perms = guild.me.guild_permissions
            # Create a dict of True permissions
            for perm, value in perms:
                if value:
                    permissions_data[perm] = True
        
        # Add Intents info
        intents_data = {}
        for intent, value in self.bot.intents:
            if value:
                intents_data[intent] = True

        report_payload = {
            "commands": commands_list,
            "listeners": listeners_list,
            "permissions": {
                "guild_permissions_example": permissions_data,
                "intents": intents_data
            },
            "timestamp": time.time()
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(f"{self.backend_url}/bot/report", json=report_payload) as resp:
                    if resp.status == 200:
                        logger.info("Successfully reported bot info to backend")
                    else:
                        logger.error("Failed to report bot info", status=resp.status)
        except Exception as e:
            logger.error("Error reporting bot info", error=str(e))

async def setup(bot):
    await bot.add_cog(IntrospectionCog(bot))
