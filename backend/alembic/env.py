import asyncio
from logging.config import fileConfig
import os
import sys

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Add backend directory to path
sys.path.append(os.getcwd())

from app.models import Base

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# Load secrets from _FILE variables
for key, value in os.environ.items():
    if key.endswith("_FILE"):
        env_var = key[:-5]
        try:
            with open(value, "r") as f:
                os.environ[env_var] = f.read().strip()
        except Exception as e:
            print(f"Failed to load secret {env_var}: {e}")

# Map POSTGRES_PASSWORD to DB_PASSWORD
if "POSTGRES_PASSWORD" in os.environ:
    os.environ["DB_PASSWORD"] = os.environ["POSTGRES_PASSWORD"]

print(f"DEBUG ENV VARS: DB_HOST={os.environ.get('DB_HOST')}, DB_PASSWORD={'SET' if os.environ.get('DB_PASSWORD') else 'NOT_SET'}")

# Construct DATABASE_URL from components
db_host = os.environ.get("DB_HOST", "postgres")
db_port = os.environ.get("DB_PORT", "5432")
db_user = os.environ.get("DB_USER", "baseline")
db_name = os.environ.get("DB_NAME", "baseline")
db_password = os.environ.get("DB_PASSWORD", "")

password_part = f":{db_password}" if db_password else ""
db_url = f"postgresql+asyncpg://{db_user}{password_part}@{db_host}:{db_port}/{db_name}"

print(f"DEBUG: DB_HOST={db_host}, DB_USER={db_user}, DB_NAME={db_name}, DB_PASSWORD={'SET' if db_password else 'NOT_SET'}")
print(f"DEBUG: Constructed URL: {db_url}")

config.set_main_option("sqlalchemy.url", db_url)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """In this scenario we need to create an Engine
    and associate a connection with the context.

    """

    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""

    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
