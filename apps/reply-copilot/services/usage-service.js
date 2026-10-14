export const USAGE_KEY = "localUsageEvents";
export const USAGE_ACTIONS = Object.freeze(["generated", "selected", "copied", "applied", "feedback_good", "feedback_bad", "api_failure"]);

export class UsageService {
  constructor(storage = globalThis.chrome?.storage?.local, clock = () => new Date().toISOString()) { this.storage = storage; this.clock = clock; }
  async getEvents() { return (await this.storage.get(USAGE_KEY))[USAGE_KEY] || []; }
  async track(action, { requestId = "", style = "" } = {}) {
    if (!USAGE_ACTIONS.includes(action)) return false;
    const events = await this.getEvents();
    events.push({ requestId: String(requestId).slice(0, 100), style: String(style).slice(0, 40), action, feedback: action === "feedback_good" ? "good" : action === "feedback_bad" ? "not_my_style" : null, createdAt: this.clock() });
    await this.storage.set({ [USAGE_KEY]: events.slice(-1000) });
    return true;
  }
  async getSummary(now = Date.now()) {
    const events = await this.getEvents();
    const weekStart = now - 7 * 24 * 60 * 60 * 1000;
    const recent = events.filter((event) => Date.parse(event.createdAt) >= weekStart && Date.parse(event.createdAt) <= now);
    const count = (items, action) => items.filter((event) => event.action === action).length;
    return {
      totalGenerations: count(events, "generated"),
      last7DaysGenerations: count(recent, "generated"),
      selections: count(events, "selected"),
      copies: count(events, "copied"),
      feedbackGood: count(events, "feedback_good"),
      feedbackBad: count(events, "feedback_bad"),
      apiFailures: count(events, "api_failure"),
      events: events.slice(-50).reverse(),
    };
  }
  async clear() { await this.storage.remove(USAGE_KEY); }
}
