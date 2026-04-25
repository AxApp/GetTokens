package accounts

import (
	"testing"

	"github.com/linhay/gettokens/internal/cliproxyapi"
)

func TestBuildAuthFileAccountRecord(t *testing.T) {
	record := BuildAuthFileAccountRecord(AuthFileRecord{
		Name:     "primary.json",
		Provider: "codex",
		Email:    "user@example.com",
		PlanType: "plus",
	})

	if record.ID != "auth-file:primary.json" {
		t.Fatalf("unexpected auth-file id: %s", record.ID)
	}
	if record.QuotaKey != "primary.json" {
		t.Fatalf("unexpected quota key: %s", record.QuotaKey)
	}
	if record.CredentialSource != CredentialSourceAuthFile {
		t.Fatalf("unexpected source: %s", record.CredentialSource)
	}
}

func TestBuildCodexAPIKeyAccountRecord(t *testing.T) {
	record := BuildCodexAPIKeyAccountRecord(cliproxyapi.CodexAPIKey{
		APIKey:  "sk-test-12345678",
		BaseURL: "HTTPS://API.OPENAI.COM/v1/",
		Prefix:  "/team-a/",
	})

	if record.CredentialSource != CredentialSourceAPIKey {
		t.Fatalf("unexpected source: %s", record.CredentialSource)
	}
	if record.Provider != "codex" {
		t.Fatalf("unexpected provider: %s", record.Provider)
	}
	if record.BaseURL != "https://api.openai.com/v1" {
		t.Fatalf("unexpected base url: %s", record.BaseURL)
	}
	if record.Prefix != "team-a" {
		t.Fatalf("unexpected prefix: %s", record.Prefix)
	}
	if record.KeySuffix != "5678" {
		t.Fatalf("unexpected key suffix: %s", record.KeySuffix)
	}
	if record.KeyFingerprint == "" {
		t.Fatal("expected fingerprint")
	}
	if record.APIKey != "sk-test-12345678" {
		t.Fatalf("unexpected api key: %s", record.APIKey)
	}
}

func TestBuildAccountRecordsDeduplicatesCodexAssets(t *testing.T) {
	records := BuildAccountRecords(nil, []cliproxyapi.CodexAPIKey{
		{APIKey: "sk-test-12345678", BaseURL: "https://api.openai.com/v1", Prefix: "team-a"},
		{APIKey: "sk-test-12345678", BaseURL: "https://api.openai.com/v1/", Prefix: "/team-a/"},
	})

	if len(records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(records))
	}
}
