package accounts

import "testing"

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
