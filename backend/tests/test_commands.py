"""
Tests for the bot command reference API.

Covers:
  - Pure helper functions: _cog_label, _build_usage, _expand_command
  - GET  /api/v1/commands/        (public, no auth)
  - POST /api/v1/commands/refresh (platform admin only)
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.api.commands import (
    _cog_label,
    _build_usage,
    _expand_command,
    REDIS_KEY,
)
from app.core.config import settings


# ─────────────────────────────────────────────────────────────────────────────
# Helper: _cog_label
# ─────────────────────────────────────────────────────────────────────────────

class TestCogLabel:
    def test_hyphenated_name(self):
        assert _cog_label("gemini-demo") == "Gemini Demo"

    def test_underscored_name(self):
        assert _cog_label("my_cog") == "My Cog"

    def test_single_word(self):
        assert _cog_label("status") == "Status"

    def test_mixed(self):
        assert _cog_label("some-long_name") == "Some Long Name"

    def test_already_titled(self):
        assert _cog_label("Meta") == "Meta"


# ─────────────────────────────────────────────────────────────────────────────
# Helper: _build_usage
# ─────────────────────────────────────────────────────────────────────────────

class TestBuildUsage:
    def test_no_options(self):
        assert _build_usage("/status", []) == "/status"

    def test_required_option(self):
        opts = [{"name": "member", "required": True, "type": 6}]
        assert _build_usage("/kick", opts) == "/kick <member>"

    def test_optional_option(self):
        opts = [{"name": "reason", "required": False, "type": 3}]
        assert _build_usage("/kick", opts) == "/kick [reason]"

    def test_mixed_options(self):
        opts = [
            {"name": "member", "required": True, "type": 6},
            {"name": "reason", "required": False, "type": 3},
        ]
        assert _build_usage("/kick", opts) == "/kick <member> [reason]"

    def test_skips_subcommand_type(self):
        """Options of type 1 (SUB_COMMAND) must not appear in the usage string."""
        opts = [{"name": "thinking", "type": 1}]
        assert _build_usage("/gemini-demo", opts) == "/gemini-demo"

    def test_skips_subcommand_group_type(self):
        opts = [{"name": "group", "type": 2}]
        assert _build_usage("/cmd", opts) == "/cmd"


# ─────────────────────────────────────────────────────────────────────────────
# Helper: _expand_command
# ─────────────────────────────────────────────────────────────────────────────

class TestExpandCommand:

    def test_flat_command_no_cog_map(self):
        cmd = {"name": "status", "description": "Show bot status", "options": []}
        result = _expand_command(cmd, {})
        assert len(result) == 1
        entry = result[0]
        assert entry["name"] == "status"
        assert entry["description"] == "Show bot status"
        assert entry["cog"] == "Slash Commands"
        assert entry["usage"] == "/status"
        assert entry["examples"] == []

    def test_flat_command_cog_from_map(self):
        cmd = {"name": "reload", "description": "Reloads a cog", "options": []}
        result = _expand_command(cmd, {"reload": "Meta"})
        assert result[0]["cog"] == "Meta"

    def test_flat_command_with_options(self):
        cmd = {
            "name": "kick",
            "description": "Kick a user",
            "options": [
                {"name": "member", "required": True, "type": 6},
                {"name": "reason", "required": False, "type": 3},
            ],
        }
        result = _expand_command(cmd, {})
        assert result[0]["usage"] == "/kick <member> [reason]"

    def test_group_command_one_level(self):
        """gemini-demo group with subcommands."""
        cmd = {
            "name": "gemini-demo",
            "description": "Demo group",
            "options": [
                {
                    "type": 1,  # SUB_COMMAND
                    "name": "thinking",
                    "description": "Generate text with thinking",
                    "options": [
                        {"name": "prompt", "required": True, "type": 3},
                        {"name": "level", "required": False, "type": 3},
                    ],
                },
                {
                    "type": 1,
                    "name": "speak",
                    "description": "Text to speech",
                    "options": [],
                },
            ],
        }
        result = _expand_command(cmd, {})
        assert len(result) == 2

        thinking = result[0]
        assert thinking["name"] == "gemini-demo thinking"
        assert thinking["description"] == "Generate text with thinking"
        assert thinking["cog"] == "Gemini Demo"
        assert thinking["usage"] == "/gemini-demo thinking <prompt> [level]"

        speak = result[1]
        assert speak["name"] == "gemini-demo speak"
        assert speak["usage"] == "/gemini-demo speak"

    def test_group_command_two_level_nesting(self):
        cmd = {
            "name": "admin",
            "description": "Admin commands",
            "options": [
                {
                    "type": 2,  # SUB_COMMAND_GROUP
                    "name": "guild",
                    "options": [
                        {
                            "type": 1,
                            "name": "sync",
                            "description": "Sync guild data",
                            "options": [],
                        },
                    ],
                }
            ],
        }
        result = _expand_command(cmd, {})
        assert len(result) == 1
        entry = result[0]
        assert entry["name"] == "admin guild sync"
        assert entry["cog"] == "Admin"
        assert entry["usage"] == "/admin guild sync"

    def test_group_ignores_non_subcommand_options(self):
        """A group that mixes regular options with subcommands — subcommands win."""
        cmd = {
            "name": "mixed",
            "description": "Mixed",
            "options": [
                {"type": 1, "name": "sub", "description": "A sub", "options": []},
            ],
        }
        result = _expand_command(cmd, {})
        assert len(result) == 1
        assert result[0]["name"] == "mixed sub"

    def test_empty_group_returns_empty(self):
        """A group declaration with no subcommand options."""
        cmd = {"name": "empty", "description": "No subs", "options": []}
        result = _expand_command(cmd, {})
        # No subcommand types → treated as flat command
        assert len(result) == 1
        assert result[0]["name"] == "empty"


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint: GET /api/v1/commands/  (L1 — public, no auth)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_commands_empty_cache():
    """Returns empty payload when Redis has no cached data."""
    from app.api.commands import get_commands

    mock_redis = AsyncMock()
    mock_redis.get.return_value = None

    result = await get_commands(redis=mock_redis)

    assert result["commands"] == []
    assert result["last_updated"] is None
    assert result["total"] == 0


@pytest.mark.asyncio
async def test_get_commands_returns_cached_data():
    """Returns cached JSON payload from Redis when present."""
    from app.api.commands import get_commands

    cached = {
        "commands": [{"name": "status", "description": "Show status", "cog": "Status", "usage": "/status", "examples": []}],
        "last_updated": "2026-01-01T00:00:00+00:00",
        "total": 1,
    }
    mock_redis = AsyncMock()
    mock_redis.get.return_value = json.dumps(cached)

    result = await get_commands(redis=mock_redis)

    assert result["total"] == 1
    assert result["commands"][0]["name"] == "status"
    assert result["last_updated"] == "2026-01-01T00:00:00+00:00"


@pytest.mark.asyncio
async def test_get_commands_no_auth_required(client):
    """GET /commands/ must succeed without any Authorization header (L1 — public)."""
    from main import app
    from app.db.redis import get_redis

    mock_redis = AsyncMock()
    mock_redis.get.return_value = None

    async def override_redis():
        yield mock_redis

    app.dependency_overrides[get_redis] = override_redis
    try:
        response = await client.get(
            f"{settings.API_V1_STR}/commands/",
            headers={},  # no auth header
        )
    finally:
        app.dependency_overrides.pop(get_redis, None)

    # Must not be 401 or 403
    assert response.status_code == 200


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint: POST /api/v1/commands/refresh  (L5 — platform admin only)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_refresh_commands_requires_admin(client):
    """Non-admin users must receive 401 or 403."""
    with patch("app.api.commands.verify_platform_admin") as mock_admin:
        from fastapi import HTTPException
        mock_admin.side_effect = HTTPException(status_code=403, detail="Requires Platform Admin privileges")
        response = await client.post(f"{settings.API_V1_STR}/commands/refresh")

    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_refresh_commands_success():
    """Admin refresh fetches from Discord, expands groups, caches result."""
    from app.api.commands import refresh_commands

    discord_payload = [
        {"name": "status", "description": "Show bot status", "options": []},
        {
            "name": "gemini-demo",
            "description": "Demo group",
            "options": [
                {"type": 1, "name": "thinking", "description": "Generate with thinking", "options": []},
                {"type": 1, "name": "speak", "description": "Text to speech", "options": []},
            ],
        },
    ]

    mock_redis = AsyncMock()
    mock_db = AsyncMock()
    mock_db.execute.return_value.fetchall.return_value = []
    mock_admin_user = {"user_id": "999", "username": "admin"}

    with patch("app.api.commands._fetch_discord_commands", return_value=discord_payload):
        result = await refresh_commands(
            redis=mock_redis,
            db=mock_db,
            _user=mock_admin_user,
        )

    assert result["total"] == 3  # status + 2 subcommands
    names = [c["name"] for c in result["commands"]]
    assert "status" in names
    assert "gemini-demo thinking" in names
    assert "gemini-demo speak" in names

    # Verify Redis was updated
    mock_redis.set.assert_called_once()
    key, payload_json = mock_redis.set.call_args[0]
    assert key == REDIS_KEY
    payload = json.loads(payload_json)
    assert payload["total"] == 3


@pytest.mark.asyncio
async def test_refresh_commands_bot_not_configured():
    """Returns 503 when bot token/client ID are not set (fetch returns None)."""
    from app.api.commands import refresh_commands
    from fastapi import HTTPException

    mock_redis = AsyncMock()
    mock_db = AsyncMock()
    mock_admin_user = {"user_id": "999"}

    with patch("app.api.commands._fetch_discord_commands", return_value=None):
        with pytest.raises(HTTPException) as exc_info:
            await refresh_commands(redis=mock_redis, db=mock_db, _user=mock_admin_user)

    assert exc_info.value.status_code == 503


@pytest.mark.asyncio
async def test_refresh_commands_no_cogs_is_success():
    """Returns success with zero commands when bot is configured but no commands are registered yet."""
    from app.api.commands import refresh_commands

    mock_redis = AsyncMock()
    mock_db = AsyncMock()
    mock_db.execute.return_value.fetchall.return_value = []
    mock_admin_user = {"user_id": "999"}

    with patch("app.api.commands._fetch_discord_commands", return_value=[]):
        result = await refresh_commands(redis=mock_redis, db=mock_db, _user=mock_admin_user)

    assert result["total"] == 0
    assert result["commands"] == []
    mock_redis.set.assert_called_once()


@pytest.mark.asyncio
async def test_refresh_commands_uses_cog_map_from_metrics():
    """Cog names from bot_command_metrics override the 'Slash Commands' default."""
    from app.api.commands import refresh_commands

    discord_payload = [
        {"name": "reload", "description": "Reload a cog", "options": []},
    ]

    mock_redis = AsyncMock()
    mock_db = AsyncMock()
    # Simulate a metrics row that maps 'reload' → 'Meta'
    mock_row = MagicMock()
    mock_row.__getitem__ = lambda self, i: "reload" if i == 0 else "Meta"
    mock_db.execute.return_value.fetchall.return_value = [mock_row]
    mock_admin_user = {"user_id": "999"}

    with patch("app.api.commands._fetch_discord_commands", return_value=discord_payload):
        with patch("app.api.commands._build_cog_map", return_value={"reload": "Meta"}):
            result = await refresh_commands(redis=mock_redis, db=mock_db, _user=mock_admin_user)

    assert result["commands"][0]["cog"] == "Meta"


@pytest.mark.asyncio
async def test_refresh_commands_deduplicates_guild_and_global(client):
    """Commands present in both guild and global results appear only once."""
    from app.api.commands import _fetch_discord_commands

    guild_cmds = [{"name": "status", "description": "Guild-synced status"}]
    global_cmds = [
        {"name": "status", "description": "Global status (duplicate)"},
        {"name": "help", "description": "Global help"},
    ]

    import httpx

    class MockResponse:
        def __init__(self, data):
            self._data = data
            self.status_code = 200

        def json(self):
            return self._data

    async def mock_get(url, **kwargs):
        if "guilds" in url:
            return MockResponse(guild_cmds)
        return MockResponse(global_cmds)

    with patch("app.core.config.settings") as mock_settings:
        mock_settings.DISCORD_CLIENT_ID = "app123"
        mock_settings.DISCORD_BOT_TOKEN = "Bot tok"
        mock_settings.DISCORD_GUILD_ID = "guild456"

        with patch("httpx.AsyncClient") as MockClient:
            instance = AsyncMock()
            instance.get.side_effect = mock_get
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = instance

            result = await _fetch_discord_commands()

    names = [c["name"] for c in result]
    assert names.count("status") == 1  # deduplicated
    assert "help" in names
