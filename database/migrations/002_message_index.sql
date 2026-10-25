ALTER TABLE guild_config
  ADD COLUMN IF NOT EXISTS auto_index_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS guild_message_index (
  message_id VARCHAR(50) PRIMARY KEY,
  guild_id VARCHAR(50) NOT NULL,
  channel_id VARCHAR(50) NOT NULL,
  author_id VARCHAR(50) NOT NULL,
  author_name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  message_created_at TIMESTAMPTZ NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guild_message_index_guild_date_idx
  ON guild_message_index (guild_id, message_created_at DESC);
CREATE INDEX IF NOT EXISTS guild_message_index_channel_idx
  ON guild_message_index (guild_id, channel_id);
