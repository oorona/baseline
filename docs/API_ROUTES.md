# API Routing Reference

## Backend API Endpoints


All backend API endpoints are prefixed with `/api/v1`.

### Rate Limiting
API endpoints are rate-limited to prevent abuse:
- **Authentication**: 5-10 requests/minute
- **LLM Generation**: 10-20 requests/minute
- **General API**: 20 requests/minute


### Authentication
- `POST /api/v1/auth/discord/login` - Initiate Discord OAuth
- `GET /api/v1/auth/discord/callback` - OAuth callback
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/logout` - Logout
- `POST /api/v1/auth/logout-all` - Logout from all devices

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

---

## Gemini AI Endpoints

All Gemini endpoints are prefixed with `/api/v1/gemini`.

### Context Caching (75% cost savings)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/gemini/cache-info` | Get caching types, model requirements, pricing info |
| `POST` | `/gemini/cache-create` | Create cache with text content or file URI |
| `POST` | `/gemini/cache-query` | Query using cached context (returns cache hit info) |
| `GET` | `/gemini/cache-list` | List all active caches with TTL remaining |
| `GET` | `/gemini/cache-get/{name}` | Get details for specific cache |
| `POST` | `/gemini/cache-update` | Update cache TTL or expire_time |
| `DELETE` | `/gemini/cache-delete/{name}` | Delete a cache |

**Key Parameters:**
- `ttl_seconds` OR `expire_time` for cache duration
- Minimum tokens: Flash=1,024, Pro=4,096
- Supports file caching via `file_uri` + `file_mime_type`

### File Search (RAG)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/gemini/file-search-store` | Create a file search store |
| `GET` | `/gemini/file-search-stores` | List all stores |
| `GET` | `/gemini/file-search-stores/{name}` | Get store details |
| `DELETE` | `/gemini/file-search-stores/{name}` | Delete store (use `?force=true` to confirm) |
| `POST` | `/gemini/file-search-upload` | Upload document with chunking config |
| `POST` | `/gemini/file-search-query` | Semantic search with metadata filtering |
| `GET` | `/gemini/file-search-documents/{store}` | List documents in store |
| `DELETE` | `/gemini/file-search-documents/{name}` | Delete specific document |

**Key Parameters:**
- `chunking_config`: `{ max_tokens_per_chunk, max_overlap_tokens }`
- `custom_metadata`: Array of `{ key, string_value?, numeric_value? }`
- `metadata_filter`: Filter query results by metadata
- `response_schema`: JSON schema for structured output
- `include_citations`: Get source citations in response

### Function Calling

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/gemini/function-calling` | Execute function calling with tools |
| `GET` | `/gemini/function-calling/scenarios` | Get predefined demo scenarios |

**Key Parameters:**
- `mode`: AUTO, ANY, NONE, VALIDATED
- `allowed_functions`: Restrict to specific functions
- `parallel_tool_calls`: Enable parallel execution
- `auto_execute`: Automatically execute called functions

### Text Generation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/gemini/generate` | Generate text with thinking control |
| `POST` | `/gemini/count-tokens` | Count tokens before sending |

### Other Capabilities

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/gemini/tts` | Text-to-speech generation |
| `POST` | `/gemini/tts-multi` | Multi-speaker TTS |
| `POST` | `/gemini/audio-transcribe` | Speech-to-text |
| `POST` | `/gemini/image-generate` | Generate images |
| `POST` | `/gemini/image-edit` | Edit existing images |
| `POST` | `/gemini/image-compose` | Combine multiple images |
| `POST` | `/gemini/embeddings` | Generate vector embeddings |
| `POST` | `/gemini/structured-output` | JSON schema output |
| `POST` | `/gemini/google-search` | Web search grounding |
| `POST` | `/gemini/url-context` | Include web content |

---

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
