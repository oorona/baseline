# Plugin & Extension Architecture

> [!IMPORTANT]
> **For AI Assistants & Developers**: This document defines the strict boundary between the **Core Framework** and **User/Plugin Code**. When adding new features, you MUST verify if you are extending the core or adding a plugin.

## Core vs. Plugin Distinction

| Component | Description | Location | Mutable by Users? |
| :--- | :--- | :--- | :--- |
| **Core Framework** | The underlying platform (Authentication, Database, API, Layouts, Routing). | `backend/app/*`<br>`frontend/app/*` (excluding specific folders)<br>`bot/main.py` | **NO** (Unless fixing a framework bug) |
| **Plugin / Feature** | Specific bot functionality (Logging, Moderation, Music, etc.). | `bot/cogs/*`<br>`frontend/app/dashboard/developer/[feature]/*` | **YES** (This is where new code lives) |

## Reference Implementation (The "Sample Bot")

The project includes a fully functional "Logging Bot" plugin. This code is **NOT** part of the Core Framework but is included as a template for future plugins.

**Reference Files (Do NOT delete, but do NOT treat as Core):**
1.  **Backend Logic**: [`bot/cogs/logging.py`](../../bot/cogs/logging.py)
    *   Demonstrates how to listen to events (`on_message_delete`).
    *   Demonstrates how to fetch settings from the backend.
2.  **Frontend UI**: [`frontend/app/dashboard/developer/logging/page.tsx`](../../frontend/app/dashboard/developer/logging/page.tsx)
    *   Demonstrates how to build a unified settings UI.
    *   use `apiClient` to fetch/save guild-specific settings.

## How to Add New Functionality (Workflow for LLMs)

If the user asks to "Add a Moderation Bot" or "Add Music Feature":

1.  **Create the Cog**:
    *   Create `bot/cogs/moderation.py`.
    *   Inherit from `commands.Cog`.
    *   Implement listeners/commands.
    *   **Rule**: Do NOT modify `bot/main.py` to register it; the framework auto-loads cogs from the directory.

2.  **Create the UI**:
    *   Create `frontend/app/dashboard/developer/moderation/page.tsx`.
    *   Use the [Plugin Style Guide](PLUGIN_STYLE_GUIDE.md) for UI consistency.
    *   **Rule**: Do NOT modify `frontend/app/layout.tsx`; the Sidebar automatically picks up new routes if they are registered via the plugin registry (or if manual addition is requested, add only to the navigation configuration).

    *   Store plugin-specific config keys (e.g., `moderation_enabled`, `filtered_words`) inside the JSON blob.

4.  **Custom Pages (Beyond Settings)**:
    *   You can create arbitrary pages in `frontend/app/dashboard/developer/[feature]/`.
    *   Example: `frontend/app/dashboard/developer/moderation/analytics/page.tsx`.
    *   These will represent full Next.js pages.
    *   Use `apiClient` to fetch data from your custom backend endpoints.

5.  **LLM Integration**:
    *   See [LLM Usage Guide](../docs/LLM_USAGE_GUIDE.md) for detailed instructions on using the Shared LLM Service.
    *   Use the `apiClient.llm` namespace for frontend calls.
    *   Use `bot.llm_service` for bot command calls.

## Non-Core Files List
The following paths are considered **User Space**. Code here should be preserved during framework updates:
- `bot/cogs/*.py`
- `frontend/app/dashboard/developer/*`
- `env` files
