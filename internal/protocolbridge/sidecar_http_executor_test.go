package protocolbridge

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func TestNewSidecarHTTPTransportRejectsInvalidBaseURL(t *testing.T) {
	tests := []struct {
		name    string
		baseURL string
	}{
		{name: "empty", baseURL: ""},
		{name: "missing host", baseURL: "http:///v0/management/gettokens"},
		{name: "unsupported scheme", baseURL: "unix:///tmp/sidecar.sock"},
		{name: "non loopback host", baseURL: "https://example.com"},
		{name: "userinfo not allowed", baseURL: "http://user:pass@127.0.0.1:8080"},
		{name: "query not allowed", baseURL: "http://127.0.0.1:8080/api?token=raw-secret-token"},
		{name: "fragment not allowed", baseURL: "http://127.0.0.1:8080/api#fragment"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			transport, err := NewSidecarHTTPTransport(tt.baseURL)
			if err == nil {
				t.Fatalf("expected invalid base URL error, got transport=%#v", transport)
			}
		})
	}
}

func TestSidecarHTTPExecutorMapsReadOperationToSidecarRequest(t *testing.T) {
	transport := &recordingSidecarTransport{
		response: SidecarHTTPResponse{
			StatusCode: 200,
			Body: mustJSONBytes(t, map[string]any{
				"status":             string(StatusOK),
				"data":               map[string]any{"accounts": []map[string]any{{"account_key": "acct_codex_001", "requestable": true}}},
				"snapshot_id":        "snap_accounts_010",
				"ledger_ref":         "ledger_accounts_010",
				"sidecar_request_id": "scr_accounts_010",
				"warnings":           []map[string]any{{"code": "quota_stale", "message": "Quota snapshot is stale."}},
			}),
		},
	}
	executor := NewSidecarHTTPExecutor(transport)

	result, err := executor.Execute(context.Background(), OperationRequest{
		Version:   Version,
		RequestID: "brq_accounts_010",
		Transport: TransportMCP,
		Operation: OperationAccountsSummary,
		Query: map[string]any{
			"include_disabled": false,
		},
		Actor: Actor{
			ClientID:    "mcp-accounts-agent",
			AuthSubject: "bridge-token:abcd1234",
			Scopes:      []Scope{ScopeAccountsRead},
		},
		Authority: Authority{
			Owner:             AuthorityOwnerSidecar,
			Endpoint:          "/v0/management/gettokens/accounts/summary",
			GeneratedAtUnixMs: fixedBridgeTime().UnixMilli(),
		},
		Caller:   &CallerContext{PeerAddress: "127.0.0.1:51515"},
		ClientID: "mcp-accounts-agent",
	})
	if err != nil {
		t.Fatalf("sidecar HTTP executor returned error: %v", err)
	}

	read, ok := result.readResult()
	if !ok {
		t.Fatalf("expected read result, got %#v", result)
	}
	if read.SnapshotID != "snap_accounts_010" || read.LedgerRef != "ledger_accounts_010" || read.SidecarRequestID != "scr_accounts_010" {
		t.Fatalf("unexpected read envelope: %#v", read)
	}
	if len(transport.calls) != 1 {
		t.Fatalf("expected one sidecar call, got %d", len(transport.calls))
	}

	call := transport.calls[0]
	if call.Method != "POST" {
		t.Fatalf("method=%q, want POST", call.Method)
	}
	if call.Path != "/v0/management/gettokens/accounts/summary" {
		t.Fatalf("path=%q, want accounts summary endpoint", call.Path)
	}
	if got := call.Headers["Content-Type"]; got != "application/json" {
		t.Fatalf("content type=%q, want application/json", got)
	}
	if got := call.Headers["X-GetTokens-Bridge-Request-ID"]; got != "brq_accounts_010" {
		t.Fatalf("request id header=%q", got)
	}
	if got := call.Headers["X-GetTokens-Bridge-Actor-Client-ID"]; got != "mcp-accounts-agent" {
		t.Fatalf("actor client header=%q", got)
	}
	for _, forbiddenHeader := range []string{"Authorization", "Cookie", "Idempotency-Key", "X-GetTokens-Bridge-Idempotency-Key"} {
		if _, ok := call.Headers[forbiddenHeader]; ok {
			t.Fatalf("unexpected forbidden header %q in sidecar request", forbiddenHeader)
		}
	}

	var body sidecarHTTPRequestBody
	if err := json.Unmarshal(call.Body, &body); err != nil {
		t.Fatalf("unmarshal sidecar request body: %v", err)
	}
	if body.Operation != OperationAccountsSummary || body.Transport != TransportMCP {
		t.Fatalf("unexpected operation payload: %#v", body)
	}
	if got := body.Query["include_disabled"]; got != false {
		t.Fatalf("query mapping mismatch, got %#v", body.Query)
	}
	if body.Actor.ClientID != "mcp-accounts-agent" || body.Authority.Owner != AuthorityOwnerSidecar {
		t.Fatalf("actor/authority mapping mismatch: %#v", body)
	}
	if body.Caller == nil || body.Caller.PeerAddress != "127.0.0.1:51515" {
		t.Fatalf("caller mapping mismatch: %#v", body.Caller)
	}
}

func TestSidecarHTTPExecutorMapsSafeActionToAcceptedOperationRefAndHashesIdempotency(t *testing.T) {
	rawIdempotencyKey := "retry-key-secret"
	transport := &recordingSidecarTransport{
		response: SidecarHTTPResponse{
			StatusCode: 202,
			Body: mustJSONBytes(t, map[string]any{
				"status":             string(StatusAccepted),
				"operation_id":       "bro_quota_refresh_010",
				"ledger_ref":         "ledger_quota_refresh_010",
				"sidecar_request_id": "scr_quota_refresh_010",
				"warnings":           []map[string]any{{"code": "refresh_queued", "message": "Quota refresh accepted by sidecar."}},
			}),
		},
	}
	executor := NewSidecarHTTPExecutor(transport)

	result, err := executor.Execute(context.Background(), OperationRequest{
		Version:        Version,
		RequestID:      "brq_quota_refresh_010",
		Transport:      TransportMCP,
		Operation:      OperationActionQuotaRefresh,
		IdempotencyKey: rawIdempotencyKey,
		Query: map[string]any{
			"account_key":     "acct_codex_001",
			"include_billing": true,
		},
		Actor: Actor{
			ClientID:    "mcp-quota-agent",
			AuthSubject: "bridge-token:abcd1234",
			Scopes:      []Scope{ScopeActionQuotaRefresh},
		},
		Authority: Authority{
			Owner:             AuthorityOwnerSidecar,
			Endpoint:          "/v0/management/gettokens/quota-refresh",
			GeneratedAtUnixMs: fixedBridgeTime().UnixMilli(),
		},
		ClientID: "mcp-quota-agent",
	})
	if err != nil {
		t.Fatalf("sidecar HTTP executor returned error: %v", err)
	}

	action, ok := result.acceptedActionResult()
	if !ok {
		t.Fatalf("expected accepted action result, got %#v", result)
	}
	if action.OperationID != "bro_quota_refresh_010" || action.LedgerRef != "ledger_quota_refresh_010" || action.SidecarRequestID != "scr_quota_refresh_010" {
		t.Fatalf("unexpected accepted action envelope: %#v", action)
	}
	if len(transport.calls) != 1 {
		t.Fatalf("expected one sidecar call, got %d", len(transport.calls))
	}

	call := transport.calls[0]
	if call.Path != "/v0/management/gettokens/quota-refresh" {
		t.Fatalf("path=%q, want quota refresh endpoint", call.Path)
	}
	if got := call.Headers["X-GetTokens-Bridge-Idempotency-Key-SHA256"]; got != HashSecret(rawIdempotencyKey) {
		t.Fatalf("idempotency hash header=%q", got)
	}
	for _, forbiddenHeader := range []string{"Authorization", "Cookie", "Idempotency-Key"} {
		if _, ok := call.Headers[forbiddenHeader]; ok {
			t.Fatalf("unexpected forbidden header %q in sidecar request", forbiddenHeader)
		}
	}
	if strings.Contains(string(call.Body), rawIdempotencyKey) {
		t.Fatalf("sidecar body leaked raw idempotency key: %s", string(call.Body))
	}
	for name, value := range call.Headers {
		if strings.Contains(value, rawIdempotencyKey) {
			t.Fatalf("sidecar header %q leaked raw idempotency key: %#v", name, call.Headers)
		}
	}
}

func TestMCPAdapterWithSidecarHTTPExecutorAuthorizesThenInvokesSidecarTransport(t *testing.T) {
	transport := &recordingSidecarTransport{
		response: SidecarHTTPResponse{
			StatusCode: 200,
			Body: mustJSONBytes(t, map[string]any{
				"status":             string(StatusOK),
				"data":               map[string]any{"accounts": []map[string]any{{"account_key": "acct_codex_001", "requestable": true}}},
				"snapshot_id":        "snap_accounts_011",
				"sidecar_request_id": "scr_accounts_011",
			}),
		},
	}
	adapter := newTestMCPAdapter(t, NewSidecarHTTPExecutor(transport))
	client := bridgeTestClient("mcp-accounts-agent", "mcp-secret-token", []ScopeGrant{
		{Scope: ScopeAccountsRead},
	}, []Transport{TransportMCP}, nil)

	response := adapter.HandleTool(context.Background(), MCPToolRequest{
		ToolName:  "gettokens.accounts.summary",
		Token:     "mcp-secret-token",
		Client:    client,
		RequestID: "mcp_req_accounts_011",
		Query: map[string]any{
			"include_disabled": false,
		},
		Caller: &CallerContext{PeerAddress: "127.0.0.1:51515"},
	})

	if response.Status != StatusOK || response.Error != nil {
		t.Fatalf("expected ok response, got %#v", response)
	}
	if !response.SidecarInvoked {
		t.Fatalf("successful read must report sidecar invocation")
	}
	if len(transport.calls) != 1 {
		t.Fatalf("expected one sidecar transport call, got %d", len(transport.calls))
	}
	if transport.calls[0].Path != "/v0/management/gettokens/accounts/summary" {
		t.Fatalf("unexpected sidecar path: %#v", transport.calls[0])
	}
}

func TestMCPAdapterMissingScopeDoesNotReachSidecarTransport(t *testing.T) {
	transport := &recordingSidecarTransport{
		err: errors.New("transport should not be called"),
	}
	adapter := newTestMCPAdapter(t, NewSidecarHTTPExecutor(transport))
	client := bridgeTestClient("mcp-model-agent", "mcp-secret-token", []ScopeGrant{
		{Scope: ScopeModelsRead},
	}, []Transport{TransportMCP}, nil)

	response := adapter.HandleTool(context.Background(), MCPToolRequest{
		ToolName:  "gettokens.routes.diagnostics",
		Token:     "mcp-secret-token",
		Client:    client,
		RequestID: "mcp_req_route_diag_010",
		Caller:    &CallerContext{PeerAddress: "127.0.0.1:51515"},
	})

	if response.Status != StatusRejected || response.Error == nil || response.Error.Code != ErrorMissingScope {
		t.Fatalf("expected missing_scope rejection, got %#v", response)
	}
	if len(transport.calls) != 0 {
		t.Fatalf("missing scope must not reach sidecar transport")
	}
}

func TestSidecarHTTPExecutorClassifiesFailureTaxonomy(t *testing.T) {
	baseReadRequest := OperationRequest{
		Version:   Version,
		RequestID: "brq_accounts_failure_010",
		Transport: TransportMCP,
		Operation: OperationAccountsSummary,
		Query: map[string]any{
			"include_disabled": false,
		},
		Actor: Actor{
			ClientID:    "mcp-accounts-agent",
			AuthSubject: "bridge-token:abcd1234",
			Scopes:      []Scope{ScopeAccountsRead},
		},
		Authority: Authority{
			Owner:             AuthorityOwnerSidecar,
			Endpoint:          "/v0/management/gettokens/accounts/summary",
			GeneratedAtUnixMs: fixedBridgeTime().UnixMilli(),
		},
		Caller: &CallerContext{PeerAddress: "127.0.0.1:51515"},
	}
	baseActionRequest := OperationRequest{
		Version:        Version,
		RequestID:      "brq_quota_failure_010",
		Transport:      TransportMCP,
		Operation:      OperationActionQuotaRefresh,
		IdempotencyKey: "retry-key-secret",
		Query: map[string]any{
			"account_key": "acct_codex_001",
		},
		Actor: Actor{
			ClientID:    "mcp-quota-agent",
			AuthSubject: "bridge-token:abcd1234",
			Scopes:      []Scope{ScopeActionQuotaRefresh},
		},
		Authority: Authority{
			Owner:             AuthorityOwnerSidecar,
			Endpoint:          "/v0/management/gettokens/quota-refresh",
			GeneratedAtUnixMs: fixedBridgeTime().UnixMilli(),
		},
	}

	tests := []struct {
		name                 string
		req                  OperationRequest
		response             SidecarHTTPResponse
		transportErr         error
		wantCode             ErrorCode
		wantRecoverable      bool
		wantSidecarErrorCode string
		wantMessage          string
		forbiddenFragments   []string
	}{
		{
			name: "http non-2xx",
			req:  baseReadRequest,
			response: SidecarHTTPResponse{
				StatusCode: 503,
				Body:       []byte(`{"error":"Authorization: Bearer raw-secret-token"}`),
			},
			wantCode:             ErrorSidecarUnavailable,
			wantRecoverable:      true,
			wantSidecarErrorCode: "http_503",
			wantMessage:          "sidecar returned HTTP 503",
			forbiddenFragments:   []string{"Authorization", "raw-secret-token"},
		},
		{
			name:                 "timeout transport error",
			req:                  baseReadRequest,
			transportErr:         errors.New(`upstream timeout; Cookie=session_cookie_secret; idempotency_key=retry-key-secret`),
			wantCode:             ErrorSidecarUnavailable,
			wantRecoverable:      true,
			wantSidecarErrorCode: "transport_timeout",
			wantMessage:          "sidecar HTTP transport timed out",
			forbiddenFragments:   []string{"Cookie", "session_cookie_secret", "retry-key-secret"},
		},
		{
			name: "malformed json",
			req:  baseReadRequest,
			response: SidecarHTTPResponse{
				StatusCode: 200,
				Body:       []byte(`{"status":"ok","data":{"bad":"Authorization=Bearer raw-secret-token"}`),
			},
			wantCode:             ErrorSidecarUnavailable,
			wantRecoverable:      false,
			wantSidecarErrorCode: "invalid_json",
			wantMessage:          "sidecar returned malformed JSON",
			forbiddenFragments:   []string{"Authorization", "raw-secret-token"},
		},
		{
			name: "sidecar rejected envelope",
			req:  baseActionRequest,
			response: SidecarHTTPResponse{
				StatusCode: 409,
				Body: mustJSONBytes(t, map[string]any{
					"status": "rejected",
					"error": map[string]any{
						"code":               "quota_refresh_conflict",
						"message":            "Quota refresh conflict. Authorization=Bearer raw-secret-token Cookie=session_cookie_secret idempotency_key=retry-key-secret",
						"recoverable":        true,
						"sidecar_error_code": "quota_refresh_conflict",
					},
				}),
			},
			wantCode:             ErrorOperationRejected,
			wantRecoverable:      true,
			wantSidecarErrorCode: "quota_refresh_conflict",
			wantMessage:          "Quota refresh conflict. [REDACTED] [REDACTED] [REDACTED]",
			forbiddenFragments:   []string{"Authorization", "raw-secret-token", "Cookie", "session_cookie_secret", "retry-key-secret"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			transport := &recordingSidecarTransport{
				response: tt.response,
				err:      tt.transportErr,
			}
			executor := NewSidecarHTTPExecutor(transport)

			_, err := executor.Execute(context.Background(), tt.req)
			if err == nil {
				t.Fatalf("expected executor error")
			}

			var canonicalErr *canonicalExecutorError
			if !errors.As(err, &canonicalErr) {
				t.Fatalf("expected canonicalExecutorError, got %T: %v", err, err)
			}
			if canonicalErr.Code != tt.wantCode {
				t.Fatalf("code=%q, want %q", canonicalErr.Code, tt.wantCode)
			}
			if canonicalErr.Recoverable != tt.wantRecoverable {
				t.Fatalf("recoverable=%v, want %v", canonicalErr.Recoverable, tt.wantRecoverable)
			}
			if canonicalErr.SidecarErrorCode != tt.wantSidecarErrorCode {
				t.Fatalf("sidecar_error_code=%q, want %q", canonicalErr.SidecarErrorCode, tt.wantSidecarErrorCode)
			}
			if canonicalErr.Message != tt.wantMessage {
				t.Fatalf("message=%q, want %q", canonicalErr.Message, tt.wantMessage)
			}
			for _, forbidden := range tt.forbiddenFragments {
				if strings.Contains(canonicalErr.Error(), forbidden) || strings.Contains(canonicalErr.Message, forbidden) || strings.Contains(canonicalErr.SidecarErrorCode, forbidden) {
					t.Fatalf("canonical executor error leaked secret %q: %#v", forbidden, canonicalErr)
				}
			}
		})
	}
}

func TestMCPAdapterWithSidecarHTTPExecutorProjectsCanonicalFailureTaxonomy(t *testing.T) {
	tests := []struct {
		name                 string
		toolName             string
		client               *Client
		query                map[string]any
		idempotencyKey       string
		response             SidecarHTTPResponse
		transportErr         error
		wantCode             ErrorCode
		wantRecoverable      bool
		wantSidecarErrorCode string
		forbiddenFragments   []string
	}{
		{
			name:     "transport timeout becomes sidecar unavailable",
			toolName: "gettokens.accounts.summary",
			client: bridgeTestClient("mcp-accounts-agent", "mcp-secret-token", []ScopeGrant{
				{Scope: ScopeAccountsRead},
			}, []Transport{TransportMCP}, nil),
			query:                map[string]any{"include_disabled": false},
			transportErr:         errors.New(`transport timeout Authorization=Bearer raw-secret-token Cookie=session_cookie_secret`),
			wantCode:             ErrorSidecarUnavailable,
			wantRecoverable:      true,
			wantSidecarErrorCode: "transport_timeout",
			forbiddenFragments:   []string{"Authorization", "raw-secret-token", "Cookie", "session_cookie_secret"},
		},
		{
			name:     "sidecar rejected envelope becomes operation rejected",
			toolName: "gettokens.actions.quota_refresh",
			client: bridgeTestClient("mcp-quota-agent", "mcp-secret-token", []ScopeGrant{
				{Scope: ScopeActionQuotaRefresh},
			}, []Transport{TransportMCP}, nil),
			query:           map[string]any{"account_key": "acct_codex_001"},
			idempotencyKey:  "retry-key-secret",
			wantCode:        ErrorOperationRejected,
			wantRecoverable: false,
			response: SidecarHTTPResponse{
				StatusCode: 409,
				Body: mustJSONBytes(t, map[string]any{
					"status": "rejected",
					"error": map[string]any{
						"code":               "quota_refresh_denied",
						"message":            "Quota refresh denied. idempotency_key=retry-key-secret",
						"recoverable":        false,
						"sidecar_error_code": "quota_refresh_denied",
					},
				}),
			},
			wantSidecarErrorCode: "quota_refresh_denied",
			forbiddenFragments:   []string{"retry-key-secret"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			transport := &recordingSidecarTransport{
				response: tt.response,
				err:      tt.transportErr,
			}
			adapter := newTestMCPAdapter(t, NewSidecarHTTPExecutor(transport))

			response := adapter.HandleTool(context.Background(), MCPToolRequest{
				ToolName:       tt.toolName,
				Token:          "mcp-secret-token",
				Client:         tt.client,
				RequestID:      "mcp_req_failure_taxonomy_010",
				Query:          tt.query,
				IdempotencyKey: tt.idempotencyKey,
				Caller:         &CallerContext{PeerAddress: "127.0.0.1:51515"},
			})

			if response.Status != StatusRejected {
				t.Fatalf("status=%q, want rejected", response.Status)
			}
			if response.Error == nil {
				t.Fatalf("expected canonical error response")
			}
			if response.Error.Code != tt.wantCode {
				t.Fatalf("error code=%q, want %q", response.Error.Code, tt.wantCode)
			}
			if response.Error.Recoverable != tt.wantRecoverable {
				t.Fatalf("recoverable=%v, want %v", response.Error.Recoverable, tt.wantRecoverable)
			}
			if response.Error.SidecarErrorCode != tt.wantSidecarErrorCode {
				t.Fatalf("sidecar_error_code=%q, want %q", response.Error.SidecarErrorCode, tt.wantSidecarErrorCode)
			}
			if !response.SidecarInvoked || !response.Error.SidecarInvoked {
				t.Fatalf("sidecar executor failure must report sidecar invocation")
			}
			if response.Data != nil || response.OperationRef != nil {
				t.Fatalf("canonical failure must not return data or operation ref: %#v", response)
			}
			payload := mustJSON(t, response)
			for _, forbidden := range tt.forbiddenFragments {
				if strings.Contains(payload, forbidden) {
					t.Fatalf("canonical response leaked secret %q: %s", forbidden, payload)
				}
			}
		})
	}
}

type recordingSidecarTransport struct {
	response SidecarHTTPResponse
	err      error
	calls    []SidecarHTTPRequest
}

func (t *recordingSidecarTransport) RoundTrip(_ context.Context, req SidecarHTTPRequest) (SidecarHTTPResponse, error) {
	t.calls = append(t.calls, req)
	if t.err != nil {
		return SidecarHTTPResponse{}, t.err
	}
	return t.response, nil
}

func mustJSONBytes(t *testing.T, value any) []byte {
	t.Helper()
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("marshal json bytes: %v", err)
	}
	return raw
}
