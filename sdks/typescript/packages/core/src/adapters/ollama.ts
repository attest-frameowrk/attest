import type { Trace } from "../proto/types.js";
import { TraceBuilder } from "../trace.js";

interface OllamaResponse {
  model?: string;
  message?: { content?: string };
  eval_count?: number;
  prompt_eval_count?: number;
}

export class OllamaAdapter {
  private readonly agentId: string | undefined;

  constructor(agentId?: string) {
    this.agentId = agentId;
  }

  traceFromResponse(
    response: OllamaResponse,
    options?: {
      inputMessages?: Record<string, unknown>[];
      latencyMs?: number;
    },
  ): Trace {
    const builder = new TraceBuilder(this.agentId);

    if (options?.inputMessages) {
      builder.setInput({ messages: options.inputMessages });
    }

    const completionText = response.message?.content ?? "";

    builder.addLlmCall("completion", {
      args: { model: response.model ?? "" },
      result: { completion: completionText },
    });

    builder.setOutput({ message: completionText });

    let totalTokens: number | undefined;
    if (response.eval_count !== undefined && response.prompt_eval_count !== undefined) {
      totalTokens = response.eval_count + response.prompt_eval_count;
    }

    builder.setMetadata({
      total_tokens: totalTokens,
      latency_ms: options?.latencyMs,
      model: response.model,
    });

    return builder.build();
  }
}
