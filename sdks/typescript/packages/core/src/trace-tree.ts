import type { Step, Trace } from "./proto/types.js";
import { STEP_AGENT_CALL, STEP_TOOL_CALL } from "./proto/constants.js";

export class TraceTree {
  readonly root: Trace;

  constructor(root: Trace) {
    this.root = root;
  }

  get agents(): string[] {
    const result: string[] = [];
    this.collectAgents(this.root, result);
    return result;
  }

  private collectAgents(trace: Trace, acc: string[]): void {
    if (trace.agent_id != null) {
      acc.push(trace.agent_id);
    }
    for (const step of trace.steps) {
      if (step.type === STEP_AGENT_CALL && step.sub_trace != null) {
        this.collectAgents(step.sub_trace, acc);
      }
    }
  }

  findAgent(agentId: string): Trace | undefined {
    return this.findAgentIn(this.root, agentId);
  }

  private findAgentIn(trace: Trace, agentId: string): Trace | undefined {
    if (trace.agent_id === agentId) return trace;
    for (const step of trace.steps) {
      if (step.type === STEP_AGENT_CALL && step.sub_trace != null) {
        const found = this.findAgentIn(step.sub_trace, agentId);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  }

  get depth(): number {
    return this.computeDepth(this.root);
  }

  private computeDepth(trace: Trace): number {
    let maxChild = -1;
    for (const step of trace.steps) {
      if (step.type === STEP_AGENT_CALL && step.sub_trace != null) {
        const childDepth = this.computeDepth(step.sub_trace);
        if (childDepth > maxChild) maxChild = childDepth;
      }
    }
    return maxChild >= 0 ? maxChild + 1 : 0;
  }

  flatten(): Trace[] {
    const result: Trace[] = [];
    this.flattenInto(this.root, result);
    return result;
  }

  private flattenInto(trace: Trace, acc: Trace[]): void {
    acc.push(trace);
    for (const step of trace.steps) {
      if (step.type === STEP_AGENT_CALL && step.sub_trace != null) {
        this.flattenInto(step.sub_trace, acc);
      }
    }
  }

  get delegations(): [string, string][] {
    const result: [string, string][] = [];
    this.collectDelegations(this.root, result);
    return result;
  }

  private collectDelegations(trace: Trace, acc: [string, string][]): void {
    const parentId = trace.agent_id ?? "";
    for (const step of trace.steps) {
      if (step.type === STEP_AGENT_CALL && step.sub_trace != null) {
        const childId = step.sub_trace.agent_id ?? "";
        acc.push([parentId, childId]);
        this.collectDelegations(step.sub_trace, acc);
      }
    }
  }

  allToolCalls(): Step[] {
    return this.flatten().flatMap((t) =>
      t.steps.filter((step) => step.type === STEP_TOOL_CALL),
    );
  }

  get aggregateTokens(): number {
    return this.flatten().reduce(
      (sum, t) => sum + (t.metadata?.total_tokens ?? 0),
      0,
    );
  }

  get aggregateCost(): number {
    return this.flatten().reduce(
      (sum, t) => sum + (t.metadata?.cost_usd ?? 0),
      0,
    );
  }

  get aggregateLatency(): number {
    return this.flatten().reduce(
      (sum, t) => sum + (t.metadata?.latency_ms ?? 0),
      0,
    );
  }
}
