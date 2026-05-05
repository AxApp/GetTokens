package accounts

import "testing"

func TestBuildCodexQuotaCurlRequestParsesCurlAndReplacesAPIKey(t *testing.T) {
	req, err := BuildCodexQuotaCurlRequest(CodexQuotaCurlInput{
		Curl:   `curl -sS -X GET "https://codex.example.com/api/codex/usage" -H "Authorization: Bearer {{apiKey}}" -H "Accept: application/json"`,
		APIKey: "sk-live",
	})
	if err != nil {
		t.Fatalf("BuildCodexQuotaCurlRequest: %v", err)
	}

	if req.Method != "GET" {
		t.Fatalf("Method = %q, want GET", req.Method)
	}
	if req.URL != "https://codex.example.com/api/codex/usage" {
		t.Fatalf("URL = %q", req.URL)
	}
	if req.Headers["Authorization"] != "Bearer sk-live" {
		t.Fatalf("Authorization = %q", req.Headers["Authorization"])
	}
	if req.Headers["Accept"] != "application/json" {
		t.Fatalf("Accept = %q", req.Headers["Accept"])
	}
}

func TestBuildCodexQuotaCurlRequestParsesBackslashLineContinuations(t *testing.T) {
	req, err := BuildCodexQuotaCurlRequest(CodexQuotaCurlInput{
		Curl:   "curl 'https://codex.example.com/api/codex/usage' \\\n  -H 'Authorization: Bearer {{apiKey}}' \\\n  -H 'Accept: application/json'",
		APIKey: "sk-live",
	})
	if err != nil {
		t.Fatalf("BuildCodexQuotaCurlRequest: %v", err)
	}

	if req.URL != "https://codex.example.com/api/codex/usage" {
		t.Fatalf("URL = %q", req.URL)
	}
	if req.Headers["Authorization"] != "Bearer sk-live" {
		t.Fatalf("Authorization = %q", req.Headers["Authorization"])
	}
	if req.Headers["Accept"] != "application/json" {
		t.Fatalf("Accept = %q", req.Headers["Accept"])
	}
}

func TestBuildCodexQuotaCurlRequestRejectsShellFeatures(t *testing.T) {
	for _, curl := range []string{
		`curl https://codex.example.com/api/codex/usage | jq .`,
		`curl https://codex.example.com/api/codex/usage && echo ok`,
		"curl `echo https://codex.example.com/api/codex/usage`",
		`curl $(echo https://codex.example.com/api/codex/usage)`,
	} {
		_, err := BuildCodexQuotaCurlRequest(CodexQuotaCurlInput{
			Curl:   curl,
			APIKey: "sk-live",
		})
		if err == nil {
			t.Fatalf("expected shell feature error for %q", curl)
		}
	}
}

func TestBuildCodexQuotaResponseFromUsagePayloadMatchesAuthFileShape(t *testing.T) {
	result, err := BuildCodexQuotaResponseFromUsagePayload([]byte(`{
		"plan_type":"pro",
		"rate_limit":{
			"primary_window":{"used_percent":11,"limit_window_seconds":18000,"reset_at":1777980010},
			"secondary_window":{"used_percent":4,"limit_window_seconds":604800,"reset_at":1778546810}
		}
	}`), "")
	if err != nil {
		t.Fatalf("BuildCodexQuotaResponseFromUsagePayload: %v", err)
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
	if got := *result.Windows[1].RemainingPercent; got != 96 {
		t.Fatalf("weekly remaining = %d, want 96", got)
	}
}

func TestRedactCodexQuotaCurlHeadersMasksSensitiveValues(t *testing.T) {
	headers := RedactCodexQuotaCurlHeaders(map[string]string{
		"Authorization": "Bearer sk-live",
		"Cookie":        "session=secret",
		"X-Api-Key":     "sk-live",
		"Accept":        "application/json",
	})

	if headers["Authorization"] != "Bearer <redacted>" {
		t.Fatalf("Authorization = %q", headers["Authorization"])
	}
	if headers["Cookie"] != "<redacted>" {
		t.Fatalf("Cookie = %q", headers["Cookie"])
	}
	if headers["X-Api-Key"] != "<redacted>" {
		t.Fatalf("X-Api-Key = %q", headers["X-Api-Key"])
	}
	if headers["Accept"] != "application/json" {
		t.Fatalf("Accept = %q", headers["Accept"])
	}
}

func TestRedactCodexQuotaCurlURLMasksAPIKeyPlaceholderValue(t *testing.T) {
	got := RedactCodexQuotaCurlURL("https://codex.example.com/usage?key=sk-live", "sk-live")
	if got != "https://codex.example.com/usage?key=<redacted>" {
		t.Fatalf("redacted url = %q", got)
	}
}
