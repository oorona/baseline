# Getting Started

## First-time setup (run once after cloning)

1. Generate the encryption key
   ```bash
   ./setup_secrets.sh
   ```

2. Start the database container
   ```bash
   docker compose up -d postgres
   ```

3. Create the database user and schema (pick any username)
   ```bash
   ./setup_database.sh --user mybot
   ```

4. Remove demo code and write-protect core files
   ```bash
   chmod +x init.sh && ./init.sh
   ```

5. Start the full stack
   ```bash
   docker compose up
   ```

6. Open the app in your browser — you will be redirected to the Setup Wizard.
   Enter your Discord token, database credentials, and any API keys. They are saved encrypted. The wizard never runs again after this.

---

## Building features

All new code goes into a staging folder, never directly into the live project.

1. Copy the plugin template
   ```bash
   cp -r plugins/_template plugins/<your_feature>
   ```

2. Build your feature inside `plugins/<your_feature>/`
   (cog, API router, frontend page, translations — see `docs/integration/08-plugin-workflow.md`)

3. Validate
   ```bash
   python scripts/plugin_validate.py plugins/<your_feature>
   ```

4. Install
   ```bash
   python scripts/plugin_install.py plugins/<your_feature>
   ```

5. If the plugin added database tables, run migrations
   ```bash
   docker compose exec backend alembic upgrade head
   ```

6. Restart the bot and frontend to pick up the changes
   ```bash
   docker compose restart bot frontend
   ```

---

## Reference

- `CLAUDE.md` — rules every developer and AI assistant must follow
- `docs/DEVELOPER_MANUAL.md` — full architecture and extension guide
- `docs/integration/08-plugin-workflow.md` — detailed plugin workflow
