package protocolbridge

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"testing"
	"time"
)

func TestMCPExternalStdioProcessStartsAndRoundTripsJSONRPC(t *testing.T) {
	process := NewMCPExternalStdioProcess(helperExternalStdioCommand(t, "echo"))
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := process.Start(ctx); err != nil {
		t.Fatalf("start external stdio process: %v", err)
	}
	defer func() {
		_ = process.Shutdown(context.Background())
	}()

	var response decodedMCPStdioJSONRPCResponse[map[string]any]
	err := process.CallJSONRPC(ctx, map[string]any{
		"jsonrpc": "2.0",
		"id":      "external-rpc-001",
		"method":  "tools/call",
		"params": map[string]any{
			"name": "gettokens.accounts.summary",
			"arguments": map[string]any{
				"include_disabled": false,
			},
		},
	}, &response)
	if err != nil {
		t.Fatalf("call external stdio process: %v", err)
	}
	if response.JSONRPC != "2.0" || string(response.ID) != `"external-rpc-001"` {
		t.Fatalf("unexpected JSON-RPC response wrapper: %#v", response)
	}
	if response.Result["ok"] != true || response.Result["method"] != "tools/call" {
		t.Fatalf("unexpected helper process result: %#v", response.Result)
	}
}

func TestMCPExternalStdioProcessShutdownCancelsContextBoundProcess(t *testing.T) {
	process := NewMCPExternalStdioProcess(helperExternalStdioCommand(t, "hang"))
	startCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := process.Start(startCtx); err != nil {
		t.Fatalf("start external stdio process: %v", err)
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer shutdownCancel()
	if err := process.Shutdown(shutdownCtx); err != nil {
		t.Fatalf("shutdown external stdio process: %v", err)
	}
	if process.Running() {
		t.Fatalf("process should not be running after shutdown")
	}
}

func TestMCPExternalStdioProcessExitAndStderrErrorsAreRedacted(t *testing.T) {
	process := NewMCPExternalStdioProcess(helperExternalStdioCommand(t, "exit-stderr"))
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := process.Start(ctx); err != nil {
		t.Fatalf("start external stdio process: %v", err)
	}

	var response map[string]any
	err := process.CallJSONRPC(ctx, map[string]any{
		"jsonrpc": "2.0",
		"id":      "external-rpc-error-001",
		"method":  "tools/call",
		"params": map[string]any{
			"name": "gettokens.accounts.summary",
			"arguments": map[string]any{
				"authorization": "Bearer should-not-leak",
				"cookie":        "secret-cookie",
			},
		},
	}, &response)
	if err == nil {
		t.Fatalf("expected external stdio process error")
	}
	if !errors.Is(err, ErrExternalStdioProcessExited) {
		t.Fatalf("expected process-exited sentinel, got %v", err)
	}
	assertExternalStdioErrorDoesNotLeak(t, err.Error())
	assertExternalStdioErrorDoesNotLeak(t, process.Stderr())
}

func TestMCPExternalStdioHelperProcess(t *testing.T) {
	if os.Getenv("GETTOKENS_PROTOCOLBRIDGE_HELPER_PROCESS") != "1" {
		return
	}
	args := os.Args
	mode := ""
	for i, arg := range args {
		if arg == "--" && i+1 < len(args) {
			mode = args[i+1]
			break
		}
	}
	switch mode {
	case "echo":
		decoder := json.NewDecoder(os.Stdin)
		encoder := json.NewEncoder(os.Stdout)
		for {
			var request jsonRPCRequest
			if err := decoder.Decode(&request); err != nil {
				return
			}
			_ = encoder.Encode(newJSONRPCResultResponse(request.ID, map[string]any{
				"ok":     true,
				"method": request.Method,
			}))
		}
	case "hang":
		select {}
	case "exit-stderr":
		_, _ = os.Stderr.WriteString("Authorization: Bearer should-not-leak Cookie: secret-cookie api_key=raw-api-key\n")
		os.Exit(23)
	default:
		os.Exit(2)
	}
}

func helperExternalStdioCommand(t *testing.T, mode string) MCPExternalStdioCommand {
	t.Helper()
	return MCPExternalStdioCommand{
		Path: os.Args[0],
		Args: []string{"-test.run=TestMCPExternalStdioHelperProcess", "--", mode},
		Env:  []string{"GETTOKENS_PROTOCOLBRIDGE_HELPER_PROCESS=1"},
	}
}

func assertExternalStdioErrorDoesNotLeak(t *testing.T, raw string) {
	t.Helper()
	for _, forbidden := range []string{
		"should-not-leak",
		"secret-cookie",
		"raw-api-key",
		"authorization",
		"cookie",
		"api_key",
		"bearer ",
	} {
		if strings.Contains(strings.ToLower(raw), strings.ToLower(forbidden)) {
			t.Fatalf("external stdio error leaked forbidden material %q: %s", forbidden, raw)
		}
	}
}
