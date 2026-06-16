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

func TestBuildCodexQuotaResponseFromUsagePayloadParsesXiaomiMiMoFractionalPercent(t *testing.T) {
	result, err := BuildCodexQuotaResponseFromUsagePayload([]byte(`{
		"code": 0,
		"message": "",
		"data": {
			"usage": {
				"percent": 0.53,
				"items": [{
					"name": "plan_total_token",
					"used": 20037365787,
					"limit": 38000000000,
					"percent": 0.53
				}, {
					"name": "compensation_total_token",
					"used": 9762128449,
					"limit": 9762128449,
					"percent": 1
				}]
			},
			"monthUsage": {
				"percent": 0.7842,
				"items": [{
					"name": "month_total_token",
					"used": 29799494236,
					"limit": 38000000000,
					"percent": 0.7842
				}]
			}
		}
	}`), "")
	if err != nil {
		t.Fatalf("BuildCodexQuotaResponseFromUsagePayload: %v", err)
	}
	if len(result.Windows) != 2 {
		t.Fatalf("windows = %#v", result.Windows)
	}
	if got := *result.Windows[0].RemainingPercent; got != 47 {
		t.Fatalf("plan remaining = %d, want 47", got)
	}
	if got := *result.Windows[1].RemainingPercent; got != 22 {
		t.Fatalf("month remaining = %d, want 22", got)
	}
	if result.Windows[0].RemainingTokens == nil || *result.Windows[0].RemainingTokens != 17962634213 {
		t.Fatalf("plan remaining tokens = %#v, want 17962634213", result.Windows[0].RemainingTokens)
	}
}

func TestBuildCodexQuotaResponseFromUsagePayloadParsesNestedBalanceData(t *testing.T) {
	result, err := BuildCodexQuotaResponseFromUsagePayload([]byte(`{
		"code": 0,
		"message": "",
		"data": {
			"balance": "0.00",
			"frozenBalance": "0.00",
			"currency": "CNY",
			"overdraftLimit": "0.00",
			"remainingOverdraftLimit": "0.00",
			"giftBalance": "1.25",
			"cashBalance": "2.50"
		}
	}`), "xiaomimimo")
	if err != nil {
		t.Fatalf("BuildCodexQuotaResponseFromUsagePayload: %v", err)
	}
	if result.Billing == nil || !result.Billing.IsAvailable {
		t.Fatalf("billing = %#v, want available", result.Billing)
	}
	if len(result.Billing.BalanceInfos) != 1 {
		t.Fatalf("balance infos = %#v, want 1", result.Billing.BalanceInfos)
	}
	info := result.Billing.BalanceInfos[0]
	if info.Currency != "CNY" || info.TotalBalance != "0.00" || info.GrantedBalance != "1.25" || info.ToppedUpBalance != "2.50" {
		t.Fatalf("balance info = %#v", info)
	}
}

func TestBuildCodexQuotaResponseFromUsagePayloadParsesNestedSnakeCaseBalanceData(t *testing.T) {
	result, err := BuildCodexQuotaResponseFromUsagePayload([]byte(`{
		"data": {
			"total_balance": 12.5,
			"granted_balance": 4,
			"topped_up_balance": 8.5,
			"currency_code": "EUR"
		}
	}`), "generic")
	if err != nil {
		t.Fatalf("BuildCodexQuotaResponseFromUsagePayload: %v", err)
	}
	if result.Billing == nil || len(result.Billing.BalanceInfos) != 1 {
		t.Fatalf("billing = %#v, want one balance", result.Billing)
	}
	info := result.Billing.BalanceInfos[0]
	if info.Currency != "EUR" || info.TotalBalance != "12.50" || info.GrantedBalance != "4.00" || info.ToppedUpBalance != "8.50" {
		t.Fatalf("balance info = %#v", info)
	}
}
