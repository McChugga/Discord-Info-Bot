const repository = require("../database/repositories/knowledgeRepository");
const { extractSearchTerms, scoreText } = require("./queryUtils");

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
  async answerQuestion(guildId, question, visibleChannelIds = []) {
    const cleanQuestion = validateText(question, "Question", 200);
    const terms = extractSearchTerms(cleanQuestion);
    const searches = terms.length ? terms.slice(0, 5) : [cleanQuestion];
    const results = await Promise.all(searches.map(async term => {
      const [entries, messages] = await Promise.all([
        repository.search(guildId, term),
        repository.searchMessages(guildId, term, visibleChannelIds)
      ]);
      return { entries, messages };
    }));

    const entries = new Map();
    const messages = new Map();
    for (const result of results) {
      for (const entry of result.entries) {
        const previous = entries.get(entry.id);
        const score = scoreText(`${entry.title} ${entry.content}`, terms) + scoreText(entry.title, terms);
        if (!previous || score > previous.score) entries.set(entry.id, { ...entry, score });
      }
      for (const message of result.messages) {
        const previous = messages.get(message.message_id);
        const score = scoreText(message.content, terms);
        if (!previous || score > previous.score) messages.set(message.message_id, { ...message, score });
      }
    }
    return {
      terms,
      entries: [...entries.values()].sort((a, b) => b.score - a.score).slice(0, 4),
      messages: [...messages.values()].sort((a, b) => b.score - a.score || new Date(b.message_created_at) - new Date(a.message_created_at)).slice(0, 4)
    };
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
