package judge_test

import (
	"strings"
	"testing"

	"github.com/attest-ai/attest/engine/internal/assertion/judge"
)

func TestRubricRegistry_BuiltinsExist(t *testing.T) {
	reg := judge.NewRubricRegistry()
	builtins := []string{"default", "helpfulness", "accuracy", "safety"}
	for _, name := range builtins {
		rb, err := reg.Get(name)
		if err != nil {
			t.Errorf("builtin rubric %q not found: %v", name, err)
			continue
		}
		if rb.Name != name {
			t.Errorf("rubric name mismatch: got %q, want %q", rb.Name, name)
		}
		if rb.SystemPrompt == "" {
			t.Errorf("rubric %q has empty system prompt", name)
		}
	}
}

func TestRubricRegistry_NotFound(t *testing.T) {
	reg := judge.NewRubricRegistry()
	_, err := reg.Get("nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent rubric, got nil")
	}
}

func TestRubricRegistry_Register(t *testing.T) {
	reg := judge.NewRubricRegistry()
	custom := &judge.Rubric{
		Name:         "custom",
		SystemPrompt: "Evaluate custom criteria. Respond ONLY with JSON: {\"score\": 0.5, \"explanation\": \"test\"}",
	}
	if err := reg.Register(custom); err != nil {
		t.Fatalf("Register failed: %v", err)
	}
	got, err := reg.Get("custom")
	if err != nil {
		t.Fatalf("Get after Register failed: %v", err)
	}
	if got.Name != custom.Name {
		t.Errorf("name mismatch: got %q, want %q", got.Name, custom.Name)
	}
}

func TestRubricRegistry_RegisterEmptyName(t *testing.T) {
	reg := judge.NewRubricRegistry()
	err := reg.Register(&judge.Rubric{Name: "", SystemPrompt: "x"})
	if err == nil {
		t.Fatal("expected error for empty name, got nil")
	}
}

func TestRubricRegistry_BuiltinsContainDelimiters(t *testing.T) {
	reg := judge.NewRubricRegistry()
	builtins := []string{"default", "helpfulness", "accuracy", "safety"}
	for _, name := range builtins {
		rb, _ := reg.Get(name)
		if !strings.Contains(rb.SystemPrompt, "<<<AGENT_OUTPUT_START>>>") {
			t.Errorf("rubric %q missing start delimiter in system prompt", name)
		}
		if !strings.Contains(rb.SystemPrompt, "<<<AGENT_OUTPUT_END>>>") {
			t.Errorf("rubric %q missing end delimiter in system prompt", name)
		}
	}
}

func TestWrapAgentOutput(t *testing.T) {
	output := "Hello world"
	wrapped := judge.WrapAgentOutput(output)
	if !strings.Contains(wrapped, "<<<AGENT_OUTPUT_START>>>") {
		t.Error("wrapped output missing start delimiter")
	}
	if !strings.Contains(wrapped, "<<<AGENT_OUTPUT_END>>>") {
		t.Error("wrapped output missing end delimiter")
	}
	if !strings.Contains(wrapped, output) {
		t.Error("wrapped output missing original content")
	}
}

func TestParseScoreResult_Valid(t *testing.T) {
	response := `{"score": 0.85, "explanation": "The response was clear and accurate."}`
	result, err := judge.ParseScoreResult(response)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Score != 0.85 {
		t.Errorf("score: got %f, want 0.85", result.Score)
	}
	if result.Explanation == "" {
		t.Error("explanation should not be empty")
	}
}

func TestParseScoreResult_WithSurroundingText(t *testing.T) {
	response := `Here is my evaluation: {"score": 0.72, "explanation": "Good but could be better."} Thank you.`
	result, err := judge.ParseScoreResult(response)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Score != 0.72 {
		t.Errorf("score: got %f, want 0.72", result.Score)
	}
}

func TestParseScoreResult_NoJSON(t *testing.T) {
	_, err := judge.ParseScoreResult("no json here")
	if err == nil {
		t.Fatal("expected error for missing JSON, got nil")
	}
}

func TestParseScoreResult_InvalidJSON(t *testing.T) {
	_, err := judge.ParseScoreResult("{invalid json}")
	if err == nil {
		t.Fatal("expected error for invalid JSON, got nil")
	}
}
