import type { Trace } from "../proto/types.js";
import { TraceBuilder } from "../trace.js";

export class ManualAdapter {
  private readonly agentId: string | undefined;

  constructor(agentId?: string) {
    this.agentId = agentId;
  }

  capture(builderFn: (builder: TraceBuilder) => void): Trace {
    const builder = new TraceBuilder(this.agentId);
    builderFn(builder);
    return builder.build();
  }

  createBuilder(): TraceBuilder {
    return new TraceBuilder(this.agentId);
  }
}
