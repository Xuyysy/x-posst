(() => {
  function isReplyControl(element) {
    if (!element?.matches?.('button,[role="button"],a')) return false;
    const label = `${element.getAttribute("aria-label") || ""} ${element.getAttribute("data-testid") || ""} ${element.innerText || element.textContent || ""}`.trim().toLowerCase();
    return /(^|\s)(reply|回复)(\s|$)/i.test(label) || /reply/.test(element.getAttribute("aria-label") || "") || element.getAttribute("data-testid") === "reply";
  }
  function findReplyControl(target) {
    const control = target?.closest?.('button,[role="button"],a');
    return isReplyControl(control) ? control : null;
  }
  globalThis.ZaneReplyCopilotContent ||= {};
  globalThis.ZaneReplyCopilotContent.replyDetector = { isReplyControl, findReplyControl };
})();
