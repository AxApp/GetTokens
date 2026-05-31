package wailsapp

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func BenchmarkLiveCodexSessionManagementSnapshot(b *testing.B) {
	if os.Getenv("GETTOKENS_LIVE_SESSION_PERF") != "1" {
		b.Skip("set GETTOKENS_LIVE_SESSION_PERF=1 to benchmark the local Codex session store")
	}

	app := &App{}
	for i := 0; i < b.N; i++ {
		app.sessionMgmtMu.Lock()
		app.sessionMgmt = sessionManagementRuntimeState{}
		app.sessionMgmtMu.Unlock()

		if _, err := app.GetCodexSessionManagementSnapshot(); err != nil {
			b.Fatalf("GetCodexSessionManagementSnapshot returned error: %v", err)
		}
	}
}

func BenchmarkLiveCodexSessionDetailCached(b *testing.B) {
	if os.Getenv("GETTOKENS_LIVE_SESSION_PERF") != "1" {
		b.Skip("set GETTOKENS_LIVE_SESSION_PERF=1 to benchmark the local Codex session store")
	}
	sessionID := os.Getenv("GETTOKENS_LIVE_SESSION_DETAIL_ID")
	if strings.TrimSpace(sessionID) == "" {
		b.Skip("set GETTOKENS_LIVE_SESSION_DETAIL_ID to a codex session id such as sessions/2026/04/30/rollout.jsonl")
	}

	app := &App{}
	if _, err := app.GetCodexSessionDetail(sessionID); err != nil {
		b.Fatalf("warm detail load returned error: %v", err)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := app.GetCodexSessionDetail(sessionID); err != nil {
			b.Fatalf("GetCodexSessionDetail returned error: %v", err)
		}
	}
}

func BenchmarkLiveCodexSessionDetailDiskCached(b *testing.B) {
	if os.Getenv("GETTOKENS_LIVE_SESSION_PERF") != "1" {
		b.Skip("set GETTOKENS_LIVE_SESSION_PERF=1 to benchmark the local Codex session store")
	}
	sessionID := os.Getenv("GETTOKENS_LIVE_SESSION_DETAIL_ID")
	if strings.TrimSpace(sessionID) == "" {
		b.Skip("set GETTOKENS_LIVE_SESSION_DETAIL_ID to a codex session id such as sessions/2026/04/30/rollout.jsonl")
	}

	if _, err := (&App{}).GetCodexSessionDetail(sessionID); err != nil {
		b.Fatalf("warm detail disk cache returned error: %v", err)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		app := &App{}
		if _, err := app.GetCodexSessionDetail(sessionID); err != nil {
			b.Fatalf("GetCodexSessionDetail returned error: %v", err)
		}
	}
}

func BenchmarkLiveCodexSessionDetailCold(b *testing.B) {
	if os.Getenv("GETTOKENS_LIVE_SESSION_PERF") != "1" {
		b.Skip("set GETTOKENS_LIVE_SESSION_PERF=1 to benchmark the local Codex session store")
	}
	sessionID := os.Getenv("GETTOKENS_LIVE_SESSION_DETAIL_ID")
	if strings.TrimSpace(sessionID) == "" {
		b.Skip("set GETTOKENS_LIVE_SESSION_DETAIL_ID to a codex session id such as sessions/2026/04/30/rollout.jsonl")
	}
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		b.Fatalf("resolve codex home: %v", err)
	}

	for i := 0; i < b.N; i++ {
		_ = os.Remove(sessionManagementDetailDiskCachePath(codexHome, "codex", filepath.ToSlash(sessionID)))
		app := &App{}
		if _, err := app.GetCodexSessionDetail(sessionID); err != nil {
			b.Fatalf("GetCodexSessionDetail returned error: %v", err)
		}
	}
}

func TestGetCodexSessionManagementSnapshotReturnsDiskCache(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	if err := os.MkdirAll(codexHome, 0755); err != nil {
		t.Fatalf("mkdir codex home: %v", err)
	}
	cached := []byte(`{"projectCount":1,"sessionCount":1,"activeSessionCount":1,"archivedSessionCount":0,"lastScanAt":"2026-05-28 10:00","providerCounts":{"openai":1},"projects":[{"id":"cached-project","name":"Cached Project","providerCounts":{"openai":1},"sessionCount":1,"activeSessionCount":1,"archivedSessionCount":0,"lastActiveAt":"2026-05-28 10:00","providerSummary":"openai 1","sessions":[{"id":"sessions/2026/05/28/cached.jsonl","sessionID":"sessions/2026/05/28/cached.jsonl","projectID":"cached-project","projectName":"Cached Project","title":"Cached Session","status":"active","archived":false,"messageCount":3,"roleSummary":"用户 1 / 助手 1","updatedAt":"2026-05-28 10:00","fileLabel":"cached.jsonl","summary":"cached summary","provider":"openai"}]}]}`)
	if err := os.WriteFile(sessionManagementSnapshotCachePath(codexHome), cached, 0600); err != nil {
		t.Fatalf("write snapshot cache: %v", err)
	}
	t.Setenv("CODEX_HOME", codexHome)

	app := &App{}
	snapshot, err := app.GetCodexSessionManagementSnapshot()
	if err != nil {
		t.Fatalf("GetCodexSessionManagementSnapshot returned error: %v", err)
	}
	if snapshot.ProjectCount != 1 || len(snapshot.Projects) != 1 {
		t.Fatalf("snapshot project count = %d/%d, want cached project", snapshot.ProjectCount, len(snapshot.Projects))
	}
	if snapshot.Projects[0].Sessions[0].Title != "Cached Session" {
		t.Fatalf("cached session title = %q, want Cached Session", snapshot.Projects[0].Sessions[0].Title)
	}
}

func TestRefreshCodexSessionManagementSnapshotWritesDiskCache(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	liveDir := filepath.Join(codexHome, "sessions", "2026", "05", "28")
	if err := os.MkdirAll(liveDir, 0755); err != nil {
		t.Fatalf("mkdir live dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(liveDir, "rollout-2026-05-28T10-00-00-gettokens.jsonl"), []byte(sessionFixture(
		"2026-05-28T10:00:00.000Z",
		"GetTokens",
		"openai",
		"优化会话管理读取",
		"快照缓存已经写入磁盘",
	)), 0600); err != nil {
		t.Fatalf("write session fixture: %v", err)
	}
	t.Setenv("CODEX_HOME", codexHome)

	app := &App{}
	if _, err := app.RefreshCodexSessionManagementSnapshot(); err != nil {
		t.Fatalf("RefreshCodexSessionManagementSnapshot returned error: %v", err)
	}
	if _, err := os.Stat(sessionManagementSnapshotCachePath(codexHome)); err != nil {
		t.Fatalf("snapshot disk cache was not written: %v", err)
	}
	cached, err := readSessionManagementSnapshotDiskCache(codexHome)
	if err != nil {
		t.Fatalf("read snapshot disk cache: %v", err)
	}
	if cached.SessionCount != 1 {
		t.Fatalf("cached session count = %d, want 1", cached.SessionCount)
	}
}

func TestGetCodexSessionDetailUsesDiskCache(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	sessionsDir := filepath.Join(codexHome, "sessions", "2026", "05", "28")
	if err := os.MkdirAll(sessionsDir, 0755); err != nil {
		t.Fatalf("mkdir sessions dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(codexHome, "session_index.jsonl"), []byte("{\"id\":\"GetTokens-id\",\"thread_name\":\"真实线程标题\"}\n"), 0600); err != nil {
		t.Fatalf("write session index: %v", err)
	}

	relativePath := filepath.ToSlash(filepath.Join("sessions", "2026", "05", "28", "rollout-2026-05-28T10-00-00-gettokens.jsonl"))
	absolutePath := filepath.Join(codexHome, relativePath)
	if err := os.WriteFile(absolutePath, []byte(sessionFixture(
		"2026-05-28T10:00:00.000Z",
		"GetTokens",
		"openai",
		"会话缓存命中测试",
		"原始文件详情不应被读取",
	)), 0600); err != nil {
		t.Fatalf("write session file: %v", err)
	}
	info, err := os.Stat(absolutePath)
	if err != nil {
		t.Fatalf("stat session file: %v", err)
	}
	cachedDetail := &SessionManagementSessionDetail{
		SessionID:           relativePath,
		ProjectID:           "cached-project",
		ProjectName:         "Cached Project",
		Title:               "Cached Detail",
		Status:              "active",
		Archived:            false,
		FileLabel:           filepath.Base(relativePath),
		MessageCount:        99,
		Masked:              true,
		CurrentMessageLabel: "99 / 助手",
		RoleSummary:         "用户 1 / 助手 1",
		Topic:               "cached topic",
		Preview:             "cached preview",
		Provider:            "openai",
		StartedAt:           "2026-05-28 10:00",
		UpdatedAt:           "2026-05-28 10:01",
		Messages: []SessionManagementMessageRecord{
			{ID: "m-1", Role: "user", TimeLabel: "10:00", Title: "cached", Summary: "cached summary", Content: "cached content"},
		},
	}
	if err := writeSessionManagementDetailDiskCache(codexHome, "codex", relativePath, info.Size(), info.ModTime().UnixNano(), cachedDetail); err != nil {
		t.Fatalf("write detail cache: %v", err)
	}
	t.Setenv("CODEX_HOME", codexHome)

	app := &App{}
	detail, err := app.GetCodexSessionDetail(relativePath)
	if err != nil {
		t.Fatalf("GetCodexSessionDetail returned error: %v", err)
	}
	if detail.Title != "Cached Detail" {
		t.Fatalf("detail title = %q, want cached detail title", detail.Title)
	}
	if detail.MessageCount != 99 {
		t.Fatalf("detail message count = %d, want cached 99", detail.MessageCount)
	}
}

func TestGetCodexSessionDetailIgnoresStaleDiskCache(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	sessionsDir := filepath.Join(codexHome, "sessions", "2026", "05", "28")
	if err := os.MkdirAll(sessionsDir, 0755); err != nil {
		t.Fatalf("mkdir sessions dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(codexHome, "session_index.jsonl"), []byte("{\"id\":\"GetTokens-id\",\"thread_name\":\"真实线程标题\"}\n"), 0600); err != nil {
		t.Fatalf("write session index: %v", err)
	}

	relativePath := filepath.ToSlash(filepath.Join("sessions", "2026", "05", "28", "rollout-2026-05-28T10-00-00-gettokens.jsonl"))
	absolutePath := filepath.Join(codexHome, relativePath)
	if err := os.WriteFile(absolutePath, []byte(sessionFixture(
		"2026-05-28T10:00:00.000Z",
		"GetTokens",
		"openai",
		"会话缓存失效测试",
		"原始文件更新后不应继续命中旧缓存",
	)), 0600); err != nil {
		t.Fatalf("write session file: %v", err)
	}
	info, err := os.Stat(absolutePath)
	if err != nil {
		t.Fatalf("stat session file: %v", err)
	}
	if err := writeSessionManagementDetailDiskCache(codexHome, "codex", relativePath, info.Size(), info.ModTime().UnixNano(), &SessionManagementSessionDetail{
		SessionID:    relativePath,
		ProjectID:    "cached-project",
		ProjectName:  "Cached Project",
		Title:        "Cached Detail",
		MessageCount: 99,
		Messages:     []SessionManagementMessageRecord{{ID: "m-1", Role: "user", TimeLabel: "10:00", Title: "cached", Summary: "cached summary", Content: "cached content"}},
	}); err != nil {
		t.Fatalf("write detail cache: %v", err)
	}

	if err := os.WriteFile(absolutePath, []byte(sessionFixture(
		"2026-05-28T10:00:00.000Z",
		"GetTokens",
		"openai",
		"会话缓存失效测试已更新",
		"新的原始文件内容",
	)), 0600); err != nil {
		t.Fatalf("rewrite session file: %v", err)
	}
	t.Setenv("CODEX_HOME", codexHome)

	app := &App{}
	detail, err := app.GetCodexSessionDetail(relativePath)
	if err != nil {
		t.Fatalf("GetCodexSessionDetail returned error: %v", err)
	}
	if detail.Title == "Cached Detail" {
		t.Fatalf("stale disk cache should not be returned: %#v", detail)
	}
	if detail.Title != "真实线程标题" {
		t.Fatalf("detail title = %q, want parsed thread title after cache invalidation", detail.Title)
	}
}

func TestCodexSessionSnapshotParsingSanitizesDerivedTitle(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	sessionsDir := filepath.Join(codexHome, "sessions", "2026", "05", "28")
	if err := os.MkdirAll(sessionsDir, 0755); err != nil {
		t.Fatalf("mkdir sessions dir: %v", err)
	}
	relativePath := filepath.ToSlash(filepath.Join("sessions", "2026", "05", "28", "rollout-2026-05-28T10-00-00-sensitive.jsonl"))
	absolutePath := filepath.Join(codexHome, relativePath)
	if err := os.WriteFile(absolutePath, []byte(sessionFixture(
		"2026-05-28T10:00:00.000Z",
		"GetTokens",
		"openai",
		"请读取 /Users/linhey/Desktop/GetTokens/AGENTS.md 并关注 call_abc123",
		"已完成",
	)), 0600); err != nil {
		t.Fatalf("write session file: %v", err)
	}

	result, err := parseSessionFile(codexHome, absolutePath, relativePath, map[string]string{}, false)
	if err != nil {
		t.Fatalf("parseSessionFile returned error: %v", err)
	}
	if strings.Contains(result.session.Title, "/Users/linhey") || strings.Contains(result.session.Title, "call_abc123") {
		t.Fatalf("snapshot-derived title leaked sensitive text: %q", result.session.Title)
	}
	if !strings.Contains(result.session.Title, "<redacted-path>") {
		t.Fatalf("snapshot-derived title missing redacted path placeholder: %q", result.session.Title)
	}
}

func TestGetCodexSessionMessagePageReturnsRequestedSliceWithContent(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	sessionsDir := filepath.Join(codexHome, "sessions", "2026", "05", "28")
	if err := os.MkdirAll(sessionsDir, 0755); err != nil {
		t.Fatalf("mkdir sessions dir: %v", err)
	}
	relativePath := filepath.ToSlash(filepath.Join("sessions", "2026", "05", "28", "rollout-2026-05-28T10-00-00-page.jsonl"))
	if err := os.WriteFile(filepath.Join(codexHome, relativePath), []byte(sessionFixture(
		"2026-05-28T10:00:00.000Z",
		"GetTokens",
		"openai",
		"第一页用户消息",
		"第一页助手消息",
	)), 0600); err != nil {
		t.Fatalf("write session file: %v", err)
	}
	t.Setenv("CODEX_HOME", codexHome)

	app := &App{}
	page, err := app.GetCodexSessionMessagePage(relativePath, SessionManagementMessagePageInput{Offset: 1, Limit: 1})
	if err != nil {
		t.Fatalf("GetCodexSessionMessagePage returned error: %v", err)
	}
	if page.MessageCount != 3 {
		t.Fatalf("message count = %d, want full count 3", page.MessageCount)
	}
	if len(page.Messages) != 1 {
		t.Fatalf("page messages = %d, want 1", len(page.Messages))
	}
	if page.Messages[0].Role != "user" || !strings.Contains(page.Messages[0].Content, "第一页用户消息") {
		t.Fatalf("paged message = %#v, want user content", page.Messages[0])
	}
	if page.Messages[0].LineNumber != 2 {
		t.Fatalf("paged message line number = %d, want 2", page.Messages[0].LineNumber)
	}
	if page.NextOffset != 2 || !page.HasMore {
		t.Fatalf("next offset/has more = %d/%v, want 2/true", page.NextOffset, page.HasMore)
	}
	raw, err := app.GetCodexSessionMessageRawJSON(relativePath, SessionManagementMessageRawJSONInput{LineNumber: page.Messages[0].LineNumber})
	if err != nil {
		t.Fatalf("GetCodexSessionMessageRawJSON returned error: %v", err)
	}
	if !strings.Contains(raw.RawJSON, "第一页用户消息") {
		t.Fatalf("raw json = %q, want original user json", raw.RawJSON)
	}
}

func TestGetClaudeCodeSessionMessagePageReturnsRequestedSliceWithContent(t *testing.T) {
	home := t.TempDir()
	claudeDir := filepath.Join(home, ".claude")
	projectDir := filepath.Join(claudeDir, "projects", "-Users-linhey-Desktop-GetTokens")
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		t.Fatalf("mkdir claude project dir: %v", err)
	}
	relativeID := filepath.ToSlash(filepath.Join("projects", "-Users-linhey-Desktop-GetTokens", "session-page.jsonl"))
	if err := os.WriteFile(filepath.Join(claudeDir, relativeID), []byte(claudeSessionFixture(
		"session-page",
		"/Users/linhey/Desktop/GetTokens",
		"2026-05-21T11:00:00.000Z",
		"Claude 用户消息",
		"Claude 助手消息",
	)), 0600); err != nil {
		t.Fatalf("write claude session: %v", err)
	}
	t.Setenv("CLAUDE_CONFIG_DIR", claudeDir)

	app := &App{}
	page, err := app.GetClaudeCodeSessionMessagePage(relativeID, SessionManagementMessagePageInput{Offset: 4, Limit: 10})
	if err != nil {
		t.Fatalf("GetClaudeCodeSessionMessagePage returned error: %v", err)
	}
	if page.MessageCount != 5 {
		t.Fatalf("message count = %d, want full count 5", page.MessageCount)
	}
	if len(page.Messages) != 1 {
		t.Fatalf("page messages = %d, want last message only", len(page.Messages))
	}
	if page.Messages[0].Role != "assistant" || !strings.Contains(page.Messages[0].Content, "Claude 助手消息") {
		t.Fatalf("paged message = %#v, want assistant content", page.Messages[0])
	}
	if page.Messages[0].LineNumber != 5 {
		t.Fatalf("paged message line number = %d, want 5", page.Messages[0].LineNumber)
	}
	if page.HasMore {
		t.Fatalf("has more = true, want false")
	}
	raw, err := app.GetClaudeCodeSessionMessageRawJSON(relativeID, SessionManagementMessageRawJSONInput{LineNumber: page.Messages[0].LineNumber})
	if err != nil {
		t.Fatalf("GetClaudeCodeSessionMessageRawJSON returned error: %v", err)
	}
	if !strings.Contains(raw.RawJSON, "Claude 助手消息") {
		t.Fatalf("raw json = %q, want original claude assistant json", raw.RawJSON)
	}
}

func TestSessionManagementDetailMemoryCacheIsBounded(t *testing.T) {
	app := &App{}
	for index := 0; index < sessionManagementDetailMemoryCacheMaxEntries+2; index++ {
		key := "codex\x00session-" + string(rune('a'+index))
		app.storeCachedSessionManagementDetail(key, int64(index+1), int64(index+1), &SessionManagementSessionDetail{
			SessionID: key,
			Title:     "detail",
			Messages: []SessionManagementMessageRecord{
				{ID: "m-1", Role: "user", Summary: "small", Content: "small"},
			},
		})
	}
	if len(app.sessionMgmt.cachedDetails) != sessionManagementDetailMemoryCacheMaxEntries {
		t.Fatalf("memory detail cache entries = %d, want %d", len(app.sessionMgmt.cachedDetails), sessionManagementDetailMemoryCacheMaxEntries)
	}
	if app.readCachedSessionManagementDetail("codex\x00session-a", 1, 1) != nil {
		t.Fatal("oldest detail cache entry should be evicted")
	}
}

func TestSessionManagementDetailMemoryCacheSkipsOversizedDetails(t *testing.T) {
	app := &App{}
	largeContent := strings.Repeat("x", sessionManagementDetailMemoryCacheMaxBytes+1)
	app.storeCachedSessionManagementDetail("codex\x00large", 1, 1, &SessionManagementSessionDetail{
		SessionID: "large",
		Title:     "large",
		Messages: []SessionManagementMessageRecord{
			{ID: "m-1", Role: "assistant", Summary: "large", Content: largeContent},
		},
	})
	if len(app.sessionMgmt.cachedDetails) != 0 {
		t.Fatalf("oversized detail should not be stored in memory: %#v", app.sessionMgmt.cachedDetails)
	}
	if app.sessionMgmt.cachedDetailBytes != 0 {
		t.Fatalf("memory detail cache bytes = %d, want 0", app.sessionMgmt.cachedDetailBytes)
	}
}

func TestCompactSessionManagementDetailForUIDropsMessages(t *testing.T) {
	messages := make([]SessionManagementMessageRecord, 0, sessionManagementDetailPayloadMaxMessages+3)
	for index := 0; index < sessionManagementDetailPayloadMaxMessages+3; index++ {
		messages = append(messages, SessionManagementMessageRecord{
			ID:      "m-" + string(rune('a'+index%26)),
			Role:    "assistant",
			Summary: "summary",
			Content: strings.Repeat("content", 100),
		})
	}

	detail := compactSessionManagementDetailForUI(&SessionManagementSessionDetail{
		SessionID:    "session",
		MessageCount: len(messages),
		Messages:     messages,
	})
	if detail.MessageCount != sessionManagementDetailPayloadMaxMessages+3 {
		t.Fatalf("message count = %d, want original total", detail.MessageCount)
	}
	if len(detail.Messages) != 0 {
		t.Fatalf("compacted ui detail kept message rows: %#v", detail.Messages)
	}
}

func TestGetCodexSessionManagementSnapshotGroupsProjectsAndStatuses(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	liveDir := filepath.Join(codexHome, "sessions", "2026", "04", "30")
	archivedDir := filepath.Join(codexHome, "archived_sessions")
	if err := os.MkdirAll(liveDir, 0755); err != nil {
		t.Fatalf("mkdir live dir: %v", err)
	}
	if err := os.MkdirAll(archivedDir, 0755); err != nil {
		t.Fatalf("mkdir archived dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(codexHome, "session_index.jsonl"), []byte(""+
		"{\"id\":\"GetTokens-id\",\"thread_name\":\"GetTokens 会话标题\"}\n"+
		"{\"id\":\"ProxyPoolLab-id\",\"thread_name\":\"Proxy 会话标题\"}\n"), 0600); err != nil {
		t.Fatalf("write session index: %v", err)
	}

	liveGetTokens := filepath.Join(liveDir, "rollout-2026-04-30T12-00-00-gettokens.jsonl")
	liveProxyPool := filepath.Join(liveDir, "rollout-2026-04-30T13-00-00-proxy-pool.jsonl")
	archivedGetTokens := filepath.Join(archivedDir, "rollout-2026-04-28T10-00-00-gettokens-archive.jsonl")

	if err := os.WriteFile(liveGetTokens, []byte(sessionFixture(
		"2026-04-30T12:00:00.000Z",
		"GetTokens",
		"openai",
		"把项目列表接成真实数据",
		"已经接上 snapshot 接口",
	)), 0600); err != nil {
		t.Fatalf("write live gettokens session: %v", err)
	}
	if err := os.WriteFile(liveProxyPool, []byte(sessionFixture(
		"2026-04-30T13:00:00.000Z",
		"ProxyPoolLab",
		"gemini",
		"代理池导入订阅需要真机验证",
		"已经完成本地回归",
	)), 0600); err != nil {
		t.Fatalf("write live proxy pool session: %v", err)
	}
	if err := os.WriteFile(archivedGetTokens, []byte(sessionFixture(
		"2026-04-28T10:00:00.000Z",
		"GetTokens",
		"openai",
		"回退越线工程接入",
		"已恢复到 design-ready",
	)), 0600); err != nil {
		t.Fatalf("write archived gettokens session: %v", err)
	}

	t.Setenv("CODEX_HOME", codexHome)
	app := &App{}
	snapshot, err := app.GetCodexSessionManagementSnapshot()
	if err != nil {
		t.Fatalf("GetCodexSessionManagementSnapshot returned error: %v", err)
	}

	if snapshot.ProjectCount != 2 {
		t.Fatalf("project count = %d, want 2", snapshot.ProjectCount)
	}
	if snapshot.SessionCount != 3 {
		t.Fatalf("session count = %d, want 3", snapshot.SessionCount)
	}
	if snapshot.ActiveSessionCount != 2 {
		t.Fatalf("active session count = %d, want 2", snapshot.ActiveSessionCount)
	}
	if snapshot.ArchivedSessionCount != 1 {
		t.Fatalf("archived session count = %d, want 1", snapshot.ArchivedSessionCount)
	}
	if len(snapshot.ProviderCounts) != 2 {
		t.Fatalf("provider counts len = %d, want 2", len(snapshot.ProviderCounts))
	}
	if snapshot.ProviderCounts["openai"] != 2 {
		t.Fatalf("providerCounts[openai] = %d, want 2", snapshot.ProviderCounts["openai"])
	}
	if snapshot.ProviderCounts["gemini"] != 1 {
		t.Fatalf("providerCounts[gemini] = %d, want 1", snapshot.ProviderCounts["gemini"])
	}

	var gettokensProject SessionManagementProjectRecord
	for _, project := range snapshot.Projects {
		if project.Name == "GetTokens" {
			gettokensProject = project
			break
		}
	}
	if gettokensProject.Name != "GetTokens" {
		t.Fatalf("did not find GetTokens project in snapshot: %#v", snapshot.Projects)
	}
	if gettokensProject.SessionCount != 2 {
		t.Fatalf("GetTokens session count = %d, want 2", gettokensProject.SessionCount)
	}
	if gettokensProject.ActiveSessionCount != 1 || gettokensProject.ArchivedSessionCount != 1 {
		t.Fatalf("GetTokens active/archived = %d/%d, want 1/1", gettokensProject.ActiveSessionCount, gettokensProject.ArchivedSessionCount)
	}
	if gettokensProject.ProviderSummary != "openai 2" {
		t.Fatalf("GetTokens provider summary = %q, want openai 2", gettokensProject.ProviderSummary)
	}
	if gettokensProject.Sessions[0].Status != "active" {
		t.Fatalf("latest GetTokens session status = %q, want active", gettokensProject.Sessions[0].Status)
	}
	if gettokensProject.Sessions[0].Title != "GetTokens 会话标题" {
		t.Fatalf("latest GetTokens title = %q, want thread name", gettokensProject.Sessions[0].Title)
	}
	if gettokensProject.Sessions[1].Status != "archived" {
		t.Fatalf("archived GetTokens session status = %q, want archived", gettokensProject.Sessions[1].Status)
	}
}

func TestGetCodexSessionDetailMasksSensitiveTextAndKeepsMessageRows(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	sessionsDir := filepath.Join(codexHome, "sessions", "2026", "04", "30")
	if err := os.MkdirAll(sessionsDir, 0755); err != nil {
		t.Fatalf("mkdir sessions dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(codexHome, "session_index.jsonl"), []byte("{\"id\":\"019dd-test-session\",\"thread_name\":\"真实线程标题\"}\n"), 0600); err != nil {
		t.Fatalf("write session index: %v", err)
	}

	relativePath := filepath.ToSlash(filepath.Join("sessions", "2026", "04", "30", "rollout-2026-04-30T12-00-00-gettokens.jsonl"))
	absolutePath := filepath.Join(codexHome, relativePath)
	payload := "" +
		"{\"timestamp\":\"2026-04-30T12:00:00.000Z\",\"type\":\"session_meta\",\"payload\":{\"id\":\"019dd-test-session\",\"cwd\":\"/Users/linhey/Desktop/linhay-open-sources/GetTokens\",\"model_provider\":\"openai\",\"git\":{\"repository_url\":\"git@github.com:linhay/GetTokens.git\"}}}\n" +
		"{\"timestamp\":\"2026-04-30T12:00:01.000Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"developer\",\"content\":[{\"type\":\"input_text\",\"text\":\"<permissions instructions> very long system prompt /Users/linhey/Desktop/secret call_123\"}]}}\n" +
		"{\"timestamp\":\"2026-04-30T12:00:02.000Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"user\",\"content\":[{\"type\":\"input_text\",\"text\":\"请处理 /Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/App.tsx 并关注 call_abc123\"}]}}\n" +
		"{\"timestamp\":\"2026-04-30T12:00:03.000Z\",\"type\":\"event_msg\",\"payload\":{\"type\":\"user_message\",\"message\":\"请把工具调用也显示出来\"}}\n" +
		"{\"timestamp\":\"2026-04-30T12:00:04.000Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"function_call\",\"name\":\"exec_command\",\"arguments\":\"{\\\"cmd\\\":\\\"pwd\\\"}\",\"call_id\":\"call_tool_1\"}}\n" +
		"{\"timestamp\":\"2026-04-30T12:00:05.000Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"function_call_output\",\"call_id\":\"call_tool_1\",\"output\":\"/Users/linhey/Desktop/linhay-open-sources/GetTokens\"}}\n" +
		"{\"timestamp\":\"2026-04-30T12:00:06.000Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"reasoning\",\"summary\":[{\"type\":\"summary_text\",\"text\":\"准备整理完整会话行集\"}]}}\n" +
		"{\"timestamp\":\"2026-04-30T12:00:07.000Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"我会先核对 session-management 的页面边界，再继续实现。\"}]}}\n" +
		"{\"timestamp\":\"2026-04-30T12:00:08.000Z\",\"type\":\"event_msg\",\"payload\":{\"type\":\"task_complete\",\"last_agent_message\":\"任务已完成\"}}\n"
	if err := os.WriteFile(absolutePath, []byte(payload), 0600); err != nil {
		t.Fatalf("write session detail fixture: %v", err)
	}

	t.Setenv("CODEX_HOME", codexHome)
	app := &App{}
	detail, err := app.GetCodexSessionDetail(relativePath)
	if err != nil {
		t.Fatalf("GetCodexSessionDetail returned error: %v", err)
	}

	if detail.ProjectName != "GetTokens" {
		t.Fatalf("project name = %q, want GetTokens", detail.ProjectName)
	}
	if detail.Provider != "openai" {
		t.Fatalf("provider = %q, want openai", detail.Provider)
	}
	if detail.Title != "真实线程标题" {
		t.Fatalf("detail title = %q, want 真实线程标题", detail.Title)
	}
	if detail.Archived {
		t.Fatal("expected detail session to be active")
	}
	if detail.MessageCount != 9 {
		t.Fatalf("message count = %d, want 9", detail.MessageCount)
	}
	if detail.RoleSummary != "用户 2 / 助手 1 / 系统 2 / 推理 1 / 工具调用 1 / 工具结果 1 / 事件 1" {
		t.Fatalf("role summary = %q, want expanded role summary", detail.RoleSummary)
	}
	if detail.CurrentMessageLabel != "09 / 事件" {
		t.Fatalf("current message label = %q, want 09 / 事件", detail.CurrentMessageLabel)
	}
	if len(detail.Messages) != 0 {
		t.Fatalf("detail metadata should not keep message rows in memory: %#v", detail.Messages)
	}
	page, err := app.GetCodexSessionMessagePage(relativePath, SessionManagementMessagePageInput{Offset: 0, Limit: 20})
	if err != nil {
		t.Fatalf("GetCodexSessionMessagePage returned error: %v", err)
	}
	if len(page.Messages) != 9 {
		t.Fatalf("page messages = %d, want 9", len(page.Messages))
	}
	if page.Messages[1].Role != "system" || page.Messages[1].Summary != "系统与环境约束已载入（已脱敏）" {
		t.Fatalf("system message = %#v, want masked system summary", page.Messages[1])
	}
	if !page.Messages[1].Truncated {
		t.Fatalf("system message should be flagged truncated: %#v", page.Messages[1])
	}
	if strings.Contains(page.Messages[2].Content, "/Users/linhey") {
		t.Fatalf("user message content leaked absolute path: %q", page.Messages[2].Content)
	}
	if strings.Contains(page.Messages[2].Content, "call_abc123") {
		t.Fatalf("user message content leaked call id: %q", page.Messages[2].Content)
	}
	if !strings.Contains(page.Messages[2].Content, "<redacted-path>") {
		t.Fatalf("user message content missing redacted path placeholder: %q", page.Messages[2].Content)
	}
	if page.Messages[4].Role != "tool_call" || !strings.Contains(page.Messages[4].Summary, "exec_command") {
		t.Fatalf("tool call message = %#v, want exec_command summary", page.Messages[4])
	}
	if page.Messages[5].Role != "tool_result" || !strings.Contains(page.Messages[5].Content, "<redacted-path>") {
		t.Fatalf("tool result message = %#v, want redacted path output", page.Messages[5])
	}
	if page.Messages[6].Role != "reasoning" || !strings.Contains(page.Messages[6].Summary, "完整会话行集") {
		t.Fatalf("reasoning message = %#v, want reasoning summary", page.Messages[6])
	}
	if !strings.Contains(page.Messages[7].Content, "session-management") {
		t.Fatalf("assistant message content = %q, want implementation content", page.Messages[7].Content)
	}
}

func TestCompactSessionManagementDetailForUIDropsMessageRows(t *testing.T) {
	messages := make([]SessionManagementMessageRecord, 0, sessionManagementDetailPayloadMaxMessages+2)
	for index := 0; index < sessionManagementDetailPayloadMaxMessages+2; index++ {
		messages = append(messages, SessionManagementMessageRecord{
			ID:      "m",
			Role:    "user",
			Summary: "summary",
			Content: "large content",
		})
	}
	source := &SessionManagementSessionDetail{
		SessionID: "sessions/test.jsonl",
		Title:     "detail",
		Messages:  messages,
	}

	compacted := compactSessionManagementDetailForUI(source)
	if compacted == nil {
		t.Fatal("compacted detail is nil")
	}
	if len(compacted.Messages) != 0 {
		t.Fatalf("compacted detail should not retain message rows: %#v", compacted.Messages)
	}
	if source.Messages[0].Content != "large content" {
		t.Fatalf("source detail should not be mutated: %#v", source.Messages[0])
	}
}

func TestGetClaudeCodeSessionManagementSnapshotScansMainSessionsAndSkipsSubagents(t *testing.T) {
	home := t.TempDir()
	claudeDir := filepath.Join(home, ".claude")
	projectDir := filepath.Join(claudeDir, "projects", "-Users-linhey-Desktop-GetTokens")
	subagentDir := filepath.Join(projectDir, "main-session", "subagents")
	t.Setenv("HOME", home)
	t.Setenv("CLAUDE_CONFIG_DIR", claudeDir)
	if err := os.MkdirAll(subagentDir, 0755); err != nil {
		t.Fatalf("mkdir claude project dirs: %v", err)
	}

	sessionPath := filepath.Join(projectDir, "main-session.jsonl")
	if err := os.WriteFile(sessionPath, []byte(claudeSessionFixture(
		"main-session",
		"/Users/linhey/Desktop/GetTokens",
		"2026-05-21T10:00:00.000Z",
		"请分析 /Users/linhey/Desktop/GetTokens 的 Claude Code 会话管理，token=secret-token",
		"我会只做只读扫描。",
	)), 0600); err != nil {
		t.Fatalf("write claude session fixture: %v", err)
	}
	if err := os.WriteFile(filepath.Join(subagentDir, "agent-1.jsonl"), []byte(claudeSessionFixture(
		"agent-session",
		"/Users/linhey/Desktop/GetTokens",
		"2026-05-21T10:02:00.000Z",
		"这个 subagent 不应该出现在主会话列表",
		"ignored",
	)), 0600); err != nil {
		t.Fatalf("write subagent fixture: %v", err)
	}

	app := &App{}
	snapshot, err := app.GetClaudeCodeSessionManagementSnapshot()
	if err != nil {
		t.Fatalf("GetClaudeCodeSessionManagementSnapshot returned error: %v", err)
	}
	if snapshot.ProjectCount != 1 || snapshot.SessionCount != 1 {
		t.Fatalf("snapshot counts = %d/%d, want 1/1: %#v", snapshot.ProjectCount, snapshot.SessionCount, snapshot)
	}
	if snapshot.ProviderCounts["claude"] != 1 {
		t.Fatalf("providerCounts[claude] = %d, want 1", snapshot.ProviderCounts["claude"])
	}
	project := snapshot.Projects[0]
	if project.Name != "GetTokens" {
		t.Fatalf("project name = %q, want GetTokens", project.Name)
	}
	session := project.Sessions[0]
	if session.Provider != "claude" || session.Model != "claude-sonnet-4-5" {
		t.Fatalf("session provider/model mismatch: %#v", session)
	}
	if !strings.Contains(session.Summary, "claude --resume main-session") {
		t.Fatalf("summary missing resume command: %q", session.Summary)
	}
	if strings.Contains(session.Summary, "/Users/linhey") || strings.Contains(session.Summary, "secret-token") {
		t.Fatalf("summary leaked sensitive content: %q", session.Summary)
	}
}

func TestGetClaudeCodeSessionDetailMasksMessagesAndToolPayloads(t *testing.T) {
	home := t.TempDir()
	claudeDir := filepath.Join(home, ".claude")
	projectDir := filepath.Join(claudeDir, "projects", "-Users-linhey-Desktop-GetTokens")
	t.Setenv("HOME", home)
	t.Setenv("CLAUDE_CONFIG_DIR", claudeDir)
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		t.Fatalf("mkdir claude project dir: %v", err)
	}

	sessionPath := filepath.Join(projectDir, "detail-session.jsonl")
	if err := os.WriteFile(sessionPath, []byte(claudeSessionFixture(
		"detail-session",
		"/Users/linhey/Desktop/GetTokens",
		"2026-05-21T11:00:00.000Z",
		"请读取 /Users/linhey/Desktop/GetTokens/AGENTS.md 并使用 sk-ant-secret",
		"已经完成只读摘要。",
	)), 0600); err != nil {
		t.Fatalf("write claude detail fixture: %v", err)
	}

	relativeID := filepath.ToSlash(filepath.Join("projects", "-Users-linhey-Desktop-GetTokens", "detail-session.jsonl"))
	app := &App{}
	detail, err := app.GetClaudeCodeSessionDetail(relativeID)
	if err != nil {
		t.Fatalf("GetClaudeCodeSessionDetail returned error: %v", err)
	}
	if detail.Provider != "claude" || !detail.Masked {
		t.Fatalf("detail provider/masked mismatch: %#v", detail)
	}
	if detail.MessageCount != 5 {
		t.Fatalf("message count = %d, want 5: %#v", detail.MessageCount, detail.Messages)
	}
	if !strings.Contains(detail.Preview, "claude --resume detail-session") {
		t.Fatalf("detail preview missing resume command: %q", detail.Preview)
	}
	if len(detail.Messages) != 0 {
		t.Fatalf("detail metadata should not keep claude message rows in memory: %#v", detail.Messages)
	}
	page, err := app.GetClaudeCodeSessionMessagePage(relativeID, SessionManagementMessagePageInput{Offset: 0, Limit: 10})
	if err != nil {
		t.Fatalf("GetClaudeCodeSessionMessagePage returned error: %v", err)
	}
	for _, message := range page.Messages {
		if strings.Contains(message.Content, "/Users/linhey") || strings.Contains(message.Summary, "/Users/linhey") {
			t.Fatalf("message leaked path: %#v", message)
		}
		if strings.Contains(message.Content, "sk-ant-secret") || strings.Contains(message.Summary, "sk-ant-secret") {
			t.Fatalf("message leaked token: %#v", message)
		}
	}
	if page.Messages[2].Role != "tool_call" {
		t.Fatalf("third message role = %q, want tool_call: %#v", page.Messages[2].Role, page.Messages)
	}
	if page.Messages[3].Role != "tool_result" {
		t.Fatalf("fourth message role = %q, want tool_result: %#v", page.Messages[3].Role, page.Messages)
	}
}

func TestGetCodexSessionManagementSnapshotUsesAppMemoryCacheUntilExplicitRefresh(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	sessionsDir := filepath.Join(codexHome, "sessions", "2026", "04", "30")
	if err := os.MkdirAll(sessionsDir, 0755); err != nil {
		t.Fatalf("mkdir sessions dir: %v", err)
	}

	rolloutPath := filepath.Join(sessionsDir, "rollout-2026-04-30T12-00-00-gettokens.jsonl")
	if err := os.WriteFile(rolloutPath, []byte(sessionFixture(
		"2026-04-30T12:00:00.000Z",
		"GetTokens",
		"openai",
		"先做第一页真实接入",
		"第一页已经落地",
	)), 0600); err != nil {
		t.Fatalf("write initial rollout: %v", err)
	}

	t.Setenv("CODEX_HOME", codexHome)
	app := &App{}

	first, err := app.GetCodexSessionManagementSnapshot()
	if err != nil {
		t.Fatalf("first GetCodexSessionManagementSnapshot returned error: %v", err)
	}
	if first.SessionCount != 1 {
		t.Fatalf("first session count = %d, want 1", first.SessionCount)
	}

	file, err := os.OpenFile(rolloutPath, os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		t.Fatalf("OpenFile append: %v", err)
	}
	if _, err := file.WriteString("" +
		"{\"timestamp\":\"2026-04-30T12:01:00.000Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"user\",\"content\":[{\"type\":\"input_text\",\"text\":\"再加一个新会话\"}]}}\n" +
		"{\"timestamp\":\"2026-04-30T12:01:00.000Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"已补充第二轮结果\"}]}}\n"); err != nil {
		_ = file.Close()
		t.Fatalf("WriteString append: %v", err)
	}
	if err := file.Close(); err != nil {
		t.Fatalf("Close append file: %v", err)
	}

	second, err := app.GetCodexSessionManagementSnapshot()
	if err != nil {
		t.Fatalf("second GetCodexSessionManagementSnapshot returned error: %v", err)
	}
	if second.SessionCount != 1 {
		t.Fatalf("second session count = %d, want cached 1 before explicit refresh", second.SessionCount)
	}

	third, err := app.RefreshCodexSessionManagementSnapshot()
	if err != nil {
		t.Fatalf("RefreshCodexSessionManagementSnapshot returned error: %v", err)
	}
	if third.SessionCount != 1 {
		t.Fatalf("third session count = %d, want still 1 because same rollout file should not create extra session", third.SessionCount)
	}
	if third.Projects[0].Sessions[0].MessageCount <= first.Projects[0].Sessions[0].MessageCount {
		t.Fatalf("third message count = %d, want refreshed snapshot to include appended messages beyond %d", third.Projects[0].Sessions[0].MessageCount, first.Projects[0].Sessions[0].MessageCount)
	}
}

func TestUpdateCodexSessionProvidersRewritesSessionMetaAndRefreshesSnapshot(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	sessionsDir := filepath.Join(codexHome, "sessions", "2026", "04", "30")
	if err := os.MkdirAll(sessionsDir, 0755); err != nil {
		t.Fatalf("mkdir sessions dir: %v", err)
	}

	geminiPath := filepath.Join(sessionsDir, "rollout-2026-04-30T12-00-00-gemini.jsonl")
	openaiPath := filepath.Join(sessionsDir, "rollout-2026-04-30T12-05-00-openai.jsonl")
	if err := os.WriteFile(geminiPath, []byte(sessionFixture(
		"2026-04-30T12:00:00.000Z",
		"GetTokens",
		"gemini",
		"把 gemini 会话归到 openai",
		"准备修改 provider",
	)), 0600); err != nil {
		t.Fatalf("write gemini rollout: %v", err)
	}
	if err := os.WriteFile(openaiPath, []byte(sessionFixture(
		"2026-04-30T12:05:00.000Z",
		"GetTokens",
		"openai",
		"保留 openai 会话",
		"保持不动",
	)), 0600); err != nil {
		t.Fatalf("write openai rollout: %v", err)
	}

	t.Setenv("CODEX_HOME", codexHome)
	app := &App{}
	snapshot, err := app.GetCodexSessionManagementSnapshot()
	if err != nil {
		t.Fatalf("GetCodexSessionManagementSnapshot returned error: %v", err)
	}
	if snapshot.ProviderCounts["gemini"] != 1 || snapshot.ProviderCounts["openai"] != 1 {
		t.Fatalf("unexpected initial provider counts: %#v", snapshot.ProviderCounts)
	}

	laterPath := filepath.Join(sessionsDir, "rollout-2026-04-30T12-10-00-later.jsonl")
	if err := os.WriteFile(laterPath, []byte(sessionFixture(
		"2026-04-30T12:10:00.000Z",
		"LaterProject",
		"gemini",
		"这个文件在缓存后出现",
		"保存 provider 归并时不应该同步全量扫描吸收它",
	)), 0600); err != nil {
		t.Fatalf("write later rollout: %v", err)
	}

	updated, err := app.UpdateCodexSessionProviders(UpdateSessionProvidersInput{
		ProjectID: "gettokens",
		Mappings: []UpdateSessionProviderMapping{
			{SourceProvider: "gemini", TargetProvider: "openai"},
		},
	})
	if err != nil {
		t.Fatalf("UpdateCodexSessionProviders returned error: %v", err)
	}

	if updated.ProviderCounts["openai"] != 2 {
		t.Fatalf("updated providerCounts[openai] = %d, want 2", updated.ProviderCounts["openai"])
	}
	if updated.ProviderCounts["gemini"] != 0 {
		t.Fatalf("updated providerCounts[gemini] = %d, want 0", updated.ProviderCounts["gemini"])
	}
	if updated.Projects[0].ProviderSummary != "openai 2" {
		t.Fatalf("project provider summary = %q, want openai 2", updated.Projects[0].ProviderSummary)
	}
	if updated.SessionCount != 2 {
		t.Fatalf("updated session count = %d, want cached 2 without full refresh", updated.SessionCount)
	}
	for _, project := range updated.Projects {
		if project.ID == "laterproject" {
			t.Fatalf("provider merge should not absorb sessions added after cached snapshot: %#v", updated.Projects)
		}
	}

	content, err := os.ReadFile(geminiPath)
	if err != nil {
		t.Fatalf("ReadFile rewritten rollout: %v", err)
	}
	if !strings.Contains(string(content), `"model_provider":"openai"`) {
		t.Fatalf("rewritten rollout missing updated provider: %s", string(content))
	}
}

func TestUpdateCodexSessionProvidersUsesProvidedSnapshotWhenCacheIsCold(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	sessionsDir := filepath.Join(codexHome, "sessions", "2026", "05", "16")
	if err := os.MkdirAll(sessionsDir, 0755); err != nil {
		t.Fatalf("mkdir sessions dir: %v", err)
	}

	geminiPath := filepath.Join(sessionsDir, "rollout-2026-05-16T12-00-00-gemini.jsonl")
	openaiPath := filepath.Join(sessionsDir, "rollout-2026-05-16T12-05-00-openai.jsonl")
	if err := os.WriteFile(geminiPath, []byte(sessionFixture(
		"2026-05-16T12:00:00.000Z",
		"GetTokens",
		"gemini",
		"把缓存快照里的 gemini 会话归到 openai",
		"保存时不应该先等待冷缓存全量扫描",
	)), 0600); err != nil {
		t.Fatalf("write gemini rollout: %v", err)
	}
	if err := os.WriteFile(openaiPath, []byte(sessionFixture(
		"2026-05-16T12:05:00.000Z",
		"GetTokens",
		"openai",
		"保留 openai 会话",
		"保持不动",
	)), 0600); err != nil {
		t.Fatalf("write openai rollout: %v", err)
	}

	t.Setenv("CODEX_HOME", codexHome)
	sourceApp := &App{}
	snapshot, err := sourceApp.GetCodexSessionManagementSnapshot()
	if err != nil {
		t.Fatalf("GetCodexSessionManagementSnapshot returned error: %v", err)
	}

	laterPath := filepath.Join(sessionsDir, "rollout-2026-05-16T12-10-00-later.jsonl")
	if err := os.WriteFile(laterPath, []byte(sessionFixture(
		"2026-05-16T12:10:00.000Z",
		"LaterProject",
		"gemini",
		"这个文件在前端缓存快照之后出现",
		"冷缓存保存也不应该为了刷新而吸收它",
	)), 0600); err != nil {
		t.Fatalf("write later rollout: %v", err)
	}

	coldApp := &App{}
	updated, err := coldApp.UpdateCodexSessionProviders(UpdateSessionProvidersInput{
		ProjectID: "gettokens",
		Mappings: []UpdateSessionProviderMapping{
			{SourceProvider: "gemini", TargetProvider: "openai"},
		},
		Snapshot: snapshot,
	})
	if err != nil {
		t.Fatalf("UpdateCodexSessionProviders returned error: %v", err)
	}

	if updated.ProviderCounts["openai"] != 2 {
		t.Fatalf("updated providerCounts[openai] = %d, want 2", updated.ProviderCounts["openai"])
	}
	if updated.SessionCount != 2 {
		t.Fatalf("updated session count = %d, want provided snapshot count 2", updated.SessionCount)
	}
	for _, project := range updated.Projects {
		if project.ID == "laterproject" {
			t.Fatalf("cold provider merge should use provided snapshot instead of full scan: %#v", updated.Projects)
		}
	}

	content, err := os.ReadFile(geminiPath)
	if err != nil {
		t.Fatalf("ReadFile rewritten rollout: %v", err)
	}
	if !strings.Contains(string(content), `"model_provider":"openai"`) {
		t.Fatalf("rewritten rollout missing updated provider: %s", string(content))
	}
}

func TestAnalyzeCodexSessionsAggregatesAllSessionsWithJiebaTerms(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	sessionsDir := filepath.Join(codexHome, "sessions", "2026", "05", "27")
	if err := os.MkdirAll(sessionsDir, 0755); err != nil {
		t.Fatalf("mkdir sessions dir: %v", err)
	}

	gettokensPath := filepath.Join(sessionsDir, "rollout-2026-05-27T10-00-00-gettokens.jsonl")
	cliproxyPath := filepath.Join(sessionsDir, "rollout-2026-05-27T10-05-00-cliproxyapi.jsonl")
	if err := os.WriteFile(gettokensPath, []byte(sessionFixture(
		"2026-05-27T10:00:00.000Z",
		"GetTokens",
		"openai",
		"会话 深度分析 需要 jieba 分词 和 批量 主题 提取",
		"jieba 分词 可以 聚合 会话 关键词 和 角色 贡献",
	)), 0600); err != nil {
		t.Fatalf("write gettokens rollout: %v", err)
	}
	if err := os.WriteFile(cliproxyPath, []byte(sessionFixture(
		"2026-05-27T10:05:00.000Z",
		"CLIProxyAPI",
		"openai",
		"批量 会话 分析 需要 过滤 噪声 和 token",
		"项目 维度 应该 汇总 会话 主题 和 关键词",
	)), 0600); err != nil {
		t.Fatalf("write cliproxy rollout: %v", err)
	}

	t.Setenv("CODEX_HOME", codexHome)
	app := &App{}
	result, err := app.AnalyzeCodexSessions(AnalyzeCodexSessionsInput{Scope: "all"})
	if err != nil {
		t.Fatalf("AnalyzeCodexSessions returned error: %v", err)
	}

	if result.AnalyzedSessionCount != 2 {
		t.Fatalf("analyzed session count = %d, want 2", result.AnalyzedSessionCount)
	}
	if result.TotalMessages != 4 {
		t.Fatalf("total messages = %d, want 4", result.TotalMessages)
	}
	if len(result.Projects) != 2 {
		t.Fatalf("project summaries len = %d, want 2: %#v", len(result.Projects), result.Projects)
	}
	if !analysisHasKeyword(result.Keywords, "会话", 4, 2) {
		t.Fatalf("global keywords missing 会话 count/session coverage: %#v", result.Keywords)
	}
	if !analysisHasKeyword(result.Keywords, "分词", 2, 1) {
		t.Fatalf("global keywords missing 分词 count/session coverage: %#v", result.Keywords)
	}
	if !analysisHasWordCloudTerm(result.WordCloud, "会话", 4, 2) {
		t.Fatalf("word cloud missing 会话 term: %#v", result.WordCloud)
	}
	if !analysisHasCommonPhrase(result.CommonPhrases, "jieba 分词 聚合", 1, 1) {
		t.Fatalf("common phrases missing jieba 分词 聚合 phrase: %#v", result.CommonPhrases)
	}
	if result.RoleContributions[0].Role != "assistant" || result.RoleContributions[0].MessageCount != 2 {
		t.Fatalf("top role contribution = %#v, want assistant with 2 messages", result.RoleContributions)
	}
	if result.Sessions[0].TopicLine == "" || result.Sessions[0].TopicLine == "—" {
		t.Fatalf("session topic line should be populated: %#v", result.Sessions[0])
	}
}

func TestAnalyzeCodexSessionsCanTargetSelectedSessionIDs(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	sessionsDir := filepath.Join(codexHome, "sessions", "2026", "05", "27")
	if err := os.MkdirAll(sessionsDir, 0755); err != nil {
		t.Fatalf("mkdir sessions dir: %v", err)
	}

	selectedRelativePath := filepath.ToSlash(filepath.Join("sessions", "2026", "05", "27", "selected.jsonl"))
	ignoredRelativePath := filepath.ToSlash(filepath.Join("sessions", "2026", "05", "27", "ignored.jsonl"))
	if err := os.WriteFile(filepath.Join(codexHome, selectedRelativePath), []byte(sessionFixture(
		"2026-05-27T11:00:00.000Z",
		"GetTokens",
		"openai",
		"指定 会话 只 分析 选中 批次",
		"选中 会话 输出 关键词",
	)), 0600); err != nil {
		t.Fatalf("write selected rollout: %v", err)
	}
	if err := os.WriteFile(filepath.Join(codexHome, ignoredRelativePath), []byte(sessionFixture(
		"2026-05-27T11:05:00.000Z",
		"GetTokens",
		"openai",
		"忽略 会话 不应 进入 结果",
		"忽略 关键词 不应 出现",
	)), 0600); err != nil {
		t.Fatalf("write ignored rollout: %v", err)
	}

	t.Setenv("CODEX_HOME", codexHome)
	app := &App{}
	result, err := app.AnalyzeCodexSessions(AnalyzeCodexSessionsInput{
		Scope:      "selected",
		SessionIDs: []string{selectedRelativePath},
	})
	if err != nil {
		t.Fatalf("AnalyzeCodexSessions selected returned error: %v", err)
	}

	if result.AnalyzedSessionCount != 1 {
		t.Fatalf("analyzed session count = %d, want 1", result.AnalyzedSessionCount)
	}
	if result.Sessions[0].SessionID != selectedRelativePath {
		t.Fatalf("analyzed session id = %q, want selected relative path", result.Sessions[0].SessionID)
	}
	if analysisHasKeyword(result.Keywords, "忽略", 1, 1) {
		t.Fatalf("selected analysis included ignored session keyword: %#v", result.Keywords)
	}
	if !analysisHasKeyword(result.Keywords, "选中", 2, 1) {
		t.Fatalf("selected analysis missing selected keyword: %#v", result.Keywords)
	}
}

func analysisHasKeyword(items []SessionAnalysisKeyword, term string, minCount int, minSessionCount int) bool {
	for _, item := range items {
		if item.Term == term && item.Count >= minCount && item.SessionCount >= minSessionCount {
			return true
		}
	}
	return false
}

func analysisHasWordCloudTerm(items []SessionAnalysisWordCloudItem, term string, minCount int, minSessionCount int) bool {
	for _, item := range items {
		if item.Term == term && item.Count >= minCount && item.SessionCount >= minSessionCount && item.Weight > 0 {
			return true
		}
	}
	return false
}

func analysisHasCommonPhrase(items []SessionAnalysisCommonPhrase, text string, minCount int, minSessionCount int) bool {
	for _, item := range items {
		if item.Text == text && item.Count >= minCount && item.SessionCount >= minSessionCount {
			return true
		}
	}
	return false
}

func sessionFixture(timestamp string, projectName string, modelProvider string, userText string, assistantText string) string {
	return "" +
		"{\"timestamp\":\"" + timestamp + "\",\"type\":\"session_meta\",\"payload\":{\"id\":\"" + projectName + "-id\",\"cwd\":\"/Users/linhey/Desktop/" + projectName + "\",\"model_provider\":\"" + modelProvider + "\",\"git\":{\"repository_url\":\"git@github.com:linhay/" + projectName + ".git\"}}}\n" +
		"{\"timestamp\":\"" + timestamp + "\",\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"user\",\"content\":[{\"type\":\"input_text\",\"text\":\"" + userText + "\"}]}}\n" +
		"{\"timestamp\":\"" + timestamp + "\",\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"" + assistantText + "\"}]}}\n"
}

func claudeSessionFixture(sessionID string, cwd string, timestamp string, userText string, assistantText string) string {
	return "" +
		"{\"type\":\"attachment\",\"timestamp\":\"" + timestamp + "\",\"cwd\":\"" + cwd + "\",\"sessionId\":\"" + sessionID + "\"}\n" +
		"{\"type\":\"user\",\"timestamp\":\"" + timestamp + "\",\"cwd\":\"" + cwd + "\",\"sessionId\":\"" + sessionID + "\",\"message\":{\"role\":\"user\",\"content\":\"" + userText + "\"}}\n" +
		"{\"type\":\"assistant\",\"timestamp\":\"2026-05-21T11:00:01.000Z\",\"cwd\":\"" + cwd + "\",\"sessionId\":\"" + sessionID + "\",\"message\":{\"role\":\"assistant\",\"model\":\"claude-sonnet-4-5\",\"content\":[{\"type\":\"tool_use\",\"name\":\"Read\",\"input\":{\"file_path\":\"/Users/linhey/Desktop/GetTokens/AGENTS.md\",\"api_key\":\"sk-ant-secret\"}}]}}\n" +
		"{\"type\":\"user\",\"timestamp\":\"2026-05-21T11:00:02.000Z\",\"cwd\":\"" + cwd + "\",\"sessionId\":\"" + sessionID + "\",\"message\":{\"role\":\"user\",\"content\":[{\"type\":\"tool_result\",\"content\":\"Read /Users/linhey/Desktop/GetTokens/AGENTS.md with token sk-ant-secret\"}]}}\n" +
		"{\"type\":\"assistant\",\"timestamp\":\"2026-05-21T11:00:03.000Z\",\"cwd\":\"" + cwd + "\",\"sessionId\":\"" + sessionID + "\",\"message\":{\"role\":\"assistant\",\"model\":\"claude-sonnet-4-5\",\"content\":[{\"type\":\"text\",\"text\":\"" + assistantText + "\"}]}}\n"
}
