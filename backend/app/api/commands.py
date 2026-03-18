"""
Bot command reference API.

Security levels (see docs/SECURITY.md):
  GET  /api/v1/commands/         L1 — Public Data: no auth required (command list is public info)
  POST /api/v1/commands/refresh  L6 — Developer:   platform admin only
"""

from fastapi import APIRouter, Depends, HTTPException, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import httpx
import json
from datetime import datetime, timezone

from app.db.redis import get_redis
from app.db.session import get_db
from app.api.deps import verify_platform_admin
from app.core.config import settings

router = APIRouter()

REDIS_KEY = "bot:command_reference"

# Discord option types
_SUB_COMMAND = 1
_SUB_COMMAND_GROUP = 2


async def _fetch_discord_commands() -> list[dict] | None:
    """Fetch registered application commands from Discord API.
    Returns None if the bot is not configured; [] if configured but no commands registered."""
    app_id = settings.DISCORD_CLIENT_ID
    bot_token = settings.DISCORD_BOT_TOKEN
    guild_id = settings.DISCORD_GUILD_ID

    if not app_id or not bot_token:
        return None

    headers = {
        "Authorization": f"Bot {bot_token}",
        "Content-Type": "application/json",
    }
    base = "https://discord.com/api/v10"

    async with httpx.AsyncClient() as client:
        all_commands: list[dict] = []

        # Guild-specific commands (synced on bot startup)
        if guild_id:
            try:
                r = await client.get(
                    f"{base}/applications/{app_id}/guilds/{guild_id}/commands",
                    headers=headers,
                    timeout=10,
                )
                if r.status_code == 200:
                    all_commands.extend(r.json())
            except Exception:
                pass

        # Global commands (deduped by name)
        try:
            r = await client.get(
                f"{base}/applications/{app_id}/commands",
                headers=headers,
                timeout=10,
            )
            if r.status_code == 200:
                existing_names = {c["name"] for c in all_commands}
                for cmd in r.json():
                    if cmd["name"] not in existing_names:
                        all_commands.append(cmd)
        except Exception:
            pass

        return all_commands


def _cog_label(raw_name: str) -> str:
    """Turn a command group name into a readable cog label, e.g. 'gemini-demo' → 'Gemini Demo'."""
    return raw_name.replace("-", " ").replace("_", " ").title()


def _build_usage(prefix: str, options: list[dict]) -> str:
    params = []
    for opt in options:
        # Skip sub_command / sub_command_group option types
        if opt.get("type") in (_SUB_COMMAND, _SUB_COMMAND_GROUP):
            continue
        name = opt.get("name", "")
        required = opt.get("required", False)
        params.append(f"<{name}>" if required else f"[{name}]")
    return f"{prefix} {' '.join(params)}".strip() if params else prefix


def _expand_command(cmd: dict, cog_map: dict[str, str]) -> list[dict]:
    """
    Convert a single Discord command object into one or more reference entries.
    Handles flat commands, one-level groups, and two-level nested groups.
    """
    name = cmd.get("name", "")
    options = cmd.get("options", [])

    # Check if this is a command group (has SUB_COMMAND options)
    sub_types = {opt.get("type") for opt in options}
    is_group = bool(sub_types & {_SUB_COMMAND, _SUB_COMMAND_GROUP})

    if not is_group:
        # Plain slash command
        return [{
            "name": name,
            "description": cmd.get("description", ""),
            "cog": cog_map.get(name, "Slash Commands"),
            "usage": _build_usage(f"/{name}", options),
            "examples": [],
        }]

    # Command group — expand subcommands
    cog = _cog_label(name)
    entries = []
    for sub in options:
        sub_type = sub.get("type")
        sub_name = sub.get("name", "")

        if sub_type == _SUB_COMMAND:
            full = f"/{name} {sub_name}"
            entries.append({
                "name": f"{name} {sub_name}",
                "description": sub.get("description", ""),
                "cog": cog,
                "usage": _build_usage(full, sub.get("options", [])),
                "examples": [],
            })

        elif sub_type == _SUB_COMMAND_GROUP:
            # Two-level nesting: /name sub_name subsub_name
            for subsub in sub.get("options", []):
                if subsub.get("type") == _SUB_COMMAND:
                    subsub_name = subsub.get("name", "")
                    full = f"/{name} {sub_name} {subsub_name}"
                    entries.append({
                        "name": f"{name} {sub_name} {subsub_name}",
                        "description": subsub.get("description", ""),
                        "cog": cog,
                        "usage": _build_usage(full, subsub.get("options", [])),
                        "examples": [],
                    })

    return entries


async def _build_cog_map(db: AsyncSession) -> dict[str, str]:
    """Name→cog mapping from historical bot_command_metrics (prefix commands)."""
    try:
        result = await db.execute(
            text("SELECT DISTINCT command, cog FROM bot_command_metrics WHERE cog IS NOT NULL")
        )
        return {row[0]: row[1] for row in result.fetchall()}
    except Exception:
        return {}


@router.get("/")
async def get_commands(
    redis: Redis = Depends(get_redis),
):
    """Return the cached command reference list. L1 — no auth required."""
    cached = await redis.get(REDIS_KEY)
    if cached:
        return json.loads(cached)
    return {"commands": [], "last_updated": None, "total": 0}


@router.post("/refresh")
async def refresh_commands(
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(verify_platform_admin),
):
    """Re-fetch commands from Discord API and update the cache (admin only)."""
    raw_commands = await _fetch_discord_commands()
    if raw_commands is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Bot is not configured. Set DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID.",
        )

    cog_map = await _build_cog_map(db)
    commands: list[dict] = []
    for raw in raw_commands:
        commands.extend(_expand_command(raw, cog_map))

    payload = {
        "commands": commands,
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "total": len(commands),
    }
    await redis.set(REDIS_KEY, json.dumps(payload))
    return payload
