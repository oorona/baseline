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
        # For structured output use generate_structured(); chat() returns plain str
        result = await self.llm.generate_structured(
            prompt=f"Analyze sentiment of: {text}",
            schema={"type": "object", "properties": {"sentiment": {"type": "string"}, "score": {"type": "number"}}},
            system_prompt='Output JSON: {"sentiment": "positive|negative", "score": 0.0-1.0}',
        )
        await interaction.followup.send(str(result))
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
You can shape the bot's persona by passing `system_prompt` to the provider's `generate_response()` method directly. Note that `LLMService.chat()` does **not** accept `system_prompt` — it uses Redis-backed multi-turn history without a custom system prompt. For single-turn calls with a custom system prompt, use the provider directly:

```python
provider = self.llm.providers.get("google") or next(iter(self.llm.providers.values()))
from bot.services.llm import LLMMessage
msgs = [LLMMessage(role="user", content=user_message)]
response = await provider.generate_response(msgs, system_prompt="You are a pirate.")
```

### Plugin Prompt Files

Plugins that make LLM calls with custom prompts declare them in `plugin.json`. The framework stores them on the shared data volume and serves them through the **LLM Configs → Plugin Prompts** dashboard. Admins can edit any prompt without restarting the bot.

**Directory layout on host:**
```
./data/prompts/
  {plugin_name}/
    manifest.json              ← written by the installer; never edit manually
    {context_name}/            ← purpose folder chosen by the plugin
      system_prompt.txt
      user_prompt.txt
```

The **context folder name** encodes **purpose**. The **file name** encodes **role** in the LLM call. These are two separate dimensions — never conflate them.

> **Wrong — purpose in the file name (flat layout):**
> ```
> ticketnode/
>   welcome.txt           ← ✗ purpose in file name
>   agent_system.txt      ← ✗ purpose in file name
>   agent_user.txt        ← ✗ purpose in file name
>   injection_system.txt  ← ✗ purpose in file name
> ```
>
> **Right — purpose in the folder, role in the file:**
> ```
> ticketnode/
>   welcome/
>     system_prompt.txt   ← ✓ role = system_prompt
>   ticket_agent/
>     system_prompt.txt   ← ✓
>     user_prompt.txt     ← ✓
>   injection_check/
>     system_prompt.txt   ← ✓
>     user_prompt.txt     ← ✓
> ```

Valid file names (the validator rejects anything else): `system_prompt`, `user_prompt`, `assistant_prompt`, `injection`, `context`.

One plugin can declare as many contexts as it needs.

**Declaring contexts in `plugin.json`:**

```json
{
  "components": { "prompts": true },
  "prompts": [
    {
      "context": "ticket_intake",
      "label": "Ticket Intake",
      "description": "Handles DM messages when a user opens a ticket.",
      "files": [
        {
          "name": "system_prompt",
          "label": "System Prompt",
          "description": "AI persona and rules for ticket intake.",
          "default": "You are a helpful ticket assistant. Be concise and friendly."
        },
        {
          "name": "user_prompt",
          "label": "User Prompt Template",
          "description": "Template for each user message. Use {message} and {username}.",
          "default": "{message}"
        }
      ]
    },
    {
      "context": "faq_answers",
      "label": "FAQ Answers",
      "description": "Answers frequently asked questions about the server.",
      "files": [
        {
          "name": "system_prompt",
          "label": "System Prompt",
          "description": "AI persona for FAQ responses.",
          "default": "You answer questions about this Discord server clearly and helpfully."
        }
      ]
    }
  ]
}
```

**Providing defaults:** Place `{file_name}.txt` files under `plugins/{name}/prompts/{context}/`. The installer copies them to `/data/prompts/{plugin_name}/{context}/`. If no source file exists, the `"default"` string from `plugin.json` is written as the initial content.

**Loading prompts in a cog:**

```python
class TicketNode(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.llm = bot.services.llm

    async def _process_dm(self, message):
        # load_prompt(plugin_name, context, file_name) → str or "" if missing
        system = self.llm.load_prompt("ticketnode", "ticket_intake", "system_prompt")
        user_tmpl = self.llm.load_prompt("ticketnode", "ticket_intake", "user_prompt")

        formatted = (user_tmpl or "{message}").format(
            message=message.content,
            username=message.author.display_name,
        )

        # chat() has no system_prompt — use provider.generate_response() directly
        provider = self.llm.providers.get("google") or next(iter(self.llm.providers.values()))
        from bot.services.llm import LLMMessage
        return await provider.generate_response(
            [LLMMessage(role="user", content=formatted)],
            system_prompt=system or "You are a helpful ticket assistant.",
        )
```

`load_prompt()` reads the file on each call (synchronous). Prompt edits in the dashboard take effect on the very next bot call — no restart required. If a file is missing it returns `""` — **always supply a fallback** in your cog.

**Dashboard:** Go to **LLM Configs → Plugin Prompts** (Developer access). The left panel shows plugins, their context folders (click to expand), and individual files. Clicking a file opens a full textarea editor with Save and Reset-to-default buttons.

**File paths on host:** `./data/prompts/{plugin_name}/{context}/{file_name}.txt` — plain text, editable outside the container with any editor.

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
import base64
import discord

# generate_image() returns List[str] of base64-encoded image bytes
images = await self.llm.generate_image(prompt="A futuristic city at sunset")
if images:
    file = discord.File(io.BytesIO(base64.b64decode(images[0])), filename="generated.png")
    await interaction.followup.send(file=file)
```

See [GEMINI_CAPABILITIES.md](GEMINI_CAPABILITIES.md) for aspect ratio options, image editing, and composition.

**If you need to serve images via the backend**:
1.  Receive `bytes` from `generate_image()`.
2.  Save to `backend/static/images/` or upload to S3.
3.  Return the public URL to the frontend.

### Storing Prompts as Files
Do not hardcode large prompts inline. Use the plugin prompt file system described above — it stores prompts on the shared data volume, makes them editable from the dashboard, and loads them with `self.llm.load_prompt(plugin_name, context, file_name)`. This replaces the old pattern of reading from `bot/data/prompts/` manually.

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
