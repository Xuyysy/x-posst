import { HISTORY_KEY } from "./storage-service.js";

export class HistoryService {
  constructor(storage = globalThis.chrome?.storage?.local, clock = () => new Date().toISOString()) { this.storage = storage; this.clock = clock; }
  async getAll() { return (await this.storage.get(HISTORY_KEY))[HISTORY_KEY] || []; }
  async getRecent(limit = 20) {
    return (await this.getAll()).filter((item) => item.reply && (!item.events || item.events.includes("selected") || item.events.includes("manually_confirmed"))).slice(-limit).reverse();
  }
  async recordGeneration({ requestId, sourceText, sourceUrl = "", result }) {
    const history = await this.getAll();
    history.push({ id: crypto.randomUUID(), requestId, sourceText, sourceUrl, status: "generated", events: ["generated"], candidates: result.replies, recommendation: result.recommendation, createdAt: this.clock(), generatedAt: this.clock() });
    await this.storage.set({ [HISTORY_KEY]: history.slice(-100) });
  }
  async recordEvent(requestId, event, { style, reply, sourceText, sourceUrl = "" } = {}) {
    const allowed = ["selected", "applied", "manually_confirmed"];
    if (!allowed.includes(event)) return false;
    const history = await this.getAll();
    let entry = history.findLast?.((item) => item.requestId === requestId) || [...history].reverse().find((item) => item.requestId === requestId);
    if (!entry) {
      entry = { id: crypto.randomUUID(), requestId, sourceText: sourceText || "", sourceUrl, events: ["generated"], createdAt: this.clock() };
      history.push(entry);
    }
    entry.events ||= ["generated"];
    if (event === "manually_confirmed" && !entry.events.includes("selected")) entry.events.push("selected");
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
    history.push({ id: crypto.randomUUID(), requestId: entry.requestId, sourceText: entry.sourceText, sourceUrl: entry.sourceUrl || "", reply: entry.reply, style: entry.style, recommendation: entry.recommendation, status: "selected", events: ["generated", "selected"], createdAt: this.clock() });
    await this.storage.set({ [HISTORY_KEY]: history.slice(-100) });
  }
  async clearHistory() { await this.storage.remove(HISTORY_KEY); }
  async getStats() { const history = await this.getAll(); return Object.fromEntries(["natural", "light_humor", "thoughtful", "sharp", "funny", "quote"].map((style) => [style, history.filter((item) => item.style === style && item.reply).length])); }
}
