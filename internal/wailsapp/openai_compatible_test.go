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

			return []byte(`{"status_code":200,"body":"{\"data\":[{\"id\":\"deepseek-chat\",\"supported_reasoning_levels\":[\"minimal\",\"high\"],\"default_reasoning_level\":\"high\"},{\"id\":\"deepseek-reasoner\"},{\"id\":\"deepseek-chat\"}]}"} `), 200, nil
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
	if result.Models[0].DefaultReasoningEffort != "high" {
		t.Fatalf("unexpected default reasoning effort: %#v", result.Models[0])
	}
	if len(result.Models[0].SupportedReasoningEfforts) != 2 || result.Models[0].SupportedReasoningEfforts[0] != "minimal" || result.Models[0].SupportedReasoningEfforts[1] != "high" {
		t.Fatalf("unexpected supported reasoning efforts: %#v", result.Models[0])
	}
}

func TestParseOpenAICompatibleModelsResponseSupportsCodexModelCatalogShape(t *testing.T) {
	models, err := parseOpenAICompatibleModelsResponse(`{
		"models": [
			{
				"slug": "gpt-5.5",
				"supported_reasoning_levels": ["low", "high", "xhigh"],
				"default_reasoning_level": "high"
			},
			{
				"slug": "gpt-5.4-mini"
			}
		]
	}`)
	if err != nil {
		t.Fatalf("parseOpenAICompatibleModelsResponse returned error: %v", err)
	}
	if len(models) != 2 {
		t.Fatalf("unexpected models: %#v", models)
	}
	if models[0].Name != "gpt-5.5" || models[0].DefaultReasoningEffort != "high" {
		t.Fatalf("unexpected first model: %#v", models[0])
	}
	if len(models[0].SupportedReasoningEfforts) != 3 || models[0].SupportedReasoningEfforts[2] != "xhigh" {
		t.Fatalf("unexpected reasoning efforts: %#v", models[0])
	}
	if models[1].Name != "gpt-5.4-mini" {
		t.Fatalf("unexpected second model: %#v", models[1])
	}
}

func testOpenAICompatibleAccount(key string, name string, priority int, disabled bool, baseURL string, prefix string, entries []cliproxyapi.OpenAICompatibleAPIKeyEntry, headers map[string]string, models []cliproxyapi.OpenAICompatibleModel) cliproxyapi.UnifiedAccount {
	return cliproxyapi.UnifiedAccount{
		AccountKey: key,
		Kind:       cliproxyapi.AccountKindOpenAICompatible,
		Title:      name,
		Provider:   name,
		Priority:   priority,
		Disabled:   disabled,
		OpenAICompatible: &cliproxyapi.OpenAICompatibleAccountCredential{
			ProviderName:      name,
			BaseURL:           baseURL,
			Prefix:            prefix,
			APIKeyEntriesJSON: mustJSONString(entries),
			HeadersJSON:       mustJSONString(headers),
			ModelsJSON:        mustJSONString(models),
		},
	}
}

func testAccountResponse(t *testing.T, account cliproxyapi.UnifiedAccount) []byte {
	t.Helper()
	body, err := json.Marshal(account)
	if err != nil {
		t.Fatalf("marshal account: %v", err)
	}
	return body
}

func testAccountsResponse(t *testing.T, accounts ...cliproxyapi.UnifiedAccount) []byte {
	t.Helper()
	body, err := json.Marshal(cliproxyapi.UnifiedAccountsResponse{Items: accounts})
	if err != nil {
		t.Fatalf("marshal accounts: %v", err)
	}
	return body
}

func TestUpdateOpenAICompatibleProviderReplacesFirstKeyEntryAndAllowsRename(t *testing.T) {
	account := testOpenAICompatibleAccount(
		"acct_deepseek",
		"deepseek",
		0,
		false,
		"https://api.deepseek.com/v1",
		"team-a",
		[]cliproxyapi.OpenAICompatibleAPIKeyEntry{{APIKey: "sk-old", ProxyURL: "http://proxy.local"}, {APIKey: "sk-backup"}},
		map[string]string{"X-Test": "1"},
		nil,
	)
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method == http.MethodGet && path == "/v0/management/accounts/acct_deepseek" {
					return testAccountResponse(t, account), 200, nil
				}
				if method == http.MethodGet && path == "/v0/management/accounts" {
					return testAccountsResponse(t, account), 200, nil
				}
				if method == http.MethodPatch && path == "/v0/management/accounts/acct_deepseek" {
					payload, err := io.ReadAll(body)
					if err != nil {
						t.Fatalf("read body: %v", err)
					}
					var write cliproxyapi.AccountWriteRequest
					if err := json.Unmarshal(payload, &write); err != nil {
						t.Fatalf("unmarshal payload: %v", err)
					}
					if write.Kind != cliproxyapi.AccountKindOpenAICompatible || write.OpenAICompatible == nil {
						t.Fatalf("unexpected account payload: %#v", write)
					}
					if write.Provider != "deepseek-prod" || write.OpenAICompatible.ProviderName != "deepseek-prod" {
						t.Fatalf("unexpected provider name: %#v", write)
					}
					if write.OpenAICompatible.BaseURL != "https://relay.example.com/v1" {
						t.Fatalf("unexpected base url: %s", write.OpenAICompatible.BaseURL)
					}
					if write.OpenAICompatible.Prefix != "prod" {
						t.Fatalf("unexpected prefix: %s", write.OpenAICompatible.Prefix)
					}
					var entries []cliproxyapi.OpenAICompatibleAPIKeyEntry
					if err := json.Unmarshal([]byte(write.OpenAICompatible.APIKeyEntriesJSON), &entries); err != nil {
						t.Fatalf("unmarshal entries: %v", err)
					}
					if len(entries) != 3 {
						t.Fatalf("unexpected key entry count: %d", len(entries))
					}
					if entries[0].APIKey != "sk-new" {
						t.Fatalf("unexpected first api key: %s", entries[0].APIKey)
					}
					if entries[0].ProxyURL != "http://proxy.local" {
						t.Fatalf("unexpected proxy url: %s", entries[0].ProxyURL)
					}
					if entries[1].APIKey != "sk-backup" {
						t.Fatalf("unexpected backup api key: %s", entries[1].APIKey)
					}
					if entries[2].APIKey != "sk-third" {
						t.Fatalf("unexpected third api key: %s", entries[2].APIKey)
					}
					var headers map[string]string
					if err := json.Unmarshal([]byte(write.OpenAICompatible.HeadersJSON), &headers); err != nil {
						t.Fatalf("unmarshal headers: %v", err)
					}
					if headers["X-Test"] != "2" || headers["X-Env"] != "prod" {
						t.Fatalf("unexpected headers: %#v", headers)
					}
					var models []cliproxyapi.OpenAICompatibleModel
					if err := json.Unmarshal([]byte(write.OpenAICompatible.ModelsJSON), &models); err != nil {
						t.Fatalf("unmarshal models: %v", err)
					}
					if len(models) != 2 {
						t.Fatalf("unexpected model count: %d", len(models))
					}
					if models[0].Name != "deepseek-chat" || models[0].Alias != "chat" {
						t.Fatalf("unexpected first model: %#v", models[0])
					}
					if models[1].Name != "deepseek-reasoner" || models[1].Alias != "" {
						t.Fatalf("unexpected second model: %#v", models[1])
					}
					return testAccountResponse(t, account), 200, nil
				}
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 0, nil
			})
		},
	}

	err := app.UpdateOpenAICompatibleProvider(UpdateOpenAICompatibleProviderInput{
		CurrentName: "acct_deepseek",
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

func TestUpdateOpenAICompatibleProviderUpdatesPrimaryProxyURL(t *testing.T) {
	nextProxyURL := "socks5://127.0.0.1:7890"
	account := testOpenAICompatibleAccount(
		"acct_deepseek",
		"deepseek",
		0,
		false,
		"https://api.deepseek.com/v1",
		"",
		[]cliproxyapi.OpenAICompatibleAPIKeyEntry{{APIKey: "sk-old", ProxyURL: "http://proxy.local"}, {APIKey: "sk-backup", ProxyURL: "http://backup.local"}},
		nil,
		nil,
	)
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method == http.MethodGet && path == "/v0/management/accounts/acct_deepseek" {
					return testAccountResponse(t, account), 200, nil
				}
				if method == http.MethodGet && path == "/v0/management/accounts" {
					return testAccountsResponse(t, account), 200, nil
				}
				if method == http.MethodPatch && path == "/v0/management/accounts/acct_deepseek" {
					payload, err := io.ReadAll(body)
					if err != nil {
						t.Fatalf("read body: %v", err)
					}
					var write cliproxyapi.AccountWriteRequest
					if err := json.Unmarshal(payload, &write); err != nil {
						t.Fatalf("unmarshal payload: %v", err)
					}
					var entries []cliproxyapi.OpenAICompatibleAPIKeyEntry
					if err := json.Unmarshal([]byte(write.OpenAICompatible.APIKeyEntriesJSON), &entries); err != nil {
						t.Fatalf("unmarshal entries: %v", err)
					}
					if entries[0].ProxyURL != nextProxyURL {
						t.Fatalf("primary proxy url = %q, want %q", entries[0].ProxyURL, nextProxyURL)
					}
					if entries[1].ProxyURL != "http://backup.local" {
						t.Fatalf("backup proxy url = %q, want preserved backup proxy", entries[1].ProxyURL)
					}
					return testAccountResponse(t, account), 200, nil
				}
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 404, nil
			})
		},
	}

	err := app.UpdateOpenAICompatibleProvider(UpdateOpenAICompatibleProviderInput{
		CurrentName: "acct_deepseek",
		Name:        "deepseek",
		BaseURL:     "https://api.deepseek.com/v1",
		APIKeys:     []string{"sk-new", "sk-backup"},
		ProxyURL:    &nextProxyURL,
	})
	if err != nil {
		t.Fatalf("UpdateOpenAICompatibleProvider returned error: %v", err)
	}
}

func TestUpdateOpenAICompatibleProviderKeepsMultipleAliasesForOneRealModel(t *testing.T) {
	account := testOpenAICompatibleAccount(
		"acct_mi",
		"MI",
		0,
		false,
		"https://token-plan-cn.xiaomimimo.com/v1",
		"",
		[]cliproxyapi.OpenAICompatibleAPIKeyEntry{{APIKey: "sk-mi"}},
		nil,
		[]cliproxyapi.OpenAICompatibleModel{{Name: "mimo-v2.5", Alias: "gpt-5.5"}},
	)
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method == http.MethodGet && path == "/v0/management/accounts/acct_mi" {
					return testAccountResponse(t, account), 200, nil
				}
				if method == http.MethodGet && path == "/v0/management/accounts" {
					return testAccountsResponse(t, account), 200, nil
				}
				if method == http.MethodPatch && path == "/v0/management/accounts/acct_mi" {
					payload, err := io.ReadAll(body)
					if err != nil {
						t.Fatalf("read body: %v", err)
					}
					var write cliproxyapi.AccountWriteRequest
					if err := json.Unmarshal(payload, &write); err != nil {
						t.Fatalf("unmarshal payload: %v", err)
					}
					var models []cliproxyapi.OpenAICompatibleModel
					if err := json.Unmarshal([]byte(write.OpenAICompatible.ModelsJSON), &models); err != nil {
						t.Fatalf("unmarshal models: %v", err)
					}
					if len(models) != 2 {
						t.Fatalf("unexpected model count: %d; payload=%s", len(models), string(payload))
					}
					if models[0].Name != "mimo-v2.5" || models[0].Alias != "gpt-5.5" {
						t.Fatalf("unexpected first model: %#v", models[0])
					}
					if models[1].Name != "mimo-v2.5" || models[1].Alias != "gpt-5.4" {
						t.Fatalf("unexpected second model: %#v", models[1])
					}
					return testAccountResponse(t, account), 200, nil
				}
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 0, nil
			})
		},
	}

	err := app.UpdateOpenAICompatibleProvider(UpdateOpenAICompatibleProviderInput{
		CurrentName: "acct_mi",
		Name:        "MI",
		BaseURL:     "https://token-plan-cn.xiaomimimo.com/v1",
		APIKey:      "sk-mi",
		APIKeys:     []string{"sk-mi"},
		Models: []OpenAICompatibleModel{
			{Name: "mimo-v2.5", Alias: "gpt-5.5"},
			{Name: "mimo-v2.5", Alias: "gpt-5.4"},
			{Name: "mimo-v2.5", Alias: "gpt-5.4"},
		},
	})
	if err != nil {
		t.Fatalf("UpdateOpenAICompatibleProvider returned error: %v", err)
	}
}

func TestUpdateOpenAICompatibleProviderRejectsDuplicateName(t *testing.T) {
	deepseek := testOpenAICompatibleAccount("acct_deepseek", "deepseek", 0, false, "https://api.deepseek.com/v1", "", nil, nil, nil)
	moonshot := testOpenAICompatibleAccount("acct_moonshot", "moonshot", 0, false, "https://api.moonshot.cn/v1", "", nil, nil, nil)
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method == http.MethodGet && path == "/v0/management/accounts/acct_deepseek" {
					return testAccountResponse(t, deepseek), 200, nil
				}
				if method == http.MethodGet && path == "/v0/management/accounts" {
					return testAccountsResponse(t, deepseek, moonshot), 200, nil
				}
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 0, nil
			})
		},
	}

	err := app.UpdateOpenAICompatibleProvider(UpdateOpenAICompatibleProviderInput{
		CurrentName: "acct_deepseek",
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
	account := testOpenAICompatibleAccount("acct_deepseek", "deepseek", 2, false, "https://api.deepseek.com/v1", "", []cliproxyapi.OpenAICompatibleAPIKeyEntry{{APIKey: "sk-old"}}, nil, nil)
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method == http.MethodGet && path == "/v0/management/accounts/acct_deepseek" {
					return testAccountResponse(t, account), 200, nil
				}
				if method == http.MethodPatch && path == "/v0/management/accounts/acct_deepseek/priority" {
					payload, err := io.ReadAll(body)
					if err != nil {
						t.Fatalf("read body: %v", err)
					}
					var update struct {
						Priority int `json:"priority"`
					}
					if err := json.Unmarshal(payload, &update); err != nil {
						t.Fatalf("unmarshal payload: %v", err)
					}
					if update.Priority != 7 {
						t.Fatalf("unexpected priority: %d", update.Priority)
					}
					return testAccountResponse(t, account), 200, nil
				}
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 0, nil
			})
		},
	}

	if err := app.UpdateOpenAICompatibleProviderPriority("acct_deepseek", 7); err != nil {
		t.Fatalf("UpdateOpenAICompatibleProviderPriority returned error: %v", err)
	}
}

func TestListOpenAICompatibleProvidersKeepsDisabledState(t *testing.T) {
	account := testOpenAICompatibleAccount("acct_deepseek", "deepseek", 0, true, "https://api.deepseek.com/v1", "", []cliproxyapi.OpenAICompatibleAPIKeyEntry{{APIKey: "sk-old"}}, nil, nil)
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method == http.MethodGet && path == "/v0/management/accounts" {
					return testAccountsResponse(t, account), 200, nil
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
	if items[0].AccountKey != "acct_deepseek" {
		t.Fatalf("expected provider account key, got %#v", items[0])
	}
}

func TestCreateOpenAICompatibleProviderCreatesUnifiedAccount(t *testing.T) {
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method == http.MethodGet && path == "/v0/management/accounts" {
					return testAccountsResponse(t), 200, nil
				}
				if method == http.MethodPost && path == "/v0/management/accounts" {
					payload, err := io.ReadAll(body)
					if err != nil {
						t.Fatalf("read body: %v", err)
					}
					var write cliproxyapi.AccountWriteRequest
					if err := json.Unmarshal(payload, &write); err != nil {
						t.Fatalf("unmarshal payload: %v", err)
					}
					if write.Kind != cliproxyapi.AccountKindOpenAICompatible || write.OpenAICompatible == nil {
						t.Fatalf("unexpected account payload: %#v", write)
					}
					if write.Title != "deepseek" || write.Provider != "deepseek" || write.OpenAICompatible.ProviderName != "deepseek" {
						t.Fatalf("unexpected provider identity: %#v", write)
					}
					if write.OpenAICompatible.BaseURL != "https://api.deepseek.com/v1" || write.OpenAICompatible.Prefix != "team-a" {
						t.Fatalf("unexpected provider config: %#v", write.OpenAICompatible)
					}
					var entries []cliproxyapi.OpenAICompatibleAPIKeyEntry
					if err := json.Unmarshal([]byte(write.OpenAICompatible.APIKeyEntriesJSON), &entries); err != nil {
						t.Fatalf("unmarshal entries: %v", err)
					}
					if len(entries) != 1 || entries[0].APIKey != "sk-new" {
						t.Fatalf("unexpected key entries: %#v", entries)
					}
					return testAccountResponse(t, testOpenAICompatibleAccount("acct_deepseek", "deepseek", 0, false, "https://api.deepseek.com/v1", "team-a", entries, nil, nil)), 200, nil
				}
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 0, nil
			})
		},
	}

	if err := app.CreateOpenAICompatibleProvider(CreateOpenAICompatibleProviderInput{
		Name:    "deepseek",
		BaseURL: "https://api.deepseek.com/v1",
		Prefix:  "team-a",
		APIKey:  "sk-new",
	}); err != nil {
		t.Fatalf("CreateOpenAICompatibleProvider returned error: %v", err)
	}
}
