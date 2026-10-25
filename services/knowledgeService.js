const repository = require("../database/repositories/knowledgeRepository");

function validateText(value, name, maxLength) {
  const clean = String(value || "").trim();
  if (!clean) throw new Error(`${name} cannot be empty.`);
  if (clean.length > maxLength) throw new Error(`${name} must be ${maxLength} characters or fewer.`);
  return clean;
}

module.exports = {
  add(guildId, title, content, authorId) {
    return repository.upsert(guildId, validateText(title, "Title", 120), validateText(content, "Content", 4000), authorId);
  },
  search(guildId, query) {
    return repository.search(guildId, validateText(query, "Search", 100));
  },
  remove(guildId, title) {
    return repository.remove(guildId, validateText(title, "Title", 120));
  }
};
