import { createReplyRequest } from "../domain/reply-request.js";
import { StorageService, API_KEY_KEY, HISTORY_KEY, ONBOARDING_COMPLETE_KEY } from "../services/storage-service.js";
import { DeepSeekClient } from "../services/deepseek-client.js";
import { ReplyEngine } from "../services/reply-engine.js";
import { HistoryService } from "../services/history-service.js";
import { VoiceProfileService } from "../services/voice-profile-service.js";
import { UsageService } from "../services/usage-service.js";
import { NativeInputService } from "../services/native-input-service.js";

const MENU_ID = "generate-reply-copilot";
const storage = new StorageService();
const history = new HistoryService();
const profiles = new VoiceProfileService();
const usage = new UsageService();
const activeRequests = new Map();
const generatedInputs = new Map();
const nativeInput = new NativeInputService(chrome.debugger);
let settingsOpenPromise = null;
const X_PAGE = /^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)(?:\/|$)/;
const EXTENSION_PAGE = new RegExp(`^chrome-extension://${chrome.runtime.id}/`);

chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    await chrome.storage.local.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" });
    const old = await chrome.storage.local.get([API_KEY_KEY, HISTORY_KEY, ONBOARDING_COMPLETE_KEY, "replyCopilotWelcomeShown"]);
    await profiles.migrateLegacy({ apiKeyExists: Boolean(old[API_KEY_KEY]), historyExists: Boolean(old[HISTORY_KEY]?.length) });
    // Remove the old DOM editing preference; the native input path is controlled per request.
    await storage.disableLegacyAutoFill();
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
    if (!old[ONBOARDING_COMPLETE_KEY] && !old.replyCopilotWelcomeShown && ["install", "update"].includes(details.reason)) {
      await chrome.storage.local.set({ replyCopilotWelcomeShown: true });
      await chrome.tabs.create({ url: chrome.runtime.getURL("onboarding/onboarding.html") });
    }
  })();
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_ID, title: "生成回复", contexts: ["selection"], documentUrlPatterns: ["https://x.com/*", "https://twitter.com/*"] });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  let request;
  try { request = createReplyRequest({ sourceText: info.selectionText || "", sourceUrl: info.pageUrl || tab?.url || "" }); }
  catch (error) { request = { requestId: crypto.randomUUID(), error: error.message, sourceUrl: info.pageUrl || tab?.url || "", createdAt: new Date().toISOString() }; }
  await storage.savePendingRequest(request);
  try { if (Number.isInteger(tab?.windowId)) await chrome.sidePanel.open({ windowId: tab.windowId }); }
  catch { await storage.savePendingRequest({ ...request, error: "Chrome could not open the side panel. Open it from the Extensions menu and try again." }); }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  const fromXPage = X_PAGE.test(sender.url || sender.tab?.url || "");
  const fromExtensionPage = EXTENSION_PAGE.test(sender.url || "");
  if (message?.type === "REPLY_COPILOT_OPEN_SETTINGS") {
    if (!fromXPage) { sendResponse({ ok: false }); return false; }
    if (!settingsOpenPromise) settingsOpenPromise = chrome.runtime.openOptionsPage().finally(() => { settingsOpenPromise = null; });
    void settingsOpenPromise.then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
    return true;
  }
  if (message?.type === "REPLY_COPILOT_GET_BEHAVIOR") {
    if (!fromXPage && !fromExtensionPage) { sendResponse({ ok: false }); return false; }
    void storage.getBehaviorPreferences().then((preferences) => sendResponse({ ok: true, preferences }), () => sendResponse({ ok: false }));
    return true;
  }
  if (message?.type === "REPLY_COPILOT_SET_FLOATING_POSITION") {
    if (!fromXPage || !Number.isFinite(message.left) || !Number.isFinite(message.top)) { sendResponse({ ok: false }); return false; }
    void storage.getBehaviorPreferences().then(async (preferences) => {
      if (preferences.rememberFloatingPosition) await storage.setBehaviorPreferences({ floatingPosition: { left: Math.max(0, Math.min(message.left, 10000)), top: Math.max(0, Math.min(message.top, 10000)) } });
      sendResponse({ ok: true });
    }, () => sendResponse({ ok: false }));
    return true;
  }
  if (message?.type === "REPLY_COPILOT_SETTINGS_UPDATED") {
    if (!fromExtensionPage) { sendResponse({ ok: false }); return false; }
    void chrome.runtime.sendMessage({ type: "REPLY_COPILOT_SETTINGS_CHANGED" }).catch(() => {});
    sendResponse({ ok: true }); return false;
  }
  if (message?.type === "REPLY_COPILOT_INPUT_PREPARE") {
    const draft = generatedInputs.get(message.requestId);
    const tabId = sender.tab?.id;
    if (!fromXPage || sender.frameId !== 0 || !Number.isInteger(tabId) || !sender.tab.active || draft?.tabId !== tabId || !["natural", "light_humor", "thoughtful"].includes(message.style) || typeof draft.replies?.[message.style] !== "string") { sendResponse({ ok: false }); return false; }
    void nativeInput.prepare(tabId, message.requestId).then((ok) => sendResponse({ ok }), () => sendResponse({ ok: false }));
    return true;
  }
  if (message?.type === "REPLY_COPILOT_INPUT_COMMIT") {
    const draft = generatedInputs.get(message.requestId);
    const tabId = sender.tab?.id;
    if (!fromXPage || sender.frameId !== 0 || !Number.isInteger(tabId) || !sender.tab.active || draft?.tabId !== tabId || !["natural", "light_humor", "thoughtful"].includes(message.style) || typeof draft.replies?.[message.style] !== "string") { sendResponse({ ok: false }); return false; }
    generatedInputs.delete(message.requestId);
    void nativeInput.commit(tabId, message.requestId, draft.replies[message.style]).then((ok) => sendResponse({ ok }), () => sendResponse({ ok: false }));
    return true;
  }
  if (message?.type === "REPLY_COPILOT_GENERATE") {
    if (!fromXPage || typeof message.requestId !== "string" || typeof message.sourceText !== "string" || message.sourceText.length > 12000 || !/^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^/]+\/status\/\d+/.test(message.sourceUrl || "")) { sendResponse({ ok: false, error: "无法验证当前帖子。请打开侧边栏重试。" }); return false; }
    void (async () => {
      const controller = new AbortController(); activeRequests.get(message.requestId)?.abort(); activeRequests.set(message.requestId, controller);
      try {
        const apiKey = await storage.getApiKey();
        if (!apiKey) throw new Error("请先在设置中保存 DeepSeek API Key。");
        const voiceProfile = await profiles.get();
        const engine = new ReplyEngine({ aiClient: new DeepSeekClient({ apiKey }), historyService: history });
        const result = await engine.generateReplies({ postContext: { text: message.sourceText, url: message.sourceUrl }, voiceProfile, requestId: message.requestId }, { replyStyle: await storage.getReplyStyle(), signal: controller.signal });
        if (controller.signal.aborted) throw new Error("这条生成请求已取消。");
        await history.recordGeneration({ requestId: message.requestId, result });
        await usage.track("generated", { requestId: message.requestId });
        if (Number.isInteger(sender.tab?.id)) {
          generatedInputs.set(message.requestId, { tabId: sender.tab.id, replies: result.replies });
          setTimeout(() => generatedInputs.delete(message.requestId), 120_000);
        }
        sendResponse({ ok: true, result });
      } catch (error) {
        if (!controller.signal.aborted) await usage.track("api_failure", { requestId: message.requestId }).catch(() => {});
        sendResponse({ ok: false, error: error?.message || "生成失败，请打开侧边栏重试。" });
      } finally { if (activeRequests.get(message.requestId) === controller) activeRequests.delete(message.requestId); }
    })();
    return true;
  }
  if (message?.type === "REPLY_COPILOT_CANCEL") { if (fromXPage && typeof message.requestId === "string") { activeRequests.get(message.requestId)?.abort(); generatedInputs.delete(message.requestId); if (Number.isInteger(sender.tab?.id)) void nativeInput.cancel(sender.tab.id, message.requestId); } sendResponse({ ok: true }); return false; }
  if (message?.type === "REPLY_COPILOT_HISTORY") {
    if (!fromXPage || !["selected", "copied", "applied", "manually_confirmed"].includes(message.event)) { sendResponse({ ok: false }); return false; }
    void Promise.all([history.recordEvent(message.requestId, message.event, { style: message.style, reply: message.reply }), usage.track(message.event, { requestId: message.requestId, style: message.style })]).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
    return true;
  }
  if (message?.type === "REPLY_COPILOT_FEEDBACK") {
    if (!fromXPage || !["good", "not_my_style"].includes(message.feedback)) { sendResponse({ ok: false }); return false; }
    void usage.track(message.feedback === "good" ? "feedback_good" : "feedback_bad", { requestId: message.requestId, style: message.style }).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
    return true;
  }
  if (message?.type === "REPLY_COPILOT_OPEN_SIDEPANEL") {
    if (!fromXPage || !Number.isInteger(sender.tab?.windowId)) { sendResponse({ ok: false }); return false; }
    void (async () => {
      if (typeof message.sourceText === "string" && message.sourceText.length > 0 && message.sourceText.length <= 12000 && /^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^/]+\/status\/\d+/.test(message.sourceUrl || "")) {
        try { await storage.savePendingRequest(createReplyRequest({ sourceText: message.sourceText, sourceUrl: message.sourceUrl })); } catch { /* open panel without unverified context */ }
      }
      try { await chrome.sidePanel.open({ windowId: sender.tab.windowId }); sendResponse({ ok: true }); } catch { sendResponse({ ok: false }); }
    })();
    return true;
  }
  return false;
});
