import type { Trace } from "./proto/types.js";
import { AgentResult } from "./result.js";
import { TraceBuilder } from "./trace.js";
import { activeBuilder } from "./context.js";

export class Agent {
  readonly name: string;
  private readonly fn: ((builder: TraceBuilder, args: Record<string, unknown>) => unknown) | undefined;

  constructor(
    name: string,
    fn?: (builder: TraceBuilder, args: Record<string, unknown>) => unknown,
  ) {
    this.name = name;
    this.fn = fn;
  }

  run(args: Record<string, unknown> = {}): AgentResult {
    if (this.fn === undefined) {
      throw new Error("No agent function provided. Pass fn to Agent().");
    }

    const builder = new TraceBuilder(this.name);
    builder.setInput(args);

    const output = activeBuilder.run(builder, () => this.fn!(builder, args));
    this.setOutput(builder, output);

    return new AgentResult(builder.build());
  }

  async arun(args: Record<string, unknown> = {}): Promise<AgentResult> {
    if (this.fn === undefined) {
      throw new Error("No agent function provided. Pass fn to Agent().");
    }

    const builder = new TraceBuilder(this.name);
    builder.setInput(args);

    const output = await activeBuilder.run(builder, async () => this.fn!(builder, args));
    this.setOutput(builder, output);

    return new AgentResult(builder.build());
  }

  private setOutput(builder: TraceBuilder, output: unknown): void {
    if (output !== null && output !== undefined && typeof output === "object" && !Array.isArray(output)) {
      builder.setOutput(output as Record<string, unknown>);
    } else if (output !== undefined) {
      builder.setOutput({ result: output });
    } else {
      builder.setOutput({ result: null });
    }
  }

  withTrace(trace: Trace): AgentResult {
    return new AgentResult(trace);
  }
}

export function agent(
  name: string,
  fn: (builder: TraceBuilder, args: Record<string, unknown>) => unknown,
): (args?: Record<string, unknown>) => AgentResult {
  const wrapped = new Agent(name, fn);

  const wrapper = (args?: Record<string, unknown>): AgentResult => {
    return wrapped.run(args ?? {});
  };

  (wrapper as unknown as Record<string, unknown>).agent = wrapped;
  return wrapper;
}
