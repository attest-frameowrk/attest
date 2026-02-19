import type { Trace } from "../proto/types.js";
import { TraceBuilder } from "../trace.js";

interface OpenAIUsage {
  total_tokens?: number;
}

interface OpenAIToolCall {
  function: { name: string; arguments: string };
}

interface OpenAIMessage {
  content: string | null;
  tool_calls?: OpenAIToolCall[];
}

interface OpenAIChoice {
  message: OpenAIMessage;
}

interface OpenAIChatCompletion {
  model?: string;
  usage?: OpenAIUsage;
  choices: OpenAIChoice[];
}

export class OpenAIAdapter {
  private readonly agentId: string | undefined;

  constructor(agentId?: string) {
    this.agentId = agentId;
  }

  traceFromResponse(
    response: OpenAIChatCompletion,
    options?: {
      inputMessages?: Record<string, unknown>[];
      costUsd?: number;
      latencyMs?: number;
      structuredOutput?: Record<string, unknown>;
    },
  ): Trace {
    const builder = new TraceBuilder(this.agentId);

    if (options?.inputMessages) {
      builder.setInput({ messages: options.inputMessages });
    }

    const message = response.choices[0].message;
    const completionText = message.content ?? "";

    const stepArgs: Record<string, unknown> = {};
    if (response.model !== undefined) stepArgs.model = response.model;

    const stepResult: Record<string, unknown> = { completion: completionText };
    if (response.usage?.total_tokens !== undefined) {
      stepResult.tokens = response.usage.total_tokens;
    }

    builder.addLlmCall("completion", { args: stepArgs, result: stepResult });

    if (message.tool_calls) {
      for (const tc of message.tool_calls) {
        builder.addToolCall(tc.function.name, {
          args: { arguments: tc.function.arguments },
        });
      }
    }

    builder.setOutput({
      message: completionText,
      structured: options?.structuredOutput ?? {},
    });

    builder.setMetadata({
      total_tokens: response.usage?.total_tokens,
      cost_usd: options?.costUsd,
      latency_ms: options?.latencyMs,
      model: response.model,
    });

    return builder.build();
  }
}
