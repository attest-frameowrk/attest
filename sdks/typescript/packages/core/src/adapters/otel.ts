import type { Trace } from "../proto/types.js";
import { TraceBuilder } from "../trace.js";

interface OTelSpanContext {
  traceId: string;
}

interface OTelSpan {
  name: string;
  startTime: [number, number]; // [seconds, nanoseconds]
  endTime: [number, number];
  attributes?: Record<string, unknown>;
  parentSpanId?: string;
  spanContext(): OTelSpanContext;
}

export class OTelAdapter {
  private readonly agentId: string | undefined;

  constructor(agentId?: string) {
    this.agentId = agentId;
  }

  static fromSpans(spans: OTelSpan[], agentId?: string): Trace {
    const adapter = new OTelAdapter(agentId);
    return adapter.buildTrace(spans);
  }

  private buildTrace(spans: OTelSpan[]): Trace {
    const sorted = [...spans].sort((a, b) => {
      const aTime = a.startTime[0] * 1e9 + a.startTime[1];
      const bTime = b.startTime[0] * 1e9 + b.startTime[1];
      return aTime - bTime;
    });

    const builder = new TraceBuilder(this.agentId);
    const rootSpan = this.findRootSpan(sorted);

    if (rootSpan) {
      const traceId = rootSpan.spanContext().traceId;
      if (traceId) {
        builder.setTraceId(`otel_${traceId.slice(0, 16)}`);
      }
    }

    let outputMessage = "";
    let totalTokens: number | undefined;
    let latencyMs: number | undefined;
    let model: string | undefined;

    for (const span of sorted) {
      const attrs = span.attributes ?? {};
      const stepType = this.classifySpan(attrs, span.name);

      if (stepType === "llm_call") {
        const [stepArgs, stepResult] = this.extractLlmStep(attrs);
        builder.addLlmCall(span.name, {
          args: stepArgs,
          result: stepResult,
          metadata: this.spanMetadata(span),
        });

        const completion = attrs["gen_ai.completion"];
        if (completion) outputMessage = String(completion);

        const inputTokens = Number(attrs["gen_ai.usage.input_tokens"] ?? 0);
        const outputTokens = Number(attrs["gen_ai.usage.output_tokens"] ?? 0);
        const spanTokens = inputTokens + outputTokens;
        if (spanTokens > 0) totalTokens = (totalTokens ?? 0) + spanTokens;

        if (model === undefined) {
          const responseModel = attrs["gen_ai.response.model"];
          const requestModel = attrs["gen_ai.request.model"];
          if (responseModel) model = String(responseModel);
          else if (requestModel) model = String(requestModel);
        }
      } else if (stepType === "tool_call") {
        const [stepArgs, stepResult] = this.extractToolStep(attrs);
        const toolName = String(attrs["gen_ai.tool.name"] ?? span.name);
        builder.addToolCall(toolName, {
          args: stepArgs,
          result: stepResult,
          metadata: this.spanMetadata(span),
        });
      }
    }

    if (rootSpan) {
      const startNs = rootSpan.startTime[0] * 1e9 + rootSpan.startTime[1];
      const endNs = rootSpan.endTime[0] * 1e9 + rootSpan.endTime[1];
      latencyMs = Math.floor((endNs - startNs) / 1_000_000);
    }

    builder.setOutput({ message: outputMessage });
    builder.setMetadata({ total_tokens: totalTokens, latency_ms: latencyMs, model });

    return builder.build();
  }

  private findRootSpan(spans: OTelSpan[]): OTelSpan | undefined {
    for (const span of spans) {
      if (!span.parentSpanId) return span;
    }
    return spans[0];
  }

  private classifySpan(attrs: Record<string, unknown>, name: string): string | undefined {
    const op = String(attrs["gen_ai.operation.name"] ?? "");
    if (op === "chat" || op === "completion" || op === "generate_content" || "gen_ai.completion" in attrs) {
      return "llm_call";
    }
    if (op === "tool" || "gen_ai.tool.name" in attrs) {
      return "tool_call";
    }
    const lower = name.toLowerCase();
    if (lower.includes("completion") || lower.includes("chat")) return "llm_call";
    if (lower.includes("tool")) return "tool_call";
    return undefined;
  }

  private extractLlmStep(attrs: Record<string, unknown>): [Record<string, unknown>, Record<string, unknown>] {
    const args: Record<string, unknown> = {};
    const result: Record<string, unknown> = {};

    if ("gen_ai.request.model" in attrs) args.model = String(attrs["gen_ai.request.model"]);
    if ("gen_ai.system" in attrs) args.system = String(attrs["gen_ai.system"]);
    if ("gen_ai.prompt" in attrs) args.prompt = String(attrs["gen_ai.prompt"]);

    if ("gen_ai.completion" in attrs) result.completion = String(attrs["gen_ai.completion"]);
    if ("gen_ai.usage.input_tokens" in attrs) result.input_tokens = Number(attrs["gen_ai.usage.input_tokens"]);
    if ("gen_ai.usage.output_tokens" in attrs) result.output_tokens = Number(attrs["gen_ai.usage.output_tokens"]);
    if ("gen_ai.response.model" in attrs) result.model = String(attrs["gen_ai.response.model"]);

    return [args, result];
  }

  private extractToolStep(attrs: Record<string, unknown>): [Record<string, unknown>, Record<string, unknown>] {
    const args: Record<string, unknown> = {};
    const result: Record<string, unknown> = {};

    if ("gen_ai.tool.call.id" in attrs) args.call_id = String(attrs["gen_ai.tool.call.id"]);
    if ("gen_ai.tool.parameters" in attrs) args.parameters = attrs["gen_ai.tool.parameters"];
    if ("gen_ai.tool.output" in attrs) result.output = attrs["gen_ai.tool.output"];

    return [args, result];
  }

  private spanMetadata(span: OTelSpan): Record<string, unknown> {
    const startNs = span.startTime[0] * 1e9 + span.startTime[1];
    const endNs = span.endTime[0] * 1e9 + span.endTime[1];
    return { duration_ms: Math.floor((endNs - startNs) / 1_000_000) };
  }
}
