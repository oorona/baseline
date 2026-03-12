#!/usr/bin/env bash
# =============================================================================
# setup_secrets.sh — Generate the encryption key Docker secret
#
# Run this ONCE before your first `docker compose up`.
# It creates ./secrets/encryption_key with a cryptographically random value.
#
# Usage:
#   ./setup_secrets.sh
#   ./setup_secrets.sh --force   # overwrite existing key (loses all settings!)
#
# After this script completes:
#   1. Run:  docker compose up -d postgres
#   2. Run:  ./setup_database.sh
#   3. Run:  docker compose up
#   4. Open the app — you will be redirected to the Setup Wizard.
# =============================================================================

set -euo pipefail

FORCE=false
for arg in "$@"; do
  [[ "$arg" == "--force" ]] && FORCE=true
done

mkdir -p secrets
chmod 700 secrets

KEY_FILE="secrets/encryption_key"

if [[ -f "$KEY_FILE" ]] && [[ "$FORCE" == false ]]; then
  echo ""
  echo "  secrets/encryption_key already exists."
  echo "  To regenerate (WARNING: this invalidates any existing settings.enc):"
  echo "    ./setup_secrets.sh --force"
  echo ""
  exit 0
fi

# Generate a 32-byte hex key using openssl (falls back to /dev/urandom)
if command -v openssl &>/dev/null; then
  openssl rand -hex 32 > "$KEY_FILE"
else
  # fallback: read 32 bytes from /dev/urandom and hex-encode them
  xxd -l 32 -p /dev/urandom | tr -d '\n' > "$KEY_FILE"
fi

chmod 600 "$KEY_FILE"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Encryption key created: secrets/encryption_key"
echo ""
echo "  This key encrypts ALL platform secrets (DB credentials,"
echo "  Discord tokens, API keys, etc.) stored in the Docker"
echo "  volume at /data/settings.enc."
echo ""
echo "  KEEP THIS FILE SAFE:"
echo "    - Never commit it to git  (already in .gitignore)"
echo "    - Back it up securely — losing it means losing all"
echo "      encrypted settings and re-running the wizard"
echo "    - In production, manage it via your secrets manager"
echo ""
echo "  Next steps:"
echo "    docker compose up -d postgres"
echo "    ./setup_database.sh"
echo "    docker compose up"
echo "═══════════════════════════════════════════════════════════"
echo ""
