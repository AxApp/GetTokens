package protocolbridge

import (
	"context"
	"fmt"
	"sync"
)

type StubOperationExecutor struct {
	mu      sync.Mutex
	results map[Operation]OperationResult
	errors  map[Operation]error
	calls   []OperationRequest
}

func NewStubOperationExecutor() *StubOperationExecutor {
	return &StubOperationExecutor{
		results: make(map[Operation]OperationResult),
		errors:  make(map[Operation]error),
	}
}

func (s *StubOperationExecutor) SetReadResult(operation Operation, result OperationResult) {
	s.setResult(operation, result, nil)
}

func (s *StubOperationExecutor) SetAcceptedActionResult(operation Operation, result OperationResult) {
	s.setResult(operation, result, nil)
}

func (s *StubOperationExecutor) SetError(operation Operation, err error) {
	s.setResult(operation, OperationResult{}, err)
}

func (s *StubOperationExecutor) Execute(_ context.Context, req OperationRequest) (OperationResult, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.calls = append(s.calls, req)
	if err, ok := s.errors[req.Operation]; ok && err != nil {
		return OperationResult{}, err
	}
	result, ok := s.results[req.Operation]
	if !ok {
		return OperationResult{}, fmt.Errorf("stub operation executor: no result for %s", req.Operation)
	}
	return result, nil
}

func (s *StubOperationExecutor) Calls() []OperationRequest {
	s.mu.Lock()
	defer s.mu.Unlock()
	calls := make([]OperationRequest, len(s.calls))
	copy(calls, s.calls)
	return calls
}

func (s *StubOperationExecutor) CallCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.calls)
}

func (s *StubOperationExecutor) setResult(operation Operation, result OperationResult, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err != nil {
		s.errors[operation] = err
		delete(s.results, operation)
		return
	}
	s.results[operation] = result
	delete(s.errors, operation)
}
