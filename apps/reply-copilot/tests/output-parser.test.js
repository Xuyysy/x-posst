import test from "node:test";
import assert from "node:assert/strict";
import { parseAIOutput } from "../utils/output-parser.js";
import { validOutput } from "./helpers.js";

test("parses valid JSON and quote response", () => { assert.equal(parseAIOutput(JSON.stringify(validOutput)).score, 91); const q = { ...validOutput, recommendation: "quote", quote_candidate: "A standalone take." }; assert.equal(parseAIOutput(JSON.stringify(q)).quote_candidate, "A standalone take."); });
test("rejects invalid JSON and invalid response fields", () => {
  for (const value of ["no", {}, { ...validOutput, recommendation: "replyy" }, { ...validOutput, score: -1 }, { ...validOutput, score: 101 }, { ...validOutput, score: 2.5 }, { ...validOutput, best_reply_style: "long" }, { ...validOutput, replies: { ...validOutput.replies, sharp: "" } }, { ...validOutput, replies: { ...validOutput.replies, funny: " " } }, { ...validOutput, replies: { sharp: "ok", funny: "ok" } }, { ...validOutput, recommendation: "quote", quote_candidate: null }]) assert.throws(() => parseAIOutput(typeof value === "string" ? value : JSON.stringify(value)));
});
