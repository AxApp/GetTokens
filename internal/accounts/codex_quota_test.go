package accounts

import (
	"encoding/base64"
	"encoding/json"
	"testing"
)

func TestParseCodexAuthFile(t *testing.T) {
	claims := map[string]interface{}{
		"https://api.openai.com/auth": map[string]interface{}{
			"chatgpt_account_id": "acct_123",
			"chatgpt_plan_type":  "pro",
		},
	}
	claimBytes, err := json.Marshal(claims)
	if err != nil {
		t.Fatalf("marshal claims: %v", err)
	}

	raw := map[string]interface{}{
		"auth_mode": "chatgpt",
		"tokens": map[string]interface{}{
			"access_token": "token_abc",
			"id_token":     "header." + base64.RawURLEncoding.EncodeToString(claimBytes) + ".sig",
		},
	}
	body, err := json.Marshal(raw)
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}

	info, err := parseCodexAuthFile(body)
	if err != nil {
		t.Fatalf("parseCodexAuthFile: %v", err)
	}

	if info.AccessToken != "token_abc" {
		t.Fatalf("unexpected access token: %q", info.AccessToken)
	}
	if info.ChatGPTAccountID != "acct_123" {
		t.Fatalf("unexpected account id: %q", info.ChatGPTAccountID)
	}
	if info.PlanType != "pro" {
		t.Fatalf("unexpected plan type: %q", info.PlanType)
	}
}

func TestParseCodexAuthFileUsesCamelCaseAndRootFallbacks(t *testing.T) {
	raw := map[string]interface{}{
		"accessToken": "token_root_camel",
		"accountId":   "acct_root_camel",
		"tokens": map[string]interface{}{
			"accessToken": "token_tokens_camel",
			"accountId":   "acct_tokens_camel",
		},
	}
	body, err := json.Marshal(raw)
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}

	info, err := parseCodexAuthFile(body)
	if err != nil {
		t.Fatalf("parseCodexAuthFile: %v", err)
	}

	if info.AccessToken != "token_tokens_camel" {
		t.Fatalf("unexpected access token: %q", info.AccessToken)
	}
	if info.ChatGPTAccountID != "acct_tokens_camel" {
		t.Fatalf("unexpected account id: %q", info.ChatGPTAccountID)
	}
}

func TestBuildCodexQuotaWindows(t *testing.T) {
	usedPrimary := 20.0
	usedWeekly := 55.0
	payload := &codexUsagePayload{
		PlanType: "plus",
		RateLimit: &codexRateLimitInfo{
			PrimaryWindow: &codexUsageWindow{
				UsedPercent:        usedPrimary,
				LimitWindowSeconds: codexFiveHourWindowSeconds,
				ResetAt:            float64(1710000000),
			},
			SecondWindow: &codexUsageWindow{
				UsedPercent:        usedWeekly,
				LimitWindowSeconds: codexWeeklyWindowSeconds,
				ResetAt:            float64(1710600000),
			},
		},
	}

	windows := buildCodexQuotaWindows(payload)
	if len(windows) != 2 {
		t.Fatalf("expected 2 windows, got %d", len(windows))
	}
	if windows[0].Label != "5H" || windows[1].Label != "7D" {
		t.Fatalf("unexpected labels: %#v", windows)
	}
	if windows[0].ID != "five-hour" || windows[1].ID != "weekly" {
		t.Fatalf("unexpected ids: %#v", windows)
	}
	if windows[0].RemainingPercent == nil || *windows[0].RemainingPercent != 80 {
		t.Fatalf("unexpected primary remaining: %#v", windows[0].RemainingPercent)
	}
	if windows[1].RemainingPercent == nil || *windows[1].RemainingPercent != 45 {
		t.Fatalf("unexpected weekly remaining: %#v", windows[1].RemainingPercent)
	}
	if windows[0].ResetAtUnix != 1710000000 {
		t.Fatalf("unexpected primary resetAtUnix: %d", windows[0].ResetAtUnix)
	}
	if windows[1].ResetAtUnix != 1710600000 {
		t.Fatalf("unexpected weekly resetAtUnix: %d", windows[1].ResetAtUnix)
	}
}

func TestParseCachedCodexQuota(t *testing.T) {
	body := []byte(`{
		"plan":"plus",
		"nolon":{
			"usage_cache":{
				"usage":{
					"identity":{"plan":"plus"},
					"primary":{
						"windowMinutes":300,
						"usedPercent":26,
						"resetsAt":1710000000
					},
					"secondary":{
						"windowMinutes":10080,
						"usedPercent":53,
						"resetDescription":"重置于 2026年4月9日 下午5:26"
					}
				}
			}
		}
	}`)

	quota := parseCachedCodexQuota(body)
	if quota == nil {
		t.Fatal("expected cached quota")
	}
	if quota.PlanType != "plus" {
		t.Fatalf("unexpected plan type: %q", quota.PlanType)
	}
	if len(quota.Windows) != 2 {
		t.Fatalf("expected 2 windows, got %d", len(quota.Windows))
	}
	if quota.Windows[0].RemainingPercent == nil || *quota.Windows[0].RemainingPercent != 74 {
		t.Fatalf("unexpected primary remaining: %#v", quota.Windows[0].RemainingPercent)
	}
	if quota.Windows[1].RemainingPercent == nil || *quota.Windows[1].RemainingPercent != 47 {
		t.Fatalf("unexpected secondary remaining: %#v", quota.Windows[1].RemainingPercent)
	}
	if quota.Windows[1].ResetLabel != "重置于 2026年4月9日 下午5:26" {
		t.Fatalf("unexpected reset label: %q", quota.Windows[1].ResetLabel)
	}
	if quota.Windows[0].ResetAtUnix != 1710000000 {
		t.Fatalf("unexpected primary resetAtUnix: %d", quota.Windows[0].ResetAtUnix)
	}
	if quota.Windows[1].ResetAtUnix != 0 {
		t.Fatalf("unexpected secondary resetAtUnix: %d", quota.Windows[1].ResetAtUnix)
	}
}

func TestRedactCodexQuotaHeaders(t *testing.T) {
	headers := redactCodexQuotaHeaders(map[string]string{
		"Authorization":      "Bearer secret-token",
		"chatgpt-account-id": "acct-123",
	})

	if headers["Authorization"] != "Bearer <redacted>" {
		t.Fatalf("unexpected authorization header: %q", headers["Authorization"])
	}
	if headers["chatgpt-account-id"] != "acct-123" {
		t.Fatalf("unexpected account header: %q", headers["chatgpt-account-id"])
	}
}

func TestParseCodexQuotaDebugResponse(t *testing.T) {
	response := parseCodexQuotaDebugResponse([]byte(`{"plan_type":"plus","rate_limit":{"primary_window":{"used_percent":20}}}`))
	typed, ok := response.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map response, got %#v", response)
	}
	if typed["plan_type"] != "plus" {
		t.Fatalf("unexpected plan_type: %#v", typed["plan_type"])
	}
}

func TestCodexQuotaRequestHeadersMatchDefaultChatGPTQuery(t *testing.T) {
	headers := codexQuotaRequestHeaders("token_123", "acct_123")

	if len(headers) != 3 {
		t.Fatalf("unexpected header count: %#v", headers)
	}
	if headers["Authorization"] != "Bearer token_123" {
		t.Fatalf("unexpected authorization header: %q", headers["Authorization"])
	}
	if headers["chatgpt-account-id"] != "acct_123" {
		t.Fatalf("unexpected account header: %q", headers["chatgpt-account-id"])
	}
	if headers["Accept"] != "application/json" {
		t.Fatalf("unexpected accept header: %q", headers["Accept"])
	}
}

func TestResolveCodexQuotaRequestInfo(t *testing.T) {
	body := []byte(`{
		"tokens": {
			"accountId": "acct_tokens"
		},
		"planType": "pro"
	}`)

	info, err := ResolveCodexQuotaRequestInfo(body)
	if err != nil {
		t.Fatalf("ResolveCodexQuotaRequestInfo: %v", err)
	}
	if info.ChatGPTAccountID != "acct_tokens" {
		t.Fatalf("unexpected account id: %q", info.ChatGPTAccountID)
	}
	if info.PlanType != "pro" {
		t.Fatalf("unexpected plan type: %q", info.PlanType)
	}
}

func TestBuildCodexQuotaResponse(t *testing.T) {
	authBody := []byte(`{"planType":"plus","tokens":{"account_id":"acct_1"}}`)
	usageBody := []byte(`{
		"plan_type":"pro",
		"rate_limit":{
			"primary_window":{"used_percent":20,"limit_window_seconds":18000,"reset_at":1710000000},
			"secondary_window":{"used_percent":55,"limit_window_seconds":604800,"reset_at":1710600000}
		}
	}`)

	result, err := BuildCodexQuotaResponse(authBody, usageBody)
	if err != nil {
		t.Fatalf("BuildCodexQuotaResponse: %v", err)
	}
	if result.PlanType != "pro" {
		t.Fatalf("unexpected plan type: %q", result.PlanType)
	}
	if len(result.Windows) != 2 {
		t.Fatalf("unexpected windows: %#v", result.Windows)
	}
}
