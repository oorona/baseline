# Baseline Discord Bot Framework - AI Agent Instructions

## Architecture Overview

This is a **Discord bot framework** with three components running in Docker:
- **Backend** (FastAPI + PostgreSQL + Redis): API, auth, database @ `backend/`
- **Bot** (discord.py, auto-sharded): Discord commands via Cogs @ `bot/`  
- **Frontend** (Next.js 14 + TypeScript): Web dashboard @ `frontend/`

Traffic flows: `Internet → nginx Gateway → Backend ← Bot/Frontend (intranet)`

## Critical Patterns

### Bot Cogs (Adding Discord Commands)
Cogs auto-load from `bot/cogs/`. Every cog needs the `setup` function:

```python
# bot/cogs/my_feature.py
from discord import app_commands
from discord.ext import commands

class MyFeature(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.llm = bot.services.llm  # Access LLM service
        
    @app_commands.command(name="mycommand")
    async def my_command(self, interaction):
        await interaction.response.defer()
        # ... command logic
        await interaction.followup.send("Done")

async def setup(bot):
    await bot.add_cog(MyFeature(bot))
```

Access services via `self.bot.services` (llm, redis, config, db).

### Frontend Pages (Adding Dashboard Pages)
Pages use a **6-tier permission system**. Wrap with `withPermission`:

```tsx
// frontend/app/dashboard/[guildId]/my-page/page.tsx
'use client';
import { withPermission } from '@/lib/components/with-permission';
import { PermissionLevel } from '@/lib/permissions';

function MyPage() { return <div>Content</div>; }
export default withPermission(MyPage, PermissionLevel.AUTHORIZED);
```

**Permission Levels:** 0=Public, 1=PublicData, 2=User(login), 3=Authorized, 4=Owner, 5=Developer

### Backend API Routes
Add routers in `backend/app/api/`. Use `Depends(get_current_user)` for auth:

```python
# backend/app/api/my_router.py
from fastapi import APIRouter, Depends
from app.api.deps import get_current_user

router = APIRouter(prefix="/my-feature", tags=["my-feature"])

@router.get("/")
async def get_data(user = Depends(get_current_user)):
    return {"data": "value"}
```

Register in `backend/main.py`: `app.include_router(router, prefix="/api/v1")`

## Styling Conventions (Frontend)

**Always use semantic tokens, never hardcoded colors:**
- Background: `bg-background`, `bg-card`
- Text: `text-foreground`, `text-muted-foreground`
- Borders: `border-border`
- Actions: `bg-primary`, `bg-destructive`

Icons: `lucide-react` at `w-5 h-5`

## Development Commands

```bash
docker compose up -d                                         # Start dev environment
docker compose logs -f                                       # View all service logs
docker compose exec backend alembic upgrade head             # Run Alembic migrations
docker compose restart bot                                   # Restart specific service (backend/bot/frontend)
docker compose down -v                                       # Remove containers and volumes
```

**Testing:**
```bash
docker compose exec backend pytest                    # Backend tests
docker compose exec bot pytest                        # Bot tests
docker compose exec frontend npm run test             # Frontend tests
```

## LLM Integration

Access via `bot.services.llm`. Supports OpenAI, Anthropic, Google Gemini, xAI:

```python
response = await self.bot.services.llm.chat(
    message="Hello",
    provider_name="google",
    model="gemini-3-pro-preview"
)
```

Usage auto-tracked in `llm_usage` table. See [docs/GEMINI_CAPABILITIES.md](docs/GEMINI_CAPABILITIES.md) for full Gemini 3 features.

## Key Files

| Purpose | Location |
|---------|----------|
| Bot entry & services | [bot/core/bot.py](bot/core/bot.py), [bot/services/](bot/services/) |
| Cog examples | [bot/cogs/status.py](bot/cogs/status.py) (sample), [bot/cogs/gemini_demo.py](bot/cogs/gemini_demo.py) |
| API routing | [backend/app/api/](backend/app/api/) |
| Auth & security | [backend/app/core/security.py](backend/app/core/security.py) |
| Frontend API client | [frontend/app/api-client.ts](frontend/app/api-client.ts) |
| Permission HOC | [frontend/lib/components/with-permission.tsx](frontend/lib/components/with-permission.tsx) |

## Do NOT Modify (Core Framework)

- `backend/app/core/` - Auth, config, security
- `bot/core/` - Bot initialization, loader
- `bot/cogs/guild_sync.py` - Guild synchronization
- `frontend/app/layout.tsx`, `frontend/lib/` - Core layouts/context

## Sample/Demo Code (Safe to Replace)

Files marked `*** DEMO CODE ***` are examples:
- `bot/cogs/status.py`, `bot/cogs/gemini_demo.py`
- `frontend/app/dashboard/[guildId]/test-*`, `gemini-demo/`
