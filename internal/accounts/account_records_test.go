package accounts

import (
	"strings"
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

func TestBuildUnifiedAuthFileAccountRecordFallsBackToSourceNamePlanType(t *testing.T) {
	record := BuildUnifiedAccountRecord(cliproxyapi.UnifiedAccount{
		AccountKey: "acct_00000000-0000-4000-8000-000000000001",
		Kind:       cliproxyapi.AccountKindAuthFile,
		Title:      "Codex Account",
		Provider:   "codex",
		AuthFile: &cliproxyapi.AuthFileAccountCredential{
			SourceFileName: "codex-user@example.com-plus.json",
			AuthJSON:       `{"id":"codex-user@example.com-plus.json","provider":"codex","metadata":{"email":"user@example.com"}}`,
			Email:          "user@example.com",
		},
	})

	if got := record.PlanType; got != "plus" {
		t.Fatalf("PlanType = %q, want plus", got)
	}
}

func TestBuildUnifiedAuthFileAccountRecordInfersCodexProviderFromAuthJSONWhenStoreMetadataUnknown(t *testing.T) {
	record := BuildUnifiedAccountRecord(cliproxyapi.UnifiedAccount{
		AccountKey: "acct_00000000-0000-4000-8000-000000000009",
		Kind:       cliproxyapi.AccountKindAuthFile,
		Title:      "codex-unknown.json",
		Provider:   "unknown",
		AuthFile: &cliproxyapi.AuthFileAccountCredential{
			SourceFileName: "codex-unknown.json",
			AuthJSON:       `{"type":"codex","email":"ops@example.com","plan_type":"pro"}`,
			AuthType:       "unknown",
		},
	})

	if got := record.Provider; got != "codex" {
		t.Fatalf("Provider = %q, want codex", got)
	}
}

func TestBuildUnifiedAccountRecordMapsRuntimeRouteabilityState(t *testing.T) {
	record := BuildUnifiedAccountRecord(cliproxyapi.UnifiedAccount{
		AccountKey:                   "acct_00000000-0000-4000-8000-000000000010",
		Kind:                         cliproxyapi.AccountKindCodexAPIKey,
		Title:                        "Primary Codex",
		Provider:                     "codex",
		RuntimeRouteabilityStatus:    "applied_not_registered",
		RuntimeRouteabilityReason:    "runtime auth missing from registry",
		RuntimeRegisteredModelsCount: 0,
		RuntimeRepairOutcome:         "failed",
		RuntimeRepairAction:          "watcher_refresh",
		RuntimeRepairTriggerStatus:   "applied_not_registered",
		RuntimeRepairTriggerClass:    "runtime_auth_missing",
		RuntimeRepairTriggerReason:   "runtime auth missing from registry",
		RuntimeFailureClass:          "runtime_auth_missing",
		LastRuntimeRepairAtUnixMs:    1760000000000,
		CodexAPIKey: &cliproxyapi.CodexAPIKeyAccountCredential{
			APIKey:  "sk-test-123456",
			BaseURL: "https://api.openai.com/v1",
		},
	})

	if got := record.Status; got != "configured" {
		t.Fatalf("Status = %q, want configured", got)
	}
	if got := record.RuntimeStatus; got != "applied_not_registered" {
		t.Fatalf("RuntimeStatus = %q, want applied_not_registered", got)
	}
	if got := record.RuntimeReason; got != "runtime auth missing from registry" {
		t.Fatalf("RuntimeReason = %q, want runtime auth missing from registry", got)
	}
	if record.Routeable {
		t.Fatal("Routeable = true, want false")
	}
	if got := record.RegisteredModelCount; got != 0 {
		t.Fatalf("RegisteredModelCount = %d, want 0", got)
	}
	if got := record.RuntimeRepairOutcome; got != "failed" {
		t.Fatalf("RuntimeRepairOutcome = %q, want failed", got)
	}
	if got := record.RuntimeRepairAction; got != "watcher_refresh" {
		t.Fatalf("RuntimeRepairAction = %q, want watcher_refresh", got)
	}
	if got := record.RuntimeRepairTriggerStatus; got != "applied_not_registered" {
		t.Fatalf("RuntimeRepairTriggerStatus = %q, want applied_not_registered", got)
	}
	if got := record.RuntimeRepairTriggerClass; got != "runtime_auth_missing" {
		t.Fatalf("RuntimeRepairTriggerClass = %q, want runtime_auth_missing", got)
	}
	if got := record.RuntimeRepairTriggerReason; got != "runtime auth missing from registry" {
		t.Fatalf("RuntimeRepairTriggerReason = %q, want runtime auth missing from registry", got)
	}
	if got := record.RuntimeFailureClass; got != "runtime_auth_missing" {
		t.Fatalf("RuntimeFailureClass = %q, want runtime_auth_missing", got)
	}
	if got := record.LastRuntimeRepairAtUnixMs; got != 1760000000000 {
		t.Fatalf("LastRuntimeRepairAtUnixMs = %d, want 1760000000000", got)
	}
}

func TestBuildUnifiedAccountRecordFallsBackToRuntimeApplyFailure(t *testing.T) {
	record := BuildUnifiedAccountRecord(cliproxyapi.UnifiedAccount{
		AccountKey:         "acct_00000000-0000-4000-8000-000000000011",
		Kind:               cliproxyapi.AccountKindCodexAPIKey,
		Title:              "Broken Codex",
		Provider:           "codex",
		RuntimeApplyStatus: "failed",
		RuntimeApplyError:  "auth_unavailable",
		CodexAPIKey: &cliproxyapi.CodexAPIKeyAccountCredential{
			APIKey:  "sk-test-123456",
			BaseURL: "https://api.openai.com/v1",
		},
	})

	if got := record.RuntimeStatus; got != "degraded" {
		t.Fatalf("RuntimeStatus = %q, want degraded", got)
	}
	if got := record.RuntimeReason; got != "auth_unavailable" {
		t.Fatalf("RuntimeReason = %q, want auth_unavailable", got)
	}
	if got := record.StatusMessage; got != "auth_unavailable" {
		t.Fatalf("StatusMessage = %q, want auth_unavailable", got)
	}
	if record.Routeable {
		t.Fatal("Routeable = true, want false")
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

func TestBuildCodexAPIKeyAccountRecordDerivesSupportedFormatsFromFormatBaseURLs(t *testing.T) {
	record := BuildCodexAPIKeyAccountRecord(cliproxyapi.CodexAPIKey{
		APIKey:  "sk-test-123456",
		BaseURL: "https://relay.example.com/default",
		FormatBaseURLs: map[string]string{
			APIFmtOpenAIResponses: "https://relay.example.com/responses",
			APIFmtOpenAIChat:      "https://relay.example.com/chat",
			APIFmtAnthropic:       "",
		},
	})

	if got, want := strings.Join(record.SupportedFormats, ","), "openai_chat,openai_responses"; got != want {
		t.Fatalf("SupportedFormats = %q, want %q", got, want)
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

func TestBuildOpenAICompatibleProviderAccountRecordDerivesSupportedFormatsFromFormatBaseURLs(t *testing.T) {
	record := BuildOpenAICompatibleProviderAccountRecord(cliproxyapi.OpenAICompatibleProvider{
		Name:    "sub2api",
		BaseURL: "https://relay.example.com/default",
		FormatBaseURLs: map[string]string{
			APIFmtAnthropic:       "https://relay.example.com/antigravity",
			APIFmtOpenAIResponses: "https://relay.example.com/v1",
			APIFmtOpenAIChat:      "https://relay.example.com/v1",
		},
	})

	if got, want := strings.Join(record.SupportedFormats, ","), "openai_chat,openai_responses,anthropic"; got != want {
		t.Fatalf("SupportedFormats = %q, want %q", got, want)
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
			QuotaCurl:         `curl -sS "https://api.deepseek.com/user/balance" -H "Authorization: Bearer {{apiKey}}"`,
			QuotaEnabled:      true,
			BillingCurl:       `curl -sS "https://api.deepseek.com/user/balance" -H "Authorization: Bearer {{apiKey}}"`,
			BillingEnabled:    true,
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
	if got := record.QuotaKey; got != "acct_00000000-0000-4000-8000-000000000001" {
		t.Fatalf("QuotaKey = %q, want account key", got)
	}
	if !record.QuotaEnabled || !strings.Contains(record.QuotaCurl, "/user/balance") {
		t.Fatalf("quota config not projected: enabled=%v curl=%q", record.QuotaEnabled, record.QuotaCurl)
	}
	if !record.BillingEnabled || !strings.Contains(record.BillingCurl, "/user/balance") {
		t.Fatalf("billing config not projected: enabled=%v curl=%q", record.BillingEnabled, record.BillingCurl)
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
