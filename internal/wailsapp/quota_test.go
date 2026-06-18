package wailsapp

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/linhay/gettokens/internal/cliproxyapi"
)

func TestNormalizeAuthIndex(t *testing.T) {
	tests := []struct {
		name  string
		value interface{}
		want  string
	}{
		{name: "string", value: " auth-1 ", want: "auth-1"},
		{name: "json number", value: json.Number("12"), want: "12"},
		{name: "float", value: float64(7), want: "7"},
		{name: "int", value: 9, want: "9"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := normalizeAuthIndex(tt.value); got != tt.want {
				t.Fatalf("normalizeAuthIndex(%#v) = %q, want %q", tt.value, got, tt.want)
			}
		})
	}
}

func TestManagementAPICallResponseStatusCode(t *testing.T) {
	if got := (managementAPICallResponse{StatusCodeSnake: 201, StatusCodeCamel: 200}).statusCode(); got != 201 {
		t.Fatalf("unexpected snake status code: %d", got)
	}
	if got := (managementAPICallResponse{StatusCodeCamel: 204}).statusCode(); got != 204 {
		t.Fatalf("unexpected camel status code: %d", got)
	}
}

func TestQuotaUpstreamFailureReasonIncludesDetailCodeWhenMessageMissing(t *testing.T) {
	reason := quotaUpstreamFailureReason(http.StatusPaymentRequired, `{
		"detail": {
			"code": "deactivated_workspace"
		}
	}`)
	if !strings.Contains(reason, "402") || !strings.Contains(reason, "deactivated_workspace") {
		t.Fatalf("quotaUpstreamFailureReason = %q, want status code and detail.code", reason)
	}
}

func TestTestCodexAPIKeyQuotaCurlUsesDraftInput(t *testing.T) {
	var gotDraft map[string]any
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			if method != http.MethodPost || path != ManagementAPIPrefix+"/gettokens/quota-test" {
				t.Fatalf("unexpected sidecar request: %s %s", method, path)
			}
			if err := json.NewDecoder(body).Decode(&gotDraft); err != nil {
				t.Fatalf("decode quota-test body: %v", err)
			}
			response := []byte(`{
				"status":"success",
				"plan_type":"pro",
				"windows":[
					{"id":"five-hour","label":"5H","remaining_percent":89,"reset_at_unix":1777980010},
					{"id":"weekly","label":"7D","remaining_percent":96,"reset_at_unix":1778546810}
				],
				"sources":[]
			}`)
			return response, http.StatusOK, nil
		},
	}

	result, err := app.TestCodexAPIKeyQuotaCurl(TestCodexAPIKeyQuotaCurlInput{
		APIKey:         "sk-live",
		BaseURL:        "https://quota.example.com",
		PlatformCookie: "Cookie: service=abc",
		QuotaCurl:      `curl -sS "{{baseUrl}}/api/codex/usage" -H "Authorization: Bearer {{apiKey}}" -b "{{platformCookie}}"`,
	})
	if err != nil {
		t.Fatalf("TestCodexAPIKeyQuotaCurl: %v", err)
	}
	if gotDraft["api_key"] != "sk-live" || gotDraft["base_url"] != "https://quota.example.com" {
		t.Fatalf("quota-test draft = %#v", gotDraft)
	}
	if gotDraft["quota_curl"] != `curl -sS "{{baseUrl}}/api/codex/usage" -H "Authorization: Bearer {{apiKey}}" -b "{{platformCookie}}"` {
		t.Fatalf("quota curl draft = %q", gotDraft["quota_curl"])
	}
	if gotDraft["platform_cookie"] != "service=abc" {
		t.Fatalf("platform cookie draft = %q", gotDraft["platform_cookie"])
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
}

func TestTestCodexAPIKeyBillingCurlUsesSidecarAPICall(t *testing.T) {
	var gotDraft map[string]any
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			if method != http.MethodPost || path != ManagementAPIPrefix+"/gettokens/billing-test" {
				t.Fatalf("unexpected sidecar request: %s %s", method, path)
			}
			if err := json.NewDecoder(body).Decode(&gotDraft); err != nil {
				t.Fatalf("decode billing-test body: %v", err)
			}
			response := []byte(`{
				"status":"success",
				"windows":[],
				"billing":{
					"is_available":true,
					"balance_infos":[{
						"currency": "USD",
						"total_balance": "20.00",
						"granted_balance": "12.00",
						"topped_up_balance": "8.00"
					}]
				},
				"sources":[]
			}`)
			return response, http.StatusOK, nil
		},
	}

	result, err := app.TestCodexAPIKeyBillingCurl(TestCodexAPIKeyQuotaCurlInput{
		APIKey:         "sk-billing",
		BaseURL:        "https://billing.example.com",
		PlatformCookie: "billing=xyz",
		QuotaCurl:      `curl -sS "{{baseUrl}}/user/balance" -b "{{platformCookie}}"`,
	})
	if err != nil {
		t.Fatalf("TestCodexAPIKeyBillingCurl: %v", err)
	}
	if gotDraft["api_key"] != "sk-billing" || gotDraft["base_url"] != "https://billing.example.com" {
		t.Fatalf("billing-test draft = %#v", gotDraft)
	}
	if gotDraft["billing_curl"] != `curl -sS "{{baseUrl}}/user/balance" -b "{{platformCookie}}"` {
		t.Fatalf("billing curl draft = %q", gotDraft["billing_curl"])
	}
	if gotDraft["platform_cookie"] != "billing=xyz" {
		t.Fatalf("billing platform cookie draft = %q", gotDraft["platform_cookie"])
	}
	if !result.IsAvailable || len(result.BalanceInfos) != 1 {
		t.Fatalf("billing result = %#v, want parsed balance info", result)
	}
	if result.BalanceInfos[0].GrantedBalance != "12.00" {
		t.Fatalf("granted balance = %q, want 12.00", result.BalanceInfos[0].GrantedBalance)
	}
}

func TestGetCodexQuotaLoadsUnifiedCodexAPIKeyCredential(t *testing.T) {
	const accountKey = "acct_00000000-0000-4000-8000-000000000201"
	gotQuotaRefresh := false

	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			if method == http.MethodGet && path == ManagementAPIPrefix+"/accounts/"+accountKey {
				payload, _ := json.Marshal(map[string]any{
					"account_key": accountKey,
					"kind":        "codex-api-key",
					"title":       "公司 1",
					"provider":    "codex",
					"codex_api_key": map[string]any{
						"api_key":       "sk-company",
						"base_url":      "https://quota.example.com",
						"quota_curl":    `curl -sS "{{baseUrl}}/api/codex/usage" -H "Authorization: Bearer {{apiKey}}"`,
						"quota_enabled": true,
					},
				})
				return payload, http.StatusOK, nil
			}
			if method == http.MethodPost && path == ManagementAPIPrefix+"/gettokens/quota-refresh/"+accountKey {
				gotQuotaRefresh = true
				var payload map[string]any
				if err := json.NewDecoder(body).Decode(&payload); err != nil {
					t.Fatalf("decode quota-refresh body: %v", err)
				}
				if payload["include_billing"] != true {
					t.Fatalf("quota refresh payload = %#v, want include_billing", payload)
				}
				return []byte(`{"account_key":"` + accountKey + `","status":"success","plan_type":"plus","windows":[{"id":"five-hour","label":"5H","remaining_percent":82,"reset_at_unix":1777980010}],"blocked":true,"block_reason":"quota empty: five-hour","sources":[{"source":"quota-empty","reason":"quota empty: five-hour","expires_at":"2026-05-31T12:00:00Z","next_reset":"2026-05-31T12:00:00Z"}]}`), http.StatusOK, nil
			}
			t.Fatalf("unexpected sidecar request: %s %s", method, path)
			return nil, 0, nil
		},
	}

	quota, err := app.GetCodexQuota(accountKey)
	if err != nil {
		t.Fatalf("GetCodexQuota: %v", err)
	}
	if !gotQuotaRefresh {
		t.Fatal("expected sidecar-native quota refresh endpoint")
	}
	if !quota.Blocked || quota.BlockReason != "quota empty: five-hour" || len(quota.Sources) != 1 || quota.Sources[0].NextReset == "" {
		t.Fatalf("quota route guard = blocked:%v reason:%q sources:%#v, want quota-empty with next reset", quota.Blocked, quota.BlockReason, quota.Sources)
	}
	if quota.PlanType != "plus" {
		t.Fatalf("PlanType = %q, want plus", quota.PlanType)
	}
	if len(quota.Windows) != 1 || quota.Windows[0].RemainingPercent == nil || *quota.Windows[0].RemainingPercent != 82 {
		t.Fatalf("unexpected quota windows: %#v", quota.Windows)
	}
}

func TestGetCodexQuotaLoadsUnifiedOpenAICompatibleCredential(t *testing.T) {
	const accountKey = "acct_00000000-0000-4000-8000-000000000204"
	gotQuotaRefresh := false

	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			if method == http.MethodGet && path == ManagementAPIPrefix+"/accounts/"+accountKey {
				payload, _ := json.Marshal(map[string]any{
					"account_key": accountKey,
					"kind":        "openai-compatible",
					"title":       "DeepSeek",
					"provider":    "deepseek",
					"openai_compatible": map[string]any{
						"provider_name":         "deepseek",
						"base_url":              "https://api.deepseek.com/v1",
						"api_key_entries_json":  `[{"api-key":"sk-deepseek"}]`,
						"quota_curl":            `curl -sS "https://api.deepseek.com/user/balance" -H "Authorization: Bearer {{apiKey}}"`,
						"quota_enabled":         true,
						"billing_curl":          `curl -sS "https://api.deepseek.com/user/balance" -H "Authorization: Bearer {{apiKey}}"`,
						"billing_enabled":       true,
						"curl_variables_json":   `{}`,
						"format_base_urls_json": `{}`,
					},
				})
				return payload, http.StatusOK, nil
			}
			if method == http.MethodPost && path == ManagementAPIPrefix+"/gettokens/quota-refresh/"+accountKey {
				gotQuotaRefresh = true
				return []byte(`{"account_key":"` + accountKey + `","status":"success","plan_type":"billing","windows":[],"billing":{"is_available":true,"balance_infos":[{"currency":"USD","total_balance":"42.00","granted_balance":"12.00","topped_up_balance":"30.00"}]},"sources":[]}`), http.StatusOK, nil
			}
			t.Fatalf("unexpected sidecar request: %s %s", method, path)
			return nil, 0, nil
		},
	}

	quota, err := app.GetCodexQuota(accountKey)
	if err != nil {
		t.Fatalf("GetCodexQuota: %v", err)
	}
	if !gotQuotaRefresh {
		t.Fatal("expected sidecar-native quota refresh endpoint")
	}
	if quota.Billing == nil || !quota.Billing.IsAvailable || len(quota.Billing.BalanceInfos) != 1 {
		t.Fatalf("billing = %#v, want DeepSeek balance", quota.Billing)
	}
	if quota.Billing.BalanceInfos[0].TotalBalance != "42.00" {
		t.Fatalf("balance = %#v, want total 42.00", quota.Billing.BalanceInfos[0])
	}
}

func TestOpenAIQuotaResetCreditBridgeUsesManagementAPI(t *testing.T) {
	var requests []string
	app := New("dev", "", "AxApp/GetTokens")
	app.managementAPI = func() *cliproxyapi.Client {
		return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			_ = query
			_ = body
			_ = contentType
			requests = append(requests, method+" "+path)
			switch method + " " + path {
			case "GET /v0/management/gettokens/openai-quota-reset/acct_00000000-0000-4000-8000-000000000001":
				return []byte(`{"account_key":"acct_00000000-0000-4000-8000-000000000001","status":"success","available_count":2,"plan_type":"pro","fetched_at":1781760000,"quota_state":{"account_key":"acct_00000000-0000-4000-8000-000000000001","status":"success","plan_type":"pro","windows":[],"sources":[],"blocked":false}}`), 200, nil
			case "POST /v0/management/gettokens/openai-quota-reset/acct_00000000-0000-4000-8000-000000000001/consume":
				return []byte(`{"account_key":"acct_00000000-0000-4000-8000-000000000001","status":"success","code":"success","windows_reset":2,"available_count":1,"credit":{"status":"redeemed","redeemed_at":"2026-06-18T04:24:50Z"},"quota_state":{"account_key":"acct_00000000-0000-4000-8000-000000000001","status":"success","plan_type":"pro","windows":[],"sources":[],"blocked":false},"post_reset_refresh_status":"success"}`), 200, nil
			default:
				t.Fatalf("unexpected request: %s %s", method, path)
			}
			return nil, 404, nil
		})
	}

	info, err := app.GetOpenAIQuotaResetCredit("acct_00000000-0000-4000-8000-000000000001")
	if err != nil {
		t.Fatalf("GetOpenAIQuotaResetCredit returned error: %v", err)
	}
	if info.AvailableCount != 2 || info.QuotaState == nil || info.QuotaState.PlanType != "pro" {
		t.Fatalf("unexpected info: %#v", info)
	}

	result, err := app.ConsumeOpenAIQuotaResetCredit("acct_00000000-0000-4000-8000-000000000001")
	if err != nil {
		t.Fatalf("ConsumeOpenAIQuotaResetCredit returned error: %v", err)
	}
	if result.WindowsReset != 2 || result.Credit == nil || result.Credit.RedeemedAt == "" || result.QuotaState == nil {
		t.Fatalf("unexpected consume result: %#v", result)
	}
	if strings.Join(requests, "\n") != "GET /v0/management/gettokens/openai-quota-reset/acct_00000000-0000-4000-8000-000000000001\nPOST /v0/management/gettokens/openai-quota-reset/acct_00000000-0000-4000-8000-000000000001/consume" {
		t.Fatalf("requests = %#v", requests)
	}
}

func TestGetCodexQuotaMarksCachedUnifiedQuotaStaleWhenRefreshFails(t *testing.T) {
	const accountKey = "acct_00000000-0000-4000-8000-000000000202"
	const refreshErr = "ensure account store metadata: database is locked (SQLITE_BUSY)"

	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			switch {
			case method == http.MethodGet && path == ManagementAPIPrefix+"/accounts/"+accountKey:
				payload, _ := json.Marshal(map[string]any{
					"account_key": accountKey,
					"kind":        "codex-api-key",
					"title":       "公司 2",
					"provider":    "codex",
					"codex_api_key": map[string]any{
						"api_key":       "sk-company",
						"base_url":      "https://quota.example.com",
						"quota_curl":    `curl -sS "{{baseUrl}}/api/codex/usage" -H "Authorization: Bearer {{apiKey}}"`,
						"quota_enabled": true,
					},
				})
				return payload, http.StatusOK, nil
			case method == http.MethodPost && path == ManagementAPIPrefix+"/gettokens/quota-refresh/"+accountKey:
				return nil, http.StatusInternalServerError, errors.New(refreshErr)
			case method == http.MethodGet && path == ManagementAPIPrefix+"/gettokens/quota-status":
				if query.Get("account_key") != accountKey {
					t.Fatalf("quota status query = %q, want account key", query.Encode())
				}
				return []byte(`{"account_key":"` + accountKey + `","status":"success","plan_type":"plus","windows":[{"id":"five-hour","label":"5H","remaining_percent":61,"reset_at_unix":1777980010}],"sources":[]}`), http.StatusOK, nil
			default:
				t.Fatalf("unexpected sidecar request: %s %s", method, path)
				return nil, 0, nil
			}
		},
	}

	quota, err := app.GetCodexQuota(accountKey)
	if err != nil {
		t.Fatalf("GetCodexQuota: %v", err)
	}
	if quota.Status != "stale" || !quota.Stale || !strings.Contains(quota.DegradedReason, refreshErr) {
		t.Fatalf("cached quota fallback = status:%q stale:%v degraded:%q, want stale with refresh error", quota.Status, quota.Stale, quota.DegradedReason)
	}
	if len(quota.Windows) != 1 || quota.Windows[0].RemainingPercent == nil || *quota.Windows[0].RemainingPercent != 61 {
		t.Fatalf("unexpected cached quota windows: %#v", quota.Windows)
	}
}

func TestGetCodexQuotaFallsBackToAuthFileUsageCacheWhenAPICallFails(t *testing.T) {
	authBody := []byte(`{
		"account_id":"acct_cached",
		"tokens":{"access_token":"token_cached"},
		"plan":"plus",
		"nolon":{
			"usage_cache":{
				"usage":{
					"identity":{"plan":"plus"},
					"primary":{"usedPercent":26,"resetsAt":1710000000}
				}
			}
		}
	}`)

	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			switch {
			case method == http.MethodGet && path == ManagementAPIPrefix+"/accounts/acct_cached":
				payload, _ := json.Marshal(map[string]any{
					"account_key": "acct_cached",
					"kind":        "auth-file",
					"title":       "cached.json",
					"provider":    "codex",
					"auth_file": map[string]any{
						"source_file_name": "cached.json",
						"auth_json":        string(authBody),
						"auth_type":        "codex",
					},
				})
				return payload, http.StatusOK, nil
			case method == http.MethodGet && path == ManagementAPIPrefix+"/accounts":
				payload, _ := json.Marshal(map[string]any{"accounts": []map[string]any{{
					"account_key": "acct_cached",
					"kind":        "auth-file",
					"title":       "cached.json",
					"provider":    "codex",
					"auth_file": map[string]any{
						"source_file_name": "cached.json",
						"auth_json":        string(authBody),
						"auth_type":        "codex",
					},
				}}})
				return payload, http.StatusOK, nil
			case method == http.MethodPost && path == ManagementAPIPrefix+"/api-call":
				return nil, http.StatusForbidden, errors.New("api call denied")
			case method == http.MethodPut && path == ManagementAPIPrefix+"/gettokens/quota-status/acct_cached":
				var payload map[string]any
				if err := json.NewDecoder(body).Decode(&payload); err != nil {
					t.Fatalf("decode quota runtime payload: %v", err)
				}
				if payload["status"] != "stale" {
					t.Fatalf("quota runtime status = %#v, want stale", payload["status"])
				}
				return []byte(`{"account_key":"acct_cached","status":"stale","plan_type":"plus","windows":[{"id":"five-hour","label":"5H","remaining_percent":74,"reset_at_unix":1710000000}],"sources":[]}`), http.StatusOK, nil
			default:
				t.Fatalf("unexpected sidecar request: %s %s", method, path)
				return nil, 0, nil
			}
		},
	}

	quota, err := app.GetCodexQuota("acct_cached")
	if err != nil {
		t.Fatalf("GetCodexQuota: %v", err)
	}
	if quota.PlanType != "plus" {
		t.Fatalf("PlanType = %q, want plus", quota.PlanType)
	}
	if len(quota.Windows) != 1 {
		t.Fatalf("expected one cached quota window, got %d", len(quota.Windows))
	}
	if quota.Windows[0].RemainingPercent == nil || *quota.Windows[0].RemainingPercent != 74 {
		t.Fatalf("unexpected cached remaining percent: %#v", quota.Windows[0].RemainingPercent)
	}
}

func TestGetCodexQuotaSurfacesAuthFileUsageUnauthorizedMessage(t *testing.T) {
	authBody := []byte(`{
		"account_id":"acct_unauthorized",
		"tokens":{"access_token":"token_invalid"},
		"plan":"plus",
		"nolon":{
			"usage_cache":{
				"usage":{
					"identity":{"plan":"plus"},
					"primary":{"usedPercent":26,"resetsAt":1710000000}
				}
			}
		}
	}`)

	var gotRuntimePayload map[string]any
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			switch {
			case method == http.MethodGet && path == ManagementAPIPrefix+"/accounts/acct_unauthorized":
				payload, _ := json.Marshal(map[string]any{
					"account_key": "acct_unauthorized",
					"kind":        "auth-file",
					"title":       "unauthorized.json",
					"provider":    "codex",
					"auth_file": map[string]any{
						"source_file_name": "unauthorized.json",
						"auth_json":        string(authBody),
						"auth_type":        "codex",
					},
				})
				return payload, http.StatusOK, nil
			case method == http.MethodPost && path == ManagementAPIPrefix+"/api-call":
				response, _ := json.Marshal(managementAPICallResponse{
					StatusCodeSnake: http.StatusUnauthorized,
					Body: `{
						"error": {
							"message": "Your authentication token has been invalidated. Please try signing in again.",
							"type": "invalid_request_error",
							"code": "token_invalidated"
						},
						"status": 401
					}`,
				})
				return response, http.StatusOK, nil
			case method == http.MethodPut && path == ManagementAPIPrefix+"/gettokens/quota-status/acct_unauthorized":
				if err := json.NewDecoder(body).Decode(&gotRuntimePayload); err != nil {
					t.Fatalf("decode quota runtime payload: %v", err)
				}
				reason, _ := gotRuntimePayload["degraded_reason"].(string)
				if gotRuntimePayload["status"] != "stale" || !strings.Contains(reason, "token_invalidated") {
					t.Fatalf("quota runtime payload = %#v, want stale token invalidated reason", gotRuntimePayload)
				}
				return []byte(`{
					"account_key":"acct_unauthorized",
					"status":"stale",
					"stale":true,
					"degraded_reason":"ChatGPT usage request failed (401): Your authentication token has been invalidated. Please try signing in again. (token_invalidated)",
					"plan_type":"plus",
					"windows":[{"id":"five-hour","label":"5H","remaining_percent":74,"reset_at_unix":1710000000}],
					"sources":[]
				}`), http.StatusOK, nil
			default:
				t.Fatalf("unexpected sidecar request: %s %s", method, path)
				return nil, 0, nil
			}
		},
	}

	quota, err := app.GetCodexQuota("acct_unauthorized")
	if err != nil {
		t.Fatalf("GetCodexQuota: %v", err)
	}
	if quota.Status != "stale" || !quota.Stale || !strings.Contains(quota.DegradedReason, "token_invalidated") {
		t.Fatalf("quota runtime explain = status:%q stale:%v degraded:%q", quota.Status, quota.Stale, quota.DegradedReason)
	}
	if len(quota.Windows) != 1 {
		t.Fatalf("expected cached quota window, got %#v", quota.Windows)
	}
}

func TestGetCodexQuotaUsesAccountKeyAndRuntimeMetadataAccountID(t *testing.T) {
	authBody := []byte(`{
		"id":"codex-plus.json",
		"provider":"codex",
		"metadata":{
			"account_id":"chatgpt_account_from_metadata",
			"plan_type":"plus",
			"email":"plus@example.com"
		}
	}`)

	var gotAPICall managementAPICallRequest
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			switch {
			case method == http.MethodGet && path == ManagementAPIPrefix+"/accounts":
				payload, _ := json.Marshal(map[string]any{"accounts": []map[string]any{{
					"account_key": "acct_plus",
					"kind":        "auth-file",
					"title":       "codex-plus.json",
					"provider":    "codex",
					"auth_file": map[string]any{
						"source_file_name": "codex-plus.json",
						"auth_json":        string(authBody),
						"auth_type":        "codex",
						"plan_type":        "plus",
					},
				}}})
				return payload, http.StatusOK, nil
			case method == http.MethodPost && path == ManagementAPIPrefix+"/api-call":
				if err := json.NewDecoder(body).Decode(&gotAPICall); err != nil {
					t.Fatalf("decode api-call body: %v", err)
				}
				response, _ := json.Marshal(managementAPICallResponse{
					StatusCodeSnake: http.StatusOK,
					Body: `{
						"plan_type":"plus",
						"rate_limit":{
							"primary_window":{"used_percent":20,"limit_window_seconds":18000,"reset_at":1777980010}
						}
					}`,
				})
				return response, http.StatusOK, nil
			case method == http.MethodPut && path == ManagementAPIPrefix+"/gettokens/quota-status/acct_plus":
				var payload map[string]any
				if err := json.NewDecoder(body).Decode(&payload); err != nil {
					t.Fatalf("decode quota runtime payload: %v", err)
				}
				if payload["status"] != "success" {
					t.Fatalf("quota runtime status = %#v, want success", payload["status"])
				}
				return []byte(`{"account_key":"acct_plus","status":"success","plan_type":"plus","windows":[{"id":"five-hour","label":"5H","remaining_percent":79,"reset_at_unix":1777980010}],"sources":[]}`), http.StatusOK, nil
			default:
				t.Fatalf("unexpected sidecar request: %s %s", method, path)
				return nil, 0, nil
			}
		},
	}

	quota, err := app.GetCodexQuota("codex-plus.json")
	if err != nil {
		t.Fatalf("GetCodexQuota: %v", err)
	}
	if gotAPICall.AuthIndex != "acct_plus" {
		t.Fatalf("api-call auth index = %q, want acct_plus", gotAPICall.AuthIndex)
	}
	if gotAPICall.Header["chatgpt-account-id"] != "chatgpt_account_from_metadata" {
		t.Fatalf("chatgpt-account-id = %q, want metadata account id", gotAPICall.Header["chatgpt-account-id"])
	}
	if gotAPICall.Header["Authorization"] != "Bearer $TOKEN$" {
		t.Fatalf("Authorization = %q, want token placeholder", gotAPICall.Header["Authorization"])
	}
	if quota.PlanType != "plus" {
		t.Fatalf("PlanType = %q, want plus", quota.PlanType)
	}
	if len(quota.Windows) != 1 || quota.Windows[0].RemainingPercent == nil || *quota.Windows[0].RemainingPercent != 79 {
		t.Fatalf("unexpected quota windows: %#v", quota.Windows)
	}
}
