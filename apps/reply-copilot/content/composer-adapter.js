(() => {
  function findComposer(article) {
    const selectors = '[contenteditable="true"][role="textbox"], [data-testid="tweetTextarea_0"][contenteditable="true"]';
    let candidates = [...(article?.querySelectorAll?.(selectors) || [])];
    if (!candidates.length) candidates = [...(document.querySelector('[role="dialog"]')?.querySelectorAll?.(selectors) || [])];
    candidates = [...new Set(candidates)].filter((node) => node.isConnected && !node.closest('[aria-hidden="true"]'));
    return candidates.length === 1 ? candidates[0] : null;
  }
  function readText(editor) { return (editor?.innerText ?? editor?.textContent ?? "").replace(/\u00a0/g, " ").trim(); }
  function focusEmpty(editor) {
    if (!editor?.isConnected || readText(editor)) return false;
    editor.focus();
    if (document.activeElement !== editor || readText(editor)) return false;
    const selection = window.getSelection();
    if (!selection) return false;
    if (!editor.contains(selection.anchorNode)) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return editor.contains(selection.anchorNode);
  }

  // This adapter only reads the composer and places the caret. The service
  // worker sends text through Chrome's Input domain, never by rewriting DOM.
  globalThis.ZaneReplyCopilotContent ||= {};
  globalThis.ZaneReplyCopilotContent.composerAdapter = { findComposer, readText, focusEmpty };
})();
