const test = require("node:test");
const assert = require("node:assert/strict");
const { readEnvironment, readDatabaseEnvironment } = require("../config/environment");

test("reads the required bot and database settings", () => {
  const config = readEnvironment({ DISCORD_TOKEN: "token", DATABASE_URL: "postgres://db", PORT: "4321" });
  assert.equal(config.discordToken, "token");
  assert.equal(config.databaseUrl, "postgres://db");
  assert.equal(config.port, 4321);
});

test("reports missing required settings", () => {
  assert.throws(() => readEnvironment({ DATABASE_URL: "postgres://db" }), /DISCORD_TOKEN/);
  assert.throws(() => readEnvironment({ DISCORD_TOKEN: "token" }), /DATABASE_URL/);
});

test("validates the port", () => {
  assert.throws(() => readEnvironment({ DISCORD_TOKEN: "token", DATABASE_URL: "db", PORT: "0" }), /valid TCP port/);
  assert.throws(() => readEnvironment({ DISCORD_TOKEN: "token", DATABASE_URL: "db", PORT: "abc" }), /valid TCP port/);
});

test("database migrations need only the database connection setting", () => {
  assert.deepEqual(readDatabaseEnvironment({ DATABASE_URL: "postgres://db" }), {
    databaseUrl: "postgres://db", pgSslMode: undefined
  });
});
