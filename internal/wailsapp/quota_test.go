package wailsapp

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestNormalizeAuthIndex(t *testing.T) {
	tests := []struct {
		name  string
		value interface{}
		want  string
	}{
		{name: "string", value: " auth-1 ", want: "auth-1"},
		{name: "json number", value: json.Number("12"), want: "12"},
		{name: "float", value: float64(7), want: "7"},
		{name: "int", value: 9, want: "9"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := normalizeAuthIndex(tt.value); got != tt.want {
				t.Fatalf("normalizeAuthIndex(%#v) = %q, want %q", tt.value, got, tt.want)
			}
		})
	}
}

func TestManagementAPICallResponseStatusCode(t *testing.T) {
	if got := (managementAPICallResponse{StatusCodeSnake: 201, StatusCodeCamel: 200}).statusCode(); got != 201 {
		t.Fatalf("unexpected snake status code: %d", got)
	}
	if got := (managementAPICallResponse{StatusCodeCamel: 204}).statusCode(); got != 204 {
		t.Fatalf("unexpected camel status code: %d", got)
	}
}

func TestTestCodexAPIKeyQuotaCurlUsesDraftInput(t *testing.T) {
	var gotAuthorization string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuthorization = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"plan_type":"pro",
			"rate_limit":{
				"primary_window":{"used_percent":11,"limit_window_seconds":18000,"reset_at":1777980010},
				"secondary_window":{"used_percent":4,"limit_window_seconds":604800,"reset_at":1778546810}
			}
		}`))
	}))
	defer server.Close()

	result, err := (&App{}).TestCodexAPIKeyQuotaCurl(TestCodexAPIKeyQuotaCurlInput{
		APIKey:    "sk-live",
		BaseURL:   server.URL,
		QuotaCurl: `curl -sS "{{baseUrl}}/api/codex/usage" -H "Authorization: Bearer {{apiKey}}"`,
	})
	if err != nil {
		t.Fatalf("TestCodexAPIKeyQuotaCurl: %v", err)
	}
	if gotAuthorization != "Bearer sk-live" {
		t.Fatalf("Authorization = %q, want Bearer sk-live", gotAuthorization)
	}
	if result.PlanType != "pro" {
		t.Fatalf("PlanType = %q, want pro", result.PlanType)
	}
	if len(result.Windows) != 2 {
		t.Fatalf("windows = %#v", result.Windows)
	}
	if got := *result.Windows[0].RemainingPercent; got != 89 {
		t.Fatalf("primary remaining = %d, want 89", got)
	}
}

func TestGetCodexQuotaLoadsUnifiedCodexAPIKeyCredential(t *testing.T) {
	var gotAuthorization string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuthorization = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"plan_type":"plus",
			"rate_limit":{
				"primary_window":{"used_percent":17,"limit_window_seconds":18000,"reset_at":1777980010}
			}
		}`))
	}))
	defer server.Close()

	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			if method == http.MethodGet && path == ManagementAPIPrefix+"/accounts/acct_company" {
				payload, _ := json.Marshal(map[string]any{
					"account_key": "acct_company",
					"kind":        "codex-api-key",
					"title":       "公司 1",
					"provider":    "codex",
					"codex_api_key": map[string]any{
						"api_key":       "sk-company",
						"base_url":      server.URL,
						"quota_curl":    `curl -sS "{{baseUrl}}/api/codex/usage" -H "Authorization: Bearer {{apiKey}}"`,
						"quota_enabled": true,
					},
				})
				return payload, http.StatusOK, nil
			}
			t.Fatalf("unexpected sidecar request: %s %s", method, path)
			return nil, 0, nil
		},
	}

	quota, err := app.GetCodexQuota("acct_company")
	if err != nil {
		t.Fatalf("GetCodexQuota: %v", err)
	}
	if gotAuthorization != "Bearer sk-company" {
		t.Fatalf("Authorization = %q, want Bearer sk-company", gotAuthorization)
	}
	if quota.PlanType != "plus" {
		t.Fatalf("PlanType = %q, want plus", quota.PlanType)
	}
	if len(quota.Windows) != 1 || quota.Windows[0].RemainingPercent == nil || *quota.Windows[0].RemainingPercent != 83 {
		t.Fatalf("unexpected quota windows: %#v", quota.Windows)
	}
}

func TestGetCodexQuotaFallsBackToAuthFileUsageCacheWhenAPICallFails(t *testing.T) {
	authBody := []byte(`{
		"account_id":"acct_cached",
		"tokens":{"access_token":"token_cached"},
		"plan":"plus",
		"nolon":{
			"usage_cache":{
				"usage":{
					"identity":{"plan":"plus"},
					"primary":{"usedPercent":26,"resetsAt":1710000000}
				}
			}
		}
	}`)

	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			switch {
			case method == http.MethodGet && path == ManagementAPIPrefix+"/accounts/acct_cached":
				payload, _ := json.Marshal(map[string]any{
					"account_key": "acct_cached",
					"kind":        "auth-file",
					"title":       "cached.json",
					"provider":    "codex",
					"auth_file": map[string]any{
						"source_file_name": "cached.json",
						"auth_json":        string(authBody),
						"auth_type":        "codex",
					},
				})
				return payload, http.StatusOK, nil
			case method == http.MethodGet && path == ManagementAPIPrefix+"/accounts":
				payload, _ := json.Marshal(map[string]any{"accounts": []map[string]any{{
					"account_key": "acct_cached",
					"kind":        "auth-file",
					"title":       "cached.json",
					"provider":    "codex",
					"auth_file": map[string]any{
						"source_file_name": "cached.json",
						"auth_json":        string(authBody),
						"auth_type":        "codex",
					},
				}}})
				return payload, http.StatusOK, nil
			case method == http.MethodPost && path == ManagementAPIPrefix+"/api-call":
				return nil, http.StatusForbidden, errors.New("api call denied")
			default:
				t.Fatalf("unexpected sidecar request: %s %s", method, path)
				return nil, 0, nil
			}
		},
	}

	quota, err := app.GetCodexQuota("acct_cached")
	if err != nil {
		t.Fatalf("GetCodexQuota: %v", err)
	}
	if quota.PlanType != "plus" {
		t.Fatalf("PlanType = %q, want plus", quota.PlanType)
	}
	if len(quota.Windows) != 1 {
		t.Fatalf("expected one cached quota window, got %d", len(quota.Windows))
	}
	if quota.Windows[0].RemainingPercent == nil || *quota.Windows[0].RemainingPercent != 74 {
		t.Fatalf("unexpected cached remaining percent: %#v", quota.Windows[0].RemainingPercent)
	}
}

func TestGetCodexQuotaUsesAccountKeyAndRuntimeMetadataAccountID(t *testing.T) {
	authBody := []byte(`{
		"id":"codex-plus.json",
		"provider":"codex",
		"metadata":{
			"account_id":"chatgpt_account_from_metadata",
			"plan_type":"plus",
			"email":"plus@example.com"
		}
	}`)

	var gotAPICall managementAPICallRequest
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			switch {
			case method == http.MethodGet && path == ManagementAPIPrefix+"/accounts":
				payload, _ := json.Marshal(map[string]any{"accounts": []map[string]any{{
					"account_key": "acct_plus",
					"kind":        "auth-file",
					"title":       "codex-plus.json",
					"provider":    "codex",
					"auth_file": map[string]any{
						"source_file_name": "codex-plus.json",
						"auth_json":        string(authBody),
						"auth_type":        "codex",
						"plan_type":        "plus",
					},
				}}})
				return payload, http.StatusOK, nil
			case method == http.MethodPost && path == ManagementAPIPrefix+"/api-call":
				if err := json.NewDecoder(body).Decode(&gotAPICall); err != nil {
					t.Fatalf("decode api-call body: %v", err)
				}
				response, _ := json.Marshal(managementAPICallResponse{
					StatusCodeSnake: http.StatusOK,
					Body: `{
						"plan_type":"plus",
						"rate_limit":{
							"primary_window":{"used_percent":20,"limit_window_seconds":18000,"reset_at":1777980010}
						}
					}`,
				})
				return response, http.StatusOK, nil
			default:
				t.Fatalf("unexpected sidecar request: %s %s", method, path)
				return nil, 0, nil
			}
		},
	}

	quota, err := app.GetCodexQuota("codex-plus.json")
	if err != nil {
		t.Fatalf("GetCodexQuota: %v", err)
	}
	if gotAPICall.AuthIndex != "acct_plus" {
		t.Fatalf("api-call auth index = %q, want acct_plus", gotAPICall.AuthIndex)
	}
	if gotAPICall.Header["chatgpt-account-id"] != "chatgpt_account_from_metadata" {
		t.Fatalf("chatgpt-account-id = %q, want metadata account id", gotAPICall.Header["chatgpt-account-id"])
	}
	if gotAPICall.Header["Authorization"] != "Bearer $TOKEN$" {
		t.Fatalf("Authorization = %q, want token placeholder", gotAPICall.Header["Authorization"])
	}
	if quota.PlanType != "plus" {
		t.Fatalf("PlanType = %q, want plus", quota.PlanType)
	}
	if len(quota.Windows) != 1 || quota.Windows[0].RemainingPercent == nil || *quota.Windows[0].RemainingPercent != 80 {
		t.Fatalf("unexpected quota windows: %#v", quota.Windows)
	}
}
