const pool = require("../pool");

async function upsert(guildId, title, content, authorId) {
  const { rows } = await pool.query(
    `INSERT INTO guild_knowledge (guild_id, title, content, created_by_discord_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (guild_id, title) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
     RETURNING *`,
    [guildId, title, content, authorId]
  );
  return rows[0];
}

async function search(guildId, query) {
  const { rows } = await pool.query(
    `SELECT id, title, content, updated_at FROM guild_knowledge
     WHERE guild_id = $1 AND (title ILIKE $2 OR content ILIKE $2)
     ORDER BY CASE WHEN title ILIKE $2 THEN 0 ELSE 1 END, title
     LIMIT 10`,
    [guildId, `%${query}%`]
  );
  return rows;
}

async function remove(guildId, title) {
  const result = await pool.query(
    "DELETE FROM guild_knowledge WHERE guild_id = $1 AND LOWER(title) = LOWER($2)",
    [guildId, title]
  );
  return result.rowCount > 0;
}

module.exports = { upsert, search, remove };
