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
  async searchAll(guildId, query, visibleChannelIds = []) {
    const cleanQuery = validateText(query, "Search", 100);
    const [entries, messages] = await Promise.all([
      repository.search(guildId, cleanQuery),
      repository.searchMessages(guildId, cleanQuery, visibleChannelIds)
    ]);
    return { entries, messages };
  },
  getIndexingEnabled(guildId) {
    return repository.getIndexingEnabled(guildId);
  },
  setIndexingEnabled(guildId, enabled) {
    return repository.setIndexingEnabled(guildId, enabled);
  },
  async captureMessage(message) {
    if (!message.guildId || !message.authorId || !message.content?.trim()) return false;
    if (!(await repository.getIndexingEnabled(message.guildId))) return false;
    await repository.indexMessage({ ...message, content: message.content.trim().slice(0, 4000) });
    return true;
  },
  async removeIndexedMessage(messageId) {
    return repository.deleteIndexedMessage(messageId);
  },
  purgeMessages(guildId) {
    return repository.purgeMessages(guildId);
  },
  remove(guildId, title) {
    return repository.remove(guildId, validateText(title, "Title", 120));
  }
};
