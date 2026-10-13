import test from "node:test";
import assert from "node:assert/strict";
import { buildPrompts } from "../prompts/prompt-builder.js";
import { ZANE_PERSONA } from "../prompts/persona.js";

test("prompt includes persona, input, history, JSON schema and natural style guidance", () => {
  const prompts = buildPrompts({ request: { sourceText: "Selected post", sourceUrl: "https://x.com/a" }, persona: ZANE_PERSONA, recentHistory: [{ reply: "Recent copy", style: "sharp" }] });
  for (const fragment of ["Zane's personal reply copilot", "Selected post", "Recent copy", "账号做到最后拼的不是谁最专业", "emotionally present", "friendly and engaging", "Sound like someone typing a reply in the moment", "Avoid the recognizable AI rhythm", "naturally become curious about Zane's profile", "Return valid JSON", "reply, quote, or skip", "Natural & Friendly", "Bold"]) assert.ok(`${prompts.system}\n${prompts.user}`.includes(fragment));
  assert.ok(!`${prompts.system}${prompts.user}`.includes("Bearer "));
});
