export const API_KEY_KEY = "deepseekApiKey";
export const PENDING_REQUEST_KEY = "pendingReplyRequest";
export const HISTORY_KEY = "replyHistory";

export class StorageService {
  constructor(storage = globalThis.chrome?.storage) { this.storage = storage; }
  async getApiKey() { return (await this.storage.local.get(API_KEY_KEY))[API_KEY_KEY] || ""; }
  async setApiKey(value) { await this.storage.local.set({ [API_KEY_KEY]: value.trim() }); }
  async clearApiKey() { await this.storage.local.remove(API_KEY_KEY); }
  async getPendingRequest() { return (await this.storage.session.get(PENDING_REQUEST_KEY))[PENDING_REQUEST_KEY] || null; }
  async savePendingRequest(request) { await this.storage.session.set({ [PENDING_REQUEST_KEY]: request }); }
  async getHistory() { return (await this.storage.local.get(HISTORY_KEY))[HISTORY_KEY] || []; }
  async setHistory(history) { await this.storage.local.set({ [HISTORY_KEY]: history }); }
}
