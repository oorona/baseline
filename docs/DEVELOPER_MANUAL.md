# Baseline Framework: Developer & Agent Manual

## 1. Introduction
This documentation is the **authoritative source** for developers and AI Agents working on the Baseline Framework. It consolidates architecture, security, and plugin workflows.

### Core Philosophy
- **Core Framework**: The underlying "Operating System" (Auth, Database, Navigation, Layouts). **DO NOT MODIFY** unless fixing a framework bug.
- **Sample/User Code**: The specific bot implementation. The current codebase contains **Sample Code** (e.g., `status.py`, `test-l1` pages) to demonstrate functionality. You are expected to replace or extend this with your own features.

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
*   `bot/cogs/status.py` (Sample Cog)
*   `bot/cogs/logging.py` (Sample Cog)

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

## 5. Cleaning Up (Shipping)
When shipping a real bot:
1.  Delete `test-l1` and `test-l2` folders.
2.  Replace `status.py` and `logging.py` with your actual bot logic.
3.  Keep `guild_sync.py` and `introspection.py` (Core).
