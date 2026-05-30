package wailsapp

import (
	"errors"
	"io"
	"net/url"
	"strings"
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

func TestGetAccountMigrationPreviewKeepsExistingAccountsWhenDryRunFails(t *testing.T) {
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				switch path {
				case "/v0/management/accounts":
					return []byte(`{"accounts":[{"account_key":"acct_1","kind":"auth-file","title":"codex","provider":"codex"}]}`), 200, nil
				case "/v0/management/account-migration/dry-run":
					return nil, 0, errors.New("migration endpoint unavailable")
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
	if preview.Status != "ready" || preview.AccountCount != 1 || preview.CandidateCount != 0 {
		t.Fatalf("preview = %#v", preview)
	}
	if len(preview.Warnings) != 1 || !strings.Contains(preview.Warnings[0], "migration endpoint unavailable") {
		t.Fatalf("warnings = %#v", preview.Warnings)
	}
}

func TestGetAccountMigrationPreviewFailsWhenEmptyStoreCannotDryRun(t *testing.T) {
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				switch path {
				case "/v0/management/accounts":
					return []byte(`{"accounts":[]}`), 200, nil
				case "/v0/management/account-migration/dry-run":
					return nil, 0, errors.New("migration endpoint unavailable")
				default:
					t.Fatalf("unexpected request: %s %s", method, path)
				}
				return nil, 404, nil
			})
		},
	}

	preview, err := app.GetAccountMigrationPreview()
	if err == nil || !strings.Contains(err.Error(), "migration endpoint unavailable") {
		t.Fatalf("err = %v preview = %#v", err, preview)
	}
}

func TestCommitAccountMigrationReturnsErrorsAndRefreshedPreview(t *testing.T) {
	paths := []string{}
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				paths = append(paths, path)
				switch path {
				case "/v0/management/account-migration/commit":
					return []byte(`{"imported":3,"skipped":1,"errors":["auth file unreadable"]}`), 200, nil
				case "/v0/management/accounts":
					return []byte(`{"accounts":[{"account_key":"acct_1","kind":"auth-file","title":"codex","provider":"codex"}]}`), 200, nil
				case "/v0/management/account-migration/dry-run":
					return []byte(`{"generated_at_unix_ms":1780000000000,"candidates":[{"account_key":"acct_2","kind":"codex-api-key"}]}`), 200, nil
				default:
					t.Fatalf("unexpected request: %s %s", method, path)
				}
				return nil, 404, nil
			})
		},
	}

	result, err := app.CommitAccountMigration()
	if err != nil {
		t.Fatalf("CommitAccountMigration: %v", err)
	}
	if result.Imported != 3 || result.Skipped != 1 || len(result.Errors) != 1 {
		t.Fatalf("result = %#v", result)
	}
	if result.Preview == nil || result.Preview.Status != "ready-to-delete-legacy" || result.Preview.CandidateCount != 1 {
		t.Fatalf("preview = %#v", result.Preview)
	}
	want := []string{
		"/v0/management/account-migration/commit",
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

func TestGetAccountMigrationPreviewFallsBackToDryRunWhenListAccountsFails(t *testing.T) {
	tests := []struct {
		name          string
		dryRunBody    string
		wantStatus    string
		wantCandidate int
	}{
		{
			name:          "list accounts failure still blocks when legacy candidates exist",
			dryRunBody:    `{"generated_at_unix_ms":1780000000000,"candidates":[{"account_key":"acct_1","kind":"auth-file"}]}`,
			wantStatus:    "needs-migration",
			wantCandidate: 1,
		},
		{
			name:       "list accounts failure does not block when no legacy candidates remain",
			dryRunBody: `{"generated_at_unix_ms":1780000000000,"candidates":[]}`,
			wantStatus: "empty",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := &App{
				managementAPI: func() *cliproxyapi.Client {
					return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
						switch path {
						case "/v0/management/accounts":
							return nil, 500, errors.New("query codex-api-key credential for acct_demo: database is locked (5) (SQLITE_BUSY)")
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
			if preview.Status != tt.wantStatus || preview.CandidateCount != tt.wantCandidate {
				t.Fatalf("preview = %#v", preview)
			}
			if len(preview.Warnings) == 0 {
				t.Fatalf("expected warnings for list account failure: %#v", preview)
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

func TestDeleteLegacyAccountSourcesRejectsCommitErrorsBeforeDeleting(t *testing.T) {
	paths := []string{}
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				paths = append(paths, path)
				if path != "/v0/management/account-migration/commit" {
					t.Fatalf("unexpected request after failed commit: %s %s", method, path)
				}
				return []byte(`{"imported":0,"skipped":0,"errors":["cannot read legacy source"]}`), 200, nil
			})
		},
	}

	_, err := app.DeleteLegacyAccountSources()
	if err == nil || !strings.Contains(err.Error(), "cannot read legacy source") {
		t.Fatalf("err = %v", err)
	}
	if len(paths) != 1 || paths[0] != "/v0/management/account-migration/commit" {
		t.Fatalf("paths = %#v", paths)
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
