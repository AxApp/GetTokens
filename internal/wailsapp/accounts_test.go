package wailsapp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/linhay/gettokens/internal/cliproxyapi"
)

func TestSetCodexAPIKeyStatusIgnoresPruneErrorAndSchedulesRefresh(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	cachePath, err := relayModelAccountCachePath()
	if err != nil {
		t.Fatalf("relayModelAccountCachePath: %v", err)
	}
	if err := os.MkdirAll(filepath.Dir(cachePath), 0700); err != nil {
		t.Fatalf("mkdir cache dir: %v", err)
	}
	if err := os.WriteFile(cachePath, []byte("{ invalid json"), 0600); err != nil {
		t.Fatalf("write corrupt cache: %v", err)
	}

	account := cliproxyapi.UnifiedAccount{
		AccountKey: "acct_codex_key",
		Kind:       cliproxyapi.AccountKindCodexAPIKey,
		Title:      "Codex Key",
		Provider:   "codex",
		CodexAPIKey: &cliproxyapi.CodexAPIKeyAccountCredential{
			APIKey:  "sk-test-1111",
			BaseURL: "https://api.openai.com/v1",
		},
	}
	refreshCalled := make(chan struct{}, 1)
	patchCalled := false
	app := &App{
		ctx:                              context.Background(),
		codexModelCatalogRefreshDebounce: time.Millisecond,
		codexModelCatalogRefreshFunc: func() error {
			refreshCalled <- struct{}{}
			return nil
		},
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method == "PATCH" && path == "/v0/management/accounts/acct_codex_key/status" {
					patchCalled = true
					return testAccountResponse(t, account), 200, nil
				}
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 0, nil
			})
		},
	}

	if err := app.SetCodexAPIKeyStatus("acct_codex_key", true); err != nil {
		t.Fatalf("SetCodexAPIKeyStatus returned prune error after successful patch: %v", err)
	}
	if !patchCalled {
		t.Fatalf("expected PatchAccountStatus to be called")
	}
	select {
	case <-refreshCalled:
	case <-time.After(2 * time.Second):
		t.Fatalf("expected catalog refresh to be scheduled despite prune failure")
	}
}

func TestUpdateAccountPrioritySupportsUnifiedOpenAICompatibleProvider(t *testing.T) {
	account := testOpenAICompatibleAccount("acct_deepseek", "deepseek", 1, false, "https://api.deepseek.com/v1", "", []cliproxyapi.OpenAICompatibleAPIKeyEntry{{APIKey: "sk-old"}}, nil, nil)
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method == "GET" && path == "/v0/management/accounts" {
					return testAccountsResponse(t, account), 200, nil
				}
				if method == "PATCH" && path == "/v0/management/accounts/acct_deepseek/priority" {
					payload, err := io.ReadAll(body)
					if err != nil {
						t.Fatalf("read body: %v", err)
					}
					if !strings.Contains(string(payload), `"priority":5`) {
						t.Fatalf("unexpected payload: %s", payload)
					}
					return testAccountResponse(t, account), 200, nil
				}
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 0, nil
			})
		},
	}

	if err := app.UpdateAccountPriority(UpdateAccountPriorityInput{
		ID:       "acct_deepseek",
		Priority: 5,
	}); err != nil {
		t.Fatalf("UpdateAccountPriority: %v", err)
	}
}

func TestSetAccountDisabledSupportsUnifiedCodexAPIKey(t *testing.T) {
	account := cliproxyapi.UnifiedAccount{
		AccountKey: "acct_codex_key",
		Kind:       cliproxyapi.AccountKindCodexAPIKey,
		Title:      "Codex Key",
		Provider:   "codex",
		CodexAPIKey: &cliproxyapi.CodexAPIKeyAccountCredential{
			APIKey:  "sk-test-1111",
			BaseURL: "https://api.openai.com/v1",
		},
	}
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method == "PATCH" && path == "/v0/management/accounts/acct_codex_key/status" {
					payload, err := io.ReadAll(body)
					if err != nil {
						t.Fatalf("read body: %v", err)
					}
					if !strings.Contains(string(payload), `"disabled":true`) {
						t.Fatalf("unexpected payload: %s", payload)
					}
					return testAccountResponse(t, account), 200, nil
				}
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 0, nil
			})
		},
	}

	if err := app.SetAccountDisabled("acct_codex_key", true); err != nil {
		t.Fatalf("SetAccountDisabled: %v", err)
	}
}

func TestSetAccountDisabledRejectsLegacyPrefixedRuntimeIDs(t *testing.T) {
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				t.Fatalf("unexpected request for legacy runtime id: %s %s", method, path)
				return nil, 0, nil
			})
		},
	}

	for _, id := range []string{"auth-file:codex.json", "codex-api-key:stable-001", "openai-compatible:deepseek"} {
		if err := app.SetAccountDisabled(id, true); err == nil {
			t.Fatalf("SetAccountDisabled(%q) succeeded, want unsupported account type", id)
		}
	}
}

func TestUpdateAccountPriorityRejectsLegacyPrefixedRuntimeIDs(t *testing.T) {
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				t.Fatalf("unexpected request for legacy runtime id: %s %s", method, path)
				return nil, 0, nil
			})
		},
	}

	for _, id := range []string{"auth-file:codex.json", "codex-api-key:stable-001", "openai-compatible:deepseek"} {
		if err := app.UpdateAccountPriority(UpdateAccountPriorityInput{ID: id, Priority: 5}); err == nil {
			t.Fatalf("UpdateAccountPriority(%q) succeeded, want unsupported account type", id)
		}
	}
}

func TestSetAccountDisabledSupportsOpenAICompatibleProvider(t *testing.T) {
	account := testOpenAICompatibleAccount("acct_deepseek", "deepseek", 0, false, "https://api.deepseek.com/v1", "", []cliproxyapi.OpenAICompatibleAPIKeyEntry{{APIKey: "sk-old"}}, nil, nil)
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method == "PATCH" && path == "/v0/management/accounts/acct_deepseek/status" {
					payload, err := io.ReadAll(body)
					if err != nil {
						t.Fatalf("read body: %v", err)
					}
					var update struct {
						Disabled bool `json:"disabled"`
					}
					if err := json.Unmarshal(payload, &update); err != nil {
						t.Fatalf("unmarshal payload: %v", err)
					}
					if !update.Disabled {
						t.Fatalf("expected provider to be disabled, got %#v", update)
					}
					return testAccountResponse(t, account), 200, nil
				}
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 0, nil
			})
		},
	}

	if err := app.SetAccountDisabled("acct_deepseek", true); err != nil {
		t.Fatalf("SetAccountDisabled: %v", err)
	}
}

func TestListAccountsDoesNotFallbackToLegacyWhenAccountStoreErrors(t *testing.T) {
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method == "GET" && path == "/v0/management/accounts" {
					return nil, 500, errors.New("account store unavailable")
				}
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 0, nil
			})
		},
	}

	accounts, err := app.ListAccounts()
	if err == nil {
		t.Fatalf("ListAccounts succeeded with legacy fallback accounts: %#v", accounts)
	}
	if !strings.Contains(err.Error(), "account store unavailable") {
		t.Fatalf("ListAccounts error = %v, want account store error", err)
	}
}

func TestCreateCodexAPIKeyDoesNotFallbackToLegacyWhenAccountStoreCreateFails(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method != "POST" || path != "/v0/management/accounts" {
					t.Fatalf("unexpected request: %s %s", method, path)
				}
				return nil, 500, errors.New("account store write failed")
			})
		},
	}

	err := app.CreateCodexAPIKey(CreateCodexAPIKeyInput{
		APIKey:  "sk-test-no-legacy-fallback",
		Label:   "Should fail",
		BaseURL: "https://api.openai.com/v1",
	})
	if err == nil {
		t.Fatal("CreateCodexAPIKey succeeded, want account-store error")
	}
	if !strings.Contains(err.Error(), "account store write failed") {
		t.Fatalf("CreateCodexAPIKey error = %v, want account-store error", err)
	}
}

func TestUnifiedCodexAPIKeyMutationsDoNotFallbackToLegacyOnAccountStoreErrors(t *testing.T) {
	newFailingApp := func() *App {
		return &App{
			managementAPI: func() *cliproxyapi.Client {
				return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
					if path == "/v0/management/codex-api-key" {
						t.Fatalf("unexpected legacy codex-api-key sync: %s %s", method, path)
					}
					return nil, 500, errors.New("account store mutation failed")
				})
			},
		}
	}

	cases := []struct {
		name string
		run  func(*App) error
	}{
		{
			name: "label",
			run: func(app *App) error {
				return app.UpdateCodexAPIKeyLabel(UpdateCodexAPIKeyLabelInput{ID: "acct_codex_key", Label: "Changed"})
			},
		},
		{
			name: "config",
			run: func(app *App) error {
				return app.UpdateCodexAPIKeyConfig(UpdateCodexAPIKeyConfigInput{ID: "acct_codex_key", APIKey: "sk-new", BaseURL: "https://api.example.com/v1"})
			},
		},
		{
			name: "delete",
			run: func(app *App) error {
				return app.DeleteCodexAPIKey("acct_codex_key")
			},
		},
		{
			name: "priority",
			run: func(app *App) error {
				return app.UpdateCodexAPIKeyPriority("acct_codex_key", 1)
			},
		},
		{
			name: "status",
			run: func(app *App) error {
				return app.SetCodexAPIKeyStatus("acct_codex_key", true)
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.run(newFailingApp())
			if err == nil {
				t.Fatalf("%s succeeded, want account-store error", tc.name)
			}
			if !strings.Contains(err.Error(), "account store mutation failed") {
				t.Fatalf("%s error = %v, want account-store error", tc.name, err)
			}
		})
	}
}

func TestLegacyCodexAPIKeyIDsRejectedOutsideMigration(t *testing.T) {
	app := &App{}
	legacyID := "codex-api-key:stable-001"

	checks := []struct {
		name string
		err  error
	}{
		{"label", app.UpdateCodexAPIKeyLabel(UpdateCodexAPIKeyLabelInput{ID: legacyID, Label: "Changed"})},
		{"config", app.UpdateCodexAPIKeyConfig(UpdateCodexAPIKeyConfigInput{ID: legacyID, APIKey: "sk-new", BaseURL: "https://api.example.com/v1"})},
		{"delete", app.DeleteCodexAPIKey(legacyID)},
		{"priority", app.UpdateCodexAPIKeyPriority(legacyID, 1)},
		{"status", app.SetCodexAPIKeyStatus(legacyID, true)},
	}

	for _, check := range checks {
		if check.err == nil {
			t.Fatalf("%s accepted legacy id outside migration", check.name)
		}
		if !strings.Contains(check.err.Error(), "不支持的账号类型") {
			t.Fatalf("%s error = %v, want unsupported account type", check.name, check.err)
		}
	}
}

func TestCreateCodexAPIKeyAllowsDuplicateConfigAsSeparateAccounts(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	var creates []cliproxyapi.AccountWriteRequest
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method != "POST" || path != "/v0/management/accounts" {
					t.Fatalf("unexpected request: %s %s", method, path)
				}
				payload, err := io.ReadAll(body)
				if err != nil {
					t.Fatalf("read body: %v", err)
				}
				var item cliproxyapi.AccountWriteRequest
				if err := json.Unmarshal(payload, &item); err != nil {
					t.Fatalf("unmarshal payload: %v", err)
				}
				creates = append(creates, item)
				return []byte(`{"account_key":"acct_00000000-0000-4000-8000-000000000001","kind":"codex-api-key","title":"created","provider":"codex","codex_api_key":{"api_key":"sk-test-duplicate","base_url":"https://api.openai.com/v1","prefix":"team-a","websockets":true}}`), 200, nil
			})
		},
	}

	input := CreateCodexAPIKeyInput{
		APIKey:  "sk-test-duplicate",
		Label:   "Primary",
		BaseURL: "https://api.openai.com/v1",
		Prefix:  "team-a",
	}
	if err := app.CreateCodexAPIKey(input); err != nil {
		t.Fatalf("first CreateCodexAPIKey: %v", err)
	}
	input.Label = "Copied"
	if err := app.CreateCodexAPIKey(input); err != nil {
		t.Fatalf("second CreateCodexAPIKey with same config: %v", err)
	}

	if len(creates) != 2 {
		t.Fatalf("expected 2 sidecar account creates, got %#v", creates)
	}
	if creates[0].Title != "Primary" || creates[1].Title != "Copied" {
		t.Fatalf("unexpected create titles: %#v", creates)
	}
	for _, item := range creates {
		if item.Kind != cliproxyapi.AccountKindCodexAPIKey || item.CodexAPIKey == nil {
			t.Fatalf("unexpected account write: %#v", item)
		}
		if item.CodexAPIKey.APIKey != "sk-test-duplicate" || item.CodexAPIKey.BaseURL != "https://api.openai.com/v1" || item.CodexAPIKey.Prefix != "team-a" {
			t.Fatalf("unexpected duplicate item config: %#v", item)
		}
	}
}
