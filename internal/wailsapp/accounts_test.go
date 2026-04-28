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
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method == "GET" && path == "/v0/management/openai-compatibility" {
					return []byte(`{"openai-compatibility":[{"name":"deepseek","priority":1,"base-url":"https://api.deepseek.com/v1","api-key-entries":[{"api-key":"sk-old"}]}]}`), 200, nil
				}
				if method == "PUT" && path == "/v0/management/openai-compatibility" {
					payload, err := io.ReadAll(body)
					if err != nil {
						t.Fatalf("read body: %v", err)
					}
					if !strings.Contains(string(payload), `"priority":5`) {
						t.Fatalf("unexpected payload: %s", payload)
					}
					return nil, 200, nil
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
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method == "GET" && path == "/v0/management/openai-compatibility" {
					return []byte(`{"openai-compatibility":[{"name":"deepseek","base-url":"https://api.deepseek.com/v1","api-key-entries":[{"api-key":"sk-old"}]}]}`), 200, nil
				}
				if method == "PUT" && path == "/v0/management/openai-compatibility" {
					payload, err := io.ReadAll(body)
					if err != nil {
						t.Fatalf("read body: %v", err)
					}
					var items []cliproxyapi.OpenAICompatibleProvider
					if err := json.Unmarshal(payload, &items); err != nil {
						t.Fatalf("unmarshal payload: %v", err)
					}
					if len(items) != 1 || !items[0].Disabled {
						t.Fatalf("expected provider to be disabled, got %#v", items)
					}
					return nil, 200, nil
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
