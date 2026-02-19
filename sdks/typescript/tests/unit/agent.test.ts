import { describe, it, expect } from "vitest";
import { Agent, agent } from "../../packages/core/src/agent.js";
import { TraceBuilder } from "../../packages/core/src/trace.js";

describe("Agent", () => {
  it("runs a sync function and captures trace", () => {
    const myAgent = new Agent("test-agent", (builder: TraceBuilder) => {
      builder.addLlmCall("gpt-4", { result: { text: "hello" } });
      return { message: "hello" };
    });

    const result = myAgent.run({ query: "hi" });
    expect(result.trace.agent_id).toBe("test-agent");
    expect(result.trace.input).toEqual({ query: "hi" });
    expect(result.trace.output).toEqual({ message: "hello" });
    expect(result.trace.steps).toHaveLength(1);
    expect(result.trace.steps[0].name).toBe("gpt-4");
    expect(result.passed).toBe(true);
  });

  it("throws when no function provided", () => {
    const myAgent = new Agent("empty");
    expect(() => myAgent.run()).toThrow("No agent function provided");
  });

  it("wraps non-dict output in result key", () => {
    const myAgent = new Agent("test", (_builder: TraceBuilder) => {
      return "plain string";
    });

    const result = myAgent.run();
    expect(result.trace.output).toEqual({ result: "plain string" });
  });

  it("handles undefined output", () => {
    const myAgent = new Agent("test", (_builder: TraceBuilder) => {
      // no return
    });

    const result = myAgent.run();
    expect(result.trace.output).toEqual({ result: null });
  });

  it("creates result from pre-built trace via withTrace()", () => {
    const trace = new TraceBuilder("pre-built")
      .setOutput({ done: true })
      .build();
    const myAgent = new Agent("test");
    const result = myAgent.withTrace(trace);
    expect(result.trace).toBe(trace);
  });
});

describe("Agent async", () => {
  it("runs an async function and captures trace", async () => {
    const myAgent = new Agent("async-agent", async (builder: TraceBuilder) => {
      builder.addToolCall("search", { args: { q: "test" } });
      return { found: true };
    });

    const result = await myAgent.arun({ query: "test" });
    expect(result.trace.agent_id).toBe("async-agent");
    expect(result.trace.output).toEqual({ found: true });
    expect(result.trace.steps).toHaveLength(1);
  });
});

describe("agent() wrapper function", () => {
  it("creates a callable that returns AgentResult", () => {
    const myAgent = agent("wrapped-agent", (builder: TraceBuilder) => {
      builder.addLlmCall("model");
      return { response: "ok" };
    });

    const result = myAgent({ input: "test" });
    expect(result.trace.agent_id).toBe("wrapped-agent");
    expect(result.trace.output).toEqual({ response: "ok" });
  });

  it("works with no args", () => {
    const myAgent = agent("no-args", (_builder: TraceBuilder) => {
      return { done: true };
    });

    const result = myAgent();
    expect(result.trace.output).toEqual({ done: true });
  });

  it("exposes the underlying Agent instance", () => {
    const myAgent = agent("test", (_builder: TraceBuilder) => ({ ok: true }));
    expect((myAgent as Record<string, unknown>).agent).toBeInstanceOf(Agent);
  });
});
