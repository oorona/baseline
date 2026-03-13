"""
╔═══════════════════════════════════════════════════════════════════════════════╗
║                           *** DEMO CODE ***                                   ║
║                                                                               ║
║  This file is DEMONSTRATION CODE for the Baseline Framework.                  ║
║  It showcases Gemini 3 API capabilities for developers building on this       ║
║  framework. You can:                                                          ║
║    - Use this as reference for implementing your own features                 ║
║    - Run these commands to test the Gemini integration                        ║
║    - Delete this file when deploying to production                            ║
║                                                                               ║
║  DO NOT include sensitive logic in demo files.                                ║
║                                                                               ║
║  Capabilities Demonstrated:                                                   ║
║    1. Text Generation with Thinking Levels                                    ║
║    2. Image Generation (Nano Banana)                                          ║
║    3. Image Understanding & Object Detection                                  ║
║    4. Text-to-Speech (TTS) Generation                                         ║
║    5. Audio Transcription & Understanding                                     ║
║    6. Embeddings Generation                                                   ║
║    7. Structured JSON Output                                                  ║
║    8. Function Calling                                                        ║
║    9. URL Context Grounding                                                   ║
║   10. Token Counting                                                          ║
║                                                                               ║
║  See: docs/GEMINI_CAPABILITIES.md for full documentation                      ║
╚═══════════════════════════════════════════════════════════════════════════════╝
"""

import io
import os
import base64
import asyncio
from typing import Optional, List, Dict, Any

import discord
from discord import app_commands
from discord.ext import commands
import structlog

# Import the enhanced Gemini service types
from services.gemini import (
    ThinkingLevel,
    GeminiModel,
    CapabilityType,
    ImageAspectRatio,
    EmbeddingTaskType,
    FunctionDeclaration,
    TTS_VOICES
)

logger = structlog.get_logger()


# ============================================================================
# *** DEMO CODE *** - Gemini Capabilities Demo Cog
# ============================================================================

class GeminiCapabilitiesDemo(commands.Cog):
    """
    *** DEMO COG ***

    This cog demonstrates all Gemini 3 API capabilities available in the
    Baseline Framework. Use these commands to test the integration and
    as reference for your own implementations.

    All commands are grouped under /gemini-demo
    """
    
    __is_demo__ = True

    # *** DEMO CODE *** - Configuration
    DEMO_COMMAND_GROUP = "gemini-demo"
    
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        # Access LLM service through bot.services
        self.llm_service = bot.services.llm
        logger.info("gemini_capabilities_demo_loaded", 
                    message="*** DEMO COG *** - Gemini Capabilities Demo loaded")
    
    # =========================================================================
    # *** DEMO CODE *** - Group Definition
    # =========================================================================
    
    gemini_demo = app_commands.Group(
        name="gemini-demo",
        description="Gemini 3 API capability demonstrations"
    )
    
    # =========================================================================
    # *** DEMO CODE *** - 1. Text Generation with Thinking
    # =========================================================================
    
    @gemini_demo.command(name="thinking", description="Generate text with adjustable thinking and reasoning depth")
    @app_commands.describe(
        prompt="The question or problem to solve",
        thinking_level="Depth of reasoning (minimal, low, medium, high)",
        show_thoughts="Show the model's thinking process"
    )
    @app_commands.choices(thinking_level=[
        app_commands.Choice(name="Minimal (fastest, Flash only)", value="minimal"),
        app_commands.Choice(name="Low (faster)", value="low"),
        app_commands.Choice(name="Medium (balanced, Flash only)", value="medium"),
        app_commands.Choice(name="High (most thorough)", value="high"),
    ])
    async def demo_thinking(
        self,
        interaction: discord.Interaction,
        prompt: str,
        thinking_level: str = "high",
        show_thoughts: bool = False
    ):
        """
        *** DEMO *** Generate text with Gemini 3 thinking/reasoning.
        
        Thinking levels control the depth of reasoning:
        - minimal: Near-zero thinking (Flash only)
        - low: Minimize latency and cost
        - medium: Balanced (Flash only)
        - high: Maximum reasoning (default)
        """
        await interaction.response.defer()
        
        try:
            level = ThinkingLevel(thinking_level)
            
            result = await self.llm_service.gemini_generate_with_thinking(
                prompt=prompt,
                thinking_level=level,
                include_thoughts=show_thoughts,
                guild_id=interaction.guild_id,
                user_id=interaction.user.id
            )
            
            # Build response embed
            embed = discord.Embed(
                title="🧠 Gemini Thinking Demo",
                color=discord.Color.blue()
            )
            embed.add_field(name="Thinking Level", value=thinking_level.upper(), inline=True)
            
            if result.usage:
                embed.add_field(
                    name="Tokens", 
                    value=f"In: {result.usage.prompt_tokens} | Out: {result.usage.completion_tokens} | Think: {result.usage.thoughts_tokens}",
                    inline=True
                )
                embed.add_field(
                    name="Cost", 
                    value=f"${result.usage.estimated_cost:.6f}",
                    inline=True
                )
            
            # Response text (truncate if needed)
            response_text = result.text or "No response generated"
            if len(response_text) > 4000:
                response_text = response_text[:4000] + "...[truncated]"
            embed.description = response_text
            
            # Add thoughts if requested
            if show_thoughts and result.thoughts_summary:
                thoughts = result.thoughts_summary[:1000] + "..." if len(result.thoughts_summary) > 1000 else result.thoughts_summary
                embed.add_field(
                    name="💭 Model's Thinking",
                    value=f"```\n{thoughts}\n```",
                    inline=False
                )
            
            embed.set_footer(text="*** DEMO CODE *** - See /gemini-demo for more capabilities")
            await interaction.followup.send(embed=embed)
            
        except Exception as e:
            logger.error("demo_thinking_error", error=str(e))
            await interaction.followup.send(f"❌ Error: {str(e)}")
    
    # =========================================================================
    # *** DEMO CODE *** - 2. Image Generation
    # =========================================================================
    
    @gemini_demo.command(name="generate-image", description="Generate images from a text description")
    @app_commands.describe(
        prompt="Description of the image to generate",
        aspect_ratio="Image aspect ratio"
    )
    @app_commands.choices(aspect_ratio=[
        app_commands.Choice(name="Square (1:1)", value="1:1"),
        app_commands.Choice(name="Portrait (9:16)", value="9:16"),
        app_commands.Choice(name="Landscape (16:9)", value="16:9"),
        app_commands.Choice(name="Portrait (3:4)", value="3:4"),
        app_commands.Choice(name="Landscape (4:3)", value="4:3"),
    ])
    async def demo_image_generation(
        self,
        interaction: discord.Interaction,
        prompt: str,
        aspect_ratio: str = "1:1"
    ):
        """
        *** DEMO *** Generate images using Gemini (Nano Banana).
        
        Supports various aspect ratios and can generate multiple images
        in a single request.
        """
        await interaction.response.defer()
        
        try:
            result = await self.llm_service.gemini_generate_image(
                prompt=prompt,
                aspect_ratio=aspect_ratio,
                guild_id=interaction.guild_id,
                user_id=interaction.user.id
            )
            
            if result.images:
                embed = discord.Embed(
                    title="🎨 Gemini Image Generation Demo",
                    description=f"**Prompt:** {prompt}",
                    color=discord.Color.purple()
                )
                embed.add_field(name="Aspect Ratio", value=aspect_ratio, inline=True)
                
                if result.usage:
                    embed.add_field(name="Cost", value=f"${result.usage.estimated_cost:.4f}", inline=True)
                
                embed.set_footer(text="*** DEMO CODE *** - Powered by Gemini Nano Banana")
                
                # Convert bytes to file
                files = []
                for i, img_bytes in enumerate(result.images):
                    files.append(discord.File(io.BytesIO(img_bytes), filename=f"generated_{i+1}.png"))
                
                await interaction.followup.send(embed=embed, files=files)
            else:
                # Sometimes the model returns text instead of images
                await interaction.followup.send(
                    f"📝 Model returned text instead of image:\n{result.text or 'No output'}"
                )
                
        except Exception as e:
            logger.error("demo_image_generation_error", error=str(e))
            await interaction.followup.send(f"❌ Error: {str(e)}")
    
    # =========================================================================
    # *** DEMO CODE *** - 3. Image Understanding
    # =========================================================================
    
    @gemini_demo.command(name="analyze-image", description="Analyze and answer questions about an image via URL")
    @app_commands.describe(
        image_url="URL of the image to analyze",
        question="Question about the image",
        detect_objects="Detect and locate objects with bounding boxes"
    )
    async def demo_image_understanding(
        self,
        interaction: discord.Interaction,
        image_url: str,
        question: str = "Describe this image in detail.",
        detect_objects: bool = False
    ):
        """
        *** DEMO *** Analyze images with Gemini vision.
        
        Can answer questions about images and optionally detect
        objects with bounding box coordinates.
        """
        await interaction.response.defer()
        
        try:
            result = await self.llm_service.gemini_understand_image(
                image=image_url,
                prompt=question,
                detect_objects=detect_objects,
                guild_id=interaction.guild_id,
                user_id=interaction.user.id
            )
            
            embed = discord.Embed(
                title="👁️ Gemini Image Analysis Demo",
                color=discord.Color.green()
            )
            embed.set_thumbnail(url=image_url)
            embed.add_field(name="Question", value=question, inline=False)
            
            response = result.text or "No analysis generated"
            if len(response) > 1024:
                response = response[:1021] + "..."
            embed.add_field(name="Analysis", value=response, inline=False)
            
            if detect_objects and result.structured_data:
                objects = str(result.structured_data)[:500]
                embed.add_field(name="Detected Objects", value=f"```json\n{objects}\n```", inline=False)
            
            if result.usage:
                embed.add_field(
                    name="Tokens",
                    value=f"In: {result.usage.prompt_tokens} | Out: {result.usage.completion_tokens}",
                    inline=True
                )
            
            embed.set_footer(text="*** DEMO CODE ***")
            await interaction.followup.send(embed=embed)
            
        except Exception as e:
            logger.error("demo_image_understanding_error", error=str(e))
            await interaction.followup.send(f"❌ Error: {str(e)}")
    
    # =========================================================================
    # *** DEMO CODE *** - 4. Text-to-Speech
    # =========================================================================
    
    @gemini_demo.command(name="speak", description="Convert text to speech audio using Gemini TTS")
    @app_commands.describe(
        text="Text to convert to speech",
        voice="Voice to use for speech"
    )
    @app_commands.choices(voice=[
        app_commands.Choice(name="Kore (warm, conversational)", value="Kore"),
        app_commands.Choice(name="Puck (energetic)", value="Puck"),
        app_commands.Choice(name="Zephyr (calm)", value="Zephyr"),
        app_commands.Choice(name="Charon (deep)", value="Charon"),
        app_commands.Choice(name="Fenrir (powerful)", value="Fenrir"),
        app_commands.Choice(name="Aoede (clear)", value="Aoede"),
    ])
    async def demo_tts(
        self,
        interaction: discord.Interaction,
        text: str,
        voice: str = "Kore"
    ):
        """
        *** DEMO *** Generate speech audio from text.
        
        Uses Gemini TTS with various voice options. The text can include
        style directions like "Say cheerfully: Hello!"
        """
        await interaction.response.defer()
        
        try:
            audio_bytes = await self.llm_service.gemini_generate_speech(
                text=text,
                voice=voice,
                guild_id=interaction.guild_id,
                user_id=interaction.user.id
            )
            
            embed = discord.Embed(
                title="🔊 Gemini Text-to-Speech Demo",
                description=f"**Text:** {text[:200]}{'...' if len(text) > 200 else ''}",
                color=discord.Color.orange()
            )
            embed.add_field(name="Voice", value=voice, inline=True)
            embed.set_footer(text="*** DEMO CODE ***")
            
            # Send audio as file
            audio_file = discord.File(io.BytesIO(audio_bytes), filename="speech.wav")
            await interaction.followup.send(embed=embed, file=audio_file)
            
        except Exception as e:
            logger.error("demo_tts_error", error=str(e))
            await interaction.followup.send(f"❌ Error: {str(e)}")
    
    # =========================================================================
    # *** DEMO CODE *** - 5. Structured Output (JSON Schema)
    # =========================================================================
    
    @gemini_demo.command(name="structured", description="Generate structured JSON output from a prompt")
    @app_commands.describe(
        prompt="What to generate (e.g., 'Create a recipe for chocolate cake')",
        output_type="Type of structured output"
    )
    @app_commands.choices(output_type=[
        app_commands.Choice(name="Recipe", value="recipe"),
        app_commands.Choice(name="Character Profile", value="character"),
        app_commands.Choice(name="Product Review", value="review"),
    ])
    async def demo_structured_output(
        self,
        interaction: discord.Interaction,
        prompt: str,
        output_type: str = "recipe"
    ):
        """
        *** DEMO *** Generate structured JSON output.
        
        Demonstrates how to get structured data from Gemini
        using JSON schemas.
        """
        await interaction.response.defer()
        
        # Define schemas for different output types
        schemas = {
            "recipe": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                    "prep_time_minutes": {"type": "integer"},
                    "cook_time_minutes": {"type": "integer"},
                    "servings": {"type": "integer"},
                    "ingredients": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "item": {"type": "string"},
                                "amount": {"type": "string"}
                            }
                        }
                    },
                    "instructions": {
                        "type": "array",
                        "items": {"type": "string"}
                    }
                },
                "required": ["name", "ingredients", "instructions"]
            },
            "character": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "age": {"type": "integer"},
                    "occupation": {"type": "string"},
                    "personality_traits": {
                        "type": "array",
                        "items": {"type": "string"}
                    },
                    "backstory": {"type": "string"},
                    "goals": {
                        "type": "array",
                        "items": {"type": "string"}
                    }
                },
                "required": ["name", "personality_traits"]
            },
            "review": {
                "type": "object",
                "properties": {
                    "product_name": {"type": "string"},
                    "rating": {"type": "number"},
                    "pros": {"type": "array", "items": {"type": "string"}},
                    "cons": {"type": "array", "items": {"type": "string"}},
                    "summary": {"type": "string"},
                    "would_recommend": {"type": "boolean"}
                },
                "required": ["product_name", "rating", "summary"]
            }
        }
        
        try:
            schema = schemas.get(output_type, schemas["recipe"])
            result = await self.llm_service.generate_structured(
                prompt=prompt,
                schema=schema
            )
            
            # Format JSON nicely
            import json
            formatted = json.dumps(result, indent=2)
            
            embed = discord.Embed(
                title="📋 Gemini Structured Output Demo",
                description=f"**Prompt:** {prompt}",
                color=discord.Color.gold()
            )
            embed.add_field(name="Output Type", value=output_type.title(), inline=True)
            
            # Truncate if needed
            if len(formatted) > 1000:
                formatted = formatted[:997] + "..."
            embed.add_field(name="Result", value=f"```json\n{formatted}\n```", inline=False)
            
            embed.set_footer(text="*** DEMO CODE ***")
            await interaction.followup.send(embed=embed)
            
        except Exception as e:
            logger.error("demo_structured_error", error=str(e))
            await interaction.followup.send(f"❌ Error: {str(e)}")
    
    # =========================================================================
    # *** DEMO CODE *** - 6. URL Context
    # =========================================================================
    
    @gemini_demo.command(name="analyze-url", description="Fetch and analyze web page content")
    @app_commands.describe(
        url="URL to analyze",
        question="Question about the URL content"
    )
    async def demo_url_context(
        self,
        interaction: discord.Interaction,
        url: str,
        question: str = "Summarize the main content of this page."
    ):
        """
        *** DEMO *** Analyze web content using URL context grounding.
        
        Gemini can fetch and analyze web pages to answer questions
        about their content.
        """
        await interaction.response.defer()
        
        try:
            result = await self.llm_service.gemini_generate_with_urls(
                prompt=f"{question}\n\nURL: {url}",
                urls=[url],
                guild_id=interaction.guild_id,
                user_id=interaction.user.id
            )
            
            embed = discord.Embed(
                title="🌐 Gemini URL Context Demo",
                color=discord.Color.teal()
            )
            embed.add_field(name="URL", value=url[:100], inline=False)
            embed.add_field(name="Question", value=question, inline=False)
            
            response = result.text or "No response generated"
            if len(response) > 1024:
                response = response[:1021] + "..."
            embed.add_field(name="Answer", value=response, inline=False)
            
            if result.usage:
                embed.add_field(
                    name="Cost",
                    value=f"${result.usage.estimated_cost:.6f}",
                    inline=True
                )
            
            embed.set_footer(text="*** DEMO CODE ***")
            await interaction.followup.send(embed=embed)
            
        except Exception as e:
            logger.error("demo_url_context_error", error=str(e))
            await interaction.followup.send(f"❌ Error: {str(e)}")
    
    # =========================================================================
    # *** DEMO CODE *** - 7. Token Counting
    # =========================================================================
    
    @gemini_demo.command(name="count-tokens", description="Count tokens in text and estimate API cost")
    @app_commands.describe(
        text="Text to count tokens for"
    )
    async def demo_token_count(
        self,
        interaction: discord.Interaction,
        text: str
    ):
        """
        *** DEMO *** Count tokens in text before sending.
        
        Useful for estimating costs and staying within context limits.
        """
        await interaction.response.defer()
        
        try:
            token_count = await self.llm_service.count_tokens(text)
            
            # Estimate costs for different models
            models = [
                ("Gemini 3 Flash", 0.50, 3.0),
                ("Gemini 3 Pro", 2.0, 12.0),
                ("Gemini 2.5 Flash", 0.075, 0.30),
            ]
            
            embed = discord.Embed(
                title="🔢 Gemini Token Counter Demo",
                description=f"**Text:** {text[:200]}{'...' if len(text) > 200 else ''}",
                color=discord.Color.blue()
            )
            embed.add_field(name="Token Count", value=f"`{token_count:,}` tokens", inline=False)
            
            # Cost estimates
            cost_text = ""
            for model_name, input_rate, output_rate in models:
                input_cost = (token_count / 1_000_000) * input_rate
                cost_text += f"**{model_name}:** ${input_cost:.6f} (input only)\n"
            embed.add_field(name="Estimated Input Costs", value=cost_text, inline=False)
            
            embed.set_footer(text="*** DEMO CODE *** - Costs are estimates per 1M tokens")
            await interaction.followup.send(embed=embed)
            
        except Exception as e:
            logger.error("demo_token_count_error", error=str(e))
            await interaction.followup.send(f"❌ Error: {str(e)}")
    
    # =========================================================================
    # *** DEMO CODE *** - 8. Embeddings
    # =========================================================================
    
    @gemini_demo.command(name="embed", description="Generate vector embeddings for text")
    @app_commands.describe(
        text="Text to generate embeddings for",
        task_type="Type of task for optimized embeddings"
    )
    @app_commands.choices(task_type=[
        app_commands.Choice(name="Semantic Similarity", value="SEMANTIC_SIMILARITY"),
        app_commands.Choice(name="Document Retrieval", value="RETRIEVAL_DOCUMENT"),
        app_commands.Choice(name="Query Retrieval", value="RETRIEVAL_QUERY"),
        app_commands.Choice(name="Classification", value="CLASSIFICATION"),
        app_commands.Choice(name="Clustering", value="CLUSTERING"),
    ])
    async def demo_embeddings(
        self,
        interaction: discord.Interaction,
        text: str,
        task_type: str = "SEMANTIC_SIMILARITY"
    ):
        """
        *** DEMO *** Generate text embeddings.
        
        Embeddings are vector representations useful for:
        - Semantic search
        - Similarity comparison
        - Classification
        - Clustering
        """
        await interaction.response.defer()
        
        try:
            embeddings = await self.llm_service.gemini_generate_embeddings(
                content=text,
                task_type=task_type,
                guild_id=interaction.guild_id,
                user_id=interaction.user.id
            )
            
            # Show first few dimensions
            preview = embeddings[:10] if len(embeddings) > 10 else embeddings
            preview_str = ", ".join([f"{v:.4f}" for v in preview])
            
            embed = discord.Embed(
                title="📊 Gemini Embeddings Demo",
                description=f"**Text:** {text[:200]}{'...' if len(text) > 200 else ''}",
                color=discord.Color.dark_blue()
            )
            embed.add_field(name="Task Type", value=task_type, inline=True)
            embed.add_field(name="Dimensions", value=f"`{len(embeddings)}`", inline=True)
            embed.add_field(
                name="Vector Preview (first 10)",
                value=f"```\n[{preview_str}, ...]\n```",
                inline=False
            )
            
            embed.set_footer(text="*** DEMO CODE *** - Full vector suitable for ML/search")
            await interaction.followup.send(embed=embed)
            
        except Exception as e:
            logger.error("demo_embeddings_error", error=str(e))
            await interaction.followup.send(f"❌ Error: {str(e)}")
    
    # =========================================================================
    # *** DEMO CODE *** - Help/Info Command
    # =========================================================================
    
    @gemini_demo.command(name="help", description="List all available Gemini demo commands")
    async def demo_help(self, interaction: discord.Interaction):
        """
        *** DEMO *** Show all available Gemini demo commands.
        """
        embed = discord.Embed(
            title="🤖 Gemini Capabilities Demo",
            description=(
                "This demo showcases all Gemini 3 API capabilities "
                "available in the Baseline Framework.\n\n"
                "**⚠️ This is demonstration code!**\n"
                "See `docs/GEMINI_CAPABILITIES.md` for implementation details."
            ),
            color=discord.Color.blue()
        )
        
        commands_info = [
            ("🧠 `/gemini-demo thinking`", "Generate with thinking/reasoning levels"),
            ("🎨 `/gemini-demo generate-image`", "Generate images (Nano Banana)"),
            ("👁️ `/gemini-demo analyze-image`", "Analyze and understand images"),
            ("🔊 `/gemini-demo speak`", "Text-to-speech generation"),
            ("📋 `/gemini-demo structured`", "Generate structured JSON output"),
            ("🌐 `/gemini-demo analyze-url`", "Analyze web content"),
            ("🔢 `/gemini-demo count-tokens`", "Count tokens & estimate costs"),
            ("📊 `/gemini-demo embed`", "Generate text embeddings"),
        ]
        
        for name, desc in commands_info:
            embed.add_field(name=name, value=desc, inline=False)
        
        embed.set_footer(text="*** DEMO CODE *** - Baseline Framework")
        await interaction.response.send_message(embed=embed)


# ============================================================================
# *** DEMO CODE *** - Cog Setup
# ============================================================================

async def setup(bot: commands.Bot):
    """
    *** DEMO CODE ***
    
    Load the Gemini Capabilities Demo cog.
    This cog can be safely removed in production deployments.
    """
    await bot.add_cog(GeminiCapabilitiesDemo(bot))
    logger.info("gemini_capabilities_demo_setup", 
                message="*** DEMO *** Gemini Capabilities Demo cog loaded")
