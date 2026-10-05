import { HISTORY_KEY } from "./storage-service.js";

export class HistoryService {
  constructor(storage = globalThis.chrome?.storage?.local, clock = () => new Date().toISOString()) { this.storage = storage; this.clock = clock; }
  async getAll() { return (await this.storage.get(HISTORY_KEY))[HISTORY_KEY] || []; }
  async getRecent(limit = 20) { return (await this.getAll()).slice(-limit).reverse(); }
  async addSelectedReply(entry) {
    const history = await this.getAll();
    history.push({ id: crypto.randomUUID(), requestId: entry.requestId, sourceText: entry.sourceText, sourceUrl: entry.sourceUrl || "", reply: entry.reply, style: entry.style, recommendation: entry.recommendation, createdAt: this.clock() });
    await this.storage.set({ [HISTORY_KEY]: history.slice(-100) });
  }
  async clearHistory() { await this.storage.remove(HISTORY_KEY); }
  async getStats() { const history = await this.getAll(); return Object.fromEntries(["sharp", "funny", "natural", "quote"].map((style) => [style, history.filter((item) => item.style === style).length])); }
}
