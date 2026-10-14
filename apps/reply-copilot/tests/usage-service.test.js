import test from "node:test";
import assert from "node:assert/strict";
import { UsageService } from "../services/usage-service.js";
import { memoryStorage } from "./helpers.js";

test("local usage summary counts generation, feedback, copies and failures without publication claims", async () => {
  const store = memoryStorage(); let now = Date.parse("2026-10-14T10:00:00Z");
  const usage = new UsageService(store, () => new Date(now).toISOString());
  await usage.track("generated", { requestId: "a" }); await usage.track("copied", { requestId: "a" });
  await usage.track("feedback_good", { requestId: "a", style: "natural" }); await usage.track("api_failure");
  now -= 9 * 24 * 60 * 60 * 1000; await usage.track("generated", { requestId: "old" });
  const summary = await usage.getSummary(Date.parse("2026-10-14T10:00:00Z"));
  assert.equal(summary.totalGenerations, 2); assert.equal(summary.last7DaysGenerations, 1);
  assert.equal(summary.copies, 1); assert.equal(summary.feedbackGood, 1); assert.equal(summary.apiFailures, 1);
  assert.equal("published" in summary, false);
});
