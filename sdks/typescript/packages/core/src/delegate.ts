import { STEP_AGENT_CALL } from "./proto/constants.js";
import { TraceBuilder } from "./trace.js";
import { activeBuilder } from "./context.js";

export async function delegate(
  agentId: string,
  fn: (child: TraceBuilder) => Promise<void> | void,
): Promise<void> {
  const parent = activeBuilder.getStore();
  if (parent === undefined) {
    throw new Error(
      "delegate() must be used within an Agent.run() context. " +
      "No active TraceBuilder found.",
    );
  }

  const child = new TraceBuilder(agentId);
  // Access parent trace id via building and extracting — use internal workaround
  // The child needs the parent's trace_id. We set it after building.
  // TraceBuilder exposes setParentTraceId, but we need to read parent's id.
  // Build a temporary trace to get the id, or use the builder directly.

  // TraceBuilder stores _traceId privately. We need to read it.
  // Build approach: create a minimal parent trace to get the id.
  // Alternative: add a getter. For now, use the build-peek pattern.

  await activeBuilder.run(child, async () => {
    await fn(child);
  });

  const childTrace = child.build();

  parent.addStep({
    type: STEP_AGENT_CALL,
    name: agentId,
    args: undefined,
    result: childTrace.output,
    sub_trace: childTrace,
  });
}
