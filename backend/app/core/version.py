"""
Framework version and database migration tracking.

FRAMEWORK_VERSION  — semantic version of this codebase release.
VERSION_REVISIONS  — maps each app version to the Alembic HEAD revision for
                     that version.  Used to know which alembic revision to
                     target when upgrading to a specific app version.
MIGRATION_CHANGELOG — ordered list of version entries, each describing which
                     Alembic revisions were introduced in that version.

──────────────────────────────────────────────────────────────────────────────
HOW TO RELEASE A NEW VERSION WITH SCHEMA CHANGES
──────────────────────────────────────────────────────────────────────────────
1. Create the new Alembic migration(s):
       alembic revision --autogenerate -m "describe_what_changed"
   Note the new revision ID (e.g. "f6a7b8c9d0e1").

2. Bump FRAMEWORK_VERSION to the new version string (e.g. "1.1.0").

3. Add the new version to VERSION_REVISIONS:
       "1.1.0": "f6a7b8c9d0e1",   # HEAD revision for this version

4. Append a new entry to MIGRATION_CHANGELOG with:
   - version       : same string as in VERSION_REVISIONS
   - description   : human-readable summary of the schema changes
   - revisions     : list of ALL new revision IDs introduced in this version
   - head_revision : the LAST revision in the list (what alembic upgrades to)

5. The Database Management page will automatically detect that the live DB
   is behind and show a version-by-version upgrade path.
──────────────────────────────────────────────────────────────────────────────
"""

from typing import Optional

# ── Current framework version ─────────────────────────────────────────────────

FRAMEWORK_VERSION: str = "1.3.0"

# ── Version → Alembic HEAD revision map ──────────────────────────────────────
#
# Key:   app version string
# Value: the Alembic revision that is the HEAD for that version.
#        Running `alembic upgrade <head_revision>` brings the DB to this version.

VERSION_REVISIONS: dict[str, str] = {
    "1.0.0": "c8d4e5f6a7b9",
    "1.1.0": "d2e3f4a5b6c7",
    "1.2.0": "e3f4a5b6c7d8",
    "1.3.0": "f1a2b3c4d5e6",
}

# Derived: the Alembic revision required by the CURRENT framework version.
REQUIRED_DB_REVISION: str = VERSION_REVISIONS[FRAMEWORK_VERSION]

# ── Detailed migration changelog ──────────────────────────────────────────────
#
# Ordered from oldest to newest version.
# Each entry:
#   version        — app version string (matches VERSION_REVISIONS key)
#   description    — one-line summary of schema changes in this version
#   revisions      — all Alembic revision IDs introduced by this version, in
#                    application order (oldest first)
#   head_revision  — the last element of `revisions`; the target for
#                    `alembic upgrade <head_revision>`

MIGRATION_CHANGELOG: list[dict] = [
    {
        "version":       "1.0.0",
        "description":   "Initial schema — users, guilds, permissions, audit log, LLM tracking, app config",
        "revisions":     ["c8d4e5f6a7b9"],
        "head_revision": "c8d4e5f6a7b9",
    },
    {
        "version":       "1.1.0",
        "description":   "Guild isolation — PostgreSQL Row-Level Security on all guild-scoped tables",
        "revisions":     ["d2e3f4a5b6c7"],
        "head_revision": "d2e3f4a5b6c7",
    },
    {
        "version":       "1.2.0",
        "description":   "Migration history — audit trail of every schema upgrade (who, when, duration, result)",
        "revisions":     ["e3f4a5b6c7d8"],
        "head_revision": "e3f4a5b6c7d8",
    },
    {
        "version":       "1.3.0",
        "description":   "Instrumentation — card_usage, guild_events, request_metrics, bot_command_metrics tables for analytics and performance tracking",
        "revisions":     ["f1a2b3c4d5e6"],
        "head_revision": "f1a2b3c4d5e6",
    },
]


# ── Helper functions ──────────────────────────────────────────────────────────

def _version_key(v: str) -> tuple[int, ...]:
    """Return a comparable tuple from a semver string, e.g. "1.2.0" → (1, 2, 0)."""
    try:
        return tuple(int(x) for x in v.split("."))
    except ValueError:
        return (0,)


def get_version_order() -> list[str]:
    """Return all known versions in ascending semantic order."""
    return sorted(VERSION_REVISIONS.keys(), key=_version_key)


def get_app_version_for_revision(revision: Optional[str]) -> Optional[str]:
    """
    Return the app version whose HEAD revision matches *revision*.
    Returns None if *revision* is None or not found in VERSION_REVISIONS.
    """
    if not revision:
        return None
    for version, rev in VERSION_REVISIONS.items():
        if rev == revision:
            return version
    return None


def get_changelog_entry(version: str) -> Optional[dict]:
    """Return the MIGRATION_CHANGELOG entry for *version*, or None."""
    for entry in MIGRATION_CHANGELOG:
        if entry["version"] == version:
            return entry
    return None


def get_upgrade_path(
    current_revision: Optional[str],
    target_version: Optional[str] = None,
) -> list[dict]:
    """
    Return an ordered list of changelog entries that need to be applied to
    bring the database from *current_revision* to *target_version*
    (defaults to FRAMEWORK_VERSION).

    Each returned entry is a MIGRATION_CHANGELOG dict augmented with
    ``"already_applied": bool``.

    Example — DB is at 1.0.0, app is at 1.2.0:
        [
            {"version": "1.1.0", "already_applied": False, ...},
            {"version": "1.2.0", "already_applied": False, ...},
        ]
    """
    if target_version is None:
        target_version = FRAMEWORK_VERSION

    current_version = get_app_version_for_revision(current_revision)
    ordered         = get_version_order()
    path: list[dict] = []

    for entry in MIGRATION_CHANGELOG:
        v = entry["version"]
        if v not in ordered:
            continue

        already_applied = (
            current_version is not None
            and _version_key(v) <= _version_key(current_version)
        )
        is_above_target = _version_key(v) > _version_key(target_version)

        if is_above_target:
            break

        path.append({**entry, "already_applied": already_applied})

    return path
