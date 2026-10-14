import { DEFAULT_VOICE_PROFILE, createZaneVoiceProfile, validateVoiceProfile } from "../domain/voice-profile.js";

export const VOICE_PROFILE_KEY = "voiceProfile";
export const PROFILE_MIGRATION_KEY = "voiceProfileSchemaVersion";

export class VoiceProfileService {
  constructor(storage = globalThis.chrome?.storage?.local, clock = () => new Date().toISOString()) { this.storage = storage; this.clock = clock; }
  async get() {
    const stored = (await this.storage.get(VOICE_PROFILE_KEY))[VOICE_PROFILE_KEY];
    if (!stored) return structuredClone(DEFAULT_VOICE_PROFILE);
    try { return validateVoiceProfile(stored); } catch { return structuredClone(DEFAULT_VOICE_PROFILE); }
  }
  async save(profile) {
    const valid = validateVoiceProfile({ ...profile, updatedAt: this.clock() });
    valid.updatedAt = this.clock();
    await this.storage.set({ [VOICE_PROFILE_KEY]: valid, [PROFILE_MIGRATION_KEY]: 1 });
    return valid;
  }
  async reset() { const profile = { ...structuredClone(DEFAULT_VOICE_PROFILE), updatedAt: this.clock() }; await this.storage.set({ [VOICE_PROFILE_KEY]: profile, [PROFILE_MIGRATION_KEY]: 1 }); return profile; }
  async addWritingSample(sample) {
    const profile = await this.get();
    if (profile.writingSamples.length >= 10) throw new Error("You can save up to 10 writing samples.");
    const value = String(sample || "").trim();
    if (!value || value.length > 1000) throw new Error("A writing sample must be between 1 and 1,000 characters.");
    return this.save({ ...profile, writingSamples: [...profile.writingSamples, value] });
  }
  async removeWritingSample(index) {
    const profile = await this.get();
    if (!Number.isInteger(index) || index < 0 || index >= profile.writingSamples.length) return profile;
    return this.save({ ...profile, writingSamples: profile.writingSamples.filter((_, position) => position !== index) });
  }
  async migrateLegacy({ apiKeyExists = false, historyExists = false } = {}) {
    const values = await this.storage.get([VOICE_PROFILE_KEY, PROFILE_MIGRATION_KEY]);
    if (values[PROFILE_MIGRATION_KEY] === 1) return { migrated: false, profile: values[VOICE_PROFILE_KEY] || null };
    if (values[VOICE_PROFILE_KEY]) {
      await this.storage.set({ [PROFILE_MIGRATION_KEY]: 1 });
      return { migrated: false, profile: values[VOICE_PROFILE_KEY] };
    }
    const profile = apiKeyExists || historyExists ? createZaneVoiceProfile() : structuredClone(DEFAULT_VOICE_PROFILE);
    profile.updatedAt = this.clock();
    await this.storage.set({ [VOICE_PROFILE_KEY]: profile, [PROFILE_MIGRATION_KEY]: 1 });
    return { migrated: true, profile };
  }
}
