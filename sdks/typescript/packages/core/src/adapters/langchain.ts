import type { Trace } from "../proto/types.js";
import { TraceBuilder } from "../trace.js";

/**
 * Minimal type definitions for `@langchain/core` callback handler.
 * These avoid a hard dependency on `@langchain/core` — the actual types
 * are checked at runtime when the user provides real LangChain objects.
 */

interface LangChainLLMResult {
  generations: Array<Array<{ text: string; [key: string]: unknown }>>;
  llmOutput?: Record<string, unknown>;
}

interface LangChainToolEnd {
  name?: string;
  output: string;
  [key: string]: unknown;
}

interface LangChainChainValues {
  [key: string]: unknown;
}

interface AccumulatedLLMCall {
  name: string;
  text: string;
  tokens?: number;
  model?: string;
}

interface AccumulatedToolCall {
  name: string;
  output: string;
}

export class LangChainAdapter {
  private readonly agentId: string | undefined;
  private readonly llmCalls: AccumulatedLLMCall[] = [];
  private readonly toolCalls: AccumulatedToolCall[] = [];
  private chainOutput: string = "";
  private startTime: number = 0;

  constructor(agentId?: string) {
    this.agentId = agentId;
  }

  /**
   * Reset accumulated state for a new trace capture session.
   */
  reset(): void {
    this.llmCalls.length = 0;
    this.toolCalls.length = 0;
    this.chainOutput = "";
    this.startTime = 0;
  }

  /**
   * Call this when a chain starts (maps to `handleChainStart`).
   */
  handleChainStart(): void {
    if (this.startTime === 0) {
      this.startTime = Date.now();
    }
  }

  /**
   * Call this when an LLM call completes (maps to `handleLLMEnd`).
   */
  handleLLMEnd(output: LangChainLLMResult): void {
    const text = output.generations[0]?.[0]?.text ?? "";
    const tokens = output.llmOutput?.["tokenUsage"] as
      | { totalTokens?: number }
      | undefined;
    const model = output.llmOutput?.["modelName"] as string | undefined;

    this.llmCalls.push({
      name: "completion",
      text,
      tokens: tokens?.totalTokens,
      model,
    });
  }

  /**
   * Call this when a tool call completes (maps to `handleToolEnd`).
   */
  handleToolEnd(output: string, metadata?: LangChainToolEnd): void {
    this.toolCalls.push({
      name: metadata?.name ?? "unknown_tool",
      output,
    });
  }

  /**
   * Call this when a chain completes (maps to `handleChainEnd`).
   */
  handleChainEnd(output: LangChainChainValues): void {
    const text = output["output"] ?? output["text"] ?? output["result"];
    if (typeof text === "string") {
      this.chainOutput = text;
    }
  }

  /**
   * Build a Trace from accumulated callback events.
   *
   * @param options.costUsd - Total cost override.
   * @param options.model - Model name override.
   * @returns A finalized Trace object.
   */
  buildTrace(options?: { costUsd?: number; model?: string }): Trace {
    const builder = new TraceBuilder(this.agentId);
    const latencyMs = this.startTime > 0 ? Date.now() - this.startTime : undefined;

    let totalTokens: number | undefined;

    for (const llm of this.llmCalls) {
      const args: Record<string, unknown> = {};
      if (llm.model ?? options?.model) args.model = llm.model ?? options?.model;

      const result: Record<string, unknown> = { completion: llm.text };
      if (llm.tokens !== undefined) {
        result.tokens = llm.tokens;
        totalTokens = (totalTokens ?? 0) + llm.tokens;
      }

      builder.addLlmCall(llm.name, { args, result });
    }

    for (const tool of this.toolCalls) {
      builder.addToolCall(tool.name, {
        result: { output: tool.output },
      });
    }

    const outputMessage =
      this.chainOutput ||
      (this.llmCalls.length > 0 ? this.llmCalls[this.llmCalls.length - 1].text : "");

    builder.setOutput({ message: outputMessage });
    builder.setMetadata({
      total_tokens: totalTokens,
      cost_usd: options?.costUsd,
      latency_ms: latencyMs,
      model: options?.model ?? this.llmCalls[0]?.model,
    });

    return builder.build();
  }
}
