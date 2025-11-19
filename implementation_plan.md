# Implementation Plan - Configurable Intents

## Goal
Make Discord intents configurable via environment variables to support different bot requirements within the same platform baseline.

## User Review Required
> [!IMPORTANT]
> This change introduces a new environment variable `DISCORD_INTENTS`. If not set, it defaults to `default` intents + `message_content`.

## Proposed Changes

### Bot Service Configuration
#### [MODIFY] [bot/services.py](file:///home/iktdts/projects/apps/baseline/bot/services.py)
- Add `DISCORD_INTENTS` to `Config` class (comma-separated string).

### Bot Main Logic
#### [MODIFY] [bot/main.py](file:///home/iktdts/projects/apps/baseline/bot/main.py)
- Parse `DISCORD_INTENTS` from config.
- Dynamically set intent flags based on the configuration.

## Verification Plan

### Automated Tests
- None (this is a configuration change).

### Manual Verification
1.  **Default Behavior**: Run bot without `DISCORD_INTENTS` set. Verify it still works (responds to messages).
2.  **Custom Intents**: Set `DISCORD_INTENTS=guilds,messages,members` in `.env`. Verify bot starts and logs enabled intents.
