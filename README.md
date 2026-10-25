# Guild Guide

Guild Guide extends the supplied Contract Bot source with modular command loading and persistent, per-server knowledge. Existing contract creation, review, completion, payment confirmation, role/member settings, and channels remain in `bot/index.js`.

The Discord branding assets are `guild-guide-icon.png` (1024 × 1024 PNG) and `guild-guide-banner.png` (680 × 240 PNG).

## Requirements

- Node.js 18 or newer
- PostgreSQL
- A Discord application/bot with the `Guilds`, `Guild Messages`, and privileged `Message Content` intents enabled

## Setup

1. Install dependencies with `npm install`.
2. Create a PostgreSQL database.
3. Set `DISCORD_TOKEN`, `DATABASE_URL`, and optionally `PORT` in your process environment or hosting provider settings. `.env.example` documents the variable names; this package does not load `.env` files automatically. Set `PGSSLMODE=require` when your database provider requires TLS.
4. Apply schema migrations with `npm run migrate`. The bot also applies pending migrations during startup.
5. Run the built-in checks with `npm test`.
6. Start Guild Guide with `npm start`.
7. In the Discord Developer Portal, open **Bot → Privileged Gateway Intents** and enable **Message Content Intent**. The bot uses it to read new messages for automatic indexing. It does not need Server Members or Presence intents.
8. Invite the bot with the `bot` and `applications.commands` scopes. Give it **View Channel** in each channel it should index; retain **Send Messages** and **Embed Links** for contract features. For categories, grant the Guild Guide role **View Channel** in the category permissions and sync its child channels; add the role separately to any unsynced/private child channels. **Read Message History** is needed only if you later add importing of older messages. Run `/contractsetup` in your server to configure the existing contract channels and permission targets.

Global Discord command updates can take time to appear. Startup registers the existing `/contract`, `/contractsetup`, and `/createcontractchannels` commands together with modular commands.

## Knowledge command

- `/knowledge search query:<words>` searches entries saved for the current server.
- `/knowledge add title:<title> content:<text>` creates or updates an entry. Requires Manage Server permission.
- `/knowledge remove title:<title>` removes an entry by exact title. Requires Manage Server permission.
- `/knowledge indexing action:Enable indexing` starts saving new messages the bot can read. Requires Manage Server permission.
- `/knowledge indexing action:Disable indexing` stops saving new messages; already saved messages remain searchable.
- `/knowledge indexing action:Check status` checks whether indexing is enabled.
- `/knowledge indexing action:Delete indexed messages` disables indexing and deletes the server's automatically indexed messages.
- `/knowledge search query:<words>` searches both curated entries and indexed messages. Message results are limited to channels the person searching can view.

Curated entries and indexed messages are scoped by Discord server. Search replies are private to the caller. Automatic indexing starts when an administrator enables it and covers new and edited text messages the bot can see; it does not import old history. Deleted Discord messages are removed from the index when Discord sends the deletion event. Message text and author IDs/names are stored in PostgreSQL until purged. This is a searchable message archive, not an AI model; it does not summarize or infer answers.

## Server information

- `/guildconfig view` privately displays saved server information.
- `/guildconfig set-description text:<text>` saves the server description.
- `/guildconfig set-welcome text:<text>` saves welcome information.
- `/guildconfig set-rules-channel channel:<channel>` saves the rules channel.
- `/guildconfig set-info-channel channel:<channel>` saves the information channel.

Both channel pickers accept text, announcement, and forum channels. All changes require Manage Server permission. Category headings are permission containers; select the channels inside them.

## Configuration and storage

Environment parsing is centralized in `config/environment.js`, the shared PostgreSQL pool is in `database/pool.js`, and SQL migrations live in `database/migrations/`. `guild_config` stores server name, description, welcome text, and rules/info channel IDs for upcoming configuration commands. The existing contract settings tables remain managed by the original contract application code.

Add slash commands as modules under `commands/` that export `data` and `execute`. Services and repositories separate command behavior from PostgreSQL queries.

## Hosting notes

Keep the process running as a worker/service. The built-in Express health endpoint listens on `PORT` and responds at `/`. Do not commit real bot tokens or database credentials.
