package wailsapp

import (
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

	app := &App{}
	if err := app.UpdateCodexAPIKeyLabel(UpdateCodexAPIKeyLabelInput{
		ID:    codexAPIKeyAssetIDFromInput(item),
		Label: "PRIMARY PROD KEY",
	}); err != nil {
		t.Fatalf("UpdateCodexAPIKeyLabel: %v", err)
	}

	items, err := loadStoredCodexAPIKeys()
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
