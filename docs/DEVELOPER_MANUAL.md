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
| **0** | **PUBLIC** | Anonymous access. | Landing Page, Login, Docs. |
| **1** | **PUBLIC_DATA** | Read-only public API data. No login required. | Leaderboards, Server Stats. |
| **2** | **USER** | Logged-in user who is a **Member** of the guild. | Profile, Chat, Games. |
| **3** | **AUTHORIZED** | Logged-in user with **Admin/Mod** role in the guild. | Bot Settings, Moderation. |
| **4** | **OWNER** | The **Owner** of the Discord Guild. | Permission Management, Sensitive Config. |
| **5** | **DEVELOPER** | Platform Administrator (You). | Platform Debug, AI Analytics. |

### Implementing Security
*   **Frontend**: Wrap pages with `withPermission(Component, PermissionLevel.LEVEL)`.
*   **Backend**: Use dependencies `Depends(get_current_user)` and check privileges manually or via helper decorators (to be implemented).
*   **Cards**: Set the `level` property in `frontend/app/page.tsx` card definitions.

---

## 4. Plugin Workflow (How to Add Features)

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
