const repository = require("../database/repositories/guildRepository");

module.exports = {
  getConfig: repository.getConfig,
  updateConfig: repository.updateConfig
};
