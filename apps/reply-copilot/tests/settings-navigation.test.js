import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
test("floating settings gear routes through the background to the existing Options page", async () => {
  const floating = await read("../content/inline-assistant.js");
  const content = await read("../content/content-script.js");
  const worker = await read("../background/service-worker.js");
  const manifest = JSON.parse(await read("../manifest.json"));
  assert.match(floating, /data-action="settings"[^>]*title="打开设置"/);
  assert.match(content, /type: "REPLY_COPILOT_OPEN_SETTINGS"/);
  assert.match(worker, /chrome\.runtime\.openOptionsPage\(\)/);
  assert.equal(manifest.options_page, "options/options.html");
  assert.doesNotMatch(content, /location\.(?:href|assign)\s*=/);
});

test("reply composer uses the native input path with a copy fallback", async () => {
  const floating = await read("../content/inline-assistant.js");
  const content = await read("../content/content-script.js");
  const worker = await read("../background/service-worker.js");
  const options = await read("../options/options.html");
  const manifest = JSON.parse(await read("../manifest.json"));
  assert.match(floating, /data-action="copy"/);
  assert.doesNotMatch(floating, /data-action="(?:fill|replace)"/);
  assert.match(content, /REPLY_COPILOT_INPUT_PREPARE/);
  assert.match(content, /REPLY_COPILOT_INPUT_COMMIT/);
  assert.match(worker, /NativeInputService/);
  assert.match(options, /自动填入/);
  assert.ok(manifest.permissions.includes("debugger"));
});

test("settings navigation and user-facing page use Chinese labels", async () => {
  const html = await read("../options/options.html");
  assert.match(html, /lang="zh-CN"/);
  for (const label of ["我的风格", "回复偏好", "AI 配置", "插件行为", "历史与数据", "关于插件"]) assert.ok(html.includes(label));
  assert.match(html, /id="toggle-key"[^>]*>显示</);
  assert.match(html, /id="reset-position"[^>]*>重置位置</);
});
