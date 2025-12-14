# Discord Application & Bot Setup

This guide explains how to create a Discord Application, set up a Bot User, and obtain the necessary credentials (`DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_SECRET`) required for this project.

## 1. Create the Application

1.  Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2.  Log in with your Discord account.
3.  Click the **"New Application"** button (top right).
4.  Enter a name for your bot (e.g., "My Awesome Bot") and agree to the terms.
5.  Click **"Create"**.

## 2. Get Client Secret (Application ID & Secret)

1.  You will be redirected to the **"General Information"** page.
2.  Copy the **"Application ID"**. This is your `DISCORD_CLIENT_ID` (if needed later).
3.  Locate the **"Client Secret"** field.
4.  Click **"Reset Secret"** if hidden, then click "Yes, do it!".
5.  **Copy the Client Secret**.
    *   Save this as `DISCORD_CLIENT_SECRET` in your `secrets/discord_client_secret.txt` file.

## 3. Create the Bot User

1.  In the left sidebar, click **"Bot"**.
2.  Click the **"Reset Token"** button to generate your bot's token.
3.  **Copy the Token**.
    *   Save this as `DISCORD_BOT_TOKEN` in your `secrets/discord_bot_token.txt` file.
    *   *Warning: You can only see this token once! If you lose it, you must reset it again.*

## 4. IPrivileged Gateway Intents (CRITICAL)

This framework requires specific "Intents" to function correctly (logging, reading messages, seeing members).

1.  Scroll down on the **"Bot"** page to the **"Privileged Gateway Intents"** section.
2.  Enable the following toggles:
    *   ✅ **Presence Intent**
    *   ✅ **Server Members Intent**
    *   ✅ **Message Content Intent**
3.  Click **"Save Changes"** at the bottom.

## 5. Invite the Bot to Your Server

To verify the bot is working, you need to invite it to a server where you have "Manage Server" permissions.

1.  In the left sidebar, click **"OAuth2"** -> **"URL Generator"**.
2.  **Scopes**: Check the following boxes:
    *   `bot`
    *   `applications.commands` (Critical for slash commands)
3.  **Bot Permissions**: Check the permissions your bot needs. For the Baseline framework, recommended minimums are:
    *   **General**: `View Channels`
    *   **Text**: `Send Messages`, `Embed Links`, `Read Message History`, `Attach Files`
    *   **Moderation**: `Kick Members`, `Ban Members`, `Manage Messages` (Only if you plan to use these features)
4.  **Copy the Generated URL** at the bottom.
5.  Open the URL in a new browser tab, select your server, and click **"Authorize"**.

---

**Next Steps:**
Return to the [Bootstrap Guide](BOOTSTRAP_GUIDE.md) or [Secrets Setup](../specs/SECRETS_SETUP.md) to save your credentials.
