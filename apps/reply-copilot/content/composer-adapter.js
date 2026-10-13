(() => {
  function findComposer(article) {
    const selectors = '[contenteditable="true"][role="textbox"], [data-testid="tweetTextarea_0"][contenteditable="true"]';
    let candidates = [...(article?.querySelectorAll?.(selectors) || [])];
    if (!candidates.length) candidates = [...(document.querySelector('[role="dialog"]')?.querySelectorAll?.(selectors) || [])];
    candidates = [...new Set(candidates)].filter((node) => node.isConnected && !node.closest('[aria-hidden="true"]'));
    return candidates.length === 1 ? candidates[0] : null;
  }
  function readText(editor) { return (editor?.innerText ?? editor?.textContent ?? "").replace(/\u00a0/g, " ").trim(); }
  function isEmpty(editor) { return readText(editor) === ""; }
  function fillIfSafe({ editor, text, enabled, userGesture, requestCurrent, matchedPost, userTyped }) {
    if (!enabled || !userGesture || !requestCurrent || !matchedPost || userTyped || !editor?.isConnected || !isEmpty(editor) || !text) return { ok: false, reason: "safety-check-failed" };
    editor.focus();
    const inserted = document.execCommand?.("insertText", false, text) === true;
    if (inserted && readText(editor) === text.trim()) return { ok: true };
    return { ok: false, reason: "insertion-not-confirmed" };
  }
  function replaceOnExplicitClick({ editor, text, userGesture, matchedPost }) {
    if (!userGesture || !matchedPost || !editor?.isConnected || !text) return { ok: false, reason: "safety-check-failed" };
    editor.focus();
    const selection = window.getSelection();
    const range = document.createRange(); range.selectNodeContents(editor);
    selection?.removeAllRanges(); selection?.addRange(range);
    const inserted = document.execCommand?.("insertText", false, text) === true;
    if (inserted && readText(editor) === text.trim()) return { ok: true };
    return { ok: false, reason: "insertion-not-confirmed" };
  }
  globalThis.ZaneReplyCopilotContent ||= {};
  globalThis.ZaneReplyCopilotContent.composerAdapter = { findComposer, readText, isEmpty, fillIfSafe, replaceOnExplicitClick };
})();
