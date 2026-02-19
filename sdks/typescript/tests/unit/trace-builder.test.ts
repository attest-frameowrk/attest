import { describe, it, expect } from "vitest";
import { TraceBuilder } from "../../packages/core/src/trace.js";
import { AgentResult } from "../../packages/core/src/result.js";
import {
  STEP_LLM_CALL,
  STEP_TOOL_CALL,
  STEP_RETRIEVAL,
  STATUS_PASS,
  STATUS_SOFT_FAIL,
  STATUS_HARD_FAIL,
} from "../../packages/core/src/proto/constants.js";

describe("TraceBuilder", () => {
  it("builds a trace with required fields", () => {
    const trace = new TraceBuilder()
      .setOutput({ response: "hello" })
      .build();

    expect(trace.trace_id).toMatch(/^trc_[a-f0-9]{12}$/);
    expect(trace.output).toEqual({ response: "hello" });
    expect(trace.schema_version).toBe(1);
    expect(trace.steps).toEqual([]);
  });

  it("throws when output is not set", () => {
    expect(() => new TraceBuilder().build()).toThrow(
      "Trace output is required",
    );
  });

  it("sets agent_id from constructor", () => {
    const trace = new TraceBuilder("agent-1")
      .setOutput({ done: true })
      .build();

    expect(trace.agent_id).toBe("agent-1");
  });

  it("supports custom trace_id", () => {
    const trace = new TraceBuilder()
      .setTraceId("custom-id")
      .setOutput({ ok: true })
      .build();

    expect(trace.trace_id).toBe("custom-id");
  });

  it("sets input data", () => {
    const trace = new TraceBuilder()
      .setInput({ query: "test" })
      .setOutput({ result: "ok" })
      .build();

    expect(trace.input).toEqual({ query: "test" });
  });

  it("adds LLM call steps", () => {
    const trace = new TraceBuilder()
      .addLlmCall("gpt-4", {
        args: { prompt: "hello" },
        result: { text: "hi" },
      })
      .setOutput({ response: "hi" })
      .build();

    expect(trace.steps).toHaveLength(1);
    expect(trace.steps[0].type).toBe(STEP_LLM_CALL);
    expect(trace.steps[0].name).toBe("gpt-4");
    expect(trace.steps[0].args).toEqual({ prompt: "hello" });
    expect(trace.steps[0].result).toEqual({ text: "hi" });
  });

  it("adds tool call steps", () => {
    const trace = new TraceBuilder()
      .addToolCall("search", { args: { q: "test" } })
      .setOutput({ done: true })
      .build();

    expect(trace.steps[0].type).toBe(STEP_TOOL_CALL);
    expect(trace.steps[0].name).toBe("search");
  });

  it("adds retrieval steps", () => {
    const trace = new TraceBuilder()
      .addRetrieval("vector-db", { result: { docs: [] } })
      .setOutput({ done: true })
      .build();

    expect(trace.steps[0].type).toBe(STEP_RETRIEVAL);
    expect(trace.steps[0].name).toBe("vector-db");
  });

  it("adds raw steps", () => {
    const trace = new TraceBuilder()
      .addStep({ type: "agent_call", name: "sub-agent" })
      .setOutput({ done: true })
      .build();

    expect(trace.steps[0].type).toBe("agent_call");
  });

  it("sets metadata", () => {
    const trace = new TraceBuilder()
      .setMetadata({ total_tokens: 100, model: "gpt-4" })
      .setOutput({ done: true })
      .build();

    expect(trace.metadata?.total_tokens).toBe(100);
    expect(trace.metadata?.model).toBe("gpt-4");
  });

  it("sets parent trace id", () => {
    const trace = new TraceBuilder()
      .setParentTraceId("parent-123")
      .setOutput({ done: true })
      .build();

    expect(trace.parent_trace_id).toBe("parent-123");
  });

  it("returns a new steps array (not a reference)", () => {
    const builder = new TraceBuilder()
      .addLlmCall("test")
      .setOutput({ done: true });

    const trace1 = builder.build();
    const trace2 = builder.build();

    expect(trace1.steps).not.toBe(trace2.steps);
    expect(trace1.steps).toEqual(trace2.steps);
  });
});

describe("AgentResult", () => {
  const baseTrace = new TraceBuilder().setOutput({ done: true }).build();

  it("reports passed when all assertions pass", () => {
    const result = new AgentResult(baseTrace, [
      { assertion_id: "a1", status: STATUS_PASS, score: 1.0, explanation: "ok" },
      { assertion_id: "a2", status: STATUS_PASS, score: 1.0, explanation: "ok" },
    ]);

    expect(result.passed).toBe(true);
    expect(result.passCount).toBe(2);
    expect(result.failCount).toBe(0);
    expect(result.failedAssertions).toHaveLength(0);
  });

  it("reports passed when no assertions exist", () => {
    const result = new AgentResult(baseTrace);
    expect(result.passed).toBe(true);
    expect(result.passCount).toBe(0);
    expect(result.failCount).toBe(0);
  });

  it("reports failures correctly", () => {
    const result = new AgentResult(baseTrace, [
      { assertion_id: "a1", status: STATUS_PASS, score: 1.0, explanation: "ok" },
      { assertion_id: "a2", status: STATUS_SOFT_FAIL, score: 0.5, explanation: "partial" },
      { assertion_id: "a3", status: STATUS_HARD_FAIL, score: 0.0, explanation: "failed" },
    ]);

    expect(result.passed).toBe(false);
    expect(result.passCount).toBe(1);
    expect(result.failCount).toBe(2);
    expect(result.failedAssertions).toHaveLength(2);
    expect(result.softFailures).toHaveLength(1);
    expect(result.hardFailures).toHaveLength(1);
    expect(result.softFailures[0].assertion_id).toBe("a2");
    expect(result.hardFailures[0].assertion_id).toBe("a3");
  });

  it("stores cost and duration", () => {
    const result = new AgentResult(baseTrace, [], 1.5, 250);
    expect(result.totalCost).toBe(1.5);
    expect(result.totalDurationMs).toBe(250);
  });
});
