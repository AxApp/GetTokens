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
	if got := record.AccountKind; got != AccountKindCodexAPIKey {
		t.Fatalf("AccountKind = %q, want %q", got, AccountKindCodexAPIKey)
	}
}

func TestBuildCodexAPIKeyAccountRecordKeepsDisabledState(t *testing.T) {
	record := BuildCodexAPIKeyAccountRecord(cliproxyapi.CodexAPIKey{
		APIKey:   "sk-test-123456",
		BaseURL:  "https://api.openai.com/v1",
		Disabled: true,
	})

	if !record.Disabled {
		t.Fatal("expected record to keep disabled state")
	}
	if got := record.Status; got != "disabled" {
		t.Fatalf("Status = %q, want disabled", got)
	}
}

func TestBuildCodexAPIKeyAccountRecordPrefersStableLocalID(t *testing.T) {
	record := BuildCodexAPIKeyAccountRecord(cliproxyapi.CodexAPIKey{
		LocalID: "codex-api-key:stable-001",
		APIKey:  "sk-test-123456",
		BaseURL: "https://api.openai.com/v1",
	})

	if got := record.ID; got != "codex-api-key:stable-001" {
		t.Fatalf("ID = %q, want codex-api-key:stable-001", got)
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
	if got := record.AccountKind; got != AccountKindOpenAICompatible {
		t.Fatalf("AccountKind = %q, want %q", got, AccountKindOpenAICompatible)
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

func TestBuildUnifiedOpenAICompatibleAccountRecordKeepsAccountKeyAndKind(t *testing.T) {
	record := BuildUnifiedAccountRecord(cliproxyapi.UnifiedAccount{
		AccountKey: "acct_00000000-0000-4000-8000-000000000001",
		Kind:       cliproxyapi.AccountKindOpenAICompatible,
		Title:      "DeepSeek Team",
		Provider:   "deepseek",
		OpenAICompatible: &cliproxyapi.OpenAICompatibleAccountCredential{
			ProviderName:      "deepseek",
			BaseURL:           "https://api.deepseek.com/v1",
			APIKeyEntriesJSON: `[{"api-key":"sk-test-987654"}]`,
		},
	})

	if got := record.ID; got != "acct_00000000-0000-4000-8000-000000000001" {
		t.Fatalf("ID = %q, want account key", got)
	}
	if got := record.AccountKind; got != AccountKindOpenAICompatible {
		t.Fatalf("AccountKind = %q, want %q", got, AccountKindOpenAICompatible)
	}
	if got := record.DisplayName; got != "DeepSeek Team" {
		t.Fatalf("DisplayName = %q, want DeepSeek Team", got)
	}
}

func TestBuildOpenAICompatibleProviderAccountRecordKeepsDisabledState(t *testing.T) {
	record := BuildOpenAICompatibleProviderAccountRecord(cliproxyapi.OpenAICompatibleProvider{
		Name:     "deepseek",
		BaseURL:  "https://api.deepseek.com/v1",
		Disabled: true,
	})

	if !record.Disabled {
		t.Fatal("expected record to keep disabled state")
	}
	if got := record.Status; got != "disabled" {
		t.Fatalf("Status = %q, want disabled", got)
	}
}
