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

## 5. Next Steps
- Update `secrets/` with real API keys.
- Implement real database models in `backend/` and `bot/`.
- Expand the frontend to interact with the backend API.
