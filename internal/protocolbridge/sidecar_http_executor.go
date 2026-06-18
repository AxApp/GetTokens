package protocolbridge

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

type SidecarTransport interface {
	RoundTrip(ctx context.Context, req SidecarHTTPRequest) (SidecarHTTPResponse, error)
}

type SidecarHTTPRequest struct {
	Method  string
	Path    string
	Headers map[string]string
	Body    []byte
}

type SidecarHTTPResponse struct {
	StatusCode int
	Body       []byte
}

type SidecarHTTPExecutor struct {
	transport SidecarTransport
}

func NewSidecarHTTPExecutor(transport SidecarTransport) *SidecarHTTPExecutor {
	if transport == nil {
		return nil
	}
	return &SidecarHTTPExecutor{transport: transport}
}

func (e *SidecarHTTPExecutor) Execute(ctx context.Context, req OperationRequest) (OperationResult, error) {
	if e == nil || e.transport == nil {
		return OperationResult{}, fmt.Errorf("sidecar HTTP executor transport is required")
	}
	httpReq, err := mapOperationToSidecarHTTPRequest(req)
	if err != nil {
		return OperationResult{}, err
	}
	httpResp, err := e.transport.RoundTrip(ctx, httpReq)
	if err != nil {
		return OperationResult{}, classifyTransportError(err)
	}
	return decodeSidecarHTTPResponse(req, httpResp)
}

type sidecarHTTPRequestBody struct {
	Version   string         `json:"version"`
	RequestID string         `json:"request_id"`
	Transport Transport      `json:"transport"`
	Operation Operation      `json:"operation"`
	Query     map[string]any `json:"query,omitempty"`
	Actor     Actor          `json:"actor"`
	Authority Authority      `json:"authority"`
	Caller    *CallerContext `json:"caller,omitempty"`
}

type sidecarHTTPResponseBody struct {
	Status           Status          `json:"status"`
	Data             any             `json:"data,omitempty"`
	Error            *BridgeError    `json:"error,omitempty"`
	Warnings         []BridgeWarning `json:"warnings,omitempty"`
	SnapshotID       string          `json:"snapshot_id,omitempty"`
	LedgerRef        string          `json:"ledger_ref,omitempty"`
	SidecarRequestID string          `json:"sidecar_request_id,omitempty"`
	OperationID      string          `json:"operation_id,omitempty"`
}

func mapOperationToSidecarHTTPRequest(req OperationRequest) (SidecarHTTPRequest, error) {
	spec, ok := operationSpecs[req.Operation]
	if !ok {
		return SidecarHTTPRequest{}, fmt.Errorf("sidecar HTTP executor: unknown operation %q", req.Operation)
	}

	body, err := json.Marshal(sidecarHTTPRequestBody{
		Version:   Version,
		RequestID: strings.TrimSpace(req.RequestID),
		Transport: req.Transport,
		Operation: req.Operation,
		Query:     copyQuery(req.Query),
		Actor: Actor{
			ClientID:    strings.TrimSpace(req.Actor.ClientID),
			AuthSubject: strings.TrimSpace(req.Actor.AuthSubject),
			Scopes:      append([]Scope(nil), req.Actor.Scopes...),
		},
		Authority: req.Authority,
		Caller:    req.Caller,
	})
	if err != nil {
		return SidecarHTTPRequest{}, fmt.Errorf("sidecar HTTP executor: marshal %s request: %w", req.Operation, err)
	}

	headers := map[string]string{
		"Content-Type":                       "application/json",
		"X-GetTokens-Bridge-Request-ID":      strings.TrimSpace(req.RequestID),
		"X-GetTokens-Bridge-Transport":       string(req.Transport),
		"X-GetTokens-Bridge-Operation":       string(req.Operation),
		"X-GetTokens-Bridge-Actor-Client-ID": strings.TrimSpace(req.Actor.ClientID),
	}
	if hash := strings.TrimSpace(HashSecret(strings.TrimSpace(req.IdempotencyKey))); req.IdempotencyKey != "" && hash != "" {
		headers["X-GetTokens-Bridge-Idempotency-Key-SHA256"] = hash
	}

	return SidecarHTTPRequest{
		Method:  "POST",
		Path:    spec.Endpoint,
		Headers: headers,
		Body:    body,
	}, nil
}

func decodeSidecarHTTPResponse(opReq OperationRequest, resp SidecarHTTPResponse) (OperationResult, error) {
	spec, ok := operationSpecs[opReq.Operation]
	if !ok {
		return OperationResult{}, fmt.Errorf("sidecar HTTP executor: unknown operation %q", opReq.Operation)
	}
	var payload sidecarHTTPResponseBody
	if err := json.Unmarshal(resp.Body, &payload); err != nil {
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return OperationResult{}, sidecarUnavailableError(fmt.Sprintf("sidecar returned HTTP %d", resp.StatusCode), fmt.Sprintf("http_%d", resp.StatusCode), resp.StatusCode >= 500 || resp.StatusCode == 408 || resp.StatusCode == 429)
		}
		return OperationResult{}, sidecarUnavailableError("sidecar returned malformed JSON", "invalid_json", false)
	}
	if payload.Status == StatusRejected {
		return OperationResult{}, sidecarRejectedError(payload.Error, opReq.IdempotencyKey)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return OperationResult{}, sidecarUnavailableError(fmt.Sprintf("sidecar returned HTTP %d", resp.StatusCode), fmt.Sprintf("http_%d", resp.StatusCode), resp.StatusCode >= 500 || resp.StatusCode == 408 || resp.StatusCode == 429)
	}

	switch spec.Type {
	case "read":
		if payload.Status != StatusOK {
			return OperationResult{}, sidecarUnavailableError(fmt.Sprintf("sidecar returned unexpected status %q", payload.Status), "invalid_status", false)
		}
		return NewReadOperationResult(SidecarReadEnvelope{
			Data:             payload.Data,
			Warnings:         append([]BridgeWarning(nil), payload.Warnings...),
			SnapshotID:       strings.TrimSpace(payload.SnapshotID),
			LedgerRef:        strings.TrimSpace(payload.LedgerRef),
			SidecarRequestID: strings.TrimSpace(payload.SidecarRequestID),
		}), nil
	case "safe_action":
		if payload.Status != StatusAccepted {
			return OperationResult{}, sidecarUnavailableError(fmt.Sprintf("sidecar returned unexpected status %q", payload.Status), "invalid_status", false)
		}
		return NewAcceptedActionResult(SidecarAcceptedAction{
			OperationID:      strings.TrimSpace(payload.OperationID),
			Warnings:         append([]BridgeWarning(nil), payload.Warnings...),
			LedgerRef:        strings.TrimSpace(payload.LedgerRef),
			SidecarRequestID: strings.TrimSpace(payload.SidecarRequestID),
		}), nil
	default:
		return OperationResult{}, fmt.Errorf("sidecar HTTP executor: unsupported operation type %q", spec.Type)
	}
}
