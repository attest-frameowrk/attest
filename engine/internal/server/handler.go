package server

import (
	"encoding/json"
	"fmt"

	"github.com/attest-ai/attest/engine/internal/assertion"
	"github.com/attest-ai/attest/engine/internal/trace"
	"github.com/attest-ai/attest/engine/pkg/types"
)

const (
	engineVersion   = "0.1.0"
	protocolVersion = 1
)

// supportedCapabilities lists all capabilities this engine supports for v0.1.
var supportedCapabilities = []string{"layers_1_4"}

// RegisterBuiltinHandlers registers the built-in JSON-RPC handlers on s.
func RegisterBuiltinHandlers(s *Server) {
	pipeline := assertion.NewPipeline(assertion.NewRegistry())

	s.RegisterHandler("initialize", handleInitialize)
	s.RegisterHandler("shutdown", handleShutdown)
	s.RegisterHandler("evaluate_batch", handleEvaluateBatch(pipeline))
	s.RegisterHandler("submit_plugin_result", handleSubmitPluginResult())
}

func handleInitialize(session *Session, params json.RawMessage) (any, *types.RPCError) {
	if session.State() != StateUninitialized {
		return nil, types.NewRPCError(
			types.ErrSessionError,
			"initialize called on already-initialized session",
			types.ErrTypeSessionError,
			false,
			"initialize may only be called once per session",
		)
	}

	var p types.InitializeParams
	if err := json.Unmarshal(params, &p); err != nil {
		return nil, types.NewRPCError(
			types.ErrSessionError,
			"invalid initialize params",
			types.ErrTypeSessionError,
			false,
			err.Error(),
		)
	}

	if p.ProtocolVersion != protocolVersion {
		return nil, types.NewRPCError(
			types.ErrSessionError,
			fmt.Sprintf("protocol version %d not supported; engine supports version %d", p.ProtocolVersion, protocolVersion),
			types.ErrTypeSessionError,
			false,
			"Upgrade the engine binary or downgrade the SDK protocol_version",
		)
	}

	// Compute missing capabilities.
	supported := make(map[string]bool, len(supportedCapabilities))
	for _, c := range supportedCapabilities {
		supported[c] = true
	}

	var missing []string
	for _, req := range p.RequiredCapabilities {
		if !supported[req] {
			missing = append(missing, req)
		}
	}

	compatible := len(missing) == 0
	if missing == nil {
		missing = []string{}
	}

	session.SetState(StateInitialized)

	return &types.InitializeResult{
		EngineVersion:         engineVersion,
		ProtocolVersion:       protocolVersion,
		Capabilities:          supportedCapabilities,
		Missing:               missing,
		Compatible:            compatible,
		Encoding:              "json",
		MaxConcurrentRequests: 64,
		MaxTraceSizeBytes:     10 * 1024 * 1024,
		MaxStepsPerTrace:      10000,
	}, nil
}

func handleShutdown(session *Session, _ json.RawMessage) (any, *types.RPCError) {
	if session.State() != StateInitialized {
		return nil, types.NewRPCError(
			types.ErrSessionError,
			"shutdown called on uninitialized or already-shutting-down session",
			types.ErrTypeSessionError,
			false,
			"call initialize before shutdown",
		)
	}

	session.SetState(StateShuttingDown)

	// Increment completed session count before reading stats.
	session.mu.Lock()
	session.sessionsCompleted++
	completed := session.sessionsCompleted
	evaluated := session.assertionsEvaluated
	session.mu.Unlock()

	return &types.ShutdownResult{
		SessionsCompleted:   int(completed),
		AssertionsEvaluated: int(evaluated),
	}, nil
}

func handleEvaluateBatch(pipeline *assertion.Pipeline) Handler {
	return func(session *Session, params json.RawMessage) (any, *types.RPCError) {
		if session.State() != StateInitialized {
			return nil, types.NewRPCError(
				types.ErrSessionError,
				"evaluate_batch called before initialize",
				types.ErrTypeSessionError,
				false,
				"call initialize first to establish a session before sending evaluate_batch requests",
			)
		}

		var p types.EvaluateBatchParams
		if err := json.Unmarshal(params, &p); err != nil {
			return nil, types.NewRPCError(
				types.ErrInvalidTrace,
				fmt.Sprintf("invalid evaluate_batch params: %v", err),
				types.ErrTypeInvalidTrace,
				false,
				"Check the request format matches the protocol spec.",
			)
		}

		trace.Normalize(&p.Trace)
		if rpcErr := trace.Validate(&p.Trace); rpcErr != nil {
			return nil, rpcErr
		}

		result, err := pipeline.EvaluateBatch(&p.Trace, p.Assertions)
		if err != nil {
			return nil, types.NewRPCError(
				types.ErrEngineError,
				fmt.Sprintf("evaluation failed: %v", err),
				types.ErrTypeEngineError,
				false,
				"Internal engine error during evaluation.",
			)
		}

		session.IncrementAssertions(len(result.Results))

		return &types.EvaluateBatchResult{
			Results:         result.Results,
			TotalCost:       result.TotalCost,
			TotalDurationMS: result.TotalDurationMS,
		}, nil
	}
}

func handleSubmitPluginResult() Handler {
	return func(session *Session, params json.RawMessage) (any, *types.RPCError) {
		if session.State() != StateInitialized {
			return nil, types.NewRPCError(
				types.ErrSessionError,
				"submit_plugin_result called before initialize",
				types.ErrTypeSessionError,
				false,
				"call initialize first to establish a session",
			)
		}

		var p types.SubmitPluginResultParams
		if err := json.Unmarshal(params, &p); err != nil {
			return nil, types.NewRPCError(
				types.ErrAssertionError,
				"invalid submit_plugin_result params",
				types.ErrTypeAssertionError,
				false,
				err.Error(),
			)
		}

		session.IncrementAssertions(1)

		return &types.SubmitPluginResultResponse{Accepted: true}, nil
	}
}
