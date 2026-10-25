function readDatabaseEnvironment(env = process.env) {
  if (!env.DATABASE_URL) throw new Error("Missing required environment variable: DATABASE_URL");
  return { databaseUrl: env.DATABASE_URL, pgSslMode: env.PGSSLMODE };
}

function readEnvironment(env = process.env) {
  const config = {
    ...readDatabaseEnvironment(env),
    discordToken: env.DISCORD_TOKEN,
    port: Number(env.PORT || 3000)
  };
  const missing = [];
  if (!config.discordToken) missing.push("DISCORD_TOKEN");
  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error("PORT must be a valid TCP port between 1 and 65535.");
  }
  return config;
}

module.exports = { readEnvironment, readDatabaseEnvironment };
