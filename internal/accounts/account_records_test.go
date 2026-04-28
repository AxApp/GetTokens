package accounts

import (
	"testing"

	"github.com/linhay/gettokens/internal/cliproxyapi"
)

func TestBuildAuthFileAccountRecordKeepsStatusMessage(t *testing.T) {
	record := BuildAuthFileAccountRecord(AuthFileRecord{
		Name:          "broken.json",
		Provider:      "codex",
		Status:        "error",
		StatusMessage: "refresh token expired",
	})

	if got := record.Status; got != "error" {
		t.Fatalf("Status = %q, want error", got)
	}
	if got := record.StatusMessage; got != "refresh token expired" {
		t.Fatalf("StatusMessage = %q, want refresh token expired", got)
	}
}

func TestBuildCodexAPIKeyAccountRecordPrefersPersistedLabel(t *testing.T) {
	record := BuildCodexAPIKeyAccountRecord(cliproxyapi.CodexAPIKey{
		APIKey:  "sk-test-123456",
		BaseURL: "https://api.openai.com/v1",
		Label:   "PRIMARY PROD KEY",
	})

	if got := record.DisplayName; got != "PRIMARY PROD KEY" {
		t.Fatalf("DisplayName = %q, want PRIMARY PROD KEY", got)
	}
}

func TestBuildOpenAICompatibleProviderAccountRecordUsesProviderPriority(t *testing.T) {
	record := BuildOpenAICompatibleProviderAccountRecord(cliproxyapi.OpenAICompatibleProvider{
		Name:     "deepseek",
		Priority: 9,
		Prefix:   "team-a",
		BaseURL:  "https://api.deepseek.com/v1",
		APIKeyEntries: []cliproxyapi.OpenAICompatibleAPIKeyEntry{
			{APIKey: "sk-test-987654"},
		},
	})

	if got := record.ID; got != "openai-compatible:deepseek" {
		t.Fatalf("ID = %q, want openai-compatible:deepseek", got)
	}
	if got := record.Priority; got != 9 {
		t.Fatalf("Priority = %d, want 9", got)
	}
	if got := record.Provider; got != "deepseek" {
		t.Fatalf("Provider = %q, want deepseek", got)
	}
	if got := record.DisplayName; got != "OPENAI-COMPATIBLE · DEEPSEEK" {
		t.Fatalf("DisplayName = %q, want OPENAI-COMPATIBLE · DEEPSEEK", got)
	}
}
