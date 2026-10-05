import test from "node:test";
import assert from "node:assert/strict";
import { HistoryService } from "../services/history-service.js";
import { HISTORY_KEY } from "../services/storage-service.js";
import { memoryStorage } from "./helpers.js";

test("adds selected copy, returns recent, caps at 100, stats and clear", async () => {
  const storage = memoryStorage(); let n = 0; const service = new HistoryService(storage, () => `t${++n}`);
  await service.addSelectedReply({ requestId: "r", sourceText: "post", reply: "reply", style: "sharp", recommendation: "reply" });
  assert.equal((await service.getRecent(1))[0].reply, "reply");
  for (let i = 0; i < 100; i++) await service.addSelectedReply({ requestId: `r${i}`, sourceText: "p", reply: `${i}`, style: i % 2 ? "funny" : "natural", recommendation: "reply" });
  const all = await service.getAll(); assert.equal(all.length, 100); assert.equal(all[0].reply, "0");
  const stats = await service.getStats(); assert.equal(stats.sharp, 0); assert.equal(stats.funny + stats.natural, 100);
  await service.clearHistory(); assert.deepEqual(await service.getAll(), []); assert.equal(storage.data[HISTORY_KEY], undefined);
});
