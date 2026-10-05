import { DeepSeekClient } from "../services/deepseek-client.js";
import { HistoryService } from "../services/history-service.js";
import { ReplyEngine } from "../services/reply-engine.js";
import { StorageService, PENDING_REQUEST_KEY } from "../services/storage-service.js";

const storage = new StorageService();
const history = new HistoryService();
const $ = (id) => document.getElementById(id);
const cards = $("reply-cards");
const styles = [["sharp", "Sharp"], ["funny", "Funny"], ["natural", "Natural"]];
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
  $("status").textContent = message;
  $("status").className = "status error";
  $("status").classList.remove("hidden");
  $("result").classList.add("hidden");
  $("open-settings").classList.toggle("hidden", !settings);
  setBusy(false);
}
function showIdle() {
  $("status").textContent = "Select some text on X and right-click “Generate Zane Reply”.";
  $("status").className = "status";
  $("status").classList.remove("hidden");
  $("result").classList.add("hidden");
  $("open-settings").classList.add("hidden");
  currentRequest = null; currentResult = null; setBusy(false);
}
function renderResult(result) {
  currentResult = result;
  $("source-text").textContent = currentRequest.sourceText;
  $("recommendation-badge").textContent = result.recommendation.toUpperCase();
  $("score").textContent = String(result.score);
  $("reason").textContent = result.reason;
  cards.replaceChildren();
  for (const [style, label] of styles) {
    const article = document.createElement("article"); article.className = "card";
    const head = document.createElement("div"); head.className = "card-head";
    const title = document.createElement("h3"); title.textContent = label; head.append(title);
    if (result.best_reply_style === style) { const badge = document.createElement("span"); badge.className = "recommended"; badge.textContent = "Recommended"; head.append(badge); }
    const text = document.createElement("p"); text.className = "reply-text"; text.textContent = result.replies[style];
    const button = document.createElement("button"); button.className = "button copy-button"; button.textContent = "Copy"; button.dataset.style = style;
    article.append(head, text, button); cards.append(article);
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
  $("status").textContent = "Thinking like Zane…"; $("status").className = "status loading"; $("status").classList.remove("hidden"); $("result").classList.add("hidden"); $("open-settings").classList.add("hidden"); setBusy(true);
  try {
    const apiKey = await storage.getApiKey();
    if (!apiKey) throw Object.assign(new Error("DeepSeek API key is not configured."), { needsSettings: true });
    if (currentRequest?.requestId !== requestId) return;
    const engine = new ReplyEngine({ aiClient: new DeepSeekClient({ apiKey }), historyService: history });
    const result = await engine.generate(request);
    if (currentRequest?.requestId === requestId) renderResult(result);
  } catch (error) {
    if (currentRequest?.requestId === requestId) showError(error.message || "Something went wrong. Try again.", error.needsSettings || error.message?.includes("API key is not configured"));
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
    } catch { button.textContent = "Copy failed"; setTimeout(() => { if (button.isConnected) button.textContent = style === "quote" ? "Copy Quote" : "Copy"; }, 1400); return; }
    button.textContent = "Copied ✓";
    try { await history.addSelectedReply({ requestId: currentRequest.requestId, sourceText: currentRequest.sourceText, sourceUrl: currentRequest.sourceUrl, reply, style, recommendation: currentResult.recommendation }); }
    catch { button.textContent = "Copied · history unavailable"; }
    setTimeout(() => { if (button.isConnected) button.textContent = style === "quote" ? "Copy Quote" : "Copy"; }, 1300);
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes[PENDING_REQUEST_KEY]?.newValue) void generate(changes[PENDING_REQUEST_KEY].newValue);
});
void storage.getPendingRequest().then((request) => request ? generate(request) : showIdle()).catch(() => showError("Could not read the pending request. Reopen the side panel."));
