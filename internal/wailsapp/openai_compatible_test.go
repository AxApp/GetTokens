package wailsapp

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/linhay/gettokens/internal/cliproxyapi"
)

func TestVerifyOpenAICompatibleProviderRequiresModel(t *testing.T) {
	app := &App{}

	_, err := app.VerifyOpenAICompatibleProvider(VerifyOpenAICompatibleProviderInput{
		BaseURL: "https://api.deepseek.com/v1",
		APIKey:  "sk-test",
	})
	if err == nil {
		t.Fatal("expected error when model is missing")
	}
	if !strings.Contains(err.Error(), "model") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestVerifyOpenAICompatibleProviderBuildsChatCompletionsRequest(t *testing.T) {
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			if method != http.MethodPost {
				t.Fatalf("expected POST, got %s", method)
			}
			if path != ManagementAPIPrefix+"/api-call" {
				t.Fatalf("unexpected path: %s", path)
			}
			if contentType != "application/json" {
				t.Fatalf("unexpected content type: %s", contentType)
			}

			payload, err := io.ReadAll(body)
			if err != nil {
				t.Fatalf("read body: %v", err)
			}

			var request managementAPICallRequest
			if err := json.Unmarshal(payload, &request); err != nil {
				t.Fatalf("unmarshal request: %v", err)
			}
			if request.Method != http.MethodPost {
				t.Fatalf("unexpected request method: %s", request.Method)
			}
			if request.URL != "https://api.deepseek.com/v1/chat/completions" {
				t.Fatalf("unexpected request url: %s", request.URL)
			}
			if request.Header["Authorization"] != "Bearer sk-test" {
				t.Fatalf("unexpected authorization header: %#v", request.Header)
			}
			if request.Header["X-Test"] != "abc" {
				t.Fatalf("unexpected custom header: %#v", request.Header)
			}

			var data map[string]any
			if err := json.Unmarshal([]byte(request.Data), &data); err != nil {
				t.Fatalf("unmarshal data: %v", err)
			}
			if data["model"] != "deepseek-chat" {
				t.Fatalf("unexpected model: %#v", data["model"])
			}

			return []byte(`{"status_code":200,"body":"{\"id\":\"chatcmpl-1\"}"}`), 200, nil
		},
	}

	result, err := app.VerifyOpenAICompatibleProvider(VerifyOpenAICompatibleProviderInput{
		BaseURL: "https://api.deepseek.com/v1",
		APIKey:  "sk-test",
		Model:   "deepseek-chat",
		Headers: map[string]string{
			"X-Test": "abc",
		},
	})
	if err != nil {
		t.Fatalf("VerifyOpenAICompatibleProvider returned error: %v", err)
	}
	if !result.Success {
		t.Fatalf("expected verify success, got %#v", result)
	}
	if result.StatusCode != 200 {
		t.Fatalf("unexpected status code: %d", result.StatusCode)
	}
	if result.Message == "" {
		t.Fatalf("expected success message, got %#v", result)
	}
}

func TestFetchOpenAICompatibleProviderModelsBuildsModelsRequestAndParsesResponse(t *testing.T) {
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			if method != http.MethodPost {
				t.Fatalf("expected POST, got %s", method)
			}
			if path != ManagementAPIPrefix+"/api-call" {
				t.Fatalf("unexpected path: %s", path)
			}
			if contentType != "application/json" {
				t.Fatalf("unexpected content type: %s", contentType)
			}

			payload, err := io.ReadAll(body)
			if err != nil {
				t.Fatalf("read body: %v", err)
			}

			var request managementAPICallRequest
			if err := json.Unmarshal(payload, &request); err != nil {
				t.Fatalf("unmarshal request: %v", err)
			}
			if request.Method != http.MethodGet {
				t.Fatalf("unexpected request method: %s", request.Method)
			}
			if request.URL != "https://api.deepseek.com/v1/models" {
				t.Fatalf("unexpected request url: %s", request.URL)
			}
			if request.Header["Authorization"] != "Bearer sk-test" {
				t.Fatalf("unexpected authorization header: %#v", request.Header)
			}
			if request.Header["X-Test"] != "abc" {
				t.Fatalf("unexpected custom header: %#v", request.Header)
			}
			if request.Data != "" {
				t.Fatalf("expected empty request data, got %q", request.Data)
			}

			return []byte(`{"status_code":200,"body":"{\"data\":[{\"id\":\"deepseek-chat\"},{\"id\":\"deepseek-reasoner\"},{\"id\":\"deepseek-chat\"}]}"} `), 200, nil
		},
	}

	result, err := app.FetchOpenAICompatibleProviderModels(FetchOpenAICompatibleProviderModelsInput{
		BaseURL: "https://api.deepseek.com/v1",
		APIKey:  "sk-test",
		Headers: map[string]string{
			"X-Test": "abc",
		},
	})
	if err != nil {
		t.Fatalf("FetchOpenAICompatibleProviderModels returned error: %v", err)
	}
	if result.StatusCode != 200 {
		t.Fatalf("unexpected status code: %d", result.StatusCode)
	}
	if len(result.Models) != 2 {
		t.Fatalf("unexpected model count: %d", len(result.Models))
	}
	if result.Models[0].Name != "deepseek-chat" || result.Models[1].Name != "deepseek-reasoner" {
		t.Fatalf("unexpected models: %#v", result.Models)
	}
}

func TestUpdateOpenAICompatibleProviderReplacesFirstKeyEntryAndAllowsRename(t *testing.T) {
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method == http.MethodGet && path == "/v0/management/openai-compatibility" {
					return []byte(`{"openai-compatibility":[{"name":"deepseek","base-url":"https://api.deepseek.com/v1","prefix":"team-a","api-key-entries":[{"api-key":"sk-old","proxy-url":"http://proxy.local"},{"api-key":"sk-backup"}],"headers":{"X-Test":"1"}}]}`), 200, nil
				}
				if method == http.MethodPut && path == "/v0/management/openai-compatibility" {
					payload, err := io.ReadAll(body)
					if err != nil {
						t.Fatalf("read body: %v", err)
					}
					var items []cliproxyapi.OpenAICompatibleProvider
					if err := json.Unmarshal(payload, &items); err != nil {
						t.Fatalf("unmarshal payload: %v", err)
					}
					if len(items) != 1 {
						t.Fatalf("unexpected provider count: %d", len(items))
					}
					got := items[0]
					if got.Name != "deepseek-prod" {
						t.Fatalf("unexpected provider name: %s", got.Name)
					}
					if got.BaseURL != "https://relay.example.com/v1" {
						t.Fatalf("unexpected base url: %s", got.BaseURL)
					}
					if got.Prefix != "prod" {
						t.Fatalf("unexpected prefix: %s", got.Prefix)
					}
					if len(got.APIKeyEntries) != 3 {
						t.Fatalf("unexpected key entry count: %d", len(got.APIKeyEntries))
					}
					if got.APIKeyEntries[0].APIKey != "sk-new" {
						t.Fatalf("unexpected first api key: %s", got.APIKeyEntries[0].APIKey)
					}
					if got.APIKeyEntries[0].ProxyURL != "http://proxy.local" {
						t.Fatalf("unexpected proxy url: %s", got.APIKeyEntries[0].ProxyURL)
					}
					if got.APIKeyEntries[1].APIKey != "sk-backup" {
						t.Fatalf("unexpected backup api key: %s", got.APIKeyEntries[1].APIKey)
					}
					if got.APIKeyEntries[2].APIKey != "sk-third" {
						t.Fatalf("unexpected third api key: %s", got.APIKeyEntries[2].APIKey)
					}
					if got.Headers["X-Test"] != "2" || got.Headers["X-Env"] != "prod" {
						t.Fatalf("unexpected headers: %#v", got.Headers)
					}
					if len(got.Models) != 2 {
						t.Fatalf("unexpected model count: %d", len(got.Models))
					}
					if got.Models[0].Name != "deepseek-chat" || got.Models[0].Alias != "chat" {
						t.Fatalf("unexpected first model: %#v", got.Models[0])
					}
					if got.Models[1].Name != "deepseek-reasoner" || got.Models[1].Alias != "" {
						t.Fatalf("unexpected second model: %#v", got.Models[1])
					}
					return nil, 200, nil
				}
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 0, nil
			})
		},
	}

	err := app.UpdateOpenAICompatibleProvider(UpdateOpenAICompatibleProviderInput{
		CurrentName: "deepseek",
		Name:        "deepseek-prod",
		BaseURL:     "https://relay.example.com/v1",
		Prefix:      "prod",
		APIKey:      "sk-new",
		APIKeys:     []string{"sk-new", "sk-backup", "sk-third"},
		Headers: map[string]string{
			"X-Test": "2",
			"X-Env":  "prod",
		},
		Models: []OpenAICompatibleModel{
			{Name: "deepseek-chat", Alias: "chat"},
			{Name: "deepseek-reasoner"},
		},
	})
	if err != nil {
		t.Fatalf("UpdateOpenAICompatibleProvider returned error: %v", err)
	}
}

func TestUpdateOpenAICompatibleProviderRejectsDuplicateName(t *testing.T) {
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method == http.MethodGet && path == "/v0/management/openai-compatibility" {
					return []byte(`{"openai-compatibility":[{"name":"deepseek","base-url":"https://api.deepseek.com/v1"},{"name":"moonshot","base-url":"https://api.moonshot.cn/v1"}]}`), 200, nil
				}
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 0, nil
			})
		},
	}

	err := app.UpdateOpenAICompatibleProvider(UpdateOpenAICompatibleProviderInput{
		CurrentName: "deepseek",
		Name:        "moonshot",
		BaseURL:     "https://relay.example.com/v1",
		APIKey:      "sk-new",
	})
	if err == nil {
		t.Fatal("expected duplicate name error")
	}
	if !strings.Contains(err.Error(), "已存在") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestUpdateOpenAICompatibleProviderPriorityPersistsToManagementConfig(t *testing.T) {
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method == http.MethodGet && path == "/v0/management/openai-compatibility" {
					return []byte(`{"openai-compatibility":[{"name":"deepseek","priority":2,"base-url":"https://api.deepseek.com/v1","api-key-entries":[{"api-key":"sk-old"}]}]}`), 200, nil
				}
				if method == http.MethodPut && path == "/v0/management/openai-compatibility" {
					payload, err := io.ReadAll(body)
					if err != nil {
						t.Fatalf("read body: %v", err)
					}
					var items []cliproxyapi.OpenAICompatibleProvider
					if err := json.Unmarshal(payload, &items); err != nil {
						t.Fatalf("unmarshal payload: %v", err)
					}
					if len(items) != 1 {
						t.Fatalf("unexpected provider count: %d", len(items))
					}
					if items[0].Name != "deepseek" {
						t.Fatalf("unexpected provider name: %s", items[0].Name)
					}
					if items[0].Priority != 7 {
						t.Fatalf("unexpected priority: %d", items[0].Priority)
					}
					return nil, 200, nil
				}
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 0, nil
			})
		},
	}

	if err := app.UpdateOpenAICompatibleProviderPriority("deepseek", 7); err != nil {
		t.Fatalf("UpdateOpenAICompatibleProviderPriority returned error: %v", err)
	}
}

func TestListOpenAICompatibleProvidersKeepsDisabledState(t *testing.T) {
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method == http.MethodGet && path == "/v0/management/openai-compatibility" {
					return []byte(`{"openai-compatibility":[{"name":"deepseek","disabled":true,"base-url":"https://api.deepseek.com/v1","api-key-entries":[{"api-key":"sk-old"}]}]}`), 200, nil
				}
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 0, nil
			})
		},
	}

	items, err := app.ListOpenAICompatibleProviders()
	if err != nil {
		t.Fatalf("ListOpenAICompatibleProviders returned error: %v", err)
	}
	if len(items) != 1 || !items[0].Disabled {
		t.Fatalf("expected provider to keep disabled state, got %#v", items)
	}
}
