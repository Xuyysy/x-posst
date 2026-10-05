import { validateSourceText } from "../utils/validation.js";

/** Build the short-lived request created by an explicit context-menu action. */
export function createReplyRequest({ sourceText, sourceUrl = "", requestId = crypto.randomUUID(), createdAt = new Date().toISOString() }) {
  return { requestId, sourceText: validateSourceText(sourceText), sourceUrl, createdAt };
}
