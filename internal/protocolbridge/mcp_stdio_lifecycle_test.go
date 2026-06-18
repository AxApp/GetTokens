package protocolbridge

import (
	"bytes"
	"context"
	"errors"
	"io"
	"strings"
	"testing"
	"time"
)

func TestMCPStdioLifecycleWrapperServeStopsOnContextCancel(t *testing.T) {
	server := NewMCPStdioJSONRPCServer(newTestMCPAdapter(t, NewStubOperationExecutor()), MCPStdioJSONRPCSession{})
	wrapper := NewMCPStdioLifecycleWrapper(server)
	reader, writer := io.Pipe()
	var output bytes.Buffer
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)

	go func() {
		done <- wrapper.Serve(ctx, reader, &output)
	}()

	cancel()
	select {
	case err := <-done:
		if err != nil && !errors.Is(err, context.Canceled) {
			t.Fatalf("serve returned unexpected error after cancel: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("stdio lifecycle wrapper did not stop after context cancel")
	}

	if _, err := writer.Write([]byte(`{"jsonrpc":"2.0","id":"after-cancel","method":"resources/read","params":{"uri":"gettokens://bridge/manifest"}}`)); err == nil {
		t.Fatalf("expected input writer to be closed after context cancel")
	}
}

func TestMCPStdioLifecycleWrapperShutdownClosesRunningServe(t *testing.T) {
	server := NewMCPStdioJSONRPCServer(newTestMCPAdapter(t, NewStubOperationExecutor()), MCPStdioJSONRPCSession{})
	wrapper := NewMCPStdioLifecycleWrapper(server)
	reader, writer := io.Pipe()
	var output bytes.Buffer
	done := make(chan error, 1)

	go func() {
		done <- wrapper.Serve(context.Background(), reader, &output)
	}()
	waitForMCPStdioLifecycleRunning(t, wrapper)

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := wrapper.Shutdown(shutdownCtx); err != nil {
		t.Fatalf("shutdown: %v", err)
	}
	select {
	case err := <-done:
		if err != nil && !errors.Is(err, context.Canceled) {
			t.Fatalf("serve returned unexpected error after shutdown: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("stdio lifecycle wrapper did not stop after Shutdown")
	}

	if _, err := writer.Write([]byte(`{"jsonrpc":"2.0","id":"after-shutdown","method":"resources/read","params":{"uri":"gettokens://bridge/manifest"}}`)); err == nil {
		t.Fatalf("expected input writer to be closed after Shutdown")
	}
}

func TestMCPStdioLifecycleWrapperMalformedRequestDoesNotLeakSecrets(t *testing.T) {
	server := NewMCPStdioJSONRPCServer(newTestMCPAdapter(t, NewStubOperationExecutor()), MCPStdioJSONRPCSession{
		Token:  "mcp-secret-token",
		Client: bridgeTestClient("stdio-malformed-agent", "mcp-secret-token", []ScopeGrant{{Scope: ScopeAccountsRead}}, []Transport{TransportMCP}, nil),
	})
	wrapper := NewMCPStdioLifecycleWrapper(server)
	var output bytes.Buffer
	input := strings.NewReader(`{"jsonrpc":"2.0","id":"bad","method":"tools/call","params":{"authorization":"Bearer should-not-leak"`)

	if err := wrapper.Serve(context.Background(), input, &output); err != nil {
		t.Fatalf("serve malformed request: %v", err)
	}
	raw := output.String()
	if !strings.Contains(raw, `"code":-32700`) {
		t.Fatalf("expected JSON-RPC parse error, got %s", raw)
	}
	assertNoMCPStdioSecretEcho(t, raw)
}

func waitForMCPStdioLifecycleRunning(t *testing.T, wrapper *MCPStdioLifecycleWrapper) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if wrapper.Running() {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("stdio lifecycle wrapper did not enter running state")
}
