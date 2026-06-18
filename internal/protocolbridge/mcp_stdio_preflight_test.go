package protocolbridge

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestMCPStdioPreflightAllowsOnlyFixtureToolsAndResources(t *testing.T) {
	preflight := newTestMCPStdioPreflight(t)

	if _, err := preflight.Tool(MCPToolRequest{
		ToolName: " gettokens.accounts.summary ",
		Query: map[string]any{
			"include_disabled": false,
		},
	}); err != nil {
		t.Fatalf("expected mapped tool to pass preflight: %v", err)
	}

	if _, err := preflight.Resource(MCPResourceRequest{
		URI: " gettokens://bridge/manifest ",
	}); err != nil {
		t.Fatalf("expected mapped resource to pass preflight: %v", err)
	}

	if _, err := preflight.Tool(MCPToolRequest{
		ToolName: "gettokens.unknown",
	}); err == nil {
		t.Fatal("expected unknown tool to be rejected at stdio preflight")
	}

	if _, err := preflight.Resource(MCPResourceRequest{
		URI: "gettokens://bridge/token-hash",
	}); err == nil {
		t.Fatal("expected unknown resource to be rejected at stdio preflight")
	}
}

func TestMCPStdioPreflightRejectsCredentialBearingInput(t *testing.T) {
	preflight := newTestMCPStdioPreflight(t)

	tests := []struct {
		name string
		req  MCPToolRequest
	}{
		{
			name: "authorization header map",
			req: MCPToolRequest{
				ToolName: "gettokens.accounts.summary",
				Query: map[string]any{
					"headers": map[string]any{
						"Authorization": "Bearer raw-secret-token",
					},
				},
			},
		},
		{
			name: "cookie string payload",
			req: MCPToolRequest{
				ToolName: "gettokens.accounts.summary",
				Query: map[string]any{
					"notes": "Cookie=session_cookie_secret",
				},
			},
		},
		{
			name: "access token key",
			req: MCPToolRequest{
				ToolName: "gettokens.accounts.summary",
				Query: map[string]any{
					"access_token": "raw-secret-token",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := preflight.Tool(tt.req); err == nil {
				t.Fatal("expected credential-bearing tool input to be rejected")
			}
		})
	}

	if _, err := preflight.Resource(MCPResourceRequest{
		URI: "gettokens://bridge/schema?cookie=session_cookie_secret",
	}); err == nil {
		t.Fatal("expected credential-bearing resource URI to be rejected")
	}
}

func TestMCPStdioPreflightRejectsToolQueryKeysOutsideCanonicalSchemaAllowlist(t *testing.T) {
	preflight := newTestMCPStdioPreflight(t)

	tests := []struct {
		name string
		req  MCPToolRequest
	}{
		{
			name: "accounts summary rejects models/account key field",
			req: MCPToolRequest{
				ToolName: "gettokens.accounts.summary",
				Query: map[string]any{
					"account_key": "acct_codex_primary",
				},
			},
		},
		{
			name: "models supported rejects accounts detail level field",
			req: MCPToolRequest{
				ToolName: "gettokens.models.supported",
				Query: map[string]any{
					"detail_level": "summary",
				},
			},
		},
		{
			name: "safe action rejects arbitrary non-schema field",
			req: MCPToolRequest{
				ToolName: "gettokens.actions.quota_refresh",
				Query: map[string]any{
					"surprise_flag": true,
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := preflight.Tool(tt.req); err == nil {
				t.Fatal("expected schema-outside tool query key to be rejected")
			}
		})
	}
}

func TestMCPStdioPreflightRejectsMissingRequiredOrWrongTypedCanonicalQuery(t *testing.T) {
	preflight := newTestMCPStdioPreflight(t)

	tests := []struct {
		name string
		req  MCPToolRequest
	}{
		{
			name: "routes diagnostics missing required model",
			req: MCPToolRequest{
				ToolName: "gettokens.routes.diagnostics",
				Query: map[string]any{
					"protocol": "codex",
				},
			},
		},
		{
			name: "accounts summary include_disabled must be boolean",
			req: MCPToolRequest{
				ToolName: "gettokens.accounts.summary",
				Query: map[string]any{
					"include_disabled": "false",
				},
			},
		},
		{
			name: "accounts summary kinds must be array of strings",
			req: MCPToolRequest{
				ToolName: "gettokens.accounts.summary",
				Query: map[string]any{
					"kinds": []any{"auth-file", true},
				},
			},
		},
		{
			name: "models supported account_key must be string",
			req: MCPToolRequest{
				ToolName: "gettokens.models.supported",
				Query: map[string]any{
					"account_key": []string{"acct_codex_primary"},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := preflight.Tool(tt.req); err == nil {
				t.Fatal("expected canonical query type/required validation rejection")
			}
		})
	}
}

func TestMCPStdioPreflightRejectsCanonicalQueryEnumValues(t *testing.T) {
	preflight := newTestMCPStdioPreflight(t)

	tests := []struct {
		name string
		req  MCPToolRequest
	}{
		{
			name: "accounts summary rejects unknown protocol",
			req: MCPToolRequest{
				ToolName: "gettokens.accounts.summary",
				Query: map[string]any{
					"protocol": "gemini",
				},
			},
		},
		{
			name: "accounts summary rejects unknown detail level",
			req: MCPToolRequest{
				ToolName: "gettokens.accounts.summary",
				Query: map[string]any{
					"detail_level": "full",
				},
			},
		},
		{
			name: "accounts summary rejects unknown kind",
			req: MCPToolRequest{
				ToolName: "gettokens.accounts.summary",
				Query: map[string]any{
					"kinds": []any{"auth-file", "raw-cookie"},
				},
			},
		},
		{
			name: "routes diagnostics rejects unknown probe mode",
			req: MCPToolRequest{
				ToolName: "gettokens.routes.diagnostics",
				Query: map[string]any{
					"protocol":   "codex",
					"model":      "gpt-5-codex",
					"probe_mode": "live",
				},
			},
		},
		{
			name: "action rejects probe mode outside action enum",
			req: MCPToolRequest{
				ToolName: "gettokens.actions.diagnostics_probe",
				Query: map[string]any{
					"probe_mode": "none",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := preflight.Tool(tt.req); err == nil {
				t.Fatal("expected canonical query enum validation rejection")
			}
		})
	}
}

func TestMCPStdioPreflightAllowsCanonicalQueryTypesAndRequiredFields(t *testing.T) {
	preflight := newTestMCPStdioPreflight(t)

	if _, err := preflight.Tool(MCPToolRequest{
		ToolName: "gettokens.routes.diagnostics",
		Query: map[string]any{
			"protocol":                 "codex",
			"model":                    "gpt-5-codex",
			"account_key":              "acct_codex_primary",
			"include_recent_decisions": true,
		},
	}); err != nil {
		t.Fatalf("expected canonical routes diagnostics query to pass: %v", err)
	}

	if _, err := preflight.Tool(MCPToolRequest{
		ToolName: "gettokens.accounts.summary",
		Query: map[string]any{
			"include_disabled": false,
			"kinds":            []string{"auth-file", "codex-api-key"},
			"protocol":         "codex",
			"detail_level":     "summary",
		},
	}); err != nil {
		t.Fatalf("expected canonical accounts summary query to pass: %v", err)
	}

	if _, err := preflight.Tool(MCPToolRequest{
		ToolName: "gettokens.accounts.summary",
		Query: map[string]any{
			"kinds":        []any{"auth-file", "openai-compatible"},
			"protocol":     "anthropic",
			"detail_level": "diagnostic_refs",
		},
	}); err != nil {
		t.Fatalf("expected canonical accounts summary enum query to pass: %v", err)
	}
}

func TestMCPAdapterStdioPreflightRejectsCredentialBearingToolInputBeforeExecutor(t *testing.T) {
	executor := NewStubOperationExecutor()
	persister := &recordingAuditPersister{}
	adapter := newTestMCPAdapter(t, executor, WithMCPAuditPersister(persister))
	client := bridgeTestClient("mcp-accounts-agent", "mcp-secret-token", []ScopeGrant{
		{Scope: ScopeAccountsRead},
	}, []Transport{TransportMCP}, nil)

	response := adapter.HandleTool(context.Background(), MCPToolRequest{
		ToolName: "gettokens.accounts.summary",
		Token:    "mcp-secret-token",
		Client:   client,
		Query: map[string]any{
			"headers": map[string]any{
				"Authorization": "Bearer raw-secret-token",
			},
			"include_disabled": false,
		},
		RequestID: "mcp_req_stdio_preflight_001",
		Caller:    &CallerContext{PeerAddress: "127.0.0.1:51515"},
	})

	if response.Status != StatusRejected {
		t.Fatalf("status=%q, want rejected", response.Status)
	}
	if response.Error == nil || response.Error.Code != ErrorInvalidRequest {
		t.Fatalf("expected invalid_request, got %#v", response.Error)
	}
	if response.SidecarInvoked || response.Error.SidecarInvoked {
		t.Fatalf("credential-bearing input must not invoke sidecar/executor")
	}
	if executor.CallCount() != 0 {
		t.Fatalf("executor must not be called on stdio preflight rejection")
	}
	if len(persister.events) != 1 {
		t.Fatalf("expected one persisted audit event, got %d", len(persister.events))
	}
	if persister.events[0].ResultStatus != StatusRejected || persister.events[0].ErrorCode != ErrorInvalidRequest {
		t.Fatalf("unexpected persisted audit event: %#v", persister.events[0])
	}

	assertNoCredentialLeak(t, mustJSON(t, response))
	assertNoCredentialLeak(t, mustJSON(t, persister.events[0]))
}

func TestMCPAdapterStdioPreflightRejectsMissingRequiredOrWrongTypedCanonicalQueryBeforeExecutor(t *testing.T) {
	executor := NewStubOperationExecutor()
	persister := &recordingAuditPersister{}
	adapter := newTestMCPAdapter(t, executor, WithMCPAuditPersister(persister))
	client := bridgeTestClient("mcp-routes-agent", "mcp-secret-token", []ScopeGrant{
		{Scope: ScopeRoutesDiagnosticsRead},
	}, []Transport{TransportMCP}, nil)

	response := adapter.HandleTool(context.Background(), MCPToolRequest{
		ToolName: "gettokens.routes.diagnostics",
		Token:    "mcp-secret-token",
		Client:   client,
		Query: map[string]any{
			"protocol":                 "codex",
			"include_recent_decisions": "true",
		},
		RequestID: "mcp_req_stdio_schema_003",
		Caller:    &CallerContext{PeerAddress: "127.0.0.1:51515"},
	})

	if response.Status != StatusRejected {
		t.Fatalf("status=%q, want rejected", response.Status)
	}
	if response.Error == nil || response.Error.Code != ErrorInvalidRequest {
		t.Fatalf("expected invalid_request, got %#v", response.Error)
	}
	if response.SidecarInvoked || response.Error.SidecarInvoked {
		t.Fatalf("canonical query validation rejection must not invoke sidecar/executor")
	}
	if executor.CallCount() != 0 {
		t.Fatalf("executor must not be called on canonical query validation rejection")
	}
	if len(persister.events) != 1 {
		t.Fatalf("expected one persisted audit event, got %d", len(persister.events))
	}

	assertNoCredentialLeak(t, mustJSON(t, response))
	assertNoCredentialLeak(t, mustJSON(t, persister.events[0]))
}

func TestMCPAdapterStdioPreflightRejectsInvalidCanonicalQueryEnumBeforeExecutor(t *testing.T) {
	executor := NewStubOperationExecutor()
	persister := &recordingAuditPersister{}
	adapter := newTestMCPAdapter(t, executor, WithMCPAuditPersister(persister))
	client := bridgeTestClient("mcp-routes-agent", "mcp-secret-token", []ScopeGrant{
		{Scope: ScopeRoutesDiagnosticsRead},
	}, []Transport{TransportMCP}, nil)

	response := adapter.HandleTool(context.Background(), MCPToolRequest{
		ToolName: "gettokens.routes.diagnostics",
		Token:    "mcp-secret-token",
		Client:   client,
		Query: map[string]any{
			"protocol":   "gemini",
			"model":      "gpt-5-codex",
			"probe_mode": "dry_run",
		},
		RequestID: "mcp_req_stdio_schema_enum_001",
		Caller:    &CallerContext{PeerAddress: "127.0.0.1:51515"},
	})

	if response.Status != StatusRejected {
		t.Fatalf("status=%q, want rejected", response.Status)
	}
	if response.Error == nil || response.Error.Code != ErrorInvalidRequest {
		t.Fatalf("expected invalid_request, got %#v", response.Error)
	}
	if response.Error.Message == "bridge token is invalid" {
		t.Fatalf("unexpected auth failure instead of enum preflight rejection: %#v", response.Error)
	}
	if response.SidecarInvoked || response.Error.SidecarInvoked {
		t.Fatalf("canonical enum validation rejection must not invoke sidecar/executor")
	}
	if executor.CallCount() != 0 {
		t.Fatalf("executor must not be called on canonical enum validation rejection")
	}
	if len(persister.events) != 1 {
		t.Fatalf("expected one persisted audit event, got %d", len(persister.events))
	}
	if persister.events[0].ResultStatus != StatusRejected || persister.events[0].ErrorCode != ErrorInvalidRequest {
		t.Fatalf("unexpected persisted audit event: %#v", persister.events[0])
	}

	assertNoCredentialLeak(t, mustJSON(t, response))
	assertNoCredentialLeak(t, mustJSON(t, persister.events[0]))
}

func TestMCPAdapterStdioPreflightAllowsValidCanonicalQueryEnumBeforeExecutor(t *testing.T) {
	executor := NewStubOperationExecutor()
	executor.SetReadResult(OperationAccountsSummary, NewReadOperationResult(SidecarReadEnvelope{
		Data: map[string]any{
			"accounts": []map[string]any{
				{"account_key": "acct_claude_001", "requestable": true},
			},
		},
		SnapshotID:       "snap_accounts_enum_001",
		SidecarRequestID: "scr_accounts_enum_001",
	}))
	adapter := newTestMCPAdapter(t, executor)
	client := bridgeTestClient("mcp-accounts-agent", "mcp-secret-token", []ScopeGrant{
		{Scope: ScopeAccountsRead},
	}, []Transport{TransportMCP}, nil)

	response := adapter.HandleTool(context.Background(), MCPToolRequest{
		ToolName: "gettokens.accounts.summary",
		Token:    "mcp-secret-token",
		Client:   client,
		Query: map[string]any{
			"kinds":        []any{"auth-file", "openai-compatible"},
			"protocol":     "anthropic",
			"detail_level": "diagnostic_refs",
		},
		RequestID: "mcp_req_stdio_schema_enum_002",
		Caller:    &CallerContext{PeerAddress: "127.0.0.1:51515"},
	})

	if response.Status != StatusOK || response.Error != nil {
		t.Fatalf("expected ok canonical envelope, got %#v", response)
	}
	if !response.SidecarInvoked {
		t.Fatalf("valid enum query should continue to executor")
	}
	if executor.CallCount() != 1 {
		t.Fatalf("expected executor to be called once, got %d", executor.CallCount())
	}
	call := executor.Calls()[0]
	if call.Operation != OperationAccountsSummary {
		t.Fatalf("executor operation=%q, want %q", call.Operation, OperationAccountsSummary)
	}
	if got := call.Query["protocol"]; got != "anthropic" {
		t.Fatalf("executor query did not preserve protocol enum, got %#v", call.Query)
	}
}

func TestMCPAdapterStdioPreflightRejectsQueryKeysOutsideCanonicalSchemaBeforeExecutor(t *testing.T) {
	executor := NewStubOperationExecutor()
	persister := &recordingAuditPersister{}
	adapter := newTestMCPAdapter(t, executor, WithMCPAuditPersister(persister))
	client := bridgeTestClient("mcp-accounts-agent", "mcp-secret-token", []ScopeGrant{
		{Scope: ScopeAccountsRead},
	}, []Transport{TransportMCP}, nil)

	response := adapter.HandleTool(context.Background(), MCPToolRequest{
		ToolName: "gettokens.accounts.summary",
		Token:    "mcp-secret-token",
		Client:   client,
		Query: map[string]any{
			"account_key": "acct_codex_primary",
		},
		RequestID: "mcp_req_stdio_schema_001",
		Caller:    &CallerContext{PeerAddress: "127.0.0.1:51515"},
	})

	if response.Status != StatusRejected {
		t.Fatalf("status=%q, want rejected", response.Status)
	}
	if response.Error == nil || response.Error.Code != ErrorInvalidRequest {
		t.Fatalf("expected invalid_request, got %#v", response.Error)
	}
	if response.Error.Message == "bridge token is invalid" {
		t.Fatalf("unexpected auth failure instead of schema allowlist rejection: %#v", response.Error)
	}
	if response.Actor.ClientID != "mcp-accounts-agent" {
		t.Fatalf("expected auth-generated actor from authorize result, got %#v", response.Actor)
	}
	if response.Authority.Endpoint != "/v0/management/gettokens/accounts/summary" {
		t.Fatalf("expected canonical authority from authorize result, got %#v", response.Authority)
	}
	if response.SidecarInvoked || response.Error.SidecarInvoked {
		t.Fatalf("schema allowlist rejection must not invoke sidecar/executor")
	}
	if executor.CallCount() != 0 {
		t.Fatalf("executor must not be called on schema allowlist rejection")
	}
	if len(persister.events) != 1 {
		t.Fatalf("expected one persisted audit event, got %d", len(persister.events))
	}

	assertNoCredentialLeak(t, mustJSON(t, response))
	assertNoCredentialLeak(t, mustJSON(t, persister.events[0]))
}

func TestMCPAdapterAuthorizeRunsBeforeSchemaValidationPreflight(t *testing.T) {
	executor := NewStubOperationExecutor()
	adapter := newTestMCPAdapter(t, executor)
	client := bridgeTestClient("mcp-accounts-agent", "mcp-secret-token", []ScopeGrant{
		{Scope: ScopeRoutesDiagnosticsRead},
	}, []Transport{TransportMCP}, nil)

	response := adapter.HandleTool(context.Background(), MCPToolRequest{
		ToolName: "gettokens.routes.diagnostics",
		Token:    "wrong-secret-token",
		Client:   client,
		Query: map[string]any{
			"protocol": "codex",
		},
		RequestID: "mcp_req_stdio_schema_002",
		Caller:    &CallerContext{PeerAddress: "127.0.0.1:51515"},
	})

	if response.Status != StatusRejected {
		t.Fatalf("status=%q, want rejected", response.Status)
	}
	if response.Error == nil || response.Error.Code != ErrorInvalidRequest {
		t.Fatalf("expected invalid_request auth rejection, got %#v", response.Error)
	}
	if response.Error.Message != "bridge token is invalid" {
		t.Fatalf("expected authorize rejection to win before schema preflight, got %#v", response.Error)
	}
	if executor.CallCount() != 0 {
		t.Fatalf("executor must not be called when authorize rejects request")
	}
}

func TestMCPAdapterAuthorizeRunsBeforeEnumValidationPreflight(t *testing.T) {
	executor := NewStubOperationExecutor()
	adapter := newTestMCPAdapter(t, executor)
	client := bridgeTestClient("mcp-accounts-agent", "mcp-secret-token", []ScopeGrant{
		{Scope: ScopeAccountsRead},
	}, []Transport{TransportMCP}, nil)

	response := adapter.HandleTool(context.Background(), MCPToolRequest{
		ToolName: "gettokens.accounts.summary",
		Token:    "wrong-secret-token",
		Client:   client,
		Query: map[string]any{
			"protocol": "gemini",
		},
		RequestID: "mcp_req_stdio_schema_enum_003",
		Caller:    &CallerContext{PeerAddress: "127.0.0.1:51515"},
	})

	if response.Status != StatusRejected {
		t.Fatalf("status=%q, want rejected", response.Status)
	}
	if response.Error == nil || response.Error.Code != ErrorInvalidRequest {
		t.Fatalf("expected invalid_request auth rejection, got %#v", response.Error)
	}
	if response.Error.Message != "bridge token is invalid" {
		t.Fatalf("expected authorize rejection to win before enum preflight, got %#v", response.Error)
	}
	if executor.CallCount() != 0 {
		t.Fatalf("executor must not be called when authorize rejects request")
	}
}

func TestMCPAdapterStdioPreflightRejectsCredentialBearingResourceURI(t *testing.T) {
	adapter := newTestMCPAdapter(t, NewStubOperationExecutor())

	response := adapter.HandleResource(context.Background(), MCPResourceRequest{
		URI:       "gettokens://bridge/manifest?authorization=Bearer raw-secret-token",
		RequestID: "mcp_res_stdio_preflight_001",
	})

	if response.Status != StatusRejected {
		t.Fatalf("status=%q, want rejected", response.Status)
	}
	if response.Error == nil || response.Error.Code != ErrorInvalidRequest {
		t.Fatalf("expected invalid_request, got %#v", response.Error)
	}
	if response.SidecarInvoked || response.Error.SidecarInvoked {
		t.Fatalf("resource preflight rejection must not invoke sidecar")
	}

	assertNoCredentialLeak(t, mustJSON(t, response))
}

func newTestMCPStdioPreflight(t *testing.T) *MCPStdioPreflight {
	t.Helper()
	preflight, err := NewMCPStdioPreflight(mustLoadMCPMappingFixture(t))
	if err != nil {
		t.Fatalf("new MCP stdio preflight: %v", err)
	}
	return preflight
}

func assertNoCredentialLeak(t *testing.T, payload string) {
	t.Helper()
	var decoded any
	if err := json.Unmarshal([]byte(payload), &decoded); err != nil {
		t.Fatalf("payload must stay valid JSON: %v", err)
	}
	for _, forbidden := range []string{
		"raw-secret-token",
		"session_cookie_secret",
		"authorization",
		"cookie",
		"access_token",
		"refresh_token",
		"id_token",
		"api_key",
	} {
		if containsCaseInsensitive(payload, forbidden) {
			t.Fatalf("payload leaked forbidden fragment %q: %s", forbidden, payload)
		}
	}
}

func containsCaseInsensitive(text string, fragment string) bool {
	return strings.Contains(strings.ToLower(text), strings.ToLower(fragment))
}
