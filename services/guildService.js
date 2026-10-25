const pool = require("../database/pool");
const { runMigrations } = require("../database/migrate");

runMigrations(pool).catch(error => {
  console.error("Database migration failed:", error);
  process.exitCode = 1;
}).finally(() => pool.end());
