package server

import "sync"

// SessionState represents the lifecycle state of a session.
type SessionState int

const (
	StateUninitialized SessionState = iota
	StateInitialized
	StateShuttingDown
)

// Session tracks lifecycle state and evaluation statistics.
type Session struct {
	mu                  sync.Mutex
	state               SessionState
	assertionsEvaluated int64
	sessionsCompleted   int64
}

// NewSession creates a new Session in the Uninitialized state.
func NewSession() *Session {
	return &Session{
		state: StateUninitialized,
	}
}

// State returns the current session state.
func (s *Session) State() SessionState {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.state
}

// SetState transitions the session to a new state.
func (s *Session) SetState(state SessionState) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.state = state
}

// IncrementAssertions adds count to the total assertions evaluated.
func (s *Session) IncrementAssertions(count int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.assertionsEvaluated += int64(count)
}

// Stats returns a snapshot of session statistics.
func (s *Session) Stats() (sessionsCompleted int64, assertionsEvaluated int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.sessionsCompleted, s.assertionsEvaluated
}
