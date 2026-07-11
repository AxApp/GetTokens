package wailsapp

import (
	"io"
	"net/url"
	"testing"
)

func TestListCachedAccountsReadsSidecarSnapshotWithoutSecrets(t *testing.T) {
	var requests []string
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			requests = append(requests, method+" "+path+"?"+query.Encode())
			if method != "GET" || path != "/v0/management/accounts/snapshot" {
				t.Fatalf("unexpected request: %s %s", method, path)
			}
			if query.Get("allow_stale") != "1" {
				t.Fatalf("allow_stale = %q, want 1", query.Get("allow_stale"))
			}
			return []byte(`{"accounts":[
				{
					"account_key":"acct_00000000-0000-4000-8000-000000000001",
					"kind":"codex-api-key",
					"title":"Codex Key",
					"provider":"codex",
					"credential_source":"sidecar-management-api",
					"priority":10,
					"codex_api_key":{
						"api_key":"sk-secret",
						"base_url":"https://api.openai.com/v1",
						"headers_json":"{\"Authorization\":\"Bearer secret\"}",
						"quota_curl":"curl secret",
						"billing_curl":"curl billing",
						"platform_cookie":"session=secret",
						"curl_variables_json":"{\"platformCookie\":\"session=secret\"}"
					}
				},
				{
					"account_key":"acct_00000000-0000-4000-8000-000000000002",
					"kind":"auth-file",
					"title":"codex-plus.json",
					"provider":"codex",
					"credential_source":"auth-file",
					"auth_file":{
						"source_file_name":"codex-plus.json",
						"email":"user@example.com",
						"plan_type":"plus"
					}
				},
				{
					"account_key":"acct_00000000-0000-4000-8000-000000000003",
					"kind":"openai-compatible",
					"title":"DeepSeek",
					"provider":"deepseek",
					"credential_source":"api-key",
					"openai_compatible":{
						"provider_name":"deepseek",
						"base_url":"https://api.deepseek.com/v1",
						"api_key_entries_json":"[{\"api_key\":\"sk-secret\"}]",
						"model_fetch_api_key":"sk-model-secret",
						"platform_cookie":"session=secret"
					}
				}
			]}`), 200, nil
		},
	}

	records, err := app.ListCachedAccounts()
	if err != nil {
		t.Fatalf("ListCachedAccounts: %v", err)
	}
	if len(records) != 3 {
		t.Fatalf("records len = %d, want 3: %#v", len(records), records)
	}
	if got, want := requests[0], "GET /v0/management/accounts/snapshot?allow_stale=1"; got != want {
		t.Fatalf("request = %q, want %q", got, want)
	}

	codex := records[0]
	if codex.ID != "acct_00000000-0000-4000-8000-000000000001" || codex.BaseURL != "https://api.openai.com/v1" {
		t.Fatalf("unexpected codex snapshot: %#v", codex)
	}
	if codex.APIKey != "" || len(codex.APIKeys) != 0 || codex.Headers != nil || codex.PlatformCookie != "" || codex.QuotaCurl != "" || codex.BillingCurl != "" {
		t.Fatalf("codex snapshot leaked secret fields: %#v", codex)
	}

	auth := records[1]
	if auth.ID != "acct_00000000-0000-4000-8000-000000000002" || auth.Email != "user@example.com" || auth.PlanType != "plus" {
		t.Fatalf("unexpected auth snapshot: %#v", auth)
	}

	compat := records[2]
	if compat.ID != "acct_00000000-0000-4000-8000-000000000003" || compat.Provider != "deepseek" || compat.BaseURL != "https://api.deepseek.com/v1" {
		t.Fatalf("unexpected openai-compatible snapshot: %#v", compat)
	}
	if compat.APIKey != "" || len(compat.APIKeys) != 0 || compat.ModelFetchAPIKey != "" || compat.PlatformCookie != "" {
		t.Fatalf("openai-compatible snapshot leaked secret fields: %#v", compat)
	}
}

func TestListCachedAccountsWithoutManagementClientReturnsEmptySnapshot(t *testing.T) {
	records, err := (&App{}).ListCachedAccounts()
	if err != nil {
		t.Fatalf("ListCachedAccounts: %v", err)
	}
	if len(records) != 0 {
		t.Fatalf("records len = %d, want 0: %#v", len(records), records)
	}
}
