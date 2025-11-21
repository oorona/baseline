# API Routing Reference

## Backend API Endpoints

All backend API endpoints are prefixed with `/api/v1`.

### Authentication
- `POST /api/v1/auth/discord/login` - Initiate Discord OAuth
- `GET /api/v1/auth/discord/callback` - OAuth callback
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/logout` - Logout

### Guilds
- `GET /api/v1/guilds` - List all guilds user has access to
- `GET /api/v1/guilds/{guild_id}` - Get specific guild

### Settings
- `GET /api/v1/guilds/{guild_id}/settings` - Get guild settings
- `PUT /api/v1/guilds/{guild_id}/settings` - Update guild settings
  - Body: `{ "settings": { ... } }`

### Permissions
- `GET /api/v1/guilds/{guild_id}/authorized-users` - List authorized users
- `POST /api/v1/guilds/{guild_id}/authorized-users` - Add authorized user
  - Body: `{ "user_id": 123456789 }`
- `DELETE /api/v1/guilds/{guild_id}/authorized-users/{user_id}` - Remove user

### Shards
- `GET /api/v1/shards` - List all shards
- `GET /api/v1/shards/{shard_id}` - Get specific shard

### Health
- `GET /api/v1/health` - Health check

## Frontend Routes

Frontend pages are served by Next.js:

- `/` - Home page
- `/guilds/[guildId]/settings` - Guild settings page
- `/guilds/[guildId]/permissions` - Permission management page
- `/admin/shards` - Shard monitor (admin only)

## Important Notes

1. **Frontend API Client**: The frontend should ALWAYS use the `apiClient` from `/app/api-client.ts` to  make backend requests. Never access backend endpoints directly from browser location.

2. **CORS**: Backend is configured to accept requests from `http://localhost:3000` (frontend).

3. **Authentication**: All API endpoints (except login/callback) require authentication via JWT token or session cookie.

4. **Development URLs**:
   - Frontend: `http://localhost:3000`
   - Backend API: `http://localhost:8000/api/v1`
   - Bot Health: `http://localhost:8001/health`
