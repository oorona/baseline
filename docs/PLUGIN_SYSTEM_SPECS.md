# Baseline Framework: Plugin System Specifications

The Baseline repository is not merely a single monolithic bot, but rather a **foundational infrastructure framework** designed natively for modular extension. Developers create "plugins" by extending the core framework without altering its underlying layers (Authentication, Row-Level Security, Database Sessions, LLM Routing, etc.).

A complete, end-to-end Plugin (or Feature) on this platform consists of up to three modular components depending on its complexity:

1. **Bot Cog** (`bot/cogs/<plugin_name>.py`)
2. **Backend API Router** (`backend/app/api/<plugin_name>.py`)
3. **Frontend Dashboard UI** (`frontend/app/dashboard/[guildId]/<plugin_name>/page.tsx`)

---

## 1. Bot Layer Specifications (The "Cog")
A plugin\'s core execution logic lives in a `discord.py` Cog inside the `bot/cogs/` directory.

### Requirements:
*   **Encapsulation:** Must be a subclass of `commands.Cog`.
*   **Command Descriptions:** Every `@app_commands.command()` must include an explicit `description=` argument.
*   **LLM Usage:** Plugins must consume the shared `bot.services.llm` service for inference rather than directly instantiating their own provider clients. This ensures automatic tracking of token usage, cost, and rate-limiting.
*   **Networking:** Must use the shared `bot.session` (an `aiohttp.ClientSession`) for all external HTTP requests or backend API queries. Do not create isolated `aiohttp` sessions per request to prevent connection leaks.
*   **Demo Marker:** If a plugin is for demonstration purposes only, it must include a `__is_demo__ = True` class attribute so the `init.sh` script automatically strips it for production deployments.

### Form-Driven Settings UI (`SETTINGS_SCHEMA`):
Plugins can securely expose configurable options to the server administrator via the frontend Dashboard without requiring the developer to write custom React code.
*   The Cog declares a static `SETTINGS_SCHEMA` dictionary specifying its required settings fields (e.g., toggles, text inputs, Discord channel/role dropdowns).
*   During `on_ready`, the framework introspects this schema and automatically dynamically renders the "Bot Settings" page on the frontend.
*   Supported field types include: `boolean`, `string`, `text`, `integer`, `channel_select`, `role_select`, and `select`.

---

## 2. Backend Data Strategy (The API Router)
When a plugin requires sophisticated data persistence beyond simple key-value `SETTINGS_SCHEMA`s, it exposes custom RESTful API endpoints.

### Requirements:
*   **Routing:** Defined in `backend/app/api/<plugin_name>.py` and registered with the main FastAPI app.
*   **Access Control:** Endpoints must map to one of the 6 core Security Permission Levels (0: Public, 1: Public Data, 2: User, 3: Authorized, 4: Owner, 5: Developer) via FastAPI dependencies.
*   **Database Guild Isolation (CRITICAL):**
    *   Any endpoint serving single-Discord-server (Guild) data must use the `Depends(get_guild_db)` session dependency.
    *   This enforces PostgreSQL **Row-Level Security (RLS)** using the extracted `guild_id` from the URL, automatically hiding data that belongs to other guilds.
*   **Database Models:**
    *   Must use the core framework `Base` model.
    *   Must inherit from `GuildScopedMixin` if the data belongs to a specific Discord server.
    *   New database tables must be delivered via incremental Alembic migrations (`alembic revision --autogenerate`), NEVER by modifying existing baseline core migrations.
    *   The framework schema version in `version.py` must be updated, appending to the `MIGRATION_CHANGELOG`.

---

## 3. Frontend Specifications (Dashboard Extensions)
For complex plugins needing highly customized dashboards (e.g., an AI Analytics Graph or a Poll Results builder), a bespoke Next.js page is created.

### Requirements:
*   **Location:** Resides in `frontend/app/dashboard/[guildId]/<plugin_name>/page.tsx`.
*   **Navigation:** Declared in `frontend/app/page.tsx` as a Navigation Card object with `level` bound to the correct Permission Level.
*   **Security Wrapping:** The entire exported React page must be wrapped with the core Higher-Order Component `withPermission(Component, PermissionLevel)`. Bare exports are forbidden.
*   **Design Tokens:** Hardcoded CSS colors are strictly prohibited. Developers must use the standard Tailwind semantic design tokens included traversing light/dark modes (`bg-background`, `bg-card`, `text-foreground`, `border-border`, `bg-primary`, `bg-destructive`).
*   **Internationalization (i18n):** Hardcoded English user-facing text is not permitted. All strings must use the `useTranslation()` hook. Strings must be simultaneously populated in both english (`en.ts`) and spanish (`es.ts`) dictionaries, namespaced by the `<plugin_name>`.

---

## 4. Plugin Staging Workflow (LLM-Assisted Development)

Plugins are developed in an isolated **staging area** (`plugins/<plugin_name>/`) and only copied into the live project after automated validation. This prevents spec-violating code from reaching the project.

### Staging Folder Structure

```
plugins/
  event_logging/        ← worked example: the Event Logging plugin
    plugin.json         ← required manifest (name, version, components, router config)
    cog.py              → bot/cogs/event_logging.py
    api.py              → backend/app/api/event_logging.py
    models.py           → appended to backend/app/models.py            (optional)
    migration.py        → backend/alembic/versions/<ts>_event_logging.py  (optional)
    page.tsx            → frontend/app/dashboard/[guildId]/event_logging/page.tsx
    translations/
      en.ts             → merged into frontend/lib/i18n/translations/en.ts
      es.ts             → merged into frontend/lib/i18n/translations/es.ts
  _template/            ← copy this to start a new plugin
```

### The Three-Step Flow

```bash
# 1. Build — ask an LLM (e.g. Claude) to generate the plugin in the staging folder,
#            providing CLAUDE.md and this file as context.

# 2. Validate — check all framework contracts before touching the live project
python scripts/plugin_validate.py plugins/event_logging

# 3. Install — validator runs again, then files are copied and main.py is patched
python scripts/plugin_install.py plugins/event_logging

# Dry-run to preview without writing any files:
python scripts/plugin_install.py plugins/event_logging --dry-run
```

### What the Validator Checks

| Layer | Rule enforced |
|---|---|
| Cog | Inherits `commands.Cog` |
| Cog | `description=` on every `@app_commands.command()` |
| Cog | No direct LLM client instantiation — must use `bot.services.llm` |
| Cog | No `aiohttp.ClientSession()` — must use `bot.session` |
| Cog | `SETTINGS_SCHEMA` present if cog reads guild settings |
| Cog | `async def setup(bot)` entrypoint present |
| API | `get_guild_db` used for every route containing `{guild_id}` |
| API | `AuditLog` written in every POST / PUT / PATCH / DELETE handler |
| Frontend | `withPermission()` is the default export |
| Frontend | `useTranslation()` used — no hardcoded English strings |
| Frontend | No hardcoded hex, rgb(), or arbitrary Tailwind color values |
| i18n | Both `en.ts` and `es.ts` present with matching namespace keys |

### What the Installer Does Automatically

- Copies `cog.py` → `bot/cogs/<name>.py`
- Copies `api.py` → `backend/app/api/<name>.py`
- Patches `backend/main.py` to import and register the new router
- Copies `page.tsx` → `frontend/app/dashboard/[guildId]/<name>/page.tsx` (creates directory)
- Merges translation snippets into `en.ts` and `es.ts`
- Copies migration file to `backend/alembic/versions/<timestamp>_<name>.py`

### What Still Requires a Manual Step

1. **Database migrations** — run `cd backend && alembic upgrade head` after install
2. **Navigation card** — add an entry to the `cards` array in `frontend/app/page.tsx`
   (the installer prints the exact object to paste)

> See `docs/integration/08-plugin-workflow.md` for a step-by-step walkthrough using the Event Logging plugin as a worked example.

---

## Summary of the Plugin Installation Flow
1. **Stage:** The developer (or LLM) creates the plugin files in `plugins/<plugin_name>/`.
2. **Validate:** Run `python scripts/plugin_validate.py plugins/<plugin_name>` to catch spec violations before touching the live project.
3. **Install:** Run `python scripts/plugin_install.py plugins/<plugin_name>` to copy files and patch `main.py`.
4. **Migrate:** Run `alembic upgrade head` if the plugin added database tables.
5. **Boot:** The bot connects, the introspection framework reads the new Cog\'s `SETTINGS_SCHEMA`, syncs with the Database, and dynamically updates the UI. No core infrastructure overrides were necessary.
