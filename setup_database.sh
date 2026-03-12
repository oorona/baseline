#!/usr/bin/env bash
# =============================================================================
# setup_database.sh — Create the application database user and schema
#
# Run this ONCE after `docker compose up -d postgres` and before starting
# the full stack for the first time.
#
# Schema isolation:
#   The schema name always equals the database username.
#   ALL application objects (tables, views, sequences, etc.) live inside
#   that schema.  The public schema is off-limits for the app user.
#
#   This means multiple bots can share the same postgres cluster safely:
#     bot_a  →  database: bot_a,  schema: bot_a,  user: bot_a
#     bot_b  →  database: bot_b,  schema: bot_b,  user: bot_b
#   Their objects never mix, and neither can write to the other's schema.
#
# Usage:
#   ./setup_database.sh --user myuser
#   ./setup_database.sh --user myuser --password mysecret --db mydb
#
# Options:
#   --user      DB username (and schema name)  (REQUIRED)
#   --password  DB password                    (prompted if omitted)
#   --db        Database name                  (default: same as --user)
#   --service   Compose service name           (default: postgres)
#
# The credentials you choose here are what you enter in the Setup Wizard.
# The wizard will test the connection and run Alembic migrations to create
# all tables inside the dedicated schema.
# =============================================================================

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────
APP_USER=""     # required — set via --user
APP_PASSWORD=""
APP_DB=""       # defaults to APP_USER if not set
PG_SERVICE="postgres"

# ── Parse arguments ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --user)     APP_USER="$2";     shift 2 ;;
    --password) APP_PASSWORD="$2"; shift 2 ;;
    --db)       APP_DB="$2";       shift 2 ;;
    --service)  PG_SERVICE="$2";   shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Schema name is always the same as the username — not configurable.
if [[ -z "$APP_USER" ]]; then
  echo ""
  echo "  ERROR: --user is required."
  echo ""
  echo "  Usage: ./setup_database.sh --user <username> [--password <pass>] [--db <dbname>]"
  echo ""
  exit 1
fi

APP_SCHEMA="$APP_USER"
APP_DB="${APP_DB:-$APP_USER}"

# ── Prompt for password if not supplied ───────────────────────────────────────
if [[ -z "$APP_PASSWORD" ]]; then
  echo ""
  read -rsp "Password for database user '${APP_USER}': " APP_PASSWORD
  echo ""
  read -rsp "Confirm password: " APP_PASSWORD_CONFIRM
  echo ""
  if [[ "$APP_PASSWORD" != "$APP_PASSWORD_CONFIRM" ]]; then
    echo "ERROR: Passwords do not match."
    exit 1
  fi
fi

if [[ -z "$APP_PASSWORD" ]]; then
  echo "ERROR: Password cannot be empty."
  exit 1
fi

# ── Verify the postgres container is running ──────────────────────────────────
echo ""
echo "Checking postgres container ('${PG_SERVICE}')..."

if ! docker compose ps --status running "$PG_SERVICE" 2>/dev/null | grep -q "$PG_SERVICE"; then
  echo ""
  echo "  ERROR: '${PG_SERVICE}' container is not running."
  echo ""
  echo "  Start it first:"
  echo "    docker compose up -d ${PG_SERVICE}"
  echo ""
  exit 1
fi

echo "  Container is running."

# ── Step 1: Create the role and database ──────────────────────────────────────
echo ""
echo "Creating role '${APP_USER}' and database '${APP_DB}'..."

docker compose exec -T "$PG_SERVICE" psql -U postgres -v ON_ERROR_STOP=1 <<-EOSQL
  -- Create the application role (idempotent)
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_USER}') THEN
      CREATE ROLE "${APP_USER}" WITH LOGIN PASSWORD '${APP_PASSWORD}';
      RAISE NOTICE 'Role "${APP_USER}" created.';
    ELSE
      ALTER ROLE "${APP_USER}" WITH PASSWORD '${APP_PASSWORD}';
      RAISE NOTICE 'Role "${APP_USER}" already exists — password updated.';
    END IF;
  END
  \$\$;

  -- Create the database (idempotent)
  SELECT 'CREATE DATABASE "${APP_DB}" OWNER "${APP_USER}"'
  WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${APP_DB}')
  \gexec
EOSQL

# ── Step 2: Configure schema isolation ────────────────────────────────────────
# Schema name == username.  All objects land here, never in public.
echo "Configuring schema isolation (schema: '${APP_SCHEMA}')..."

docker compose exec -T "$PG_SERVICE" psql -U postgres -d "$APP_DB" -v ON_ERROR_STOP=1 <<-EOSQL

  -- Create the dedicated schema owned by the app user
  CREATE SCHEMA IF NOT EXISTS "${APP_SCHEMA}" AUTHORIZATION "${APP_USER}";

  -- search_path = schema only.  The connection never sees public.
  -- Every table, view, sequence created by this user lands in "${APP_SCHEMA}".
  ALTER ROLE "${APP_USER}" IN DATABASE "${APP_DB}"
    SET search_path = "${APP_SCHEMA}";

  -- Full ownership of the schema
  GRANT ALL ON SCHEMA "${APP_SCHEMA}" TO "${APP_USER}";

  -- Revoke the app user's ability to create anything in public
  REVOKE CREATE ON SCHEMA public FROM "${APP_USER}";

EOSQL

echo "  Done."

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Database ready."
echo ""
echo "  Enter these credentials in the Setup Wizard:"
echo ""
echo "    Host:     postgres   (Docker service name)"
echo "    Port:     5432"
echo "    User:     ${APP_USER}"
echo "    Password: ${APP_PASSWORD}"
echo "    Database: ${APP_DB}"
echo "    Schema:   ${APP_SCHEMA}   (same as username — auto-set)"
echo ""
echo "  All application objects will be created in the"
echo "  '${APP_SCHEMA}' schema.  Public schema is off-limits."
echo ""
echo "  Next step:"
echo "    docker compose up"
echo "═══════════════════════════════════════════════════════════"
echo ""
