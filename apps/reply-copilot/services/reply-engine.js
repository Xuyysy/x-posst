import { validateSourceText } from "../utils/validation.js";
import { buildPrompts } from "../prompts/prompt-builder.js";
import { ZANE_PERSONA } from "../prompts/persona.js";
import { parseAIOutput } from "../utils/output-parser.js";

export class ReplyEngine {
  constructor({ aiClient, historyService, persona = ZANE_PERSONA }) { this.aiClient = aiClient; this.historyService = historyService; this.persona = persona; }
  async generate(request) {
    const validRequest = { ...request, sourceText: validateSourceText(request?.sourceText) };
    const recentHistory = await this.historyService.getRecent(20);
    const styleStats = await this.historyService.getStats();
    const prompts = buildPrompts({ request: validRequest, persona: this.persona, recentHistory, styleStats });
    return parseAIOutput(await this.aiClient.generateReplyAnalysis(prompts));
  }
}
