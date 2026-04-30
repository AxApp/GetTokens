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
	if !strings.Contains(gettokensProject.Sessions[0].Title, "把项目列表接成真实数据") {
		t.Fatalf("latest GetTokens title = %q, want user message summary", gettokensProject.Sessions[0].Title)
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

	relativePath := filepath.ToSlash(filepath.Join("sessions", "2026", "04", "30", "rollout-2026-04-30T12-00-00-gettokens.jsonl"))
	absolutePath := filepath.Join(codexHome, relativePath)
	payload := "" +
		"{\"timestamp\":\"2026-04-30T12:00:00.000Z\",\"type\":\"session_meta\",\"payload\":{\"id\":\"019dd-test-session\",\"cwd\":\"/Users/linhey/Desktop/linhay-open-sources/GetTokens\",\"model_provider\":\"openai\",\"git\":{\"repository_url\":\"git@github.com:linhay/GetTokens.git\"}}}\n" +
		"{\"timestamp\":\"2026-04-30T12:00:01.000Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"developer\",\"content\":[{\"type\":\"input_text\",\"text\":\"<permissions instructions> very long system prompt /Users/linhey/Desktop/secret call_123\"}]}}\n" +
		"{\"timestamp\":\"2026-04-30T12:00:02.000Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"user\",\"content\":[{\"type\":\"input_text\",\"text\":\"请处理 /Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/App.tsx 并关注 call_abc123\"}]}}\n" +
		"{\"timestamp\":\"2026-04-30T12:00:03.000Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"我会先核对 session-management 的页面边界，再继续实现。\"}]}}\n"
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
	if detail.Archived {
		t.Fatal("expected detail session to be active")
	}
	if detail.MessageCount != 3 {
		t.Fatalf("message count = %d, want 3", detail.MessageCount)
	}
	if detail.RoleSummary != "用户 1 / 助手 1 / 系统 1" {
		t.Fatalf("role summary = %q, want 用户 1 / 助手 1 / 系统 1", detail.RoleSummary)
	}
	if detail.CurrentMessageLabel != "03 / 助手" {
		t.Fatalf("current message label = %q, want 03 / 助手", detail.CurrentMessageLabel)
	}
	if detail.Messages[0].Role != "system" || detail.Messages[0].Summary != "系统与环境约束已载入（已脱敏）" {
		t.Fatalf("system message = %#v, want masked system summary", detail.Messages[0])
	}
	if !detail.Messages[0].Truncated {
		t.Fatalf("system message should be flagged truncated: %#v", detail.Messages[0])
	}
	if strings.Contains(detail.Messages[1].Content, "/Users/linhey") {
		t.Fatalf("user message leaked absolute path: %q", detail.Messages[1].Content)
	}
	if strings.Contains(detail.Messages[1].Content, "call_abc123") {
		t.Fatalf("user message leaked call id: %q", detail.Messages[1].Content)
	}
	if !strings.Contains(detail.Messages[1].Content, "<redacted-path>") {
		t.Fatalf("user message missing redacted path placeholder: %q", detail.Messages[1].Content)
	}
	if !strings.Contains(detail.Messages[2].Summary, "session-management") {
		t.Fatalf("assistant message summary = %q, want implementation summary", detail.Messages[2].Summary)
	}
}

func sessionFixture(timestamp string, projectName string, modelProvider string, userText string, assistantText string) string {
	return "" +
		"{\"timestamp\":\"" + timestamp + "\",\"type\":\"session_meta\",\"payload\":{\"id\":\"" + projectName + "-id\",\"cwd\":\"/Users/linhey/Desktop/" + projectName + "\",\"model_provider\":\"" + modelProvider + "\",\"git\":{\"repository_url\":\"git@github.com:linhay/" + projectName + ".git\"}}}\n" +
		"{\"timestamp\":\"" + timestamp + "\",\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"user\",\"content\":[{\"type\":\"input_text\",\"text\":\"" + userText + "\"}]}}\n" +
		"{\"timestamp\":\"" + timestamp + "\",\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"" + assistantText + "\"}]}}\n"
}
