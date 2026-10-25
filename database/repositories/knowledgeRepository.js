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

async function getIndexingEnabled(guildId) {
  const { rows } = await pool.query(
    "SELECT auto_index_enabled FROM guild_config WHERE guild_id = $1",
    [guildId]
  );
  return rows[0]?.auto_index_enabled === true;
}

async function setIndexingEnabled(guildId, enabled) {
  const { rows } = await pool.query(
    `INSERT INTO guild_config (guild_id, auto_index_enabled)
     VALUES ($1, $2)
     ON CONFLICT (guild_id) DO UPDATE SET auto_index_enabled = EXCLUDED.auto_index_enabled, updated_at = NOW()
     RETURNING auto_index_enabled`,
    [guildId, enabled]
  );
  return rows[0].auto_index_enabled;
}

async function indexMessage(message) {
  await pool.query(
    `INSERT INTO guild_message_index
       (message_id, guild_id, channel_id, author_id, author_name, content, message_created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (message_id) DO UPDATE SET
       content = EXCLUDED.content,
       author_name = EXCLUDED.author_name,
       channel_id = EXCLUDED.channel_id,
       message_created_at = EXCLUDED.message_created_at,
       indexed_at = NOW()`,
    [message.id, message.guildId, message.channelId, message.authorId, message.authorName, message.content, message.createdAt]
  );
}

async function deleteIndexedMessage(messageId) {
  await pool.query("DELETE FROM guild_message_index WHERE message_id = $1", [messageId]);
}

async function searchMessages(guildId, query, visibleChannelIds) {
  if (!visibleChannelIds.length) return [];
  const { rows } = await pool.query(
    `SELECT message_id, channel_id, author_name, content, message_created_at
     FROM guild_message_index
     WHERE guild_id = $1 AND content ILIKE $2 AND channel_id = ANY($3::varchar[])
     ORDER BY message_created_at DESC
     LIMIT 5`,
    [guildId, `%${query}%`, visibleChannelIds]
  );
  return rows;
}

async function purgeMessages(guildId) {
  const result = await pool.query("DELETE FROM guild_message_index WHERE guild_id = $1", [guildId]);
  return result.rowCount;
}

async function remove(guildId, title) {
  const result = await pool.query(
    "DELETE FROM guild_knowledge WHERE guild_id = $1 AND LOWER(title) = LOWER($2)",
    [guildId, title]
  );
  return result.rowCount > 0;
}

module.exports = { upsert, search, remove, getIndexingEnabled, setIndexingEnabled, indexMessage, deleteIndexedMessage, searchMessages, purgeMessages };
