package wailsapp

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGetClaudeLocalUsageReadsAssistantUsageFromSessionLogs(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	claudeDir := filepath.Join(home, ".claude")
	t.Setenv("CLAUDE_CONFIG_DIR", claudeDir)

	projectDir := filepath.Join(claudeDir, "projects", "-Users-linhey-Desktop-GetTokens")
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		t.Fatalf("mkdir project dir: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(projectDir, "subagents"), 0755); err != nil {
		t.Fatalf("mkdir subagents dir: %v", err)
	}

	sessionPath := filepath.Join(projectDir, "session-1.jsonl")
	payload := "" +
		"{\"type\":\"user\",\"timestamp\":\"2026-05-23T02:00:00Z\",\"cwd\":\"/Users/linhey/Desktop/linhay-open-sources/GetTokens\",\"sessionId\":\"session-1\",\"message\":{\"role\":\"user\",\"content\":\"hello\"}}\n" +
		"{\"type\":\"assistant\",\"timestamp\":\"2026-05-23T02:01:00Z\",\"cwd\":\"/Users/linhey/Desktop/linhay-open-sources/GetTokens\",\"sessionId\":\"session-1\",\"message\":{\"id\":\"msg_1\",\"role\":\"assistant\",\"model\":\"claude-opus-4-6\",\"usage\":{\"input_tokens\":3,\"output_tokens\":26,\"cache_read_input_tokens\":5000,\"cache_creation_input_tokens\":10000}}}\n" +
		"{\"type\":\"assistant\",\"timestamp\":\"2026-05-23T02:01:30Z\",\"cwd\":\"/Users/linhey/Desktop/linhay-open-sources/GetTokens\",\"sessionId\":\"session-1\",\"message\":{\"id\":\"msg_1\",\"role\":\"assistant\",\"model\":\"claude-opus-4-6\",\"usage\":{\"input_tokens\":3,\"output_tokens\":150,\"cache_read_input_tokens\":5000,\"cache_creation_input_tokens\":10000},\"stop_reason\":\"end_turn\"}}\n" +
		"{\"type\":\"assistant\",\"timestamp\":\"2026-05-23T02:02:00Z\",\"cwd\":\"/Users/linhey/Desktop/linhay-open-sources/GetTokens\",\"sessionId\":\"session-1\",\"message\":{\"id\":\"msg_zero\",\"role\":\"assistant\",\"model\":\"claude-haiku-4-5\",\"usage\":{\"input_tokens\":100,\"output_tokens\":0},\"stop_reason\":\"end_turn\"}}\n"
	if err := os.WriteFile(sessionPath, []byte(payload), 0600); err != nil {
		t.Fatalf("write session: %v", err)
	}

	subagentPath := filepath.Join(projectDir, "subagents", "agent-skip.jsonl")
	subagentPayload := "{\"type\":\"assistant\",\"timestamp\":\"2026-05-23T02:03:00Z\",\"sessionId\":\"subagent\",\"message\":{\"id\":\"msg_sub\",\"role\":\"assistant\",\"model\":\"claude-sonnet-4-6\",\"usage\":{\"input_tokens\":100,\"output_tokens\":200},\"stop_reason\":\"end_turn\"}}\n"
	if err := os.WriteFile(subagentPath, []byte(subagentPayload), 0600); err != nil {
		t.Fatalf("write subagent session: %v", err)
	}

	app := &App{}
	result, err := app.GetClaudeLocalUsage()
	if err != nil {
		t.Fatalf("GetClaudeLocalUsage returned error: %v", err)
	}

	if result.Provider != localProjectedProviderClaude {
		t.Fatalf("provider = %q, want %q", result.Provider, localProjectedProviderClaude)
	}
	if result.SourceKind != localProjectedSourceKind {
		t.Fatalf("source kind = %q, want %q", result.SourceKind, localProjectedSourceKind)
	}
	if result.ScannedFiles != 1 {
		t.Fatalf("scanned files = %d, want only the main session file", result.ScannedFiles)
	}
	if result.FullRebuildFiles != 1 {
		t.Fatalf("full rebuild files = %d, want 1", result.FullRebuildFiles)
	}
	if len(result.Details) != 1 {
		t.Fatalf("details len = %d, want 1 final assistant usage", len(result.Details))
	}

	detail := result.Details[0]
	if detail.SessionID != "projects/-Users-linhey-Desktop-GetTokens/session-1.jsonl" {
		t.Fatalf("session id = %q, want relative Claude session path", detail.SessionID)
	}
	if detail.ProjectName != "GetTokens" {
		t.Fatalf("project name = %q, want GetTokens", detail.ProjectName)
	}
	if detail.Model != "claude-opus-4-6" {
		t.Fatalf("model = %q, want claude-opus-4-6", detail.Model)
	}
	if detail.Timestamp != "2026-05-23T02:01:30Z" {
		t.Fatalf("timestamp = %q, want final assistant timestamp", detail.Timestamp)
	}
	if detail.InputTokens != 10003 || detail.CachedInputTokens != 5000 || detail.OutputTokens != 150 || detail.RequestCount != 1 {
		t.Fatalf("unexpected token projection: %#v", detail)
	}
}

func TestGetClaudeLocalUsageUsesAppMemoryCacheUntilExplicitRefresh(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	claudeDir := filepath.Join(home, ".claude")
	t.Setenv("CLAUDE_CONFIG_DIR", claudeDir)

	projectDir := filepath.Join(claudeDir, "projects", "-tmp-GetTokens")
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		t.Fatalf("mkdir project dir: %v", err)
	}
	sessionPath := filepath.Join(projectDir, "session-1.jsonl")
	initialPayload := "{\"type\":\"assistant\",\"timestamp\":\"2026-05-23T03:01:00Z\",\"cwd\":\"/tmp/GetTokens\",\"sessionId\":\"session-1\",\"message\":{\"id\":\"msg_1\",\"role\":\"assistant\",\"model\":\"claude-sonnet-4-6\",\"usage\":{\"input_tokens\":100,\"output_tokens\":40,\"cache_read_input_tokens\":10},\"stop_reason\":\"end_turn\"}}\n"
	if err := os.WriteFile(sessionPath, []byte(initialPayload), 0600); err != nil {
		t.Fatalf("write initial session: %v", err)
	}

	app := &App{}
	first, err := app.GetClaudeLocalUsage()
	if err != nil {
		t.Fatalf("first GetClaudeLocalUsage returned error: %v", err)
	}
	if len(first.Details) != 1 {
		t.Fatalf("first details len = %d, want 1", len(first.Details))
	}

	appendPayload := "{\"type\":\"assistant\",\"timestamp\":\"2026-05-23T03:02:00Z\",\"cwd\":\"/tmp/GetTokens\",\"sessionId\":\"session-1\",\"message\":{\"id\":\"msg_2\",\"role\":\"assistant\",\"model\":\"claude-sonnet-4-6\",\"usage\":{\"input_tokens\":120,\"output_tokens\":60,\"cache_read_input_tokens\":12},\"stop_reason\":\"end_turn\"}}\n"
	file, err := os.OpenFile(sessionPath, os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		t.Fatalf("OpenFile append: %v", err)
	}
	if _, err := file.WriteString(appendPayload); err != nil {
		_ = file.Close()
		t.Fatalf("WriteString append: %v", err)
	}
	if err := file.Close(); err != nil {
		t.Fatalf("Close append file: %v", err)
	}

	second, err := app.GetClaudeLocalUsage()
	if err != nil {
		t.Fatalf("second GetClaudeLocalUsage returned error: %v", err)
	}
	if len(second.Details) != 1 {
		t.Fatalf("second details len = %d, want cached response before explicit refresh", len(second.Details))
	}

	refreshed, err := app.RefreshClaudeLocalUsage()
	if err != nil {
		t.Fatalf("RefreshClaudeLocalUsage returned error: %v", err)
	}
	if len(refreshed.Details) != 2 {
		t.Fatalf("refreshed details len = %d, want 2", len(refreshed.Details))
	}
	if refreshed.Details[1].OutputTokens != 60 {
		t.Fatalf("unexpected refreshed appended detail: %#v", refreshed.Details[1])
	}
}

func TestGetClaudeLocalUsageReturnsEmptyWhenProjectsMissing(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	claudeDir := filepath.Join(home, ".claude")
	t.Setenv("CLAUDE_CONFIG_DIR", claudeDir)

	app := &App{}
	result, err := app.GetClaudeLocalUsage()
	if err != nil {
		t.Fatalf("GetClaudeLocalUsage returned error: %v", err)
	}
	if result.Provider != localProjectedProviderClaude {
		t.Fatalf("provider = %q, want %q", result.Provider, localProjectedProviderClaude)
	}
	if result.ScannedFiles != 0 {
		t.Fatalf("scanned files = %d, want 0", result.ScannedFiles)
	}
	if len(result.Details) != 0 {
		t.Fatalf("details len = %d, want 0", len(result.Details))
	}
}
