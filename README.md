# Baseline Discord Bot Platform

A comprehensive Discord bot platform with authentication, settings management, audit logging, and granular permissions.

## Documentation

- **[Developer Manual](docs/DEVELOPER_MANUAL.md)**: The authoritative guide for AI Agents and Developers.
- **[Architecture](docs/ARCHITECTURE.md)**: High-level system design.
- **[LLM Guide](docs/LLM_USAGE_GUIDE.md)**: How to use the shared LLM service.

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
   make up
   ```

4. **Run database migrations**
   ```bash
   make migrate
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## Available Commands

The `Makefile` provides convenient shortcuts:

- `make help` - Show all available commands
- `make up` - Start development environment
- `make down` - Stop all services
- `make prod` - Start production environment
- `make logs` - View logs from all services
- `make migrate` - Run database migrations
- `make restart-backend` - Restart backend service
- `make restart-bot` - Restart bot service
- `make restart-frontend` - Restart frontend service
- `make clean` - Stop and remove containers, volumes

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
make prod
make migrate
```

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
│   └── services/     # Background services
├── frontend/         # Next.js application
│   └── app/          # App router pages
├── secrets/          # Secret files (not in git)
└── docker-compose.yml
```

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
