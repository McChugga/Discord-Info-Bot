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
    .addStringOption(option => option.setName("title").setDescription("Exact entry title").setRequired(true).setMaxLength(120)));

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
    if (subcommand === "add") {
      const entry = await service.add(interaction.guildId, interaction.options.getString("title"), interaction.options.getString("content"), interaction.user.id);
      return interaction.reply({ content: `Saved **${entry.title}** for this server.`, ephemeral: true });
    }
    if (subcommand === "remove") {
      const removed = await service.remove(interaction.guildId, interaction.options.getString("title"));
      return interaction.reply({ content: removed ? "Knowledge entry removed." : "No entry with that exact title was found.", ephemeral: true });
    }
    const entries = await service.search(interaction.guildId, interaction.options.getString("query"));
    if (!entries.length) return interaction.reply({ content: "No matching server knowledge found.", ephemeral: true });
    const content = entries.map(entry => `**${entry.title}**\n${entry.content}`).join("\n\n").slice(0, 1900);
    return interaction.reply({ content, ephemeral: true });
  } catch (error) {
    console.error("Knowledge command failed:", error);
    return interaction.reply({ content: "I couldn't complete that knowledge request. Please try again.", ephemeral: true });
  }
}

module.exports = { data, execute };
