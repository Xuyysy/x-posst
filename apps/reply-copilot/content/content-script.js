(() => {
  const api = globalThis.ZaneReplyCopilotContent;
  let active = null;
  const isX = /^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\//.test(location.href);
  if (!isX) return;

  function record(eventName, data = {}) {
    if (!active) return;
    void chrome.runtime.sendMessage({ type: "REPLY_COPILOT_HISTORY", requestId: active.requestId, sourceText: active.post.sourceText, sourceUrl: active.post.sourceUrl, event: eventName, ...data }).catch(() => {});
  }
  function matchedComposer(post) {
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
    if (active?.requestId) void chrome.runtime.sendMessage({ type: "REPLY_COPILOT_CANCEL", requestId: active.requestId }).catch(() => {});
    if (active?.observer) active.observer.disconnect();
    if (active?.assistant?.host?.isConnected) active.assistant.host.remove();
    const requestId = crypto.randomUUID();
    active = { requestId, post, control, editor: null, assistant: null, userTyped: false, generated: false, previousApplied: "", cancelled: false };
    const setTimeoutId = setTimeout(() => {
      active?.observer?.disconnect();
      if (active?.requestId === requestId && !active.assistant) showFallback("没有找到与这条帖子明确关联的回复框。请用侧边栏继续。", post.article);
    }, 9000);
    const locate = () => {
      if (!active || active.requestId !== requestId || active.cancelled) return false;
      const found = matchedComposer(post);
      if (!found.editor || !found.matchedPost) return false;
      clearTimeout(setTimeoutId); active.editor = found.editor; active.matchedPost = found.matchedPost;
      active.assistant = api.inlineAssistant.mount(found.editor.parentElement || found.editor, handleAction);
      found.editor.addEventListener("input", () => { if (active?.requestId === requestId) { active.userTyped = true; if (active.generated) active.assistant?.showReplaceAction(); } }, { signal: active.abortController.signal });
      active.observer?.disconnect(); active.observer = null;
      void generateActive(requestId, true);
      return true;
    };
    active.abortController = new AbortController();
    if (!locate()) {
      const observer = new MutationObserver(() => { if (locate()) observer.disconnect(); });
      active.observer = observer;
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["contenteditable", "role"] });
    }
  }
  function showFallback(message, anchor) {
    const fallback = api.inlineAssistant.mount(anchor, handleAction);
    active.assistant = fallback; fallback.setStatus(message);
  }
  async function generateActive(requestId, allowAutoFill = false) {
    const current = active;
    if (!current || current.requestId !== requestId) return;
    if (!current.editor?.isConnected || !current.matchedPost) { showFallback("无法准确识别原帖和回复框，未生成或填入内容。", current.post.article); return; }
    try {
      const response = await chrome.runtime.sendMessage({ type: "REPLY_COPILOT_GENERATE", requestId, sourceText: current.post.sourceText, sourceUrl: current.post.sourceUrl });
      if (!active || active.requestId !== requestId || !active.editor?.isConnected) return;
      if (!response?.ok) throw new Error(response?.error || "生成失败，请打开侧边栏重试。");
      current.generated = true; current.autoFill = allowAutoFill && response.autoFillEnabled === true; current.result = response.result;
      current.assistant.showResult(response.result.replies, response.result.default_style || "natural", current.autoFill);
      if (response.result.recommendation === "skip") current.assistant.setStatus(`建议先跳过：${response.result.reason}`);
      if (current.autoFill && response.result.recommendation !== "skip") {
        const text = response.result.replies[response.result.default_style || "natural"];
        const fillResult = api.composerAdapter.fillIfSafe({ editor: current.editor, text, enabled: true, userGesture: true, requestCurrent: active?.requestId === requestId, matchedPost: current.matchedPost, userTyped: current.userTyped });
        if (fillResult.ok) { current.previousApplied = text.trim(); current.applied = true; current.assistant.setStatus("草稿已填入；检查后由你手动发送。"); record("applied", { style: response.result.default_style || "natural", reply: text }); }
        else current.assistant.setStatus("已生成草稿；没有改动回复框。你可以复制或手动填入。");
      }
    } catch (error) {
      if (active?.requestId === requestId) current.assistant?.setStatus(error.message || "生成失败。请打开侧边栏重试。");
    }
  }
  function handleAction(action, data) {
    if (!active) return;
    const current = active;
    if (action === "sidepanel") { void chrome.runtime.sendMessage({ type: "REPLY_COPILOT_OPEN_SIDEPANEL" }); return; }
    if (action === "regenerate") {
      const requestId = crypto.randomUUID();
      current.requestId = requestId; current.generated = false; current.userTyped = false; current.autoFill = false;
      current.assistant.setStatus("正在重新生成…");
      void generateActive(requestId, false);
      return;
    }
    if (action === "selected" || action === "select") { record("selected", data); return; }
    if (action === "manually_confirmed") { record("manually_confirmed", data); return; }
    if (action === "fill") {
      const result = api.composerAdapter.fillIfSafe({ editor: current.editor, text: data.reply, enabled: current.autoFill, userGesture: true, requestCurrent: active === current, matchedPost: current.matchedPost, userTyped: current.userTyped });
      if (result.ok) { current.previousApplied = data.reply.trim(); current.applied = true; record("applied", data); current.assistant.setStatus("草稿已填入；检查后由你手动发送。"); }
      else current.assistant.setStatus("没有改动回复框。请复制草稿后手动粘贴。");
    }
    if (action === "replace") {
      const result = api.composerAdapter.replaceOnExplicitClick({ editor: current.editor, text: data.reply, userGesture: true, matchedPost: current.matchedPost });
      if (result.ok) { current.previousApplied = data.reply.trim(); current.applied = true; record("applied", data); current.assistant.setStatus("已按你的确认替换草稿；请检查后手动发送。"); }
      else current.assistant.setStatus("替换没有成功，原有内容保持不变。");
    }
  }
  document.addEventListener("click", (event) => {
    if (!event.isTrusted) return;
    const control = api.replyDetector.findReplyControl(event.target);
    if (!control || control.closest("[data-zane-reply-copilot]")) return;
    const article = control.closest("article");
    const post = api.postExtractor.extractPost(article);
    if (!post.ok) { active = { requestId: crypto.randomUUID(), post: { article, sourceText: "", sourceUrl: "" }, assistant: null }; showFallback("无法准确识别这条帖子，因此没有发送文本给 AI。请用侧边栏手动选择内容。", article || document.body); return; }
    begin(control, post);
  }, true);
})();
