(() => {
  function findComposer(article) {
    const selectors = '[contenteditable="true"][role="textbox"], [data-testid="tweetTextarea_0"][contenteditable="true"]';
    let candidates = [...(article?.querySelectorAll?.(selectors) || [])];
    if (!candidates.length) candidates = [...(document.querySelector('[role="dialog"]')?.querySelectorAll?.(selectors) || [])];
    candidates = [...new Set(candidates)].filter((node) => node.isConnected && !node.closest('[aria-hidden="true"]'));
    return candidates.length === 1 ? candidates[0] : null;
  }
  function readText(editor) { return (editor?.innerText ?? editor?.textContent ?? "").replace(/\u00a0/g, " ").trim(); }
  function normalizeForDuplicateCheck(value) { return value.normalize("NFC").replace(/[\s\u200b-\u200d\ufeff]/g, ""); }
  function isEmpty(editor) { return readText(editor) === ""; }
  function collapseExactDoubleInsertion(editor, text) {
    const expected = normalizeForDuplicateCheck(text.trim());
    const actual = normalizeForDuplicateCheck(readText(editor));
    if (!expected || actual !== expected + expected || typeof editor.replaceChildren !== "function" || typeof document.createTextNode !== "function") return false;
    editor.replaceChildren(document.createTextNode(text.trim()));
    const InputEventConstructor = globalThis.InputEvent || globalThis.Event;
    editor.dispatchEvent(new InputEventConstructor("input", { bubbles: true, inputType: "insertText", data: text.trim() }));
    return normalizeForDuplicateCheck(readText(editor)) === expected;
  }
  function fillIfSafe({ editor, text, requestId, enabled, userGesture, requestCurrent, matchedPost, userTyped }) {
    if (!enabled || !userGesture || !requestCurrent || !matchedPost || userTyped || !editor?.isConnected || !text) return { ok: false, reason: "safety-check-failed" };
    if ((requestId && editor.dataset?.zaneReplyCopilotFilled === requestId) || readText(editor) === text.trim()) return { ok: true, alreadyPresent: true };
    if (!isEmpty(editor)) return { ok: false, reason: "safety-check-failed" };
    editor.focus();
    const inserted = document.execCommand?.("insertText", false, text) === true;
    if (inserted && readText(editor) === text.trim()) { if (editor.dataset && requestId) editor.dataset.zaneReplyCopilotFilled = requestId; return { ok: true }; }
    if (inserted && collapseExactDoubleInsertion(editor, text)) { if (editor.dataset && requestId) editor.dataset.zaneReplyCopilotFilled = requestId; return { ok: true, correctedDisplayDuplicate: true }; }
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
  globalThis.ZaneReplyCopilotContent.composerAdapter = { findComposer, readText, isEmpty, fillIfSafe, replaceOnExplicitClick, collapseExactDoubleInsertion };
})();
