const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const data = new SlashCommandBuilder()
  .setName("knowledge")
  .setDescription("Search or manage this server's saved knowledge.")
  .addSubcommand(sub => sub.setName("search").setDescription("Search saved server information.")
    .addStringOption(option => option.setName("query").setDescription("Words to search for").setRequired(true).setMaxLength(100)))
  .addSubcommand(sub => sub.setName("add").setDescription("Add or update a knowledge entry (server managers only).")
    .addStringOption(option => option.setName("title").setDescription("Short entry title").setRequired(true).setMaxLength(120))
    .addStringOption(option => option.setName("content").setDescription("Information members should know").setRequired(true).setMaxLength(4000)))
  .addSubcommand(sub => sub.setName("remove").setDescription("Remove an entry by its exact title (server managers only).")
    .addStringOption(option => option.setName("title").setDescription("Exact entry title").setRequired(true).setMaxLength(120)))
  .addSubcommand(sub => sub.setName("indexing").setDescription("Control automatic saving of channel messages (server managers only).")
    .addStringOption(option => option.setName("action").setDescription("Choose what Guild Guide should do")
      .setRequired(true)
      .addChoices(
        { name: "Enable indexing", value: "enable" },
        { name: "Disable indexing", value: "disable" },
        { name: "Check status", value: "status" },
        { name: "Delete indexed messages", value: "purge" }
      )));

async function execute(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({ content: "Knowledge entries are available inside a server.", ephemeral: true });
  }
  const service = interaction.client.services.knowledge;
  const subcommand = interaction.options.getSubcommand();
  if (subcommand !== "search" && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ content: "You need Manage Server permission to change saved knowledge.", ephemeral: true });
  }
  try {
    if (subcommand === "indexing") {
      const action = interaction.options.getString("action");
      if (action === "status") {
        const enabled = await service.getIndexingEnabled(interaction.guildId);
        return interaction.reply({ content: `Automatic message indexing is **${enabled ? "enabled" : "disabled"}**.`, ephemeral: true });
      }
      if (action === "enable" || action === "disable") {
        const enabled = await service.setIndexingEnabled(interaction.guildId, action === "enable");
        return interaction.reply({ content: enabled
          ? "Automatic indexing is on. New text messages in channels I can view will be saved for `/knowledge search`. Older messages are not imported."
          : "Automatic indexing is off. Previously indexed messages remain searchable until you choose Delete indexed messages.", ephemeral: true });
      }
      if (action === "purge") {
        await service.setIndexingEnabled(interaction.guildId, false);
        const count = await service.purgeMessages(interaction.guildId);
        return interaction.reply({ content: `Indexing is off and ${count} saved message${count === 1 ? "" : "s"} deleted.`, ephemeral: true });
      }
    }
    if (subcommand === "add") {
      const entry = await service.add(interaction.guildId, interaction.options.getString("title"), interaction.options.getString("content"), interaction.user.id);
      return interaction.reply({ content: `Saved **${entry.title}** for this server.`, ephemeral: true });
    }
    if (subcommand === "remove") {
      const removed = await service.remove(interaction.guildId, interaction.options.getString("title"));
      return interaction.reply({ content: removed ? "Knowledge entry removed." : "No entry with that exact title was found.", ephemeral: true });
    }
    const visibleChannelIds = interaction.guild.channels.cache
      .filter(channel => channel.permissionsFor(interaction.member)?.has(PermissionFlagsBits.ViewChannel))
      .map(channel => channel.id);
    const { entries, messages } = await service.searchAll(interaction.guildId, interaction.options.getString("query"), visibleChannelIds);
    if (!entries.length && !messages.length) return interaction.reply({ content: "No matching saved server knowledge found.", ephemeral: true });
    const sections = [];
    if (entries.length) sections.push(`**Saved server information**\n${entries.map(entry => `• **${entry.title}** — ${entry.content}`).join("\n")}`);
    if (messages.length) sections.push(`**Messages found in channels**\n${messages.map(message => `• <#${message.channel_id}> — **${message.author_name}**: ${message.content}`).join("\n")}`);
    return interaction.reply({ content: sections.join("\n\n").slice(0, 1900), ephemeral: true });
  } catch (error) {
    console.error("Knowledge command failed:", error);
    return interaction.reply({ content: "I couldn't complete that knowledge request. Please try again.", ephemeral: true });
  }
}

module.exports = { data, execute };
