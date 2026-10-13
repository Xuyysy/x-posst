export const API_KEY_KEY = "deepseekApiKey";
export const PENDING_REQUEST_KEY = "pendingReplyRequest";
export const HISTORY_KEY = "replyHistory";
export const REPLY_STYLE_KEY = "replyStyleProfile";
export const AUTO_FILL_KEY = "experimentalAutoFill";

export class StorageService {
  constructor(storage = globalThis.chrome?.storage) { this.storage = storage; }
  async getApiKey() { return (await this.storage.local.get(API_KEY_KEY))[API_KEY_KEY] || ""; }
  async setApiKey(value) { await this.storage.local.set({ [API_KEY_KEY]: value.trim() }); }
  async clearApiKey() { await this.storage.local.remove(API_KEY_KEY); }
  async getPendingRequest() { return (await this.storage.session.get(PENDING_REQUEST_KEY))[PENDING_REQUEST_KEY] || null; }
  async savePendingRequest(request) { await this.storage.session.set({ [PENDING_REQUEST_KEY]: request }); }
  async getHistory() { return (await this.storage.local.get(HISTORY_KEY))[HISTORY_KEY] || []; }
  async setHistory(history) { await this.storage.local.set({ [HISTORY_KEY]: history }); }
  async getReplyStyle() { return (await this.storage.local.get(REPLY_STYLE_KEY))[REPLY_STYLE_KEY] || "natural-friendly"; }
  async setReplyStyle(value) { await this.storage.local.set({ [REPLY_STYLE_KEY]: value }); }
  async getAutoFillEnabled() { const value = (await this.storage.local.get(AUTO_FILL_KEY))[AUTO_FILL_KEY]; return value === undefined ? true : Boolean(value); }
  async setAutoFillEnabled(value) { await this.storage.local.set({ [AUTO_FILL_KEY]: Boolean(value) }); }
}
