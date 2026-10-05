import { AIClient } from "./ai-client.js";
import { DeepSeekAPIError, DeepSeekTimeoutError, InvalidAIResponseError } from "../utils/errors.js";

export const DEFAULT_MODEL = "deepseek-flash";
const API_URL = "https://api.deepseek.com/chat/completions";
const TIMEOUT_MS = 30_000;

export class DeepSeekClient extends AIClient {
  constructor({ apiKey, fetchImpl = fetch, timeoutMs = TIMEOUT_MS } = {}) { super(); this.apiKey = apiKey; this.fetchImpl = fetchImpl; this.timeoutMs = timeoutMs; }
  async generateReplyAnalysis({ system, user }) {
    if (!this.apiKey) throw new DeepSeekAPIError("DeepSeek API key is not configured.");
    if (globalThis.chrome?.permissions?.contains) {
      const hostAccess = await chrome.permissions.contains({ origins: ["https://api.deepseek.com/*"] });
      if (!hostAccess) throw new DeepSeekAPIError("Chrome has blocked this extension’s access to api.deepseek.com. Allow that host in the extension’s site access settings, then retry.");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    try {
      response = await Reflect.apply(this.fetchImpl, globalThis, [API_URL, { method: "POST", headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: DEFAULT_MODEL, messages: [{ role: "system", content: system }, { role: "user", content: user }], response_format: { type: "json_object" }, max_tokens: 1200, thinking: { type: "disabled" } }), signal: controller.signal }]);
    } catch (error) {
      if (error?.name === "AbortError") throw new DeepSeekTimeoutError();
      console.warn("DeepSeek transport error", { name: error?.name || "Error", message: error?.message || "Unknown fetch failure", endpoint: API_URL });
      throw new DeepSeekAPIError("Could not reach api.deepseek.com. Check your internet connection, VPN or proxy, and this extension’s access to the DeepSeek host, then try again.");
    } finally { clearTimeout(timer); }
    if (!response.ok) {
      const message = response.status === 401 || response.status === 403 ? "DeepSeek API key is invalid or unauthorized." : response.status === 429 ? "DeepSeek rate limit reached." : response.status >= 500 ? "DeepSeek is temporarily unavailable." : "DeepSeek request failed.";
      throw new DeepSeekAPIError(message, response.status);
    }
    let data;
    try { data = await response.json(); } catch { throw new InvalidAIResponseError("DeepSeek returned an invalid response. Try again."); }
    if (!data || !Array.isArray(data.choices) || !data.choices.length) throw new InvalidAIResponseError("DeepSeek returned an invalid response. Try again.");
    const content = data.choices[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new InvalidAIResponseError("DeepSeek returned an empty response.");
    return content;
  }
}

export async function testDeepSeekConnection(apiKey, { fetchImpl = fetch, timeoutMs = TIMEOUT_MS } = {}) {
  const client = new DeepSeekClient({ apiKey, fetchImpl, timeoutMs });
  const content = await client.generateReplyAnalysis({ system: 'Return JSON only: {"ok":true}', user: "Reply with {\"ok\":true}." });
  try { if (JSON.parse(content)?.ok !== true) throw new Error(); } catch { throw new InvalidAIResponseError("DeepSeek connection returned an unexpected response."); }
}
