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
				switch path {
				case "/v0/management/account-migration/commit":
					return []byte(`{"imported":0,"skipped":0}`), 200, nil
				case "/v0/management/accounts":
					return []byte(`{"accounts":[]}`), 200, nil
				default:
					t.Fatalf("unexpected request: %s %s", method, path)
				}
				return nil, 404, nil
			})
		},
	}

	if _, err := app.DeleteLegacyAccountSources(); err == nil {
		t.Fatal("expected DeleteLegacyAccountSources to reject empty migrated accounts")
	}
}

func TestDeleteLegacyAccountSourcesCommitsBeforeDeleting(t *testing.T) {
	paths := []string{}
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				paths = append(paths, path)
				switch path {
				case "/v0/management/account-migration/commit":
					return []byte(`{"imported":11,"skipped":1}`), 200, nil
				case "/v0/management/accounts":
					return []byte(`{"accounts":[{"account_key":"acct_1","kind":"auth-file","title":"codex","provider":"codex"}]}`), 200, nil
				case "/v0/management/account-migration/delete-legacy-sources":
					return []byte(`{"deleted":12,"backup_dir":"/tmp/backup"}`), 200, nil
				case "/v0/management/account-migration/dry-run":
					return []byte(`{"generated_at_unix_ms":1780000000000,"candidates":[]}`), 200, nil
				default:
					t.Fatalf("unexpected request: %s %s", method, path)
				}
				return nil, 404, nil
			})
		},
	}

	result, err := app.DeleteLegacyAccountSources()
	if err != nil {
		t.Fatalf("DeleteLegacyAccountSources: %v", err)
	}
	if result.Deleted != 12 {
		t.Fatalf("deleted = %d", result.Deleted)
	}
	want := []string{
		"/v0/management/account-migration/commit",
		"/v0/management/accounts",
		"/v0/management/account-migration/delete-legacy-sources",
		"/v0/management/accounts",
		"/v0/management/account-migration/dry-run",
	}
	if len(paths) != len(want) {
		t.Fatalf("paths = %#v", paths)
	}
	for i := range want {
		if paths[i] != want[i] {
			t.Fatalf("paths = %#v", paths)
		}
	}
}
