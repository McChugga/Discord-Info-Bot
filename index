require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");
const { Pool } = require("pg");

const token = process.env.DISCORD_TOKEN;
const databaseUrl = process.env.DATABASE_URL;

if (!token) throw new Error("DISCORD_TOKEN is missing.");
if (!databaseUrl) throw new Error("DATABASE_URL is missing.");

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false }
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

async function db(query, params = []) {
  return pool.query(query, params);
}

async function initDatabase() {
  await db(`
    CREATE TABLE IF NOT EXISTS info_channels (
      guild_id TEXT PRIMARY KEY,
      channel_ids TEXT[] NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS knowledge (
      guild_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      author_id TEXT,
      content TEXT NOT NULL,
      message_url TEXT,
      created_at TIMESTAMPTZ,
      PRIMARY KEY (guild_id, message_id)
    );

    CREATE INDEX IF NOT EXISTS knowledge_guild_idx
      ON knowledge (guild_id);

    CREATE INDEX IF NOT EXISTS knowledge_channel_idx
      ON knowledge (guild_id, channel_id);
  `);
  console.log("Discord Info Bot database ready");
}

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild);
}

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/<a?:\w+:\d+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function terms(text) {
  return [...new Set(normalize(text).split(" ").filter(w => w.length >= 2))];
}

function scoreResult(query, content) {
  const q = terms(query);
  const c = terms(content);
  if (!q.length || !c.length) return 0;

  const set = new Set(c);
  let score = 0;

  for (const word of q) {
    if (set.has(word)) score += 3;
    else if (c.some(x => x.includes(word) || word.includes(x))) score += 1;
  }

  const phrase = normalize(query);
  if (phrase && normalize(content).includes(phrase)) score += 8;

  return score;
}

async function getConfiguredChannels(guildId) {
  const result = await db(
    "SELECT channel_ids FROM info_channels WHERE guild_id = $1",
    [guildId]
  );
  return result.rows[0]?.channel_ids || [];
}

async function saveConfiguredChannels(guildId, channelIds) {
  await db(`
    INSERT INTO info_channels (guild_id, channel_ids, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (guild_id)
    DO UPDATE SET channel_ids = EXCLUDED.channel_ids, updated_at = NOW()
  `, [guildId, channelIds]);
}

async function indexChannel(guild, channelId) {
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return 0;

  let before;
  let count = 0;

  while (true) {
    const options = { limit: 100 };
    if (before) options.before = before;

    const batch = await channel.messages.fetch(options).catch(() => null);
    if (!batch || batch.size === 0) break;

    const rows = [];
    for (const message of batch.values()) {
      if (message.author?.bot) continue;
      const content = (message.content || "").trim();
      if (!content) continue;

      rows.push([
        guild.id,
        message.id,
        channel.id,
        message.author?.id || null,
        content,
        message.url,
        message.createdAt
      ]);
    }

    for (const row of rows) {
      await db(`
        INSERT INTO knowledge
          (guild_id, message_id, channel_id, author_id, content, message_url, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (guild_id, message_id)
        DO UPDATE SET content = EXCLUDED.content,
                      channel_id = EXCLUDED.channel_id,
                      message_url = EXCLUDED.message_url
      `, row);
    }

    count += rows.length;
    before = batch.last()?.id;

    if (batch.size < 100) break;
  }

  return count;
}

async function refreshGuild(guild) {
  const channelIds = await getConfiguredChannels(guild.id);
  if (!channelIds.length) return { count: 0, channels: 0 };

  await db(
    "DELETE FROM knowledge WHERE guild_id = $1 AND channel_id <> ALL($2::text[])",
    [guild.id, channelIds]
  );

  let count = 0;
  let channels = 0;

  for (const channelId of channelIds) {
    const added = await indexChannel(guild, channelId);
    count += added;
    channels++;
  }

  return { count, channels };
}

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("setup")
      .setDescription("Choose which channels the bot should use as its server memory."),
    new SlashCommandBuilder()
      .setName("ask")
      .setDescription("Ask the bot a question using this server's information.")
      .addStringOption(option =>
        option
          .setName("question")
          .setDescription("What do you want to know?")
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("refresh")
      .setDescription("Refresh the bot's memory from the configured information channels.")
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
  console.log("Discord Info Bot global commands registered");
}

client.once("ready", async () => {
  console.log(`Discord Info Bot is online as ${client.user.tag}`);
  await registerCommands();

  const port = process.env.PORT || 10000;
  const http = require("http");
  http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Discord Info Bot is online.");
  }).listen(port, "0.0.0.0", () => {
    console.log(`Web server running on port ${port}`);
  });
});

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "setup") {
        if (!isAdmin(interaction)) {
          return interaction.reply({
            content: "❌ You need **Manage Server** permission to configure Discord Info Bot.",
            ephemeral: true
          });
        }

        const configured = await getConfiguredChannels(interaction.guild.id);

        const menu = new ChannelSelectMenuBuilder()
          .setCustomId("info_channels")
          .setPlaceholder("Select information channels")
          .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setMinValues(1)
          .setMaxValues(25);

        if (configured.length) {
          menu.setDefaultChannels(configured.slice(0, 25));
        }

        const row = new ActionRowBuilder().addComponents(menu);
        const refresh = new ButtonBuilder()
          .setCustomId("refresh_now")
          .setLabel("Refresh Memory")
          .setStyle(ButtonStyle.Primary);

        const row2 = new ActionRowBuilder().addComponents(refresh);

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("📚 Discord Info Bot Setup")
              .setDescription(
                "Select the channels that contain your server's official information.\n\n" +
                "**Recommended channels:**\n" +
                "• Server Information\n" +
                "• Server Rules\n" +
                "• FAQ\n" +
                "• Server Guides\n" +
                "• Farming Simulator Information\n\n" +
                "The bot will only use the selected channels for answers. " +
                "Each Discord server has its own separate memory."
              )
              .setFooter({ text: "Use /refresh after updating information." })
          ],
          components: [row, row2],
          ephemeral: true
        });
      }

      if (interaction.commandName === "refresh") {
        if (!isAdmin(interaction)) {
          return interaction.reply({
            content: "❌ You need **Manage Server** permission to refresh the bot's memory.",
            ephemeral: true
          });
        }

        await interaction.deferReply({ ephemeral: true });
        const result = await refreshGuild(interaction.guild);
        return interaction.editReply(
          `✅ Memory refreshed.\n**Channels:** ${result.channels}\n**Messages indexed:** ${result.count}`
        );
      }

      if (interaction.commandName === "ask") {
        const question = interaction.options.getString("question", true);
        const channelIds = await getConfiguredChannels(interaction.guild.id);

        if (!channelIds.length) {
          return interaction.reply({
            content: "⚠️ This server has not configured any information channels yet. An admin can use **/setup**.",
            ephemeral: true
          });
        }

        await interaction.deferReply();

        const result = await db(
          "SELECT channel_id, content, message_url FROM knowledge WHERE guild_id = $1",
          [interaction.guild.id]
        );

        const ranked = result.rows
          .map(row => ({ ...row, score: scoreResult(question, row.content) }))
          .filter(row => row.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        if (!ranked.length) {
          return interaction.editReply(
            "❓ I couldn't find that information in this server's configured information channels.\n\n" +
            "Try different wording, or ask a staff member."
          );
        }

        const best = ranked[0];
        const channel = interaction.guild.channels.cache.get(best.channel_id);
        const source = channel ? `#${channel.name}` : "server information channel";

        let answer = best.content;
        if (answer.length > 1500) answer = answer.slice(0, 1497) + "...";

        const embed = new EmbedBuilder()
          .setTitle("📚 Server Information")
          .setDescription(answer)
          .addFields({
            name: "Source",
            value: best.message_url ? `[${source}](${best.message_url})` : source
          })
          .setFooter({ text: "Answer retrieved from this server's configured information." });

        if (ranked.length > 1) {
          embed.addFields({
            name: "Related Information",
            value: ranked.slice(1).map(r => {
              const ch = interaction.guild.channels.cache.get(r.channel_id);
              return `• ${ch ? `#${ch.name}` : "Information"} — ${r.content.slice(0, 180)}`;
            }).join("\n").slice(0, 900)
          });
        }

        return interaction.editReply({ embeds: [embed] });
      }
    }

    if (interaction.isChannelSelectMenu() && interaction.customId === "info_channels") {
      if (!isAdmin(interaction)) {
        return interaction.reply({
          content: "❌ You need **Manage Server** permission.",
          ephemeral: true
        });
      }

      const selected = interaction.values;
      await saveConfiguredChannels(interaction.guild.id, selected);

      await interaction.deferUpdate();

      const result = await refreshGuild(interaction.guild);

      return interaction.followUp({
        content:
          `✅ Information channels saved.\n` +
          `**Channels:** ${selected.length}\n` +
          `**Messages indexed:** ${result.count}\n\n` +
          `The bot will now use these channels as this server's information memory.`,
        ephemeral: true
      });
    }

    if (interaction.isButton() && interaction.customId === "refresh_now") {
      if (!isAdmin(interaction)) {
        return interaction.reply({
          content: "❌ You need **Manage Server** permission.",
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });
      const result = await refreshGuild(interaction.guild);

      return interaction.editReply(
        `✅ Memory refreshed.\n**Channels:** ${result.channels}\n**Messages indexed:** ${result.count}`
      );
    }
  } catch (error) {
    console.error("Interaction error:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Something went wrong. Check the Render logs for details.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

process.on("unhandledRejection", error => console.error("Unhandled rejection:", error));

(async () => {
  await initDatabase();
  await client.login(token);
})();
