# Baseline Framework: Security Reference

**Read this before forking or deploying.** This document is the definitive security reference for the Baseline framework. Every developer working on a bot built on this framework must understand the security model before adding new pages, endpoints, or commands.

---

## Table of Contents

1. [Security Levels (L0–L5)](#1-security-levels-l0l5)
2. [Implementing Security on Every Layer](#2-implementing-security-on-every-layer)
3. [Authentication Architecture](#3-authentication-architecture)
4. [Defense-in-Depth Layers](#4-defense-in-depth-layers)
5. [Security Checklist Before Going Live](#5-security-checklist-before-going-live)
6. [Known Production Hardening Requirements](#6-known-production-hardening-requirements)
7. [Security Rules for New Features](#7-security-rules-for-new-features)

---

## 1. Security Levels (L0–L5)

The framework enforces a **6-tier permission model**. Every page, endpoint, and bot command **must be explicitly assigned a level**. There is no implicit security — default to L3 when unsure.

| Level | Name | Who Can Access | Typical Use |
|-------|------|---------------|-------------|
| **L0** | **Public** | Anyone, no auth | Landing page, login, public docs |
| **L1** | **Public Data** | Anyone, no auth | Read-only stats, leaderboards (no PII) |
| **L2** | **User** | Any logged-in user (configurable via guild roles) | Dashboard home, read-only guild stats |
| **L3** | **Authorized** | Explicitly authorized users/roles per guild | Bot settings, moderation commands |
| **L4** | **Owner** | Guild owner only | Permission management, billing, destructive config |
| **L5** | **Developer** | Platform administrators only | Platform debug, LLM analytics, all-guild access |

### Level Definitions

#### L0 — Public
No authentication required. Safe for static content with no sensitive data.

```typescript
// Frontend: no wrapper needed, but be explicit
export default function LandingPage() {
    return <div>Anyone can see this</div>;
}
```

```python
# Backend: no auth dependency
@router.get("/public/status")
async def public_status():
    return {"status": "ok"}
```

---

#### L1 — Public Data
No authentication required. Read-only, non-sensitive aggregated data only. Never expose user IDs, tokens, or PII.

```typescript
// Frontend: no wrapper — but document it clearly
// Level 1: Public read-only data, no auth required
export default function LeaderboardPage() {
    return <div>Public stats</div>;
}
```

```python
# Backend: no auth dependency, but return only aggregated/public data
@router.get("/guilds/{guild_id}/public")
async def public_guild_info(guild_id: int, db: AsyncSession = Depends(get_db)):
    # Only return non-sensitive public fields
    return {"name": guild.name, "member_count": guild.member_count}
```

---

#### L2 — User (Login Required)
Requires a valid session. Access can be further restricted by guild settings (e.g., specific roles). Used for any page that displays guild-specific data.

```typescript
// Frontend: wrap with withPermission at USER level
'use client';
import { withPermission } from '@/lib/components/with-permission';
import { PermissionLevel } from '@/lib/permissions';

function GuildDashboard() {
    return <div>Member-only content</div>;
}

export default withPermission(GuildDashboard, PermissionLevel.USER);
```

```python
# Backend: require authentication
from app.api.deps import get_current_user

@router.get("/guilds/{guild_id}/stats")
async def guild_stats(
    guild_id: int,
    current_user: dict = Depends(get_current_user),  # L2: login required
    db: AsyncSession = Depends(get_db)
):
    # Verify user has access to this guild (check authorized_users or guild membership)
    ...
```

---

#### L3 — Authorized (Strictly Controlled)
Requires explicit authorization: the user must be in the `authorized_users` table for that guild, or have an `authorized_role`. **Default for all write operations and bot settings.**

```typescript
// Frontend: wrap at AUTHORIZED level
'use client';
import { withPermission } from '@/lib/components/with-permission';
import { PermissionLevel } from '@/lib/permissions';

function BotSettingsPage() {
    return <div>Bot configuration</div>;
}

export default withPermission(BotSettingsPage, PermissionLevel.AUTHORIZED);
```

```python
# Backend: check authorization level
from app.api.deps import get_current_user
from sqlalchemy import select
from app.models import AuthorizedUser, PermissionLevel as DBPermLevel

@router.put("/guilds/{guild_id}/settings")
async def update_settings(
    guild_id: int,
    settings: SettingsUpdate,
    current_user: dict = Depends(get_current_user),  # requires login
    db: AsyncSession = Depends(get_db)
):
    user_id = int(current_user["user_id"])

    # L3: check explicit authorization
    auth = await db.execute(
        select(AuthorizedUser).where(
            AuthorizedUser.guild_id == guild_id,
            AuthorizedUser.user_id == user_id,
            AuthorizedUser.permission_level.in_([
                DBPermLevel.ADMIN, DBPermLevel.OWNER
            ])
        )
    )
    if not auth.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized")
    ...
```

---

#### L4 — Owner
Guild owner only. For destructive or irreversible actions: deleting the bot from a guild, managing who has admin access, sensitive config.

```typescript
// Frontend
export default withPermission(PermissionsPage, PermissionLevel.OWNER);
```

```python
# Backend: check guild owner
@router.delete("/guilds/{guild_id}/authorized-users/{user_id}")
async def remove_authorized_user(
    guild_id: int,
    user_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    guild = await db.get(Guild, guild_id)
    if not guild:
        raise HTTPException(status_code=404)

    # L4: owner only
    if guild.owner_id != int(current_user["user_id"]):
        raise HTTPException(status_code=403, detail="Guild owner only")
    ...
```

---

#### L5 — Developer (Platform Admin)
Platform administrators only. Full access across all guilds. Used for platform-level operations (shard monitoring, LLM cost analytics, global settings).

```typescript
// Frontend
export default withPermission(PlatformPage, PermissionLevel.DEVELOPER);
```

```python
# Backend: use verify_platform_admin dependency
from app.api.deps import verify_platform_admin

@router.get("/platform/settings")
async def platform_settings(
    current_user: dict = Depends(verify_platform_admin)  # L5: platform admin only
):
    ...
```

---

## 2. Implementing Security on Every Layer

Security is enforced at **three independent layers** for every feature. All three must be implemented — backend enforcement is mandatory, frontend is defense-in-depth for UX.

```
Request → [L1: Frontend route guard] → [L2: Nginx rate limit] → [L3: Backend auth dependency]
```

### Frontend Layer (UX Guard)

Every dashboard page **must** use `withPermission`:

```typescript
// CORRECT
export default withPermission(MyPage, PermissionLevel.AUTHORIZED);  // L3

// WRONG — never expose a page without permission wrapper
export default MyPage;
```

The `withPermission` HOC:
- Reads the user's permission level from the auth context
- Redirects to `/access-denied` if insufficient permission
- Shows loading state during auth check

### Backend Layer (Enforcement — Mandatory)

Frontend checks can be bypassed by API calls. **The backend is the only real enforcement point.**

```python
# Every endpoint that touches guild data needs BOTH:
# 1. Authentication (get_current_user)
# 2. Authorization (check the user's level for THIS guild)

@router.post("/guilds/{guild_id}/features")
async def create_feature(
    guild_id: int,
    data: FeatureCreate,
    current_user: dict = Depends(get_current_user),  # Step 1: Must be logged in
    db: AsyncSession = Depends(get_db)
):
    # Step 2: Must have the right level for this guild
    await require_guild_permission(guild_id, current_user["user_id"], db, min_level="admin")
    ...
```

### Navigation Layer (Visibility)

Set the `level` property on navigation cards so they're hidden from users who can't access them:

```typescript
// In dashboard navigation
const navItems = [
    { label: "Stats", href: "/stats", level: PermissionLevel.USER },          // L2
    { label: "Settings", href: "/settings", level: PermissionLevel.AUTHORIZED }, // L3
    { label: "Permissions", href: "/permissions", level: PermissionLevel.OWNER }, // L4
    { label: "Platform", href: "/platform", level: PermissionLevel.DEVELOPER },  // L5
];
```

---

## 3. Authentication Architecture

### Token Flow

```
User → Discord OAuth2 → /auth/discord/callback
                              ↓
              Generate UUID api_token
              Hash → UserToken (DB, persistent)
              Store raw → Redis session:{token} (30-day TTL)
              Return token to frontend (localStorage)
                              ↓
Every request: Authorization: Bearer {token}
              → Check Redis (fast path)
              → If Redis miss: check DB, restore Redis (self-healing)
              → Check revocation marker
              → Return user_data dict
```

### Session Data Structure

Each Redis session stores:

```json
{
    "user_id": "123456789",
    "username": "username",
    "access_token": "discord_access_token",
    "refresh_token": "discord_refresh_token",
    "expires_at": 1234567890.0,
    "token_db_id": 42,
    "token_created_at": 1234567890.0
}
```

`token_created_at` is used for immediate revocation via `logout-all`.

### Immediate Revocation (logout-all)

When `/auth/logout-all` is called:
1. All `UserToken` records for the user are deleted from DB
2. `user:revoked_at:{user_id}` is set in Redis with the current timestamp (TTL: 30 days)
3. On every subsequent request, `get_current_user` checks if `token_created_at < revoked_at` → 401

This provides **immediate** invalidation of all active sessions, even those still present in Redis.

### Multi-Device Sessions

Each device gets its own `UserToken` record. `/auth/logout` removes only the current device's token. `/auth/logout-all` removes all devices immediately.

---

## 4. Defense-in-Depth Layers

The framework enforces security at 6 independent layers. An attacker must bypass all of them.

```
Internet
    │
    ▼
[Layer 1: Network Isolation]
    Docker networks: backend is NOT on the internet network.
    Only nginx gateway is public-facing on port 8000.
    │
    ▼
[Layer 2: Nginx Gateway]
    Rate limiting zones (auth: 3/s, gemini: 5/s, api: 10/s)
    Security headers (X-Frame-Options, HSTS, CSP, etc.)
    Sets X-Gateway-Request: true header on all proxied requests
    │
    ▼
[Layer 3: SecurityMiddleware]
    Validates X-Gateway-Request header OR internal Docker IP
    Blocks external access to /api/v1/gemini/* and /api/v1/llm/*
    Logs all blocked attempts with client info
    │
    ▼
[Layer 4: Authentication]
    get_current_user() — validates Bearer token or Bot token
    Checks Redis → DB fallback (self-healing sessions)
    Checks immediate revocation marker (logout-all)
    Refreshes Discord OAuth tokens automatically
    │
    ▼
[Layer 5: Rate Limiting (slowapi)]
    Per-endpoint rate limits enforced at backend level
    Applies even if nginx is bypassed (internal calls)
    │
    ▼
[Layer 6: Authorization]
    Per-endpoint permission checks (guild owner, authorized user/role)
    verify_platform_admin() for L5 endpoints
    Audit log written for all mutating operations
```

---

## 5. Security Checklist Before Going Live

Run through this checklist before deploying a new bot or after making changes.

### Secrets & Configuration

- [ ] All secrets are in `secrets/` files, never in `.env` or docker-compose.yml plaintext
- [ ] `DISCORD_CLIENT_SECRET` is set correctly
- [ ] `API_SECRET_KEY` is a strong random value (32+ bytes)
- [ ] `DISCORD_BOT_TOKEN` is loaded from Docker secret
- [ ] `FRONTEND_URL` is set to the production domain (used for OAuth redirect and postMessage origin)
- [ ] `DISCORD_GUILD_ID` and `DEVELOPER_ROLE_ID` are set for L5 admin access

### Every New Frontend Page

- [ ] Page is wrapped with `withPermission(Component, PermissionLevel.LEVEL)`
- [ ] Permission level matches the sensitivity of the data shown
- [ ] Write actions use L3 (AUTHORIZED) or higher
- [ ] Navigation item has the correct `level` set to hide from unauthorized users

### Every New Backend Endpoint

- [ ] `Depends(get_current_user)` is present on all non-public endpoints
- [ ] Authorization check (guild-level) is performed after authentication
- [ ] Input is validated with a Pydantic schema (no raw `Dict[str, Any]` for sensitive fields)
- [ ] Rate limiting decorator is present (`@limiter.limit("X/minute")`)
- [ ] Audit log entry is written for all mutating operations
- [ ] `@require_internal_network` is used for bot-only or admin-only internal endpoints

### Every New Bot Command

- [ ] Command checks `interaction.guild` before accessing guild data
- [ ] Guild settings are fetched from backend, not hardcoded
- [ ] Sensitive commands check Discord role/permission before executing
- [ ] Errors are caught and user-friendly messages are returned

### Network & Infrastructure

- [ ] HTTPS/TLS is configured in production (nginx with SSL certificates)
- [ ] `secure=True` is set on cookies in production (`auth.py` line ~251)
- [ ] CSP `unsafe-inline`/`unsafe-eval` is removed for production nginx config
- [ ] PostgreSQL port `5432` is NOT exposed to the host
- [ ] Redis port `6379` is NOT exposed to the host

---

## 6. Known Production Hardening Requirements

These are items that are acceptable in development but **must** be addressed before production.

| Issue | Location | Action Required |
|-------|----------|----------------|
| Cookie `secure=False` | `backend/app/api/auth.py:~251` | Set `secure=True` when HTTPS is enabled |
| CSP `unsafe-inline`/`unsafe-eval` | `gateway/nginx.conf` | Remove for production; use nonces |
| No HTTPS termination | `docker-compose.yml` | Add SSL certificates + nginx HTTPS block |
| Admin check hits Discord API live | `backend/app/api/deps.py:check_is_admin` | Cache result in Redis for 5 minutes |
| Expired `UserToken` rows not cleaned up | `backend/app/models.py` | Add scheduled cleanup task (cron or celery) |
| No HMAC signing on bot→backend calls | `bot/cogs/guild_sync.py` | Add `X-Bot-Signature` header |
| Refresh token stored in plaintext | `backend/app/models.py:User.refresh_token` | Encrypt with a data encryption key |

---

## 7. Security Rules for New Features

When developing a new feature (cog + endpoint + page), enforce these rules:

### Rule 1: Backend is the source of truth
The frontend permission check is for UX only. Always validate at the backend. A user who calls the API directly bypasses the frontend entirely.

### Rule 2: Default to L3 (Authorized)
If you're unsure what level a page should be, use `PermissionLevel.AUTHORIZED`. It's easier to relax security than to tighten it after data has been exposed.

### Rule 3: Read = L2, Write = L3
- Displaying data to authenticated users → L2 (User)
- Modifying any configuration or data → L3 (Authorized) minimum

### Rule 4: Always validate guild membership
When an endpoint takes a `guild_id` parameter, always verify the requesting user has access to that guild. Never trust the `guild_id` in the URL alone.

```python
# WRONG — trusts guild_id without checking membership
@router.get("/guilds/{guild_id}/data")
async def get_data(guild_id: int, current_user: dict = Depends(get_current_user)):
    return await db.get(Data, guild_id)  # Any logged-in user can access any guild!

# CORRECT — validates membership
@router.get("/guilds/{guild_id}/data")
async def get_data(
    guild_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    user_id = int(current_user["user_id"])
    auth = await db.execute(
        select(AuthorizedUser).where(
            AuthorizedUser.guild_id == guild_id,
            AuthorizedUser.user_id == user_id
        )
    )
    if not auth.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized for this guild")
    ...
```

### Rule 5: Audit log all mutations
Any endpoint that changes state must write an audit log entry:

```python
audit = AuditLog(
    guild_id=guild_id,
    user_id=int(current_user["user_id"]),
    action="UPDATE_FEATURE_SETTINGS",
    details={"changed": data.model_dump()}
)
db.add(audit)
await db.commit()
```

### Rule 6: Validate and sanitize all input
Use strict Pydantic schemas for all API input. Avoid `Dict[str, Any]` for sensitive data. Set max lengths on string fields.

```python
# WRONG
class Settings(BaseModel):
    config: Dict[str, Any]  # accepts anything

# CORRECT
class FeatureSettings(BaseModel):
    enabled: bool
    channel_id: Optional[int] = None
    prefix: str = Field(default="!", max_length=5, pattern=r"^[!?./]{1,5}$")
```
