# LLM Usage Guide

> [!IMPORTANT]
> This guide details how to use the implemented LLM capabilities in the `baseline` framework. These features are available to both the **Bot** (Python/discord.py) and the **Backend/Frontend** (FastAPI/Next.js/React).

## Quick Reference

| Capability | Provider Support | Documentation |
|------------|------------------|---------------|
| Text Generation | All providers | This guide |
| **Gemini 3 Advanced** | Google only | [GEMINI_CAPABILITIES.md](GEMINI_CAPABILITIES.md) |
| Image Generation | Google (Gemini 3) | [GEMINI_CAPABILITIES.md](GEMINI_CAPABILITIES.md) |
| Image Understanding | Google, OpenAI | [GEMINI_CAPABILITIES.md](GEMINI_CAPABILITIES.md) |
| Text-to-Speech | Google (Gemini) | [GEMINI_CAPABILITIES.md](GEMINI_CAPABILITIES.md) |
| Embeddings | Google, OpenAI | [GEMINI_CAPABILITIES.md](GEMINI_CAPABILITIES.md) |
| Structured Output | All providers | [GEMINI_CAPABILITIES.md](GEMINI_CAPABILITIES.md) |

> **For Gemini 3 specific features** (thinking levels, image generation, TTS, function calling, caching), see the dedicated **[Gemini Capabilities Guide](GEMINI_CAPABILITIES.md)**.

## 1. Overview
The framework provides a centralized `LLMService` that abstracts away provider differences (OpenAI, Anthropic, Google, xAI) and handles:
-   **Multi-Provider Support**: Switch models/providers via config or per-request.
-   **Usage Tracking**: Costs and tokens are **automatically** logged to the `llm_usage` table — do not add manual tracking on top of this.
-   **Chat History**: Shared Redis-backed history for multi-turn conversations.
-   **Unified API**: Same interface for Bot (Python) and Frontend (HTTP API).

> **Always pass `guild_id` and `user_id`** when calling LLM methods from a cog. Without them, usage appears as system/global cost instead of being attributed to the specific guild and user, which breaks the AI Analytics dashboard.
>
> ```python
> response = await self.bot.services.llm.chat(
>     message=question,
>     guild_id=interaction.guild_id,
>     user_id=interaction.user.id,
> )
> ```

## 2. Usage Contexts

### Context A: The Bot (`bot/cogs/*.py`)
Use the `LLMService` via `bot.services.llm` in any cog.

```python
# In your cog
import discord
from discord import app_commands
from discord.ext import commands

class MyCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.llm = bot.services.llm  # Always use bot.services.llm

    @app_commands.command(name="ask", description="Ask the AI a question")
    @app_commands.describe(question="Your question")
    async def ask(self, interaction: discord.Interaction, question: str):
        await interaction.response.defer()
        # Pass guild_id and user_id for automatic cost/usage attribution
        response = await self.llm.chat(
            message=question,
            guild_id=interaction.guild_id,
            user_id=interaction.user.id,
        )
        await interaction.followup.send(response)

    @app_commands.command(name="analyze", description="Analyze text sentiment")
    @app_commands.describe(text="Text to analyze")
    async def analyze(self, interaction: discord.Interaction, text: str):
        await interaction.response.defer()
        # Structured output via system prompt or generate_structured()
        response = await self.llm.chat(
            message=f"Analyze sentiment of: {text}",
            system_prompt='Output JSON: {"sentiment": "positive|negative", "score": 0.0-1.0}',
            guild_id=interaction.guild_id,
            user_id=interaction.user.id,
        )
        await interaction.followup.send(response)
```

### Context B: The Backend (`backend/app/api/*.py`)
Use the `get_llm_service` dependency.

```python
from fastapi import APIRouter, Depends
from app.api.deps import get_llm_service
from app.services.llm import LLMService

router = APIRouter()

@router.post("/analyze")
async def analyze_text(
    prompt: str,
    llm: LLMService = Depends(get_llm_service)
):
    # Use internal methods (requires db session for tracking)
    # ... implementation details
    pass
```

### Context C: The Frontend (`frontend/app/dashboard/*`)
Use the `apiClient` to call the backend LLM endpoints.

```typescript
import { apiClient } from '@/app/api-client';

async function handleAsk() {
    const response = await apiClient.chat({
        message: "Hello world",
        context_id: "unique-session-id", // Generate this UUID in frontend
        provider: "anthropic",
        model: "claude-3-opus-20240229"
    });
    console.log(response.content);
}
```

## 3. Advanced Features

### System Prompts
You can shape the bot's persona using `system_prompt`.
-   **API**: `generateText({ prompt: "...", system_prompt: "You are a pirate." })`
-   **Bot**: Passed as an argument to `generate_response`.

### Structured Output (JSON Schemas)
To get machine-readable output, define a JSON schema.

**Example Schema**:
```json
{
  "type": "object",
  "properties": {
    "summary": { "type": "string" },
    "tags": { "type": "array", "items": { "type": "string" } }
  }
}
```
*Implementation Tip*: Currently, `generate_structured_response` is available in the Python Service. For the HTTP API, you currently have to prompt engineer it via the `system_prompt` (e.g., "Output valid JSON matching this schema...") until a dedicated endpoint is added.

### Image Generation

Image generation is fully implemented via the Gemini service. Use `self.llm.generate_image()` in any cog:

```python
import io
import discord

result = await self.llm.generate_image(
    prompt="A futuristic city at sunset",
    guild_id=interaction.guild_id,
    user_id=interaction.user.id,
)
if result["images"]:
    file = discord.File(io.BytesIO(result["images"][0]), filename="generated.png")
    await interaction.followup.send(file=file)
```

See [GEMINI_CAPABILITIES.md](GEMINI_CAPABILITIES.md) for aspect ratio options, image editing, and composition.

**If you need to serve images via the backend**:
1.  Receive `bytes` from `generate_image()`.
2.  Save to `backend/static/images/` or upload to S3.
3.  Return the public URL to the frontend.

### saving Files (System Prompts, Schemas)
Do not hardcode large prompts.
1.  **Store**: Create a folder `bot/data/prompts/` or `backend/data/schemas/`.
2.  **Load**: Read the file at runtime.
    ```python
    with open("bot/data/prompts/judge.txt", "r") as f:
        system_prompt = f.read()
    ```

## 4. Multi-User/Context Chat
The new backend chat API supports **Context IDs**. 
-   **Standard**: `user_id` maps to one history.
-   **Context**: `context_id` (UUID) maps to a shared history.
-   **Multi-User**: Pass `name="Alice"` in the request so the LLM knows who is speaking in the shared context.

```typescript
// User A
apiClient.chat({ context_id: "room-1", message: "Hi", name: "Alice" });

// User B (Same Context)
apiClient.chat({ context_id: "room-1", message: "Hello Alice", name: "Bob" });
```
