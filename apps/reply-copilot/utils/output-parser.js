import { InvalidAIResponseError } from "./errors.js";
import { DEFAULT_REPLY_STYLE, RECOMMENDATIONS, REPLY_STYLES } from "../domain/reply-result.js";

const LEGACY_STYLE_MAP = Object.freeze({ natural: "natural", funny: "light_humor", sharp: "thoughtful" });

export function parseAIOutput(content) {
  let data;
  try { data = JSON.parse(content); } catch { throw new InvalidAIResponseError("DeepSeek returned invalid JSON. Try again."); }
  const fail = () => { throw new InvalidAIResponseError("DeepSeek returned an invalid structured response. Try again."); };
  if (!data || typeof data !== "object" || Array.isArray(data)) fail();
  if (!RECOMMENDATIONS.includes(data.recommendation)) fail();
  if (typeof data.reason !== "string" || !data.reason.trim()) fail();
  if (!data.replies || typeof data.replies !== "object" || Array.isArray(data.replies)) fail();
  const isLegacy = !data.default_style && typeof data.best_reply_style === "string";
  const defaultStyle = isLegacy ? LEGACY_STYLE_MAP[data.best_reply_style] : (data.default_style || DEFAULT_REPLY_STYLE);
  if (!REPLY_STYLES.includes(defaultStyle)) fail();
  const replies = isLegacy ? {
    natural: data.replies.natural,
    light_humor: data.replies.funny,
    thoughtful: data.replies.sharp,
  } : data.replies;
  for (const style of REPLY_STYLES) if (typeof replies[style] !== "string" || !replies[style].trim()) fail();
  if (data.score !== undefined && (!Number.isInteger(data.score) || data.score < 0 || data.score > 100)) fail();
  if (data.recommendation === "quote" && (typeof data.quote_candidate !== "string" || !data.quote_candidate.trim())) fail();
  if (data.recommendation !== "quote" && data.quote_candidate !== null && typeof data.quote_candidate !== "string") fail();
  if (data.recommendation !== "quote" && typeof data.quote_candidate === "string" && !data.quote_candidate.trim()) fail();
  return { recommendation: data.recommendation, score: data.score ?? null, reason: data.reason.trim(), default_style: defaultStyle, best_reply_style: defaultStyle, replies: Object.fromEntries(REPLY_STYLES.map((s) => [s, replies[s].trim()])), quote_candidate: data.quote_candidate?.trim() || null };
}
