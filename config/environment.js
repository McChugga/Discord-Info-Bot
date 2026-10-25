CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guild_config (
  guild_id VARCHAR(50) PRIMARY KEY,
  guild_name TEXT,
  description TEXT,
  welcome_message TEXT,
  rules_channel_id VARCHAR(50),
  info_channel_id VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guild_knowledge (
  id BIGSERIAL PRIMARY KEY,
  guild_id VARCHAR(50) NOT NULL,
  title VARCHAR(120) NOT NULL,
  content TEXT NOT NULL,
  created_by_discord_id VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guild_id, title)
);

CREATE INDEX IF NOT EXISTS guild_knowledge_guild_idx ON guild_knowledge (guild_id);
