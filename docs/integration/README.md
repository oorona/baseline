# Integration Guides

**For AI Assistants and Developers**: These guides explain how to extend the Baseline framework with custom functionality.

## Quick Start

If you're an **LLM/AI assistant** helping to extend this framework, start here:

1. [Adding Bot Cogs](01-adding-cogs.md) - Add Discord commands
2. [LLM Integration](02-llm-integration.md) - Use AI features
3. [Logging & Environment](03-logging-environment.md) - Configuration and logging
4. [Backend Endpoints](04-backend-endpoints.md) - Add REST APIs
5. [Frontend Pages](05-frontend-pages.md) - Add web UI
6. [Bot Configuration](06-bot-configuration.md) - Load bot-specific config

## Architecture

For a complete understanding of the system design, see:
- [Architecture Documentation](../ARCHITECTURE.md) - System design and plugin architecture

## Common Tasks

### I want to add a new Discord command

→ See [Adding Bot Cogs](01-adding-cogs.md)

### I want to use AI/LLM features

→ See [LLM Integration](02-llm-integration.md)

### I want to add a new API endpoint

→ See [Backend Endpoints](04-backend-endpoints.md)

### I want to add a new settings page

→ See [Frontend Pages](05-frontend-pages.md)

### I want to configure my bot

→ See [Bot Configuration](06-bot-configuration.md)

### I want to add logging

→ See [Logging & Environment](03-logging-environment.md)

## Extension Points Summary

| Component | Extension Point | Guide |
|-----------|----------------|-------|
| **Bot** | Add commands | [01-adding-cogs.md](01-adding-cogs.md) |
| **Bot** | Use LLM | [02-llm-integration.md](02-llm-integration.md) |
| **Bot** | Configuration | [06-bot-configuration.md](06-bot-configuration.md) |
| **Backend** | Add API endpoints | [04-backend-endpoints.md](04-backend-endpoints.md) |
| **Frontend** | Add pages | [05-frontend-pages.md](05-frontend-pages.md) |
| **All** | Logging | [03-logging-environment.md](03-logging-environment.md) |

## Example: Adding a Complete Feature

Let's say you want to add a "Polls" feature:

### 1. Bot Cog (Discord Commands)

```python
# bot/cogs/polls.py
@app_commands.command()
async def create_poll(self, interaction, question: str, options: str):
    # Create poll
    pass
```

→ Full guide: [01-adding-cogs.md](01-adding-cogs.md)

### 2. Backend API (Store Poll Data)

```python
# backend/app/api/polls.py
@router.post("/{guild_id}/polls")
async def create_poll(guild_id: int, poll: PollCreate):
    # Store in database
    pass
```

→ Full guide: [04-backend-endpoints.md](04-backend-endpoints.md)

### 3. Frontend Page (View Results)

```typescript
// frontend/app/dashboard/[guildId]/polls/page.tsx
export default function PollsPage() {
    // Display poll results
}
```

→ Full guide: [05-frontend-pages.md](05-frontend-pages.md)

## Best Practices

1. **Read the Architecture Guide First**: Understand the system design
2. **Follow Existing Patterns**: Study existing code before creating new features
3. **Test Locally**: Use `make up` to run the full stack
4. **Use TypeScript/Type Hints**: Maintain type safety
5. **Log Important Events**: Use structured logging
6. **Handle Errors**: Always provide user-friendly error messages
7. **Document Your Code**: Add docstrings and comments

## Getting Help

- **Check Examples**: All guides include working code examples
- **Review Existing Code**: Study similar features already implemented
- **Architecture Doc**: See [ARCHITECTURE.md](../ARCHITECTURE.md) for system design
- **README**: See [README.md](../../README.md) for setup instructions

## Quick Reference

### Bot Development

```python
# Import necessary modules
import discord
from discord import app_commands
from discord.ext import commands
import structlog

logger = structlog.get_logger()

class MyCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        
    @app_commands.command()
    async def mycommand(self, interaction: discord.Interaction):
        await interaction.response.send_message("Hello!")

async def setup(bot):
    await bot.add_cog(MyCog(bot))
```

### Backend Development

```python
# Import FastAPI dependencies
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

@router.get("/myendpoint")
async def my_endpoint(db: AsyncSession = Depends(get_db)):
    return {"message": "Hello"}
```

### Frontend Development

```typescript
'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/app/api-client';

export default function MyPage() {
    const [data, setData] = useState(null);
    
    useEffect(() => {
        const fetchData = async () => {
            const result = await apiClient.getMyData();
            setData(result);
        };
        fetchData();
    }, []);
    
    return <div>{/* Your UI */}</div>;
}
```

## Contributing

When adding features to the baseline framework:

1. Follow the established patterns
2. Add tests for new functionality
3. Update documentation
4. Create a migration if modifying database
5. Test with `make up` and `make prod`

---

**Need more help?** Check the architecture guide or existing code examples.
