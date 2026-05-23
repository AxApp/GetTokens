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

func TestBuildCodexQuotaCurlRequestParsesCookieOption(t *testing.T) {
	req, err := BuildCodexQuotaCurlRequest(CodexQuotaCurlInput{
		Curl:   `curl -b "session={{apiKey}}; locale=zh-CN" "https://codex.example.com/api/codex/usage"`,
		APIKey: "sk-live",
	})
	if err != nil {
		t.Fatalf("BuildCodexQuotaCurlRequest: %v", err)
	}

	if req.Headers["Cookie"] != "session=sk-live; locale=zh-CN" {
		t.Fatalf("Cookie = %q", req.Headers["Cookie"])
	}
}

func TestBuildCodexQuotaCurlRequestAppendsCookieOptionToCookieHeader(t *testing.T) {
	req, err := BuildCodexQuotaCurlRequest(CodexQuotaCurlInput{
		Curl: `curl "https://codex.example.com/api/codex/usage" -H "cookie: existing=1" --cookie "session=sk-live"`,
	})
	if err != nil {
		t.Fatalf("BuildCodexQuotaCurlRequest: %v", err)
	}

	if req.Headers["cookie"] != "existing=1; session=sk-live" {
		t.Fatalf("cookie = %q", req.Headers["cookie"])
	}
	if _, ok := req.Headers["Cookie"]; ok {
		t.Fatalf("Cookie header should have reused existing lower-case key")
	}
}

func TestBuildCodexQuotaCurlRequestIgnoresUnsupportedOptions(t *testing.T) {
	req, err := BuildCodexQuotaCurlRequest(CodexQuotaCurlInput{
		Curl: `curl --http2 --connect-timeout 5 -A "quota-checker" "https://codex.example.com/api/codex/usage"`,
	})
	if err != nil {
		t.Fatalf("BuildCodexQuotaCurlRequest: %v", err)
	}

	if req.URL != "https://codex.example.com/api/codex/usage" {
		t.Fatalf("URL = %q", req.URL)
	}
	wantIgnored := []string{"--http2", "--connect-timeout 5", "-A quota-checker"}
	if len(req.IgnoredOptions) != len(wantIgnored) {
		t.Fatalf("IgnoredOptions = %#v, want %#v", req.IgnoredOptions, wantIgnored)
	}
	for index, want := range wantIgnored {
		if req.IgnoredOptions[index] != want {
			t.Fatalf("IgnoredOptions[%d] = %q, want %q", index, req.IgnoredOptions[index], want)
		}
	}
}

func TestCodexQuotaCurlIgnoredOptionsHint(t *testing.T) {
	got := CodexQuotaCurlIgnoredOptionsHint([]string{"--http2", "--http2", "-A quota-checker"})
	want := "已忽略暂不支持的 curl 参数: --http2, -A quota-checker"
	if got != want {
		t.Fatalf("hint = %q, want %q", got, want)
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

func TestBuildCodexQuotaResponseFromUsagePayloadParsesXiaomiMiMoTokenPlanUsage(t *testing.T) {
	result, err := BuildCodexQuotaResponseFromUsagePayload([]byte(`{
		"code": 0,
		"message": "",
		"data": {
			"monthUsage": {
				"percent": 40,
				"items": [{
					"name": "month_total_token",
					"used": 400,
					"limit": 1000,
					"percent": 40
				}]
			},
			"usage": {
				"percent": 12.5,
				"items": [{
					"name": "plan_total_token",
					"used": 125,
					"limit": 1000,
					"percent": 12.5
				}, {
					"name": "compensation_total_token",
					"used": 0,
					"limit": 0,
					"percent": 0
				}]
			}
		}
	}`), "")
	if err != nil {
		t.Fatalf("BuildCodexQuotaResponseFromUsagePayload: %v", err)
	}
	if result.PlanType != "xiaomimimo" {
		t.Fatalf("PlanType = %q, want xiaomimimo", result.PlanType)
	}
	if len(result.Windows) != 2 {
		t.Fatalf("windows = %#v", result.Windows)
	}
	if result.Windows[0].ID != "mimo-plan-total-token" || result.Windows[0].Label != "PLAN" {
		t.Fatalf("plan window = %#v", result.Windows[0])
	}
	if got := *result.Windows[0].RemainingPercent; got != 88 {
		t.Fatalf("plan remaining = %d, want 88", got)
	}
	if result.Windows[0].UsedTokens == nil || *result.Windows[0].UsedTokens != 125 {
		t.Fatalf("plan used tokens = %#v, want 125", result.Windows[0].UsedTokens)
	}
	if result.Windows[0].LimitTokens == nil || *result.Windows[0].LimitTokens != 1000 {
		t.Fatalf("plan limit tokens = %#v, want 1000", result.Windows[0].LimitTokens)
	}
	if result.Windows[0].RemainingTokens == nil || *result.Windows[0].RemainingTokens != 875 {
		t.Fatalf("plan remaining tokens = %#v, want 875", result.Windows[0].RemainingTokens)
	}
	if result.Windows[1].ID != "mimo-month-total-token" || result.Windows[1].Label != "MONTH" {
		t.Fatalf("month window = %#v", result.Windows[1])
	}
	if got := *result.Windows[1].RemainingPercent; got != 60 {
		t.Fatalf("month remaining = %d, want 60", got)
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

func TestTryParseBillingResponse(t *testing.T) {
	t.Run("deepseek payload", func(t *testing.T) {
		billing := TryParseBillingResponse([]byte(`{
			"is_available": true,
			"balance_infos": [{
				"currency": "CNY",
				"total_balance": "25.50",
				"granted_balance": "12.25",
				"topped_up_balance": "13.25"
			}]
		}`))
		if billing == nil {
			t.Fatal("billing = nil")
		}
		if !billing.IsAvailable {
			t.Fatal("IsAvailable = false, want true")
		}
		if len(billing.BalanceInfos) != 1 {
			t.Fatalf("BalanceInfos len = %d, want 1", len(billing.BalanceInfos))
		}
		if got := billing.BalanceInfos[0].Currency; got != "CNY" {
			t.Fatalf("Currency = %q, want CNY", got)
		}
		if got := billing.BalanceInfos[0].GrantedBalance; got != "12.25" {
			t.Fatalf("GrantedBalance = %q, want 12.25", got)
		}
	})

	t.Run("openrouter payload", func(t *testing.T) {
		billing := TryParseBillingResponse([]byte(`{
			"data": {
				"total_credits": 100.5,
				"total_usage": 40.25
			}
		}`))
		if billing == nil {
			t.Fatal("billing = nil")
		}
		if got := billing.BalanceInfos[0].TotalBalance; got != "100.50" {
			t.Fatalf("TotalBalance = %q, want 100.50", got)
		}
		if got := billing.BalanceInfos[0].GrantedBalance; got != "60.25" {
			t.Fatalf("GrantedBalance = %q, want 60.25", got)
		}
	})

	t.Run("openai payload", func(t *testing.T) {
		billing := TryParseBillingResponse([]byte(`{
			"hard_limit_usd": 120,
			"total_used": 35.75,
			"total_available": 84.25
		}`))
		if billing == nil {
			t.Fatal("billing = nil")
		}
		if got := billing.BalanceInfos[0].TotalBalance; got != "120.00" {
			t.Fatalf("TotalBalance = %q, want 120.00", got)
		}
		if got := billing.BalanceInfos[0].GrantedBalance; got != "84.25" {
			t.Fatalf("GrantedBalance = %q, want 84.25", got)
		}
	})
}
