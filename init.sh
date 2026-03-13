#!/usr/bin/env bash
# =============================================================================
# Baseline Framework — New Bot Initialiser
# =============================================================================
# Run this script ONCE after cloning the repository to start a new bot project.
# It removes all demo/example code that is not needed in production, leaving
# only the core framework structure.
#
# Usage:
#   chmod +x init.sh
#   ./init.sh
#
# Safe to re-run; already-deleted files are silently skipped.
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo
echo -e "${BOLD}${CYAN}Baseline Framework — New Bot Initialiser${RESET}"
echo -e "${CYAN}==========================================${RESET}"
echo
echo -e "This will ${YELLOW}permanently delete${RESET} all demo/example code from this repo."
echo -e "Run it ${BOLD}once${RESET} after cloning, before you start building your bot."
echo
read -rp "Continue? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Aborted.${RESET}"
    exit 0
fi
echo

removed=0
skipped=0

remove_path() {
    local path="$1"
    if [ -e "$path" ]; then
        rm -rf "$path"
        echo -e "  ${GREEN}✓${RESET}  removed  ${path#$SCRIPT_DIR/}"
        ((removed++)) || true
    else
        echo -e "  ${CYAN}–${RESET}  skipped  ${path#$SCRIPT_DIR/}  (already gone)"
        ((skipped++)) || true
    fi
}

# ── Frontend demo pages ───────────────────────────────────────────────────────
echo -e "${BOLD}Frontend demo pages${RESET}"

remove_path "frontend/app/dashboard/[guildId]/gemini-demo"
remove_path "frontend/app/dashboard/[guildId]/test-l1"
remove_path "frontend/app/dashboard/[guildId]/test-l2"
remove_path "frontend/app/dashboard/[guildId]/settings"
remove_path "frontend/app/dashboard/[guildId]/logging"

# ── Backend demo modules ──────────────────────────────────────────────────────
echo
echo -e "${BOLD}Backend demo modules${RESET}"

remove_path "backend/app/api/gemini"

# ── Bot demo cogs & services ──────────────────────────────────────────────────
echo
echo -e "${BOLD}Bot demo cogs & services${RESET}"

remove_path "bot/cogs/gemini_demo.py"
remove_path "bot/cogs/gemini_capabilities_demo.py"
remove_path "bot/services/gemini.py"

# ── Strip demo cards from the dashboard (frontend/app/page.tsx) ───────────────
echo
echo -e "${BOLD}Stripping demo cards from frontend/app/page.tsx${RESET}"

PAGE="frontend/app/page.tsx"
if [ -f "$PAGE" ]; then
    python3 - "$PAGE" <<'PYEOF'
import sys, re

path = sys.argv[1]
text = open(path).read()

# Remove entire card object blocks that contain `isDemo: true`
# Matches from the opening `{` of a card object to its closing `},` or `}`
# Strategy: find objects whose content contains `isDemo: true` and remove them.

# Split on top-level card objects in the cards array.
# We use a regex that removes any { ... isDemo: true ... } block
# (handles multi-line, non-greedy, within JS object literal braces)
pattern = re.compile(
    r'\{\s*\n(?:[^{}]|\{[^{}]*\})*?\bisDemo:\s*true\b(?:[^{}]|\{[^{}]*\})*?\},?\n',
    re.DOTALL
)

new_text = pattern.sub('', text)

if new_text == text:
    print("  – no isDemo blocks found (already clean)")
else:
    removed = len(pattern.findall(text))
    open(path, 'w').write(new_text)
    print(f"  ✓  removed {removed} isDemo card block(s)")
PYEOF
else
    echo -e "  ${YELLOW}!${RESET}  ${PAGE} not found — skipped"
fi

# ── Remove Gemini router from backend/main.py ─────────────────────────────────
echo
echo -e "${BOLD}Removing Gemini router registration from backend/main.py${RESET}"

MAINPY="backend/main.py"
if [ -f "$MAINPY" ]; then
    python3 - "$MAINPY" <<'PYEOF'
import sys, re

path = sys.argv[1]
text = open(path).read()

# Remove the gemini router import + include block
pattern = re.compile(
    r'\n?try:\n    from app\.api\.gemini import router as gemini_router\n'
    r'    app\.include_router\(gemini_router.*?\n'
    r'except.*?pass\n?',
    re.DOTALL
)
new_text = pattern.sub('', text)

# Also remove simple (non-try) gemini router lines
simple = re.compile(r'\nfrom app\.api\.gemini import router as gemini_router\n'
                    r'app\.include_router\(gemini_router[^\n]*\n')
new_text = simple.sub('', new_text)

if new_text == text:
    print("  – gemini router already removed or not found")
else:
    open(path, 'w').write(new_text)
    print("  ✓  removed gemini router from main.py")
PYEOF
else
    echo -e "  ${YELLOW}!${RESET}  ${MAINPY} not found — skipped"
fi

# ── Remove Gemini SENSITIVE_PREFIXES entry from backend/main.py ───────────────
python3 - "backend/main.py" <<'PYEOF'
import sys
path = sys.argv[1]
try:
    text = open(path).read()
except FileNotFoundError:
    sys.exit(0)

new_text = text.replace('"/api/v1/gemini", ', '').replace(', "/api/v1/gemini"', '').replace('"/api/v1/gemini"', '')
if new_text != text:
    open(path, 'w').write(new_text)
    print("  ✓  removed /api/v1/gemini from SENSITIVE_PREFIXES")
else:
    print("  – /api/v1/gemini not found in SENSITIVE_PREFIXES")
PYEOF

# ── Summary ───────────────────────────────────────────────────────────────────
echo
echo -e "${BOLD}${GREEN}Done!${RESET}"
echo -e "  Removed paths : ${GREEN}${removed}${RESET}"
echo -e "  Already gone  : ${CYAN}${skipped}${RESET}"
echo
echo -e "${BOLD}Next steps:${RESET}"
echo -e "  1.  Rename your bot — update ${CYAN}NEXT_PUBLIC_APP_NAME${RESET} in ${CYAN}.env${RESET}"
echo -e "      (or use the Setup Wizard after first launch)"
echo -e "  2.  Add your bot's cogs under ${CYAN}bot/cogs/${RESET}"
echo -e "  3.  Add your bot's slash-command routes under ${CYAN}backend/app/api/${RESET}"
echo -e "  4.  Read ${CYAN}docs/DEVELOPER_MANUAL.md${RESET} for the full guide"
echo
