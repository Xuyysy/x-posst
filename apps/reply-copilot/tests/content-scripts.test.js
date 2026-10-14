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

test("composer adapter locates the X editor and exposes no DOM writer", async () => {
  const editor = { isConnected: true, innerText: "existing user draft", closest: () => null };
  const { composerAdapter } = await loadContent("composer-adapter", { document: { querySelector: () => null } });
  const article = { querySelectorAll: () => [editor] };
  assert.equal(composerAdapter.findComposer(article), editor);
  assert.equal(composerAdapter.readText(editor), "existing user draft");
  for (const method of ["fillIfSafe", "replaceOnExplicitClick", "replaceExactDoubleInsertion"]) assert.equal(composerAdapter[method], undefined);
  const source = await readFile(new URL("../content/composer-adapter.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /execCommand|dispatchEvent|replaceChildren|insertNode|innerHTML\s*=|innerText\s*=|textContent\s*=/);
});

test("composer adapter focuses an empty editor and places the caret without inserting text", async () => {
  const editor = { isConnected: true, innerText: "", contains: (node) => node === editor };
  const selection = { anchorNode: null, removeAllRanges() {}, addRange() { this.anchorNode = editor; } };
  const document = { activeElement: null, createRange: () => ({ selectNodeContents() {}, collapse() {} }) };
  editor.focus = () => { document.activeElement = editor; };
  const { composerAdapter } = await loadContent("composer-adapter", { document, window: { getSelection: () => selection } });
  assert.equal(composerAdapter.focusEmpty(editor), true);
  assert.equal(editor.innerText, "");
  editor.innerText = "user draft";
  assert.equal(composerAdapter.focusEmpty(editor), false);
  assert.equal(editor.innerText, "user draft");
});

test("inline assistant cycles its cached candidates without regenerating", async () => {
  const { inlineAssistant } = await loadContent("inline-assistant", { chrome: { runtime: { getURL: (path) => path } } });
  assert.equal(inlineAssistant.nextCandidateIndex(0, 3), 1);
  assert.equal(inlineAssistant.nextCandidateIndex(2, 3), 0);
  assert.equal(inlineAssistant.nextCandidateIndex(0, 0), 0);
});

test("inline assistant exposes copy and no composer mutation actions", async () => {
  const source = await readFile(new URL("../content/inline-assistant.js", import.meta.url), "utf8");
  const content = await readFile(new URL("../content/content-script.js", import.meta.url), "utf8");
  assert.match(source, /data-action="copy"/);
  assert.doesNotMatch(source, /data-action="(?:fill|replace)"/);
  assert.doesNotMatch(content, /composerAdapter\.(?:fillIfSafe|replaceOnExplicitClick|insertOnce)|action === "(?:fill|replace)"/);
});

test("controlled editor fixture models input state and a later rerender", async () => {
  const fixture = await readFile(new URL("./fixtures/controlled-composer.html", import.meta.url), "utf8");
  assert.match(fixture, /contenteditable="true"/);
  assert.match(fixture, /editor\.addEventListener\("input"/);
  assert.match(fixture, /模拟框架重渲染/);
  assert.match(fixture, /model = editor\.innerText/);
});

test("persona keeps the earlier posts as references while allowing simple natural replies", async () => {
  const { ZANE_PERSONA } = await import("../prompts/persona.js");
  assert.equal(ZANE_PERSONA.postStyleExamples.length >= 3, true);
  assert.match(ZANE_PERSONA.postStyleGuidance, /references only/i);
  assert.match(ZANE_PERSONA.humor, /empathy comes first/i);
});
