#!/bin/bash
set -e

# Postgres will pass these environment variables automatically:
# POSTGRES_USER
# POSTGRES_DB
# POSTGRES_PASSWORD

# Custom variable you must supply:
# BASELINE_PASSWORD (set by entrypoint-wrapper.sh)

if [ -z "$BASELINE_PASSWORD" ]; then
  echo "ERROR: BASELINE_PASSWORD must be set"
  exit 1
fi

echo "Creating user, database, and schema for baseline..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL

  -- Create user
  CREATE USER baseline WITH PASSWORD '${BASELINE_PASSWORD}';

  -- Create database
  CREATE DATABASE baseline OWNER baseline;

  -- Connect into the new database to configure schema
  \c baseline;

  -- Create schema owned by baseline user
  CREATE SCHEMA IF NOT EXISTS baseline AUTHORIZATION baseline;

  -- Set search_path so SQLAlchemy defaults to schema baseline
  ALTER ROLE baseline IN DATABASE baseline
      SET search_path = baseline, public;

EOSQL

echo "Baseline DB, user, and schema created."
