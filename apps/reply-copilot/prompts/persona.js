import { createZaneVoiceProfile } from "../domain/voice-profile.js";

export const ZANE_VOICE_PROFILE = Object.freeze(createZaneVoiceProfile());
// Backward-compatible alias for older code and integrations.
export const ZANE_PERSONA = Object.freeze({ ...ZANE_VOICE_PROFILE, identity: "Zane", topics: ZANE_VOICE_PROFILE.interests, voice: "Relaxed, friendly, conversational", humor: "Empathy comes first; use humor gently and only when it fits.", postStyleGuidance: "Use prior posts as references only, not as reply templates.", postStyleExamples: ZANE_VOICE_PROFILE.writingSamples });
