import { HISTORY_KEY } from "./storage-service.js";

export class HistoryService {
  constructor(storage = globalThis.chrome?.storage?.local, clock = () => new Date().toISOString()) { this.storage = storage; this.clock = clock; }
  async getAll() { return (await this.storage.get(HISTORY_KEY))[HISTORY_KEY] || []; }
  async getRecent(limit = 20) {
    return (await this.getAll()).filter((item) => item.reply && (!item.events || item.events.some((event) => ["selected", "copied", "manually_confirmed"].includes(event)))).slice(-limit).reverse();
  }
  async recordGeneration({ requestId, sourceText, sourceUrl = "", result }) {
    const history = await this.getAll();
    history.push({ id: crypto.randomUUID(), requestId, status: "generated", events: ["generated"], recommendation: result.recommendation, createdAt: this.clock(), generatedAt: this.clock() });
    await this.storage.set({ [HISTORY_KEY]: history.slice(-100) });
  }
  async recordEvent(requestId, event, { style, reply, sourceText, sourceUrl = "" } = {}) {
    const allowed = ["selected", "copied", "applied", "manually_confirmed"];
    if (!allowed.includes(event)) return false;
    const history = await this.getAll();
    let entry = history.findLast?.((item) => item.requestId === requestId) || [...history].reverse().find((item) => item.requestId === requestId);
    if (!entry) {
      entry = { id: crypto.randomUUID(), requestId, events: ["generated"], createdAt: this.clock() };
      history.push(entry);
    }
    entry.events ||= ["generated"];
    if (["copied", "manually_confirmed"].includes(event) && !entry.events.includes("selected")) entry.events.push("selected");
    entry.events.push(event);
    entry.status = event;
    entry.updatedAt = this.clock();
    if (style) entry.style = style;
    if (reply !== undefined) entry.reply = reply;
    await this.storage.set({ [HISTORY_KEY]: history.slice(-100) });
    return true;
  }
  async addSelectedReply(entry) {
    const history = await this.getAll();
    history.push({ id: crypto.randomUUID(), requestId: entry.requestId, reply: entry.reply, style: entry.style, recommendation: entry.recommendation, status: "copied", events: ["generated", "selected", "copied"], createdAt: this.clock() });
    await this.storage.set({ [HISTORY_KEY]: history.slice(-100) });
  }
  async clearHistory() { await this.storage.remove(HISTORY_KEY); }
  async getStats() { const history = await this.getAll(); return Object.fromEntries(["natural", "light_humor", "thoughtful", "sharp", "funny", "quote"].map((style) => [style, history.filter((item) => item.style === style && item.reply).length])); }
}
