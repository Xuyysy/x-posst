import { StorageService } from "../services/storage-service.js";
import { testDeepSeekConnection } from "../services/deepseek-client.js";

const storage = new StorageService();
const input = document.getElementById("api-key");
const state = document.getElementById("key-state");
const message = document.getElementById("message");
const hostAccess = document.getElementById("host-access");
const testButton = document.getElementById("test");
let configuredKey = "";
const DEEPSEEK_ORIGIN = "https://api.deepseek.com/*";
function showMessage(text, isError = false) { message.textContent = text; message.classList.toggle("error", isError); }
async function refreshHostAccess() {
  try {
    const granted = await chrome.permissions.contains({ origins: [DEEPSEEK_ORIGIN] });
    hostAccess.textContent = granted ? "DeepSeek host access: allowed by Chrome." : "DeepSeek host access is blocked in Chrome’s extension site access settings.";
    hostAccess.classList.toggle("access-error", !granted);
    return granted;
  } catch {
    hostAccess.textContent = "Could not check DeepSeek host access.";
    hostAccess.classList.add("access-error");
    return false;
  }
}
async function refreshState() {
  configuredKey = await storage.getApiKey();
  state.textContent = configuredKey ? `API key configured (${configuredKey.slice(0, 3)}••••${configuredKey.slice(-4)})` : "No API key configured.";
}
document.getElementById("settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = input.value.trim();
  if (!value && !configuredKey) { showMessage("Enter a DeepSeek API key first.", true); return; }
  if (value) { await storage.setApiKey(value); input.value = ""; await refreshState(); showMessage("API key saved on this device."); }
  else showMessage("API key is already saved.");
});
document.getElementById("clear").addEventListener("click", async () => { await storage.clearApiKey(); input.value = ""; await refreshState(); showMessage("API key cleared."); });
testButton.addEventListener("click", async () => {
  const apiKey = input.value.trim() || configuredKey;
  if (!apiKey) { showMessage("Enter and save a DeepSeek API key first.", true); return; }
  if (!(await refreshHostAccess())) { showMessage("Chrome has blocked this extension’s access to api.deepseek.com. Allow that host in the extension’s site access settings, then retry.", true); return; }
  testButton.disabled = true; showMessage("Testing connection…");
  try { await testDeepSeekConnection(apiKey); showMessage("Connection successful."); }
  catch (error) { showMessage(error.message || "Connection failed.", true); }
  finally { testButton.disabled = false; }
});
void Promise.all([refreshState(), refreshHostAccess()]).catch(() => showMessage("Could not read settings.", true));
