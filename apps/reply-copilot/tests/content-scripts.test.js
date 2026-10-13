import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

async function loadContent(name, context = {}) {
  const source = await readFile(new URL(`../content/${name}.js`, import.meta.url), "utf8");
  const sandbox = { globalThis: {}, URL, ...context };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox);
  return sandbox.ZaneReplyCopilotContent;
}

test("reply detector accepts a user-facing Reply control and rejects unrelated buttons", async () => {
  const { replyDetector } = await loadContent("reply-detector");
  const reply = { matches: (selector) => selector.includes("button"), getAttribute: (name) => name === "aria-label" ? "Reply" : "", textContent: "" };
  const like = { ...reply, getAttribute: (name) => name === "aria-label" ? "Like" : "" };
  assert.equal(replyDetector.isReplyControl(reply), true);
  assert.equal(replyDetector.isReplyControl(like), false);
});

test("post extractor fails closed without exact post text and URL", async () => {
  const { postExtractor } = await loadContent("post-extractor", { location: { href: "https://x.com/home" } });
  assert.equal(postExtractor.extractPost(null).reason, "no-post");
  const article = { matches: () => true, querySelectorAll: () => [] };
  assert.equal(postExtractor.extractPost(article).ok, false);
});

test("composer adapter refuses unsafe or non-empty autofill and verifies a guarded insertion", async () => {
  const editor = { isConnected: true, innerText: "", focus() {}, replaceChildren(node) { this.innerText = node.textContent; }, dispatchEvent() {} };
  const { composerAdapter } = await loadContent("composer-adapter", { Event, document: { createTextNode: (textContent) => ({ textContent }), execCommand: (_command, _ui, text) => { editor.innerText = `${text}${text}`; return true; } } });
  const base = { editor, text: "draft", enabled: true, userGesture: true, requestCurrent: true, matchedPost: true, userTyped: false };
  assert.equal(composerAdapter.fillIfSafe({ ...base, enabled: false }).ok, false);
  assert.equal(composerAdapter.fillIfSafe({ ...base, userTyped: true }).ok, false);
  const firstFill = composerAdapter.fillIfSafe(base);
  assert.equal(firstFill.ok, true);
  assert.equal(firstFill.correctedDisplayDuplicate, true);
  assert.equal(editor.innerText, "draft");
  assert.equal(composerAdapter.fillIfSafe(base).alreadyPresent, true);
  editor.innerText = "existing";
  assert.equal(composerAdapter.fillIfSafe(base).ok, false);
});

test("inline assistant cycles its cached candidates without regenerating", async () => {
  const { inlineAssistant } = await loadContent("inline-assistant", { chrome: { runtime: { getURL: (path) => path } } });
  assert.equal(inlineAssistant.nextCandidateIndex(0, 3), 1);
  assert.equal(inlineAssistant.nextCandidateIndex(2, 3), 0);
  assert.equal(inlineAssistant.nextCandidateIndex(0, 0), 0);
});

test("persona keeps the earlier posts as references while allowing simple natural replies", async () => {
  const { ZANE_PERSONA } = await import("../prompts/persona.js");
  assert.equal(ZANE_PERSONA.postStyleExamples.length >= 3, true);
  assert.match(ZANE_PERSONA.postStyleGuidance, /references only/i);
  assert.match(ZANE_PERSONA.humor, /empathy comes first/i);
});
