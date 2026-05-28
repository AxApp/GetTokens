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

func TestCompactSessionManagementDetailForUIDropsContentAndCapsMessages(t *testing.T) {
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
	if len(detail.Messages) != sessionManagementDetailPayloadMaxMessages {
		t.Fatalf("returned messages = %d, want capped %d", len(detail.Messages), sessionManagementDetailPayloadMaxMessages)
	}
	for _, message := range detail.Messages {
		if message.Content != "" {
			t.Fatalf("compacted ui detail kept content: %#v", message)
		}
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
	if detail.Messages[1].Role != "system" || detail.Messages[1].Summary != "系统与环境约束已载入（已脱敏）" {
		t.Fatalf("system message = %#v, want masked system summary", detail.Messages[1])
	}
	if !detail.Messages[1].Truncated {
		t.Fatalf("system message should be flagged truncated: %#v", detail.Messages[1])
	}
	if detail.Messages[2].Content != "" {
		t.Fatalf("ui detail should not keep full message content in memory: %q", detail.Messages[2].Content)
	}
	if strings.Contains(detail.Messages[2].Summary, "/Users/linhey") {
		t.Fatalf("user message summary leaked absolute path: %q", detail.Messages[2].Summary)
	}
	if strings.Contains(detail.Messages[2].Summary, "call_abc123") {
		t.Fatalf("user message summary leaked call id: %q", detail.Messages[2].Summary)
	}
	if !strings.Contains(detail.Messages[2].Summary, "<redacted-path>") {
		t.Fatalf("user message summary missing redacted path placeholder: %q", detail.Messages[2].Summary)
	}
	if detail.Messages[4].Role != "tool_call" || !strings.Contains(detail.Messages[4].Summary, "exec_command") {
		t.Fatalf("tool call message = %#v, want exec_command summary", detail.Messages[4])
	}
	if detail.Messages[5].Role != "tool_result" || !strings.Contains(detail.Messages[5].Summary, "<redacted-path>") {
		t.Fatalf("tool result message = %#v, want redacted path output", detail.Messages[5])
	}
	if detail.Messages[6].Role != "reasoning" || !strings.Contains(detail.Messages[6].Summary, "完整会话行集") {
		t.Fatalf("reasoning message = %#v, want reasoning summary", detail.Messages[6])
	}
	if !strings.Contains(detail.Messages[7].Summary, "session-management") {
		t.Fatalf("assistant message summary = %q, want implementation summary", detail.Messages[7].Summary)
	}
}

func TestCompactSessionManagementDetailForUIKeepsSummariesOnly(t *testing.T) {
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
	if len(compacted.Messages) != sessionManagementDetailPayloadMaxMessages {
		t.Fatalf("compacted message count = %d, want %d", len(compacted.Messages), sessionManagementDetailPayloadMaxMessages)
	}
	for _, message := range compacted.Messages {
		if message.Summary != "summary" {
			t.Fatalf("message summary = %q, want retained summary", message.Summary)
		}
		if message.Content != "" {
			t.Fatalf("message content should be removed from compacted UI payload: %q", message.Content)
		}
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
	for _, message := range detail.Messages {
		if strings.Contains(message.Content, "/Users/linhey") || strings.Contains(message.Summary, "/Users/linhey") {
			t.Fatalf("message leaked path: %#v", message)
		}
		if strings.Contains(message.Content, "sk-ant-secret") || strings.Contains(message.Summary, "sk-ant-secret") {
			t.Fatalf("message leaked token: %#v", message)
		}
	}
	if detail.Messages[2].Role != "tool_call" {
		t.Fatalf("third message role = %q, want tool_call: %#v", detail.Messages[2].Role, detail.Messages)
	}
	if detail.Messages[3].Role != "tool_result" {
		t.Fatalf("fourth message role = %q, want tool_result: %#v", detail.Messages[3].Role, detail.Messages)
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
