# LLM Usage Guide

> [!IMPORTANT]
> This guide details how to use the implemented LLM capabilities in the `baseline` framework. These features are available to both the **Bot** (Python/discord.py) and the **Backend/Frontend** (FastAPI/Next.js/React).

## 1. Overview
 The framework provides a centralized `LLMService` that abstracts away provider differences (OpenAI, Anthropic, Google, xAI) and handles:
-   **Multi-Provider Support**: Switch models/providers via config or per-request.
-   **Usage Tracking**: Costs and tokens are automatically logged to the `llm_usage` table.
-   **Chat History**: Shared redis-backed history for multi-turn conversations.
-   **Unified API**: Same interface for Bot (Python) and Frontend (HTTP API).

## 2. Usage Contexts

### Context A: The Bot (`bot/cogs/*.py`)
Use the `LLMService` class directly within your cogs.

```python
# In your cog
from bot.services.llm import LLMService

class MyCog(commands.Cog):
    def __init__(self, bot):
        self.llm = bot.llm_service # The bot instance has the service initialized

    @commands.command()
    async def ask(self, ctx, *, question: str):
        # 1. Simple Text Generation
        response = await self.llm.chat(
            user_id=ctx.author.id,
            message=question,
            provider_name="openai",
            model="gpt-4o"
        )
        await ctx.send(response)
        
    @commands.command()
    async def analyze(self, ctx, *, text: str):
        # 2. Structured Output (JSON)
        schema = {
            "type": "object",
            "properties": {
                "sentiment": {"type": "string", "enum": ["positive", "negative"]},
                "score": {"type": "number"}
            }
        }
        # Note: You might need to use generate_structured directly if exposed, 
        # or prompt engineering manually with the chat method for now.
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
> [!NOTE]
> Native image generation is not yet fully exposed in the unified service but can be achieved by extending the provider.

**Recommended Pattern for Images**:
1.  **Request**: User sends prompt to backend.
2.  **Generate**: Backend calls provider (e.g., OpenAI DALL-E).
3.  **Save**:
    -   Receive usage `bytes` or `url`.
    -   Save `bytes` to `backend/static/images/` or Upload to S3.
    -   Return the public URL to the frontend.

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
