import test from "node:test";
import assert from "node:assert/strict";
import { DeepSeekClient } from "../services/deepseek-client.js";
import { DeepSeekAPIError, DeepSeekTimeoutError, InvalidAIResponseError } from "../utils/errors.js";

const ok = (content = "{}") => ({ ok: true, async json() { return { choices: [{ message: { content } }] }; } });
test("sends official JSON chat completion request", async () => {
  let call; const client = new DeepSeekClient({ apiKey: "test-key", fetchImpl: async (...args) => { call = args; return ok(); } });
  assert.equal(await client.generateReplyAnalysis({ system: "json", user: "input" }), "{}");
  const body = JSON.parse(call[1].body); assert.equal(body.model, "deepseek-flash"); assert.deepEqual(body.response_format, { type: "json_object" }); assert.equal(body.thinking.type, "disabled"); assert.equal(call[1].headers.Authorization, "Bearer test-key");
});
test("calls fetch with the global receiver required by browser APIs", async () => {
  let receiver;
  const fetchImpl = function () { receiver = this; return Promise.resolve(ok()); };
  const client = new DeepSeekClient({ apiKey: "test-key", fetchImpl });
  await client.generateReplyAnalysis({ system: "json", user: "input" });
  assert.equal(receiver, globalThis);
});
test("maps HTTP failures, timeouts and network failures", async () => {
  for (const [status, msg] of [[401, /invalid/], [429, /rate limit/], [500, /temporarily unavailable/]]) {
    const client = new DeepSeekClient({ apiKey: "x", fetchImpl: async () => ({ ok: false, status }) }); await assert.rejects(client.generateReplyAnalysis({}), msg);
  }
  const timeout = new DeepSeekClient({ apiKey: "x", timeoutMs: 5, fetchImpl: (_url, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error(), { name: "AbortError" })))) });
  await assert.rejects(timeout.generateReplyAnalysis({}), DeepSeekTimeoutError);
  const network = new DeepSeekClient({ apiKey: "x", fetchImpl: async () => { throw new Error(); } }); await assert.rejects(network.generateReplyAnalysis({}), /Could not reach api\.deepseek\.com/);
});
test("rejects malformed response and empty content", async () => {
  for (const data of [{ choices: [] }, { choices: [{ message: { content: " " } }] }]) {
    const client = new DeepSeekClient({ apiKey: "x", fetchImpl: async () => ({ ok: true, async json() { return data; } }) });
    await assert.rejects(client.generateReplyAnalysis({}), InvalidAIResponseError);
  }
});
