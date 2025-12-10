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
import { Plugin } from '../plugins';

export const myPlugin: Plugin = {
    id: 'my-feature',
    name: 'My Feature',
    
    // Add items to the Sidebar
    navItems: [
        {
            name: 'My Page',
            href: '/guilds/[guildId]/my-page',
            // icon: MyIcon // Optional Lucide icon
        }
    ],

    // Add routes (Note: Next.js App Router uses file-system routing, 
    // so this is mostly for metadata, but future extensions might use it)
    routes: [],

    // Add a Custom Settings Section
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

Edit `frontend/app/plugins/registry.tsx`:

```tsx
import { registerPlugins } from '../plugins';
import { myPlugin } from './my-plugin';

export function registerPlugins() {
    pluginRegistry.register(myPlugin);
}
```

### Step 3: Create the Page (Next.js App Router)

Since we use Next.js App Router, you must physically create the page file.

Create `frontend/app/dashboard/[guildId]/my-page/page.tsx`:

```tsx
'use client';

export default function MyPage({ params }: { params: { guildId: string } }) {
    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold">My Custom Page</h1>
            <p>Guild ID: {params.guildId}</p>
        </div>
    );
}
```

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
