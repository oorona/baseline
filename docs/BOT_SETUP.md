# Bot Setup & Permissions Guide

This guide describes the permissions required for the **Logging Bot** functionality and how to re-add the bot to your server with the correct access rights.

## Required Permissions

To ensure the Logging Bot can track events (Message Edits, Deletions, Member Joins/Leaves) and post logs, it requires the following permissions:

### General Permissions
- **View Channels**: To see channels and activities.
- **View Audit Log**: (Optional) Helpful for more detailed logs, though basic events work without it.

### Text Permissions
- **Send Messages**: To post log entries.
- **Embed Links**: The bot uses Embeds for log messages.
- **Read Message History**: Required to see previous states of messages for "Message Edit" logging.

### Privileged Gateway Intents
The bot requires the following **Privileged Intents** enabled in the [Discord Developer Portal](https://discord.com/developers/applications):
1. **Presence Intent**: (Optional for this feature, but good for status)
2. **Server Members Intent**: REQUIRED to track `on_member_join` and `on_member_remove`.
3. **Message Content Intent**: REQUIRED to read message content for `on_message_edit` and `on_message_delete` logs.

## Re-adding the Bot

If your bot is already on the server but missing permissions, you should kick it and re-invite it using a new invite link.

### 1. Generate Invite Link
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Select your Application.
3. Go to **OAuth2** -> **URL Generator**.
4. Select Scopes: `bot`, `applications.commands`.
5. Select Bot Permissions:
   - General: `View Channels`, `View Audit Log`
   - Text: `Send Messages`, `Embed Links`, `Read Message History`
   - Membership: `Kick Members` (if you plan to add moderation later), otherwise irrelevant for logging.
6. Copy the generated URL.

### 2. Invite to Server
1. Paste the URL into your browser.
2. Select your server.
3. Click "Authorize".

## Configuring Logging

Once the bot is in your server:
1. Go to the **Web Dashboard**.
2. Navigate to **Settings**.
3. Enable Logging.
4. Select the **Log Channel** where you want events to appear.
5. (Optional) Toggle specific events you want to ignore.

## Troubleshooting

- **Logs not appearing?**
  - Ensure the bot has `Send Messages` permission in the specific Log Channel.
  - Check if the event type is enabled in Settings.
  - Verify that `Message Content Intent` is enabled in the Developer Portal.
