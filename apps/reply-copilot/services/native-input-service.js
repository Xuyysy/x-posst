// Chrome's Input domain delivers text through Blink's editing pipeline.
// Keep one short debugger session per tab and never retry an attempted commit.
export class NativeInputService {
  constructor(debuggerApi) {
    this.debuggerApi = debuggerApi;
    this.sessions = new Map();
    this.used = new Set();
  }

  async prepare(tabId, requestId) {
    const key = `${tabId}:${requestId}`;
    if (!Number.isInteger(tabId) || !requestId || this.used.has(key) || this.sessions.has(tabId)) return false;
    const session = { requestId, attached: false, timer: null };
    this.sessions.set(tabId, session);
    try {
      await this.debuggerApi.attach({ tabId }, "1.3");
      if (this.sessions.get(tabId) !== session) { await this.debuggerApi.detach({ tabId }).catch(() => {}); return false; }
      session.attached = true;
      session.timer = setTimeout(() => { void this.cancel(tabId, requestId); }, 10_000);
      return true;
    } catch {
      if (this.sessions.get(tabId) === session) this.sessions.delete(tabId);
      return false;
    }
  }

  async commit(tabId, requestId, text) {
    const session = this.sessions.get(tabId);
    const key = `${tabId}:${requestId}`;
    if (!session?.attached || session.requestId !== requestId || this.used.has(key) || typeof text !== "string" || !text.trim()) return false;
    this.used.add(key);
    if (this.used.size > 1000) this.used.delete(this.used.values().next().value);
    if (session.timer) { clearTimeout(session.timer); session.timer = null; }
    try {
      await this.debuggerApi.sendCommand({ tabId }, "Input.insertText", { text });
      return true;
    } catch { return false; }
    finally { await this.cancel(tabId, requestId); }
  }

  async cancel(tabId, requestId) {
    const session = this.sessions.get(tabId);
    if (!session || session.requestId !== requestId) return;
    this.sessions.delete(tabId);
    if (session.timer) clearTimeout(session.timer);
    if (session.attached) await this.debuggerApi.detach({ tabId }).catch(() => {});
  }
}
