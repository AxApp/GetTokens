package wailsapp

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

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
	if strings.Contains(detail.Messages[2].Content, "/Users/linhey") {
		t.Fatalf("user message leaked absolute path: %q", detail.Messages[2].Content)
	}
	if strings.Contains(detail.Messages[2].Content, "call_abc123") {
		t.Fatalf("user message leaked call id: %q", detail.Messages[2].Content)
	}
	if !strings.Contains(detail.Messages[2].Content, "<redacted-path>") {
		t.Fatalf("user message missing redacted path placeholder: %q", detail.Messages[2].Content)
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
