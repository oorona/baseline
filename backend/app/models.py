from sqlalchemy import Column, String, BigInteger, Boolean, DateTime, ForeignKey, Enum as SQLEnum, Text, JSON, Float, Integer
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func
import enum

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, index=True)  # Discord User ID
    username = Column(String, nullable=False)
    discriminator = Column(String, nullable=True) # Nullable as Discord is removing them
    avatar_url = Column(String, nullable=True)
    refresh_token = Column(String, nullable=True)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    preferences = Column(JSON, default={})

    authorized_guilds = relationship("AuthorizedUser", back_populates="user")
    tokens = relationship("UserToken", back_populates="user", cascade="all, delete-orphan")

class UserToken(Base):
    __tablename__ = "user_tokens"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String, unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    last_used_at = Column(DateTime(timezone=True), server_default=func.now())
    client_info = Column(String, nullable=True)

    user = relationship("User", back_populates="tokens")

class Guild(Base):
    __tablename__ = "guilds"
    __guild_scoped__ = True  # RLS on `id` column (id IS the Discord guild identifier)

    id = Column(BigInteger, primary_key=True, index=True)  # Discord Guild ID
    name = Column(String, nullable=False)
    icon_url = Column(String, nullable=True)
    owner_id = Column(BigInteger, nullable=False)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

    authorized_users = relationship("AuthorizedUser", back_populates="guild")
    authorized_roles = relationship("AuthorizedRole", back_populates="guild")
    settings = relationship("GuildSettings", back_populates="guild", uselist=False)

class PermissionLevel(enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    USER = "user"

class AuthorizedUser(Base):
    __tablename__ = "authorized_users"
    __guild_scoped__ = True  # RLS on guild_id

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    guild_id = Column(BigInteger, ForeignKey("guilds.id"), nullable=False)
    permission_level = Column(SQLEnum(PermissionLevel), default=PermissionLevel.USER)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(BigInteger, nullable=True) # User ID who granted permission

    user = relationship("User", back_populates="authorized_guilds")
    guild = relationship("Guild", back_populates="authorized_users")

class AuthorizedRole(Base):
    __tablename__ = "authorized_roles"
    __guild_scoped__ = True  # RLS on guild_id

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    guild_id = Column(BigInteger, ForeignKey("guilds.id"), nullable=False)
    role_id = Column(String, nullable=False) # Discord Role ID (String because it can be large and API sends string)
    permission_level = Column(SQLEnum(PermissionLevel), default=PermissionLevel.USER)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(BigInteger, nullable=True) # User ID who granted permission

    guild = relationship("Guild", back_populates="authorized_roles")

class GuildSettings(Base):
    __tablename__ = "guild_settings"
    __guild_scoped__ = True  # RLS on guild_id

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    guild_id = Column(BigInteger, ForeignKey("guilds.id"), unique=True, nullable=False)
    settings_json = Column(JSON, default={})  # Flexible JSON storage for any settings
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by = Column(BigInteger, nullable=True)  # User ID who last updated

    guild = relationship("Guild", back_populates="settings")

class Shard(Base):
    __tablename__ = "shards"

    shard_id = Column(BigInteger, primary_key=True)
    status = Column(String, default="CONNECTING")  # READY, CONNECTING, DISCONNECTED, etc.
    latency = Column(BigInteger, default=0)  # in milliseconds
    guild_count = Column(BigInteger, default=0)
    last_heartbeat = Column(DateTime(timezone=True), server_default=func.now())

class AuditLog(Base):
    __tablename__ = "audit_logs"
    __guild_scoped__ = True  # RLS on guild_id

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    guild_id = Column(BigInteger, ForeignKey("guilds.id"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    action = Column(String, nullable=False) # e.g. "UPDATE_SETTINGS", "ADD_USER"
    details = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")

class LLMUsage(Base):
    __tablename__ = "llm_usage"
    __guild_scoped__ = True  # RLS on guild_id (nullable — NULL = system/global usage)

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    guild_id = Column(BigInteger, ForeignKey("guilds.id"), nullable=True) # Nullable for global/system usage
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    cost = Column(Float, default=0.0)
    tokens = Column(BigInteger, default=0) # Total tokens
    prompt_tokens = Column(BigInteger, default=0)
    completion_tokens = Column(BigInteger, default=0)
    thoughts_tokens = Column(BigInteger, default=0)  # Gemini 3 thinking tokens
    cached_tokens = Column(BigInteger, default=0)  # Cached content tokens
    provider = Column(String, nullable=False)
    model = Column(String, nullable=False)
    request_type = Column(String, default="text") # text, chat, image, etc.
    capability_type = Column(String, nullable=True)  # Gemini capability (text_generation, image_generation, etc.)
    latency = Column(Float, default=0.0) # Seconds
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    context_id = Column(String, nullable=True) # For grouping chat turn usage
    
    # Additional metadata
    thinking_level = Column(String, nullable=True)  # For Gemini 3 thinking
    image_count = Column(BigInteger, default=0)  # For image generation
    audio_duration_seconds = Column(Float, default=0.0)  # For TTS/audio


class LLMModelPricing(Base):
    __tablename__ = "llm_model_pricing"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    provider = Column(String, nullable=False)
    model = Column(String, nullable=False, unique=True)
    input_cost_per_1k = Column(Float, default=0.0)
    output_cost_per_1k = Column(Float, default=0.0)
    cached_cost_per_1k = Column(Float, default=0.0)  # Discounted rate for cached tokens
    image_cost = Column(Float, default=0.0)
    audio_cost_per_minute = Column(Float, default=0.0)  # For TTS
    is_active = Column(Boolean, default=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class LLMUsageSummary(Base):
    """
    Aggregated LLM usage summary by capability and time period.
    Use for reporting and cost analysis.
    """
    __tablename__ = "llm_usage_summary"
    __guild_scoped__ = True  # RLS on guild_id (nullable — NULL = system/global usage)

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    guild_id = Column(BigInteger, ForeignKey("guilds.id"), nullable=True)
    period_start = Column(DateTime(timezone=True), nullable=False)  # Start of period (hour/day)
    period_type = Column(String, nullable=False)  # "hour", "day", "month"
    capability_type = Column(String, nullable=False)  # text_generation, image_generation, etc.
    provider = Column(String, nullable=False)
    model = Column(String, nullable=False)

    # Aggregated metrics
    request_count = Column(BigInteger, default=0)
    total_tokens = Column(BigInteger, default=0)
    total_prompt_tokens = Column(BigInteger, default=0)
    total_completion_tokens = Column(BigInteger, default=0)
    total_cached_tokens = Column(BigInteger, default=0)
    total_cost = Column(Float, default=0.0)
    avg_latency = Column(Float, default=0.0)

    # For images/audio
    total_images = Column(BigInteger, default=0)
    total_audio_seconds = Column(Float, default=0.0)


class DbMigrationHistory(Base):
    """
    Audit trail of every migration run applied to this database.

    Written by the backend immediately before and after calling alembic,
    so operators can see when each upgrade ran, how long it took, who
    triggered it, and whether it succeeded or failed.

    This table is NOT guild-scoped — it is platform-wide infrastructure.
    """
    __tablename__ = "db_migration_history"

    id             = Column(BigInteger, primary_key=True, autoincrement=True)
    from_revision  = Column(String, nullable=True)   # NULL on a fresh install
    to_revision    = Column(String, nullable=False)
    from_version   = Column(String, nullable=True)   # app version before upgrade
    to_version     = Column(String, nullable=True)   # app version after upgrade
    applied_at     = Column(DateTime(timezone=True), server_default=func.now())
    applied_by     = Column(BigInteger, nullable=True)   # Discord user ID of admin
    duration_ms    = Column(BigInteger, nullable=True)   # wall-clock time in ms
    status         = Column(String, nullable=False)      # "success" | "failure"
    error          = Column(Text, nullable=True)         # stderr on failure


class CardUsage(Base):
    """
    Tracks dashboard card clicks to measure feature popularity.
    Records which cards are accessed, by whom, and at what permission level.
    Not guild-scoped — platform-wide analytics visible to developers only.
    """
    __tablename__ = "card_usage"

    id               = Column(BigInteger, primary_key=True, autoincrement=True)
    card_id          = Column(String, nullable=False, index=True)   # e.g. "ai-analytics", "permissions"
    user_id          = Column(BigInteger, nullable=True, index=True) # Discord user ID (nullable for future anon)
    permission_level = Column(String, nullable=True)                # e.g. "DEVELOPER", "ADMIN", "USER"
    guild_id         = Column(BigInteger, nullable=True, index=True) # context guild at time of click
    timestamp        = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class GuildEvent(Base):
    """
    Timeline of guild join/leave events.
    Used to track bot growth over time — when servers were added or removed.
    Written by the bot when Discord fires on_guild_join / on_guild_remove.
    """
    __tablename__ = "guild_events"

    id           = Column(BigInteger, primary_key=True, autoincrement=True)
    guild_id     = Column(BigInteger, nullable=False, index=True)
    guild_name   = Column(String, nullable=False)
    event_type   = Column(String, nullable=False)   # "JOIN" | "LEAVE"
    member_count = Column(Integer, nullable=True)   # approximate at time of event
    timestamp    = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class RequestMetrics(Base):
    """
    Per-request HTTP performance metrics.
    Written by MetricsMiddleware for every non-health-check API request.
    Enables historical latency queries and trend analysis per endpoint.
    """
    __tablename__ = "request_metrics"

    id          = Column(BigInteger, primary_key=True, autoincrement=True)
    path        = Column(String, nullable=False, index=True)   # normalized, e.g. /guilds/:id
    method      = Column(String, nullable=False)
    status_code = Column(Integer, nullable=False, index=True)
    duration_ms = Column(Float, nullable=False)
    user_id     = Column(BigInteger, nullable=True, index=True)
    timestamp   = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class BotCommandMetrics(Base):
    """
    Per-invocation Discord command timing.
    Written by bot command hooks (on_command / on_command_completion / on_command_error)
    and slash command wrappers.
    """
    __tablename__ = "bot_command_metrics"

    id         = Column(BigInteger, primary_key=True, autoincrement=True)
    command    = Column(String, nullable=False, index=True)
    cog        = Column(String, nullable=True, index=True)
    guild_id   = Column(BigInteger, nullable=True, index=True)
    user_id    = Column(BigInteger, nullable=False)
    duration_ms = Column(Float, nullable=False)
    success    = Column(Boolean, nullable=False, default=True)
    error_type = Column(String, nullable=True)
    timestamp  = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class AppConfig(Base):
    """
    Dynamic application configuration overrides.

    At runtime the backend merges:
      1. env-var / .env defaults  (lowest priority)
      2. rows in this table       (highest priority for dynamic keys)

    Only settings marked is_dynamic=True in settings_definitions.py should be
    stored here.  Static settings still require a server restart.
    """
    __tablename__ = "app_config"

    id         = Column(BigInteger, primary_key=True, autoincrement=True)
    key        = Column(String, unique=True, nullable=False, index=True)
    value      = Column(Text, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by = Column(BigInteger, nullable=True)  # Discord user ID of last editor


