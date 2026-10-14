import { validateSourceText } from "../utils/validation.js";
import { buildPrompts } from "../prompts/prompt-builder.js";
import { DEFAULT_VOICE_PROFILE } from "../domain/voice-profile.js";
import { parseAIOutput } from "../utils/output-parser.js";

export class ReplyEngine {
  constructor({ aiClient, historyService, voiceProfile = null, persona = null, usageService = null }) { this.aiClient = aiClient; this.historyService = historyService; this.voiceProfile = voiceProfile; this.persona = persona; this.usageService = usageService; }
  async generateReplies({ postContext, voiceProfile = this.voiceProfile, recentHistory, requestId = "" }, { replyStyle = "natural-friendly", signal, styleStats } = {}) {
    const sourceText = validateSourceText(postContext?.text || postContext?.sourceText);
    const request = { sourceText, sourceUrl: postContext?.url || postContext?.sourceUrl || "", requestId };
    const selectedHistory = recentHistory || await this.historyService.getRecent(20);
    const selectedStats = styleStats || await this.historyService.getStats();
    const prompts = buildPrompts({ postContext: { text: sourceText, url: request.sourceUrl }, voiceProfile: voiceProfile || (this.persona ? undefined : DEFAULT_VOICE_PROFILE), persona: this.persona, recentHistory: selectedHistory, styleStats: selectedStats, replyStyle });
    const generate = this.aiClient.generateReplies || this.aiClient.generateReplyAnalysis;
    const raw = await generate.call(this.aiClient, { ...prompts, signal, requestId });
    return parseAIOutput(raw);
  }
  async generate(request, options = {}) { return this.generateReplies({ postContext: request, requestId: request?.requestId || "" }, options); }
}
