# Plugin Generation Rules for LLMs

This document defines the strict rules and algorithms a Future LLM must follow when asked to "create a plugin" or "add a feature" to this codebase.

## 1. Context Awareness

Before generating code, you must understand that this platform consists of two distinct parts that must be kept in sync:
1.  **Frontend (Next.js)**: Handling UI, Navigation, and Settings.
2.  **Backend (Discord Bot)**: Handling Logic, Commands, and Events.

## 2. Strict Rules

### Rule 1: Isolation
-   **NEVER** modify `bot/core/*.py` or `frontend/app/layout.tsx` directly to add a feature.
-   **ALWAYS** wrap frontend logic in a `Plugin` definition.
-   **ALWAYS** wrap backend logic in a `Cog`.

### Rule 2: Naming Conventions
-   **Plugin ID**: Must be kebab-case (e.g., `music-player`, `moderation-tools`).
-   **Settings Keys**: Must use snake_case and be prefixed with the plugin ID to avoid collisions (e.g., `music_volume_limit`, `mod_log_channel`).
-   **File Paths**:
    -   Frontend Plugin Definition: `frontend/app/plugins/<plugin-id>.tsx`
    -   Backend Cog: `bot/cogs/<plugin_id>.py` (snake_case)

### Rule 3: Frontend Registration
-   You **MUST** register your plugin in `frontend/app/plugins/registry.tsx`.
-   You **MUST** use the `pluginRegistry.register()` method.

### Rule 4: Settings Persistence
-   The backend stores settings as a JSON blob (`Dict[str, Any]`).
-   Your frontend settings component must use the `onUpdate(key, value)` callback provided in props.
-   Your backend cog must fetch settings via `await self.services.db.get_guild_settings(guild_id)`.

## 3. Implementation Algorithm

When asked to create a feature (e.g., "Add a Welcome Message feature"), follow this exact sequence:

### Step 1: Define the Backend Cog
1.  Create `bot/cogs/welcome.py`.
2.  Define the class `Welcome(commands.Cog)`.
3.  Inject `BotServices` in `__init__`.
4.  Implement logic using `self.services.db` and `self.services.llm` if needed.
5.  Access settings via `self.services.db.get_guild_settings`.

### Step 2: Define the Frontend Plugin
1.  Create `frontend/app/plugins/<plugin-id>.tsx`.
2.  If a full page is needed, create `frontend/app/plugins/<plugin-id>-page.tsx`.
3.  Export a `Plugin` object with `id`.
4.  **CRITICAL**: If using settings, use `settingsComponent` and fetch data (roles/channels) via `apiClient`. DO NOT ask users to manually input IDs.
5.  **CRITICAL**: If needing a page, use `pageComponent` and point `navItems` to `/dashboard/[guildId]/plugins/<plugin-id>`.

### Step 3: Register the Plugin
1.  Append an import to `frontend/app/plugins/registry.tsx`.
2.  Call `pluginRegistry.register(welcomePlugin)` inside the `registerPlugins` function.

### Step 4: Verify Backend Integration
1.  Ensure `api-client.ts` has methods to fetch any required data (e.g., `getGuildRoles`).
2.  Ensure backend cogs expose necessary endpoints if standard ones are insufficient.

## 4. Code Templates

### Backend Cog Template
```python
from discord.ext import commands
from services import BotServices

class FeatureName(commands.Cog):
    def __init__(self, bot, services: BotServices):
        self.bot = bot
        self.services = services

    @commands.Cog.listener()
    async def on_message(self, message):
        # Fetch settings properly
        settings = await self.services.db.get_guild_settings(message.guild.id)
        if not settings.get('feature_enabled', False):
            return
            
async def setup(bot):
    await bot.add_cog(FeatureName(bot, bot.services))
```

### Frontend Plugin Template
```tsx
import { Plugin } from '../plugins';

export const featurePlugin: Plugin = {
    id: 'feature-name',
    name: 'Feature Name',
    // Only if you need a custom page
    navItems: [
        { name: 'Dashboard', href: '/guilds/[guildId]/feature' }
    ],
    // Configuration UI
    settingsComponent: ({ settings, onUpdate, isReadOnly }) => (
        <div className="space-y-4">
             <h3 className="text-lg font-medium text-white">Feature Settings</h3>
             <div className="space-y-2">
                <label className="text-sm text-gray-400">Enable Feature</label>
                <input 
                    type="checkbox"
                    checked={settings.feature_enabled || false}
                    onChange={e => onUpdate('feature_enabled', e.target.checked)}
                    disabled={isReadOnly}
                />
             </div>
        </div>
    )
};
```
