package wailsapp

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
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
