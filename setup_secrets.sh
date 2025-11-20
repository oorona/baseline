#!/bin/bash
mkdir -p secrets

echo "Creating dummy secret files for development..."

# Discord Secrets
echo "dummy_bot_token" > secrets/discord_bot_token.txt
echo "dummy_client_secret" > secrets/discord_client_secret.txt

# API Secret
echo "dummy_api_secret_key_for_dev" > secrets/api_secret_key.txt

# Database Password (used for both postgres admin and baseline user)
echo "secure_postgres_password_change_in_production" > secrets/postgres_password.txt

# LLM API Keys
echo "sk-dummy-openai" > secrets/openai_api_key.txt
echo "dummy-google" > secrets/google_api_key.txt
echo "sk-ant-dummy" > secrets/anthropic_api_key.txt
echo "dummy-xai" > secrets/xai_api_key.txt

chmod 600 secrets/*.txt
echo "Secrets created."
