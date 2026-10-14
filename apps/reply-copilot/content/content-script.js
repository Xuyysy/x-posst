(() => {
  const api = globalThis.ZaneReplyCopilotContent;
  let active = null;
  let contextAlive = true;
  let nativeInputHealthy = true;
  const isX = /^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\//.test(location.href);
  if (!isX) return;
  const installKey = Symbol.for("zane-reply-copilot.content-script-installed");
  if (globalThis[installKey]) return;
  globalThis[installKey] = true;

  function stopInvalidContext() {
    if (!contextAlive) return;
    contextAlive = false;
    try { active?.observer?.disconnect(); } catch {}
    try { active?.editor?.removeEventListener("input", active.onComposerInput, true); } catch {}
    try { active?.assistant?.host?.remove(); } catch {}
    active = null;
    try { document.removeEventListener("click", onDocumentClick, true); } catch {}
    try { chrome.runtime.onMessage.removeListener(onRuntimeMessage); } catch {}
  }
  function hasRuntimeContext() {
    try {
      if (!chrome.runtime?.id) { stopInvalidContext(); return false; }
      return contextAlive;
    } catch { stopInvalidContext(); return false; }
  }
  function safeSend(message) {
    if (!hasRuntimeContext()) return Promise.resolve(null);
    try {
      return chrome.runtime.sendMessage(message).catch((error) => {
        if (/extension context invalidated/i.test(error?.message || "")) stopInvalidContext();
        return null;
      });
    } catch (error) {
      if (/extension context invalidated/i.test(error?.message || "")) stopInvalidContext();
      return Promise.resolve(null);
    }
  }

  function record(eventName, data = {}) {
    if (!active) return;
    void safeSend({ type: "REPLY_COPILOT_HISTORY", requestId: active.requestId, sourceText: active.post.sourceText, sourceUrl: active.post.sourceUrl, event: eventName, ...data });
  }
  function localizeError(message) {
    if (/请|无法|失败|超时|取消|没有|建议/.test(message || "")) return message;
    if (/API key is not configured/i.test(message || "")) return "请先在设置中心保存 DeepSeek API Key。";
    if (/Could not reach|network request failed|fetch/i.test(message || "")) return "无法连接 DeepSeek，请检查网络、VPN、代理和扩展的网站访问权限。";
    if (/invalid or unauthorized|unauthorized/i.test(message || "")) return "DeepSeek API Key 无效或未获授权，请检查后重试。";
    if (/rate limit/i.test(message || "")) return "DeepSeek 请求次数已达限制，请稍后重试。";
    if (/temporarily unavailable/i.test(message || "")) return "DeepSeek 服务暂时不可用，请稍后重试。";
    if (/invalid JSON|invalid response|empty response/i.test(message || "")) return "AI 返回内容暂时无法识别，请重新生成。";
    return "回复生成失败，请重试或打开设置中心检查配置。";
  }
  function matchedComposer(post) {
    if (!hasRuntimeContext()) return { editor: null, matchedPost: false };
    let editor = api.composerAdapter.findComposer(post.article);
    let matchedPost = Boolean(editor);
    if (!editor) {
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        const statusLink = [...dialog.querySelectorAll('a[href*="/status/"]')].some((anchor) => anchor.href.includes(`/status/${post.statusId}`));
        const candidates = [...dialog.querySelectorAll('[contenteditable="true"][role="textbox"], [data-testid="tweetTextarea_0"][contenteditable="true"]')].filter((node) => node.isConnected);
        if (statusLink && candidates.length === 1) { editor = candidates[0]; matchedPost = true; }
      }
    }
    return { editor, matchedPost };
  }
  function begin(control, post) {
    if (active?.post?.statusId === post.statusId && active.editor?.isConnected && !active.cancelled && (active.initializing || active.generating || active.assistant?.host?.isConnected)) return;
    if (!hasRuntimeContext()) return;
    if (active?.requestId) void safeSend({ type: "REPLY_COPILOT_CANCEL", requestId: active.requestId });
    try { active?.editor?.removeEventListener("input", active.onComposerInput, true); } catch {}
    if (active?.observer) active.observer.disconnect();
    if (active?.assistant?.host?.isConnected) active.assistant.host.remove();
    const requestId = crypto.randomUUID();
    active = { requestId, post, control, editor: null, assistant: null, generated: false, cancelled: false, initializing: true, attemptedInput: new Set() };
    const setTimeoutId = setTimeout(() => {
      active?.observer?.disconnect();
      if (active?.requestId === requestId && !active.assistant) showFallback("没有找到与这条帖子明确关联的回复框。请用侧边栏继续。", post.article);
    }, 9000);
    const locate = () => {
      if (!hasRuntimeContext()) return false;
      if (!active || active.requestId !== requestId || active.cancelled) return false;
      let found;
      try { found = matchedComposer(post); }
      catch (error) { if (/extension context invalidated/i.test(error?.message || "")) stopInvalidContext(); return false; }
      if (!found.editor || !found.matchedPost) return false;
      clearTimeout(setTimeoutId); active.editor = found.editor; active.matchedPost = found.matchedPost;
      const session = active;
      session.initialComposerText = api.composerAdapter.readText(found.editor);
      session.userTouchedComposer = false;
      session.onComposerInput = () => { if (!session.applyingReply) session.userTouchedComposer = true; };
      found.editor.addEventListener("input", session.onComposerInput, true);
      active.anchor = found.editor.parentElement || found.editor;
      active.observer?.disconnect(); active.observer = null;
      void prepareCurrent(requestId);
      return true;
    };
    if (!locate()) {
      const observer = new MutationObserver(() => { try { if (locate()) observer.disconnect(); } catch (error) { if (/extension context invalidated/i.test(error?.message || "")) stopInvalidContext(); } });
      active.observer = observer;
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["contenteditable", "role"] });
    }
  }
  async function prepareCurrent(requestId) {
    const current = active;
    try {
      const response = await safeSend({ type: "REPLY_COPILOT_GET_BEHAVIOR" });
      if (!contextAlive) return;
      if (!active || active.requestId !== requestId) return;
      if (!response?.ok) throw new Error("无法读取插件设置");
      current.preferences = response.preferences; current.initializing = false;
      if (current.preferences.showFloatingWindow) current.assistant = api.inlineAssistant.mount(current.anchor, handleAction, { preferences: current.preferences });
      if (current.preferences.autoGenerateOnReply && current.preferences.showFloatingWindow) void generateActive(requestId);
      else current.assistant?.showReady();
    } catch { if (!contextAlive) return; current.initializing = false; current.assistant = api.inlineAssistant.mount(current.anchor, handleAction); current.assistant.setStatus("无法读取插件设置，请打开设置中心检查。"); }
  }
  function remountAssistant(current, preferences) {
    current.assistant?.close(); current.assistant = null;
    if (!preferences.showFloatingWindow || current.dismissed || !current.anchor?.isConnected) return;
    current.preferences = preferences;
    current.assistant = api.inlineAssistant.mount(current.anchor, handleAction, { preferences });
    if (current.appliedText) { current.assistant.showResult(current.result.replies, current.appliedStyle || "natural"); current.assistant.showApplied(); }
    else if (current.result) current.assistant.showResult(current.result.replies, preferences.defaultReplyMode || current.result.defaultStyle || "natural");
    else if (current.generating) current.assistant.showLoading();
    else if (preferences.autoGenerateOnReply) void generateActive(current.requestId);
    else current.assistant.showReady();
  }
  function showFallback(message, anchor) {
    const fallback = api.inlineAssistant.mount(anchor, handleAction, { compact: true, dismissAfterMs: 12_000 });
    active.assistant = fallback; fallback.setStatus(message);
  }
  async function autoFillCurrent(current, requestId, style) {
    const candidate = current.result?.replies?.[style];
    if (current.result?.recommendation === "skip" || typeof candidate !== "string" || !candidate.trim() || current.attemptedInput.has(requestId)) return;
    const normalized = candidate.trim();
    if (normalized.length % 2 === 0 && normalized.slice(0, normalized.length / 2) === normalized.slice(normalized.length / 2)) {
      current.assistant?.setStatus("AI 建议本身含有重复文字，请换一种表达；这条未填入回复框。");
      return;
    }
    if (!nativeInputHealthy) { current.assistant?.setStatus("本页面的自动填入已停止，可复制建议后粘贴。"); return; }
    if (current.initialComposerText || current.userTouchedComposer || api.composerAdapter.readText(current.editor)) {
      current.assistant?.setStatus("回复框已有内容，已保留原文；可以复制建议后自行调整。");
      return;
    }
    current.attemptedInput.add(requestId);
    const ready = await safeSend({ type: "REPLY_COPILOT_INPUT_PREPARE", requestId, style });
    if (!ready?.ok) { current.assistant?.setStatus("Chrome 无法准备自动填入，可复制建议后粘贴。"); return; }
    if (!contextAlive || active !== current || current.requestId !== requestId || current.cancelled || !current.editor?.isConnected || current.userTouchedComposer || api.composerAdapter.readText(current.editor) || !api.composerAdapter.focusEmpty(current.editor)) {
      void safeSend({ type: "REPLY_COPILOT_CANCEL", requestId });
      current.assistant?.setStatus("回复框已变化，已保留现有内容；可以复制建议后粘贴。");
      return;
    }
    current.applyingReply = true;
    const result = await safeSend({ type: "REPLY_COPILOT_INPUT_COMMIT", requestId, style });
    current.applyingReply = false;
    if (!contextAlive || active !== current || current.requestId !== requestId || current.cancelled) return;
    if (!result?.ok) { current.assistant?.setStatus("Chrome 未能填入文字，可复制建议后粘贴。"); return; }
    await new Promise((resolve) => setTimeout(resolve, 80));
    if (!contextAlive || active !== current || current.requestId !== requestId || current.cancelled) return;
    if (current.userTouchedComposer) {
      current.appliedText = candidate.trim(); current.appliedStyle = style; current.assistant?.showApplied(); record("applied", { style, reply: candidate }); return;
    }
    if (!current.editor?.isConnected || api.composerAdapter.readText(current.editor) !== candidate.trim()) {
      nativeInputHealthy = false;
      current.assistant?.setStatus("X 回复框显示与候选不一致。请关闭这个草稿并刷新 X 后再试；当前建议可复制。");
      return;
    }
    current.appliedText = candidate.trim(); current.appliedStyle = style;
    current.assistant?.showApplied();
    record("applied", { style, reply: candidate });
  }
  async function generateActive(requestId) {
    const current = active;
    if (!current || current.requestId !== requestId || current.cancelled) return;
    if (!current.editor?.isConnected || !current.matchedPost) { current.assistant?.setStatus("无法准确匹配原帖和回复框，请打开侧栏继续。"); return; }
    current.generating = true; current.assistant?.showLoading();
    try {
      const response = await safeSend({ type: "REPLY_COPILOT_GENERATE", requestId, sourceText: current.post.sourceText, sourceUrl: current.post.sourceUrl });
      if (!contextAlive) return;
      if (!active || active.requestId !== requestId || active.cancelled || !active.editor?.isConnected) return;
      if (!response?.ok) throw new Error(response?.error || "生成失败，请打开侧边栏重试。");
      current.generated = true; current.generating = false; current.result = response.result;
      const selectedStyle = current.preferences?.defaultReplyMode || response.result.defaultStyle || response.result.default_style || "natural";
      current.assistant?.showResult(response.result.replies, selectedStyle);
      if (response.result.recommendation === "skip") current.assistant?.setStatus(`建议先跳过：${response.result.reason}`);
      else await autoFillCurrent(current, requestId, selectedStyle);
    } catch (error) {
      current.generating = false;
      if (active?.requestId === requestId) { current.assistant?.setStatus(localizeError(error.message || "")); current.assistant?.showRetry(); }
    }
  }
  function handleAction(action, data) {
    if (!active) return;
    const current = active;
    if (action === "dismiss") {
      current.cancelled = true; current.dismissed = true;
      current.observer?.disconnect();
      try { current.editor?.removeEventListener("input", current.onComposerInput, true); } catch {}
      void safeSend({ type: "REPLY_COPILOT_CANCEL", requestId: current.requestId });
      current.assistant = null;
      return;
    }
    if (!hasRuntimeContext()) return;
    if (action === "sidepanel") { void safeSend({ type: "REPLY_COPILOT_OPEN_SIDEPANEL", sourceText: current.post?.sourceText, sourceUrl: current.post?.sourceUrl }); return; }
    if (action === "settings") { void safeSend({ type: "REPLY_COPILOT_OPEN_SETTINGS" }); return; }
    if (action === "position_changed") { void safeSend({ type: "REPLY_COPILOT_SET_FLOATING_POSITION", left: data.left, top: data.top }); return; }
    if (action === "generate") { void generateActive(current.requestId); return; }
    if (action === "regenerate") {
      void safeSend({ type: "REPLY_COPILOT_CANCEL", requestId: current.requestId });
      const requestId = crypto.randomUUID();
      current.requestId = requestId; current.generated = false;
      current.assistant?.showLoading("正在重新生成…");
      void generateActive(requestId);
      return;
    }
    if (action === "selected" || action === "select") { record("selected", data); return; }
    if (action === "copied") { record("copied", data); return; }
    if (action === "feedback") { void safeSend({ type: "REPLY_COPILOT_FEEDBACK", requestId: current.requestId, ...data }); return; }
    if (action === "manually_confirmed") { record("manually_confirmed", data); return; }
  }
  function onRuntimeMessage(message) {
    if (!hasRuntimeContext()) return false;
    if (message?.type !== "REPLY_COPILOT_SETTINGS_CHANGED" || !active?.editor?.isConnected) return false;
    const current = active, requestId = current.requestId;
    void safeSend({ type: "REPLY_COPILOT_GET_BEHAVIOR" }).then((response) => {
      if (!contextAlive) return;
      if (!active || active.requestId !== requestId || !response?.ok) return;
      if (!response.preferences.autoGenerateOnReply && current.generating && !current.generated) {
        void safeSend({ type: "REPLY_COPILOT_CANCEL", requestId: current.requestId });
        current.requestId = crypto.randomUUID(); current.generating = false;
      }
      remountAssistant(current, response.preferences);
    }).catch(() => {});
    return false;
  }
  try { chrome.runtime.onMessage.addListener(onRuntimeMessage); } catch { stopInvalidContext(); return; }
  function onDocumentClick(event) {
    if (!hasRuntimeContext()) return;
    if (!event.isTrusted) return;
    const control = api.replyDetector.findReplyControl(event.target);
    if (!control || control.closest("[data-zane-reply-copilot]")) return;
    const article = control.closest("article");
    const post = api.postExtractor.extractPost(article);
    if (!post.ok) {
      if (active?.requestId) void safeSend({ type: "REPLY_COPILOT_CANCEL", requestId: active.requestId });
      try { active?.editor?.removeEventListener("input", active.onComposerInput, true); } catch {}
      active?.observer?.disconnect(); active?.assistant?.close?.();
      active = { requestId: crypto.randomUUID(), post: { article, sourceText: "", sourceUrl: "" }, assistant: null };
      showFallback("无法准确识别这条帖子，因此未发送文本给 AI。", article || control.parentElement || control);
      return;
    }
    begin(control, post);
  }
  document.addEventListener("click", onDocumentClick, true);
})();
