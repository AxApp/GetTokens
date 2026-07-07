package wailsapp

import (
	"encoding/json"
	"io"
	"net/url"
	"testing"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
	"github.com/linhay/gettokens/internal/cliproxyapi"
	"github.com/linhay/gettokens/internal/menubar"
)

func TestBuildMenuBarQuotaSnapshotSortsByRemainingAndSummarizesBalance(t *testing.T) {
	remainingLow := 6
	remainingWarn := 18
	remainingGood := 88
	statuses := []cliproxyapi.QuotaRuntimeState{
		{
			AccountKey:      "acct_good",
			Status:          cliproxyapi.QuotaRuntimeStatusSuccess,
			LastEvaluatedAt: "2026-06-07T10:12:00+08:00",
			Windows: []cliproxyapi.QuotaRuntimeWindow{{
				ID:               "weekly",
				Label:            "7D",
				RemainingPercent: &remainingGood,
			}},
			Billing: &cliproxyapi.QuotaRuntimeBilling{IsAvailable: true, BalanceInfos: []cliproxyapi.QuotaRuntimeBalanceInfo{{
				Currency:     "USD",
				TotalBalance: "80.25",
			}}},
		},
		{
			AccountKey:      "acct_low",
			Status:          cliproxyapi.QuotaRuntimeStatusSuccess,
			LastEvaluatedAt: "2026-06-07T10:14:00+08:00",
			Windows: []cliproxyapi.QuotaRuntimeWindow{{
				ID:               "five-hour",
				Label:            "5H",
				RemainingPercent: &remainingLow,
				ResetLabel:       "14:00 reset",
			}},
			Billing: &cliproxyapi.QuotaRuntimeBilling{IsAvailable: true, BalanceInfos: []cliproxyapi.QuotaRuntimeBalanceInfo{{
				Currency:     "USD",
				TotalBalance: "42.00",
			}}},
		},
		{
			AccountKey: "acct_warn",
			Status:     cliproxyapi.QuotaRuntimeStatusSuccess,
			Windows: []cliproxyapi.QuotaRuntimeWindow{{
				ID:               "weekly",
				Label:            "7D",
				RemainingPercent: &remainingWarn,
			}},
			Billing: &cliproxyapi.QuotaRuntimeBilling{IsAvailable: true, BalanceInfos: []cliproxyapi.QuotaRuntimeBalanceInfo{{
				Currency:     "CNY",
				TotalBalance: "12.50",
			}}},
		},
	}
	accounts := []accountsdomain.AccountRecord{
		{ID: "acct_low", QuotaKey: "acct_low", DisplayName: "codex-free-low.json"},
		{ID: "acct_warn", QuotaKey: "acct_warn", DisplayName: "codex-team.json"},
		{ID: "acct_good", QuotaKey: "acct_good", DisplayName: "codex-pro.json"},
	}

	snapshot := buildMenuBarQuotaSnapshot(statuses, accounts)

	if snapshot.Summary.LowestQuota != "06%" {
		t.Fatalf("lowest quota = %q, want 06%%", snapshot.Summary.LowestQuota)
	}
	if snapshot.Summary.RiskAccounts != "2" {
		t.Fatalf("risk accounts = %q, want 2", snapshot.Summary.RiskAccounts)
	}
	if snapshot.Summary.RiskSummary != "2 个风险账号" {
		t.Fatalf("risk summary = %q", snapshot.Summary.RiskSummary)
	}
	if snapshot.Summary.TotalBalance != "$122.25 + ¥12.5" {
		t.Fatalf("total balance = %q", snapshot.Summary.TotalBalance)
	}
	if snapshot.Summary.RefreshLabel != "10:14" {
		t.Fatalf("refresh label = %q", snapshot.Summary.RefreshLabel)
	}
	if len(snapshot.Resources) != 3 {
		t.Fatalf("resources len = %d", len(snapshot.Resources))
	}
	first := snapshot.Resources[0]
	if first.Name != "codex-free-low.json" || first.PercentText != "06%" || first.Percent != 0.06 || first.Tone != "bad" || first.State != "需处理" {
		t.Fatalf("first resource = %#v", first)
	}
	if first.Balance != "$42.00 余额" {
		t.Fatalf("first balance = %q", first.Balance)
	}
	if snapshot.Resources[1].PercentText != "18%" || snapshot.Resources[1].Tone != "warn" {
		t.Fatalf("second resource = %#v", snapshot.Resources[1])
	}
	if len(snapshot.Balances) != 3 || snapshot.Balances[0].Value != "$80.25" || snapshot.Balances[1].Value != "$42.00" || snapshot.Balances[2].Value != "¥12.50" {
		t.Fatalf("balances = %#v", snapshot.Balances)
	}
}

func TestBuildMenuBarQuotaSnapshotKeepsMoreRiskSummaryBeyondVisibleResources(t *testing.T) {
	remainingLow := 4
	statuses := []cliproxyapi.QuotaRuntimeState{}
	accounts := []accountsdomain.AccountRecord{}
	for _, key := range []string{"acct_1", "acct_2", "acct_3", "acct_4"} {
		statuses = append(statuses, cliproxyapi.QuotaRuntimeState{
			AccountKey: key,
			Status:     cliproxyapi.QuotaRuntimeStatusSuccess,
			Windows: []cliproxyapi.QuotaRuntimeWindow{{
				ID:               "five-hour",
				Label:            "5H",
				RemainingPercent: &remainingLow,
			}},
		})
		accounts = append(accounts, accountsdomain.AccountRecord{ID: key, QuotaKey: key, DisplayName: key})
	}

	snapshot := buildMenuBarQuotaSnapshot(statuses, accounts)

	if len(snapshot.Resources) != 3 {
		t.Fatalf("resources len = %d, want visible cap 3", len(snapshot.Resources))
	}
	if snapshot.Summary.RiskAccounts != "4" || snapshot.Summary.MoreRiskLabel != "还有 1 个风险账号" {
		t.Fatalf("summary = %#v", snapshot.Summary)
	}
}

func TestBuildMenuBarQuotaSnapshotEmptyDataKeepsPlaceholder(t *testing.T) {
	snapshot := buildMenuBarQuotaSnapshot(nil, nil)
	if snapshot.Summary.LowestQuota != "--%" || snapshot.Summary.RiskAccounts != "--" || snapshot.Summary.TotalBalance != "--" || snapshot.Summary.RefreshLabel != "--:--" {
		t.Fatalf("summary = %#v", snapshot.Summary)
	}
	if len(snapshot.Resources) != 0 || len(snapshot.Balances) != 0 {
		t.Fatalf("snapshot = %#v", snapshot)
	}
}

func TestRefreshMenuBarQuotaSnapshotReadsOnlyRuntimeSnapshot(t *testing.T) {
	paths := []string{}
	app := &App{
		menuBar: menubar.NewController(),
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			paths = append(paths, method+" "+path)
			if path == ManagementAPIPrefix+"/gettokens/quota-refresh/acct_low" {
				t.Fatalf("menu bar snapshot must not call quota refresh")
			}
			switch path {
			case ManagementAPIPrefix + "/gettokens/quota-status":
				return []byte(`{"items":[{"account_key":"acct_low","status":"success","windows":[{"id":"weekly","label":"7D","remaining_percent":6}],"billing":{"is_available":true,"balance_infos":[{"currency":"USD","total_balance":"42.00"}]},"sources":[]}]}`), 200, nil
			case ManagementAPIPrefix + "/accounts":
				return []byte(`{"accounts":[{"account_key":"acct_low","kind":"codex-api-key","title":"codex-free-low.json","provider":"codex","credential_source":"sidecar-management-api","codex_api_key":{"api_key":"sk-test","base_url":"https://api.openai.com/v1"}}]}`), 200, nil
			default:
				t.Fatalf("unexpected request: %s %s", method, path)
			}
			return nil, 404, nil
		},
	}

	app.refreshMenuBarQuotaSnapshot()

	if len(paths) != 2 {
		t.Fatalf("paths = %#v, want quota-status and accounts only", paths)
	}
	if paths[0] != "GET "+ManagementAPIPrefix+"/gettokens/quota-status" || paths[1] != "GET "+ManagementAPIPrefix+"/accounts" {
		t.Fatalf("paths = %#v", paths)
	}
}

func TestRefreshMenuBarQuotaSnapshotActiveRefreshesConfiguredAccounts(t *testing.T) {
	paths := []string{}
	var batchInput cliproxyapi.QuotaRefreshBatchInput
	app := &App{
		menuBar: menubar.NewController(),
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			paths = append(paths, method+" "+path)
			switch path {
			case ManagementAPIPrefix + "/accounts":
				return []byte(`{"accounts":[
					{"account_key":"acct_active","kind":"codex-api-key","title":"active","provider":"codex","credential_source":"sidecar-management-api","codex_api_key":{"api_key":"sk-test","base_url":"https://api.openai.com/v1","quota_enabled":true,"quota_curl":"curl {{baseUrl}}/quota"}},
					{"account_key":"acct_billing","kind":"openai-compatible","title":"billing","provider":"openai-compatible","credential_source":"sidecar-management-api","openai_compatible":{"provider_name":"deepseek","runtime_provider_key":"deepseek","base_url":"https://api.deepseek.com","api_key_entries_json":"[]","billing_enabled":true,"billing_curl":"curl {{baseUrl}}/balance"}},
					{"account_key":"acct_disabled","kind":"codex-api-key","title":"disabled","provider":"codex","credential_source":"sidecar-management-api","disabled":true,"codex_api_key":{"api_key":"sk-test","base_url":"https://api.openai.com/v1","quota_enabled":true,"quota_curl":"curl {{baseUrl}}/quota"}},
					{"account_key":"acct_unconfigured","kind":"codex-api-key","title":"unconfigured","provider":"codex","credential_source":"sidecar-management-api","codex_api_key":{"api_key":"sk-test","base_url":"https://api.openai.com/v1"}}
				]}`), 200, nil
			case ManagementAPIPrefix + "/gettokens/quota-refresh-batch":
				if contentType != "application/json" {
					t.Fatalf("contentType = %q, want application/json", contentType)
				}
				payload, err := io.ReadAll(body)
				if err != nil {
					t.Fatalf("read batch body: %v", err)
				}
				if err := json.Unmarshal(payload, &batchInput); err != nil {
					t.Fatalf("decode batch body %s: %v", payload, err)
				}
				return []byte(`{"items":[
					{"account_key":"acct_active","status":"success","windows":[{"id":"weekly","label":"7D","remaining_percent":42}],"sources":[]},
					{"account_key":"acct_billing","status":"success","windows":[],"billing":{"is_available":true,"balance_infos":[{"currency":"USD","total_balance":"12.00"}]},"sources":[]}
				],"errors":[],"succeeded":2,"failed":0}`), 200, nil
			case ManagementAPIPrefix + "/gettokens/quota-status":
				return []byte(`{"items":[{"account_key":"acct_active","status":"success","windows":[{"id":"weekly","label":"7D","remaining_percent":42}],"sources":[]}]}`), 200, nil
			default:
				t.Fatalf("unexpected request: %s %s", method, path)
			}
			return nil, 404, nil
		},
	}

	app.refreshMenuBarQuotaSnapshotActive()

	want := []string{
		"GET " + ManagementAPIPrefix + "/accounts",
		"POST " + ManagementAPIPrefix + "/gettokens/quota-refresh-batch",
		"GET " + ManagementAPIPrefix + "/gettokens/quota-status",
		"GET " + ManagementAPIPrefix + "/accounts",
	}
	if len(paths) != len(want) {
		t.Fatalf("paths = %#v, want %#v", paths, want)
	}
	for index := range want {
		if paths[index] != want[index] {
			t.Fatalf("paths[%d] = %q, want %q; all paths = %#v", index, paths[index], want[index], paths)
		}
	}
	if len(batchInput.AccountKeys) != 2 ||
		batchInput.AccountKeys[0] != "acct_active" ||
		batchInput.AccountKeys[1] != "acct_billing" {
		t.Fatalf("batch account keys = %#v", batchInput.AccountKeys)
	}
	if !batchInput.IncludeBilling {
		t.Fatalf("batch include billing = false, want true")
	}
	if batchInput.Concurrency <= 0 {
		t.Fatalf("batch concurrency = %d, want positive", batchInput.Concurrency)
	}
}
