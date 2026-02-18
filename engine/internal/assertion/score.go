package assertion

import "github.com/attest-ai/attest/engine/pkg/types"

// BatchResult holds the results of evaluating a batch of assertions.
type BatchResult struct {
	Results         []types.AssertionResult
	TotalCost       float64
	TotalDurationMS int64
}
