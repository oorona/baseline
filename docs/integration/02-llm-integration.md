# Using LLM Integration

This guide explains how to use the built-in LLM service in your bot commands.

## Overview

The baseline framework includes an LLM service that supports multiple providers:
- OpenAI (GPT-4)
- Anthropic (Claude)
- Google (Gemini)
- xAI (Grok)

## Accessing the LLM Service

The LLM service is available via `self.bot.services.llm` in any cog:

```python
class MyCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        
    @app_commands.command()
    async def ask(self, interaction: discord.Interaction, question: str):
        # Defer response for long-running LLM calls
        await interaction.response.defer()
        
        # Use the LLM service
        response = await self.bot.services.llm.chat(
            message=question,
            model="openai"  # optional, uses guild settings by default
        )
        
        await interaction.followup.send(response)
```

##  Basic Usage

### Simple Chat

```python
@app_commands.command()
async def chat(self, interaction: discord.Interaction, prompt: str):
    await interaction.response.defer()
    
    # Simple chat call
    response = await self.bot.services.llm.chat(prompt)
    
    await interaction.followup.send(response)
```

### With System Prompt

```python
@app_commands.command()
async def translate(self, interaction: discord.Interaction, text: str):
    await interaction.response.defer()
    
    # Use a custom system prompt
    response = await self.bot.services.llm.chat(
        message=f"Translate to Spanish: {text}",
        system_prompt="You are a professional translator."
    )
    
    await interaction.followup.send(response)
```

### Choose Provider

```python
@app_commands.command()
async def analyze(
    self,
    interaction: discord.Interaction,
    text: str,
    provider: str = "anthropic"
):
    await interaction.response.defer()
    
    response = await self.bot.services.llm.chat(
        message=f"Analyze this text: {text}",
        model=provider
    )
    
    await interaction.followup.send(response)
```

## Using Guild Settings

The bot automatically fetches guild-specific settings from the backend:

```python
@app_commands.command()
async def smart_reply(self, interaction: discord.Interaction, message: str):
    await interaction.response.defer()
    
    # Get guild settings from backend
    async with aiohttp.ClientSession() as session:
        url = f"http://backend:8000/api/v1/guilds/{interaction.guild_id}/settings"
        async with session.get(url) as resp:
            if resp.status == 200:
                data = await resp.json()
                settings = data.get("settings", {})
                
                # Use guild's configured model and system prompt
                response = await self.bot.services.llm.chat(
                    message=message,
                    model=settings.get("model", "openai"),
                    system_prompt=settings.get("system_prompt")
                )
                
                await interaction.followup.send(response)
```

## Adding Context from Chat History

```python
@app_commands.command()
async def continue_chat(self, interaction: discord.Interaction):
    await interaction.response.defer()
    
    # Get recent messages from channel
    messages = []
    async for msg in interaction.channel.history(limit=10):
        if not msg.author.bot:
            messages.append(f"{msg.author.name}: {msg.content}")
    
    # Build context
    context = "\n".join(reversed(messages))
    
    response = await self.bot.services.llm.chat(
        message="Continue this conversation naturally",
        system_prompt=f"Previous conversation:\n{context}"
    )
    
    await interaction.followup.send(response)
```

## Error Handling

Always handle LLM errors gracefully:

```python
import structlog

logger = structlog.get_logger()

@app_commands.command()
async def ask(self, interaction: discord.Interaction, question: str):
    await interaction.response.defer()
    
    try:
        response = await self.bot.services.llm.chat(question)
        await interaction.followup.send(response)
    except Exception as e:
        logger.error("llm_error", error=str(e), command="ask")
        await interaction.followup.send(
            "Sorry, I encountered an error processing your request.",
            ephemeral=True
        )
```

## Streaming Responses (Advanced)

For long responses, you can stream the output:

```python
@app_commands.command()
async def long_answer(self, interaction: discord.Interaction, topic: str):
    await interaction.response.defer()
    
    # Send initial message
    msg = await interaction.followup.send("Thinking...")
    
    # Stream response
    full_response = ""
    chunk_size = 0
    
    async for chunk in self.bot.services.llm.chat_stream(
        message=f"Write a detailed explanation about {topic}"
    ):
        full_response += chunk
        chunk_size += len(chunk)
        
        # Update message every 100 characters
        if chunk_size >= 100:
            await msg.edit(content=full_response[:2000])  # Discord limit
            chunk_size = 0
    
    # Final update
    if len(full_response) > 2000:
        # Split into multiple messages
        for i in range(0, len(full_response), 2000):
            await interaction.followup.send(full_response[i:i+2000])
    else:
        await msg.edit(content=full_response)
```

## Configuration

### API Keys

Set API keys in the `secrets/` directory:
- `secrets/openai_api_key`
- `secrets/anthropic_api_key`
- `secrets/google_api_key`
- `secrets/xai_api_key`

### Environment Variables

Configure defaults in `.env`:
```bash
DEFAULT_LLM_PROVIDER=openai
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=2000
```

## Best Practices

1. **Always Defer**: LLM calls take time, always defer the interaction
2. **Handle Errors**: Network and API issues are common
3. **Respect Limits**: Stay within Discord's message size limits (2000 chars)
4. **Use Ephemeral**: For sensitive or personal responses
5. **Add Cooldowns**: Prevent spam with command cooldowns
   ```python
   from discord.ext import commands
   
   @app_commands.command()
   @commands.cooldown(1, 30, commands.BucketType.user)  # 1 use per 30s per user
   async def ask(self, interaction, question):
       ...
   ```

6. **Log Usage**: Track API usage for billing and debugging
   ```python
   logger.info(
       "llm_request",
       user=interaction.user.id,
       guild=interaction.guild_id,
       model=model,
       tokens=len(response)  # approximate
   )
   ```

## Example: Complete AI Assistant Cog

```python
import discord
from discord import app_commands
from discord.ext import commands
import aiohttp
import structlog

logger = structlog.get_logger()

class AIAssistant(commands.Cog):
    """AI-powered assistant commands."""
    
    def __init__(self, bot):
        self.bot = bot
        
    @app_commands.command(name="ask", description="Ask the AI a question")
    @app_commands.describe(question="Your question")
    @commands.cooldown(1, 15, commands.BucketType.user)
    async def ask(self, interaction: discord.Interaction, question: str):
        """Ask a question to the AI."""
        await interaction.response.defer()
        
        try:
            # Get guild settings
            async with aiohttp.ClientSession() as session:
                url = f"http://backend:8000/api/v1/guilds/{interaction.guild_id}/settings"
                async with session.get(url) as resp:
                    settings = {}
                    if resp.status == 200:
                        data = await resp.json()
                        settings = data.get("settings", {})
            
            # Call LLM
            response = await self.bot.services.llm.chat(
                message=question,
                model=settings.get("model", "openai"),
                system_prompt=settings.get("system_prompt")
            )
            
            # Log usage
            logger.info(
                "ai_ask",
                user=interaction.user.id,
                guild=interaction.guild_id,
                question_length=len(question),
                response_length=len(response)
            )
            
            # Send response
            if len(response) > 2000:
                # Split long responses
                await interaction.followup.send(response[:2000])
                await interaction.followup.send(response[2000:4000])
            else:
                await interaction.followup.send(response)
                
        except Exception as e:
            logger.error("ai_ask_failed", error=str(e))
            await interaction.followup.send(
                "I encountered an error. Please try again later.",
                ephemeral=True
            )

async def setup(bot):
    await bot.add_cog(AIAssistant(bot))
```

## Next Steps

- See `docs/integration/01-adding-cogs.md` for cog basics
- See `docs/integration/03-logging-environment.md` for logging best practices
- Review `bot/cogs/chat.py` for a complete working example
