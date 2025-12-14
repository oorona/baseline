# 🚀 Baseline Framework: New Project Bootstrap Guide

Use this guide to "fork" the Baseline framework into a completely new, independent project.

## 1. Fork & Detach
First, clone the code and detach it from the original git history to start fresh.

```bash
# 1. Clone to new directory
git clone <your-repo-url> <new-project-directory>

# 2. Enter directory
cd <new-project-directory>

# 3. Nuke existing git history
rm -rf .git

# 4. Initialize NEW git repo
git init
git add .
git commit -m "Initial commit from Baseline Framework"
```

## 2. Environment Setup
Configure your new project's secrets and environment.

```bash
# 1. Setup Secrets
# (See docs/DISCORD_APP_SETUP.md for how to get these tokens)
# (Manually edit these files with your REAL keys afterwards)
cp secrets/discord_bot_token.example secrets/discord_bot_token
cp secrets/discord_client_secret.example secrets/discord_client_secret
cp secrets/api_secret_key.example secrets/api_secret_key
cp secrets/postgres_password.example secrets/postgres_password
cp secrets/openai_api_key.example secrets/openai_api_key
# ... copy others as needed

# 2. Setup Environment Variables
cp .env.example .env
```

## 3. Renaming (CRITICAL)
The framework has "baseline" hardcoded in the database initialization to ensure stability. You must update this for a custom project name.

### A. Database Initialization
1.  Rename the init script:
    ```bash
    mv postgres-init/init-baseline-db.sh postgres-init/init-mybot-db.sh
    ```
2.  Edit `postgres-init/init-mybot-db.sh`:
    *   Change `baseline` to `mybot` (or your project name) in all 5 occurrences (user, database, schema).

### B. Environment (`.env`)
Edit `.env` to match the changes above:
```properties
# .env
DB_USER=mybot        # Must match what you put in the init script
DB_NAME=mybot        # Must match what you put in the init script
NEXT_PUBLIC_APP_NAME="My Awesome Bot"
```

### C. Python Defaults (Optional)
Edit `bot/core/config.py` to change the default values for `POSTGRES_USER` to `mybot` so it matches your new standard.

## 4. First Boot
Now start your new isolated project.

```bash
# Start the containers
docker compose up -d

# Run database migrations (inside the backend container)
docker compose exec backend alembic upgrade head
```

## 5. Next Steps
Once your new project is running, you can start adding features:
1.  Read [FRAMEWORK_GUIDE.md](FRAMEWORK_GUIDE.md) to understand the architecture.
2.  Read [PLUGIN_ARCHITECTURE.md](PLUGIN_ARCHITECTURE.md) to learn how to add specific features like "Moderation" or "Music".
