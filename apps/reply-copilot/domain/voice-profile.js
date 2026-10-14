export const VOICE_PROFILE_SCHEMA_VERSION = 1;
export const VOICE_TONES = Object.freeze(["relaxed_friendly", "balanced_thoughtful", "confident_direct"]);
export const VOICE_LANGUAGES = Object.freeze(["auto", "zh", "en"]);
export const REPLY_LENGTHS = Object.freeze(["short", "medium", "adaptive"]);
export const HUMOR_LEVELS = Object.freeze(["low", "medium", "high"]);

export const DEFAULT_VOICE_PROFILE = Object.freeze({
  schemaVersion: VOICE_PROFILE_SCHEMA_VERSION,
  name: "My Voice",
  tone: "relaxed_friendly",
  language: "auto",
  replyLength: "adaptive",
  humorLevel: "medium",
  interests: [],
  writingSamples: [],
  customInstructions: "",
  updatedAt: null,
});

export function createZaneVoiceProfile() {
  return {
    ...DEFAULT_VOICE_PROFILE,
    name: "Zane",
    interests: ["AI", "Programming", "Startups", "Fitness", "Creator life", "Internet culture"],
    writingSamples: [
      "我越来越觉得，账号做到最后拼的不是谁最专业。是谁最容易被记住。",
      "AI 把“我有个想法”这句话的含金量打下来了。现在得接一句：做出来了吗？",
      "程序员半夜最危险的四个字：顺手重构。",
      "男人最容易被低估的资产：一个随时能拿出来卖钱的技能。",
      "薄肌有一种很隐蔽的虚荣：嘴上说随便练练，衣服却越买越合身。",
    ],
    customInstructions: "Keep replies natural, warm, conversational, and occasionally playful. Do not force punchlines or disagreement.",
    updatedAt: null,
  };
}

export function validateVoiceProfile(input) {
  const fail = () => { throw new Error("Voice Profile is invalid. Review the fields and try again."); };
  if (!input || typeof input !== "object" || Array.isArray(input)) fail();
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 60) : "";
  const interests = Array.isArray(input.interests) ? input.interests.map((item) => String(item).trim()).filter(Boolean).slice(0, 12) : [];
  const writingSamples = Array.isArray(input.writingSamples) ? input.writingSamples.map((item) => String(item).trim()).filter(Boolean).slice(0, 10) : [];
  if (!name || !VOICE_TONES.includes(input.tone) || !VOICE_LANGUAGES.includes(input.language) || !REPLY_LENGTHS.includes(input.replyLength) || !HUMOR_LEVELS.includes(input.humorLevel)) fail();
  if (interests.some((item) => item.length > 60) || writingSamples.some((item) => item.length > 1000)) fail();
  if (typeof input.customInstructions !== "string" || input.customInstructions.length > 1000) fail();
  return {
    schemaVersion: VOICE_PROFILE_SCHEMA_VERSION,
    name,
    tone: input.tone,
    language: input.language,
    replyLength: input.replyLength,
    humorLevel: input.humorLevel,
    interests,
    writingSamples,
    customInstructions: input.customInstructions.trim(),
    updatedAt: new Date().toISOString(),
  };
}
