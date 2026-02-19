import type { Trace } from "../proto/types.js";
import { TraceBuilder } from "../trace.js";

interface GeminiFunctionCall {
  name: string;
  args?: Record<string, unknown>;
}

interface GeminiPart {
  text?: string;
  functionCall?: GeminiFunctionCall;
}

interface GeminiCandidate {
  content: { parts: GeminiPart[] };
}

interface GeminiResponse {
  text?: string;
  candidates?: GeminiCandidate[];
}

export class GeminiAdapter {
  private readonly agentId: string | undefined;

  constructor(agentId?: string) {
    this.agentId = agentId;
  }

  traceFromResponse(
    response: GeminiResponse,
    options?: {
      inputText?: string;
      costUsd?: number;
      latencyMs?: number;
      model?: string;
    },
  ): Trace {
    const builder = new TraceBuilder(this.agentId);

    if (options?.inputText) {
      builder.setInput({ text: options.inputText });
    }

    let completionText = "";
    if (response.text != null) {
      completionText = response.text;
    } else if (response.candidates && response.candidates.length > 0) {
      completionText = response.candidates[0].content.parts
        .filter((p) => p.text != null)
        .map((p) => p.text!)
        .join("");
    }

    if (response.candidates && response.candidates.length > 0) {
      for (const part of response.candidates[0].content.parts) {
        if (part.functionCall) {
          builder.addToolCall(part.functionCall.name, {
            args: part.functionCall.args ?? {},
          });
        }
      }
    }

    builder.addLlmCall("completion", { result: { completion: completionText } });
    builder.setOutput({ message: completionText });

    builder.setMetadata({
      cost_usd: options?.costUsd,
      latency_ms: options?.latencyMs,
      model: options?.model,
    });

    return builder.build();
  }
}
