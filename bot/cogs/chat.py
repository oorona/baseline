import discord
from discord import app_commands
from discord.ext import commands
import structlog
import aiohttp
from typing import Optional, Literal

logger = structlog.get_logger()

class Chat(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="chat", description="Chat with an LLM (OpenAI, Anthropic, Google, xAI)")
    @app_commands.describe(
        message="The message to send",
        provider="The LLM provider to use",
        model="Specific model to use (e.g., gpt-4, claude-3-opus, gemini-1.5-flash)"
    )
    async def chat(
        self, 
        interaction: discord.Interaction, 
        message: str, 
        provider: Optional[Literal["openai", "anthropic", "google", "xai"]] = None,
        model: Optional[str] = None
    ):
        await interaction.response.defer(thinking=True)
        
        user_id = interaction.user.id
        guild_id = interaction.guild_id
        channel_id = str(interaction.channel_id)
        
        # Default settings
        system_prompt = None
        target_provider = provider or "openai"
        
        # Fetch guild settings if in a guild
        if guild_id:
            try:
                # TODO: Cache this to avoid API call on every message
                async with aiohttp.ClientSession() as session:
                    async with session.get(f"http://backend:8000/api/v1/guilds/{guild_id}/settings") as resp: # Internal URL
                        if resp.status == 200:
                            data = await resp.json()
                            settings = data.get("settings", {})
                            
                            # Check allowed channels
                            allowed_channels = settings.get("allowed_channels", [])
                            if allowed_channels and channel_id not in allowed_channels:
                                await interaction.followup.send("I am not allowed to chat in this channel.", ephemeral=True)
                                return

                            # Apply system prompt
                            if settings.get("system_prompt"):
                                system_prompt = settings.get("system_prompt")
                                # Inject context immediately for this turn (or we could persist it)
                                # For now, let's prepend it to the message or use a specific method if LLM service supports it
                                # simpler approach: prepend to message for this request if no history context
                                # But better: use inject_context logic or pass as separate arg to chat()
                                pass 

                            # Apply default model/provider if not specified
                            if not provider and settings.get("model"):
                                # Map model name to provider if possible, or just pass model
                                # The current chat signature takes provider and model.
                                # If settings.model is "openai", "anthropic", etc (provider names from UI)
                                if settings.get("model") in ["openai", "anthropic", "google", "xai"]:
                                    target_provider = settings.get("model")
                                else:
                                    # It might be a specific model name, we'd need to know the provider
                                    # For now UI sends provider names as 'model'
                                    target_provider = settings.get("model")

            except Exception as e:
                logger.error("failed_to_fetch_settings", error=str(e))
        
        try:
            # Inject system prompt if exists (temporary way, ideally LLM service handles system prompt)
            if system_prompt:
                 await self.bot.services.llm.inject_context(user_id, f"System Instruction: {system_prompt}")

            # 1. Generate Response
            response = await self.bot.services.llm.chat(user_id, message, target_provider, model)
            
            # 2. Send Response (handle long messages)
            if len(response) > 2000:
                # Split into chunks if needed, for now just send first 2000 or file
                # Simple chunking
                chunks = [response[i:i+2000] for i in range(0, len(response), 2000)]
                for chunk in chunks:
                    await interaction.followup.send(chunk)
            else:
                await interaction.followup.send(response)
            
            # 3. Background Analysis (Fire and forget)
            # We use asyncio.create_task to run it in background without blocking
            self.bot.loop.create_task(
                self.bot.services.analysis.analyze_background(user_id, message)
            )
            
        except Exception as e:
            logger.error("chat_command_failed", error=str(e))
            await interaction.followup.send(f"An error occurred: {str(e)}", ephemeral=True)

    @app_commands.command(name="context", description="Inject context into your chat history")
    @app_commands.describe(context="The context/system message to inject")
    async def context(self, interaction: discord.Interaction, context: str):
        await interaction.response.defer(ephemeral=True)
        try:
            await self.bot.services.llm.inject_context(interaction.user.id, context)
            await interaction.followup.send(f"Context injected: '{context}'", ephemeral=True)
        except Exception as e:
            await interaction.followup.send(f"Failed to inject context: {str(e)}", ephemeral=True)

    @app_commands.command(name="models", description="List available LLM models")
    async def models(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        try:
            models = await self.bot.services.llm.get_available_models()
            
            embed = discord.Embed(title="Available LLM Models", color=discord.Color.blue())
            
            for provider, model_list in models.items():
                if not model_list:
                    continue

                # Chunking logic to respect Discord's 1024 char limit per field
                current_chunk = []
                current_length = 0
                chunk_index = 1
                
                for model in model_list:
                    model_str = f"`{model}`"
                    # +1 for newline
                    if current_length + len(model_str) + 1 > 1000: # Safety margin
                        name = f"{provider.capitalize()} (Part {chunk_index})"
                        embed.add_field(name=name, value="\n".join(current_chunk), inline=False)
                        current_chunk = []
                        current_length = 0
                        chunk_index += 1
                    
                    current_chunk.append(model_str)
                    current_length += len(model_str) + 1
                
                if current_chunk:
                    name = provider.capitalize() if chunk_index == 1 else f"{provider.capitalize()} (Part {chunk_index})"
                    embed.add_field(name=name, value="\n".join(current_chunk), inline=False)
            
            await interaction.followup.send(embed=embed, ephemeral=True)
        except Exception as e:
            logger.error("models_command_failed", error=str(e))
            await interaction.followup.send(f"Failed to list models: {str(e)}", ephemeral=True)

async def setup(bot):
    await bot.add_cog(Chat(bot))
