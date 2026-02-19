import { describe, it, expect } from "vitest";
import { TraceTree } from "../../packages/core/src/trace-tree.js";
import type { Trace } from "../../packages/core/src/proto/types.js";

function makeTree(): Trace {
  return {
    trace_id: "root-1",
    agent_id: "orchestrator",
    schema_version: 1,
    output: { message: "done" },
    steps: [
      { type: "llm_call", name: "gpt-4" },
      {
        type: "agent_call",
        name: "researcher",
        result: { summary: "found it" },
        sub_trace: {
          trace_id: "child-1",
          agent_id: "researcher",
          schema_version: 1,
          output: { summary: "found it" },
          metadata: { total_tokens: 200, cost_usd: 0.01, latency_ms: 500 },
          steps: [
            { type: "tool_call", name: "search", args: { q: "test" } },
            {
              type: "agent_call",
              name: "summarizer",
              result: { text: "summary" },
              sub_trace: {
                trace_id: "grandchild-1",
                agent_id: "summarizer",
                schema_version: 1,
                output: { text: "summary" },
                metadata: { total_tokens: 100, cost_usd: 0.005, latency_ms: 200 },
                steps: [{ type: "llm_call", name: "gpt-3.5" }],
              },
            },
          ],
        },
      },
      {
        type: "agent_call",
        name: "writer",
        result: { draft: "article" },
        sub_trace: {
          trace_id: "child-2",
          agent_id: "writer",
          schema_version: 1,
          output: { draft: "article" },
          metadata: { total_tokens: 300, cost_usd: 0.02, latency_ms: 800 },
          steps: [{ type: "tool_call", name: "write", args: { text: "article" } }],
        },
      },
    ],
    metadata: { total_tokens: 150, cost_usd: 0.008, latency_ms: 300 },
  };
}

describe("TraceTree", () => {
  it("collects all agent ids", () => {
    const tree = new TraceTree(makeTree());
    expect(tree.agents).toEqual(["orchestrator", "researcher", "summarizer", "writer"]);
  });

  it("finds agent by id", () => {
    const tree = new TraceTree(makeTree());
    const researcher = tree.findAgent("researcher");
    expect(researcher).toBeDefined();
    expect(researcher!.trace_id).toBe("child-1");
  });

  it("finds nested agent", () => {
    const tree = new TraceTree(makeTree());
    const summarizer = tree.findAgent("summarizer");
    expect(summarizer).toBeDefined();
    expect(summarizer!.trace_id).toBe("grandchild-1");
  });

  it("returns undefined for unknown agent", () => {
    const tree = new TraceTree(makeTree());
    expect(tree.findAgent("nonexistent")).toBeUndefined();
  });

  it("computes depth correctly", () => {
    const tree = new TraceTree(makeTree());
    expect(tree.depth).toBe(2); // root -> researcher -> summarizer
  });

  it("depth is 0 for single-agent trace", () => {
    const flat: Trace = {
      trace_id: "flat",
      agent_id: "single",
      schema_version: 1,
      output: { done: true },
      steps: [{ type: "llm_call", name: "gpt-4" }],
    };
    const tree = new TraceTree(flat);
    expect(tree.depth).toBe(0);
  });

  it("flattens all traces depth-first", () => {
    const tree = new TraceTree(makeTree());
    const flat = tree.flatten();
    expect(flat).toHaveLength(4);
    expect(flat.map((t) => t.agent_id)).toEqual([
      "orchestrator",
      "researcher",
      "summarizer",
      "writer",
    ]);
  });

  it("collects delegations", () => {
    const tree = new TraceTree(makeTree());
    expect(tree.delegations).toEqual([
      ["orchestrator", "researcher"],
      ["researcher", "summarizer"],
      ["orchestrator", "writer"],
    ]);
  });

  it("collects all tool calls across tree", () => {
    const tree = new TraceTree(makeTree());
    const tools = tree.allToolCalls();
    expect(tools).toHaveLength(2);
    expect(tools.map((s) => s.name)).toEqual(["search", "write"]);
  });

  it("aggregates tokens across tree", () => {
    const tree = new TraceTree(makeTree());
    // 150 (root) + 200 (researcher) + 100 (summarizer) + 300 (writer)
    expect(tree.aggregateTokens).toBe(750);
  });

  it("aggregates cost across tree", () => {
    const tree = new TraceTree(makeTree());
    // 0.008 + 0.01 + 0.005 + 0.02 = 0.043
    expect(tree.aggregateCost).toBeCloseTo(0.043, 6);
  });

  it("aggregates latency across tree", () => {
    const tree = new TraceTree(makeTree());
    // 300 + 500 + 200 + 800 = 1800
    expect(tree.aggregateLatency).toBe(1800);
  });
});
