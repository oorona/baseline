"""
Tests for backend/app/core/version.py

Covers:
  - get_app_version_for_revision() — framework, plugin, and unknown revisions
  - is_plugin_revision()
  - get_version_order()
  - get_upgrade_path() — already-applied, pending, and partial states
"""

import pytest
from unittest.mock import patch

# The module loads migration_inventory.json at import time.  We patch the
# inventory so tests are independent of the real file contents.
_FAKE_INVENTORY = {
    "framework_version": "1.2.0",
    "framework_migrations": [
        {
            "version": "1.0.0",
            "description": "Initial schema",
            "head_revision": "aaa000000000",
            "revisions": ["aaa000000000"],
        },
        {
            "version": "1.1.0",
            "description": "Add guilds table",
            "head_revision": "bbb111111111",
            "revisions": ["bbb111111111"],
        },
        {
            "version": "1.2.0",
            "description": "Add audit log",
            "head_revision": "ccc222222222",
            "revisions": ["ccc222222222"],
        },
    ],
    "plugin_migrations": [
        {
            "plugin": "event_logging",
            "version": "1.0.0",
            "description": "Event logging tables",
            "revisions": ["ppp333333333"],
            "head_revision": "ppp333333333",
        },
        {
            "plugin": "polls",
            "version": "2.0.0",
            "description": "Polls tables",
            "revisions": ["qqq444444444"],
            "head_revision": "qqq444444444",
        },
    ],
}


def _reload_version():
    """Import version with the patched inventory."""
    import importlib
    import app.core.version as v
    importlib.reload(v)
    return v


@pytest.fixture(autouse=True)
def patch_inventory(tmp_path):
    import json
    inv_file = tmp_path / "migration_inventory.json"
    inv_file.write_text(json.dumps(_FAKE_INVENTORY))

    import app.core.version as v
    with patch.object(v, "_INVENTORY_PATH", inv_file):
        # Reload so module-level constants pick up the patched path
        import importlib
        importlib.reload(v)
        yield v
    # Reload again after test to restore real constants
    importlib.reload(v)


# ─────────────────────────────────────────────────────────────────────────────
# is_plugin_revision
# ─────────────────────────────────────────────────────────────────────────────

class TestIsPluginRevision:
    def test_known_plugin_revision(self, patch_inventory):
        assert patch_inventory.is_plugin_revision("ppp333333333") is True

    def test_second_plugin_revision(self, patch_inventory):
        assert patch_inventory.is_plugin_revision("qqq444444444") is True

    def test_framework_revision_is_not_plugin(self, patch_inventory):
        assert patch_inventory.is_plugin_revision("ccc222222222") is False

    def test_none_returns_false(self, patch_inventory):
        assert patch_inventory.is_plugin_revision(None) is False

    def test_unknown_revision_returns_false(self, patch_inventory):
        assert patch_inventory.is_plugin_revision("zzz999999999") is False


# ─────────────────────────────────────────────────────────────────────────────
# get_app_version_for_revision
# ─────────────────────────────────────────────────────────────────────────────

class TestGetAppVersionForRevision:
    def test_exact_framework_head(self, patch_inventory):
        assert patch_inventory.get_app_version_for_revision("ccc222222222") == "1.2.0"

    def test_older_framework_revision(self, patch_inventory):
        assert patch_inventory.get_app_version_for_revision("aaa000000000") == "1.0.0"

    def test_plugin_revision_returns_framework_version(self, patch_inventory):
        """Plugin revisions imply the full framework chain is applied."""
        assert patch_inventory.get_app_version_for_revision("ppp333333333") == "1.2.0"

    def test_second_plugin_revision_returns_framework_version(self, patch_inventory):
        assert patch_inventory.get_app_version_for_revision("qqq444444444") == "1.2.0"

    def test_none_returns_none(self, patch_inventory):
        assert patch_inventory.get_app_version_for_revision(None) is None

    def test_unknown_revision_returns_none(self, patch_inventory):
        assert patch_inventory.get_app_version_for_revision("zzz999999999") is None


# ─────────────────────────────────────────────────────────────────────────────
# get_version_order
# ─────────────────────────────────────────────────────────────────────────────

class TestGetVersionOrder:
    def test_ascending_semantic_order(self, patch_inventory):
        assert patch_inventory.get_version_order() == ["1.0.0", "1.1.0", "1.2.0"]


# ─────────────────────────────────────────────────────────────────────────────
# get_upgrade_path
# ─────────────────────────────────────────────────────────────────────────────

class TestGetUpgradePath:
    def test_fresh_db_all_pending(self, patch_inventory):
        """With no current revision, every entry is not yet applied."""
        path = patch_inventory.get_upgrade_path(current_revision=None)
        assert len(path) == 3
        assert all(not e["already_applied"] for e in path)

    def test_current_at_1_0_0(self, patch_inventory):
        path = patch_inventory.get_upgrade_path(current_revision="aaa000000000")
        versions = [(e["version"], e["already_applied"]) for e in path]
        assert versions == [
            ("1.0.0", True),
            ("1.1.0", False),
            ("1.2.0", False),
        ]

    def test_fully_up_to_date(self, patch_inventory):
        path = patch_inventory.get_upgrade_path(current_revision="ccc222222222")
        assert all(e["already_applied"] for e in path)

    def test_plugin_revision_marks_all_applied(self, patch_inventory):
        """When a plugin revision is current, the full framework is considered applied."""
        path = patch_inventory.get_upgrade_path(current_revision="ppp333333333")
        assert all(e["already_applied"] for e in path)

    def test_target_version_limits_output(self, patch_inventory):
        """get_upgrade_path should stop at target_version."""
        path = patch_inventory.get_upgrade_path(
            current_revision=None, target_version="1.1.0"
        )
        versions = [e["version"] for e in path]
        assert versions == ["1.0.0", "1.1.0"]
        assert "1.2.0" not in versions
