# CLAUDE.md — Baseline Framework Quick Reference

This file is the first thing AI coding assistants should read. It contains the essential rules for extending this framework correctly.

## What This Is

A **framework** for building Discord bots with web dashboards. You extend it by adding cogs, API routes, frontend pages, and migrations. **You never modify core infrastructure files.**

## Five Golden Rules

Every piece of code you generate must follow all five of these rules:

1. **`bot.services.llm`** — the LLM service is always accessed as `bot.services.llm` (never `bot.llm_service` or any other path)
2. **`get_guild_db` for guild data** — endpoints that touch guild-scoped tables use `Depends(get_guild_db)`, not `Depends(get_db)`. Using `get_db` silently bypasses Row-Level Security and can leak cross-guild data
3. **`withPermission` on every frontend page** — every `page.tsx` under `dashboard/` must be exported as `withPermission(Page, PermissionLevel.X)`. A bare `export default function` has no auth guard and no breadcrumb
4. **`SETTINGS_SCHEMA` for configurable cogs** — any cog that reads guild settings declares a `SETTINGS_SCHEMA` class attribute; the dashboard Settings page renders the form automatically with no frontend code needed. The schema **must** use the nested structure below — a flat dict of field names is invalid and will be rejected by the validator:

```python
SETTINGS_SCHEMA = {
    "id": "my_plugin",          # unique snake_case identifier
    "label": "My Plugin",       # display name in dashboard
    "description": "...",       # optional subtitle
    "fields": [
        {"key": "enabled",    "type": "boolean",        "label": "Enable",          "default": True},
        {"key": "channel_id", "type": "channel_select", "label": "Channel",         "default": None},
        {"key": "role_id",    "type": "role_select",    "label": "Role",            "default": None},
        {"key": "prefix",     "type": "text",           "label": "Prefix",          "default": "!"},
        {"key": "limit",      "type": "number",         "label": "Max Items",       "default": 10},
        {"key": "modes",      "type": "multiselect",    "label": "Modes",           "default": [],
         "choices": [{"value": "a", "label": "Mode A"}, {"value": "b", "label": "Mode B"}]},
    ],
}
```

Valid `"type"` values: `"boolean"`, `"text"`, `"number"`, `"channel_select"`, `"role_select"`, `"multiselect"`. **Never use** `"string"`, `"integer"`, or `"select"` — the validator will reject them. `channel_select` and `role_select` dropdowns are populated automatically from the Discord API; you do not provide `choices` for them.
5. **`AuditLog` on every settings mutation** — every backend endpoint that modifies settings must write an `AuditLog` entry; this is a hard framework contract

## How to Build a Feature (Plugin Workflow)

**Never write feature code directly into the live project.** Use the plugin staging system:

```bash
cp -r plugins/_template plugins/<name>   # start from the template
# ... build cog.py, api.py, page.tsx, translations/ inside plugins/<name>/
./install_plugin.sh <name>               # validates then installs into live project
```

The validator enforces all five golden rules automatically and will reject code that violates them. See `docs/integration/08-plugin-workflow.md` for the full guide.

**If you are about to edit a file in `bot/core/`, `backend/app/api/auth.py`, `backend/app/api/deps.py`, `frontend/lib/auth-context.tsx`, or any existing migration — stop.** These files are write-protected after `init.sh`. Everything you need can be built within the extension points below.

## Core vs User Code

| Never touch (core) | Safe to extend |
|---|---|
| `bot/core/bot.py` | `bot/cogs/*.py` — add cogs here |
| `bot/core/loader.py` | `bot/services/*.py` — add services here |
| `backend/app/api/auth.py` | `backend/app/api/*.py` — add new router files |
| `backend/app/api/deps.py` | `backend/app/models.py` — append new models |
| `frontend/lib/auth-context.tsx` | `frontend/app/dashboard/[guildId]/*` — add pages |
| `frontend/app/layout.tsx` | `frontend/lib/i18n/translations/` — add strings |
| `backend/alembic/versions/*.py` (existing) | `backend/alembic/versions/` — add new migration files |

## Key File Locations

| What | Where |
|---|---|
| Bot commands (cogs) | `bot/cogs/<feature>.py` |
| Backend API router | `backend/app/api/<feature>.py` |
| Register backend router | `backend/main.py` — add `from app.api.<feature> import router as <feature>_router` + `app.include_router(...)` |
| Frontend dashboard page | `frontend/app/dashboard/[guildId]/<feature>/page.tsx` |
| Navigation cards (dashboard home) | `frontend/app/page.tsx` |
| DB models | `backend/app/models.py` |
| DB migration | `backend/alembic/versions/` (auto-generate: `alembic revision --autogenerate -m "desc"`) |
| Framework version & changelog | `backend/app/core/version.py` |
| i18n strings | `frontend/lib/i18n/translations/en.ts` **AND** `es.ts` |

## Mandatory Checklist for Every New Feature

- [ ] **Cog**: `description=` on every `@app_commands.command()` — never omit it
- [ ] **Cog**: `SETTINGS_SCHEMA` if the cog reads from guild settings
- [ ] **Backend**: use `Depends(get_guild_db)` for any endpoint under `/{guild_id}/`
- [ ] **Backend**: import and register the new router in `backend/main.py`
- [ ] **Backend**: write an `AuditLog` entry on every settings mutation
- [ ] **Frontend**: export page as `withPermission(Page, PermissionLevel.X)`
- [ ] **Frontend**: add a navigation card in `frontend/app/page.tsx` if the feature needs its own page
- [ ] **i18n**: add all user-visible strings to `en.ts` **and** `es.ts` — never hardcode text
- [ ] **DB**: if adding tables, `alembic revision --autogenerate`, add RLS block if guild-scoped — `install_plugin.sh` writes the migration entry to `backend/migration_inventory.json` automatically; only manual step is `alembic upgrade head`

## Bot Service Access Patterns

```python
class MyCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.llm = bot.services.llm          # LLM service (all providers)
        # bot.session is a shared aiohttp.ClientSession — use it for all HTTP calls
        # to the backend; do not create new sessions per-request

    async def _get_settings(self, guild_id: int) -> dict:
        """Standard pattern for fetching guild settings from backend."""
        async with self.bot.session.get(
            f"http://backend:8000/api/v1/guilds/{guild_id}/settings",
            headers={"Authorization": f"Bot {self.bot.services.config.DISCORD_BOT_TOKEN}"}
        ) as resp:
            if resp.status == 200:
                return (await resp.json()).get("settings", {})
        return {}
```

## Backend DB Session Quick Reference

```python
from app.db.guild_session import get_guild_db   # For /{guild_id}/ endpoints — RLS active
from app.db.guild_session import get_admin_db   # For L6 cross-guild endpoints — RLS bypassed
from app.db.session import get_db               # For global tables only (users, shards, etc.)
```

## i18n Quick Reference

Every user-visible string must go through the translation system:

```tsx
// In any 'use client' component:
const { t } = useTranslation();
<h1>{t('myFeature.title')}</h1>
<p>{t('myFeature.greeting', { username: user.username })}</p>

// Add to BOTH translation files:
// frontend/lib/i18n/translations/en.ts
myFeature: {
  title: 'My Feature',
  greeting: 'Hello, {username}!',
},

// frontend/lib/i18n/translations/es.ts  (must mirror en.ts exactly)
myFeature: {
  title: 'Mi Función',
  greeting: '¡Hola, {username}!',
},
```

## Registering a Backend Router in main.py

```python
# backend/main.py — add at the end of the router registration block:
from app.api.myfeature import router as myfeature_router
app.include_router(myfeature_router, prefix=f"{settings.API_V1_STR}/guilds", tags=["myfeature"])
```

## Authoritative Documentation (read in this order)

1. **`docs/DEVELOPER_MANUAL.md`** — architecture, security model, plugin workflow, DB extension guide
2. **`docs/LLM_USAGE_GUIDE.md`** — using the LLM service in cogs and the backend
3. **`docs/SECURITY.md`** — all 6 permission levels with complete code examples
4. **`docs/integration/`** — step-by-step guides for each extension point
5. **`docs/GEMINI_CAPABILITIES.md`** — Gemini advanced features (image gen, TTS, RAG, context caching)
