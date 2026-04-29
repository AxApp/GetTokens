package wailsapp

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestGetCodexLocalUsageAggregatesTokenCountDeltas(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	sessionsDir := filepath.Join(codexHome, "sessions", "2026", "04", "28")
	if err := os.MkdirAll(sessionsDir, 0755); err != nil {
		t.Fatalf("mkdir sessions dir: %v", err)
	}

	rolloutPath := filepath.Join(sessionsDir, "rollout-2026-04-28T10-00-00.jsonl")
	payload := "" +
		"{\"timestamp\":\"2026-04-28T10:00:00.000Z\",\"type\":\"turn_context\",\"payload\":{\"model\":\"gpt-5-codex\"}}\n" +
		"{\"timestamp\":\"2026-04-28T10:01:00.000Z\",\"type\":\"event_msg\",\"payload\":{\"type\":\"token_count\",\"info\":{\"total_token_usage\":{\"input_tokens\":100,\"cached_input_tokens\":120,\"output_tokens\":20}}}}\n" +
		"{\"timestamp\":\"2026-04-28T10:02:00.000Z\",\"type\":\"event_msg\",\"payload\":{\"type\":\"token_count\",\"info\":{\"total_token_usage\":{\"input_tokens\":100,\"cached_input_tokens\":100,\"output_tokens\":20}}}}\n" +
		"{\"timestamp\":\"2026-04-28T10:03:00.000Z\",\"type\":\"event_msg\",\"payload\":{\"type\":\"token_count\",\"info\":{\"total_token_usage\":{\"input_tokens\":160,\"cached_input_tokens\":110,\"output_tokens\":35}}}}\n" +
		"{\"timestamp\":\"2026-04-28T10:04:00.000Z\",\"type\":\"event_msg\",\"payload\":{\"type\":\"token_count\",\"info\":{\"last_token_usage\":{\"input_tokens\":40,\"cached_input_tokens\":12,\"output_tokens\":8}}}}\n"
	if err := os.WriteFile(rolloutPath, []byte(payload), 0600); err != nil {
		t.Fatalf("write rollout: %v", err)
	}

	t.Setenv("CODEX_HOME", codexHome)

	app := &App{}
	result, err := app.GetCodexLocalUsage()
	if err != nil {
		t.Fatalf("GetCodexLocalUsage returned error: %v", err)
	}

	if result.Provider != localProjectedProvider {
		t.Fatalf("provider = %q, want %q", result.Provider, localProjectedProvider)
	}
	if result.SourceKind != localProjectedSourceKind {
		t.Fatalf("source kind = %q, want %q", result.SourceKind, localProjectedSourceKind)
	}
	if result.ScannedFiles != 1 {
		t.Fatalf("scanned files = %d, want 1", result.ScannedFiles)
	}
	if result.FullRebuildFiles != 1 {
		t.Fatalf("full rebuild files = %d, want 1", result.FullRebuildFiles)
	}
	if len(result.Details) != 3 {
		t.Fatalf("details len = %d, want 3", len(result.Details))
	}

	first := result.Details[0]
	if first.InputTokens != 100 || first.CachedInputTokens != 100 || first.OutputTokens != 20 {
		t.Fatalf("unexpected first detail: %#v", first)
	}

	second := result.Details[1]
	if second.InputTokens != 60 || second.CachedInputTokens != 10 || second.OutputTokens != 15 {
		t.Fatalf("unexpected second detail: %#v", second)
	}

	third := result.Details[2]
	if third.InputTokens != 40 || third.CachedInputTokens != 12 || third.OutputTokens != 8 {
		t.Fatalf("unexpected third detail: %#v", third)
	}

	indexPath, err := codexLocalUsageIndexPath()
	if err != nil {
		t.Fatalf("codexLocalUsageIndexPath: %v", err)
	}
	if _, err := os.Stat(indexPath); err != nil {
		t.Fatalf("expected index file to exist: %v", err)
	}
}

func TestGetCodexLocalUsageIncludesArchivedSessions(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	liveDir := filepath.Join(codexHome, "sessions", "2026", "04", "28")
	if err := os.MkdirAll(liveDir, 0755); err != nil {
		t.Fatalf("mkdir live dir: %v", err)
	}
	archivedDir := filepath.Join(codexHome, "archived_sessions")
	if err := os.MkdirAll(archivedDir, 0755); err != nil {
		t.Fatalf("mkdir archived dir: %v", err)
	}

	liveRolloutPath := filepath.Join(liveDir, "rollout-2026-04-28T10-00-00.jsonl")
	livePayload := "" +
		"{\"timestamp\":\"2026-04-28T10:01:00.000Z\",\"type\":\"event_msg\",\"payload\":{\"type\":\"token_count\",\"info\":{\"total_token_usage\":{\"input_tokens\":100,\"cached_input_tokens\":20,\"output_tokens\":10}}}}\n"
	if err := os.WriteFile(liveRolloutPath, []byte(livePayload), 0600); err != nil {
		t.Fatalf("write live rollout: %v", err)
	}

	archivedRolloutPath := filepath.Join(archivedDir, "rollout-2026-04-20T10-00-00.jsonl")
	archivedPayload := "" +
		"{\"timestamp\":\"2026-04-20T10:01:00.000Z\",\"type\":\"event_msg\",\"payload\":{\"type\":\"token_count\",\"info\":{\"total_token_usage\":{\"input_tokens\":40,\"cached_input_tokens\":8,\"output_tokens\":5}}}}\n"
	if err := os.WriteFile(archivedRolloutPath, []byte(archivedPayload), 0600); err != nil {
		t.Fatalf("write archived rollout: %v", err)
	}

	t.Setenv("CODEX_HOME", codexHome)

	app := &App{}
	result, err := app.GetCodexLocalUsage()
	if err != nil {
		t.Fatalf("GetCodexLocalUsage returned error: %v", err)
	}
	if result.ScannedFiles != 2 {
		t.Fatalf("scanned files = %d, want 2", result.ScannedFiles)
	}
	if len(result.Details) != 2 {
		t.Fatalf("details len = %d, want 2", len(result.Details))
	}
	if result.Details[0].Timestamp != "2026-04-20T10:01:00Z" {
		t.Fatalf("first timestamp = %q, want archived minute first", result.Details[0].Timestamp)
	}
	if result.Details[1].Timestamp != "2026-04-28T10:01:00Z" {
		t.Fatalf("second timestamp = %q, want live minute second", result.Details[1].Timestamp)
	}
}

func TestGetCodexLocalUsageUsesCacheHitAndDeltaAppend(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	sessionsDir := filepath.Join(codexHome, "sessions", "2026", "04", "28")
	if err := os.MkdirAll(sessionsDir, 0755); err != nil {
		t.Fatalf("mkdir sessions dir: %v", err)
	}

	rolloutPath := filepath.Join(sessionsDir, "rollout-2026-04-28T10-00-00.jsonl")
	initialPayload := "" +
		"{\"timestamp\":\"2026-04-28T10:00:00.000Z\",\"type\":\"turn_context\",\"payload\":{\"model\":\"gpt-5-codex\"}}\n" +
		"{\"timestamp\":\"2026-04-28T10:01:00.000Z\",\"type\":\"event_msg\",\"payload\":{\"type\":\"token_count\",\"info\":{\"total_token_usage\":{\"input_tokens\":100,\"cached_input_tokens\":20,\"output_tokens\":10}}}}\n"
	if err := os.WriteFile(rolloutPath, []byte(initialPayload), 0600); err != nil {
		t.Fatalf("write rollout: %v", err)
	}

	t.Setenv("CODEX_HOME", codexHome)
	app := &App{}

	first, err := app.GetCodexLocalUsage()
	if err != nil {
		t.Fatalf("first GetCodexLocalUsage returned error: %v", err)
	}
	if first.FullRebuildFiles != 1 {
		t.Fatalf("first full rebuild files = %d, want 1", first.FullRebuildFiles)
	}

	second, err := app.GetCodexLocalUsage()
	if err != nil {
		t.Fatalf("second GetCodexLocalUsage returned error: %v", err)
	}
	if second.CacheHitFiles != 1 {
		t.Fatalf("second cache hit files = %d, want 1", second.CacheHitFiles)
	}
	if len(second.Details) != 1 {
		t.Fatalf("second details len = %d, want 1", len(second.Details))
	}

	appendPayload := "" +
		"{\"timestamp\":\"2026-04-28T10:02:00.000Z\",\"type\":\"event_msg\",\"payload\":{\"type\":\"token_count\",\"info\":{\"total_token_usage\":{\"input_tokens\":180,\"cached_input_tokens\":40,\"output_tokens\":25}}}}\n"
	file, err := os.OpenFile(rolloutPath, os.O_APPEND|os.O_WRONLY, 0600)
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

	third, err := app.GetCodexLocalUsage()
	if err != nil {
		t.Fatalf("third GetCodexLocalUsage returned error: %v", err)
	}
	if third.DeltaAppendFiles != 1 {
		t.Fatalf("third delta append files = %d, want 1", third.DeltaAppendFiles)
	}
	if len(third.Details) != 2 {
		t.Fatalf("third details len = %d, want 2", len(third.Details))
	}
	last := third.Details[1]
	if last.InputTokens != 80 || last.CachedInputTokens != 20 || last.OutputTokens != 15 {
		t.Fatalf("unexpected appended detail: %#v", last)
	}
}

func TestRebuildCodexLocalUsageForcesFullRebuild(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	sessionsDir := filepath.Join(codexHome, "sessions", "2026", "04", "28")
	if err := os.MkdirAll(sessionsDir, 0755); err != nil {
		t.Fatalf("mkdir sessions dir: %v", err)
	}

	rolloutPath := filepath.Join(sessionsDir, "rollout-2026-04-28T10-00-00.jsonl")
	payload := "" +
		"{\"timestamp\":\"2026-04-28T10:01:00.000Z\",\"type\":\"event_msg\",\"payload\":{\"type\":\"token_count\",\"info\":{\"total_token_usage\":{\"input_tokens\":100,\"cached_input_tokens\":20,\"output_tokens\":10}}}}\n"
	if err := os.WriteFile(rolloutPath, []byte(payload), 0600); err != nil {
		t.Fatalf("write rollout: %v", err)
	}

	t.Setenv("CODEX_HOME", codexHome)
	app := &App{}

	first, err := app.GetCodexLocalUsage()
	if err != nil {
		t.Fatalf("GetCodexLocalUsage returned error: %v", err)
	}
	if first.FullRebuildFiles != 1 {
		t.Fatalf("first full rebuild files = %d, want 1", first.FullRebuildFiles)
	}

	second, err := app.RebuildCodexLocalUsage()
	if err != nil {
		t.Fatalf("RebuildCodexLocalUsage returned error: %v", err)
	}
	if second.FullRebuildFiles != 1 {
		t.Fatalf("second full rebuild files = %d, want 1", second.FullRebuildFiles)
	}
	if second.CacheHitFiles != 0 {
		t.Fatalf("second cache hit files = %d, want 0", second.CacheHitFiles)
	}
}

func TestGetCodexLocalUsageReturnsEmptyWhenSessionsMissing(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	t.Setenv("CODEX_HOME", codexHome)

	app := &App{}
	result, err := app.GetCodexLocalUsage()
	if err != nil {
		t.Fatalf("GetCodexLocalUsage returned error: %v", err)
	}
	if result.ScannedFiles != 0 {
		t.Fatalf("scanned files = %d, want 0", result.ScannedFiles)
	}
	if len(result.Details) != 0 {
		t.Fatalf("details len = %d, want 0", len(result.Details))
	}
}

func TestGetCodexLocalUsageSupportsOversizedJSONLLine(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	sessionsDir := filepath.Join(codexHome, "sessions", "2026", "04", "28")
	if err := os.MkdirAll(sessionsDir, 0755); err != nil {
		t.Fatalf("mkdir sessions dir: %v", err)
	}

	rolloutPath := filepath.Join(sessionsDir, "rollout-2026-04-28T10-00-00.jsonl")
	oversizedPadding := strings.Repeat("x", 1024*1024*5)
	payload := "" +
		"{\"timestamp\":\"2026-04-28T10:00:00.000Z\",\"type\":\"turn_context\",\"payload\":{\"model\":\"gpt-5-codex\"}}\n" +
		"{\"timestamp\":\"2026-04-28T10:01:00.000Z\",\"type\":\"event_msg\",\"payload\":{\"type\":\"token_count\",\"memo\":\"" + oversizedPadding + "\",\"info\":{\"total_token_usage\":{\"input_tokens\":120,\"cached_input_tokens\":32,\"output_tokens\":18}}}}\n"
	if err := os.WriteFile(rolloutPath, []byte(payload), 0600); err != nil {
		t.Fatalf("write rollout: %v", err)
	}

	t.Setenv("CODEX_HOME", codexHome)

	app := &App{}
	result, err := app.GetCodexLocalUsage()
	if err != nil {
		t.Fatalf("GetCodexLocalUsage returned error: %v", err)
	}
	if len(result.Details) != 1 {
		t.Fatalf("details len = %d, want 1", len(result.Details))
	}

	detail := result.Details[0]
	if detail.InputTokens != 120 || detail.CachedInputTokens != 32 || detail.OutputTokens != 18 {
		t.Fatalf("unexpected oversized detail: %#v", detail)
	}
}

func TestRelativeLocalUsageProgressPathPrefersCodexRelativePath(t *testing.T) {
	codexHome := filepath.Join("/tmp", "codex-home")
	absolutePath := filepath.Join(codexHome, "archived_sessions", "rollout-2026-04-20.jsonl")

	got := relativeLocalUsageProgressPath(codexHome, absolutePath)
	want := "archived_sessions/rollout-2026-04-20.jsonl"
	if got != want {
		t.Fatalf("relativeLocalUsageProgressPath() = %q, want %q", got, want)
	}
}
