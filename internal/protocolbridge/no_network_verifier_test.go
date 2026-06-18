//go:build protocolbridge_no_network

package protocolbridge

import (
	"context"
	"path/filepath"
	"strings"
	"testing"
)

func TestProtocolBridgeNoNetworkVerifier(t *testing.T) {
	t.Run("initialize resource read and stdio preflight stay local", func(t *testing.T) {
		executor := NewStubOperationExecutor()
		server := NewMCPStdioJSONRPCServer(newTestMCPAdapter(t, executor), MCPStdioJSONRPCSession{})

		initializeOutput := serveOneMCPStdioJSONRPC(t, server, `{"jsonrpc":"2.0","id":"pb-no-network-initialize","method":"initialize","params":{"protocolVersion":"2024-11-05"}}`)
		initialize := decodeMCPStdioJSONRPCResponse[MCPInitializeResponse](t, initializeOutput)
		if initialize.Result.ServerInfo.Name != "gettokens-protocol-bridge" {
			t.Fatalf("unexpected initialize server info: %#v", initialize.Result.ServerInfo)
		}
		if initialize.Result.Capabilities.Tools == nil || initialize.Result.Capabilities.Resources == nil {
			t.Fatalf("initialize must expose tools and resources capabilities: %#v", initialize.Result.Capabilities)
		}

		resourceOutput := serveOneMCPStdioJSONRPC(t, server, `{"jsonrpc":"2.0","id":"pb-no-network-resource-read","method":"resources/read","params":{"uri":"gettokens://bridge/manifest"}}`)
		resource := decodeMCPStdioJSONRPCResponse[MCPResourceResponse](t, resourceOutput)
		if resource.Result.Status != StatusOK || resource.Result.Resource == nil {
			t.Fatalf("expected mapped resource to stay local and succeed, got %#v", resource.Result)
		}
		if resource.Result.Resource.URI != "gettokens://bridge/manifest" || resource.Result.SidecarInvoked {
			t.Fatalf("unexpected local resource result: %#v", resource.Result)
		}

		authenticatedServer := NewMCPStdioJSONRPCServer(newTestMCPAdapter(t, executor), MCPStdioJSONRPCSession{
			Token: "mcp-secret-token",
			Client: bridgeTestClient("pb-no-network-preflight-agent", "mcp-secret-token", []ScopeGrant{
				{Scope: ScopeAccountsRead},
			}, []Transport{TransportMCP}, nil),
			Caller: &CallerContext{PeerAddress: "127.0.0.1:52525"},
		})
		preflightOutput := serveOneMCPStdioJSONRPC(t, authenticatedServer, `{"jsonrpc":"2.0","id":"pb-no-network-preflight","method":"tools/call","params":{"name":"gettokens.accounts.summary","arguments":{"include_disabled":false,"Authorization":"Bearer should-not-leak"}}}`)
		preflight := decodeMCPStdioJSONRPCResponse[MCPToolResponse](t, preflightOutput)
		if preflight.Result.Status != StatusRejected || preflight.Result.Error == nil || preflight.Result.Error.Code != ErrorInvalidRequest {
			t.Fatalf("credential-bearing stdio input should be rejected before executor, got %#v", preflight.Result)
		}
		if preflight.Result.SidecarInvoked || executor.CallCount() != 0 {
			t.Fatalf("no-network verifier must not invoke executor or sidecar, result=%#v calls=%d", preflight.Result, executor.CallCount())
		}
		assertNoMCPStdioSecretEcho(t, initializeOutput+resourceOutput+preflightOutput)
	})

	t.Run("tools and resources list cursors stay local", func(t *testing.T) {
		executor := NewStubOperationExecutor()
		server := NewMCPStdioJSONRPCServer(newTestMCPAdapter(t, executor), MCPStdioJSONRPCSession{})

		firstToolsOutput := serveOneMCPStdioJSONRPC(t, server, `{"jsonrpc":"2.0","id":"pb-no-network-tools-001","method":"tools/list","params":{"limit":2}}`)
		firstTools := decodeMCPStdioJSONRPCResponse[MCPToolsListResponse](t, firstToolsOutput)
		if got := len(firstTools.Result.Tools); got != 2 {
			t.Fatalf("first tools/list page size=%d, want 2: %#v", got, firstTools.Result)
		}
		if !strings.HasPrefix(firstTools.Result.NextCursor, "pb-list-v1:tools:") {
			t.Fatalf("tools/list next cursor should be stable tools token: %#v", firstTools.Result)
		}
		if firstTools.Result.Tools[0].Name != "gettokens.accounts.summary" || firstTools.Result.Tools[1].Name != "gettokens.models.supported" {
			t.Fatalf("unexpected first tools page: %#v", firstTools.Result.Tools)
		}

		secondToolsOutput := serveOneMCPStdioJSONRPC(t, server, `{"jsonrpc":"2.0","id":"pb-no-network-tools-002","method":"tools/list","params":{"limit":2,"cursor":`+strconvQuote(firstTools.Result.NextCursor)+`}}`)
		secondTools := decodeMCPStdioJSONRPCResponse[MCPToolsListResponse](t, secondToolsOutput)
		if got := len(secondTools.Result.Tools); got != 2 {
			t.Fatalf("second tools/list page size=%d, want 2: %#v", got, secondTools.Result)
		}
		if secondTools.Result.Tools[0].Name != "gettokens.routes.diagnostics" || secondTools.Result.Tools[1].Name != "gettokens.quota.summary" {
			t.Fatalf("unexpected second tools page: %#v", secondTools.Result.Tools)
		}

		firstResourcesOutput := serveOneMCPStdioJSONRPC(t, server, `{"jsonrpc":"2.0","id":"pb-no-network-resources-001","method":"resources/list","params":{"limit":2}}`)
		firstResources := decodeMCPStdioJSONRPCResponse[MCPResourcesListResponse](t, firstResourcesOutput)
		if got := len(firstResources.Result.Resources); got != 2 {
			t.Fatalf("first resources/list page size=%d, want 2: %#v", got, firstResources.Result)
		}
		if !strings.HasPrefix(firstResources.Result.NextCursor, "pb-list-v1:resources:") {
			t.Fatalf("resources/list next cursor should be stable resources token: %#v", firstResources.Result)
		}
		if firstResources.Result.Resources[0].URI != "gettokens://bridge/manifest" || firstResources.Result.Resources[1].URI != "gettokens://bridge/schema" {
			t.Fatalf("unexpected first resources page: %#v", firstResources.Result.Resources)
		}

		secondResourcesOutput := serveOneMCPStdioJSONRPC(t, server, `{"jsonrpc":"2.0","id":"pb-no-network-resources-002","method":"resources/list","params":{"limit":2,"cursor":`+strconvQuote(firstResources.Result.NextCursor)+`}}`)
		secondResources := decodeMCPStdioJSONRPCResponse[MCPResourcesListResponse](t, secondResourcesOutput)
		if got := len(secondResources.Result.Resources); got != 1 {
			t.Fatalf("second resources/list page size=%d, want 1: %#v", got, secondResources.Result)
		}
		if secondResources.Result.Resources[0].URI != "gettokens://bridge/scopes" || secondResources.Result.NextCursor != "" {
			t.Fatalf("unexpected second resources page: %#v", secondResources.Result)
		}

		badCursorOutput := serveOneMCPStdioJSONRPC(t, server, `{"jsonrpc":"2.0","id":"pb-no-network-list-bad-cursor","method":"resources/list","params":{"cursor":"pb-list-v1:tools:2"}}`)
		badCursor := decodeMCPStdioJSONRPCMaybeError[MCPResourcesListResponse](t, badCursorOutput)
		if badCursor.Error == nil || badCursor.Error.Code != jsonRPCInvalidParams {
			t.Fatalf("wrong-kind list cursor should be invalid params, got %#v", badCursor)
		}
		if executor.CallCount() != 0 {
			t.Fatalf("list verifier must not invoke executor or sidecar, got %d calls", executor.CallCount())
		}
		assertNoMCPStdioSecretEcho(t, firstToolsOutput+secondToolsOutput+firstResourcesOutput+secondResourcesOutput+badCursorOutput)
	})

	t.Run("audit cursor stays local and rejects bare offsets", func(t *testing.T) {
		path := filepath.Join(t.TempDir(), "bridge-audit.jsonl")
		sink, err := NewJSONLAuditSink(path)
		if err != nil {
			t.Fatalf("new JSONL audit sink: %v", err)
		}
		for _, id := range []string{
			"bra_no_network_oldest",
			"bra_no_network_middle_old",
			"bra_no_network_middle_new",
			"bra_no_network_latest",
		} {
			if err := sink.Persist(context.Background(), AuditEvent{
				AuditID:          id,
				RequestID:        "req_" + id,
				Transport:        TransportMCP,
				Operation:        OperationAccountsSummary,
				ResultStatus:     StatusOK,
				RedactionVersion: "bridge-redaction-v1",
			}); err != nil {
				t.Fatalf("persist %s: %v", id, err)
			}
		}

		reader, err := NewJSONLAuditReader(path)
		if err != nil {
			t.Fatalf("new JSONL audit reader: %v", err)
		}
		firstPage, err := reader.Query(context.Background(), JSONLAuditQuery{
			Limit:  2,
			Kind:   AuditKindRead,
			Status: StatusOK,
		})
		if err != nil {
			t.Fatalf("query first audit page: %v", err)
		}
		if firstPage.Offset != 0 || !firstPage.HasMore || firstPage.NextCursor != "pb-audit-v1:2" {
			t.Fatalf("unexpected first audit page metadata: %#v", firstPage)
		}
		if got := strings.Join(auditIDs(firstPage.Events), ","); got != "bra_no_network_latest,bra_no_network_middle_new" {
			t.Fatalf("unexpected first audit page events: %s", got)
		}

		offsetPage, err := reader.Query(context.Background(), JSONLAuditQuery{
			Limit:  2,
			Offset: 2,
			Kind:   AuditKindRead,
			Status: StatusOK,
		})
		if err != nil {
			t.Fatalf("query offset audit page: %v", err)
		}
		cursorPage, err := reader.Query(context.Background(), JSONLAuditQuery{
			Limit:  2,
			Cursor: firstPage.NextCursor,
			Kind:   AuditKindRead,
			Status: StatusOK,
		})
		if err != nil {
			t.Fatalf("query cursor audit page: %v", err)
		}
		if strings.Join(auditIDs(cursorPage.Events), ",") != strings.Join(auditIDs(offsetPage.Events), ",") {
			t.Fatalf("cursor page does not match offset page: cursor=%#v offset=%#v", cursorPage.Events, offsetPage.Events)
		}

		if _, err := reader.Query(context.Background(), JSONLAuditQuery{Cursor: "2"}); err == nil {
			t.Fatalf("bare numeric audit cursor must be rejected")
		}
	})
}
