#!/usr/bin/env python3
"""
plugin_validate.py — Validates a staged plugin against all Baseline framework contracts.

Usage:
    python scripts/plugin_validate.py plugins/<plugin_name>
    python scripts/plugin_validate.py plugins/<plugin_name> --strict

Exit codes:
    0 — validation passed (ready to install)
    1 — one or more ERRORs (must fix before install)
"""

import ast
import json
import re
import sys
from pathlib import Path

ERRORS: list[str] = []
WARNINGS: list[str] = []
STRICT = "--strict" in sys.argv


def err(msg: str):
    ERRORS.append(f"  [ERROR] {msg}")


def warn(msg: str):
    if STRICT:
        ERRORS.append(f"  [ERROR] {msg}  (--strict)")
    else:
        WARNINGS.append(f"  [WARN]  {msg}")


def ok(msg: str):
    print(f"  [OK]    {msg}")


# ── Manifest ─────────────────────────────────────────────────────────────────

def validate_manifest(plugin_dir: Path) -> dict:
    manifest_path = plugin_dir / "plugin.json"
    if not manifest_path.exists():
        err("plugin.json not found — every plugin must have a manifest")
        return {}

    try:
        manifest = json.loads(manifest_path.read_text())
    except json.JSONDecodeError as e:
        err(f"plugin.json is not valid JSON: {e}")
        return {}

    for field in ("name", "version", "description", "components"):
        if field not in manifest:
            err(f"plugin.json missing required field: '{field}'")

    if "display_name" not in manifest:
        warn("plugin.json missing 'display_name' — used in UI and docs")

    name = manifest.get("name", "")
    if name and not re.match(r"^[a-z][a-z0-9_]*$", name):
        err(f"plugin name '{name}' must be snake_case lowercase (e.g. my_plugin)")

    # Folder name must match the declared name
    if name and plugin_dir.name != name:
        err(
            f"Plugin folder name '{plugin_dir.name}' does not match "
            f"plugin.json 'name' field '{name}' — they must be identical"
        )
    elif name:
        ok(f"Folder name matches plugin name: '{name}'")

    # Version must be semver (MAJOR.MINOR.PATCH)
    version = manifest.get("version", "")
    if version and not re.match(r"^\d+\.\d+\.\d+$", version):
        err(
            f"version '{version}' is not valid semver — use MAJOR.MINOR.PATCH format (e.g. 1.0.0)"
        )
    elif version:
        ok(f"Version: {version}")

    perm = manifest.get("permission_level")
    if perm is not None and perm not in range(6):
        err(f"permission_level must be 0–5, got {perm}")
    elif perm is None:
        warn("permission_level not set — defaults to 3 (AUTHORIZED) at install time")

    # Navigation section consistency
    nav = manifest.get("navigation", {})
    if nav.get("enabled"):
        if not manifest.get("components", {}).get("frontend"):
            err("navigation.enabled is true but 'frontend' component is not declared")
        if not nav.get("icon"):
            warn("navigation.icon not set — installer will default to 'Settings'")
        if manifest.get("permission_level") is None:
            warn("navigation.enabled requires permission_level to be set for the dashboard card")

    # Router section consistency
    if manifest.get("components", {}).get("api") and "router" not in manifest:
        warn("'api' component declared but no 'router' section in plugin.json — installer defaults to prefix='/guilds'")

    valid_components = {"cog", "api", "models", "migration", "frontend", "translations"}
    for key in manifest.get("components", {}):
        if key not in valid_components:
            warn(f"Unknown component key '{key}' in plugin.json — valid: {valid_components}")

    ok("plugin.json is valid")
    return manifest


# ── Cog ──────────────────────────────────────────────────────────────────────

def validate_cog(cog_path: Path):
    print("\n[cog.py]")
    src = cog_path.read_text()

    try:
        tree = ast.parse(src)
    except SyntaxError as e:
        err(f"Syntax error in cog.py: {e}")
        return

    # Must inherit from commands.Cog
    cog_classes = [
        node for node in ast.walk(tree)
        if isinstance(node, ast.ClassDef)
        and any(
            (isinstance(b, ast.Attribute) and b.attr == "Cog")
            or (isinstance(b, ast.Name) and b.id == "Cog")
            for b in node.bases
        )
    ]
    if not cog_classes:
        err("No class inheriting from commands.Cog found")
    else:
        ok(f"Cog class(es): {', '.join(c.name for c in cog_classes)}")

    # Every @app_commands.command() must have description=
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for dec in node.decorator_list:
                if _is_app_command(dec):
                    if not _decorator_has_kwarg(dec, "description"):
                        err(
                            f"@app_commands.command '{node.name}' (line {node.lineno}) "
                            f"is missing description= argument"
                        )
                    else:
                        ok(f"@app_commands.command '{node.name}' has description=")

    # Forbidden: direct LLM/HTTP client instantiation
    forbidden = [
        (r"openai\.OpenAI\s*\(", "Direct openai.OpenAI() — use bot.services.llm"),
        (r"anthropic\.Anthropic\s*\(", "Direct anthropic.Anthropic() — use bot.services.llm"),
        (r"genai\.configure\s*\(", "Direct google.generativeai — use bot.services.llm"),
        (r"aiohttp\.ClientSession\s*\(", "Direct aiohttp.ClientSession() — use bot.session"),
    ]
    for pattern, msg in forbidden:
        if re.search(pattern, src):
            err(msg)

    # LLM access pattern
    if re.search(r"\bbot\.llm_service\b|\bbot\.llm\b", src):
        err("LLM accessed as 'bot.llm_service' or 'bot.llm' — must be 'bot.services.llm'")
    if re.search(r"bot\.services\.llm", src):
        ok("LLM accessed via bot.services.llm")

    # SETTINGS_SCHEMA required if cog reads settings
    reads_settings = bool(re.search(r"guild_settings|get_settings|settings\.get\b", src))
    if reads_settings and "SETTINGS_SCHEMA" not in src:
        warn(
            "Cog appears to read guild settings but has no SETTINGS_SCHEMA — "
            "the dashboard Settings page won't render a form for it"
        )
    elif "SETTINGS_SCHEMA" in src:
        ok("SETTINGS_SCHEMA declared")

    # setup() entrypoint
    if "async def setup(" not in src:
        warn("No async def setup(bot) found — discord.py requires this to load the cog")
    else:
        ok("setup() entrypoint present")


def _is_app_command(decorator) -> bool:
    if isinstance(decorator, ast.Call):
        func = decorator.func
        if isinstance(func, ast.Attribute) and func.attr == "command":
            val = func.value
            if isinstance(val, ast.Attribute) and val.attr == "app_commands":
                return True
            if isinstance(val, ast.Name) and val.id == "app_commands":
                return True
    return False


def _decorator_has_kwarg(decorator, kwarg: str) -> bool:
    if isinstance(decorator, ast.Call):
        return any(kw.arg == kwarg for kw in decorator.keywords)
    return False


# ── API Router ────────────────────────────────────────────────────────────────

def validate_api(api_path: Path):
    print("\n[api.py]")
    src = api_path.read_text()

    try:
        tree = ast.parse(src)
    except SyntaxError as e:
        err(f"Syntax error in api.py: {e}")
        return

    # router = APIRouter() must exist
    if not re.search(r"\brouter\s*=\s*APIRouter\s*\(", src):
        err("No 'router = APIRouter()' found")
    else:
        ok("APIRouter instance defined")

    # Guild-scoped routes must use get_guild_db
    guild_route_re = re.compile(
        r'@router\.(get|post|put|patch|delete)\s*\(\s*["\'][^"\']*\{guild_id\}'
    )
    guild_routes = guild_route_re.findall(src)
    if guild_routes:
        if "get_guild_db" not in src:
            err(
                f"Found {len(guild_routes)} guild-scoped route(s) containing {{guild_id}} "
                f"but 'get_guild_db' is not used — this bypasses Row-Level Security"
            )
        else:
            if "from app.db.guild_session import" not in src:
                warn("get_guild_db appears to be used but not imported from app.db.guild_session")
            ok(f"{len(guild_routes)} guild-scoped route(s) use get_guild_db")
    else:
        ok("No guild-scoped routes detected")

    # Mutation endpoints must write AuditLog
    mutation_fns = _find_mutation_functions(tree)
    for fn_name, start_line in mutation_fns:
        fn_src = _function_source(src, start_line)
        if fn_src and "AuditLog" not in fn_src:
            err(
                f"Mutation endpoint '{fn_name}' (line {start_line}) has no AuditLog entry — "
                f"required by framework contract (CLAUDE.md rule 5)"
            )
        elif fn_src:
            ok(f"Mutation endpoint '{fn_name}' writes AuditLog")

    if not mutation_fns:
        ok("No mutation endpoints detected")


def _find_mutation_functions(tree) -> list[tuple[str, int]]:
    results = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for dec in node.decorator_list:
                if (
                    isinstance(dec, ast.Call)
                    and isinstance(dec.func, ast.Attribute)
                    and dec.func.attr in ("post", "put", "patch", "delete")
                    and isinstance(dec.func.value, ast.Name)
                    and dec.func.value.id == "router"
                ):
                    results.append((node.name, node.lineno))
    return results


def _function_source(src: str, start_line: int, lookahead: int = 60) -> str:
    lines = src.splitlines()
    return "\n".join(lines[start_line - 1 : start_line + lookahead])


# ── Frontend Page ─────────────────────────────────────────────────────────────

def validate_frontend(page_path: Path):
    print("\n[page.tsx]")
    src = page_path.read_text()

    # withPermission export
    if "withPermission" not in src:
        err(
            "Page is not wrapped with withPermission() — "
            "every dashboard page requires it (CLAUDE.md rule 3)"
        )
    else:
        ok("withPermission export present")

    # Check it's actually the default export
    if not re.search(r"export default withPermission\s*\(", src):
        warn(
            "withPermission found but may not be the default export — "
            "ensure: export default withPermission(PageComponent, PermissionLevel.X)"
        )

    # useTranslation hook
    if "useTranslation" not in src:
        err("No useTranslation() — all user-visible strings must use the i18n hook")
    else:
        ok("useTranslation() used")

    # Hardcoded hex in className/style attributes
    if re.search(r'(?:className|style)=["\'][^"\']*#[0-9a-fA-F]{3,8}', src):
        err("Hardcoded hex color in className/style — use Tailwind semantic tokens")
    elif re.search(r"#[0-9a-fA-F]{6}\b", src):
        warn("Hex color literal found (may be in a comment/string — verify it's not in JSX)")

    # Arbitrary Tailwind color values
    if re.search(r"(?:bg|text|border|ring|fill|stroke)-\[#[0-9a-fA-F]", src):
        err("Arbitrary Tailwind color values (e.g. bg-[#abc]) are forbidden — use semantic tokens")

    # rgb/rgba
    if re.search(r"\brgb[a]?\s*\(", src):
        err("Hardcoded rgb()/rgba() colors found — use Tailwind semantic tokens")

    if not ERRORS:
        ok("No hardcoded colors detected")

    # Bare 'use client' safety check
    if "'use client'" not in src and '"use client"' not in src:
        warn("No 'use client' directive — dashboard pages are almost always client components")


# ── Translations ──────────────────────────────────────────────────────────────

def validate_translations(translations_dir: Path, plugin_name: str):
    print("\n[translations/]")
    en_path = translations_dir / "en.ts"
    es_path = translations_dir / "es.ts"

    if not en_path.exists():
        err("translations/en.ts missing")
        return
    if not es_path.exists():
        err("translations/es.ts missing — must mirror en.ts exactly")
        return

    namespace = _to_camel_case(plugin_name)
    en_src = en_path.read_text()
    es_src = es_path.read_text()

    # Namespace key present in both
    if f"{namespace}:" not in en_src:
        warn(f"Plugin namespace '{namespace}:' not found in en.ts")
    else:
        ok(f"Namespace '{namespace}' in en.ts")

    if f"{namespace}:" not in es_src:
        warn(f"Plugin namespace '{namespace}:' not found in es.ts")
    else:
        ok(f"Namespace '{namespace}' in es.ts")

    # Compare leaf keys between the two files (simple heuristic)
    en_keys = set(re.findall(r"^\s{2,}(\w+)\s*:", en_src, re.MULTILINE))
    es_keys = set(re.findall(r"^\s{2,}(\w+)\s*:", es_src, re.MULTILINE))

    only_en = en_keys - es_keys
    only_es = es_keys - en_keys
    if only_en:
        warn(f"Keys in en.ts not found in es.ts: {sorted(only_en)}")
    if only_es:
        warn(f"Keys in es.ts not found in en.ts: {sorted(only_es)}")
    if not only_en and not only_es:
        ok("en.ts and es.ts keys match")

    # Check for hardcoded HTML or JSX leaking into translation values
    if re.search(r"<[a-zA-Z]", en_src):
        warn("HTML/JSX tags detected in en.ts translation values — use plain strings")


def _to_camel_case(snake: str) -> str:
    parts = snake.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


# ── Undeclared file detection ─────────────────────────────────────────────────

def check_undeclared_files(plugin_dir: Path, components: dict):
    file_map = {
        "cog.py": "cog",
        "api.py": "api",
        "models.py": "models",
        "migration.py": "migration",
        "page.tsx": "frontend",
    }
    for filename, component_key in file_map.items():
        path = plugin_dir / filename
        if path.exists() and not components.get(component_key, False):
            warn(
                f"{filename} exists but '{component_key}' not declared in plugin.json components — "
                f"add it to components or remove the file"
            )
    trans_dir = plugin_dir / "translations"
    if trans_dir.is_dir() and not components.get("translations", False):
        warn("translations/ directory exists but 'translations' not declared in plugin.json")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        print("Usage: python scripts/plugin_validate.py plugins/<plugin_name> [--strict]")
        sys.exit(1)

    plugin_dir = Path(args[0])
    if not plugin_dir.is_dir():
        print(f"ERROR: '{plugin_dir}' is not a directory")
        sys.exit(1)

    mode = " [STRICT]" if STRICT else ""
    print(f"Validating plugin: {plugin_dir.name}{mode}\n{'=' * 50}")

    print("\n[plugin.json]")
    manifest = validate_manifest(plugin_dir)
    components = manifest.get("components", {})
    plugin_name = manifest.get("name", plugin_dir.name)

    if components.get("cog"):
        p = plugin_dir / "cog.py"
        if p.exists():
            validate_cog(p)
        else:
            err("cog.py declared in components but file not found")

    if components.get("api"):
        p = plugin_dir / "api.py"
        if p.exists():
            validate_api(p)
        else:
            err("api.py declared in components but file not found")

    if components.get("models"):
        p = plugin_dir / "models.py"
        if not p.exists():
            err("models.py declared in components but file not found")
        else:
            ok("models.py present")

    if components.get("migration"):
        p = plugin_dir / "migration.py"
        if not p.exists():
            err("migration.py declared in components but file not found")
        else:
            ok("migration.py present")

    if components.get("frontend"):
        p = plugin_dir / "page.tsx"
        if p.exists():
            validate_frontend(p)
        else:
            err("page.tsx declared in components but file not found")

    if components.get("translations"):
        p = plugin_dir / "translations"
        if p.is_dir():
            validate_translations(p, plugin_name)
        else:
            err("translations/ declared in components but directory not found")

    check_undeclared_files(plugin_dir, components)

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{'=' * 50}")
    print(f"Results: {len(ERRORS)} error(s), {len(WARNINGS)} warning(s)\n")

    if WARNINGS:
        print("WARNINGS (install will proceed):")
        for w in WARNINGS:
            print(w)

    if ERRORS:
        print("\nERRORS (must fix before install):")
        for e in ERRORS:
            print(e)
        print("\nValidation FAILED")
        sys.exit(1)
    else:
        if WARNINGS:
            print()
        print("Validation PASSED — plugin is ready to install")
        sys.exit(0)


if __name__ == "__main__":
    main()
