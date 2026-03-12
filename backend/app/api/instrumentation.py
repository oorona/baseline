"""
Instrumentation API — record and query analytics & performance metrics.

Endpoints
─────────
POST /card-click       — authenticated users record a dashboard card click
POST /bot-command      — bot (internal) records a command invocation
POST /guild-event      — bot (internal) records a guild join/leave event
GET  /stats            — DEVELOPER only; aggregated stats for the dashboard
GET  /metrics          — Prometheus text format; internal network only
"""

import re
import time
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, verify_platform_admin
from app.api.prom_metrics import (
    card_views_total,
    guild_count,
    guild_joins_total,
    guild_leaves_total,
    bot_commands_total,
    bot_command_duration_seconds,
)
from app.db.session import get_db
from app.models import BotCommandMetrics, CardUsage, GuildEvent, RequestMetrics

router = APIRouter()
logger = structlog.get_logger()

# Paths that are internal-only for metrics exposure
_INTERNAL_IPS = {"127.0.0.1", "::1"}
_INTERNAL_PREFIXES = ("172.", "192.168.", "10.")


def _is_internal(request: Request) -> bool:
    host = request.client.host if request.client else "unknown"
    return (
        host in _INTERNAL_IPS
        or any(host.startswith(p) for p in _INTERNAL_PREFIXES)
        or request.headers.get("X-Gateway-Request") == "true"  # routed through trusted nginx
    )


# ── Card click ─────────────────────────────────────────────────────────────────

class CardClickRequest(BaseModel):
    card_id: str
    guild_id: Optional[int] = None


@router.post("/card-click", status_code=204)
async def record_card_click(
    body: CardClickRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Record a dashboard card click for usage analytics."""
    permission_level = current_user.get("permission_level", "USER")
    db.add(CardUsage(
        card_id=body.card_id,
        user_id=int(current_user.get("user_id") or 0),
        permission_level=permission_level,
        guild_id=body.guild_id,
    ))
    await db.commit()
    card_views_total.labels(card_id=body.card_id, permission_level=permission_level).inc()


# ── Bot command metrics ────────────────────────────────────────────────────────

class BotCommandRequest(BaseModel):
    command: str
    cog: Optional[str] = None
    guild_id: Optional[int] = None
    user_id: int
    duration_ms: float
    success: bool = True
    error_type: Optional[str] = None


@router.post("/bot-command", status_code=204)
async def record_bot_command(
    body: BotCommandRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Record a Discord bot command invocation.
    Called by the bot itself; secured by internal Docker network trust.
    """
    db.add(BotCommandMetrics(
        command=body.command,
        cog=body.cog,
        guild_id=body.guild_id,
        user_id=body.user_id,
        duration_ms=body.duration_ms,
        success=body.success,
        error_type=body.error_type,
    ))
    await db.commit()

    cog = body.cog or "unknown"
    bot_commands_total.labels(command=body.command, cog=cog, success=str(body.success)).inc()
    bot_command_duration_seconds.labels(command=body.command, cog=cog).observe(body.duration_ms / 1000)


# ── Guild event ────────────────────────────────────────────────────────────────

class GuildEventRequest(BaseModel):
    guild_id: int
    guild_name: str
    event_type: str   # "JOIN" | "LEAVE"
    member_count: Optional[int] = None


@router.post("/guild-event", status_code=204)
async def record_guild_event(
    body: GuildEventRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Record a guild join or leave event.
    Called by the bot on on_guild_join / on_guild_remove.
    Secured by internal Docker network trust.
    """
    db.add(GuildEvent(
        guild_id=body.guild_id,
        guild_name=body.guild_name,
        event_type=body.event_type.upper(),
        member_count=body.member_count,
    ))
    await db.commit()

    if body.event_type.upper() == "JOIN":
        guild_joins_total.inc()
        guild_count.inc()
    else:
        guild_leaves_total.inc()
        guild_count.dec()

    logger.info("guild_event_recorded", guild_id=body.guild_id, event_type=body.event_type)


# ── Stats query ────────────────────────────────────────────────────────────────

def _range_cutoff(range_str: str) -> datetime:
    hours = {"24h": 24, "7d": 168, "30d": 720}.get(range_str, 168)
    return datetime.now(timezone.utc) - timedelta(hours=hours)


@router.get("/stats")
async def get_instrumentation_stats(
    range: str = Query(default="7d", pattern="^(24h|7d|30d)$"),
    guild_id: Optional[int] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _admin: dict = Depends(verify_platform_admin),
):
    """
    Aggregated instrumentation stats for the developer dashboard.
    Level 5 (platform admin) only.

    Returns:
    - guild_growth: list of {date, joins, leaves, net} daily buckets
    - card_usage:   list of {card_id, count, unique_users}
    - top_commands: list of {command, cog, count, avg_ms, p95_ms, success_rate}
    - endpoint_perf: list of {path, method, count, p50_ms, p95_ms, p99_ms}
    """
    cutoff = _range_cutoff(range)

    # ── Guild growth ───────────────────────────────────────────────────────────
    guild_q = select(
        func.date_trunc("day", GuildEvent.timestamp).label("day"),
        func.count().filter(GuildEvent.event_type == "JOIN").label("joins"),
        func.count().filter(GuildEvent.event_type == "LEAVE").label("leaves"),
    ).where(GuildEvent.timestamp >= cutoff).group_by(text("day")).order_by(text("day"))

    guild_rows = (await db.execute(guild_q)).all()
    guild_growth = [
        {"date": str(r.day.date()), "joins": r.joins, "leaves": r.leaves, "net": r.joins - r.leaves}
        for r in guild_rows
    ]

    # ── Card usage ─────────────────────────────────────────────────────────────
    card_q = select(
        CardUsage.card_id,
        func.count().label("count"),
        func.count(func.distinct(CardUsage.user_id)).label("unique_users"),
    ).where(CardUsage.timestamp >= cutoff)

    if guild_id:
        card_q = card_q.where(CardUsage.guild_id == guild_id)

    card_q = card_q.group_by(CardUsage.card_id).order_by(func.count().desc())
    card_rows = (await db.execute(card_q)).all()
    card_usage = [
        {"card_id": r.card_id, "count": r.count, "unique_users": r.unique_users}
        for r in card_rows
    ]

    # ── Top bot commands ───────────────────────────────────────────────────────
    cmd_q = select(
        BotCommandMetrics.command,
        BotCommandMetrics.cog,
        func.count().label("count"),
        func.avg(BotCommandMetrics.duration_ms).label("avg_ms"),
        func.percentile_cont(0.95).within_group(BotCommandMetrics.duration_ms).label("p95_ms"),
        func.avg(BotCommandMetrics.success.cast(type_=None)).label("success_rate"),
    ).where(BotCommandMetrics.timestamp >= cutoff)

    if guild_id:
        cmd_q = cmd_q.where(BotCommandMetrics.guild_id == guild_id)

    cmd_q = cmd_q.group_by(BotCommandMetrics.command, BotCommandMetrics.cog).order_by(func.count().desc()).limit(50)
    cmd_rows = (await db.execute(cmd_q)).all()
    top_commands = [
        {
            "command": r.command,
            "cog": r.cog,
            "count": r.count,
            "avg_ms": round(float(r.avg_ms or 0), 1),
            "p95_ms": round(float(r.p95_ms or 0), 1),
            "success_rate": round(float(r.success_rate or 0) * 100, 1),
        }
        for r in cmd_rows
    ]

    # ── HTTP endpoint performance ──────────────────────────────────────────────
    perf_q = select(
        RequestMetrics.path,
        RequestMetrics.method,
        func.count().label("count"),
        func.percentile_cont(0.50).within_group(RequestMetrics.duration_ms).label("p50_ms"),
        func.percentile_cont(0.95).within_group(RequestMetrics.duration_ms).label("p95_ms"),
        func.percentile_cont(0.99).within_group(RequestMetrics.duration_ms).label("p99_ms"),
    ).where(RequestMetrics.timestamp >= cutoff).group_by(
        RequestMetrics.path, RequestMetrics.method
    ).order_by(func.count().desc()).limit(100)

    perf_rows = (await db.execute(perf_q)).all()
    endpoint_perf = [
        {
            "path": r.path,
            "method": r.method,
            "count": r.count,
            "p50_ms": round(float(r.p50_ms or 0), 1),
            "p95_ms": round(float(r.p95_ms or 0), 1),
            "p99_ms": round(float(r.p99_ms or 0), 1),
        }
        for r in perf_rows
    ]

    return {
        "range": range,
        "guild_id_filter": guild_id,
        "guild_growth": guild_growth,
        "card_usage": card_usage,
        "top_commands": top_commands,
        "endpoint_perf": endpoint_perf,
    }


# ── Prometheus /metrics endpoint ───────────────────────────────────────────────

@router.get("/metrics")
async def prometheus_metrics(request: Request):
    """
    Prometheus text-format metrics endpoint.
    Only accessible from internal network IPs (not routed through nginx to the public).
    """
    if not _is_internal(request):
        raise HTTPException(status_code=403, detail="Metrics endpoint is internal only")

    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
