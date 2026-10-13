import { createReplyRequest } from "../domain/reply-request.js";
import { StorageService } from "../services/storage-service.js";
import { DeepSeekClient } from "../services/deepseek-client.js";
import { ReplyEngine } from "../services/reply-engine.js";
import { HistoryService } from "../services/history-service.js";

const MENU_ID = "generate-zane-reply";
const storage = new StorageService();
const history = new HistoryService();
const activeRequests = new Map();
const X_PAGE = /^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)(?:\/|$)/;

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    const marker = "autoFillExplicitlyEnabled20261013";
    const state = await chrome.storage.local.get(marker);
    if (!state[marker]) {
      await storage.setAutoFillEnabled(true);
      await chrome.storage.local.set({ [marker]: true });
    }
  })();
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_ID, title: "Generate Zane Reply", contexts: ["selection"], documentUrlPatterns: ["https://x.com/*", "https://twitter.com/*"] });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  let request;
  try { request = createReplyRequest({ sourceText: info.selectionText || "", sourceUrl: info.pageUrl || tab?.url || "" }); }
  catch (error) { request = { requestId: crypto.randomUUID(), error: error.message, sourceUrl: info.pageUrl || tab?.url || "", createdAt: new Date().toISOString() }; }
  await storage.savePendingRequest(request);
  try {
    if (Number.isInteger(tab?.windowId)) await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch {
    await storage.savePendingRequest({ ...request, error: "Chrome could not open the side panel. Open it from the Extensions menu and try again." });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  const fromXPage = X_PAGE.test(sender.url || sender.tab?.url || "");
  if (message?.type === "REPLY_COPILOT_GENERATE") {
    if (!fromXPage || typeof message.requestId !== "string" || typeof message.sourceText !== "string" || message.sourceText.length > 12000 || !/^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^/]+\/status\/\d+/.test(message.sourceUrl || "")) { sendResponse({ ok: false, error: "无法验证当前帖子。请打开侧边栏重试。" }); return false; }
    void (async () => {
      const controller = new AbortController(); activeRequests.get(message.requestId)?.abort(); activeRequests.set(message.requestId, controller);
      try {
        const apiKey = await storage.getApiKey();
        if (!apiKey) throw new Error("请先在扩展设置中保存 DeepSeek API Key。");
        const engine = new ReplyEngine({ aiClient: new DeepSeekClient({ apiKey }), historyService: history });
        const result = await engine.generate({ sourceText: message.sourceText, sourceUrl: message.sourceUrl }, { replyStyle: await storage.getReplyStyle(), signal: controller.signal });
        if (controller.signal.aborted) throw new Error("这条生成请求已取消。");
        await history.recordGeneration({ requestId: message.requestId, sourceText: message.sourceText, sourceUrl: message.sourceUrl, result });
        sendResponse({ ok: true, result, autoFillEnabled: await storage.getAutoFillEnabled() });
      } catch (error) { sendResponse({ ok: false, error: error?.message || "生成失败，请打开侧边栏重试。" }); }
      finally { if (activeRequests.get(message.requestId) === controller) activeRequests.delete(message.requestId); }
    })();
    return true;
  }
  if (message?.type === "REPLY_COPILOT_CANCEL") { if (fromXPage && typeof message.requestId === "string") activeRequests.get(message.requestId)?.abort(); sendResponse({ ok: true }); return false; }
  if (message?.type === "REPLY_COPILOT_HISTORY") {
    if (!fromXPage || !["selected", "applied", "manually_confirmed"].includes(message.event)) { sendResponse({ ok: false }); return false; }
    void history.recordEvent(message.requestId, message.event, { style: message.style, reply: message.reply, sourceText: message.sourceText, sourceUrl: message.sourceUrl }).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
    return true;
  }
  if (message?.type === "REPLY_COPILOT_OPEN_SIDEPANEL") {
    if (!fromXPage || !Number.isInteger(sender.tab?.windowId)) { sendResponse({ ok: false }); return false; }
    void chrome.sidePanel.open({ windowId: sender.tab.windowId }).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
    return true;
  }
  return false;
});
