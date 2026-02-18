package assertion

import (
	"encoding/json"
	"testing"

	"github.com/attest-ai/attest/engine/pkg/types"
)

func TestPipeline_EvaluateBatch_MixedTypes(t *testing.T) {
	pipeline := NewPipeline(NewRegistry())

	trace := &types.Trace{
		TraceID: "trc_pipeline_test",
		Output:  json.RawMessage(`{"message":"Hello World","structured":{"score":0.9}}`),
		Steps: []types.Step{
			{
				Name:   "search",
				Type:   types.StepTypeToolCall,
				Args:   json.RawMessage(`{"query":"test"}`),
				Result: json.RawMessage(`{"hits":3}`),
			},
		},
	}

	assertions := []types.Assertion{
		{
			AssertionID: "content_assert",
			Type:        types.TypeContent,
			Spec:        json.RawMessage(`{"target":"output.message","check":"contains","value":"Hello"}`),
		},
		{
			AssertionID: "schema_assert",
			Type:        types.TypeSchema,
			Spec: json.RawMessage(`{
				"target": "output.structured",
				"schema": {
					"type": "object",
					"required": ["score"],
					"properties": {"score": {"type": "number"}}
				}
			}`),
		},
		{
			AssertionID: "trace_assert",
			Type:        types.TypeTrace,
			Spec:        json.RawMessage(`{"check":"required_tools","tools":["search"]}`),
		},
	}

	result, err := pipeline.EvaluateBatch(trace, assertions)
	if err != nil {
		t.Fatalf("EvaluateBatch returned error: %v", err)
	}
	if len(result.Results) != 3 {
		t.Fatalf("expected 3 results, got %d", len(result.Results))
	}

	// All should pass.
	for _, r := range result.Results {
		if r.Status != types.StatusPass {
			t.Errorf("assertion %q: got status %q, want pass; explanation: %s", r.AssertionID, r.Status, r.Explanation)
		}
	}
}

func TestPipeline_EvaluateBatch_UnknownType(t *testing.T) {
	pipeline := NewPipeline(NewRegistry())

	trace := &types.Trace{
		TraceID: "trc_unknown_type",
		Output:  json.RawMessage(`{"message":"ok"}`),
	}

	assertions := []types.Assertion{
		{
			AssertionID: "good_assert",
			Type:        types.TypeContent,
			Spec:        json.RawMessage(`{"target":"output.message","check":"contains","value":"ok"}`),
		},
		{
			AssertionID: "bad_assert",
			Type:        "llm_judge", // not registered in built-in registry
			Spec:        json.RawMessage(`{}`),
		},
	}

	result, err := pipeline.EvaluateBatch(trace, assertions)
	if err != nil {
		t.Fatalf("EvaluateBatch returned error: %v", err)
	}
	if len(result.Results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(result.Results))
	}

	// Find the bad assert result.
	var badResult *types.AssertionResult
	for i := range result.Results {
		if result.Results[i].AssertionID == "bad_assert" {
			badResult = &result.Results[i]
		}
	}
	if badResult == nil {
		t.Fatal("bad_assert result not found")
	}
	if badResult.Status != types.StatusHardFail {
		t.Errorf("bad_assert: got status %q, want hard_fail", badResult.Status)
	}
}

func TestPipeline_EvaluateBatch_LayerOrder(t *testing.T) {
	pipeline := NewPipeline(NewRegistry())

	trace := &types.Trace{
		TraceID: "trc_order_test",
		Output:  json.RawMessage(`{"message":"test","structured":{"key":"val"}}`),
		Steps: []types.Step{
			{
				Name:   "tool_a",
				Type:   types.StepTypeToolCall,
				Result: json.RawMessage(`{}`),
			},
		},
	}

	// Submit in reverse order; expect results to be in evaluation order.
	assertions := []types.Assertion{
		{
			AssertionID: "content_4",
			Type:        types.TypeContent,
			Spec:        json.RawMessage(`{"target":"output.message","check":"contains","value":"test"}`),
		},
		{
			AssertionID: "trace_3",
			Type:        types.TypeTrace,
			Spec:        json.RawMessage(`{"check":"required_tools","tools":["tool_a"]}`),
		},
		{
			AssertionID: "schema_1",
			Type:        types.TypeSchema,
			Spec: json.RawMessage(`{
				"target": "output.structured",
				"schema": {"type": "object"}
			}`),
		},
	}

	result, err := pipeline.EvaluateBatch(trace, assertions)
	if err != nil {
		t.Fatalf("EvaluateBatch returned error: %v", err)
	}
	if len(result.Results) != 3 {
		t.Fatalf("expected 3 results, got %d", len(result.Results))
	}

	// Results should be in layer order: schema(1), trace(3), content(4).
	wantOrder := []string{"schema_1", "trace_3", "content_4"}
	for i, want := range wantOrder {
		if result.Results[i].AssertionID != want {
			t.Errorf("result[%d].AssertionID = %q, want %q", i, result.Results[i].AssertionID, want)
		}
	}
}

func TestPipeline_EvaluateBatch_Empty(t *testing.T) {
	pipeline := NewPipeline(NewRegistry())

	trace := &types.Trace{
		TraceID: "trc_empty",
		Output:  json.RawMessage(`{"message":"ok"}`),
	}

	result, err := pipeline.EvaluateBatch(trace, nil)
	if err != nil {
		t.Fatalf("EvaluateBatch returned error: %v", err)
	}
	if len(result.Results) != 0 {
		t.Fatalf("expected 0 results, got %d", len(result.Results))
	}
}
