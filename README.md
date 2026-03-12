# Baseline Discord Bot Platform

A comprehensive Discord bot platform with authentication, settings management, audit logging, granular permissions, and **full Gemini 3 AI capabilities**.

## Documentation

- **[Developer Manual](docs/DEVELOPER_MANUAL.md)**: The authoritative guide for AI Agents and Developers.
- **[Security Reference](docs/SECURITY.md)**: **Read before deploying.** All 6 permission levels with code examples, security checklist, and production hardening guide.
- **[Architecture](docs/ARCHITECTURE.md)**: High-level system design.
- **[LLM Guide](docs/LLM_USAGE_GUIDE.md)**: How to use the shared LLM service.
- **[Gemini Capabilities](docs/GEMINI_CAPABILITIES.md)**: Complete Gemini 3 API guide (13 capabilities).
- **[Integration Guides](docs/integration/README.md)**: Step-by-step feature development guides.

## Using as a Template

To use this framework as a starting point for a **new project**, please follow the **[New Project Bootstrap Guide](docs/BOOTSTRAP_GUIDE.md)**.
This guide covers:
1.  Forking and detaching from the baseline history.
2.  Renaming the project (Database, Containers, etc.).
3.  Setting up the isolated environment.

## Architecture

- **Backend**: FastAPI with PostgreSQL and Redis
- **Frontend**: Next.js 14 with TypeScript
- **Bot**: discord.py with auto-sharding support

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Discord application (for bot token and OAuth credentials)
  - *Need to create one? Follow the [Discord App Setup Guide](DISCORD_APP_SETUP.md).*

### Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd baseline
   ```

2. **Configure secrets**
   ```bash
   # Copy example secrets
   cp secrets/discord_bot_token.example secrets/discord_bot_token
   cp secrets/discord_client_secret.example secrets/discord_client_secret
   
   # Edit the files with your actual values
   ```

3. **Start the development environment**
   ```bash
   docker compose up -d
   ```

4. **Run database migrations**
   ```bash
   docker compose exec backend alembic upgrade head
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## Common Commands

```bash
docker compose up -d                                        # Start dev environment
docker compose down                                         # Stop all services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d  # Production
docker compose logs -f                                      # View logs
docker compose exec backend alembic upgrade head            # Run DB migrations
docker compose restart backend                              # Restart backend
docker compose restart bot                                  # Restart bot
docker compose restart frontend                             # Restart frontend
docker compose down -v                                      # Stop + remove volumes
```

## Production Deployment

### Using the deployment script

```bash
./scripts/deploy.sh
```

This will:
1. Pull latest changes from git
2. Build and start services with production config
3. Run database migrations
4. Show service status

### Manual deployment

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose exec backend alembic upgrade head
```

## Testing

The framework includes a live integration test suite that runs against the real Docker stack. Tests validate health, security headers, all 6 permission levels, rate limiting, and API contract backwards compatibility.

```bash
# 1. Start the stack
docker compose up -d

# 2. Run all tests (one-shot)
docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm test-runner

# 3. Run with authenticated tests (L2+ endpoints)
TEST_API_TOKEN=your_token docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm test-runner
```

**Output**: Each test shows `[PASS/FAIL/SKIP]  test name  response_time_ms` in real time, followed by a summary table with per-suite stats (pass counts, avg/max response times).

**Test suites:**
- `01 Health` — all services reachable, response times within limits
- `02 Security Headers` — all required headers present (CSP, HSTS, X-Frame-Options, etc.)
- `03 Authentication` — OAuth endpoints, token validation, rejection of invalid auth
- `04 Security Levels` — L0–L5 access control enforced on every endpoint
- `05 Rate Limiting` — nginx burst protection verified
- `06 Backwards Compatibility` — API response shape contract tests

See [`tests/runner/`](tests/runner/) for source and [`docker-compose.test.yml`](docker-compose.test.yml) for configuration.

## Development

### Project Structure

```
baseline/
├── backend/          # FastAPI application
│   ├── app/
│   │   ├── api/      # API endpoints
│   │   ├── core/     # Core configuration
│   │   ├── db/       # Database setup
│   │   └── models.py # SQLAlchemy models
│   └── alembic/      # Database migrations
├── bot/              # Discord bot
│   ├── cogs/         # Bot commands
│   ├── core/         # Bot core logic
│   └── services/     # LLM & background services
├── frontend/         # Next.js application
│   └── app/          # App router pages
├── docs/             # Documentation
│   └── integration/  # Feature development guides
├── secrets/          # Secret files (not in git)
└── docker-compose.yml
```

### AI/LLM Capabilities

The framework includes comprehensive LLM support with **full Gemini 3 integration**:

| Provider | Features |
|----------|----------|
| **Google Gemini 3** | Text, images, TTS, embeddings, thinking levels, structured output |
| **OpenAI** | GPT-4o, function calling, vision |
| **Anthropic** | Claude 3 Opus/Sonnet/Haiku |
| **xAI** | Grok |

**Quick usage in a cog:**
```python
class MyCog(commands.Cog):
    def __init__(self, bot):
        self.llm = bot.services.llm
    
    @app_commands.command()
    async def ask(self, interaction, question: str):
        await interaction.response.defer()
        response = await self.llm.chat(message=question)
        await interaction.followup.send(response)
```

See [GEMINI_CAPABILITIES.md](docs/GEMINI_CAPABILITIES.md) for the complete guide.

### Adding a Database Migration

```bash
# Auto-generate migration
docker compose exec backend alembic revision --autogenerate -m "description"

# Apply migration
make migrate
```

### Viewing Logs

```bash
# All services
make logs

# Specific service
docker compose logs -f backend
```

## Environment Variables

See `.env.example` for available configuration options. Sensitive values should be stored in the `secrets/` directory.

## License

MIT
