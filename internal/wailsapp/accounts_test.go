package wailsapp

import (
	"encoding/json"
	"io"
	"net/url"
	"strings"
	"testing"

	"github.com/linhay/gettokens/internal/cliproxyapi"
)

func TestUpdateCodexAPIKeyLabelPersistsToStore(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	item := cliproxyapi.CodexAPIKeyInput{
		APIKey:  "sk-test-1111",
		BaseURL: "https://api.openai.com/v1",
	}
	if err := persistCodexAPIKeySet([]cliproxyapi.CodexAPIKeyInput{item}); err != nil {
		t.Fatalf("persistCodexAPIKeySet: %v", err)
	}
	items, err := loadStoredCodexAPIKeys()
	if err != nil {
		t.Fatalf("loadStoredCodexAPIKeys: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}

	app := &App{}
	if err := app.UpdateCodexAPIKeyLabel(UpdateCodexAPIKeyLabelInput{
		ID:    codexAPIKeyAssetIDFromInput(items[0]),
		Label: "PRIMARY PROD KEY",
	}); err != nil {
		t.Fatalf("UpdateCodexAPIKeyLabel: %v", err)
	}

	items, err = loadStoredCodexAPIKeys()
	if err != nil {
		t.Fatalf("loadStoredCodexAPIKeys: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}
	if items[0].Label != "PRIMARY PROD KEY" {
		t.Fatalf("Label = %q, want PRIMARY PROD KEY", items[0].Label)
	}
}

func TestUpdateAccountPrioritySupportsOpenAICompatibleProvider(t *testing.T) {
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
		ID:       "openai-compatible:deepseek",
		Priority: 5,
	}); err != nil {
		t.Fatalf("UpdateAccountPriority: %v", err)
	}
}

func TestSetAccountDisabledSupportsCodexAPIKey(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	item := cliproxyapi.CodexAPIKeyInput{
		APIKey:  "sk-test-1111",
		BaseURL: "https://api.openai.com/v1",
	}
	if err := persistCodexAPIKeySet([]cliproxyapi.CodexAPIKeyInput{item}); err != nil {
		t.Fatalf("persistCodexAPIKeySet: %v", err)
	}
	items, err := loadStoredCodexAPIKeys()
	if err != nil {
		t.Fatalf("loadStoredCodexAPIKeys: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}

	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method != "PUT" || path != "/v0/management/codex-api-key" {
					t.Fatalf("unexpected request: %s %s", method, path)
				}
				payload, err := io.ReadAll(body)
				if err != nil {
					t.Fatalf("read body: %v", err)
				}
				if !strings.Contains(string(payload), `"disabled":true`) {
					t.Fatalf("unexpected payload: %s", payload)
				}
				return nil, 200, nil
			})
		},
	}

	if err := app.SetAccountDisabled(codexAPIKeyAssetIDFromInput(items[0]), true); err != nil {
		t.Fatalf("SetAccountDisabled: %v", err)
	}

	items, err = loadStoredCodexAPIKeys()
	if err != nil {
		t.Fatalf("loadStoredCodexAPIKeys: %v", err)
	}
	if len(items) != 1 || !items[0].Disabled {
		t.Fatalf("expected stored codex key to be disabled, got %#v", items)
	}
}

func TestSetAccountDisabledSupportsOpenAICompatibleProvider(t *testing.T) {
	account := testOpenAICompatibleAccount("acct_deepseek", "deepseek", 0, false, "https://api.deepseek.com/v1", "", []cliproxyapi.OpenAICompatibleAPIKeyEntry{{APIKey: "sk-old"}}, nil, nil)
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method == "GET" && path == "/v0/management/accounts" {
					return testAccountsResponse(t, account), 200, nil
				}
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

	if err := app.SetAccountDisabled("openai-compatible:deepseek", true); err != nil {
		t.Fatalf("SetAccountDisabled: %v", err)
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

func TestUpdateCodexAPIKeyConfigPreservesStableID(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	item := cliproxyapi.CodexAPIKeyInput{
		LocalID: "codex-api-key:stable-001",
		APIKey:  "sk-test-1111",
		BaseURL: "https://api.openai.com/v1",
		Prefix:  "team-a",
	}
	if err := persistCodexAPIKeySet([]cliproxyapi.CodexAPIKeyInput{item}); err != nil {
		t.Fatalf("persistCodexAPIKeySet: %v", err)
	}

	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method != "PUT" || path != "/v0/management/codex-api-key" {
					t.Fatalf("unexpected request: %s %s", method, path)
				}
				payload, err := io.ReadAll(body)
				if err != nil {
					t.Fatalf("read body: %v", err)
				}
				if !strings.Contains(string(payload), `"api-key":"sk-test-2222"`) {
					t.Fatalf("unexpected payload: %s", payload)
				}
				return nil, 200, nil
			})
		},
	}

	if err := app.UpdateCodexAPIKeyConfig(UpdateCodexAPIKeyConfigInput{
		ID:      "codex-api-key:stable-001",
		APIKey:  "sk-test-2222",
		BaseURL: "https://api.example.com/v2",
		Prefix:  "team-b",
	}); err != nil {
		t.Fatalf("UpdateCodexAPIKeyConfig: %v", err)
	}

	items, err := loadStoredCodexAPIKeys()
	if err != nil {
		t.Fatalf("loadStoredCodexAPIKeys: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}
	if got := items[0].LocalID; got != "codex-api-key:stable-001" {
		t.Fatalf("LocalID = %q, want codex-api-key:stable-001", got)
	}
	if got := items[0].APIKey; got != "sk-test-2222" {
		t.Fatalf("APIKey = %q, want sk-test-2222", got)
	}
	if got := items[0].BaseURL; got != "https://api.example.com/v2" {
		t.Fatalf("BaseURL = %q, want https://api.example.com/v2", got)
	}
	if got := items[0].Prefix; got != "team-b" {
		t.Fatalf("Prefix = %q, want team-b", got)
	}
}

func TestUpdateCodexAPIKeyConfigPersistsQuotaCurl(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	item := cliproxyapi.CodexAPIKeyInput{
		LocalID: "codex-api-key:stable-001",
		APIKey:  "sk-test-1111",
		BaseURL: "https://api.openai.com/v1",
	}
	if err := persistCodexAPIKeySet([]cliproxyapi.CodexAPIKeyInput{item}); err != nil {
		t.Fatalf("persistCodexAPIKeySet: %v", err)
	}

	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method != "PUT" || path != "/v0/management/codex-api-key" {
					t.Fatalf("unexpected request: %s %s", method, path)
				}
				payload, err := io.ReadAll(body)
				if err != nil {
					t.Fatalf("read body: %v", err)
				}
				if strings.Contains(string(payload), "quota-curl") || strings.Contains(string(payload), "quota-enabled") {
					t.Fatalf("quota curl must stay local and not sync to sidecar: %s", payload)
				}
				return nil, 200, nil
			})
		},
	}

	const quotaCurl = `curl -sS "https://quota.example.com/api/codex/usage" -H "Authorization: Bearer {{apiKey}}"`
	if err := app.UpdateCodexAPIKeyConfig(UpdateCodexAPIKeyConfigInput{
		ID:           "codex-api-key:stable-001",
		APIKey:       "sk-test-1111",
		BaseURL:      "https://api.openai.com/v1",
		QuotaCurl:    quotaCurl,
		QuotaEnabled: true,
	}); err != nil {
		t.Fatalf("UpdateCodexAPIKeyConfig: %v", err)
	}

	items, err := loadStoredCodexAPIKeys()
	if err != nil {
		t.Fatalf("loadStoredCodexAPIKeys: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}
	if got := items[0].QuotaCurl; got != quotaCurl {
		t.Fatalf("QuotaCurl = %q, want %q", got, quotaCurl)
	}
	if !items[0].QuotaEnabled {
		t.Fatalf("QuotaEnabled = false, want true")
	}
}

func TestUpdateCodexAPIKeyConfigPersistsProxyURL(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	item := cliproxyapi.CodexAPIKeyInput{
		LocalID:  "codex-api-key:stable-001",
		APIKey:   "sk-test-1111",
		BaseURL:  "https://api.openai.com/v1",
		ProxyURL: "direct",
	}
	if err := persistCodexAPIKeySet([]cliproxyapi.CodexAPIKeyInput{item}); err != nil {
		t.Fatalf("persistCodexAPIKeySet: %v", err)
	}

	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method != "PUT" || path != "/v0/management/codex-api-key" {
					t.Fatalf("unexpected request: %s %s", method, path)
				}
				payload, err := io.ReadAll(body)
				if err != nil {
					t.Fatalf("read body: %v", err)
				}
				if !strings.Contains(string(payload), `"proxy-url":"socks5://127.0.0.1:7890"`) {
					t.Fatalf("proxy url not synced to sidecar: %s", payload)
				}
				return nil, 200, nil
			})
		},
	}

	if err := app.UpdateCodexAPIKeyConfig(UpdateCodexAPIKeyConfigInput{
		ID:       "codex-api-key:stable-001",
		APIKey:   "sk-test-1111",
		BaseURL:  "https://api.openai.com/v1",
		ProxyURL: "socks5://127.0.0.1:7890",
	}); err != nil {
		t.Fatalf("UpdateCodexAPIKeyConfig: %v", err)
	}

	items, err := loadStoredCodexAPIKeys()
	if err != nil {
		t.Fatalf("loadStoredCodexAPIKeys: %v", err)
	}
	if got := items[0].ProxyURL; got != "socks5://127.0.0.1:7890" {
		t.Fatalf("ProxyURL = %q, want socks5://127.0.0.1:7890", got)
	}
}

func TestUpdateCodexAPIKeyConfigPersistsModels(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	item := cliproxyapi.CodexAPIKeyInput{
		LocalID: "codex-api-key:stable-001",
		APIKey:  "sk-test-1111",
		BaseURL: "https://api.openai.com/v1",
	}
	if err := persistCodexAPIKeySet([]cliproxyapi.CodexAPIKeyInput{item}); err != nil {
		t.Fatalf("persistCodexAPIKeySet: %v", err)
	}

	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method != "PUT" || path != "/v0/management/codex-api-key" {
					t.Fatalf("unexpected request: %s %s", method, path)
				}
				payload, err := io.ReadAll(body)
				if err != nil {
					t.Fatalf("read body: %v", err)
				}
				if !strings.Contains(string(payload), `"models":[{"name":"mimo-v2.5-pro","alias":"claude-sonnet-4-6"}]`) {
					t.Fatalf("models not synced to sidecar: %s", payload)
				}
				return nil, 200, nil
			})
		},
	}

	if err := app.UpdateCodexAPIKeyConfig(UpdateCodexAPIKeyConfigInput{
		ID:      "codex-api-key:stable-001",
		APIKey:  "sk-test-1111",
		BaseURL: "https://api.openai.com/v1",
		Models: []OpenAICompatibleModel{
			{Name: "mimo-v2.5-pro", Alias: "claude-sonnet-4-6"},
		},
	}); err != nil {
		t.Fatalf("UpdateCodexAPIKeyConfig: %v", err)
	}

	items, err := loadStoredCodexAPIKeys()
	if err != nil {
		t.Fatalf("loadStoredCodexAPIKeys: %v", err)
	}
	if len(items) != 1 || len(items[0].Models) != 1 {
		t.Fatalf("expected one persisted model, got %#v", items)
	}
	if got := items[0].Models[0]; got.Name != "mimo-v2.5-pro" || got.Alias != "claude-sonnet-4-6" {
		t.Fatalf("unexpected model: %#v", got)
	}
}

func TestDeleteCodexAPIKeyAcceptsDerivedConfigIDForStableLocalRecord(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	item := cliproxyapi.CodexAPIKeyInput{
		LocalID: "codex-api-key:stable-001",
		APIKey:  "sk-test-1111",
		BaseURL: "https://api.openai.com/v1",
		Prefix:  "team-a",
	}
	if err := persistCodexAPIKeySet([]cliproxyapi.CodexAPIKeyInput{item}); err != nil {
		t.Fatalf("persistCodexAPIKeySet: %v", err)
	}

	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method != "PUT" || path != "/v0/management/codex-api-key" {
					t.Fatalf("unexpected request: %s %s", method, path)
				}
				payload, err := io.ReadAll(body)
				if err != nil {
					t.Fatalf("read body: %v", err)
				}
				if got := strings.TrimSpace(string(payload)); got != "[]" {
					t.Fatalf("expected empty sidecar sync payload, got %s", got)
				}
				return nil, 200, nil
			})
		},
	}

	derivedID := codexAPIKeyConfigIdentityFromInput(item)
	if err := app.DeleteCodexAPIKey(derivedID); err != nil {
		t.Fatalf("DeleteCodexAPIKey: %v", err)
	}

	items, err := loadStoredCodexAPIKeys()
	if err != nil {
		t.Fatalf("loadStoredCodexAPIKeys: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("expected store to be empty, got %#v", items)
	}
}
