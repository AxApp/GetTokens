//go:build protocolbridge_unrestricted_listener

package protocolbridge

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestMCPAdapterWithFactoryExecutorAuthorizesBeforeSidecarAndKeepsTokenOutOfCanonicalSurface(t *testing.T) {
	type observedRequest struct {
		path          string
		authorization string
		body          sidecarHTTPRequestBody
	}

	var providerCalls int32
	var serverCalls int32
	received := make(chan observedRequest, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&serverCalls, 1)
		defer r.Body.Close()
		var body sidecarHTTPRequestBody
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode request body: %v", err)
		}
		received <- observedRequest{
			path:          r.URL.Path,
			authorization: r.Header.Get("Authorization"),
			body:          body,
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(mustJSONBytes(t, map[string]any{
			"status":             string(StatusOK),
			"data":               map[string]any{"accounts": []map[string]any{{"account_key": "acct_codex_001", "requestable": true}}},
			"snapshot_id":        "snap_accounts_factory_010",
			"sidecar_request_id": "scr_accounts_factory_010",
		}))
	}))
	defer server.Close()

	executor, err := NewSidecarHTTPExecutorFromEndpoint(SidecarHTTPEndpoint{
		ProfileID: "dev-profile",
		BaseURL:   server.URL + "/sidecar-root",
	}, WithSidecarHTTPExecutorBearerTokenProvider(func(_ context.Context, endpoint SidecarHTTPEndpoint) (string, error) {
		atomic.AddInt32(&providerCalls, 1)
		if endpoint.ProfileID != "dev-profile" {
			t.Fatalf("unexpected endpoint passed to token provider: %#v", endpoint)
		}
		return "sidecar-bearer-secret", nil
	}))
	if err != nil {
		t.Fatalf("create endpoint executor: %v", err)
	}

	adapter := newTestMCPAdapter(t, executor)

	missingScopeClient := bridgeTestClient("mcp-model-agent", "mcp-secret-token", []ScopeGrant{
		{Scope: ScopeModelsRead},
	}, []Transport{TransportMCP}, nil)
	rejected := adapter.HandleTool(context.Background(), MCPToolRequest{
		ToolName:  "gettokens.routes.diagnostics",
		Token:     "mcp-secret-token",
		Client:    missingScopeClient,
		RequestID: "mcp_req_factory_missing_scope_010",
		Caller:    &CallerContext{PeerAddress: "127.0.0.1:51515"},
	})
	if rejected.Status != StatusRejected || rejected.Error == nil || rejected.Error.Code != ErrorMissingScope {
		t.Fatalf("expected missing_scope rejection, got %#v", rejected)
	}
	if got := atomic.LoadInt32(&providerCalls); got != 0 {
		t.Fatalf("token provider should not run before authorize, got %d", got)
	}
	if got := atomic.LoadInt32(&serverCalls); got != 0 {
		t.Fatalf("sidecar should not be invoked before authorize, got %d", got)
	}

	allowedClient := bridgeTestClient("mcp-accounts-agent", "mcp-secret-token", []ScopeGrant{
		{Scope: ScopeAccountsRead},
	}, []Transport{TransportMCP}, nil)
	response := adapter.HandleTool(context.Background(), MCPToolRequest{
		ToolName:  "gettokens.accounts.summary",
		Token:     "mcp-secret-token",
		Client:    allowedClient,
		RequestID: "mcp_req_factory_accounts_010",
		Query: map[string]any{
			"include_disabled": false,
		},
		Caller: &CallerContext{PeerAddress: "127.0.0.1:51515"},
	})
	if response.Status != StatusOK || response.Error != nil || !response.SidecarInvoked {
		t.Fatalf("expected successful MCP response, got %#v", response)
	}
	if got := atomic.LoadInt32(&providerCalls); got != 1 {
		t.Fatalf("token provider calls=%d, want 1", got)
	}
	if got := atomic.LoadInt32(&serverCalls); got != 1 {
		t.Fatalf("sidecar server calls=%d, want 1", got)
	}

	var observed observedRequest
	select {
	case observed = <-received:
	default:
		t.Fatal("expected observed sidecar request")
	}
	if observed.path != "/sidecar-root/v0/management/gettokens/accounts/summary" {
		t.Fatalf("unexpected sidecar path: %q", observed.path)
	}
	if observed.authorization != "Bearer sidecar-bearer-secret" {
		t.Fatalf("authorization header=%q", observed.authorization)
	}
	bodyPayload := mustJSON(t, observed.body)
	if strings.Contains(bodyPayload, "sidecar-bearer-secret") {
		t.Fatalf("sidecar request body leaked bearer token: %s", bodyPayload)
	}
	responsePayload := mustJSON(t, response)
	for _, forbidden := range []string{"sidecar-bearer-secret", "Authorization", "Cookie"} {
		if strings.Contains(responsePayload, forbidden) {
			t.Fatalf("canonical MCP response leaked %q: %s", forbidden, responsePayload)
		}
	}
}

func TestSidecarHTTPExecutorWithRealTransportPreservesRequestContract(t *testing.T) {
	type observedRequest struct {
		method        string
		path          string
		headers       http.Header
		body          sidecarHTTPRequestBody
		authorization string
	}

	received := make(chan observedRequest, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		var body sidecarHTTPRequestBody
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode request body: %v", err)
		}
		received <- observedRequest{
			method:        r.Method,
			path:          r.URL.Path,
			headers:       r.Header.Clone(),
			body:          body,
			authorization: r.Header.Get("Authorization"),
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(mustJSONBytes(t, map[string]any{
			"status":             string(StatusOK),
			"data":               map[string]any{"accounts": []map[string]any{{"account_key": "acct_codex_001", "requestable": true}}},
			"snapshot_id":        "snap_accounts_http_010",
			"ledger_ref":         "ledger_accounts_http_010",
			"sidecar_request_id": "scr_accounts_http_010",
		}))
	}))
	defer server.Close()

	transport, err := NewSidecarHTTPTransport(server.URL+"/sidecar-root", WithSidecarHTTPBearerToken("sidecar-bearer-secret"))
	if err != nil {
		t.Fatalf("create real sidecar HTTP transport: %v", err)
	}
	executor := NewSidecarHTTPExecutor(transport)

	result, err := executor.Execute(context.Background(), OperationRequest{
		Version:   Version,
		RequestID: "brq_accounts_http_010",
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
		t.Fatalf("execute via real HTTP transport: %v", err)
	}

	read, ok := result.readResult()
	if !ok {
		t.Fatalf("expected read result, got %#v", result)
	}
	if read.SnapshotID != "snap_accounts_http_010" || read.LedgerRef != "ledger_accounts_http_010" || read.SidecarRequestID != "scr_accounts_http_010" {
		t.Fatalf("unexpected read result: %#v", read)
	}

	var observed observedRequest
	select {
	case observed = <-received:
	case <-time.After(2 * time.Second):
		t.Fatal("did not receive request at httptest server")
	}

	if observed.method != http.MethodPost {
		t.Fatalf("method=%q, want POST", observed.method)
	}
	if observed.path != "/sidecar-root/v0/management/gettokens/accounts/summary" {
		t.Fatalf("path=%q", observed.path)
	}
	if observed.authorization != "Bearer sidecar-bearer-secret" {
		t.Fatalf("authorization header=%q", observed.authorization)
	}
	if got := observed.headers.Get("X-GetTokens-Bridge-Request-ID"); got != "brq_accounts_http_010" {
		t.Fatalf("request id header=%q", got)
	}
	if got := observed.headers.Get("X-GetTokens-Bridge-Actor-Client-ID"); got != "mcp-accounts-agent" {
		t.Fatalf("actor client header=%q", got)
	}
	if observed.body.Operation != OperationAccountsSummary || observed.body.Transport != TransportMCP {
		t.Fatalf("unexpected request body: %#v", observed.body)
	}
	if observed.body.Caller == nil || observed.body.Caller.PeerAddress != "127.0.0.1:51515" {
		t.Fatalf("caller mapping mismatch: %#v", observed.body.Caller)
	}
	payload := mustJSON(t, observed.body)
	for _, forbidden := range []string{"sidecar-bearer-secret", "Authorization", "Cookie"} {
		if strings.Contains(payload, forbidden) {
			t.Fatalf("request body leaked forbidden value %q: %s", forbidden, payload)
		}
	}
}

func TestSidecarHTTPExecutorWithRealTransportClassifiesHTTPFailureTaxonomy(t *testing.T) {
	baseReadRequest := OperationRequest{
		Version:   Version,
		RequestID: "brq_accounts_http_failure_010",
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
		RequestID:      "brq_quota_http_failure_010",
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
		handler              http.HandlerFunc
		options              []SidecarHTTPTransportOption
		wantCode             ErrorCode
		wantRecoverable      bool
		wantSidecarErrorCode string
		wantMessage          string
		forbiddenFragments   []string
	}{
		{
			name: "http non-2xx",
			req:  baseReadRequest,
			handler: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusServiceUnavailable)
				_, _ = w.Write([]byte(`{"error":"Authorization: Bearer raw-secret-token"}`))
			},
			wantCode:             ErrorSidecarUnavailable,
			wantRecoverable:      true,
			wantSidecarErrorCode: "http_503",
			wantMessage:          "sidecar returned HTTP 503",
			forbiddenFragments:   []string{"Authorization", "raw-secret-token"},
		},
		{
			name: "malformed json",
			req:  baseReadRequest,
			handler: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(`{"status":"ok","data":{"bad":"Authorization=Bearer raw-secret-token"}`))
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
			handler: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusConflict)
				_, _ = w.Write(mustJSONBytes(t, map[string]any{
					"status": "rejected",
					"error": map[string]any{
						"code":               "quota_refresh_conflict",
						"message":            "Quota refresh conflict. Authorization=Bearer raw-secret-token Cookie=session_cookie_secret idempotency_key=retry-key-secret",
						"recoverable":        true,
						"sidecar_error_code": "quota_refresh_conflict",
					},
				}))
			},
			wantCode:             ErrorOperationRejected,
			wantRecoverable:      true,
			wantSidecarErrorCode: "quota_refresh_conflict",
			wantMessage:          "Quota refresh conflict. [REDACTED] [REDACTED] [REDACTED]",
			forbiddenFragments:   []string{"Authorization", "raw-secret-token", "Cookie", "session_cookie_secret", "retry-key-secret"},
		},
		{
			name: "transport timeout",
			req:  baseReadRequest,
			handler: func(w http.ResponseWriter, r *http.Request) {
				time.Sleep(150 * time.Millisecond)
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write(mustJSONBytes(t, map[string]any{
					"status": string(StatusOK),
					"data":   map[string]any{"accounts": []any{}},
				}))
			},
			options:              []SidecarHTTPTransportOption{WithSidecarHTTPTimeout(25 * time.Millisecond), WithSidecarHTTPBearerToken("sidecar-bearer-secret")},
			wantCode:             ErrorSidecarUnavailable,
			wantRecoverable:      true,
			wantSidecarErrorCode: "transport_timeout",
			wantMessage:          "sidecar HTTP transport timed out",
			forbiddenFragments:   []string{"sidecar-bearer-secret", "Authorization", "Cookie", "retry-key-secret"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(tt.handler)
			defer server.Close()

			transport, err := NewSidecarHTTPTransport(server.URL, tt.options...)
			if err != nil {
				t.Fatalf("create real sidecar HTTP transport: %v", err)
			}
			executor := NewSidecarHTTPExecutor(transport)

			_, err = executor.Execute(context.Background(), tt.req)
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

func TestSidecarHTTPExecutorWithRealTransportHonorsContextDeadline(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(150 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(mustJSONBytes(t, map[string]any{
			"status": string(StatusOK),
			"data":   map[string]any{"accounts": []any{}},
		}))
	}))
	defer server.Close()

	transport, err := NewSidecarHTTPTransport(server.URL, WithSidecarHTTPBearerToken("sidecar-bearer-secret"))
	if err != nil {
		t.Fatalf("create real sidecar HTTP transport: %v", err)
	}
	executor := NewSidecarHTTPExecutor(transport)

	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Millisecond)
	defer cancel()
	_, err = executor.Execute(ctx, OperationRequest{
		Version:   Version,
		RequestID: "brq_accounts_http_context_timeout_010",
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
	})
	if err == nil {
		t.Fatal("expected context deadline error")
	}

	var canonicalErr *canonicalExecutorError
	if !errors.As(err, &canonicalErr) {
		t.Fatalf("expected canonicalExecutorError, got %T: %v", err, err)
	}
	if canonicalErr.Code != ErrorSidecarUnavailable || canonicalErr.SidecarErrorCode != "transport_timeout" || !canonicalErr.Recoverable {
		t.Fatalf("unexpected canonical error: %#v", canonicalErr)
	}
	if strings.Contains(canonicalErr.Error(), "sidecar-bearer-secret") {
		t.Fatalf("canonical error leaked bearer token: %#v", canonicalErr)
	}
}
