import test from "node:test";
import assert from "node:assert/strict";
import { StorageService, AUTO_FILL_KEY } from "../services/storage-service.js";

test("automatic fill follows the enabled default and persists an explicit preference", async () => {
  const values = {};
  const area = { async get(key) { return { [key]: values[key] }; }, async set(items) { Object.assign(values, items); }, async remove(key) { delete values[key]; } };
  const service = new StorageService({ local: area, session: area });
  assert.equal(await service.getAutoFillEnabled(), true);
  await service.setAutoFillEnabled(false);
  assert.equal(values[AUTO_FILL_KEY], false);
  assert.equal(await service.getAutoFillEnabled(), false);
});
