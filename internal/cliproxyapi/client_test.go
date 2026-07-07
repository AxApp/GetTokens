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

func TestOpenAIQuotaResetCreditClientEndpoints(t *testing.T) {
	var requests []string
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		requests = append(requests, method+" "+path)
		switch method + " " + path {
		case "GET /v0/management/gettokens/openai-quota-reset/acct_00000000-0000-4000-8000-000000000001":
			if query != nil && len(query) > 0 {
				t.Fatalf("query should be empty: %#v", query)
			}
			return []byte(`{"account_key":"acct_00000000-0000-4000-8000-000000000001","status":"success","available_count":2,"plan_type":"pro","fetched_at":1781760000,"quota_state":{"account_key":"acct_00000000-0000-4000-8000-000000000001","status":"success","windows":[],"sources":[],"blocked":false}}`), 200, nil
		case "POST /v0/management/gettokens/openai-quota-reset/acct_00000000-0000-4000-8000-000000000001/consume":
			if contentType != "application/json" {
				t.Fatalf("content type = %q", contentType)
			}
			assertJSONContains(t, body, `{}`)
			return []byte(`{"account_key":"acct_00000000-0000-4000-8000-000000000001","status":"success","code":"success","windows_reset":2,"available_count":1,"credit":{"status":"redeemed","redeemed_at":"2026-06-18T04:24:50Z"},"quota_state":{"account_key":"acct_00000000-0000-4000-8000-000000000001","status":"success","windows":[],"sources":[],"blocked":false},"post_reset_refresh_status":"success"}`), 200, nil
		default:
			t.Fatalf("unexpected request: %s %s", method, path)
		}
		return nil, 404, nil
	})

	info, err := client.GetOpenAIQuotaResetCredit(" acct_00000000-0000-4000-8000-000000000001 ")
	if err != nil {
		t.Fatalf("GetOpenAIQuotaResetCredit returned error: %v", err)
	}
	if info.AccountKey == "" || info.AvailableCount != 2 || info.QuotaState == nil || info.QuotaState.Windows == nil || info.QuotaState.Sources == nil {
		t.Fatalf("unexpected reset info: %#v", info)
	}

	result, err := client.ConsumeOpenAIQuotaResetCredit("acct_00000000-0000-4000-8000-000000000001")
	if err != nil {
		t.Fatalf("ConsumeOpenAIQuotaResetCredit returned error: %v", err)
	}
	if result.Status != "success" || result.WindowsReset != 2 || result.Credit == nil || result.Credit.RedeemedAt == "" || result.QuotaState == nil {
		t.Fatalf("unexpected reset result: %#v", result)
	}
	if strings.Join(requests, "\n") != "GET /v0/management/gettokens/openai-quota-reset/acct_00000000-0000-4000-8000-000000000001\nPOST /v0/management/gettokens/openai-quota-reset/acct_00000000-0000-4000-8000-000000000001/consume" {
		t.Fatalf("requests = %#v", requests)
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
		case method == "POST" && path == "/v0/management/accounts/batch-create":
			assertJSONContains(t, body, `"accounts":[{"kind":"codex-api-key"`)
			return []byte(`{"accounts":[{"account_key":"acct_00000000-0000-4000-8000-000000000003","kind":"codex-api-key","title":"Batch Created","provider":"codex"}],"skipped":[],"errors":[],"succeeded":1,"skipped_count":0,"failed":0}`), 200, nil
		case method == "POST" && path == "/v0/management/accounts/batch-preview":
			assertJSONContains(t, body, `"accounts":[{"kind":"auth-file"`)
			return []byte(`{"items":[{"index":0,"title":"auth.json","action":"skip","reason":"existing_account","existing_account_key":"acct_00000000-0000-4000-8000-000000000001"}],"skipped":[{"index":0,"title":"auth.json","reason":"existing_account","existing_account_key":"acct_00000000-0000-4000-8000-000000000001"}],"errors":[],"would_create":0,"skipped_count":1,"failed":0}`), 200, nil
		case method == "PATCH" && path == "/v0/management/accounts/acct_00000000-0000-4000-8000-000000000001":
			assertJSONContains(t, body, `"title":"Updated"`)
			return []byte(`{"account_key":"acct_00000000-0000-4000-8000-000000000001","kind":"codex-api-key","title":"Updated","provider":"codex"}`), 200, nil
		case method == "PATCH" && path == "/v0/management/accounts/acct_00000000-0000-4000-8000-000000000001/status":
			assertJSONContains(t, body, `"disabled":true`)
			return []byte(`{"account_key":"acct_00000000-0000-4000-8000-000000000001","kind":"codex-api-key","disabled":true}`), 200, nil
		case method == "POST" && path == "/v0/management/accounts/batch-status":
			payload, err := io.ReadAll(body)
			if err != nil {
				t.Fatalf("read body: %v", err)
			}
			if !strings.Contains(string(payload), `"account_keys":["acct_00000000-0000-4000-8000-000000000001","acct_00000000-0000-4000-8000-000000000002"]`) ||
				!strings.Contains(string(payload), `"disabled":true`) {
				t.Fatalf("unexpected payload: %s", payload)
			}
			return []byte(`{"updated_account_keys":["acct_00000000-0000-4000-8000-000000000001"],"errors":[{"account_key":"acct_00000000-0000-4000-8000-000000000002","error":"account not found"}],"succeeded":1,"failed":1}`), 200, nil
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
	created, supported, err := client.CreateAccountsBatch(AccountBatchCreateInput{Accounts: []AccountWriteRequest{{Kind: AccountKindCodexAPIKey, Title: "Batch Created"}}})
	if err != nil || !supported || created == nil || created.Succeeded != 1 || created.SkippedCount != 0 || created.Failed != 0 || len(created.Accounts) != 1 || len(created.Skipped) != 0 || len(created.Errors) != 0 {
		t.Fatalf("CreateAccountsBatch = %#v supported=%v err=%v", created, supported, err)
	}
	preview, supported, err := client.PreviewCreateAccountsBatch(AccountBatchCreateInput{Accounts: []AccountWriteRequest{{Kind: AccountKindAuthFile, Title: "auth.json"}}})
	if err != nil || !supported || preview == nil || preview.WouldCreate != 0 || preview.SkippedCount != 1 || preview.Failed != 0 || len(preview.Items) != 1 || len(preview.Skipped) != 1 || len(preview.Errors) != 0 {
		t.Fatalf("PreviewCreateAccountsBatch = %#v supported=%v err=%v", preview, supported, err)
	}
	if account, err := client.PatchAccount("acct_00000000-0000-4000-8000-000000000001", AccountWriteRequest{Kind: AccountKindCodexAPIKey, Title: "Updated"}); err != nil || account.Title != "Updated" {
		t.Fatalf("PatchAccount = %#v, err = %v", account, err)
	}
	if account, err := client.PatchAccountStatus("acct_00000000-0000-4000-8000-000000000001", true); err != nil || !account.Disabled {
		t.Fatalf("PatchAccountStatus = %#v, err = %v", account, err)
	}
	status, err := client.PatchAccountsStatusBatch(AccountBatchStatusInput{
		AccountKeys: []string{"acct_00000000-0000-4000-8000-000000000001", "acct_00000000-0000-4000-8000-000000000002"},
		Disabled:    true,
	})
	if err != nil || status == nil || status.Succeeded != 1 || status.Failed != 1 || len(status.UpdatedAccountKeys) != 1 || len(status.Errors) != 1 {
		t.Fatalf("PatchAccountsStatusBatch = %#v, err = %v", status, err)
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

func TestDoctorDiagnosticsClientReadsSidecarSnapshot(t *testing.T) {
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		if method != "GET" {
			t.Fatalf("expected GET, got %s", method)
		}
		if path != "/v0/management/gettokens/doctor-diagnostics" {
			t.Fatalf("unexpected path: %s", path)
		}
		return []byte(`{
			"authority":"sidecar",
			"source":"sidecar-diagnostics",
			"generatedAt":"2026-06-17T08:00:00Z",
			"summary":{"status":"warning","total":2,"ok":0,"notReady":0,"warning":2,"blocking":0,"evidence":2},
			"checks":[
				{
					"id":"route_guard_dropped_reasons",
					"status":"warning",
					"reason":"Active route guard dropped reason evidence is present.",
					"repairability":"read_only",
					"evidence":[
						{
							"kind":"route_dropped_reason",
							"accountKey":"acct_route_001",
							"authId":"auth_route_001",
							"source":"upstream-rate-limit",
							"scope":"account",
							"model":"gpt-5",
							"reason":"upstream 429 active cooldown",
							"routeBlocking":true,
							"droppedReason":{
								"accountKey":"acct_route_001",
								"accountId":"acct_route_001",
								"authId":"auth_route_001",
								"source":"upstream-rate-limit",
								"scope":"account",
								"reason":"upstream 429 active cooldown",
								"model":"gpt-5",
								"routeBlocking":true
							}
						}
					]
				},
				{
					"id":"quota_facts",
					"status":"warning",
					"reason":"Quota runtime facts are available from sidecar runtime state.",
					"repairability":"read_only",
					"evidence":[
						{
							"kind":"quota_fact",
							"accountKey":"acct_quota_001",
							"source":"quota-curl",
							"state":"denied",
							"freshness":"fresh",
							"confidence":"high",
							"risk":"denied",
							"explanation":"Provider denied quota check",
							"evidenceRefs":["quota-status:acct_quota_001"],
							"quotaFact":{
								"state":"denied",
								"source":"quota-curl",
								"freshness":"fresh",
								"confidence":"high",
								"risk":"denied",
								"explanation":"Provider denied quota check",
								"observed_at":"2026-06-17T08:00:00Z",
								"evidence_refs":["quota-status:acct_quota_001"]
							}
						}
					]
				}
			]
		}`), 200, nil
	})

	response, supported, err := client.GetDoctorDiagnostics()
	if err != nil {
		t.Fatalf("GetDoctorDiagnostics returned error: %v", err)
	}
	if !supported {
		t.Fatal("supported = false, want true")
	}
	if response == nil {
		t.Fatal("response = nil, want non-nil")
	}
	if response.Authority != "sidecar" || response.Source != "sidecar-diagnostics" || response.GeneratedAt != "2026-06-17T08:00:00Z" {
		t.Fatalf("unexpected response core: %#v", response)
	}
	if response.Summary.Status != "warning" || response.Summary.Total != 2 || response.Summary.Warning != 2 || response.Summary.Evidence != 2 {
		t.Fatalf("unexpected summary: %#v", response.Summary)
	}
	if len(response.Checks) != 2 {
		t.Fatalf("checks = %#v, want 2", response.Checks)
	}
	if response.Checks[0].ID != "route_guard_dropped_reasons" || len(response.Checks[0].Evidence) != 1 {
		t.Fatalf("route check = %#v, want one route evidence", response.Checks[0])
	}
	route := response.Checks[0].Evidence[0]
	if route.DroppedReason == nil || route.DroppedReason.AccountKey != "acct_route_001" || route.DroppedReason.AccountID != "acct_route_001" || route.DroppedReason.AuthID != "auth_route_001" || route.DroppedReason.Model != "gpt-5" || !route.DroppedReason.RouteBlocking {
		t.Fatalf("route nested dropped reason = %#v, want preserved typed route evidence", route.DroppedReason)
	}
	if response.Checks[1].ID != "quota_facts" || len(response.Checks[1].Evidence) != 1 {
		t.Fatalf("quota check = %#v, want one quota evidence", response.Checks[1])
	}
	quota := response.Checks[1].Evidence[0]
	if quota.AccountKey != "acct_quota_001" || quota.State != "denied" || quota.Risk != "denied" || quota.QuotaFact == nil || quota.QuotaFact.State != "denied" {
		t.Fatalf("quota evidence = %#v, want preserved quota fact", quota)
	}
	if quota.QuotaFact.ObservedAt != "2026-06-17T08:00:00Z" || len(quota.QuotaFact.EvidenceRefs) != 1 || quota.QuotaFact.EvidenceRefs[0] != "quota-status:acct_quota_001" {
		t.Fatalf("quota nested fact = %#v, want sidecar snake_case fields decoded", quota.QuotaFact)
	}
}

func TestDoctorDiagnosticsClientReturnsUnsupportedOn404And501(t *testing.T) {
	for _, status := range []int{404, 501} {
		client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			return []byte(`{"error":"unsupported"}`), status, nil
		})

		response, supported, err := client.GetDoctorDiagnostics()
		if err != nil {
			t.Fatalf("status %d GetDoctorDiagnostics returned error: %v", status, err)
		}
		if supported {
			t.Fatalf("status %d supported = true, want false", status)
		}
		if response != nil {
			t.Fatalf("status %d response = %#v, want nil", status, response)
		}
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
			return []byte(`{"account_key":"acct_00000000-0000-4000-8000-000000000001","status":"success","plan_type":"plus","windows":[{"id":"five-hour","remaining_percent":0,"reset_at_unix":1893456000}],"blocked":true,"sources":[{"source":"quota-empty","reason":"quota empty"}],"fact":{"state":"stale","source":"legacy-fact","freshness":"stale","confidence":"low","risk":"warning","explanation":"legacy fact should not win","observed_at":"2026-06-16T07:00:00Z","evidence_refs":["legacy:fact"]},"quotaFact":{"state":"no_quota","source":"quota-runtime","freshness":"fresh","confidence":"high","risk":"blocking","explanation":"five-hour exhausted","observedAt":"2026-06-16T08:00:00Z","expiresAt":"2026-06-16T13:00:00Z","evidenceRefs":["window:five-hour","guard:quota-empty"]}}`), 200, nil
		case method == "GET" && path == "/v0/management/gettokens/quota-status":
			if got := query.Get("account_key"); got != "acct_00000000-0000-4000-8000-000000000001" {
				t.Fatalf("unexpected quota account_key query: %s", got)
			}
			return []byte(`{"account_key":"acct_00000000-0000-4000-8000-000000000001","status":"success","windows":[],"sources":[],"fact":{"state":"available","source":"quota-status","freshness":"fresh","confidence":"medium","risk":"none","explanation":"billing evidence","observed_at":"2026-06-16T08:01:00Z","expires_at":"2026-06-16T13:01:00Z","evidence_refs":["billing:balance"]}}`), 200, nil
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
	if status.Fact == nil || status.Fact.State != "no_quota" || status.Fact.ObservedAt != "2026-06-16T08:00:00Z" || len(status.Fact.EvidenceRefs) != 2 {
		t.Fatalf("UpsertQuotaStatus fact = %#v, want parsed sidecar fact", status.Fact)
	}
	if status.Fact.Source != "quota-runtime" || status.Fact.EvidenceRefs[0] != "window:five-hour" {
		t.Fatalf("UpsertQuotaStatus fact = %#v, want quotaFact to win over legacy fact", status.Fact)
	}
	status, err = client.GetQuotaStatus("acct_00000000-0000-4000-8000-000000000001")
	if err != nil || status == nil || status.AccountKey == "" {
		t.Fatalf("GetQuotaStatus = %#v, err = %v", status, err)
	}
	if status.Fact == nil || status.Fact.State != "available" || status.Fact.ExpiresAt != "2026-06-16T13:01:00Z" || status.Fact.EvidenceRefs[0] != "billing:balance" {
		t.Fatalf("GetQuotaStatus fact = %#v, want parsed sidecar fact", status.Fact)
	}
}

func TestQuotaUsageCalibrationClientEndpoints(t *testing.T) {
	var requests []string
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		requests = append(requests, method+" "+path)
		switch {
		case method == "GET" && path == "/v0/management/gettokens/quota-calibrations":
			if got := query.Get("account_key"); got != "acct_calibration_001" {
				t.Fatalf("account_key query = %q, want acct_calibration_001", got)
			}
			return []byte("{\"items\":[{\"id\":\"qcal_1\",\"account_key\":\"acct_calibration_001\",\"window_key\":\"five-hour\",\"metric\":\"tokens\",\"mode\":\"delta\",\"value\":1200,\"created_at\":\"2026-06-19T08:00:00Z\"}]}"), 200, nil
		case method == "POST" && path == "/v0/management/gettokens/quota-calibrations":
			if contentType != "application/json" {
				t.Fatalf("content type = %q", contentType)
			}
			payload, err := io.ReadAll(body)
			if err != nil {
				t.Fatalf("read body: %v", err)
			}
			if !strings.Contains(string(payload), "\"account_key\":\"acct_calibration_001\"") || !strings.Contains(string(payload), "\"mode\":\"set-effective\"") {
				t.Fatalf("payload = %s", payload)
			}
			return []byte("{\"id\":\"qcal_2\",\"account_key\":\"acct_calibration_001\",\"window_key\":\"five-hour\",\"metric\":\"tokens\",\"mode\":\"set-effective\",\"value\":9000,\"created_at\":\"2026-06-19T08:05:00Z\"}"), 200, nil
		case method == "POST" && path == "/v0/management/gettokens/quota-calibrations/qcal_2/revoke":
			return []byte("{\"id\":\"qcal_2\",\"account_key\":\"acct_calibration_001\",\"window_key\":\"five-hour\",\"metric\":\"tokens\",\"mode\":\"set-effective\",\"value\":9000,\"created_at\":\"2026-06-19T08:05:00Z\",\"revoked_at\":\"2026-06-19T08:06:00Z\"}"), 200, nil
		default:
			t.Fatalf("unexpected request: %s %s", method, path)
		}
		return nil, 404, nil
	})

	items, err := client.ListQuotaCalibrations(" acct_calibration_001 ")
	if err != nil || len(items) != 1 || items[0].ID != "qcal_1" || items[0].Value != 1200 {
		t.Fatalf("ListQuotaCalibrations = %#v, err = %v", items, err)
	}

	created, err := client.AddQuotaCalibration(QuotaUsageCalibration{
		AccountKey: "acct_calibration_001",
		WindowKey:  "five-hour",
		Metric:     "tokens",
		Mode:       "set-effective",
		Value:      9000,
	})
	if err != nil || created == nil || created.ID != "qcal_2" || created.Mode != "set-effective" {
		t.Fatalf("AddQuotaCalibration = %#v, err = %v", created, err)
	}

	revoked, err := client.RevokeQuotaCalibration(" qcal_2 ")
	if err != nil || revoked == nil || revoked.RevokedAt == "" {
		t.Fatalf("RevokeQuotaCalibration = %#v, err = %v", revoked, err)
	}

	if strings.Join(requests, "\n") != "GET /v0/management/gettokens/quota-calibrations\nPOST /v0/management/gettokens/quota-calibrations\nPOST /v0/management/gettokens/quota-calibrations/qcal_2/revoke" {
		t.Fatalf("requests = %#v", requests)
	}
}

func TestBudgetWindowDefinitionClientEndpoints(t *testing.T) {
	var requests []string
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		requests = append(requests, method+" "+path)
		switch {
		case method == "GET" && path == "/v0/management/gettokens/budget-window-definitions":
			return []byte(`{"items":[{"id":"tokens_daily","kind":"daily","metric":"tokens","limit":100,"timezone":"Asia/Shanghai","enabled":true}]}`), 200, nil
		case method == "POST" && path == "/v0/management/gettokens/budget-window-definitions":
			if contentType != "application/json" {
				t.Fatalf("content type = %q", contentType)
			}
			payload, _ := io.ReadAll(body)
			if !strings.Contains(string(payload), `"id":"tokens_daily"`) || !strings.Contains(string(payload), `"timezone":"Asia/Shanghai"`) {
				t.Fatalf("create payload = %s", payload)
			}
			return []byte(`{"items":[{"id":"tokens_daily","kind":"daily","metric":"tokens","limit":100,"timezone":"Asia/Shanghai","enabled":true}]}`), 200, nil
		case method == "PUT" && path == "/v0/management/gettokens/budget-window-definitions/tokens_daily":
			return []byte(`{"items":[{"id":"tokens_daily","kind":"multi-day","semantics":"calendar","days":7,"metric":"tokens","limit":700,"timezone":"Asia/Shanghai","enabled":true}]}`), 200, nil
		case method == "DELETE" && path == "/v0/management/gettokens/budget-window-definitions/tokens_daily":
			return []byte(`{"items":[{"id":"tokens_daily","kind":"multi-day","semantics":"calendar","days":7,"metric":"tokens","limit":700,"timezone":"Asia/Shanghai","enabled":false}]}`), 200, nil
		case method == "POST" && path == "/v0/management/gettokens/budget-window-definitions/preview":
			payload, _ := io.ReadAll(body)
			if !strings.Contains(string(payload), `"account_key":"acct_budget_001"`) || !strings.Contains(string(payload), `"definitions"`) {
				t.Fatalf("preview payload = %s", payload)
			}
			return []byte(`{"items":[{"windowId":"tokens_daily","kind":"daily","metric":"tokens","startsAt":"2026-06-19T16:00:00Z","endsAt":"2026-06-20T16:00:00Z","observedUsed":80,"observedLimit":100,"observedRemaining":20,"rawUsed":70,"calibrationDelta":10,"status":"fresh","source":"usage-aggregator"}]}`), 200, nil
		default:
			t.Fatalf("unexpected request: %s %s", method, path)
		}
		return nil, 404, nil
	})

	items, err := client.ListBudgetWindowDefinitions()
	if err != nil || len(items) != 1 || items[0].ID != "tokens_daily" {
		t.Fatalf("ListBudgetWindowDefinitions = %#v, err = %v", items, err)
	}
	items, err = client.CreateBudgetWindowDefinition(BudgetWindowDefinition{ID: "tokens_daily", Kind: "daily", Metric: "tokens", Limit: 100, Timezone: "Asia/Shanghai", Enabled: true})
	if err != nil || len(items) != 1 || !items[0].Enabled {
		t.Fatalf("CreateBudgetWindowDefinition = %#v, err = %v", items, err)
	}
	items, err = client.UpdateBudgetWindowDefinition(" tokens_daily ", BudgetWindowDefinition{ID: "tokens_daily", Kind: "multi-day", Semantics: "calendar", Days: 7, Metric: "tokens", Limit: 700, Timezone: "Asia/Shanghai", Enabled: true})
	if err != nil || len(items) != 1 || items[0].Days != 7 {
		t.Fatalf("UpdateBudgetWindowDefinition = %#v, err = %v", items, err)
	}
	items, err = client.DeleteBudgetWindowDefinition(" tokens_daily ")
	if err != nil || len(items) != 1 || items[0].Enabled {
		t.Fatalf("DeleteBudgetWindowDefinition = %#v, err = %v", items, err)
	}
	facts, err := client.PreviewBudgetWindowFacts(BudgetWindowFactsPreviewRequest{
		AccountKey: "acct_budget_001",
		Definitions: []BudgetWindowDefinition{{
			ID:       "tokens_daily",
			Kind:     "daily",
			Metric:   "tokens",
			Limit:    100,
			Timezone: "Asia/Shanghai",
			Enabled:  true,
		}},
	})
	if err != nil || len(facts) != 1 || facts[0].RawUsed != 70 || facts[0].CalibrationDelta != 10 {
		t.Fatalf("PreviewBudgetWindowFacts = %#v, err = %v", facts, err)
	}
	if strings.Join(requests, "\n") != "GET /v0/management/gettokens/budget-window-definitions\nPOST /v0/management/gettokens/budget-window-definitions\nPUT /v0/management/gettokens/budget-window-definitions/tokens_daily\nDELETE /v0/management/gettokens/budget-window-definitions/tokens_daily\nPOST /v0/management/gettokens/budget-window-definitions/preview" {
		t.Fatalf("requests = %#v", requests)
	}
}

func TestQuotaThresholdRuleClientEndpoints(t *testing.T) {
	var requests []string
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		requests = append(requests, method+" "+path)
		switch {
		case method == "GET" && path == "/v0/management/gettokens/quota-threshold-rules":
			if got := query.Get("account_key"); got != "acct_quota_threshold_001" {
				t.Fatalf("account_key query = %q, want acct_quota_threshold_001", got)
			}
			return []byte("{\"items\":[{\"id\":\"qtr_1\",\"account_key\":\"acct_quota_threshold_001\",\"window_key\":\"tokens_5h\",\"metric\":\"remaining-percent\",\"comparator\":\"<=\",\"threshold_percent\":20,\"condition\":{\"window_key\":\"tokens_5h\",\"metric\":\"remaining-percent\",\"value\":20},\"enabled\":true}]}"), 200, nil
		case method == "POST" && path == "/v0/management/gettokens/quota-threshold-rules":
			if contentType != "application/json" {
				t.Fatalf("content type = %q", contentType)
			}
			payload, err := io.ReadAll(body)
			if err != nil {
				t.Fatalf("read body: %v", err)
			}
			if !strings.Contains(string(payload), "\"window_key\":\"tokens_5h\"") || !strings.Contains(string(payload), "\"threshold_percent\":20") || !strings.Contains(string(payload), "\"condition\"") {
				t.Fatalf("payload = %s", payload)
			}
			return []byte("{\"items\":[{\"id\":\"qtr_1\",\"account_key\":\"acct_quota_threshold_001\",\"window_key\":\"tokens_5h\",\"metric\":\"remaining-percent\",\"comparator\":\"<=\",\"threshold_percent\":20,\"condition\":{\"window_key\":\"tokens_5h\",\"metric\":\"remaining-percent\",\"value\":20},\"enabled\":true}]}"), 200, nil
		case method == "PUT" && path == "/v0/management/gettokens/quota-threshold-rules/qtr_1":
			return []byte("{\"items\":[{\"id\":\"qtr_1\",\"account_key\":\"acct_quota_threshold_001\",\"window_key\":\"tokens_5h\",\"metric\":\"used-percent\",\"comparator\":\">=\",\"threshold_percent\":85,\"enabled\":true}]}"), 200, nil
		case method == "DELETE" && path == "/v0/management/gettokens/quota-threshold-rules/qtr_1":
			return []byte("{\"ok\":true}"), 200, nil
		default:
			t.Fatalf("unexpected request: %s %s", method, path)
		}
		return nil, 404, nil
	})

	listed, err := client.ListQuotaThresholdRules(" acct_quota_threshold_001 ")
	if err != nil || len(listed) != 1 || listed[0].ID != "qtr_1" || listed[0].ThresholdPercent != 20 {
		t.Fatalf("ListQuotaThresholdRules = %#v, err = %v", listed, err)
	}
	created, err := client.CreateQuotaThresholdRule(QuotaThresholdRule{
		AccountKey:       "acct_quota_threshold_001",
		WindowKey:        "tokens_5h",
		Metric:           "remaining-percent",
		ThresholdPercent: 20,
		Condition:        map[string]any{"window_key": "tokens_5h", "metric": "remaining-percent", "value": float64(20)},
		Enabled:          true,
	})
	if err != nil || len(created) != 1 || created[0].Comparator != "<=" || created[0].Condition["window_key"] != "tokens_5h" {
		t.Fatalf("CreateQuotaThresholdRule = %#v, err = %v", created, err)
	}
	updated, err := client.UpdateQuotaThresholdRule(" qtr_1 ", QuotaThresholdRule{
		AccountKey:       "acct_quota_threshold_001",
		WindowKey:        "tokens_5h",
		Metric:           "used-percent",
		ThresholdPercent: 85,
		Enabled:          true,
	})
	if err != nil || len(updated) != 1 || updated[0].Metric != "used-percent" || updated[0].Comparator != ">=" {
		t.Fatalf("UpdateQuotaThresholdRule = %#v, err = %v", updated, err)
	}
	if err := client.DeleteQuotaThresholdRule(" qtr_1 "); err != nil {
		t.Fatalf("DeleteQuotaThresholdRule: %v", err)
	}
	if strings.Join(requests, "\n") != "GET /v0/management/gettokens/quota-threshold-rules\nPOST /v0/management/gettokens/quota-threshold-rules\nPUT /v0/management/gettokens/quota-threshold-rules/qtr_1\nDELETE /v0/management/gettokens/quota-threshold-rules/qtr_1" {
		t.Fatalf("requests = %#v", requests)
	}
}

func TestRouteGuardSimulationClientPreservesTraceData(t *testing.T) {
	ruleID := "rule_1"
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		if method != "POST" || path != "/v0/management/route-guard/rules/simulate" {
			t.Fatalf("unexpected request: %s %s", method, path)
		}
		if contentType != "application/json" {
			t.Fatalf("content type = %q", contentType)
		}
		payload, err := io.ReadAll(body)
		if err != nil {
			t.Fatalf("read body: %v", err)
		}
		text := string(payload)
		for _, want := range []string{"\"ruleIds\":[\"rule_1\"]", "\"accountId\":\"acct_1\"", "\"quotaWindows\"", "\"windowId\":\"tokens_5h\"", "\"windowId\":\"tokens_1d\"", "\"calibrationLedger\""} {
			if !strings.Contains(text, want) {
				t.Fatalf("payload = %s, want %s", text, want)
			}
		}
		return []byte(`{"decision":"block","matchedRule":{"id":"rule_1","name":"Low quota block"},"accountTrace":{"accountId":"acct_1","source":"quota-threshold","reason":"remaining quota below threshold","reasonTrace":[{"code":"quota.remaining_percent.lt","message":"remaining percent below threshold","data":{"remainingPercent":0.08,"threshold":0.1,"window":"current"}}]},"recoveryAt":"2026-06-20T00:00:00Z","expiresAt":"2026-06-19T20:00:00Z"}`), 200, nil
	})

	result, err := client.SimulateRouteGuardRule(SimulateRouteGuardRuleRequest{
		RuleID: &ruleID,
		Facts: SimulationFacts{
			AccountID:          "acct_1",
			Now:                "2026-06-19T17:00:00Z",
			QuotaWindow:        &QuotaWindowFact{WindowID: "tokens_5h", StartsAt: "2026-06-19T00:00:00Z", EndsAt: "2026-06-20T00:00:00Z", ObservedUsed: 92, ObservedLimit: 100, ObservedRemaining: 8, Status: "fresh"},
			QuotaWindows:       []QuotaWindowFact{{WindowID: "tokens_1d", Kind: "daily", StartsAt: "2026-06-19T00:00:00Z", EndsAt: "2026-06-20T00:00:00Z", ObservedUsed: 91, ObservedLimit: 100, ObservedRemaining: 9, Status: "fresh"}},
			CalibrationEntries: []CalibrationFact{{ID: "cal_1", WindowID: "tokens_5h", Metric: "tokens", Mode: "delta", Value: 10, ExpiresAt: "2026-06-20T00:00:00Z"}},
		},
	})
	if err != nil {
		t.Fatalf("SimulateRouteGuardRule: %v", err)
	}
	if result.Decision != "block" || result.MatchedRule == nil || result.MatchedRule.ID != "rule_1" || result.RecoveryAt == nil || result.ExpiresAt == nil {
		t.Fatalf("result = %#v, want block with matched rule and recovery/expiry", result)
	}
	if len(result.AccountTrace.ReasonTrace) != 1 || result.AccountTrace.ReasonTrace[0].Code != "quota.remaining_percent.lt" {
		t.Fatalf("reason trace = %#v, want code preserved", result.AccountTrace.ReasonTrace)
	}
	if got := result.AccountTrace.ReasonTrace[0].Data["remainingPercent"]; got != float64(0.08) {
		t.Fatalf("remainingPercent data = %#v, want 0.08", got)
	}
}

func TestQuotaRuntimeClientDecodesQuotaFactAliasesWithoutLocalInference(t *testing.T) {
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		if method != "GET" || path != "/v0/management/gettokens/quota-status" {
			t.Fatalf("unexpected request: %s %s", method, path)
		}
		want := "acct_camel,acct_snake,acct_legacy,acct_missing"
		if got := query.Get("account_keys"); got != want {
			t.Fatalf("account_keys query = %q, want %q", got, want)
		}
		return []byte(`{"items":[
			{"account_key":"acct_camel","status":"success","windows":[],"sources":[],"quotaFact":{"state":"available","source":"quota-runtime","freshness":"fresh","confidence":"high","risk":"none","observedAt":"2026-06-17T08:00:00Z","evidenceRefs":["quota:camel"]}},
			{"account_key":"acct_snake","status":"success","windows":[],"sources":[],"quota_fact":{"state":"stale","source":"quota-runtime","freshness":"stale","confidence":"medium","risk":"warning","observed_at":"2026-06-17T08:01:00Z","evidence_refs":["quota:snake"]}},
			{"account_key":"acct_legacy","status":"success","windows":[],"sources":[],"fact":{"state":"denied","source":"quota-runtime","freshness":"fresh","confidence":"high","risk":"denied","observed_at":"2026-06-17T08:02:00Z","evidence_refs":["quota:legacy"]}},
			{"account_key":"acct_missing","status":"success","windows":[{"id":"weekly","remaining_percent":0}],"blocked":true,"block_reason":"quota empty: weekly","sources":[]}
		]}`), 200, nil
	})

	statuses, err := client.GetQuotaStatuses([]string{"acct_camel", "acct_snake", "acct_legacy", "acct_missing"})
	if err != nil {
		t.Fatalf("GetQuotaStatuses: %v", err)
	}
	if len(statuses) != 4 {
		t.Fatalf("statuses = %#v, want 4", statuses)
	}
	if statuses[0].Fact == nil || statuses[0].Fact.State != "available" || statuses[0].Fact.ObservedAt != "2026-06-17T08:00:00Z" || statuses[0].Fact.EvidenceRefs[0] != "quota:camel" {
		t.Fatalf("camel quotaFact = %#v, want explicit sidecar fact", statuses[0].Fact)
	}
	if statuses[1].Fact == nil || statuses[1].Fact.State != "stale" || statuses[1].Fact.ObservedAt != "2026-06-17T08:01:00Z" || statuses[1].Fact.EvidenceRefs[0] != "quota:snake" {
		t.Fatalf("snake quota_fact = %#v, want explicit sidecar fact", statuses[1].Fact)
	}
	if statuses[2].Fact == nil || statuses[2].Fact.State != "denied" || statuses[2].Fact.EvidenceRefs[0] != "quota:legacy" {
		t.Fatalf("legacy fact = %#v, want explicit sidecar fact", statuses[2].Fact)
	}
	if statuses[3].Fact != nil {
		t.Fatalf("missing fact = %#v, want no local authority inference from windows/block_reason", statuses[3].Fact)
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

func TestExplainChannelRoutingClientEndpoints(t *testing.T) {
	requests := 0
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		if method != "POST" || path != "/v0/management/gettokens/channel-routing/explain" {
			t.Fatalf("unexpected request: %s %s", method, path)
		}
		requests++
		assertJSONContains(t, body, `"channel":"codex"`)
		return []byte(`{
			"channel":"codex",
			"routeMode":"balanced",
			"selectedAccountID":"acct_company_1",
			"candidates":[{"id":"acct_company_1","displayName":"公司 1"}],
			"filtered":[{"id":"acct_checker","reason":"account-unrequestable"}],
			"steps":["mode:balanced"],
			"policyVersion":"channel-routing-sidecar-v1"
		}`), 200, nil
	})

	result, supported, err := client.ExplainChannelRouting(ChannelRoutingExplainInput{Channel: "codex"})
	if err != nil || !supported || result == nil {
		t.Fatalf("ExplainChannelRouting = %#v, supported=%v, err=%v", result, supported, err)
	}
	if requests != 1 || result.SelectedAccountID != "acct_company_1" || len(result.Candidates) != 1 {
		t.Fatalf("ExplainChannelRouting result = %#v, requests=%d", result, requests)
	}
}

func TestExplainChannelRoutingClientReturnsUnsupportedOn404(t *testing.T) {
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		return nil, 404, nil
	})

	result, supported, err := client.ExplainChannelRouting(ChannelRoutingExplainInput{Channel: "codex"})
	if err != nil {
		t.Fatalf("ExplainChannelRouting returned error: %v", err)
	}
	if supported || result != nil {
		t.Fatalf("ExplainChannelRouting = %#v, supported=%v, want unsupported nil", result, supported)
	}
}

func TestListChannelRoutingDecisionsClientEndpoints(t *testing.T) {
	requests := 0
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		if method != "GET" || path != "/v0/management/gettokens/channel-routing/decisions" {
			t.Fatalf("unexpected request: %s %s", method, path)
		}
		requests++
		if got := query.Get("channel"); got != "codex" {
			t.Fatalf("channel = %q, want codex", got)
		}
		if got := query.Get("limit"); got != "5" {
			t.Fatalf("limit = %q, want 5", got)
		}
		return []byte(`{"items":[{"id":"route-1","channel":"codex","selectedAccountID":"acct_company_1","trace":[{"stage":"request","activated":true}]}]}`), 200, nil
	})

	items, supported, err := client.ListChannelRoutingDecisions("codex", 5)
	if err != nil || !supported {
		t.Fatalf("ListChannelRoutingDecisions err=%v supported=%v", err, supported)
	}
	if requests != 1 || len(items) != 1 || items[0].SelectedAccountID != "acct_company_1" || len(items[0].Trace) != 1 {
		t.Fatalf("items = %#v, requests=%d", items, requests)
	}
}

func TestListChannelRoutingDecisionsClientAcceptsStructuredDroppedReasons(t *testing.T) {
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		return []byte(`{"items":[
			{"id":"route-camel","channel":"codex","candidateCount":0,"droppedReasons":[{"accountID":"acct_company_1","authID":"auth_company_1","source":"rate-limit","scope":"account","reason":"request window exhausted","model":"gpt-5","expiresAt":"2026-06-15T10:05:00Z","updatedAt":"2026-06-15T10:00:00Z","routeBlocking":true}]},
			{"id":"route-snake","channel":"codex","candidateCount":0,"dropped_reasons":[{"account_id":"acct_company_2","auth_id":"auth_company_2","source":"quota-empty","scope":"model","reason":"quota exhausted","model":"gpt-5-mini","expires_at":"2026-06-15T11:05:00Z","updated_at":"2026-06-15T11:00:00Z","route_blocking":true}]}
		]}`), 200, nil
	})

	items, supported, err := client.ListChannelRoutingDecisions("codex", 5)
	if err != nil || !supported {
		t.Fatalf("ListChannelRoutingDecisions err=%v supported=%v", err, supported)
	}
	if len(items) != 2 {
		t.Fatalf("items = %#v, want 2", items)
	}
	if got := items[0].DroppedReasons; len(got) != 1 || got[0].AccountID != "acct_company_1" || got[0].AuthID != "auth_company_1" || got[0].Source != "rate-limit" || got[0].Scope != "account" || got[0].Reason != "request window exhausted" || got[0].Model != "gpt-5" || got[0].ExpiresAt != "2026-06-15T10:05:00Z" || got[0].UpdatedAt != "2026-06-15T10:00:00Z" || !got[0].RouteBlocking {
		t.Fatalf("camel dropped reasons = %#v", got)
	}
	if got := items[1].DroppedReasons; len(got) != 1 || got[0].AccountID != "acct_company_2" || got[0].AuthID != "auth_company_2" || got[0].Source != "quota-empty" || got[0].Scope != "model" || got[0].Reason != "quota exhausted" || got[0].Model != "gpt-5-mini" || got[0].ExpiresAt != "2026-06-15T11:05:00Z" || got[0].UpdatedAt != "2026-06-15T11:00:00Z" || !got[0].RouteBlocking {
		t.Fatalf("snake dropped reasons = %#v", got)
	}
}

func TestListChannelRoutingDecisionsClientReturnsUnsupportedOn404(t *testing.T) {
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		return nil, 404, nil
	})

	items, supported, err := client.ListChannelRoutingDecisions("codex", 5)
	if err != nil {
		t.Fatalf("ListChannelRoutingDecisions returned error: %v", err)
	}
	if supported || items != nil {
		t.Fatalf("ListChannelRoutingDecisions = %#v, supported=%v, want unsupported nil", items, supported)
	}
}

func TestRunRouteResilienceActionPostsManagementPayload(t *testing.T) {
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		if method != "POST" || path != "/v0/management/gettokens/route-resilience/actions" {
			t.Fatalf("unexpected request: %s %s", method, path)
		}
		if contentType != "application/json" {
			t.Fatalf("contentType = %q, want application/json", contentType)
		}
		payload, err := io.ReadAll(body)
		if err != nil {
			t.Fatalf("read body: %v", err)
		}
		payloadText := string(payload)
		if !strings.Contains(payloadText, `"action":"clear_transient_lockout"`) || !strings.Contains(payloadText, `"accountKey":"acct_company_1"`) {
			t.Fatalf("unexpected payload: %s", payload)
		}
		return []byte(`{
			"ok": true,
			"authority": "sidecar",
			"action": "clear_transient_lockout",
			"status": "applied",
			"accountKey": "acct_company_1",
			"authId": "auth_company_1",
			"model": "gpt-5",
			"before": {"blockCount": 1},
			"after": {"blockCount": 0},
			"auditId": "route-audit-1",
			"droppedSources": ["upstream-error"],
			"droppedReasons": [{"accountID":"acct_company_1","authID":"auth_company_1","source":"upstream-error","scope":"account","reason":"cleared","model":"gpt-5","routeBlocking":false}]
		}`), 200, nil
	})

	result, err := client.RunRouteResilienceAction(RouteResilienceActionRequest{
		Action:     "clear_transient_lockout",
		AccountKey: "acct_company_1",
		Sources:    []string{"upstream-error"},
		Reason:     "operator verified recovery",
	})
	if err != nil {
		t.Fatalf("RunRouteResilienceAction: %v", err)
	}
	if result.HTTPStatus != 200 || !result.OK || result.Authority != "sidecar" || result.Action != "clear_transient_lockout" || result.Status != "applied" {
		t.Fatalf("result core = %#v", result)
	}
	if result.Before["blockCount"] != float64(1) || result.After["blockCount"] != float64(0) {
		t.Fatalf("before/after = %#v %#v", result.Before, result.After)
	}
	if len(result.DroppedSources) != 1 || result.DroppedSources[0] != "upstream-error" {
		t.Fatalf("droppedSources = %#v", result.DroppedSources)
	}
	if len(result.DroppedReasons) != 1 || result.DroppedReasons[0].Source != "upstream-error" || result.DroppedReasons[0].Model != "gpt-5" {
		t.Fatalf("droppedReasons = %#v", result.DroppedReasons)
	}
}

func TestRouteResilienceActionNotImplementedPreserves501Payload(t *testing.T) {
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		return []byte(`{
			"ok": false,
			"authority": "sidecar",
			"action": "rerun_bounded_reconcile",
			"status": "not_implemented",
			"accountKey": "acct_company_1",
			"before": {"blockCount": 1},
			"after": {"blockCount": 1},
			"droppedReasons": [{"accountID":"acct_company_1","authID":"auth_company_1","source":"auth-error","scope":"account","reason":"auth failed","routeBlocking":true}],
			"notImplementedReason": "current gettokenshooks management layer does not own bounded reconcile or routeability service permissions"
		}`), 501, nil
	})

	result, err := client.RunRouteResilienceAction(RouteResilienceActionRequest{
		Action:     "rerun_bounded_reconcile",
		AccountKey: "acct_company_1",
		Reason:     "operator requested bounded reconcile",
	})
	if err != nil {
		t.Fatalf("RunRouteResilienceAction: %v", err)
	}
	if result.HTTPStatus != 501 || result.OK || result.Status != "not_implemented" || result.NotImplementedReason == "" {
		t.Fatalf("result = %#v, want 501 not_implemented payload", result)
	}
	if len(result.DroppedReasons) != 1 || result.DroppedReasons[0].Source != "auth-error" || !result.DroppedReasons[0].RouteBlocking {
		t.Fatalf("droppedReasons = %#v", result.DroppedReasons)
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
