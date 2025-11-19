import discord
from discord.ext import commands
import structlog
from services import BotServices

logger = structlog.get_logger()

class SimpleLLMCog(commands.Cog):
    def __init__(self, bot, services: BotServices):
        self.bot = bot
        self.services = services
        # For demo purposes, we might want to allow all users if TARGET_USER_ID is not set
        self.target_user_id = None
        # We can load this from config if needed, but for now let's assume it's passed or we check all
        
    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        # Ignore own messages
        if message.author == self.bot.user:
            return

        # Check if we should respond
        # If TARGET_USER_ID is set in env, check it. Otherwise, maybe respond to DMs or mentions?
        # User asked: "receives messages from a given userid"
        # Let's check an env var via services.config
        
        target_id = getattr(self.services.config, 'TARGET_USER_ID', None)
        
        should_respond = False
        if target_id:
            if str(message.author.id) == str(target_id):
                should_respond = True
        else:
            # Fallback: Respond if mentioned or in DM
            if self.bot.user in message.mentions or isinstance(message.channel, discord.DMChannel):
                should_respond = True

        if should_respond:
            async with message.channel.typing():
                logger.info("Generating response", user_id=message.author.id, content=message.content)
                response = await self.services.llm.generate_response(message.content)
                await message.reply(response)

async def setup(bot):
    # We need to retrieve services from the bot instance
    if not hasattr(bot, 'services'):
        logger.error("Bot has no services attached")
        return
    await bot.add_cog(SimpleLLMCog(bot, bot.services))
