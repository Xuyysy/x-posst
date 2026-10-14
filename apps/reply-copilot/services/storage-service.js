export const API_KEY_KEY = "deepseekApiKey";
export const PENDING_REQUEST_KEY = "pendingReplyRequest";
export const HISTORY_KEY = "replyHistory";
export const REPLY_STYLE_KEY = "replyStyleProfile";
export const LEGACY_AUTO_FILL_KEY = "experimentalAutoFill";
export const ONBOARDING_COMPLETE_KEY = "onboardingComplete";
export const BEHAVIOR_PREFERENCES_KEY = "behaviorPreferences";
export const DEFAULT_BEHAVIOR_PREFERENCES = Object.freeze({ autoGenerateOnReply: true, showFloatingWindow: true, rememberFloatingPosition: true, floatingPosition: null, defaultReplyMode: "natural" });

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
  async disableLegacyAutoFill() { await this.storage.local.remove(LEGACY_AUTO_FILL_KEY); }
  async getBehaviorPreferences() {
    const saved = (await this.storage.local.get(BEHAVIOR_PREFERENCES_KEY))[BEHAVIOR_PREFERENCES_KEY] || {};
    return {
      ...DEFAULT_BEHAVIOR_PREFERENCES,
      ...saved,
      defaultReplyMode: ["natural", "light_humor", "thoughtful"].includes(saved.defaultReplyMode) ? saved.defaultReplyMode : "natural",
      floatingPosition: saved.floatingPosition && Number.isFinite(saved.floatingPosition.left) && Number.isFinite(saved.floatingPosition.top) ? { left: saved.floatingPosition.left, top: saved.floatingPosition.top } : null,
    };
  }
  async setBehaviorPreferences(patch) {
    const current = await this.getBehaviorPreferences();
    const next = { ...current, ...patch };
    if (!["natural", "light_humor", "thoughtful"].includes(next.defaultReplyMode)) next.defaultReplyMode = "natural";
    if (next.floatingPosition && (!Number.isFinite(next.floatingPosition.left) || !Number.isFinite(next.floatingPosition.top))) next.floatingPosition = null;
    await this.storage.local.set({ [BEHAVIOR_PREFERENCES_KEY]: next });
    return next;
  }
  async resetFloatingPosition() { return this.setBehaviorPreferences({ floatingPosition: null }); }
}
