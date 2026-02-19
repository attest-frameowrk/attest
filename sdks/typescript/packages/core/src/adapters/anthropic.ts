import type { Trace } from "../proto/types.js";
import { TraceBuilder } from "../trace.js";

interface AnthropicTextBlock {
  type: "text";
  text: string;
}

interface AnthropicToolUseBlock {
  type: "tool_use";
  name: string;
  input: Record<string, unknown>;
}

type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock;

interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

interface AnthropicMessage {
  model?: string;
  usage?: AnthropicUsage;
  content: AnthropicContentBlock[];
}

export class AnthropicAdapter {
  private readonly agentId: string | undefined;

  constructor(agentId?: string) {
    this.agentId = agentId;
  }

  traceFromResponse(
    response: AnthropicMessage,
    options?: {
      inputMessages?: Record<string, unknown>[];
      costUsd?: number;
      latencyMs?: number;
    },
  ): Trace {
    const builder = new TraceBuilder(this.agentId);

    if (options?.inputMessages) {
      builder.setInput({ messages: options.inputMessages });
    }

    const completionParts: string[] = [];
    for (const block of response.content) {
      if (block.type === "text") {
        completionParts.push(block.text);
      } else if (block.type === "tool_use") {
        builder.addToolCall(block.name, {
          args: block.input,
        });
      }
    }

    const completionText = completionParts.join("\n");

    const stepArgs: Record<string, unknown> = {};
    if (response.model !== undefined) stepArgs.model = response.model;

    builder.addLlmCall("completion", { args: stepArgs, result: { completion: completionText } });
    builder.setOutput({ message: completionText });

    let totalTokens: number | undefined;
    if (response.usage) {
      totalTokens = response.usage.input_tokens + response.usage.output_tokens;
    }

    builder.setMetadata({
      total_tokens: totalTokens,
      cost_usd: options?.costUsd,
      latency_ms: options?.latencyMs,
      model: response.model,
    });

    return builder.build();
  }
}
