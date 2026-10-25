const { Pool } = require("pg");
const { readDatabaseEnvironment } = require("../config/environment");

const config = readDatabaseEnvironment();
const pool = new Pool({
  connectionString: config.databaseUrl,
  ...(config.pgSslMode === "require" ? { ssl: { rejectUnauthorized: false } } : {})
});

pool.on("error", error => console.error("Unexpected PostgreSQL pool error:", error));

module.exports = pool;
