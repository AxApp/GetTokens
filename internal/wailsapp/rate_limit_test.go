package wailsapp

import (
	"io"
	"net/url"
	"strings"
	"testing"
)

func TestAccountStoreDiagnosticsBridgeCallsManagementAPI(t *testing.T) {
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			if method != "GET" || path != ManagementAPIPrefix+"/gettokens/account-store-diagnostics" {
				t.Fatalf("unexpected request: %s %s", method, path)
			}
			return []byte(`{"path_basename":"accounts-v1.sqlite","configured":true,"open":true,"read_recovery":{"count":1,"last_endpoint":"accounts","last_recovered":true,"last_error":"sql: database is closed","last_recovered_at_unix_ms":1780460000000}}`), 200, nil
		},
	}

	diagnostics, err := app.GetAccountStoreDiagnostics()
	if err != nil {
		t.Fatalf("GetAccountStoreDiagnostics: %v", err)
	}
	if diagnostics.PathBasename != "accounts-v1.sqlite" || !diagnostics.Open || diagnostics.ReadRecovery.Count != 1 {
		t.Fatalf("diagnostics = %+v", diagnostics)
	}
}

func TestRateLimitBridgeCallsManagementAPI(t *testing.T) {
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			switch {
			case method == "GET" && path == ManagementAPIPrefix+"/gettokens/rate-limit-strategies":
				return []byte(`{"items":[{"id":"token-window","name":"Token 窗口限流","supported_windows":["1h","24h"]}]}`), 200, nil
			case method == "GET" && path == ManagementAPIPrefix+"/gettokens/rate-limit-rules":
				if got := query.Get("account_key"); got != "codex-api-key:stable-001" {
					t.Fatalf("account_key = %q", got)
				}
				return []byte(`{"items":[{"id":"rlr-1","account_key":"codex-api-key:stable-001","strategy":"token-window","window":"24h","limit_value":1000,"action":"block","enabled":true}]}`), 200, nil
			case method == "POST" && path == ManagementAPIPrefix+"/gettokens/rate-limit-rules":
				assertBridgePayloadContains(t, body, `"account_key":"codex-api-key:stable-001"`)
				return []byte(`{"items":[{"id":"rlr-1","account_key":"codex-api-key:stable-001","strategy":"token-window","window":"24h","limit_value":1000,"action":"block","enabled":true}]}`), 200, nil
			case method == "GET" && path == ManagementAPIPrefix+"/gettokens/rate-limit-status":
				return []byte(`{"account_key":"codex-api-key:stable-001","blocked":true,"block_reason":"24h tokens 已满","rules":[]}`), 200, nil
			case method == "GET" && path == ManagementAPIPrefix+"/gettokens/rate-limit-events":
				return []byte(`{"items":[{"id":"evt-1","account_key":"codex-api-key:stable-001","rule_id":"rlr-1","strategy":"token-window","window":"24h","action":"block","usage_value":1000,"limit_value":1000,"blocked":true,"triggered_at":1760000000000}]}`), 200, nil
			default:
				t.Fatalf("unexpected request: %s %s", method, path)
			}
			return nil, 404, nil
		},
	}

	strategies, err := app.ListRateLimitStrategies()
	if err != nil || len(strategies) != 1 {
		t.Fatalf("strategies = %#v, err = %v", strategies, err)
	}
	rules, err := app.ListRateLimitRules("codex-api-key:stable-001")
	if err != nil || len(rules) != 1 {
		t.Fatalf("rules = %#v, err = %v", rules, err)
	}
	created, err := app.CreateRateLimitRule(RateLimitRule{
		AccountKey: "codex-api-key:stable-001",
		Strategy:   "token-window",
		Window:     "24h",
		LimitValue: 1000,
		Action:     "block",
		Enabled:    true,
	})
	if err != nil || len(created) != 1 {
		t.Fatalf("created = %#v, err = %v", created, err)
	}
	status, err := app.GetRateLimitStatus("codex-api-key:stable-001")
	if err != nil || status == nil || !status.Blocked {
		t.Fatalf("status = %#v, err = %v", status, err)
	}
	events, err := app.ListRateLimitEvents("codex-api-key:stable-001", 10)
	if err != nil || len(events) != 1 {
		t.Fatalf("events = %#v, err = %v", events, err)
	}
}

func assertBridgePayloadContains(t *testing.T, body io.Reader, want string) {
	t.Helper()
	payload, err := io.ReadAll(body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	if !strings.Contains(string(payload), want) {
		t.Fatalf("payload %s does not contain %s", payload, want)
	}
}
