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
			case method == http.MethodGet && path == ManagementAPIPrefix+"/auth-files":
				return []byte(`{"files":[{"name":"cached.json","provider":"codex","auth_index":"1"}]}`), http.StatusOK, nil
			case method == http.MethodGet && path == ManagementAPIPrefix+"/auth-files/download":
				return authBody, http.StatusOK, nil
			case method == http.MethodPost && path == ManagementAPIPrefix+"/api-call":
				return nil, http.StatusForbidden, errors.New("api call denied")
			default:
				t.Fatalf("unexpected sidecar request: %s %s", method, path)
				return nil, 0, nil
			}
		},
	}

	quota, err := app.GetCodexQuota("cached.json")
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
