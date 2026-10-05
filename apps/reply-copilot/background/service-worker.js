import { createReplyRequest } from "../domain/reply-request.js";
import { StorageService } from "../services/storage-service.js";

const MENU_ID = "generate-zane-reply";
const storage = new StorageService();

chrome.runtime.onInstalled.addListener(() => {
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
