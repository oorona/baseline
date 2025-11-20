# Implementation Plan - Phase 2: Authentication & Authorization

## Goal
Implement the core authentication and authorization system for the platform, enabling Discord OAuth login, user session management, and basic permission tracking.

## User Review Required
> [!IMPORTANT]
> This phase introduces new database tables (`users`, `guilds`, `authorized_users`) and API endpoints. The existing `SimpleLLMCog` will continue to work but will eventually need to be updated to use the new permission system.

## Proposed Changes

### Database Schema
#### [NEW] [backend/app/models.py](file:///home/iktdts/projects/apps/baseline/backend/app/models.py)
- Create SQLAlchemy models:
    - `User`: Stores Discord user info.
    - `Guild`: Stores Discord guild info.
    - `AuthorizedUser`: Links users to guilds with permission levels.

### Backend API
#### [MODIFY] [backend/main.py](file:///home/iktdts/projects/apps/baseline/backend/main.py)
- Add `AuthMiddleware` for session handling.
- Register new routers.

#### [NEW] [backend/app/api/auth.py](file:///home/iktdts/projects/apps/baseline/backend/app/api/auth.py)
- `GET /api/v1/auth/discord/login`: Redirects to Discord OAuth.
- `GET /api/v1/auth/discord/callback`: Handles OAuth callback, creates session.
- `GET /api/v1/auth/me`: Returns current authenticated user.
- `POST /api/v1/auth/logout`: Clears session.

### Bot Integration
#### [MODIFY] [bot/main.py](file:///home/iktdts/projects/apps/baseline/bot/main.py)
- Add listeners for `on_guild_join` and `on_guild_remove` to sync guild data to DB.

## Verification Plan

### Automated Tests
- Unit tests for auth endpoints (mocking Discord API).
- Integration tests for database models.

### Manual Verification
1.  **OAuth Flow**: Navigate to `/api/v1/auth/discord/login` -> Verify redirect to Discord -> Verify callback -> Verify session cookie set.
2.  **Session Check**: Call `/api/v1/auth/me` and verify user data is returned.
3.  **Database Sync**: Add bot to a new server -> Verify guild is added to `guilds` table.
