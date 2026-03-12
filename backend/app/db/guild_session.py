"""
Guild-scoped database sessions — the correct way to access guild data.

Three session providers are available, each with a distinct purpose:

┌─────────────────┬──────────────────────────────────────────────────────┐
│ Dependency      │ When to use                                          │
├─────────────────┼──────────────────────────────────────────────────────┤
│ get_guild_db    │ Guild-specific endpoints. RLS is ACTIVE — only rows  │
│                 │ belonging to the current guild are visible/writable. │
├─────────────────┼──────────────────────────────────────────────────────┤
│ get_admin_db    │ Platform-admin endpoints that legitimately need       │
│                 │ cross-guild or global access. RLS bypassed.          │
│                 │ Automatically requires verify_platform_admin.        │
├─────────────────┼──────────────────────────────────────────────────────┤
│ get_db          │ Endpoints that access ONLY non-guild-scoped tables   │
│                 │ (users, shards, llm_model_pricing, app_config, etc.) │
│                 │ RLS is bypassed for backward compatibility.           │
└─────────────────┴──────────────────────────────────────────────────────┘

How RLS is applied
──────────────────
PostgreSQL Row-Level Security (RLS) is enabled on every guild-scoped
table (migration 1.1.0).  The active policy is:

    USING (
        guild_id = current_setting('app.current_guild_id', true)::bigint
        OR current_setting('app.bypass_guild_rls', true) = 'true'
    )

get_guild_db sets:  SET LOCAL app.current_guild_id = '<guild_id>'
get_admin_db sets:  SET LOCAL app.bypass_guild_rls = 'true'
get_db sets:        SET LOCAL app.bypass_guild_rls = 'true'  (backward compat)

SET LOCAL is transaction-scoped: the setting is automatically cleared
when the transaction commits or rolls back, so connection pool connections
are never left in a dirty state.

Important
─────────
- FastAPI resolves `guild_id: int` from the path parameter automatically.
  Your endpoint must have `{guild_id}` in its route path.
- Use get_guild_db for ALL endpoints under /{guild_id}/.
- Use get_admin_db for cross-guild admin operations (requires L5 auth).
- Never use get_db for endpoints that touch guild-scoped tables.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from app.api.deps import verify_platform_admin
from app.db.session import get_db


async def get_guild_db(
    guild_id: int,
    db: AsyncSession = Depends(get_db),
) -> AsyncSession:
    """
    Yield a database session scoped to *guild_id*.

    PostgreSQL RLS is activated for this session: every query on a
    guild-scoped table is automatically filtered to rows where
    guild_id matches.  INSERT/UPDATE with a mismatched guild_id is
    rejected by the database engine.

    FastAPI resolves `guild_id` from the route path parameter — the
    route must include `/{guild_id}/` in its path.

    Example
    -------
        @router.get("/{guild_id}/tickets")
        async def list_tickets(
            guild_id: int,
            db: AsyncSession = Depends(get_guild_db),
        ):
            # Only this guild's tickets are returned, even without
            # an explicit WHERE clause.
            return (await db.execute(select(Ticket))).scalars().all()
    """
    await db.execute(
        text("SET LOCAL app.current_guild_id = :gid"),
        {"gid": str(guild_id)},
    )
    yield db


async def get_admin_db(
    db: AsyncSession = Depends(get_db),
    _admin: dict = Depends(verify_platform_admin),
) -> AsyncSession:
    """
    Yield a database session with RLS bypassed.

    Use this ONLY in platform-admin endpoints (Level 5) that have a
    legitimate need to read or write data across multiple guilds —
    for example, the database management page or background jobs.

    The bypass flag is set for the current transaction only and cleared
    automatically when the session closes.

    The verify_platform_admin dependency is included automatically:
    any non-admin request is rejected with 403 before the session is
    even opened.
    """
    await db.execute(text("SET LOCAL app.bypass_guild_rls = 'true'"))
    yield db
