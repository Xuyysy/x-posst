export class InvalidAIResponseError extends Error { constructor(message = "DeepSeek returned an invalid response.") { super(message); this.name = "InvalidAIResponseError"; } }
export class DeepSeekTimeoutError extends Error { constructor() { super("Request timed out. Try again."); this.name = "DeepSeekTimeoutError"; } }
export class DeepSeekAPIError extends Error { constructor(message, status = 0) { super(message); this.name = "DeepSeekAPIError"; this.status = status; } }
