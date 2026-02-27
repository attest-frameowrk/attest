import type { Trace } from "../proto/types.js";

export interface TraceAdapter {
  traceFromResponse(response: unknown, options?: Record<string, unknown>): Trace;
}

export { ManualAdapter } from "./manual.js";
export { OpenAIAdapter } from "./openai.js";
export { AnthropicAdapter } from "./anthropic.js";
export { GeminiAdapter } from "./gemini.js";
export { OllamaAdapter } from "./ollama.js";
export { OTelAdapter } from "./otel.js";
export { LangChainAdapter } from "./langchain.js";
