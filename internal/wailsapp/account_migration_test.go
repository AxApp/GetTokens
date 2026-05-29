package wailsapp

import (
	"io"
	"net/url"
	"testing"

	"github.com/linhay/gettokens/internal/cliproxyapi"
)

func TestGetAccountMigrationPreviewStatuses(t *testing.T) {
	tests := []struct {
		name          string
		accountsBody  string
		dryRunBody    string
		wantStatus    string
		wantAccounts  int
		wantCandidate int
	}{
		{
			name:          "empty store with legacy candidates needs migration",
			accountsBody:  `{"accounts":[]}`,
			dryRunBody:    `{"generated_at_unix_ms":1780000000000,"candidates":[{"account_key":"acct_1","kind":"auth-file"},{"account_key":"acct_2","kind":"codex-api-key"}]}`,
			wantStatus:    "needs-migration",
			wantCandidate: 2,
		},
		{
			name:          "existing accounts with legacy candidates are ready to delete legacy",
			accountsBody:  `{"accounts":[{"account_key":"acct_1","kind":"auth-file","title":"codex","provider":"codex"}]}`,
			dryRunBody:    `{"generated_at_unix_ms":1780000000000,"candidates":[{"account_key":"acct_1","kind":"auth-file"}]}`,
			wantStatus:    "ready-to-delete-legacy",
			wantAccounts:  1,
			wantCandidate: 1,
		},
		{
			name:         "existing accounts with no legacy candidates are ready",
			accountsBody: `{"accounts":[{"account_key":"acct_1","kind":"auth-file","title":"codex","provider":"codex"}]}`,
			dryRunBody:   `{"generated_at_unix_ms":1780000000000,"candidates":[]}`,
			wantStatus:   "ready",
			wantAccounts: 1,
		},
		{
			name:         "empty store and empty legacy sources stay empty",
			accountsBody: `{"accounts":[]}`,
			dryRunBody:   `{"generated_at_unix_ms":1780000000000,"candidates":[]}`,
			wantStatus:   "empty",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := &App{
				managementAPI: func() *cliproxyapi.Client {
					return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
						switch path {
						case "/v0/management/accounts":
							return []byte(tt.accountsBody), 200, nil
						case "/v0/management/account-migration/dry-run":
							return []byte(tt.dryRunBody), 200, nil
						default:
							t.Fatalf("unexpected request: %s %s", method, path)
						}
						return nil, 404, nil
					})
				},
			}
			preview, err := app.GetAccountMigrationPreview()
			if err != nil {
				t.Fatalf("GetAccountMigrationPreview: %v", err)
			}
			if preview.Status != tt.wantStatus || preview.AccountCount != tt.wantAccounts || preview.CandidateCount != tt.wantCandidate {
				t.Fatalf("preview = %#v", preview)
			}
		})
	}
}

func TestGetAccountMigrationPreviewSummarizesKinds(t *testing.T) {
	preview := buildAccountMigrationPreview(0, &cliproxyapi.AccountMigrationReport{
		Candidates: []cliproxyapi.AccountMigrationCandidate{
			{Kind: cliproxyapi.AccountKindAuthFile},
			{Kind: cliproxyapi.AccountKindCodexAPIKey},
			{Kind: cliproxyapi.AccountKindAuthFile},
		},
	}, nil)

	if len(preview.KindSummary) != 2 {
		t.Fatalf("kind summary length = %d", len(preview.KindSummary))
	}
	if preview.KindSummary[0].Kind != "auth-file" || preview.KindSummary[0].Count != 2 {
		t.Fatalf("unexpected first summary: %#v", preview.KindSummary[0])
	}
	if preview.KindSummary[1].Kind != "codex-api-key" || preview.KindSummary[1].Count != 1 {
		t.Fatalf("unexpected second summary: %#v", preview.KindSummary[1])
	}
}

func TestDeleteLegacyAccountSourcesRequiresMigratedAccounts(t *testing.T) {
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if path != "/v0/management/accounts" {
					t.Fatalf("unexpected request: %s %s", method, path)
				}
				return []byte(`{"accounts":[]}`), 200, nil
			})
		},
	}

	if _, err := app.DeleteLegacyAccountSources(); err == nil {
		t.Fatal("expected DeleteLegacyAccountSources to reject empty migrated accounts")
	}
}
