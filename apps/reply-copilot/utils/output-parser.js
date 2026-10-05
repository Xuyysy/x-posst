import { InvalidAIResponseError } from "./errors.js";
import { RECOMMENDATIONS, REPLY_STYLES } from "../domain/reply-result.js";

export function parseAIOutput(content) {
  let data;
  try { data = JSON.parse(content); } catch { throw new InvalidAIResponseError("DeepSeek returned invalid JSON. Try again."); }
  const fail = () => { throw new InvalidAIResponseError("DeepSeek returned an invalid structured response. Try again."); };
  if (!data || typeof data !== "object" || Array.isArray(data)) fail();
  if (!RECOMMENDATIONS.includes(data.recommendation)) fail();
  if (!Number.isInteger(data.score) || data.score < 0 || data.score > 100) fail();
  if (typeof data.reason !== "string" || !data.reason.trim()) fail();
  if (!REPLY_STYLES.includes(data.best_reply_style)) fail();
  if (!data.replies || typeof data.replies !== "object" || Array.isArray(data.replies)) fail();
  for (const style of REPLY_STYLES) if (typeof data.replies[style] !== "string" || !data.replies[style].trim()) fail();
  if (data.recommendation === "quote" && (typeof data.quote_candidate !== "string" || !data.quote_candidate.trim())) fail();
  if (data.recommendation !== "quote" && data.quote_candidate !== null && typeof data.quote_candidate !== "string") fail();
  if (data.recommendation !== "quote" && typeof data.quote_candidate === "string" && !data.quote_candidate.trim()) fail();
  return { recommendation: data.recommendation, score: data.score, reason: data.reason.trim(), best_reply_style: data.best_reply_style, replies: Object.fromEntries(REPLY_STYLES.map((s) => [s, data.replies[s].trim()])), quote_candidate: data.quote_candidate?.trim() || null };
}
