package accounts

import (
	"encoding/base64"
	"encoding/json"
	"testing"
)

func TestParseCodexAuthFile(t *testing.T) {
	claims := map[string]interface{}{
		"chatgpt_account_id": "acct_123",
		"plan_type":          "pro",
	}
	claimBytes, err := json.Marshal(claims)
	if err != nil {
		t.Fatalf("marshal claims: %v", err)
	}

	raw := map[string]interface{}{
		"metadata": map[string]interface{}{
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
	if windows[0].RemainingPercent == nil || *windows[0].RemainingPercent != 80 {
		t.Fatalf("unexpected primary remaining: %#v", windows[0].RemainingPercent)
	}
	if windows[1].RemainingPercent == nil || *windows[1].RemainingPercent != 45 {
		t.Fatalf("unexpected weekly remaining: %#v", windows[1].RemainingPercent)
	}
}
