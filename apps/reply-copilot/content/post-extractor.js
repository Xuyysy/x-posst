(() => {
  const STATUS_HOSTS = new Set(["x.com", "twitter.com"]);
  function extractPost(article) {
    if (!article?.matches?.("article")) return { ok: false, reason: "no-post" };
    let statusUrl = "";
    for (const anchor of article.querySelectorAll('a[href*="/status/"]')) {
      if (anchor.closest("article") !== article) continue;
      try {
        const url = new URL(anchor.href, location.href);
        if (STATUS_HOSTS.has(url.hostname) && /\/[^/]+\/status\/\d+/.test(url.pathname)) {
          statusUrl = `${url.origin}${url.pathname}`;
          break;
        }
      } catch { /* malformed link */ }
    }
    const textNodes = [...article.querySelectorAll('[data-testid="tweetText"]')].filter((node) => node.closest("article") === article);
    const sourceText = textNodes.map((node) => node.innerText?.trim()).filter(Boolean).join("\n").trim();
    if (!statusUrl || !sourceText) return { ok: false, reason: "post-context-incomplete" };
    return { ok: true, article, sourceUrl: statusUrl, sourceText, statusId: statusUrl.match(/status\/(\d+)/)?.[1] || "" };
  }
  globalThis.ZaneReplyCopilotContent ||= {};
  globalThis.ZaneReplyCopilotContent.postExtractor = { extractPost };
})();
