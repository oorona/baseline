# Plugin Development Guide

This guide explains how to add new functionality to the Baseline bot platform using the Plugin System.

## Overview

The system uses a "Plugin" architecture to keep bot-specific code separate from the baseline infrastructure. A complete feature typically consists of:

1.  **Backend Cog**: Adds commands and event listeners.
2.  **Frontend Plugin**: Adds UI pages, navigation, and settings.

## 1. Creating a Frontend Plugin

Frontend plugins allow you to add pages to the dashboard and custom settings.

### Step 1: Create the Plugin Definition

Create a file in `frontend/app/plugins/my-plugin.tsx`:

```tsx
import { Plugin } from './types'; // Correct import path
import MyPluginPage from './my-plugin-page'; // Your page component

export const myPlugin: Plugin = {
    id: 'my-feature',
    name: 'My Feature',
    
    // Links your page component to the dynamic route
    pageComponent: MyPluginPage, 

    // Add items to the Sidebar (Standard Route Pattern)
    navItems: [
        {
            name: 'My Feature',
            href: '/dashboard/[guildId]/plugins/my-feature',
            // icon: MyIcon // Optional Lucide icon
        }
    ],

    // Routes metadata (Required for internal routing logic)
    routes: [
         {
             path: '/dashboard/[guildId]/plugins/my-feature',
             component: MyPluginPage,
             title: 'My Feature'
         }
    ],

    // Optional: Add a Custom Settings Section in the Main Settings Page
    settingsComponent: ({ guildId, settings, onUpdate, isReadOnly }) => {
        return (
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                    My Custom Setting
                </label>
                <input
                    type="text"
                    value={settings.my_custom_key || ''}
                    onChange={(e) => onUpdate('my_custom_key', e.target.value)}
                    disabled={isReadOnly}
                    className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white"
                />
            </div>
        );
    }
};
```

### Step 2: Register the Plugin

Edit `frontend/app/plugins.ts` (The Registry File):

```typescript
// 1. Import your plugin definition
import { myPlugin } from './plugins/my-plugin';

// 2. Register it
pluginRegistry.register(myPlugin);
```

### Step 3: Create the Page Component (Dynamic Routing)

Instead of creating a new route file manually, you can use the dynamic plugin route system.

1.  **Create your Page Component**:
    Defined in `frontend/app/plugins/my-plugin-page.tsx`. This component receives `guildId` as a prop.

    ```tsx
    'use client';
    import { apiClient } from '@/app/api-client';
    
    export default function MyPluginPage({ guildId }: { guildId: string }) {
        // Fetch data using apiClient.getGuildRoles(guildId), etc.
        return <div>My Plugin Page</div>;
    }
    ```

2.  **Register the Page in Plugin Definition**:
    Update `frontend/app/plugins/my-plugin.tsx`:

    ```tsx
    import MyPluginPage from './my-plugin-page';

    export const myPlugin: Plugin = {
        id: 'my-feature',
        name: 'My Feature',
        pageComponent: MyPluginPage, // <--- Links the component to the dynamic route
        routes: [
             {
                 path: '/dashboard/[guildId]/plugins/my-feature',
                 component: MyPluginPage,
                 title: 'My Feature'
             }
        ],
        navItems: [
            {
                name: 'My Feature',
                href: '/dashboard/[guildId]/plugins/my-feature',
                icon: MyIcon
            }
        ],
        // ... settingsComponent
    };
    ```

This will automatically serve your page at `/dashboard/[guildId]/plugins/my-feature`.

## 2. Creating a Backend Cog

Create a python file in `bot/cogs/`:

```python
from discord.ext import commands
from services import BotServices

class MyCog(commands.Cog):
    def __init__(self, bot, services: BotServices):
        self.bot = bot
        self.services = services

    @commands.slash_command()
    async def mycommand(self, ctx):
        # Access settings defined in your frontend plugin
        settings = await self.services.db.get_guild_settings(ctx.guild.id)
        custom_value = settings.get('my_custom_key', 'default')
        
        await ctx.respond(f"Value is: {custom_value}")

async def setup(bot):
    await bot.add_cog(MyCog(bot, bot.services))
```
