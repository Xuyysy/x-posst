export const MAX_SOURCE_LENGTH = 10_000;
export function validateSourceText(sourceText) {
  if (typeof sourceText !== "string" || !sourceText.trim()) throw new Error("Select some text on X and right-click ‘Generate Zane Reply’.");
  const value = sourceText.trim();
  if (value.length > MAX_SOURCE_LENGTH) throw new Error("Selected text is too long. Please select only the relevant post content.");
  return value;
}
