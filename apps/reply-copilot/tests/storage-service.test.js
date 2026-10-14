import test from "node:test";
import assert from "node:assert/strict";
import { StorageService, LEGACY_AUTO_FILL_KEY, BEHAVIOR_PREFERENCES_KEY } from "../services/storage-service.js";

test("unsafe legacy auto-fill preference is removed on extension update", async () => {
  const values = { [LEGACY_AUTO_FILL_KEY]: true };
  const area = { async get(key) { return { [key]: values[key] }; }, async set(items) { Object.assign(values, items); }, async remove(key) { delete values[key]; } };
  const service = new StorageService({ local: area, session: area });
  await service.disableLegacyAutoFill();
  assert.equal(LEGACY_AUTO_FILL_KEY in values, false);
});

test("behavior settings use Chinese UI defaults and persist shared reply/overlay preferences", async () => {
  const values = {};
  const area = { async get(key) { return typeof key === "string" ? { [key]: values[key] } : Object.fromEntries(key.map((item) => [item, values[item]])); }, async set(items) { Object.assign(values, items); }, async remove(key) { delete values[key]; } };
  const service = new StorageService({ local: area, session: area });
  const defaults = await service.getBehaviorPreferences();
  assert.equal(defaults.defaultReplyMode, "natural"); assert.equal(defaults.autoGenerateOnReply, true); assert.equal(defaults.showFloatingWindow, true);
  await service.setBehaviorPreferences({ defaultReplyMode: "thoughtful", autoGenerateOnReply: false, floatingPosition: { left: 180, top: 90 } });
  const reopened = new StorageService({ local: area, session: area }); const saved = await reopened.getBehaviorPreferences();
  assert.equal(saved.defaultReplyMode, "thoughtful"); assert.equal(saved.autoGenerateOnReply, false); assert.deepEqual(saved.floatingPosition, { left: 180, top: 90 });
  assert.ok(values[BEHAVIOR_PREFERENCES_KEY]);
  await reopened.resetFloatingPosition(); assert.equal((await service.getBehaviorPreferences()).floatingPosition, null);
});
