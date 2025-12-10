# Baseline Bot Platform Walkthrough

This document outlines the implemented baseline architecture and the Simple LLM Bot.

## 1. Architecture Overview

The platform consists of the following Docker services:
- **backend**: FastAPI service for API endpoints (port 8000).
- **bot**: Discord bot service using `discord.py` (port 8080 for health).
- **frontend**: Next.js web interface (port 3000).
- **postgres**: Database for persistent storage.
- **redis**: Cache and session storage.

## 2. Simple LLM Bot

A simple bot implementation has been added to `bot/cogs/simple_llm.py`.

### Features
- Listens for messages from a specific user (configurable via `TARGET_USER_ID`).
- Generates responses using an LLM (OpenAI).
- Responds directly to the user in Discord.

### Configuration
To configure the target user, add `TARGET_USER_ID` to your `.env` file or environment variables.

## 3. Running the Platform

### Prerequisites
- Docker and Docker Compose installed.
- Discord Bot Token and Client Secret.
- OpenAI API Key (optional, uses dummy by default).

### Setup
1.  **Secrets**: Run `bash setup_secrets.sh` to generate dummy secrets for development. Update `secrets/discord_bot_token.txt` and `secrets/openai_api_key.txt` with real credentials.
2.  **Environment**: Ensure `.env` exists (copied from `.env.example`). Update `DATABASE_URL` and `REDIS_URL` if not using the default docker-compose values.

### Start Services
```bash
docker compose up -d
```

### Verify
- **Frontend**: http://localhost:3000
- **Backend Health**: http://localhost:8000/api/v1/health
- **Bot Health**: http://localhost:8080/health

## 4. Development

- **Backend**: Code in `backend/`.
- **Bot**: Code in `bot/`. Add new cogs in `bot/cogs/`.
- **Frontend**: Code in `frontend/`.

## 5. Phase 2: Authentication & Authorization

The platform now includes a complete authentication system using Discord OAuth2.

### Features
- **Discord Login**: Users can log in via Discord to access the dashboard.
- **Session Management**: Secure sessions stored in Redis with HTTP-only cookies.
- **Guild Sync**: The bot automatically syncs joined guilds to the database.
- **Authorization**: Role-based access control (Owner, Admin, User) for guild management.

### Database Schema
New tables added:
- `users`: Stores Discord user profiles.
- `guilds`: Stores Discord server information.
- `authorized_users`: Maps users to guilds with permission levels.
- `guild_settings`: Stores JSON-based settings for each guild.

### API Endpoints
- `GET /api/v1/auth/discord/login`: Initiates OAuth flow.
- `GET /api/v1/auth/me`: Returns current user info.
- `POST /api/v1/guilds/`: Used by the bot to sync guild data.

## 6. Phase 3: Settings Management & LLM Integration

Users can now configure bot behavior per guild.

### Features
- **Settings Dashboard**: New UI for managing guild settings.
- **Channel Restrictions**: Restrict bot chat to specific channels.
- **Custom System Prompts**: Define the bot's personality per guild.
- **Model Selection**: Choose between OpenAI, Anthropic, Google, or xAI models.

### Implementation Details
- **Frontend**: Added `dashboard` layout and `settings` page.
- **Backend**: Updated `GuildSettings` schema and API endpoints.
- **Bot**: Updated `Chat` cog to fetch and apply settings dynamically.

## 7. Phase 4: System Status & Shard Monitoring

Admins can now monitor the health and status of bot shards in real-time.

### Features
- **Shard Monitor**: View status (Ready, Connecting, Disconnected) of all shards.
- **Latency Tracking**: Real-time latency metrics for each shard.
- **Guild Distribution**: See which guilds are on which shard.
- **Admin Security**: Restricted access to status endpoints.

### Implementation Details
- **Frontend**: Moved status page to `/dashboard/status` and added sidebar link.
- **Backend**: Added admin check to `/api/v1/shards` endpoint.

## 8. Phase 5: Audit Logs

Admins can now track all changes made to guild settings and authorized users.

### Features
- **Audit Log Table**: View a history of actions (Update Settings, Add/Remove User).
- **Detailed Records**: See exactly what changed (e.g., which settings were modified).
- **User Tracking**: Identify who performed each action.

### Implementation Details
- **Database**: Added `audit_logs` table.
- **Backend**: Updated endpoints to record actions automatically.
- **Frontend**: Added `Audit Logs` page to the dashboard.

## 9. Phase 6: Granular Permissions

Access control is now enforced based on user roles (`OWNER`, `ADMIN`, `USER`).

### Features
- **Role-Based Access**:
    - **OWNER**: Full access.
    - **ADMIN**: Can manage settings, users, and view logs.
    - **USER**: Read-only access to settings.
- **UI Adaptation**: Dashboard automatically hides restricted actions based on your role.

### Implementation Details
- **Backend**: Added permission checks to all write endpoints.
- **Frontend**: Updated `Settings` page to read-only mode for non-admins.

## 10. Phase 7: Production Readiness

The platform is now production-ready with deployment tooling and configurations.

### Features
- **Production Config**: `docker-compose.prod.yml` with restart policies and resource limits.
- **Makefile**: Common commands (`make up`, `make prod`, `make logs`, etc.).
- **Deployment Script**: Automated deployment with `./scripts/deploy.sh`.
- **Documentation**: Comprehensive README with setup and deployment instructions.

### Implementation Details
- **Configuration**: Production-specific Docker Compose override.
- **Tooling**: Makefile and bash script for streamlined operations.

## 11. Phase 8: Integration Documentation

Comprehensive documentation for extending the framework with custom functionality.

### Documentation Created

**For AI Assistants (LLM Integration Guides)**:
1. **Adding Bot Cogs** - How to create Discord commands
2. **LLM Integration** - Using AI features in your bot
3. **Logging & Environment** - Configuration and structured logging
4. **Backend Endpoints** - Adding REST APIs
5. **Frontend Pages** - Creating web UI pages
6. **Bot Configuration** - Loading bot-specific settings

**For Developers**:
- **Architecture Guide** - Complete system design and plugin architecture
- **Integration README** - Quick reference and common tasks

### Implementation Details
- Created `docs/integration/` directory with 6 detailed guides
- Each guide includes working code examples
- Added `docs/ARCHITECTURE.md` explaining the overall system
- Documentation is optimized for both human and AI consumption

## 12. Next Steps
- Set up real API keys in `secrets/`
- Deploy to a production server
- Build custom features using the integration guides
