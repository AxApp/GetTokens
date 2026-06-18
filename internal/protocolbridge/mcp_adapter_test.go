package protocolbridge

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"testing"
)

func TestMCPAdapterReadToolAuthorizesThenExecutesCanonicalOperation(t *testing.T) {
	executor := NewStubOperationExecutor()
	executor.SetReadResult(OperationAccountsSummary, NewReadOperationResult(SidecarReadEnvelope{
		Data: map[string]any{
			"accounts": []map[string]any{
				{"account_key": "acct_codex_001", "requestable": true},
			},
		},
		SnapshotID:       "snap_accounts_001",
		SidecarRequestID: "scr_accounts_001",
	}))
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
			"include_disabled": false,
		},
		RequestID: "mcp_req_accounts_001",
		Caller: &CallerContext{
			PeerAddress: "127.0.0.1:51515",
		},
	})

	if response.Status != StatusOK || response.Error != nil {
		t.Fatalf("expected ok canonical envelope, got %#v", response)
	}
	if response.Transport != TransportMCP {
		t.Fatalf("transport=%q, want mcp", response.Transport)
	}
	if response.Operation != OperationAccountsSummary {
		t.Fatalf("operation=%q, want %q", response.Operation, OperationAccountsSummary)
	}
	if !response.SidecarInvoked {
		t.Fatalf("read execution binding must be marked as sidecar invoked")
	}
	if response.Authority.Owner != AuthorityOwnerSidecar || response.Authority.SnapshotID != "snap_accounts_001" {
		t.Fatalf("unexpected authority: %#v", response.Authority)
	}
	if response.Audit.SidecarRequestID != "scr_accounts_001" {
		t.Fatalf("expected executor sidecar request ref to be projected, got %#v", response.Audit)
	}
	if adapterExecutorCalls(t, adapter) != 1 {
		t.Fatalf("expected executor to be called once")
	}
	call := adapterExecutorCall(t, adapter, 0)
	if call.Operation != OperationAccountsSummary {
		t.Fatalf("executor operation=%q", call.Operation)
	}
	if call.Transport != TransportMCP {
		t.Fatalf("executor transport=%q", call.Transport)
	}
	if call.Actor.ClientID != client.ID {
		t.Fatalf("executor actor not authorized actor: %#v", call.Actor)
	}
	if got := call.Query["include_disabled"]; got != false {
		t.Fatalf("executor query did not preserve canonical query, got %#v", call.Query)
	}
	if len(persister.events) != 1 {
		t.Fatalf("expected read audit event to be persisted once, got %d", len(persister.events))
	}
	if persister.events[0].ResultStatus != StatusOK || persister.events[0].SidecarRequestID != "scr_accounts_001" {
		t.Fatalf("unexpected persisted read audit event: %#v", persister.events[0])
	}
}

func TestMCPAdapterMissingScopeRejectsBeforeExecutor(t *testing.T) {
	executor := NewStubOperationExecutor()
	persister := &recordingAuditPersister{}
	adapter := newTestMCPAdapter(t, executor, WithMCPAuditPersister(persister))
	client := bridgeTestClient("mcp-model-agent", "mcp-secret-token", []ScopeGrant{
		{Scope: ScopeModelsRead},
	}, []Transport{TransportMCP}, nil)

	response := adapter.HandleTool(context.Background(), MCPToolRequest{
		ToolName:  "gettokens.routes.diagnostics",
		Token:     "mcp-secret-token",
		Client:    client,
		RequestID: "mcp_req_route_diag_001",
		Caller: &CallerContext{
			PeerAddress: "127.0.0.1:51515",
		},
	})

	if response.Status != StatusRejected {
		t.Fatalf("status=%q, want rejected", response.Status)
	}
	if response.Error == nil || response.Error.Code != ErrorMissingScope {
		t.Fatalf("expected missing_scope, got %#v", response.Error)
	}
	if response.SidecarInvoked || response.Error.SidecarInvoked {
		t.Fatalf("missing scope must not invoke sidecar")
	}
	if executor.CallCount() != 0 {
		t.Fatalf("executor must not be called on missing scope")
	}
	if len(persister.events) != 1 || persister.events[0].ErrorCode != ErrorMissingScope {
		t.Fatalf("expected missing-scope audit persistence, got %#v", persister.events)
	}
}

func TestMCPAdapterPreflightRejectionPersistsAuditBeforeExecutor(t *testing.T) {
	executor := NewStubOperationExecutor()
	persister := &recordingAuditPersister{}
	adapter := newTestMCPAdapter(t, executor, WithMCPAuditPersister(persister))
	client := bridgeTestClient("mcp-routes-agent", "mcp-secret-token", []ScopeGrant{
		{Scope: ScopeRoutesDiagnosticsRead},
	}, []Transport{TransportMCP}, nil)

	response := adapter.HandleTool(context.Background(), MCPToolRequest{
		ToolName:  "gettokens.routes.diagnostics",
		Token:     "mcp-secret-token",
		Client:    client,
		RequestID: "mcp_req_preflight_reject_001",
		Query: map[string]any{
			"protocol":      "codex",
			"model":         "gpt-5",
			"authorization": "Bearer should-not-leak",
		},
		Caller: &CallerContext{PeerAddress: "127.0.0.1:51515"},
	})

	if response.Status != StatusRejected {
		t.Fatalf("status=%q, want rejected", response.Status)
	}
	if response.Error == nil || response.Error.Code != ErrorInvalidRequest {
		t.Fatalf("expected invalid_request, got %#v", response.Error)
	}
	if response.SidecarInvoked || response.Error.SidecarInvoked {
		t.Fatalf("preflight rejection must not invoke sidecar")
	}
	if executor.CallCount() != 0 {
		t.Fatalf("executor must not be called on preflight rejection")
	}
	if len(persister.events) != 1 {
		t.Fatalf("expected preflight rejection audit persistence, got %d", len(persister.events))
	}
	event := persister.events[0]
	if event.ResultStatus != StatusRejected || event.ErrorCode != ErrorInvalidRequest {
		t.Fatalf("unexpected preflight audit event: %#v", event)
	}
	assertAuditEventHasNoSecretMaterial(t, event)
}

func TestMCPAdapterSafeActionWithoutIdempotencyRejectsBeforeExecutor(t *testing.T) {
	executor := NewStubOperationExecutor()
	adapter := newTestMCPAdapter(t, executor)
	client := bridgeTestClient("mcp-quota-agent", "mcp-secret-token", []ScopeGrant{
		{Scope: ScopeActionQuotaRefresh},
	}, []Transport{TransportMCP}, nil)

	response := adapter.HandleTool(context.Background(), MCPToolRequest{
		ToolName:  "gettokens.actions.quota_refresh",
		Token:     "mcp-secret-token",
		Client:    client,
		RequestID: "mcp_req_quota_refresh_001",
		Query: map[string]any{
			"account_key": "acct_codex_001",
		},
		Caller: &CallerContext{
			PeerAddress: "127.0.0.1:51515",
		},
	})

	if response.Status != StatusRejected {
		t.Fatalf("status=%q, want rejected", response.Status)
	}
	if response.Error == nil || response.Error.Code != ErrorInvalidRequest {
		t.Fatalf("expected invalid_request, got %#v", response.Error)
	}
	if response.AuditEvent == nil || response.AuditEvent.ErrorCode != ErrorMissingIdempotencyKey {
		t.Fatalf("expected missing idempotency audit code, got %#v", response.AuditEvent)
	}
	if response.SidecarInvoked || response.Error.SidecarInvoked {
		t.Fatalf("missing idempotency must not invoke sidecar")
	}
	if executor.CallCount() != 0 {
		t.Fatalf("executor must not be called on missing idempotency")
	}
}

func TestMCPAdapterSafeActionReturnsOperationRefOnly(t *testing.T) {
	executor := NewStubOperationExecutor()
	executor.SetAcceptedActionResult(OperationActionQuotaRefresh, NewAcceptedActionResult(SidecarAcceptedAction{
		OperationID:      "bro_quota_refresh_001",
		LedgerRef:        "ledger_quota_refresh_001",
		SidecarRequestID: "scr_quota_refresh_001",
	}))
	adapter := newTestMCPAdapter(t, executor)
	client := bridgeTestClient("mcp-quota-agent", "mcp-secret-token", []ScopeGrant{
		{Scope: ScopeActionQuotaRefresh},
	}, []Transport{TransportMCP}, nil)

	response := adapter.HandleTool(context.Background(), MCPToolRequest{
		ToolName:        "gettokens.actions.quota_refresh",
		Token:           "mcp-secret-token",
		Client:          client,
		RequestID:       "mcp_req_quota_refresh_002",
		IdempotencyKey:  "retry-key-secret",
		Query:           map[string]any{"account_key": "acct_codex_001"},
		Caller:          &CallerContext{PeerAddress: "127.0.0.1:51515"},
		PeerDescription: "local MCP stdio adapter",
	})

	if response.Status != StatusAccepted {
		t.Fatalf("status=%q, want accepted", response.Status)
	}
	if !response.SidecarInvoked {
		t.Fatalf("accepted safe action must be marked as sidecar invoked")
	}
	if response.OperationRef == nil || response.OperationRef.OperationID != "bro_quota_refresh_001" {
		t.Fatalf("expected operation ref only, got %#v", response.OperationRef)
	}
	if response.Data != nil {
		t.Fatalf("safe action must not return completed action data, got %#v", response.Data)
	}
	if response.Authority.LedgerRef != "ledger_quota_refresh_001" {
		t.Fatalf("expected ledger ref projection, got %#v", response.Authority)
	}
	call := adapterExecutorCall(t, adapter, 0)
	if call.IdempotencyKey != "retry-key-secret" {
		t.Fatalf("executor did not receive idempotency key")
	}
	if response.AuditEvent == nil || response.AuditEvent.SidecarOperationID != "bro_quota_refresh_001" {
		t.Fatalf("audit should reference sidecar operation id, got %#v", response.AuditEvent)
	}
	payload := mustJSON(t, response)
	for _, forbidden := range []string{"retry-key-secret", "mcp-secret-token"} {
		if strings.Contains(payload, forbidden) {
			t.Fatalf("canonical envelope leaked secret %q: %s", forbidden, payload)
		}
	}
}

func TestMCPAdapterExecutorErrorPersistsAuditWithoutChangingCanonicalFailure(t *testing.T) {
	executor := NewStubOperationExecutor()
	executor.SetError(OperationAccountsSummary, errors.New("sidecar stub unavailable"))
	persister := &recordingAuditPersister{err: errors.New("audit sink offline")}
	adapter := newTestMCPAdapter(t, executor, WithMCPAuditPersister(persister))
	client := bridgeTestClient("mcp-accounts-agent", "mcp-secret-token", []ScopeGrant{
		{Scope: ScopeAccountsRead},
	}, []Transport{TransportMCP}, nil)

	response := adapter.HandleTool(context.Background(), MCPToolRequest{
		ToolName:  "gettokens.accounts.summary",
		Token:     "mcp-secret-token",
		Client:    client,
		RequestID: "mcp_req_accounts_002",
		Caller:    &CallerContext{PeerAddress: "127.0.0.1:51515"},
	})

	if response.Status != StatusRejected {
		t.Fatalf("status=%q, want rejected", response.Status)
	}
	if response.Error == nil || response.Error.Code != ErrorCode("sidecar_unavailable") {
		t.Fatalf("expected sidecar_unavailable, got %#v", response.Error)
	}
	if !response.SidecarInvoked || !response.Error.SidecarInvoked {
		t.Fatalf("executor error should report sidecar invocation")
	}
	if len(persister.events) != 1 {
		t.Fatalf("expected failed execution audit persistence, got %d", len(persister.events))
	}
	if persister.events[0].ErrorCode != ErrorCode("sidecar_unavailable") || persister.events[0].ResultStatus != StatusRejected {
		t.Fatalf("unexpected persisted failed audit event: %#v", persister.events[0])
	}
}

func TestMCPAdapterUnknownToolAndResourceReject(t *testing.T) {
	executor := NewStubOperationExecutor()
	persister := &recordingAuditPersister{}
	adapter := newTestMCPAdapter(t, executor, WithMCPAuditPersister(persister))
	client := bridgeTestClient("mcp-agent", "mcp-secret-token", []ScopeGrant{
		{Scope: ScopeAccountsRead},
	}, []Transport{TransportMCP}, nil)

	toolResponse := adapter.HandleTool(context.Background(), MCPToolRequest{
		ToolName:  "gettokens.unknown",
		Token:     "mcp-secret-token",
		Client:    client,
		RequestID: "mcp_req_unknown_tool_001",
		Caller:    &CallerContext{PeerAddress: "127.0.0.1:51515"},
	})
	if toolResponse.Status != StatusRejected {
		t.Fatalf("unknown tool status=%q, want rejected", toolResponse.Status)
	}
	if toolResponse.Error == nil || toolResponse.Error.Code != ErrorInvalidRequest {
		t.Fatalf("expected invalid_request for unknown tool, got %#v", toolResponse.Error)
	}
	if toolResponse.SidecarInvoked || toolResponse.Error.SidecarInvoked || executor.CallCount() != 0 {
		t.Fatalf("unknown tool must not invoke sidecar/executor")
	}

	resourceResponse := adapter.HandleResource(context.Background(), MCPResourceRequest{
		URI:       "gettokens://bridge/token-hash",
		RequestID: "mcp_res_unknown_001",
	})
	if resourceResponse.Status != StatusRejected {
		t.Fatalf("unknown resource status=%q, want rejected", resourceResponse.Status)
	}
	if resourceResponse.Error == nil || resourceResponse.Error.Code != ErrorInvalidRequest {
		t.Fatalf("expected invalid_request for unknown resource, got %#v", resourceResponse.Error)
	}
	if resourceResponse.SidecarInvoked || resourceResponse.Error.SidecarInvoked {
		t.Fatalf("unknown resource must not invoke sidecar")
	}
	if len(persister.events) != 2 {
		t.Fatalf("expected unknown tool and resource audit persistence attempts, got %#v", persister.events)
	}
	resourceEvent := persister.events[1]
	if resourceEvent.ResultStatus != StatusRejected || resourceEvent.ErrorCode != ErrorInvalidRequest {
		t.Fatalf("unexpected resource rejection audit event: %#v", resourceEvent)
	}
	assertAuditEventHasNoSecretMaterial(t, resourceEvent)
}

func TestMCPAdapterResourceResponseExcludesForbiddenSecretMaterial(t *testing.T) {
	adapter := newTestMCPAdapter(t, NewStubOperationExecutor())

	for _, uri := range []string{
		"gettokens://bridge/manifest",
		"gettokens://bridge/schema",
		"gettokens://bridge/scopes",
	} {
		t.Run(uri, func(t *testing.T) {
			response := adapter.HandleResource(context.Background(), MCPResourceRequest{
				URI:       uri,
				RequestID: "mcp_res_allowed_001",
			})
			if response.Status != StatusOK || response.Error != nil {
				t.Fatalf("expected allowed resource response, got %#v", response)
			}
			if response.Resource == nil {
				t.Fatalf("expected resource mapping")
			}
			if response.Resource.Kind != "manifest" && response.Resource.Kind != "schema" && response.Resource.Kind != "scope_list" {
				t.Fatalf("unexpected resource kind: %#v", response.Resource)
			}
			payload := mustJSON(t, response)
			for _, forbidden := range []string{
				"token_hash",
				"auth_subject_hash",
				"audit_secret",
				"authorization_header",
				"cookie",
				"access_token",
				"refresh_token",
				"id_token",
				"api_key_plaintext",
				"mcp-secret-token",
			} {
				if strings.Contains(strings.ToLower(payload), forbidden) {
					t.Fatalf("resource response leaked forbidden material %q: %s", forbidden, payload)
				}
			}
		})
	}
}

type recordingAuditPersister struct {
	err    error
	events []AuditEvent
}

func (p *recordingAuditPersister) Persist(_ context.Context, event AuditEvent) error {
	p.events = append(p.events, event)
	return p.err
}

func newTestMCPAdapter(t *testing.T, executor OperationExecutor, options ...MCPAdapterOption) *MCPAdapter {
	t.Helper()
	mapping := mustLoadMCPMappingFixture(t)
	adapter, err := NewMCPAdapter(NewRuntime(WithNow(fixedBridgeTime)), mapping, executor, options...)
	if err != nil {
		t.Fatalf("new MCP adapter: %v", err)
	}
	return adapter
}

func adapterExecutorCalls(t *testing.T, adapter *MCPAdapter) int {
	t.Helper()
	executor, ok := adapter.executor.(*StubOperationExecutor)
	if !ok {
		t.Fatalf("unexpected executor type")
	}
	return executor.CallCount()
}

func adapterExecutorCall(t *testing.T, adapter *MCPAdapter, index int) OperationRequest {
	t.Helper()
	executor, ok := adapter.executor.(*StubOperationExecutor)
	if !ok {
		t.Fatalf("unexpected executor type")
	}
	calls := executor.Calls()
	if index < 0 || index >= len(calls) {
		t.Fatalf("executor call index %d out of range", index)
	}
	return calls[index]
}

func mustLoadMCPMappingFixture(t *testing.T) MCPAdapterMapping {
	t.Helper()
	raw := mustReadFile(t, "../../docs-linhay/spaces/20260616-protocol-bridge-surfaces/schemas/mcp-adapter-mapping-v01.json")
	mapping, err := LoadMCPAdapterMapping(raw)
	if err != nil {
		t.Fatalf("load mapping: %v", err)
	}
	return mapping
}

func mustReadFile(t *testing.T, path string) []byte {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return raw
}

func mustJSON(t *testing.T, value any) string {
	t.Helper()
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("marshal json: %v", err)
	}
	return string(raw)
}

func assertAuditEventHasNoSecretMaterial(t *testing.T, event AuditEvent) {
	t.Helper()
	payload := mustJSON(t, event)
	for _, forbidden := range []string{
		"mcp-secret-token",
		"should-not-leak",
		"authorization",
		"cookie",
		"bearer ",
		"access_token",
		"refresh_token",
		"id_token",
		"api_key",
	} {
		if strings.Contains(strings.ToLower(payload), strings.ToLower(forbidden)) {
			t.Fatalf("audit event leaked forbidden material %q: %s", forbidden, payload)
		}
	}
}
