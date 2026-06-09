package cliproxyapi

import (
	"io"
	"net/url"
	"strings"
	"testing"
)

func TestListAPIKeys(t *testing.T) {
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		if method != "GET" {
			t.Fatalf("expected GET, got %s", method)
		}
		if path != "/v0/management/api-keys" {
			t.Fatalf("unexpected path: %s", path)
		}
		return []byte(`{"api-keys":["relay-a","relay-b"]}`), 200, nil
	})

	items, err := client.ListAPIKeys()
	if err != nil {
		t.Fatalf("ListAPIKeys returned error: %v", err)
	}
	if len(items) != 2 || items[0] != "relay-a" || items[1] != "relay-b" {
		t.Fatalf("unexpected api keys: %#v", items)
	}
}

func TestPutAPIKeys(t *testing.T) {
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		if method != "PUT" {
			t.Fatalf("expected PUT, got %s", method)
		}
		if path != "/v0/management/api-keys" {
			t.Fatalf("unexpected path: %s", path)
		}
		if contentType != "application/json" {
			t.Fatalf("unexpected content type: %s", contentType)
		}

		payload, err := io.ReadAll(body)
		if err != nil {
			t.Fatalf("read body: %v", err)
		}
		if strings.TrimSpace(string(payload)) != `["relay-updated"]` {
			t.Fatalf("unexpected payload: %s", payload)
		}
		return nil, 200, nil
	})

	if err := client.PutAPIKeys([]string{"relay-updated"}); err != nil {
		t.Fatalf("PutAPIKeys returned error: %v", err)
	}
}

func TestUnifiedAccountsClientCRUDStatusAndPriority(t *testing.T) {
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		switch {
		case method == "GET" && path == "/v0/management/accounts":
			return []byte(`{"accounts":[{"account_key":"acct_00000000-0000-4000-8000-000000000001","kind":"codex-api-key","title":"Primary","provider":"codex","codex_api_key":{"api_key":"sk-test","base_url":"https://api.example.com/v1","websockets":true}}]}`), 200, nil
		case method == "GET" && path == "/v0/management/accounts/acct_00000000-0000-4000-8000-000000000001":
			return []byte(`{"account_key":"acct_00000000-0000-4000-8000-000000000001","kind":"codex-api-key","title":"Primary","provider":"codex"}`), 200, nil
		case method == "POST" && path == "/v0/management/accounts":
			assertJSONContains(t, body, `"kind":"codex-api-key"`)
			return []byte(`{"account_key":"acct_00000000-0000-4000-8000-000000000002","kind":"codex-api-key","title":"Created","provider":"codex"}`), 200, nil
		case method == "PATCH" && path == "/v0/management/accounts/acct_00000000-0000-4000-8000-000000000001":
			assertJSONContains(t, body, `"title":"Updated"`)
			return []byte(`{"account_key":"acct_00000000-0000-4000-8000-000000000001","kind":"codex-api-key","title":"Updated","provider":"codex"}`), 200, nil
		case method == "PATCH" && path == "/v0/management/accounts/acct_00000000-0000-4000-8000-000000000001/status":
			assertJSONContains(t, body, `"disabled":true`)
			return []byte(`{"account_key":"acct_00000000-0000-4000-8000-000000000001","kind":"codex-api-key","disabled":true}`), 200, nil
		case method == "PATCH" && path == "/v0/management/accounts/acct_00000000-0000-4000-8000-000000000001/priority":
			assertJSONContains(t, body, `"priority":9`)
			return []byte(`{"account_key":"acct_00000000-0000-4000-8000-000000000001","kind":"codex-api-key","priority":9}`), 200, nil
		case method == "DELETE" && path == "/v0/management/accounts/acct_00000000-0000-4000-8000-000000000001":
			return []byte(`{"ok":true}`), 200, nil
		case method == "POST" && path == "/v0/management/accounts/batch-delete":
			assertJSONContains(t, body, `"account_keys":["acct_00000000-0000-4000-8000-000000000001","acct_00000000-0000-4000-8000-000000000002"]`)
			return []byte(`{"deleted_account_keys":["acct_00000000-0000-4000-8000-000000000001"],"errors":[{"account_key":"acct_00000000-0000-4000-8000-000000000002","error":"account not found"}],"succeeded":1,"failed":1}`), 200, nil
		default:
			t.Fatalf("unexpected request: %s %s", method, path)
		}
		return nil, 404, nil
	})

	accounts, err := client.ListAccounts()
	if err != nil || len(accounts) != 1 || accounts[0].AccountKey == "" {
		t.Fatalf("ListAccounts = %#v, err = %v", accounts, err)
	}
	if account, err := client.GetAccount("acct_00000000-0000-4000-8000-000000000001"); err != nil || account.AccountKey == "" {
		t.Fatalf("GetAccount = %#v, err = %v", account, err)
	}
	if account, err := client.CreateAccount(AccountWriteRequest{Kind: AccountKindCodexAPIKey, Title: "Created"}); err != nil || account.AccountKey == "" {
		t.Fatalf("CreateAccount = %#v, err = %v", account, err)
	}
	if account, err := client.PatchAccount("acct_00000000-0000-4000-8000-000000000001", AccountWriteRequest{Kind: AccountKindCodexAPIKey, Title: "Updated"}); err != nil || account.Title != "Updated" {
		t.Fatalf("PatchAccount = %#v, err = %v", account, err)
	}
	if account, err := client.PatchAccountStatus("acct_00000000-0000-4000-8000-000000000001", true); err != nil || !account.Disabled {
		t.Fatalf("PatchAccountStatus = %#v, err = %v", account, err)
	}
	if account, err := client.PatchAccountPriority("acct_00000000-0000-4000-8000-000000000001", 9); err != nil || account.Priority != 9 {
		t.Fatalf("PatchAccountPriority = %#v, err = %v", account, err)
	}
	if err := client.DeleteAccount("acct_00000000-0000-4000-8000-000000000001"); err != nil {
		t.Fatalf("DeleteAccount returned error: %v", err)
	}
	deleted, err := client.DeleteAccountsBatch(AccountBatchDeleteInput{AccountKeys: []string{"acct_00000000-0000-4000-8000-000000000001", "acct_00000000-0000-4000-8000-000000000002"}})
	if err != nil || deleted == nil || deleted.Succeeded != 1 || deleted.Failed != 1 || len(deleted.DeletedAccountKeys) != 1 || len(deleted.Errors) != 1 {
		t.Fatalf("DeleteAccountsBatch = %#v, err = %v", deleted, err)
	}
}

func TestAccountMigrationClientEndpoints(t *testing.T) {
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		if method != "POST" {
			t.Fatalf("expected POST, got %s", method)
		}
		if contentType != "application/json" {
			t.Fatalf("unexpected content type: %s", contentType)
		}
		switch path {
		case "/v0/management/account-migration/dry-run":
			return []byte(`{"generated_at_unix_ms":1780000000000,"candidates":[{"account_key":"acct_1","kind":"auth-file","title":"codex-pro","credential_source":"legacy-auth-file"},{"account_key":"acct_2","kind":"codex-api-key","title":"API","credential_source":"legacy-gettokens-codex-api-key"}],"warnings":["sample"]}`), 200, nil
		case "/v0/management/account-migration/commit":
			return []byte(`{"imported":2,"skipped":1}`), 200, nil
		case "/v0/management/account-migration/delete-legacy-sources":
			return []byte(`{"deleted":2,"backup_dir":"/tmp/backup","items":[{"id":"migration-source:1","source_kind":"auth-file","deleted":true}]}`), 200, nil
		default:
			t.Fatalf("unexpected path: %s", path)
		}
		return nil, 404, nil
	})

	dryRun, err := client.DryRunAccountMigration()
	if err != nil {
		t.Fatalf("DryRunAccountMigration: %v", err)
	}
	if dryRun.GeneratedAtUnixMs == 0 || len(dryRun.Candidates) != 2 || dryRun.Candidates[0].Kind != AccountKindAuthFile {
		t.Fatalf("unexpected dry-run report: %#v", dryRun)
	}

	commit, err := client.CommitAccountMigration()
	if err != nil {
		t.Fatalf("CommitAccountMigration: %v", err)
	}
	if commit.Imported != 2 || commit.Skipped != 1 {
		t.Fatalf("unexpected commit report: %#v", commit)
	}

	deleted, err := client.DeleteLegacyAccountSources()
	if err != nil {
		t.Fatalf("DeleteLegacyAccountSources: %v", err)
	}
	if deleted.Deleted != 2 || deleted.BackupDir != "/tmp/backup" || len(deleted.Items) != 1 {
		t.Fatalf("unexpected delete result: %#v", deleted)
	}
}

func TestRateLimitClientCRUDStatusAndEvents(t *testing.T) {
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		switch {
		case method == "GET" && path == "/v0/management/gettokens/rate-limit-strategies":
			return []byte(`{"items":[{"id":"token-window","name":"Token 窗口限流","supported_windows":["1h","24h"]}]}`), 200, nil
		case method == "GET" && path == "/v0/management/gettokens/rate-limit-rules":
			if got := query.Get("account_key"); got != "codex-api-key:stable-001" {
				t.Fatalf("unexpected account_key query: %s", got)
			}
			return []byte(`{"items":[{"id":"rlr-1","account_key":"codex-api-key:stable-001","strategy":"request-window","window":"1h","limit_value":10,"action":"block","enabled":true}]}`), 200, nil
		case method == "POST" && path == "/v0/management/gettokens/rate-limit-rules":
			assertJSONContains(t, body, `"strategy":"request-window"`)
			return []byte(`{"items":[{"id":"rlr-1","account_key":"codex-api-key:stable-001","strategy":"request-window","window":"1h","limit_value":10,"action":"block","enabled":true}]}`), 200, nil
		case method == "PUT" && path == "/v0/management/gettokens/rate-limit-rules/rlr-1":
			assertJSONContains(t, body, `"limit_value":20`)
			return []byte(`{"items":[{"id":"rlr-1","account_key":"codex-api-key:stable-001","strategy":"request-window","window":"1h","limit_value":20,"action":"block","enabled":true}]}`), 200, nil
		case method == "DELETE" && path == "/v0/management/gettokens/rate-limit-rules/rlr-1":
			return []byte(`{"ok":true}`), 200, nil
		case method == "GET" && path == "/v0/management/gettokens/rate-limit-status":
			if got := query.Get("account_key"); got != "codex-api-key:stable-001" {
				t.Fatalf("unexpected status account_key query: %s", got)
			}
			return []byte(`{"account_key":"codex-api-key:stable-001","blocked":true,"block_reason":"1h requests 已满","rules":[]}`), 200, nil
		case method == "GET" && path == "/v0/management/gettokens/rate-limit-events":
			if got := query.Get("limit"); got != "10" {
				t.Fatalf("unexpected limit query: %s", got)
			}
			return []byte(`{"items":[{"id":"evt-1","account_key":"codex-api-key:stable-001","rule_id":"rlr-1","strategy":"request-window","window":"1h","action":"block","usage_value":10,"limit_value":10,"blocked":true,"triggered_at":1760000000000}]}`), 200, nil
		default:
			t.Fatalf("unexpected request: %s %s", method, path)
		}
		return nil, 404, nil
	})

	strategies, err := client.ListRateLimitStrategies()
	if err != nil || len(strategies) != 1 || strategies[0].ID != "token-window" {
		t.Fatalf("strategies = %#v, err = %v", strategies, err)
	}
	rules, err := client.ListRateLimitRules("codex-api-key:stable-001")
	if err != nil || len(rules) != 1 || rules[0].ID != "rlr-1" {
		t.Fatalf("rules = %#v, err = %v", rules, err)
	}
	created, err := client.CreateRateLimitRule(RateLimitRule{
		AccountKey: "codex-api-key:stable-001",
		Strategy:   "request-window",
		Window:     "1h",
		LimitValue: 10,
		Action:     "block",
		Enabled:    true,
	})
	if err != nil || len(created) != 1 {
		t.Fatalf("created = %#v, err = %v", created, err)
	}
	updated, err := client.UpdateRateLimitRule(RateLimitRule{
		ID:         "rlr-1",
		AccountKey: "codex-api-key:stable-001",
		Strategy:   "request-window",
		Window:     "1h",
		LimitValue: 20,
		Action:     "block",
		Enabled:    true,
	})
	if err != nil || len(updated) != 1 || updated[0].LimitValue != 20 {
		t.Fatalf("updated = %#v, err = %v", updated, err)
	}
	if err := client.DeleteRateLimitRule("rlr-1"); err != nil {
		t.Fatalf("delete rate limit rule: %v", err)
	}
	status, err := client.GetRateLimitStatus("codex-api-key:stable-001")
	if err != nil || status == nil || !status.Blocked {
		t.Fatalf("status = %#v, err = %v", status, err)
	}
	events, err := client.ListRateLimitEvents("codex-api-key:stable-001", 10)
	if err != nil || len(events) != 1 || !events[0].Blocked {
		t.Fatalf("events = %#v, err = %v", events, err)
	}
}

func TestProjectCandidatePoolRuleClientCRUD(t *testing.T) {
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		switch {
		case method == "GET" && path == "/v0/management/gettokens/project-candidate-pool-rules":
			if got := query.Get("channel"); got != "codex" {
				t.Fatalf("unexpected channel query: %s", got)
			}
			return []byte(`{"items":[{"id":"pcp-1","channel":"codex","projectKey":"workspace:abc","projectName":"GetTokens","projectKeySource":"codex-turn-workspace","projectKeyConfidence":"strong","enabled":true,"allowAccountIDs":["auth-a"],"createdAt":"2026-06-07T00:00:00Z","updatedAt":"2026-06-07T00:00:00Z"}]}`), 200, nil
		case method == "POST" && path == "/v0/management/gettokens/project-candidate-pool-rules":
			if contentType != "application/json" {
				t.Fatalf("unexpected content type: %s", contentType)
			}
			payload, err := io.ReadAll(body)
			if err != nil {
				t.Fatalf("read project candidate pool payload: %v", err)
			}
			if !strings.Contains(string(payload), `"projectKey":"workspace:abc"`) || !strings.Contains(string(payload), `"allowAccountIDs":["auth-a","auth-b"]`) {
				t.Fatalf("unexpected payload: %s", payload)
			}
			return []byte(`{"items":[{"id":"pcp-1","channel":"codex","projectKey":"workspace:abc","enabled":true,"allowAccountIDs":["auth-a","auth-b"]}]}`), 200, nil
		case method == "PUT" && path == "/v0/management/gettokens/project-candidate-pool-rules/pcp-1":
			assertJSONContains(t, body, `"enabled":false`)
			return []byte(`{"items":[{"id":"pcp-1","channel":"codex","projectKey":"workspace:abc","enabled":false,"allowAccountIDs":[]}]}`), 200, nil
		case method == "DELETE" && path == "/v0/management/gettokens/project-candidate-pool-rules/pcp-1":
			return []byte(`{"ok":true}`), 200, nil
		default:
			t.Fatalf("unexpected request: %s %s", method, path)
		}
		return nil, 404, nil
	})

	rules, err := client.ListProjectCandidatePoolRules("codex")
	if err != nil || len(rules) != 1 || rules[0].ProjectKey != "workspace:abc" || len(rules[0].AllowAccountIDs) != 1 {
		t.Fatalf("rules = %#v, err = %v", rules, err)
	}
	created, err := client.CreateProjectCandidatePoolRule(ProjectCandidatePoolRule{
		Channel:              "codex",
		ProjectKey:           "workspace:abc",
		ProjectName:          "GetTokens",
		ProjectKeySource:     "codex-turn-workspace",
		ProjectKeyConfidence: "strong",
		Enabled:              true,
		AllowAccountIDs:      []string{"auth-a", "auth-b"},
	})
	if err != nil || len(created) != 1 || !created[0].Enabled {
		t.Fatalf("created = %#v, err = %v", created, err)
	}
	updated, err := client.UpdateProjectCandidatePoolRule(ProjectCandidatePoolRule{
		ID:              "pcp-1",
		Channel:         "codex",
		ProjectKey:      "workspace:abc",
		Enabled:         false,
		AllowAccountIDs: []string{},
	})
	if err != nil || len(updated) != 1 || updated[0].Enabled {
		t.Fatalf("updated = %#v, err = %v", updated, err)
	}
	if err := client.DeleteProjectCandidatePoolRule("pcp-1"); err != nil {
		t.Fatalf("delete project candidate pool rule: %v", err)
	}
}

func TestAccountStoreDiagnosticsClient(t *testing.T) {
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		if method != "GET" || path != "/v0/management/gettokens/account-store-diagnostics" {
			t.Fatalf("unexpected request: %s %s", method, path)
		}
		return []byte(`{"path_basename":"accounts-v1.sqlite","configured":true,"open":true,"read_recovery":{"count":2,"last_endpoint":"accounts","last_recovered":true,"last_error":"query accounts: disk I/O error (522)","last_recovered_at_unix_ms":1780460000000}}`), 200, nil
	})

	diagnostics, err := client.GetAccountStoreDiagnostics()
	if err != nil {
		t.Fatalf("GetAccountStoreDiagnostics: %v", err)
	}
	if diagnostics.PathBasename != "accounts-v1.sqlite" || !diagnostics.Open || diagnostics.ReadRecovery.Count != 2 {
		t.Fatalf("diagnostics = %+v", diagnostics)
	}
	if diagnostics.ReadRecovery.LastEndpoint != "accounts" || !strings.Contains(diagnostics.ReadRecovery.LastError, "disk I/O error (522)") {
		t.Fatalf("diagnostics recovery = %+v", diagnostics.ReadRecovery)
	}
}

func TestQuotaRuntimeClientStatus(t *testing.T) {
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		switch {
		case method == "PUT" && path == "/v0/management/gettokens/quota-status/acct_00000000-0000-4000-8000-000000000001":
			if contentType != "application/json" {
				t.Fatalf("unexpected content type: %s", contentType)
			}
			assertJSONContains(t, body, `"plan_type":"plus"`)
			return []byte(`{"account_key":"acct_00000000-0000-4000-8000-000000000001","status":"success","plan_type":"plus","windows":[{"id":"five-hour","remaining_percent":0,"reset_at_unix":1893456000}],"blocked":true,"sources":[{"source":"quota-empty","reason":"quota empty"}]}`), 200, nil
		case method == "GET" && path == "/v0/management/gettokens/quota-status":
			if got := query.Get("account_key"); got != "acct_00000000-0000-4000-8000-000000000001" {
				t.Fatalf("unexpected quota account_key query: %s", got)
			}
			return []byte(`{"account_key":"acct_00000000-0000-4000-8000-000000000001","status":"success","windows":[],"sources":[]}`), 200, nil
		default:
			t.Fatalf("unexpected request: %s %s", method, path)
		}
		return nil, 404, nil
	})

	remaining := 0
	status, err := client.UpsertQuotaStatus("acct_00000000-0000-4000-8000-000000000001", QuotaRuntimeState{
		Status:   "success",
		PlanType: "plus",
		Windows:  []QuotaRuntimeWindow{{ID: "five-hour", RemainingPercent: &remaining, ResetAtUnix: 1893456000}},
	})
	if err != nil || status == nil || !status.Blocked || status.Sources[0].Source != "quota-empty" {
		t.Fatalf("UpsertQuotaStatus = %#v, err = %v", status, err)
	}
	status, err = client.GetQuotaStatus("acct_00000000-0000-4000-8000-000000000001")
	if err != nil || status == nil || status.AccountKey == "" {
		t.Fatalf("GetQuotaStatus = %#v, err = %v", status, err)
	}
}

func TestQuotaRuntimeClientStatusesUsesSingleBatchRead(t *testing.T) {
	var requestCount int
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		requestCount++
		if method != "GET" || path != "/v0/management/gettokens/quota-status" {
			t.Fatalf("unexpected request: %s %s", method, path)
		}
		want := "acct_00000000-0000-4000-8000-000000000001,acct_00000000-0000-4000-8000-000000000002"
		if got := query.Get("account_keys"); got != want {
			t.Fatalf("account_keys query = %q, want %q", got, want)
		}
		return []byte(`{"items":[{"account_key":"acct_00000000-0000-4000-8000-000000000001","status":"success","plan_type":"pro","windows":[],"sources":[]},{"account_key":"acct_00000000-0000-4000-8000-000000000002","status":"stale","windows":[],"sources":[]}]}`), 200, nil
	})

	statuses, err := client.GetQuotaStatuses([]string{
		"acct_00000000-0000-4000-8000-000000000001",
		"",
		"acct_00000000-0000-4000-8000-000000000002",
	})
	if err != nil {
		t.Fatalf("GetQuotaStatuses: %v", err)
	}
	if requestCount != 1 {
		t.Fatalf("requestCount = %d, want 1", requestCount)
	}
	if len(statuses) != 2 || statuses[0].PlanType != "pro" || statuses[1].Status != "stale" {
		t.Fatalf("statuses = %#v", statuses)
	}

	empty, err := client.GetQuotaStatuses([]string{"", "  "})
	if err != nil {
		t.Fatalf("GetQuotaStatuses empty: %v", err)
	}
	if len(empty) != 0 {
		t.Fatalf("empty statuses = %#v, want empty slice", empty)
	}
	if requestCount != 1 {
		t.Fatalf("empty input should not call sidecar, requestCount = %d", requestCount)
	}
}

func TestQuotaRefreshClientEndpoints(t *testing.T) {
	var gotRefreshPayload string
	var gotBatchPayload string
	var gotJobPayload string
	var gotQuotaTestPayload string
	var gotBillingTestPayload string
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		switch {
		case method == "POST" && path == "/v0/management/gettokens/quota-refresh/acct_00000000-0000-4000-8000-000000000001":
			payload, _ := io.ReadAll(body)
			gotRefreshPayload = string(payload)
			return []byte(`{"account_key":"acct_00000000-0000-4000-8000-000000000001","status":"success","plan_type":"pro","windows":[],"sources":[]}`), 200, nil
		case method == "POST" && path == "/v0/management/gettokens/quota-refresh-batch":
			payload, _ := io.ReadAll(body)
			gotBatchPayload = string(payload)
			return []byte(`{"items":[{"account_key":"acct_00000000-0000-4000-8000-000000000001","status":"success","plan_type":"pro","windows":[],"sources":[]}],"errors":[{"account_key":"acct_00000000-0000-4000-8000-000000000002","error":"quota curl missing"}],"succeeded":1,"failed":1}`), 200, nil
		case method == "POST" && path == "/v0/management/gettokens/quota-refresh-batch/jobs":
			payload, _ := io.ReadAll(body)
			gotJobPayload = string(payload)
			return []byte(`{"job_id":"job_1","status":"running","total":2,"pending":0,"running":2,"succeeded":0,"failed":0,"items":[],"errors":[]}`), 202, nil
		case method == "GET" && path == "/v0/management/gettokens/quota-refresh-batch/jobs/job_1":
			return []byte(`{"job_id":"job_1","status":"succeeded","total":2,"pending":0,"running":0,"succeeded":1,"failed":0,"items":[{"account_key":"acct_00000000-0000-4000-8000-000000000001","status":"success","plan_type":"pro","windows":[],"sources":[]}],"errors":[]}`), 200, nil
		case method == "POST" && path == "/v0/management/gettokens/quota-test":
			payload, _ := io.ReadAll(body)
			gotQuotaTestPayload = string(payload)
			return []byte(`{"status":"success","plan_type":"pro","windows":[{"id":"five-hour","remaining_percent":88}],"sources":[]}`), 200, nil
		case method == "POST" && path == "/v0/management/gettokens/billing-test":
			payload, _ := io.ReadAll(body)
			gotBillingTestPayload = string(payload)
			return []byte(`{"status":"success","windows":[],"billing":{"is_available":true,"balance_infos":[{"currency":"USD","granted_balance":"12.00"}]},"sources":[]}`), 200, nil
		default:
			t.Fatalf("unexpected request: %s %s", method, path)
		}
		return nil, 404, nil
	})

	status, err := client.RefreshQuota("acct_00000000-0000-4000-8000-000000000001", true, false)
	if err != nil || status == nil || status.PlanType != "pro" {
		t.Fatalf("RefreshQuota = %#v, err = %v", status, err)
	}
	if !strings.Contains(gotRefreshPayload, `"include_billing":true`) {
		t.Fatalf("refresh payload = %s, want include_billing", gotRefreshPayload)
	}

	batch, err := client.RefreshQuotaBatch(QuotaRefreshBatchInput{
		AccountKeys:    []string{"acct_00000000-0000-4000-8000-000000000001", "acct_00000000-0000-4000-8000-000000000002"},
		IncludeBilling: true,
		Concurrency:    4,
	})
	if err != nil || batch == nil || batch.Succeeded != 1 || batch.Failed != 1 || len(batch.Items) != 1 || len(batch.Errors) != 1 {
		t.Fatalf("RefreshQuotaBatch = %#v, err = %v", batch, err)
	}
	if !strings.Contains(gotBatchPayload, `"account_keys":["acct_00000000-0000-4000-8000-000000000001","acct_00000000-0000-4000-8000-000000000002"]`) ||
		!strings.Contains(gotBatchPayload, `"include_billing":true`) ||
		!strings.Contains(gotBatchPayload, `"concurrency":4`) {
		t.Fatalf("batch refresh payload = %s", gotBatchPayload)
	}

	job, err := client.StartQuotaRefreshBatchJob(QuotaRefreshBatchInput{
		AccountKeys:    []string{"acct_00000000-0000-4000-8000-000000000001", "acct_00000000-0000-4000-8000-000000000002"},
		IncludeBilling: true,
		Concurrency:    4,
	})
	if err != nil || job == nil || job.JobID != "job_1" || job.Status != "running" {
		t.Fatalf("StartQuotaRefreshBatchJob = %#v, err = %v", job, err)
	}
	if !strings.Contains(gotJobPayload, `"account_keys":["acct_00000000-0000-4000-8000-000000000001","acct_00000000-0000-4000-8000-000000000002"]`) ||
		!strings.Contains(gotJobPayload, `"include_billing":true`) ||
		!strings.Contains(gotJobPayload, `"concurrency":4`) {
		t.Fatalf("job payload = %s", gotJobPayload)
	}
	job, err = client.GetQuotaRefreshBatchJob("job_1")
	if err != nil || job == nil || job.Status != "succeeded" || job.Succeeded != 1 || len(job.Items) != 1 {
		t.Fatalf("GetQuotaRefreshBatchJob = %#v, err = %v", job, err)
	}

	status, err = client.TestQuotaCurl(QuotaCurlTestInput{
		APIKey:         "sk-test",
		BaseURL:        "https://quota.example.com",
		QuotaCurl:      "curl https://quota.example.com/usage -b {{platformCookie}}",
		PlatformCookie: "cookie-a",
	})
	if err != nil || status == nil || len(status.Windows) != 1 {
		t.Fatalf("TestQuotaCurl = %#v, err = %v", status, err)
	}
	if !strings.Contains(gotQuotaTestPayload, `"quota_curl":"curl https://quota.example.com/usage -b {{platformCookie}}"`) || !strings.Contains(gotQuotaTestPayload, `"platform_cookie":"cookie-a"`) {
		t.Fatalf("quota-test payload = %s", gotQuotaTestPayload)
	}

	status, err = client.TestBillingCurl(QuotaCurlTestInput{
		APIKey:         "sk-test",
		BaseURL:        "https://quota.example.com",
		BillingCurl:    "curl https://quota.example.com/billing -b {{platformCookie}}",
		PlatformCookie: "cookie-b",
	})
	if err != nil || status == nil || status.Billing == nil || !status.Billing.IsAvailable {
		t.Fatalf("TestBillingCurl = %#v, err = %v", status, err)
	}
	if !strings.Contains(gotBillingTestPayload, `"billing_curl":"curl https://quota.example.com/billing -b {{platformCookie}}"`) || !strings.Contains(gotBillingTestPayload, `"platform_cookie":"cookie-b"`) {
		t.Fatalf("billing-test payload = %s", gotBillingTestPayload)
	}
}

func assertJSONContains(t *testing.T, body io.Reader, want string) {
	t.Helper()
	payload, err := io.ReadAll(body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	if !strings.Contains(string(payload), want) {
		t.Fatalf("payload %s does not contain %s", payload, want)
	}
}
