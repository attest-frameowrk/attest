package assertion

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/attest-ai/attest/engine/internal/assertion/judge"
	"github.com/attest-ai/attest/engine/internal/cache"
	"github.com/attest-ai/attest/engine/internal/llm"
	"github.com/attest-ai/attest/engine/pkg/types"
)

// JudgeEvaluator implements Layer 6: LLM-based judge assertions.
type JudgeEvaluator struct {
	provider llm.Provider
	rubrics  *judge.RubricRegistry
	cache    *cache.JudgeCache
}

// NewJudgeEvaluator creates an evaluator using the given LLM provider, rubric registry, and optional cache.
// cache may be nil to disable caching.
func NewJudgeEvaluator(provider llm.Provider, rubrics *judge.RubricRegistry, c *cache.JudgeCache) *JudgeEvaluator {
	return &JudgeEvaluator{provider: provider, rubrics: rubrics, cache: c}
}

// judgeSpec is the expected structure of the assertion spec JSON.
type judgeSpec struct {
	Target    string  `json:"target"`
	Criteria  string  `json:"criteria"`
	Rubric    string  `json:"rubric"`
	Threshold float64 `json:"threshold"`
	Soft      bool    `json:"soft"`
	Model     string  `json:"model"`
}

// Evaluate runs the LLM judge assertion against the trace.
func (e *JudgeEvaluator) Evaluate(trace *types.Trace, assertion *types.Assertion) *types.AssertionResult {
	start := time.Now()

	var spec judgeSpec
	if err := json.Unmarshal(assertion.Spec, &spec); err != nil {
		return failResult(assertion, start, fmt.Sprintf("invalid judge spec: %v", err))
	}
	if spec.Target == "" {
		return failResult(assertion, start, "judge spec missing required field: target")
	}
	rubricName := spec.Rubric
	if rubricName == "" {
		rubricName = "default"
	}
	if spec.Threshold <= 0 {
		spec.Threshold = 0.8
	}

	rubric, err := e.rubrics.Get(rubricName)
	if err != nil {
		return failResult(assertion, start, fmt.Sprintf("rubric not found: %v", err))
	}

	targetStr, err := ResolveTargetString(trace, spec.Target)
	if err != nil {
		return failResult(assertion, start, fmt.Sprintf("target resolution failed: %v", err))
	}

	model := spec.Model
	if model == "" {
		model = e.provider.DefaultModel()
	}

	// Check cache
	if e.cache != nil {
		contentHash := cache.JudgeContentHash(targetStr)
		if cached, cErr := e.cache.Get(contentHash, rubricName, model); cErr == nil && cached != nil {
			durationMS := time.Since(start).Milliseconds()
			return e.buildResult(assertion, cached.Score, cached.Explanation, spec.Threshold, spec.Soft, durationMS, 0)
		}
	}

	// Call LLM
	ctx := context.Background()
	wrapped := judge.WrapAgentOutput(targetStr)
	userContent := wrapped
	if spec.Criteria != "" {
		userContent = fmt.Sprintf("Evaluation criteria: %s\n\n%s", spec.Criteria, wrapped)
	}
	req := &llm.CompletionRequest{
		Model:        model,
		SystemPrompt: rubric.SystemPrompt,
		Messages:     []llm.Message{{Role: "user", Content: userContent}},
		Temperature:  0.0,
		MaxTokens:    256,
	}

	resp, err := e.provider.Complete(ctx, req)
	if err != nil {
		return failResult(assertion, start, fmt.Sprintf("LLM call failed: %v", err))
	}

	scoreResult, err := judge.ParseScoreResult(resp.Content)
	if err != nil {
		return failResult(assertion, start, fmt.Sprintf("parse judge response: %v", err))
	}

	durationMS := time.Since(start).Milliseconds()

	// Cache result (best-effort)
	if e.cache != nil {
		contentHash := cache.JudgeContentHash(targetStr)
		_ = e.cache.Put(contentHash, rubricName, model, &cache.JudgeCacheEntry{
			Score:       scoreResult.Score,
			Explanation: scoreResult.Explanation,
		})
	}

	return e.buildResult(assertion, scoreResult.Score, scoreResult.Explanation, spec.Threshold, spec.Soft, durationMS, resp.Cost)
}

func (e *JudgeEvaluator) buildResult(
	assertion *types.Assertion,
	score float64,
	explanation string,
	threshold float64,
	soft bool,
	durationMS int64,
	cost float64,
) *types.AssertionResult {
	status := types.StatusPass
	if score < threshold {
		if soft {
			status = types.StatusSoftFail
		} else {
			status = types.StatusHardFail
		}
	}

	return &types.AssertionResult{
		AssertionID: assertion.AssertionID,
		Status:      status,
		Score:       score,
		Explanation: explanation,
		Cost:        cost,
		DurationMS:  durationMS,
		RequestID:   assertion.RequestID,
	}
}
