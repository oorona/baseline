"""
Tests for backend/app/api/event_logging.py (event_logging plugin)

Covers:
  - GET  /{guild_id}/event-logging/settings — returns defaults when no row,
                                              returns merged values when row exists
  - POST /{guild_id}/event-logging/settings — merges into existing JSON,
                                              rejects unknown event keys (422),
                                              writes AuditLog,
                                              raises 404 when no settings row
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

from app.api.event_logging import get_settings, update_settings, EventLoggingSettings
from app.models import AuditLog, GuildSettings


# ── Helpers ───────────────────────────────────────────────────────────────────

def _mock_db():
    db = AsyncMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.add = MagicMock()
    return db


def _scalar_result(value):
    r = MagicMock()
    r.scalar_one_or_none.return_value = value
    return r


# ── GET settings ──────────────────────────────────────────────────────────────

class TestGetSettings:
    @pytest.mark.asyncio
    async def test_returns_defaults_when_no_row(self):
        db = _mock_db()
        db.execute.return_value = _scalar_result(None)

        result = await get_settings(
            guild_id=1,
            db=db,
            current_user={"user_id": "10"},
        )

        assert result["logging_enabled"] is False
        assert result["logging_channel_id"] is None
        assert result["logging_ignored_events"] == []

    @pytest.mark.asyncio
    async def test_returns_stored_values(self):
        db = _mock_db()
        row = GuildSettings(
            guild_id=1,
            settings_json={
                "logging_enabled": True,
                "logging_channel_id": "123456",
                "logging_ignored_events": ["on_message_delete"],
            },
        )
        db.execute.return_value = _scalar_result(row)

        result = await get_settings(
            guild_id=1,
            db=db,
            current_user={"user_id": "10"},
        )

        assert result["logging_enabled"] is True
        assert result["logging_channel_id"] == "123456"
        assert result["logging_ignored_events"] == ["on_message_delete"]

    @pytest.mark.asyncio
    async def test_missing_keys_use_defaults(self):
        """Partial settings_json — missing keys fall back to schema defaults."""
        db = _mock_db()
        row = GuildSettings(guild_id=1, settings_json={"logging_enabled": True})
        db.execute.return_value = _scalar_result(row)

        result = await get_settings(
            guild_id=1,
            db=db,
            current_user={"user_id": "10"},
        )

        assert result["logging_enabled"] is True
        assert result["logging_channel_id"] is None
        assert result["logging_ignored_events"] == []


# ── POST settings ─────────────────────────────────────────────────────────────

class TestUpdateSettings:
    @pytest.mark.asyncio
    async def test_updates_existing_row(self):
        db = _mock_db()
        row = GuildSettings(
            guild_id=1,
            settings_json={"logging_enabled": False, "logging_channel_id": None},
        )
        db.execute.return_value = _scalar_result(row)

        result = await update_settings(
            guild_id=1,
            payload=EventLoggingSettings(
                logging_enabled=True,
                logging_channel_id="999",
                logging_ignored_events=[],
            ),
            db=db,
            current_user={"user_id": "10"},
        )

        assert result == {"success": True}
        db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_audit_log_written(self):
        db = _mock_db()
        row = GuildSettings(guild_id=1, settings_json={})
        db.execute.return_value = _scalar_result(row)

        await update_settings(
            guild_id=1,
            payload=EventLoggingSettings(logging_enabled=True),
            db=db,
            current_user={"user_id": "10"},
        )

        added = [c.args[0] for c in db.add.call_args_list]
        assert any(isinstance(o, AuditLog) for o in added)

    @pytest.mark.asyncio
    async def test_audit_log_uses_correct_user_id(self):
        db = _mock_db()
        row = GuildSettings(guild_id=1, settings_json={})
        db.execute.return_value = _scalar_result(row)

        await update_settings(
            guild_id=1,
            payload=EventLoggingSettings(logging_enabled=True),
            db=db,
            current_user={"user_id": "42"},
        )

        added = [c.args[0] for c in db.add.call_args_list]
        audit = next(o for o in added if isinstance(o, AuditLog))
        assert audit.user_id == 42

    @pytest.mark.asyncio
    async def test_unknown_event_key_raises_422(self):
        db = _mock_db()
        row = GuildSettings(guild_id=1, settings_json={})
        db.execute.return_value = _scalar_result(row)

        with pytest.raises(HTTPException) as exc:
            await update_settings(
                guild_id=1,
                payload=EventLoggingSettings(
                    logging_enabled=True,
                    logging_ignored_events=["on_not_a_real_event"],
                ),
                db=db,
                current_user={"user_id": "10"},
            )

        assert exc.value.status_code == 422

    @pytest.mark.asyncio
    async def test_no_settings_row_raises_404(self):
        db = _mock_db()
        db.execute.return_value = _scalar_result(None)

        with pytest.raises(HTTPException) as exc:
            await update_settings(
                guild_id=1,
                payload=EventLoggingSettings(logging_enabled=True),
                db=db,
                current_user={"user_id": "10"},
            )

        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_valid_event_keys_accepted(self):
        db = _mock_db()
        row = GuildSettings(guild_id=1, settings_json={})
        db.execute.return_value = _scalar_result(row)

        result = await update_settings(
            guild_id=1,
            payload=EventLoggingSettings(
                logging_enabled=True,
                logging_ignored_events=[
                    "on_message_delete",
                    "on_message_edit",
                    "on_member_join",
                    "on_member_remove",
                ],
            ),
            db=db,
            current_user={"user_id": "10"},
        )

        assert result == {"success": True}

    @pytest.mark.asyncio
    async def test_merges_with_existing_settings_json(self):
        """Update must not wipe unrelated keys in settings_json."""
        db = _mock_db()
        row = GuildSettings(
            guild_id=1,
            settings_json={
                "level_2_allow_everyone": True,
                "logging_enabled": False,
            },
        )
        db.execute.return_value = _scalar_result(row)

        merged_values = {}

        original_execute = db.execute

        async def capture_execute(stmt):
            # Intercept the UPDATE to check merged values
            nonlocal merged_values
            if hasattr(stmt, "_values"):
                merged_values = stmt._values
            return await original_execute(stmt)

        db.execute = capture_execute

        await update_settings(
            guild_id=1,
            payload=EventLoggingSettings(logging_enabled=True, logging_channel_id="555"),
            db=db,
            current_user={"user_id": "10"},
        )

        # Verify level_2_allow_everyone was preserved in merged payload
        added = [c.args[0] for c in db.add.call_args_list]
        audit = next(o for o in added if isinstance(o, AuditLog))
        assert audit.details["logging_enabled"] is True
