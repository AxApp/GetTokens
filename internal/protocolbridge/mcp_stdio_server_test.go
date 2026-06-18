package protocolbridge

import (
	"bytes"
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestMCPStdioJSONRPCHandlerToolsCallAuthorizesPreflightsAndExecutes(t *testing.T) {
	executor := NewStubOperationExecutor()
	executor.SetReadResult(OperationAccountsSummary, NewReadOperationResult(SidecarReadEnvelope{
		Data: map[string]any{
			"accounts": []map[string]any{
				{"account_key": "acct_codex_stdio_001", "requestable": true},
			},
		},
		SnapshotID:       "snap_stdio_accounts_001",
		SidecarRequestID: "scr_stdio_accounts_001",
	}))
	adapter := newTestMCPAdapter(t, executor)
	server := NewMCPStdioJSONRPCServer(adapter, MCPStdioJSONRPCSession{
		Token:  "mcp-secret-token",
		Client: bridgeTestClient("stdio-accounts-agent", "mcp-secret-token", []ScopeGrant{{Scope: ScopeAccountsRead}}, []Transport{TransportMCP}, nil),
		Caller: &CallerContext{
			PeerAddress: "127.0.0.1:52525",
		},
	})

	output := serveOneMCPStdioJSONRPC(t, server, `{"jsonrpc":"2.0","id":"rpc-tools-001","method":"tools/call","params":{"name":"gettokens.accounts.summary","arguments":{"include_disabled":false,"protocol":"codex","detail_level":"summary"}}}`)

	response := decodeMCPStdioJSONRPCResponse[MCPToolResponse](t, output)
	if response.JSONRPC != "2.0" || string(response.ID) != `"rpc-tools-001"` {
		t.Fatalf("unexpected JSON-RPC wrapper: %#v", response)
	}
	if response.Result.Status != StatusOK || response.Result.Error != nil {
		t.Fatalf("expected ok tool result, got %#v", response.Result)
	}
	if response.Result.Operation != OperationAccountsSummary {
		t.Fatalf("operation=%q, want %q", response.Result.Operation, OperationAccountsSummary)
	}
	if !response.Result.SidecarInvoked {
		t.Fatalf("tools/call should reach executor after authorize and stdio preflight")
	}
	if response.Result.Authority.SnapshotID != "snap_stdio_accounts_001" {
		t.Fatalf("unexpected authority: %#v", response.Result.Authority)
	}
	if executor.CallCount() != 1 {
		t.Fatalf("executor call count=%d, want 1", executor.CallCount())
	}
	call := executor.Calls()[0]
	if call.Actor.ClientID != "stdio-accounts-agent" {
		t.Fatalf("executor did not receive authorized actor: %#v", call.Actor)
	}
	if got := call.Query["protocol"]; got != "codex" {
		t.Fatalf("executor query=%#v", call.Query)
	}
}

func TestMCPStdioJSONRPCHandlerInitializeReturnsMinimalCapabilities(t *testing.T) {
	executor := NewStubOperationExecutor()
	server := NewMCPStdioJSONRPCServer(newTestMCPAdapter(t, executor), MCPStdioJSONRPCSession{})

	output := serveOneMCPStdioJSONRPC(t, server, `{"jsonrpc":"2.0","id":"rpc-initialize-001","method":"initialize","params":{"protocolVersion":"2024-11-05","clientInfo":{"name":"fake-mcp-client","version":"0.0.0"}}}`)

	response := decodeMCPStdioJSONRPCResponse[MCPInitializeResponse](t, output)
	if response.Result.ProtocolVersion == "" {
		t.Fatalf("initialize must return protocolVersion: %#v", response.Result)
	}
	if response.Result.ServerInfo.Name != "gettokens-protocol-bridge" {
		t.Fatalf("unexpected serverInfo: %#v", response.Result.ServerInfo)
	}
	if response.Result.ServerInfo.Version != Version {
		t.Fatalf("server version=%q, want %q", response.Result.ServerInfo.Version, Version)
	}
	if response.Result.Capabilities.Tools == nil || response.Result.Capabilities.Resources == nil {
		t.Fatalf("initialize must declare tools and resources capabilities: %#v", response.Result.Capabilities)
	}
	if executor.CallCount() != 0 {
		t.Fatalf("initialize must not invoke operation executor, got %d calls", executor.CallCount())
	}
	assertNoMCPStdioSecretEcho(t, output)
}

func TestMCPStdioJSONRPCHandlerToolsListReturnsLocalManifestWithoutExecutor(t *testing.T) {
	executor := NewStubOperationExecutor()
	server := NewMCPStdioJSONRPCServer(newTestMCPAdapter(t, executor), MCPStdioJSONRPCSession{})

	output := serveOneMCPStdioJSONRPC(t, server, `{"jsonrpc":"2.0","id":"rpc-tools-list-001","method":"tools/list","params":{}}`)

	response := decodeMCPStdioJSONRPCResponse[MCPToolsListResponse](t, output)
	if len(response.Result.Tools) == 0 {
		t.Fatalf("tools/list returned no tools: %#v", response.Result)
	}
	var accountsTool *MCPListedTool
	for i := range response.Result.Tools {
		if response.Result.Tools[i].Name == "gettokens.accounts.summary" {
			accountsTool = &response.Result.Tools[i]
			break
		}
	}
	if accountsTool == nil {
		t.Fatalf("tools/list missing accounts summary tool: %#v", response.Result.Tools)
	}
	if accountsTool.CanonicalOperation != OperationAccountsSummary {
		t.Fatalf("canonical operation=%q, want %q", accountsTool.CanonicalOperation, OperationAccountsSummary)
	}
	if accountsTool.RequiredScope != ScopeAccountsRead {
		t.Fatalf("required scope=%q, want %q", accountsTool.RequiredScope, ScopeAccountsRead)
	}
	if accountsTool.QuerySchemaRef == "" {
		t.Fatalf("tools/list must expose local query schema ref: %#v", accountsTool)
	}
	if executor.CallCount() != 0 {
		t.Fatalf("tools/list must not invoke operation executor, got %d calls", executor.CallCount())
	}
	assertNoMCPStdioSecretEcho(t, output)
}

func TestMCPStdioJSONRPCHandlerToolsListPaginatesLocalManifestWithoutExecutor(t *testing.T) {
	executor := NewStubOperationExecutor()
	server := NewMCPStdioJSONRPCServer(newTestMCPAdapter(t, executor), MCPStdioJSONRPCSession{})

	firstOutput := serveOneMCPStdioJSONRPC(t, server, `{"jsonrpc":"2.0","id":"rpc-tools-list-page-001","method":"tools/list","params":{"limit":2}}`)
	first := decodeMCPStdioJSONRPCResponse[MCPToolsListResponse](t, firstOutput)
	if len(first.Result.Tools) != 2 {
		t.Fatalf("first tools/list page size=%d, want 2: %#v", len(first.Result.Tools), first.Result)
	}
	if first.Result.NextCursor == "" || !strings.HasPrefix(first.Result.NextCursor, "pb-list-v1:tools:") {
		t.Fatalf("tools/list next cursor should be stable token, got %#v", first.Result)
	}
	if first.Result.Tools[0].Name != "gettokens.accounts.summary" || first.Result.Tools[1].Name != "gettokens.models.supported" {
		t.Fatalf("unexpected first tools/list page: %#v", first.Result.Tools)
	}

	secondOutput := serveOneMCPStdioJSONRPC(t, server, `{"jsonrpc":"2.0","id":"rpc-tools-list-page-002","method":"tools/list","params":{"limit":2,"cursor":`+strconvQuote(first.Result.NextCursor)+`}}`)
	second := decodeMCPStdioJSONRPCResponse[MCPToolsListResponse](t, secondOutput)
	if len(second.Result.Tools) != 2 {
		t.Fatalf("second tools/list page size=%d, want 2: %#v", len(second.Result.Tools), second.Result)
	}
	if second.Result.Tools[0].Name != "gettokens.routes.diagnostics" || second.Result.Tools[1].Name != "gettokens.quota.summary" {
		t.Fatalf("unexpected second tools/list page: %#v", second.Result.Tools)
	}
	if executor.CallCount() != 0 {
		t.Fatalf("tools/list pagination must not invoke operation executor, got %d calls", executor.CallCount())
	}
	assertNoMCPStdioSecretEcho(t, firstOutput+secondOutput)
}

func TestMCPStdioJSONRPCHandlerResourcesListReturnsLocalManifestWithoutExecutor(t *testing.T) {
	executor := NewStubOperationExecutor()
	server := NewMCPStdioJSONRPCServer(newTestMCPAdapter(t, executor), MCPStdioJSONRPCSession{})

	output := serveOneMCPStdioJSONRPC(t, server, `{"jsonrpc":"2.0","id":"rpc-resources-list-001","method":"resources/list","params":{}}`)

	response := decodeMCPStdioJSONRPCResponse[MCPResourcesListResponse](t, output)
	if len(response.Result.Resources) == 0 {
		t.Fatalf("resources/list returned no resources: %#v", response.Result)
	}
	var manifest *MCPResourceMapping
	for i := range response.Result.Resources {
		if response.Result.Resources[i].URI == "gettokens://bridge/manifest" {
			manifest = &response.Result.Resources[i]
			break
		}
	}
	if manifest == nil {
		t.Fatalf("resources/list missing bridge manifest resource: %#v", response.Result.Resources)
	}
	if manifest.Kind != "manifest" || manifest.Source == "" {
		t.Fatalf("unexpected manifest resource metadata: %#v", manifest)
	}
	if executor.CallCount() != 0 {
		t.Fatalf("resources/list must not invoke operation executor, got %d calls", executor.CallCount())
	}
	assertNoMCPStdioSecretEcho(t, output)
}

func TestMCPStdioJSONRPCHandlerResourcesListPaginatesLocalManifestWithoutExecutor(t *testing.T) {
	executor := NewStubOperationExecutor()
	server := NewMCPStdioJSONRPCServer(newTestMCPAdapter(t, executor), MCPStdioJSONRPCSession{})

	firstOutput := serveOneMCPStdioJSONRPC(t, server, `{"jsonrpc":"2.0","id":"rpc-resources-list-page-001","method":"resources/list","params":{"limit":2}}`)
	first := decodeMCPStdioJSONRPCResponse[MCPResourcesListResponse](t, firstOutput)
	if len(first.Result.Resources) != 2 {
		t.Fatalf("first resources/list page size=%d, want 2: %#v", len(first.Result.Resources), first.Result)
	}
	if first.Result.NextCursor == "" || !strings.HasPrefix(first.Result.NextCursor, "pb-list-v1:resources:") {
		t.Fatalf("resources/list next cursor should be stable token, got %#v", first.Result)
	}
	if first.Result.Resources[0].URI != "gettokens://bridge/manifest" || first.Result.Resources[1].URI != "gettokens://bridge/schema" {
		t.Fatalf("unexpected first resources/list page: %#v", first.Result.Resources)
	}

	secondOutput := serveOneMCPStdioJSONRPC(t, server, `{"jsonrpc":"2.0","id":"rpc-resources-list-page-002","method":"resources/list","params":{"limit":2,"cursor":`+strconvQuote(first.Result.NextCursor)+`}}`)
	second := decodeMCPStdioJSONRPCResponse[MCPResourcesListResponse](t, secondOutput)
	if len(second.Result.Resources) != 1 {
		t.Fatalf("second resources/list page size=%d, want 1: %#v", len(second.Result.Resources), second.Result)
	}
	if second.Result.Resources[0].URI != "gettokens://bridge/scopes" || second.Result.NextCursor != "" {
		t.Fatalf("unexpected second resources/list page: %#v", second.Result)
	}
	if executor.CallCount() != 0 {
		t.Fatalf("resources/list pagination must not invoke operation executor, got %d calls", executor.CallCount())
	}
	assertNoMCPStdioSecretEcho(t, firstOutput+secondOutput)
}

func TestMCPStdioJSONRPCHandlerListRejectsInvalidPagination(t *testing.T) {
	executor := NewStubOperationExecutor()
	server := NewMCPStdioJSONRPCServer(newTestMCPAdapter(t, executor), MCPStdioJSONRPCSession{})

	for _, input := range []string{
		`{"jsonrpc":"2.0","id":"rpc-tools-list-bad-limit","method":"tools/list","params":{"limit":-1}}`,
		`{"jsonrpc":"2.0","id":"rpc-tools-list-bad-cursor","method":"tools/list","params":{"cursor":"2"}}`,
		`{"jsonrpc":"2.0","id":"rpc-resources-list-wrong-kind","method":"resources/list","params":{"cursor":"pb-list-v1:tools:2"}}`,
	} {
		output := serveOneMCPStdioJSONRPC(t, server, input)
		response := decodeMCPStdioJSONRPCMaybeError[MCPToolsListResponse](t, output)
		if response.Error == nil || response.Error.Code != jsonRPCInvalidParams {
			t.Fatalf("expected invalid params for %s, got %#v", input, response)
		}
	}
	if executor.CallCount() != 0 {
		t.Fatalf("invalid list pagination must not invoke operation executor, got %d calls", executor.CallCount())
	}
}

func TestMCPStdioJSONRPCHandlerResourcesReadOnlyAllowsMappedFixtureURI(t *testing.T) {
	server := NewMCPStdioJSONRPCServer(newTestMCPAdapter(t, NewStubOperationExecutor()), MCPStdioJSONRPCSession{})

	allowedOutput := serveOneMCPStdioJSONRPC(t, server, `{"jsonrpc":"2.0","id":"rpc-resource-001","method":"resources/read","params":{"uri":"gettokens://bridge/manifest"}}`)
	allowed := decodeMCPStdioJSONRPCResponse[MCPResourceResponse](t, allowedOutput)
	if allowed.Result.Status != StatusOK || allowed.Result.Resource == nil {
		t.Fatalf("expected mapped resource success, got %#v", allowed.Result)
	}
	if allowed.Result.Resource.URI != "gettokens://bridge/manifest" {
		t.Fatalf("resource URI=%q", allowed.Result.Resource.URI)
	}

	rejectedOutput := serveOneMCPStdioJSONRPC(t, server, `{"jsonrpc":"2.0","id":"rpc-resource-002","method":"resources/read","params":{"uri":"gettokens://bridge/token-hash"}}`)
	rejected := decodeMCPStdioJSONRPCResponse[MCPResourceResponse](t, rejectedOutput)
	if rejected.Result.Status != StatusRejected {
		t.Fatalf("expected unmapped resource rejection, got %#v", rejected.Result)
	}
	if rejected.Result.Error == nil || rejected.Result.Error.Code != ErrorInvalidRequest {
		t.Fatalf("expected invalid_request for unmapped resource, got %#v", rejected.Result.Error)
	}
	if rejected.Result.SidecarInvoked {
		t.Fatalf("resource preflight rejection must not invoke sidecar")
	}
}

func TestMCPStdioJSONRPCHandlerRejectsCredentialAndSchemaOutsideQueryBeforeExecutor(t *testing.T) {
	executor := NewStubOperationExecutor()
	adapter := newTestMCPAdapter(t, executor)
	server := NewMCPStdioJSONRPCServer(adapter, MCPStdioJSONRPCSession{
		Token:  "mcp-secret-token",
		Client: bridgeTestClient("stdio-routes-agent", "mcp-secret-token", []ScopeGrant{{Scope: ScopeRoutesDiagnosticsRead}}, []Transport{TransportMCP}, nil),
		Caller: &CallerContext{PeerAddress: "127.0.0.1:52525"},
	})

	tests := []struct {
		name  string
		input string
	}{
		{
			name:  "credential-bearing argument",
			input: `{"jsonrpc":"2.0","id":"rpc-reject-credential","method":"tools/call","params":{"name":"gettokens.routes.diagnostics","arguments":{"protocol":"codex","model":"gpt-5","account_key":"Bearer should-not-leak"}}}`,
		},
		{
			name:  "schema outside query",
			input: `{"jsonrpc":"2.0","id":"rpc-reject-schema","method":"tools/call","params":{"name":"gettokens.routes.diagnostics","arguments":{"protocol":"codex","model":"gpt-5","unexpected_query":"still-not-allowed"}}}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			output := serveOneMCPStdioJSONRPC(t, server, tt.input)
			response := decodeMCPStdioJSONRPCResponse[MCPToolResponse](t, output)
			if response.Result.Status != StatusRejected {
				t.Fatalf("expected rejected status, got %#v", response.Result)
			}
			if response.Result.Error == nil || response.Result.Error.Code != ErrorInvalidRequest {
				t.Fatalf("expected invalid_request, got %#v", response.Result.Error)
			}
			if response.Result.SidecarInvoked || response.Result.Error.SidecarInvoked {
				t.Fatalf("preflight rejection must happen before executor/sidecar")
			}
			if executor.CallCount() != 0 {
				t.Fatalf("executor must not be called on preflight rejection")
			}
			assertNoMCPStdioSecretEcho(t, output)
		})
	}
}

func TestMCPStdioJSONRPCHandlerErrorResponsesDoNotEchoTokenHeaderOrCookie(t *testing.T) {
	executor := NewStubOperationExecutor()
	executor.SetError(OperationAccountsSummary, &canonicalExecutorError{
		Code:             ErrorSidecarUnavailable,
		Message:          "upstream failed with Authorization: Bearer should-not-leak and Cookie: session=secret-cookie",
		Recoverable:      true,
		SidecarErrorCode: "authorization_header_secret",
	})
	server := NewMCPStdioJSONRPCServer(newTestMCPAdapter(t, executor), MCPStdioJSONRPCSession{
		Token:  "mcp-secret-token",
		Client: bridgeTestClient("stdio-accounts-agent", "mcp-secret-token", []ScopeGrant{{Scope: ScopeAccountsRead}}, []Transport{TransportMCP}, nil),
		Caller: &CallerContext{PeerAddress: "127.0.0.1:52525"},
	})

	output := serveOneMCPStdioJSONRPC(t, server, `{"jsonrpc":"2.0","id":"rpc-error-redaction","method":"tools/call","params":{"name":"gettokens.accounts.summary","arguments":{"include_disabled":false,"protocol":"codex"}}}`)
	response := decodeMCPStdioJSONRPCResponse[MCPToolResponse](t, output)
	if response.Result.Status != StatusRejected || response.Result.Error == nil {
		t.Fatalf("expected rejected tool result, got %#v", response.Result)
	}
	if !response.Result.SidecarInvoked {
		t.Fatalf("executor error should preserve sidecar_invoked=true")
	}
	assertNoMCPStdioSecretEcho(t, output)
}

func serveOneMCPStdioJSONRPC(t *testing.T, server *MCPStdioJSONRPCServer, input string) string {
	t.Helper()
	var output bytes.Buffer
	if err := server.ServeOne(context.Background(), strings.NewReader(input), &output); err != nil {
		t.Fatalf("serve JSON-RPC: %v", err)
	}
	return output.String()
}

type decodedMCPStdioJSONRPCResponse[T any] struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  T               `json:"result"`
	Error   *jsonRPCError   `json:"error,omitempty"`
}

func decodeMCPStdioJSONRPCResponse[T any](t *testing.T, raw string) decodedMCPStdioJSONRPCResponse[T] {
	t.Helper()
	var response decodedMCPStdioJSONRPCResponse[T]
	if err := json.Unmarshal([]byte(raw), &response); err != nil {
		t.Fatalf("decode JSON-RPC response %s: %v", raw, err)
	}
	if response.Error != nil {
		t.Fatalf("unexpected JSON-RPC error response: %#v", response.Error)
	}
	return response
}

func decodeMCPStdioJSONRPCMaybeError[T any](t *testing.T, raw string) decodedMCPStdioJSONRPCResponse[T] {
	t.Helper()
	var response decodedMCPStdioJSONRPCResponse[T]
	if err := json.Unmarshal([]byte(raw), &response); err != nil {
		t.Fatalf("decode JSON-RPC response %s: %v", raw, err)
	}
	return response
}

func strconvQuote(value string) string {
	raw, _ := json.Marshal(value)
	return string(raw)
}

func assertNoMCPStdioSecretEcho(t *testing.T, raw string) {
	t.Helper()
	lower := strings.ToLower(raw)
	for _, forbidden := range []string{
		"mcp-secret-token",
		"should-not-leak",
		"secret-cookie",
		"authorization:",
		"authorization_header_secret",
		"cookie:",
		"bearer ",
	} {
		if strings.Contains(lower, strings.ToLower(forbidden)) {
			t.Fatalf("JSON-RPC response leaked forbidden material %q: %s", forbidden, raw)
		}
	}
}
