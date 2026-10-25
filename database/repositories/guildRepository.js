const pool = require("../pool");

async function getConfig(guildId) {
  const { rows } = await pool.query("SELECT * FROM guild_config WHERE guild_id = $1", [guildId]);
  return rows[0] || null;
}

async function updateConfig(guildId, patch) {
  const allowed = ["guild_name", "description", "welcome_message", "rules_channel_id", "info_channel_id"];
  const entries = Object.entries(patch).filter(([key]) => allowed.includes(key));
  if (!entries.length) return getConfig(guildId);
  const columns = entries.map(([key]) => key);
  const values = entries.map(([, value]) => value);
  const assignments = columns.map((column, index) => `${column} = $${index + 2}`).join(", ");
  const { rows } = await pool.query(
    `INSERT INTO guild_config (guild_id, ${columns.join(", ")}) VALUES ($1, ${values.map((_, i) => `$${i + 2}`).join(", ")}) ON CONFLICT (guild_id) DO UPDATE SET ${assignments}, updated_at = NOW() RETURNING *`,
    [guildId, ...values]
  );
  return rows[0];
}

module.exports = { getConfig, updateConfig };
