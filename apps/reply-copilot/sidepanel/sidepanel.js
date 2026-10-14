import { DeepSeekClient } from "../services/deepseek-client.js";
import { HistoryService } from "../services/history-service.js";
import { ReplyEngine } from "../services/reply-engine.js";
import { StorageService, PENDING_REQUEST_KEY } from "../services/storage-service.js";
import { VoiceProfileService } from "../services/voice-profile-service.js";
import { UsageService } from "../services/usage-service.js";

const storage = new StorageService();
const history = new HistoryService();
const profiles = new VoiceProfileService();
const usage = new UsageService();
const $ = (id) => document.getElementById(id);
const cards = $("reply-cards");
const styles = [["natural", "自然"], ["light_humor", "幽默"], ["thoughtful", "观点"]];
let currentRequest = null;
let currentResult = null;
let busy = false;

function formatReplyForClipboard(reply) {
  return reply
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function setBusy(value) {
  busy = value;
  $("regenerate").disabled = value || !currentRequest || Boolean(currentRequest.error);
  document.querySelectorAll(".copy-button").forEach((button) => { button.disabled = value; });
}
function showError(message, settings = false) {
  $("status").textContent = /请|无法|失败|取消|建议/.test(message) ? message : /API key is not configured/i.test(message) ? "尚未配置 DeepSeek API Key，请先前往设置。" : /Could not reach|network request failed|fetch/i.test(message) ? "无法连接 DeepSeek，请检查网络、VPN 或扩展的网站访问权限。" : /unauthorized|invalid.*key/i.test(message) ? "DeepSeek API Key 无效或未获授权，请检查后重试。" : /rate limit/i.test(message) ? "DeepSeek 请求次数已达限制，请稍后重试。" : "回复生成失败，请重试或检查 AI 配置。";
  $("status").className = "status error";
  $("status").classList.remove("hidden");
  $("result").classList.add("hidden");
  $("open-settings").classList.toggle("hidden", !settings);
  setBusy(false);
}
function showIdle() {
  $("status").textContent = "在 X 页面打开回复框，或选中文字后右键选择“生成回复”。";
  $("status").className = "status";
  $("status").classList.remove("hidden");
  $("result").classList.add("hidden");
  $("open-settings").classList.add("hidden");
  currentRequest = null; currentResult = null; setBusy(false);
}
function renderResult(result, preferredStyle = result.defaultStyle || result.default_style || "natural") {
  currentResult = result;
  $("source-text").textContent = currentRequest.sourceText;
  $("recommendation-badge").textContent = ({ reply: "建议回复", quote: "建议引用", skip: "建议跳过" })[result.recommendation] || result.recommendation;
  $("score").textContent = result.score == null ? "" : String(result.score);
  $("score").parentElement.classList.toggle("hidden", result.score == null);
  $("reason").textContent = result.reason;
  cards.replaceChildren();
  const orderedStyles = [...styles].sort(([left], [right]) => Number(right === preferredStyle) - Number(left === preferredStyle));
  for (const [style, label] of orderedStyles) {
    const article = document.createElement("article"); article.className = "card";
    const head = document.createElement("div"); head.className = "card-head";
    const title = document.createElement("h3"); title.textContent = label; head.append(title);
    if (preferredStyle === style) { const badge = document.createElement("span"); badge.className = "recommended"; badge.textContent = "默认"; head.append(badge); }
    const text = document.createElement("p"); text.className = "reply-text"; text.textContent = result.replies[style];
    const button = document.createElement("button"); button.className = "button copy-button"; button.textContent = "复制"; button.dataset.style = style;
    const feedback = document.createElement("div"); feedback.className = "card-feedback";
    const good = document.createElement("button"); good.className = "text-button"; good.textContent = "有帮助"; good.dataset.feedback = "good"; good.dataset.style = style;
    const bad = document.createElement("button"); bad.className = "text-button"; bad.textContent = "不太像我"; bad.dataset.feedback = "not_my_style"; bad.dataset.style = style;
    feedback.append(good, bad); article.append(head, text, button, feedback); cards.append(article);
  }
  $("quote-section").classList.toggle("hidden", result.recommendation !== "quote");
  $("quote-text").textContent = result.quote_candidate || "";
  $("status").classList.add("hidden"); $("open-settings").classList.add("hidden"); $("result").classList.remove("hidden"); setBusy(false);
}
async function generate(request) {
  currentRequest = request; currentResult = null;
  if (request.error) { showError(request.error); return; }
  if (busy) { /* a newly arrived request supersedes the in-flight request */ }
  const requestId = request.requestId;
  $("status").textContent = "正在按你的风格生成回复…"; $("status").className = "status loading"; $("status").classList.remove("hidden"); $("result").classList.add("hidden"); $("open-settings").classList.add("hidden"); setBusy(true);
  try {
    const apiKey = await storage.getApiKey();
    if (!apiKey) throw Object.assign(new Error("DeepSeek API key is not configured."), { needsSettings: true });
    if (currentRequest?.requestId !== requestId) return;
    const engine = new ReplyEngine({ aiClient: new DeepSeekClient({ apiKey }), historyService: history });
    const preferences = await storage.getBehaviorPreferences();
    const result = await engine.generateReplies({ postContext: { text: request.sourceText, url: request.sourceUrl }, voiceProfile: await profiles.get(), requestId }, { replyStyle: await storage.getReplyStyle() });
    await history.recordGeneration({ requestId, result }); await usage.track("generated", { requestId });
    if (currentRequest?.requestId === requestId) renderResult(result, preferences.defaultReplyMode);
  } catch (error) {
    if (currentRequest?.requestId === requestId) { await usage.track("api_failure", { requestId }).catch(() => {}); showError(error.message || "Something went wrong. Try again.", error.needsSettings || error.message?.includes("API key is not configured")); }
  }
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("button"); if (!button) return;
  if (["settings", "footer-settings", "open-settings"].includes(button.id)) { chrome.runtime.openOptionsPage(); return; }
  if (button.id === "regenerate" && currentRequest && !busy) { generate(currentRequest); return; }
  if (button.classList.contains("copy-button") && currentResult && currentRequest && !busy) {
    const style = button.dataset.style; const reply = formatReplyForClipboard(style === "quote" ? currentResult.quote_candidate : currentResult.replies[style]);
    try {
      await navigator.clipboard.writeText(reply);
    } catch { button.textContent = "复制失败"; setTimeout(() => { if (button.isConnected) button.textContent = style === "quote" ? "复制引用" : "复制"; }, 1400); return; }
    button.textContent = "已复制 ✓";
    try { await history.recordEvent(currentRequest.requestId, "copied", { reply, style }); await usage.track("copied", { requestId: currentRequest.requestId, style }); }
    catch { button.textContent = "已复制 · 历史未保存"; }
    setTimeout(() => { if (button.isConnected) button.textContent = style === "quote" ? "复制引用" : "复制"; }, 1300);
  }
  if (button.dataset.feedback && currentResult && currentRequest) {
    const action = button.dataset.feedback === "good" ? "feedback_good" : "feedback_bad";
    await usage.track(action, { requestId: currentRequest.requestId, style: button.dataset.style });
    button.textContent = "已记录 ✓";
    button.disabled = true;
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes[PENDING_REQUEST_KEY]?.newValue) void generate(changes[PENDING_REQUEST_KEY].newValue);
});
void storage.getPendingRequest().then((request) => request ? generate(request) : showIdle()).catch(() => showError("无法读取待处理内容，请关闭后重新打开侧栏。"));
