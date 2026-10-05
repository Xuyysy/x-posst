import test from "node:test";
import assert from "node:assert/strict";
import { ReplyEngine } from "../services/reply-engine.js";
import { validOutput } from "./helpers.js";

test("engine passes persona and history into the AI client and parses result", async () => {
  let input; let persona;
  const engine = new ReplyEngine({ aiClient: { async generateReplyAnalysis(value) { input = value; return JSON.stringify(validOutput); } }, historyService: { async getRecent() { return [{ reply: "chosen" }]; }, async getStats() { return {}; } }, persona: { identity: "Zane" } });
  persona = engine.persona;
  const result = await engine.generate({ sourceText: "Post text" });
  assert.equal(result.recommendation, "reply"); assert.ok(input.system.includes(persona.identity)); assert.ok(input.user.includes("chosen"));
});
test("engine validates request and propagates AI errors", async () => {
  const historyService = { async getRecent() { return []; }, async getStats() { return {}; } };
  const engine = new ReplyEngine({ aiClient: { async generateReplyAnalysis() { throw new Error("network"); } }, historyService });
  await assert.rejects(engine.generate({ sourceText: "  " }), /Select some text/);
  await assert.rejects(engine.generate({ sourceText: "ok" }), /network/);
});
