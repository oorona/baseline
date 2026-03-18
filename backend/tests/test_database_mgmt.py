"""
Tests for backend/app/api/database_mgmt.py

Covers:
  - _get_alembic_revisions() — empty table, single row, multi-row (branched model)
  - _get_alembic_current()   — framework head present, legacy single-row, multi-row fallback
  - POST /database/migrations/framework/upgrade
  - POST /database/migrations/plugins/{plugin_name}/apply
"""

import subprocess
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ── Shared fake inventory matching test_version.py ───────────────────────────

_FAKE_INVENTORY = {
    "framework_version": "1.2.0",
    "framework_migrations": [
        {"version": "1.0.0", "description": "Init",        "head_revision": "aaa000000000", "revisions": ["aaa000000000"]},
        {"version": "1.1.0", "description": "Guilds",      "head_revision": "bbb111111111", "revisions": ["bbb111111111"]},
        {"version": "1.2.0", "description": "Audit logs",  "head_revision": "ccc222222222", "revisions": ["ccc222222222"]},
    ],
    "plugin_migrations": [
        {
            "plugin": "event_logging",
            "version": "1.0.0",
            "description": "Event logging tables",
            "revisions": ["ppp333333333"],
            "head_revision": "ppp333333333",
        },
    ],
}


@pytest.fixture(autouse=True)
def patch_version_module(tmp_path):
    """Reload version with the fake inventory so all database_mgmt constants are in sync."""
    import json, importlib
    inv_file = tmp_path / "migration_inventory.json"
    inv_file.write_text(json.dumps(_FAKE_INVENTORY))

    import app.core.version as v
    with patch.object(v, "_INVENTORY_PATH", inv_file):
        importlib.reload(v)
        # Re-patch the names that database_mgmt imported at module load time
        import app.api.database_mgmt as dm
        dm.FRAMEWORK_VERSION    = v.FRAMEWORK_VERSION
        dm.MIGRATION_CHANGELOG  = v.MIGRATION_CHANGELOG
        dm.PLUGIN_MIGRATIONS    = v.PLUGIN_MIGRATIONS
        dm.REQUIRED_DB_REVISION = v.REQUIRED_DB_REVISION
        dm.get_app_version_for_revision = v.get_app_version_for_revision
        dm.get_plugin_migration         = v.get_plugin_migration
        dm.is_plugin_revision           = v.is_plugin_revision
        yield
    importlib.reload(v)


def _mock_db(rows: list[str]) -> AsyncMock:
    """Return an AsyncSession mock whose alembic_version query yields *rows*."""
    db = AsyncMock()
    result = MagicMock()
    result.fetchall.return_value = [(r,) for r in rows]
    db.execute.return_value = result
    return db


# ─────────────────────────────────────────────────────────────────────────────
# _get_alembic_revisions
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_alembic_revisions_empty():
    from app.api.database_mgmt import _get_alembic_revisions
    db = _mock_db([])
    result = await _get_alembic_revisions(db)
    assert result == set()


@pytest.mark.asyncio
async def test_get_alembic_revisions_single():
    from app.api.database_mgmt import _get_alembic_revisions
    db = _mock_db(["ccc222222222"])
    result = await _get_alembic_revisions(db)
    assert result == {"ccc222222222"}


@pytest.mark.asyncio
async def test_get_alembic_revisions_multi_branch():
    """Framework + plugin both present → both returned."""
    from app.api.database_mgmt import _get_alembic_revisions
    db = _mock_db(["ccc222222222", "ppp333333333"])
    result = await _get_alembic_revisions(db)
    assert result == {"ccc222222222", "ppp333333333"}


@pytest.mark.asyncio
async def test_get_alembic_revisions_db_error_returns_empty():
    from app.api.database_mgmt import _get_alembic_revisions
    db = AsyncMock()
    db.execute.side_effect = Exception("connection refused")
    result = await _get_alembic_revisions(db)
    assert result == set()


# ─────────────────────────────────────────────────────────────────────────────
# _get_alembic_current
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_alembic_current_no_rows():
    from app.api.database_mgmt import _get_alembic_current
    db = _mock_db([])
    assert await _get_alembic_current(db) is None


@pytest.mark.asyncio
async def test_get_alembic_current_framework_head_present():
    """When framework head is in alembic_version, it is returned."""
    from app.api.database_mgmt import _get_alembic_current
    db = _mock_db(["ccc222222222", "ppp333333333"])
    result = await _get_alembic_current(db)
    assert result == "ccc222222222"


@pytest.mark.asyncio
async def test_get_alembic_current_legacy_single_row():
    """Legacy single-row case: the one revision is returned."""
    from app.api.database_mgmt import _get_alembic_current
    # Simulate a plugin revision being the only row (old linear model)
    db = _mock_db(["ppp333333333"])
    result = await _get_alembic_current(db)
    assert result == "ppp333333333"


@pytest.mark.asyncio
async def test_get_alembic_current_partial_framework():
    """Framework not at head — most recent applied framework revision returned."""
    from app.api.database_mgmt import _get_alembic_current
    # 1.1.0 revision applied, 1.2.0 not yet
    db = _mock_db(["bbb111111111"])
    result = await _get_alembic_current(db)
    assert result == "bbb111111111"


# ─────────────────────────────────────────────────────────────────────────────
# POST /migrations/framework/upgrade
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_upgrade_framework_success():
    from app.api.database_mgmt import upgrade_framework_schema

    mock_proc = MagicMock(spec=subprocess.CompletedProcess)
    mock_proc.returncode = 0
    mock_proc.stdout = "Running upgrade...\nDone."
    mock_proc.stderr = ""

    mock_db = _mock_db(["ccc222222222"])

    with patch("app.api.database_mgmt._run_alembic", return_value=mock_proc):
        result = await upgrade_framework_schema(db=mock_db, _admin={"user_id": "1"})

    assert result["success"] is True
    assert "output" in result


@pytest.mark.asyncio
async def test_upgrade_framework_alembic_failure():
    from app.api.database_mgmt import upgrade_framework_schema
    from fastapi import HTTPException

    mock_proc = MagicMock(spec=subprocess.CompletedProcess)
    mock_proc.returncode = 1
    mock_proc.stdout = ""
    mock_proc.stderr = "ERROR: can't locate revision"

    mock_db = _mock_db([])

    with patch("app.api.database_mgmt._run_alembic", return_value=mock_proc):
        with pytest.raises(HTTPException) as exc_info:
            await upgrade_framework_schema(db=mock_db, _admin={"user_id": "1"})

    assert exc_info.value.status_code == 500


# ─────────────────────────────────────────────────────────────────────────────
# POST /migrations/plugins/{plugin_name}/apply
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_apply_plugin_migration_success():
    from app.api.database_mgmt import apply_plugin_migration

    mock_proc = MagicMock(spec=subprocess.CompletedProcess)
    mock_proc.returncode = 0
    mock_proc.stdout = "Applying event_logging branch...\nDone."
    mock_proc.stderr = ""

    mock_db = _mock_db(["ccc222222222"])

    with patch("app.api.database_mgmt._run_alembic", return_value=mock_proc) as mock_alembic:
        result = await apply_plugin_migration(
            plugin_name="event_logging",
            db=mock_db,
            _admin={"user_id": "1"},
        )

    assert result["success"] is True
    # Must have run alembic upgrade with the plugin's head revision
    call_args = mock_alembic.call_args[0]
    assert "ppp333333333" in call_args


@pytest.mark.asyncio
async def test_apply_plugin_migration_unknown_plugin():
    from app.api.database_mgmt import apply_plugin_migration
    from fastapi import HTTPException

    mock_db = _mock_db(["ccc222222222"])

    with pytest.raises(HTTPException) as exc_info:
        await apply_plugin_migration(
            plugin_name="no_such_plugin",
            db=mock_db,
            _admin={"user_id": "1"},
        )

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_apply_plugin_migration_alembic_failure():
    from app.api.database_mgmt import apply_plugin_migration
    from fastapi import HTTPException

    mock_proc = MagicMock(spec=subprocess.CompletedProcess)
    mock_proc.returncode = 1
    mock_proc.stdout = ""
    mock_proc.stderr = "ERROR: table already exists"

    mock_db = _mock_db(["ccc222222222"])

    with patch("app.api.database_mgmt._run_alembic", return_value=mock_proc):
        with pytest.raises(HTTPException) as exc_info:
            await apply_plugin_migration(
                plugin_name="event_logging",
                db=mock_db,
                _admin={"user_id": "1"},
            )

    assert exc_info.value.status_code == 500
