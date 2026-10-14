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
  const isLegacy = !data.defaultStyle && (typeof data.best_reply_style === "string" || typeof data.default_style === "string");
  const legacyStyle = data.best_reply_style || data.default_style;
  const defaultStyle = isLegacy ? LEGACY_STYLE_MAP[legacyStyle] : data.defaultStyle;
  if (!REPLY_STYLES.includes(defaultStyle)) fail();
  const replies = isLegacy ? (data.replies.sharp || data.replies.funny ? {
    natural: data.replies.natural,
    light_humor: data.replies.funny,
    thoughtful: data.replies.sharp,
  } : data.replies) : data.replies;
  for (const style of REPLY_STYLES) if (typeof replies[style] !== "string" || !replies[style].trim()) fail();
  if (data.score !== undefined && (!Number.isInteger(data.score) || data.score < 0 || data.score > 100)) fail();
  const language = isLegacy && data.language === undefined ? "auto" : data.language;
  if (!(["auto", "zh", "en"].includes(language))) fail();
  if (!isLegacy && !Object.hasOwn(data, "quoteCandidate") && !Object.hasOwn(data, "quote_candidate")) fail();
  const quoteCandidate = data.quoteCandidate ?? data.quote_candidate ?? null;
  if (data.recommendation === "quote" && (typeof quoteCandidate !== "string" || !quoteCandidate.trim())) fail();
  if (data.recommendation !== "quote" && quoteCandidate !== null && typeof quoteCandidate !== "string") fail();
  if (data.recommendation !== "quote" && typeof quoteCandidate === "string" && !quoteCandidate.trim()) fail();
  return { recommendation: data.recommendation, defaultStyle, default_style: defaultStyle, best_reply_style: defaultStyle, language, reason: data.reason.trim(), score: data.score ?? null, replies: Object.fromEntries(REPLY_STYLES.map((s) => [s, replies[s].trim()])), quoteCandidate: quoteCandidate?.trim() || null, quote_candidate: quoteCandidate?.trim() || null };
}
