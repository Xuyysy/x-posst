export function memoryStorage() {
  const data = {};
  return { data, async get(key) { return typeof key === "string" ? { [key]: data[key] } : Object.fromEntries(key.map((k) => [k, data[k]])); }, async set(values) { Object.assign(data, values); }, async remove(key) { delete data[key]; } };
}
export const validOutput = { recommendation: "reply", score: 91, reason: "Good room for a fresh take.", best_reply_style: "sharp", replies: { sharp: "A sharper angle.", funny: "A small joke.", natural: "A casual thought." }, quote_candidate: null };
