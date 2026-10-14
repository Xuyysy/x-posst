import test from "node:test";
import assert from "node:assert/strict";
import { NativeInputService } from "../services/native-input-service.js";

test("native input commits once and detaches after inserting", async () => {
  const calls = [];
  const service = new NativeInputService({
    async attach(target, version) { calls.push(["attach", target.tabId, version]); },
    async sendCommand(target, command, params) { calls.push(["send", target.tabId, command, params.text]); },
    async detach(target) { calls.push(["detach", target.tabId]); }
  });
  assert.equal(await service.prepare(7, "request-1"), true);
  assert.equal(await service.prepare(7, "request-1"), false);
  assert.equal(await service.commit(7, "request-1", "一条回复"), true);
  assert.equal(await service.prepare(7, "request-1"), false);
  assert.equal(await service.commit(7, "request-1", "一条回复"), false);
  assert.deepEqual(calls, [["attach", 7, "1.3"], ["send", 7, "Input.insertText", "一条回复"], ["detach", 7]]);
});

test("native input failure is never retried for the same request", async () => {
  let sends = 0, detaches = 0;
  const service = new NativeInputService({
    async attach() {},
    async sendCommand() { sends++; throw Error("disconnected"); },
    async detach() { detaches++; }
  });
  assert.equal(await service.prepare(8, "request-2"), true);
  assert.equal(await service.commit(8, "request-2", "reply"), false);
  assert.equal(await service.prepare(8, "request-2"), false);
  assert.equal(sends, 1);
  assert.equal(detaches, 1);
});
