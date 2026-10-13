(() => {
  const STYLES = [["natural", "自然"], ["light_humor", "轻幽默"], ["thoughtful", "有观点"]];
  const nextCandidateIndex = (index, length) => length ? (index + 1) % length : 0;
  function mount(anchor, onAction, { compact = false, dismissAfterMs = 0 } = {}) {
    const host = document.createElement("div"); host.dataset.zaneReplyCopilot = "true";
    host.style.cssText = `position:relative;z-index:2147483000;margin:10px 0;font:14px/1.45 system-ui,sans-serif;max-width:${compact ? "560px" : "720px"};width:calc(100% - 16px);`;
    const shadow = host.attachShadow({ mode: "open" });
    const link = document.createElement("link"); link.rel = "stylesheet"; link.href = chrome.runtime.getURL("content/inline-assistant.css"); shadow.append(link);
    const root = document.createElement("section"); root.className = "panel";
    root.innerHTML = '<div class="top"><strong>Zane Reply Copilot</strong><span class="disclaimer">AI 草稿，由你决定是否发送</span><button data-action="dismiss" class="dismiss" aria-label="关闭提示" title="关闭">×</button></div><p class="status">正在理解这条帖子…</p><div class="reply hidden"></div><div class="actions hidden"><button data-action="style"></button><button data-action="change">换一个 ↻</button><button data-action="copy">复制</button><button data-action="fill" class="hidden">填入草稿</button><button data-action="replace" class="hidden">确认替换已编辑文字</button><button data-action="confirmed" class="hidden">我已手动发送</button></div><button data-action="sidepanel" class="text">无法准确匹配时，打开原有侧边栏</button>';
    shadow.append(root); anchor.insertAdjacentElement("afterend", host);
    let candidates = [], index = 0, cycled = false;
    const dismissTimer = dismissAfterMs ? setTimeout(() => host.remove(), dismissAfterMs) : null;
    const status = root.querySelector(".status"), reply = root.querySelector(".reply"), actions = root.querySelector(".actions"), styleButton = root.querySelector('[data-action="style"]');
    function setStatus(message) { status.textContent = message; }
    function showResult(replies, selectedStyle, autoFill) {
      candidates = STYLES.map(([key]) => [key, replies[key]]).filter(([, value]) => typeof value === "string" && value.trim());
      cycled = false;
      index = Math.max(0, candidates.findIndex(([key]) => key === selectedStyle));
      if (!candidates.length) { setStatus("这次没有合适的回复，换一条帖子试试。"); return; }
      setStatus(""); const [style, value] = candidates[index]; reply.textContent = value; reply.classList.remove("hidden"); actions.classList.remove("hidden");
      styleButton.textContent = STYLES.find(([key]) => key === style)?.[1] || "自然";
      root.querySelector('[data-action="fill"]').classList.toggle("hidden", !autoFill);
      root.querySelector('[data-action="confirmed"]').classList.remove("hidden");
    }
    root.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]"); if (!button) return;
      const action = button.dataset.action;
      if (action === "dismiss") { if (dismissTimer) clearTimeout(dismissTimer); host.remove(); onAction("dismiss", {}); return; }
      if ((action === "change" || action === "style") && candidates.length) {
        if (cycled) { onAction("regenerate", { userGesture: true }); cycled = false; return; }
        index = nextCandidateIndex(index, candidates.length); if (index === 0) cycled = true;
        const [key, value] = candidates[index]; styleButton.textContent = STYLES.find(([style]) => style === key)?.[1] || "自然"; reply.textContent = value; onAction("select", { style: key, reply: value, userGesture: true });
        if (cycled) root.querySelector('[data-action="change"]').textContent = "再生成";
        else root.querySelector('[data-action="change"]').textContent = "换一个 ↻";
      }
      else if (action === "copy" && candidates.length) { const [style, value] = candidates[index]; try { await navigator.clipboard.writeText(value.trim()); setStatus("已复制。发送前请检查内容。"); onAction("selected", { style, reply: value }); } catch { setStatus("复制失败，请手动选择这段文字。"); } }
      else if (action === "fill" && candidates.length) onAction("fill", { style: candidates[index][0], reply: candidates[index][1], userGesture: true });
      else if (action === "replace" && candidates.length) onAction("replace", { style: candidates[index][0], reply: candidates[index][1], userGesture: true });
      else if (action === "confirmed" && candidates.length) { const [style, value] = candidates[index]; onAction("manually_confirmed", { style, reply: value, userGesture: true }); setStatus("已记为你手动确认；扩展不会验证或推断发布状态。"); }
      else if (action === "sidepanel") onAction("sidepanel", { userGesture: true });
    });
    return { host, showResult, setStatus, close() { if (dismissTimer) clearTimeout(dismissTimer); host.remove(); }, showReplaceAction() { root.querySelector('[data-action="replace"]').classList.remove("hidden"); }, showFillAction() { root.querySelector('[data-action="fill"]').classList.remove("hidden"); } };
  }
  globalThis.ZaneReplyCopilotContent ||= {};
  globalThis.ZaneReplyCopilotContent.inlineAssistant = { mount, nextCandidateIndex };
})();
