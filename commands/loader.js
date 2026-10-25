const fs = require("node:fs");
const path = require("node:path");

function loadCommands(directory = __dirname) {
  const commands = new Map();
  for (const file of fs.readdirSync(directory).filter(name => name.endsWith(".js") && name !== "loader.js").sort()) {
    const command = require(path.join(directory, file));
    if (!command.data?.name || typeof command.execute !== "function") {
      throw new Error(`Invalid command module: ${file}`);
    }
    commands.set(command.data.name, command);
  }
  return commands;
}

module.exports = { loadCommands };
