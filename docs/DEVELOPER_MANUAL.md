# Baseline Framework: Developer & Agent Manual

## 1. Introduction
This documentation is the **authoritative source** for developers and AI Agents working on the Baseline Framework. It consolidates architecture, security, and plugin workflows.

> **This is a framework, not a finished bot.**
> The Baseline Framework provides the infrastructure that all bots built on it share: authentication, database access, encrypted secret management, permission enforcement, LLM integration, and the admin dashboard. You build your bot by **extending** the framework — adding cogs, API routes, frontend pages, and database migrations — without ever modifying the core.

### Core Philosophy
- **Core Framework** — The underlying "Operating System" (Auth, Database, Navigation, Layouts). **DO NOT MODIFY** unless fixing a confirmed framework bug. This code is shared by every bot built on this platform.
- **Sample/User Code** — The specific bot implementation. The current codebase contains **Sample Code** (e.g., `status.py`, `test-l1` pages) to demonstrate functionality. Replace or extend these with your own features.

### What "Extending the Framework" Means

| You extend by... | You never... |
| :--- | :--- |
| Adding new bot cogs in `bot/cogs/` | Modify `bot/core/bot.py` |
| Adding new API routers in `backend/app/api/` | Modify `backend/app/api/auth.py` or `deps.py` |
| Adding new pages in `frontend/app/dashboard/[guildId]/` | Modify `frontend/lib/auth-context.tsx` |
| Adding new Alembic migrations | Edit existing migration files |
| Appending entries to `MIGRATION_CHANGELOG` in `version.py` | Change existing `MIGRATION_CHANGELOG` entries |
| Bumping `FRAMEWORK_VERSION` for schema changes | Change `REQUIRED_DB_REVISION` manually |

---

## 2. Project Structure

| Component | Path | Description | Access |
| :--- | :--- | :--- | :--- |
| **Backend** | `backend/app/*` | FastAPI service, DB models, Auth. | **Core** |
| **Bot (Core)** | `bot/main.py`, `bot/cogs/guild_sync.py` | Discord.py startup, sharding, syncing. | **Core** |
| **Bot (Features)** | `bot/cogs/*.py` | Feature logic (e.g., Moderation, Music). | **User/Sample** |
| **Frontend (Core)** | `frontend/app/layout.tsx`, `frontend/lib/*` | Layouts, Auth Context, UI Components. | **Core** |
| **Frontend (Pages)** | `frontend/app/dashboard/*` | Dashboard pages. | **User/Sample** |

### Sample Files (Test Artifacts)
The following files are present **ONLY** for testing the framework. Future bots should likely remove or replace them:
*   `frontend/app/dashboard/[guildId]/test-l1/` (Tests Public Data Access)
*   `frontend/app/dashboard/[guildId]/test-l2/` (Tests User Access)
*   `frontend/app/dashboard/[guildId]/gemini-demo/` (Tests Gemini Capabilities - Demo)
*   `bot/cogs/status.py` (Sample Cog)
*   `bot/cogs/logging.py` (Sample Cog)
*   `bot/cogs/gemini_demo.py` (Sample Cog - Basic LLM)
*   `bot/cogs/gemini_capabilities_demo.py` (Sample Cog - Full Gemini 3 Demo)

> **Note**: Demo files are clearly marked with `*** DEMO CODE ***` banners to distinguish them from framework code.

---

## 2.5 Secrets and Configuration (First-Time Setup)

> **No `.env` file.** The only secret that lives outside Docker is the encryption key, stored in `secrets/encryption_key` (never committed to git). Everything else — DB credentials, Discord token, API keys — is entered once through the browser Setup Wizard and stored encrypted on a Docker volume.

### How It Works

```
secrets/encryption_key   ←  created by ./setup_secrets.sh
        │
        └─► Docker secret (tmpfs, never on disk inside container)
                │
                └─► AES-256-GCM encryption key
                        │
                        └─► encrypts /data/settings.enc  (Docker named volume)
                                │
                                └─► DB host/user/password, Discord token, API keys
```

1. Run `./setup_secrets.sh` — generates a 256-bit encryption key in `secrets/encryption_key`.
2. Run `./setup_database.sh --user <name>` — creates the Postgres user and schema.
3. Run `docker compose up` — app starts in **wizard mode** (no DB connected yet).
4. Open the app in a browser — you are redirected to `/setup`.
5. Enter credentials in the wizard — they are encrypted with AES-256-GCM and saved to `/data/settings.enc`.
6. All subsequent starts decrypt the file automatically — wizard never runs again unless the file is deleted.

### Rules for Bot Developers

- **Never add secrets to `.env.example`** or any committed file.
- **Never read secrets with `os.getenv("DB_PASSWORD")` directly** — use `Depends(get_db)` for DB access and `settings.*` (the Pydantic `Settings` object populated from the encrypted file) for config values.
- **Never call `save_encrypted_settings()` from feature code** — only setup/wizard endpoints write to the encrypted file.
- If you need a new configurable secret (e.g., a third-party API key for your feature), add it to the wizard form, save it via the existing wizard endpoint, and read it from `settings.*` in your code.

---

## 2.6 LLM & AI Capabilities

The framework includes comprehensive LLM support with special focus on **Gemini 3**:

### Supported Providers
| Provider | Models | Special Features |
|----------|--------|------------------|
| **Google (Gemini)** | Gemini 3 Pro/Flash, 2.5 Pro/Flash | Full multimodal, thinking levels |
| **OpenAI** | GPT-4o, GPT-4, GPT-3.5 | Function calling, vision |
| **Anthropic** | Claude 3 Opus/Sonnet/Haiku | Long context, analysis |
| **xAI** | Grok | Real-time knowledge |

### Gemini 3 Capabilities (Google)
The framework supports all 13 Gemini 3 API capabilities:

| Capability | Description | Documentation |
|------------|-------------|---------------|
| Text Generation | Standard text with thinking levels | [GEMINI_CAPABILITIES.md](GEMINI_CAPABILITIES.md) |
| Image Generation | Create images from prompts | [GEMINI_CAPABILITIES.md](GEMINI_CAPABILITIES.md) |
| Image Understanding | Analyze and describe images | [GEMINI_CAPABILITIES.md](GEMINI_CAPABILITIES.md) |
| Text-to-Speech | Natural voice synthesis | [GEMINI_CAPABILITIES.md](GEMINI_CAPABILITIES.md) |
| Audio Understanding | Transcribe and analyze audio | [GEMINI_CAPABILITIES.md](GEMINI_CAPABILITIES.md) |
| Embeddings | Vector embeddings for search | [GEMINI_CAPABILITIES.md](GEMINI_CAPABILITIES.md) |
| Thinking Levels | Control reasoning depth | [GEMINI_CAPABILITIES.md](GEMINI_CAPABILITIES.md) |
| Structured Output | JSON schema responses | [GEMINI_CAPABILITIES.md](GEMINI_CAPABILITIES.md) |
| Function Calling | Let AI call your functions | [GEMINI_CAPABILITIES.md](GEMINI_CAPABILITIES.md) |
| File Search | RAG over uploaded files | [GEMINI_CAPABILITIES.md](GEMINI_CAPABILITIES.md) |
| URL Context | Include web content | [GEMINI_CAPABILITIES.md](GEMINI_CAPABILITIES.md) |
| Content Caching | Cache for cost savings | [GEMINI_CAPABILITIES.md](GEMINI_CAPABILITIES.md) |
| Token Counting | Estimate before calling | [GEMINI_CAPABILITIES.md](GEMINI_CAPABILITIES.md) |

### Quick Start with LLM

```python
# In your cog
class MyCog(commands.Cog):
    def __init__(self, bot):
        self.llm = bot.services.llm
    
    @app_commands.command()
    async def ask(self, interaction, question: str):
        await interaction.response.defer()
        
        # Simple chat
        response = await self.llm.chat(
            message=question,
            provider_name="google",
            model="gemini-3-pro-preview"
        )
        
        await interaction.followup.send(response)
```

### Cost Tracking

All LLM usage is automatically tracked in the `llm_usage` table with:
- Provider, model, capability type
- Token counts (prompt, completion, thinking, cached)
- Cost estimation
- Latency metrics
- Guild and user attribution

See [LLM_USAGE_GUIDE.md](LLM_USAGE_GUIDE.md) for general usage and [GEMINI_CAPABILITIES.md](GEMINI_CAPABILITIES.md) for Gemini-specific features.

---

## 3. Security Architecture (Permission Levels)

The framework enforces a strict 6-tier security model. **All new pages and API endpoints MUST adhere to this.**

| Level | Name | Description | Example Usage |
| :--- | :--- | :--- | :--- |
| **0** | **Public** | Accessible by anyone, no login required. | Landing Page, Login, Docs. |
| **1** | **Public Data** | Read-only public API data. No login required. | Leaderboards, Server Stats. |
| **2** | **User (Login Required)** | Requires login. Access determined by Guild Settings (Default: Everyone allowed). | Basic Dashboard, Leaderboards. |
| **3** | **Authorized** | **Strictly Controlled**. Requires specific Authorization (Role or User). | Bot Settings, Moderation Tools. |
| **4** | **Owner** | Guild Owner only. | Permission Management, Sensitive Config. |
| **5** | **Developer** | Platform Administrators. Full access to everything. | Platform Debug, AI Analytics. |

### Security Best Practices
- **Default to Strict**: If unsure, use **Level 3 (Authorized)**.
- **Level 2 (User)**: Ideal for **Read-Only** dashboards (stats, logs).
- **Level 3 (Authorized)**: Required for **Write** actions (settings, moderation).

### Implementing Security
*   **Frontend**: Wrap pages with `withPermission(Component, PermissionLevel.LEVEL)`.
*   **Backend**: Use dependencies `Depends(get_current_user)` and check privileges.
*   **Navigation**: Set the `level` property in `frontend/app/page.tsx` card definitions to auto-hide them.

> **Full security reference with code examples for all 6 levels:** [docs/SECURITY.md](SECURITY.md)

### Rate Limiting
Be aware that the API implements rate limiting. If your bot or frontend receives `429 Too Many Requests`, back off and retry.
- Auth: 5-10 req/min
- LLM: 10-20 req/min
- General: 20 req/min

---


## 4. Frontend Style Guide (Design System)

To ensure a cohesive look, all plugins **MUST** use the following semantic tokens. **NEVER** use hardcoded colors (e.g., `bg-white`).

| Element | Use This Token (Tailwind) | Do NOT Use |
| :--- | :--- | :--- |
| **Page Background** | `bg-background` | `bg-white`, `bg-gray-900` |
| **Card/Panel** | `bg-card` | `bg-white`, `bg-zinc-800` |
| **Main Text** | `text-foreground` | `text-black`, `text-white` |
| **Secondary Text** | `text-muted-foreground` | `text-gray-500` |
| **Borders** | `border-border` | `border-gray-200` |
| **Primary Action** | `bg-primary`, `text-primary-foreground` | `bg-blue-600` |
| **Destructive** | `bg-destructive`, `text-destructive-foreground` | `bg-red-600` |
| **Input Fields** | `bg-background`, `border-input`, `ring-ring` | `bg-gray-50` |

### Standard Components
- **Page Container**: `p-8 max-w-7xl mx-auto`
- **Section Headers**: `text-2xl font-bold mb-4`
- **Cards**: `bg-card rounded-xl border border-border p-6`
- **Icons**: Use `lucide-react`. Size `w-5 h-5` (20px).

---

## 5. Plugin Workflow (How to Add Features)

To add a new feature (e.g., "Music Bot"), follow this strict workflow:

### Step 1: Create the Backend Logic (Cog)
Create `bot/cogs/music.py`.
*   Inherit from `commands.Cog`.
*   Use `GuildLogger` for logging.
*   Store settings in the database via the Settings Service (accessed via API or shared DB).

```python
# bot/cogs/music.py
from discord.ext import commands

class Music(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

async def setup(bot):
    await bot.add_cog(Music(bot))
```

### Step 2: Create the Frontend Settings Page
Create `frontend/app/dashboard/[guildId]/music/page.tsx`.
*   Use `withPermission` to secure the page (usually Level 3 or 2).
*   Use `apiClient` to fetch/save settings.

```tsx
// frontend/app/dashboard/[guildId]/music/page.tsx
'use client';
import { withPermission } from '@/lib/components/with-permission';
import { PermissionLevel } from '@/lib/permissions';

function MusicPage() {
    return <div>Music Settings</div>;
}

export default withPermission(MusicPage, PermissionLevel.AUTHORIZED);
```

### Step 3: Register Navigation
1.  **Card**: Add a new card entry in `frontend/app/page.tsx` inside the `cards` array.
2.  **Plugin Registry**: (Optional) Register in `frontend/app/plugins/registry.tsx` if it's a dynamically loaded plugin.

### Baseline Expectations
**Every Bot** built on this framework is expected to have **at least:**
1.  One **Settings Page** (usually `/settings`).
2.  One **Cog** implementing the core logic.
3.  Configuration to secure these pages at `PermissionLevel.AUTHORIZED` (Level 3) or higher.

---

## 5.5 Cleaning Up (Shipping)
When shipping a real bot:
1.  Delete `test-l1` and `test-l2` folders.
2.  Replace `status.py` and `logging.py` with your actual bot logic.
3.  Keep `guild_sync.py` and `introspection.py` (Core).

## 6. Database: Architecture and Extension Guide

> **CRITICAL — READ BEFORE TOUCHING ANYTHING DATABASE-RELATED**
>
> The database layer is **core framework infrastructure**. Never modify existing migrations, never change the schema isolation rules, and never add tables directly to existing Alembic revision files. New features extend the framework by adding NEW migrations alongside the existing ones — they never replace or alter what is already there.

---

### 6.1 How the Database Layer Works

The framework enforces a single, strict contract for every database interaction:

| Rule | Enforced By |
| :--- | :--- |
| One DB user per bot deployment | `setup_database.sh --user <name>` (required, no default) |
| Schema name always equals username | `setup_database.sh`, `alembic/env.py`, `session.py` |
| All objects land in the app schema, never `public` | `ALTER ROLE ... SET search_path`, `REVOKE CREATE ON SCHEMA public` |
| Every connection uses `search_path = <schema>` | `session.py` → asyncpg `server_settings`, `alembic/env.py` → `SET search_path` |
| `alembic_version` tracked inside the app schema | `version_table_schema=db_schema` in `alembic/env.py` |

**Multiple bots can safely share the same Postgres cluster** because each bot runs under its own user/schema combination (`bot_a` schema `bot_a`, `bot_b` schema `bot_b`). Their objects never touch.

---

### 6.2 First-Time Setup

```bash
# 1. Generate the encryption key (once per deployment)
./setup_secrets.sh

# 2. Start Postgres
docker compose up -d postgres

# 3. Create the DB user and schema (once per deployment, choose any username)
./setup_database.sh --user mybot

# 4. Start the full stack — the Setup Wizard runs automatically
docker compose up

# 5. Open the app in your browser and complete the wizard
```

The wizard (browser UI) collects DB credentials, Discord tokens, and API keys, then encrypts and stores them. From that point on the app starts fully automatically — no `.env` files, no plaintext secrets on disk.

---

### 6.3 Guild Isolation — Row-Level Security (RLS)

> **This is the most critical section for anyone adding new features.**

A bot serves many Discord servers simultaneously. Without isolation, a bug — a missing `WHERE` clause, a wrong variable — can leak one server's data to another. The framework prevents this at the **database engine level** using PostgreSQL Row-Level Security (RLS). Application code cannot bypass it by accident.

#### The Three Session Dependencies

Choose the session dependency based on what your endpoint accesses:

| Dependency | Import | When to use |
| :--- | :--- | :--- |
| `get_guild_db` | `app.db.guild_session` | Any endpoint under `/{guild_id}/`. RLS **active** — only that guild's rows are visible or writable. |
| `get_admin_db` | `app.db.guild_session` | L5 admin endpoints needing cross-guild or global data. RLS bypassed. Requires platform admin automatically. |
| `get_db` | `app.db.session` | Endpoints that only touch non-guild tables (`users`, `shards`, `app_config`, etc.). RLS bypassed. |

#### Guild-Scoped Endpoints — always use `get_guild_db`

```python
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.guild_session import get_guild_db
from app.models import Ticket

@router.get("/{guild_id}/tickets")
async def list_tickets(
    guild_id: int,                              # FastAPI resolves from path
    db: AsyncSession = Depends(get_guild_db),   # sets RLS context automatically
):
    # No WHERE needed — the database enforces the filter.
    # Even if you forget, wrong-server data is invisible.
    result = await db.execute(select(Ticket))
    return result.scalars().all()
```

FastAPI extracts `guild_id` from the path and passes it to `get_guild_db`, which executes `SET LOCAL app.current_guild_id = '{guild_id}'` inside the transaction. The RLS policy then applies to every query in that session.

#### What Happens Without a Context (Fail-Safe)

If a query runs on a guild-scoped table with no context set, the policy evaluates:

```
NULL = guild_id  →  NULL  →  false
```

**Zero rows are returned.** A forgotten `WHERE` clause produces an obviously empty result, not a data leak.

#### Platform-Admin Cross-Guild Endpoints — use `get_admin_db`

```python
from app.db.guild_session import get_admin_db

@router.get("/admin/all-tickets")
async def admin_list_all_tickets(
    db: AsyncSession = Depends(get_admin_db),  # bypass + L5 auth built in
):
    result = await db.execute(select(Ticket))  # sees ALL guilds
    return result.scalars().all()
```

#### Tables That Are Guild-Scoped (RLS active — migration 1.1.0)

| Table | RLS column | Notes |
| :--- | :--- | :--- |
| `guilds` | `id` | `id` IS the Discord guild ID |
| `authorized_users` | `guild_id` | |
| `authorized_roles` | `guild_id` | |
| `guild_settings` | `guild_id` | |
| `audit_logs` | `guild_id` | |
| `llm_usage` | `guild_id` | Nullable — `NULL` = system/global usage |
| `llm_usage_summary` | `guild_id` | Nullable — `NULL` = system/global usage |

#### Tables That Are Global (no RLS)

`users`, `user_tokens`, `shards`, `llm_model_pricing`, `app_config`, `alembic_version`

#### `search_path` and Schema Isolation

The session also has `search_path = <app_schema>` set at connection time. Every unqualified table name (`SELECT * FROM tickets`) automatically resolves to `<schema>.tickets`. Never qualify table names with the schema in application code.

**In bot services:** Cogs call the backend API over HTTP — the backend owns all DB sessions. The bot never connects to Postgres directly.

---

### 6.4 Adding New Tables (Framework Extension)

When your bot needs new database tables, follow this exact process. **Do not modify any existing migration files.**

#### Step 1 — Define the SQLAlchemy model

Add your model to `backend/app/models.py` (or a new file imported by `models.py`).

**For guild-scoped tables** (stores per-server data) — use `GuildScopedMixin`:

```python
from sqlalchemy import Column, String, BigInteger, DateTime
from sqlalchemy.sql import func
from app.db.base import Base          # shared Base — never create a new one
from app.db.mixins import GuildScopedMixin

class Ticket(GuildScopedMixin, Base):  # GuildScopedMixin FIRST
    __tablename__ = "tickets"

    id         = Column(BigInteger, primary_key=True, autoincrement=True)
    # guild_id is inherited from GuildScopedMixin — do NOT redeclare it
    title      = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

`GuildScopedMixin` adds `guild_id` and the `__guild_scoped__ = True` marker. The RLS migration must be extended to cover new guild-scoped tables — see Step 2 note below.

**For global tables** (platform-wide data, no guild filter):

```python
from app.db.base import Base

class GlobalConfig(Base):
    __tablename__ = "global_config"
    id    = Column(BigInteger, primary_key=True, autoincrement=True)
    key   = Column(String(255), nullable=False, unique=True)
    value = Column(String, nullable=False)
```

> Use the framework's `Base` from `app.db.base`. Never create a separate `Base` — all models must share the same metadata for Alembic to detect them.

#### Step 2 — Generate the migration

```bash
cd backend
alembic revision --autogenerate -m "add_my_feature_table"
```

Alembic will create a new file under `backend/alembic/versions/`. Note the revision ID printed to stdout (e.g. `a1b2c3d4e5f6`).

The generated migration **does not need** `SET search_path` or schema qualifiers — `alembic/env.py` already sets `search_path` before running any migration, so your new table lands in the correct app schema automatically.

**If your new table is guild-scoped**, add RLS to the migration:

```python
def upgrade() -> None:
    op.create_table("tickets", ...)

    # Enable RLS on the new guild-scoped table
    op.execute('ALTER TABLE "tickets" ENABLE ROW LEVEL SECURITY')
    op.execute('ALTER TABLE "tickets" FORCE ROW LEVEL SECURITY')
    op.execute("""
        CREATE POLICY guild_isolation ON "tickets"
        USING (
            guild_id = current_setting('app.current_guild_id', true)::bigint
            OR current_setting('app.bypass_guild_rls', true) = 'true'
        )
        WITH CHECK (
            guild_id = current_setting('app.current_guild_id', true)::bigint
            OR current_setting('app.bypass_guild_rls', true) = 'true'
        )
    """)

def downgrade() -> None:
    op.execute('DROP POLICY IF EXISTS guild_isolation ON "tickets"')
    op.execute('ALTER TABLE "tickets" NO FORCE ROW LEVEL SECURITY')
    op.execute('ALTER TABLE "tickets" DISABLE ROW LEVEL SECURITY')
    op.drop_table("tickets")
```

#### Step 3 — Register the new version in `version.py`

Open `backend/app/core/version.py` and make three changes:

```python
# 1. Bump the framework version
FRAMEWORK_VERSION: str = "1.1.0"

# 2. Add the new version → revision mapping
VERSION_REVISIONS: dict[str, str] = {
    "1.0.0": "c8d4e5f6a7b9",
    "1.1.0": "a1b2c3d4e5f6",   # ← your new revision ID
}

# 3. Append an entry to MIGRATION_CHANGELOG (keep chronological order)
MIGRATION_CHANGELOG: list[dict] = [
    {
        "version":       "1.0.0",
        "description":   "Initial schema — users, guilds, permissions, audit log, LLM tracking, app config",
        "revisions":     ["c8d4e5f6a7b9"],
        "head_revision": "c8d4e5f6a7b9",
    },
    {
        "version":       "1.1.0",
        "description":   "Add my_feature table",
        "revisions":     ["a1b2c3d4e5f6"],
        "head_revision": "a1b2c3d4e5f6",
    },
]
```

Once committed, the **Database Management** page in the admin dashboard will automatically detect that the live database is behind, display the upgrade path version-by-version, and allow the operator to apply the new migration through the UI or via `alembic upgrade head`.

#### Step 4 — Use the model in your endpoint

```python
# backend/app/api/tickets.py
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.guild_session import get_guild_db  # NOT get_db
from app.models import Ticket

@router.get("/{guild_id}/tickets")
async def list_tickets(
    guild_id: int,
    db: AsyncSession = Depends(get_guild_db),  # RLS active
):
    # No WHERE needed — RLS enforces guild isolation automatically.
    result = await db.execute(select(Ticket))
    return result.scalars().all()
```

---

### 6.5 Migration Rules (Mandatory)

| Rule | Reason |
| :--- | :--- |
| **Never edit an existing migration file** | Other deployments may already have applied it; changing it breaks their `alembic_version` checksum |
| **Never hardcode schema names** in migrations | `search_path` is set by `alembic/env.py`; unqualified names always resolve correctly |
| **Never create objects in `public`** | `REVOKE CREATE ON SCHEMA public` is enforced at the Postgres role level |
| **Always bump `FRAMEWORK_VERSION`** when adding migrations | Required for the DB Management UI to show the upgrade path correctly |
| **Always add to `MIGRATION_CHANGELOG`** | Required for version-aware upgrades |
| **One `MIGRATION_CHANGELOG` list for all features** | Framework tables and extension tables share the same `alembic_version` tracking |

---

### 6.6 Database Access During Development

The PostgreSQL port `5432` is **not** exposed to the host machine.

**Option 1: Docker Exec (CLI)**
```bash
docker compose exec postgres psql -U <your_username> -d <your_dbname>
```

**Option 2: Temporary Port Mapping (GUI tools)**
```bash
docker run --rm -it --network=baseline_dbnet -p 5433:5432 alpine/socat TCP-LISTEN:5432,fork TCP:postgres:5432
```
Then connect to `localhost:5433` with your DB credentials.

---

## 7. Bot Permission Configuration

The framework includes a **Permission Validator** that ensures your bot has all required Discord intents and guild permissions at startup. This helps catch configuration errors early.

### The `required_permissions.yaml` File

Place a `required_permissions.yaml` file in the `bot/` directory to define your bot's permission requirements:

```yaml
# Required Discord Gateway Intents
# Privileged intents must also be enabled in the Discord Developer Portal
intents:
  - message_content  # For reading message content
  - members          # For member join/leave events
  - guilds           # For guild join/leave events

# Required Guild Permissions
# The bot role needs these permissions in each server
permissions:
  - send_messages
  - embed_links
  - read_message_history

# If true, bot refuses to start when permissions are missing
# If false (default), bot logs warnings but continues
strict_mode: false
```

### How It Works

1. **At Startup (`setup_hook`)**: The validator checks that all required **intents** are enabled in the bot code and Discord Developer Portal.
2. **On Connection (`on_ready`)**: The validator checks that the bot has all required **guild permissions** in each server it joins.

### Intent and Permission References

- **Intents**: [discord.py Intents Documentation](https://discordpy.readthedocs.io/en/stable/intents.html)
- **Permissions**: [discord.py Permissions Documentation](https://discordpy.readthedocs.io/en/stable/api.html#discord.Permissions)

### LLM Prompt for Permission Discovery

Use the following prompt with an LLM to automatically scan your bot project and generate the `required_permissions.yaml` file:

---

**Prompt:**

> Analyze the following Discord bot project files and identify all required Discord permissions.
>
> **For each file, identify:**
>
> 1. **Intents** - Based on event listeners used. Reference:
>    - `on_message`, `on_message_delete`, `on_message_edit` → `message_content`
>    - `on_member_join`, `on_member_remove`, `on_member_update` → `members`
>    - `on_guild_join`, `on_guild_remove` → `guilds`
>    - `on_presence_update` → `presences`
>    - `on_typing` → `typing`
>
> 2. **Guild Permissions** - Based on actions performed. Reference:
>    - `channel.send()`, `interaction.response.send_message()` → `send_messages`
>    - Sending `discord.Embed` objects → `embed_links`
>    - Accessing `message.content` on old messages → `read_message_history`
>    - `member.kick()` → `kick_members`
>    - `member.ban()` → `ban_members`
>    - `member.add_roles()`, `member.remove_roles()` → `manage_roles`
>
> **Output a YAML file in this exact format:**
>
> ```yaml
> # Required permissions for [Bot Name]
> intents:
>   - intent_name  # Source: filename.py (event_name)
>
> permissions:
>   - permission_name  # Source: filename.py (action)
>
> strict_mode: false
> ```
>
> **Files to analyze:**
>
> [Paste your bot/cogs/*.py and bot/core/*.py file contents here]

---

### Best Practices

1. **Keep permissions minimal**: Only request what your bot actually needs.
2. **Use `strict_mode: false` in development**: Allows testing with partial permissions.
3. **Use `strict_mode: true` in production**: Ensures the bot fails fast if misconfigured.
4. **Document each permission**: Add comments explaining why each permission is needed.
