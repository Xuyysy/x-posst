import test from "node:test";
import assert from "node:assert/strict";
import { VoiceProfileService, VOICE_PROFILE_KEY } from "../services/voice-profile-service.js";
import { DEFAULT_VOICE_PROFILE, createZaneVoiceProfile, validateVoiceProfile } from "../domain/voice-profile.js";
import { memoryStorage } from "./helpers.js";

test("default Voice Profile is valid and generic", () => {
  assert.deepEqual(validateVoiceProfile(DEFAULT_VOICE_PROFILE).name, "My Voice");
  assert.deepEqual(DEFAULT_VOICE_PROFILE.writingSamples, []);
});

test("profile saves, reloads, and removes an individual writing sample", async () => {
  const store = memoryStorage(), service = new VoiceProfileService(store);
  const custom = await service.save({ ...DEFAULT_VOICE_PROFILE, name: "Ari", language: "zh", writingSamples: ["先留个真实的样本"] });
  assert.equal((await service.get()).name, "Ari");
  assert.equal((await service.removeWritingSample(0)).writingSamples.length, 0);
  assert.ok(store.data[VOICE_PROFILE_KEY]);
});

test("legacy migration is idempotent and preserves legacy user data", async () => {
  const store = memoryStorage(), service = new VoiceProfileService(store);
  const first = await service.migrateLegacy({ apiKeyExists: true });
  const again = await service.migrateLegacy({ apiKeyExists: true });
  assert.equal(first.profile.name, "Zane"); assert.equal(again.migrated, false);
  assert.equal(again.profile.name, "Zane");
});

test("invalid profile values are rejected and stored corrupt profile falls back", async () => {
  assert.throws(() => validateVoiceProfile({ ...DEFAULT_VOICE_PROFILE, tone: "unknown" }));
  const store = memoryStorage(); store.data[VOICE_PROFILE_KEY] = { tone: "bad" };
  assert.equal((await new VoiceProfileService(store).get()).name, "My Voice");
});
