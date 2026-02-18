package assertion

import (
	"fmt"

	"github.com/attest-ai/attest/engine/pkg/types"
)

// Evaluator is the interface for assertion evaluators.
type Evaluator interface {
	Evaluate(trace *types.Trace, assertion *types.Assertion) *types.AssertionResult
}

// Registry maps assertion type strings to Evaluator implementations.
type Registry struct {
	evaluators map[string]Evaluator
}

// NewRegistry creates a registry with all built-in evaluators registered.
func NewRegistry() *Registry {
	r := &Registry{
		evaluators: make(map[string]Evaluator),
	}
	r.Register(types.TypeSchema, &SchemaEvaluator{})
	r.Register(types.TypeConstraint, &ConstraintEvaluator{})
	r.Register(types.TypeTrace, &TraceEvaluator{})
	r.Register(types.TypeContent, &ContentEvaluator{})
	return r
}

// Register adds an evaluator for an assertion type.
func (r *Registry) Register(assertionType string, eval Evaluator) {
	r.evaluators[assertionType] = eval
}

// Get returns the evaluator for an assertion type, or error if not found.
func (r *Registry) Get(assertionType string) (Evaluator, error) {
	eval, ok := r.evaluators[assertionType]
	if !ok {
		return nil, fmt.Errorf("unknown assertion type: %s", assertionType)
	}
	return eval, nil
}
