const { Client, GatewayIntentBits, Events, Partials, PermissionFlagsBits } = require("discord.js");
const express = require("express");
const { readEnvironment } = require("../config/environment");
const pool = require("../database/pool");
const { runMigrations } = require("../database/migrate");
const { loadCommands } = require("../commands/loader");
const knowledgeService = require("../services/knowledgeService");
const guildService = require("../services/guildService");

const config = readEnvironment();
const commands = loadCommands();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel, Partials.Message]
});
client.services = { knowledge: knowledgeService, guild: guildService };

const app = express();
app.get("/", (_request, response) => response.status(200).send("Guild Guide is running."));
const healthServer = app.listen(config.port, "0.0.0.0", () => console.log(`Health server listening on port ${config.port}`));

client.once(Events.ClientReady, async readyClient => {
  console.log(`Guild Guide is online as ${readyClient.user.tag}`);
  try {
    await readyClient.application.commands.set([...commands.values()].map(command => command.data));
    console.log(`Registered ${commands.size} Guild Guide commands`);
  } catch (error) {
    console.error("Failed to register Guild Guide commands:", error);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isStringSelectMenu() && interaction.customId === "guildguide_help_section") {
      const help = commands.get("help");
      if (help?.handleComponent) return await help.handleComponent(interaction);
    }
    if (!interaction.isChatInputCommand()) return;
    const command = commands.get(interaction.commandName);
    if (!command) return interaction.reply({ content: "That command is not available. Try `/help`.", ephemeral: true });
    await command.execute(interaction);
  } catch (error) {
    console.error("Interaction failed:", error);
    const response = { content: "Guild Guide couldn't complete that request. Please try again.", ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(response).catch(() => {});
    else await interaction.reply(response).catch(() => {});
  }
});

async function saveGuildMessage(message) {
  try {
    if (message.partial) message = await message.fetch();
    if (!message.guildId || message.author?.bot || !message.content?.trim()) return;
    const botMember = message.guild?.members?.me;
    if (botMember && !message.channel.permissionsFor(botMember)?.has(PermissionFlagsBits.ViewChannel)) return;
    await knowledgeService.captureMessage({
      id: message.id,
      guildId: message.guildId,
      channelId: message.channelId,
      authorId: message.author.id,
      authorName: message.member?.displayName || message.author.username,
      content: message.content,
      createdAt: new Date(message.createdTimestamp)
    });
  } catch (error) {
    console.error("Failed to index a Discord message:", error);
  }
}

client.on(Events.MessageCreate, saveGuildMessage);
client.on(Events.MessageUpdate, (_oldMessage, newMessage) => saveGuildMessage(newMessage));
client.on(Events.MessageDelete, async message => {
  try { await knowledgeService.removeIndexedMessage(message.id); }
  catch (error) { console.error("Failed to remove a deleted message from the index:", error); }
});

async function shutdown(signal) {
  console.log(`Received ${signal}; shutting down Guild Guide.`);
  healthServer.close();
  client.destroy();
  await pool.end().catch(error => console.error("PostgreSQL shutdown failed:", error));
  process.exit(0);
}
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

async function start() {
  try {
    await runMigrations(pool);
    console.log("Guild Guide database ready");
    await client.login(config.discordToken);
  } catch (error) {
    console.error("Guild Guide failed to start:", error);
    process.exitCode = 1;
    healthServer.close();
    await pool.end().catch(() => {});
  }
}

start();
