(() => {
  const STYLES = [["natural", "自然"], ["light_humor", "幽默"], ["thoughtful", "观点"]];
  const nextCandidateIndex = (index, length) => length ? (index + 1) % length : 0;

  function mount(anchor, onAction, { compact = false, dismissAfterMs = 0, preferences = {} } = {}) {
    const host = document.createElement("div"); host.dataset.replyCopilot = "true"; host.dataset.zaneReplyCopilot = "true";
    const pageTheme = getComputedStyle(document.documentElement).colorScheme || getComputedStyle(document.body).colorScheme;
    if (document.documentElement.dataset.theme === "dark" || document.documentElement.dataset.colorMode === "dark" || pageTheme === "dark") host.dataset.theme = "dark";
    host.style.cssText = `position:fixed;z-index:2147483000;margin:0;font:14px/1.45 system-ui,sans-serif;max-width:min(${compact ? "560px" : "720px"},calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;width:min(${compact ? "560px" : "720px"},calc(100vw - 24px));right:12px;bottom:12px;`;
    const shadow = host.attachShadow({ mode: "open" });
    try {
      const link = document.createElement("link"); link.rel = "stylesheet"; link.href = chrome.runtime.getURL("content/inline-assistant.css"); shadow.append(link);
    } catch {
      // The extension may have been reloaded while this tab still holds the old content script.
      // Keep mount failures from surfacing as uncaught errors; refreshing the tab loads the new context.
    }
    const root = document.createElement("section"); root.className = "panel";
    root.innerHTML = '<div class="top"><span class="drag-grip" title="按住拖动">⋮⋮</span><strong>回复助手</strong><span class="disclaimer">AI 草稿 · 由你决定是否发送</span><button data-action="settings" class="window-control" aria-label="打开设置" title="打开设置">⚙</button><button data-action="minimize" class="window-control" aria-label="收起悬浮框" title="收起悬浮框">−</button><button data-action="dismiss" class="window-control close" aria-label="关闭悬浮框" title="关闭悬浮框">×</button></div><div class="body"><p class="status">正在准备…</p><button data-action="generate" class="generate hidden">生成建议</button><div class="reply hidden"></div><div class="actions hidden"><div class="style-tabs"></div><div class="action-row"><button data-action="change">换一个 ↻</button><button data-action="copy">复制</button></div></div><div class="feedback hidden"><span>这条建议有帮助吗？</span><button data-action="feedback-good">有帮助</button><button data-action="feedback-bad">不太像我</button></div><button data-action="retry" class="retry hidden">重试</button><button data-action="sidepanel" class="text">无法准确匹配时，打开侧栏</button></div>';
    shadow.append(root);
    (document.documentElement || document.body).append(host);
    if (preferences.rememberFloatingPosition && preferences.floatingPosition) setPosition(preferences.floatingPosition.left, preferences.floatingPosition.top);
    let candidates = [], index = 0, cycled = false, drag = null, appliedValue = null;
    const dismissTimer = dismissAfterMs ? setTimeout(() => host.remove(), dismissAfterMs) : null;
    const status = root.querySelector(".status"), reply = root.querySelector(".reply"), actions = root.querySelector(".actions");
    const styleTabs = root.querySelector(".style-tabs");
    function setStatus(message) { status.textContent = message; }
    function setPosition(left, top) {
      const width = host.getBoundingClientRect().width || Math.min(compact ? 560 : 720, window.innerWidth - 24);
      host.style.position = "fixed"; host.style.margin = "0"; host.style.right = "auto"; host.style.bottom = "auto"; host.style.width = `${Math.min(width, window.innerWidth - 24)}px`;
      const height = Math.min(host.getBoundingClientRect().height || 240, window.innerHeight - 16);
      host.style.left = `${Math.max(8, Math.min(left, window.innerWidth - width - 8))}px`; host.style.top = `${Math.max(8, Math.min(top, window.innerHeight - height - 8))}px`;
    }
    function showReady() { setStatus("点击下方按钮生成回复建议。"); root.querySelector('[data-action="generate"]').classList.remove("hidden"); }
    function showLoading(message = "正在生成回复建议…") { setStatus(message); root.querySelector('[data-action="generate"]').classList.add("hidden"); root.querySelector('[data-action="retry"]').classList.add("hidden"); }
    function showApplied() {
      appliedValue = candidates[index]?.[1] || null;
      reply.textContent = ""; reply.classList.add("hidden");
      root.querySelector('[data-action="generate"]').classList.add("hidden");
      setStatus("已填入 X 回复框，可直接编辑。切换风格只会更新这里的建议。");
    }
    function showResult(replies, selectedStyle = "natural") {
      appliedValue = null;
      candidates = STYLES.map(([key]) => [key, replies[key]]).filter(([, value]) => typeof value === "string" && value.trim());
      cycled = false; index = Math.max(0, candidates.findIndex(([key]) => key === selectedStyle));
      if (!candidates.length) { setStatus("这次没有可用的回复建议，请重试。"); showRetry(); return; }
      const [style, value] = candidates[index]; reply.textContent = value; reply.classList.remove("hidden"); actions.classList.remove("hidden"); setStatus("点击复制，再粘贴到 X 回复框。");
      styleTabs.replaceChildren();
      for (const [key, label] of STYLES) { const tab = document.createElement("button"); tab.type = "button"; tab.dataset.style = key; tab.textContent = label; tab.classList.toggle("active", style === key); tab.addEventListener("click", () => selectStyle(key)); styleTabs.append(tab); }
      root.querySelector(".feedback").classList.remove("hidden"); root.querySelector('[data-action="retry"]').classList.add("hidden");
    }
    function selectStyle(key) {
      const selected = candidates.findIndex(([candidate]) => candidate === key); if (selected < 0) return;
      index = selected; const [style, value] = candidates[index]; reply.textContent = value; reply.classList.toggle("hidden", value === appliedValue);
      styleTabs.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.style === style));
      if (appliedValue && value !== appliedValue) setStatus("这是另一种表达；原回复框不会被覆盖。可复制后自行替换。");
      onAction("selected", { style, reply: value, userGesture: true });
    }
    function showRetry() { root.querySelector('[data-action="retry"]').classList.remove("hidden"); }
    const header = root.querySelector(".top");
    header.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      const rect = host.getBoundingClientRect(); drag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
      host.style.position = "fixed"; host.style.margin = "0"; host.style.width = `${rect.width}px`; host.style.right = "auto"; host.style.bottom = "auto"; host.style.left = `${rect.left}px`; host.style.top = `${rect.top}px`;
      header.setPointerCapture(event.pointerId); event.preventDefault();
    });
    header.addEventListener("pointermove", (event) => {
      if (!drag) return;
      const left = Math.max(8, Math.min(drag.left + event.clientX - drag.x, window.innerWidth - host.offsetWidth - 8));
      const top = Math.max(8, Math.min(drag.top + event.clientY - drag.y, window.innerHeight - 48));
      host.style.left = `${left}px`; host.style.top = `${top}px`;
    });
    header.addEventListener("pointerup", () => { if (!drag) return; drag = null; onAction("position_changed", { left: host.getBoundingClientRect().left, top: host.getBoundingClientRect().top }); });
    header.addEventListener("pointercancel", () => { drag = null; });
    root.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]"); if (!button) return;
      const action = button.dataset.action;
      if (action === "settings") { onAction("settings", {}); return; }
      if (action === "minimize") { root.classList.toggle("collapsed"); button.textContent = root.classList.contains("collapsed") ? "+" : "−"; button.title = root.classList.contains("collapsed") ? "展开悬浮框" : "收起悬浮框"; button.setAttribute("aria-label", button.title); return; }
      if (action === "dismiss") { if (dismissTimer) clearTimeout(dismissTimer); host.remove(); onAction("dismiss", {}); return; }
      if (action === "generate") { onAction("generate", { userGesture: true }); return; }
      if (action === "change" && candidates.length) {
        if (cycled) { onAction("regenerate", { userGesture: true }); cycled = false; return; }
        index = nextCandidateIndex(index, candidates.length); if (index === 0) cycled = true;
        const [style, value] = candidates[index]; reply.textContent = value; reply.classList.toggle("hidden", value === appliedValue); styleTabs.querySelectorAll("button").forEach((tab) => tab.classList.toggle("active", tab.dataset.style === style)); onAction("selected", { style, reply: value, userGesture: true });
        if (appliedValue && value !== appliedValue) setStatus("这是另一种表达；原回复框不会被覆盖。可复制后自行替换。");
        button.textContent = cycled ? "再生成" : "换一个 ↻";
      } else if (action === "copy" && candidates.length) { const [style, value] = candidates[index]; try { await navigator.clipboard.writeText(value.trim()); setStatus("已复制，请检查后再发送。"); onAction("copied", { style, reply: value }); } catch { setStatus("复制失败，请手动选择文字。"); } }
      else if (action === "retry") onAction("regenerate", { userGesture: true });
      else if (action === "feedback-good") { onAction("feedback", { feedback: "good", style: candidates[index]?.[0] }); button.disabled = true; button.textContent = "已记录 ✓"; }
      else if (action === "feedback-bad") { onAction("feedback", { feedback: "not_my_style", style: candidates[index]?.[0] }); button.disabled = true; button.textContent = "已记录 ✓"; }
      else if (action === "sidepanel") onAction("sidepanel", { userGesture: true });
    });
    return { host, showResult, showApplied, showReady, showLoading, setStatus(message) { setStatus(message); root.querySelector('[data-action="retry"]').classList.add("hidden"); }, showRetry, close() { if (dismissTimer) clearTimeout(dismissTimer); host.remove(); }, setPosition, setCollapsed(value) { root.classList.toggle("collapsed", value); } };
  }
  globalThis.ZaneReplyCopilotContent ||= {};
  globalThis.ZaneReplyCopilotContent.inlineAssistant = { mount, nextCandidateIndex };
})();
