package wailsapp

import (
	"encoding/json"
	"io"
	"net/url"
	"strings"
	"testing"

	"github.com/linhay/gettokens/internal/cliproxyapi"
)

func TestProbeClaudeCodeAccountRoutingSendsAnthropicMessagesRequestAndRouteHeaders(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	used := false
	app := New("dev", "", "AxApp/GetTokens")
	account := testOpenAICompatibleAccount("acct_mimo", "mimo", 9, false, "https://platform.xiaomimimo.com/v1", "", []cliproxyapi.OpenAICompatibleAPIKeyEntry{{APIKey: "sk-upstream", ProxyURL: "direct"}}, nil, []cliproxyapi.OpenAICompatibleModel{{Name: "mimo-v2.5-pro", Alias: "claude-sonnet-4-6"}})
	app.managementAPI = func() *cliproxyapi.Client {
		return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			_ = method
			_ = query
			_ = body
			_ = contentType
			switch path {
			case "/v0/management/api-keys":
				return []byte(`{"api-keys":["sk-relay"]}`), 200, nil
			case "/v0/management/accounts":
				return testAccountsResponse(t, account), 200, nil
			default:
				return nil, 404, nil
			}
		})
	}
	app.sidecarRequest = func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		_ = method
		_ = query
		_ = body
		_ = contentType
		switch path {
		case ManagementAPIPrefix + "/auth-files":
			return []byte(`{"files":[]}`), 200, nil
		case ManagementAPIPrefix + "/api-key-usage":
			success := 0
			if used {
				success = 1
			}
			payload := map[string]map[string]map[string]any{
				"mimo": {
					"https://platform.xiaomimimo.com/v1|sk-upstream": {
						"success": success,
						"failed":  0,
					},
				},
			}
			data, _ := json.Marshal(payload)
			return data, 200, nil
		default:
			return nil, 404, nil
		}
	}
	app.relayRequest = func(method string, path string, body io.Reader, contentType string, apiKey string, headers map[string]string) ([]byte, int, map[string][]string, error) {
		if method != "POST" || path != "/v1/messages" {
			t.Fatalf("unexpected relay request: %s %s", method, path)
		}
		if contentType != "application/json" || apiKey != "sk-relay" {
			t.Fatalf("unexpected content type/api key: %s %s", contentType, apiKey)
		}
		expectedRouteID := buildStableRouteAuthID("openai-compatibility:mimo", "sk-upstream", "https://platform.xiaomimimo.com/v1", "direct")
		if got := headers["X-GetTokens-Route-Allow"]; got != expectedRouteID {
			t.Fatalf("allow header = %q, want %q", got, expectedRouteID)
		}
		if got := headers["X-GetTokens-Route-Order"]; got != expectedRouteID {
			t.Fatalf("order header = %q, want %q", got, expectedRouteID)
		}
		if got := headers["X-GetTokens-Route-Fallback"]; got != "false" {
			t.Fatalf("fallback header = %q, want false", got)
		}
		requestBody, _ := io.ReadAll(body)
		if !strings.Contains(string(requestBody), `"model":"claude-sonnet-4-6"`) || !strings.Contains(string(requestBody), `"max_tokens":1`) {
			t.Fatalf("unexpected request body: %s", requestBody)
		}
		used = true
		return []byte(`{"content":[{"type":"text","text":"OK"}]}`), 200, nil, nil
	}

	result, err := app.ProbeClaudeCodeAccountRouting(ProbeClaudeCodeAccountRoutingInput{
		Model:           "claude-sonnet-4-6",
		Attempts:        1,
		AllowAccountIDs: []string{"acct_mimo"},
		OrderAccountIDs: []string{"acct_mimo"},
	})
	if err != nil {
		t.Fatalf("ProbeClaudeCodeAccountRouting returned error: %v", err)
	}
	if len(result.Attempts) != 1 {
		t.Fatalf("attempts len = %d, want 1", len(result.Attempts))
	}
	attempt := result.Attempts[0]
	if attempt.AccountID != "acct_mimo" || attempt.Provider != "mimo" || !attempt.Success {
		t.Fatalf("unexpected attempt: %#v", attempt)
	}
}

func TestProbeClaudeCodeAccountRoutingPrefersLiveSessionEvidenceBeforeUsageDelta(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	used := false
	app := New("dev", "", "AxApp/GetTokens")
	account := testOpenAICompatibleAccount("acct_mimo", "mimo", 9, false, "https://platform.xiaomimimo.com/v1", "", []cliproxyapi.OpenAICompatibleAPIKeyEntry{{APIKey: "sk-upstream", ProxyURL: "direct"}}, nil, []cliproxyapi.OpenAICompatibleModel{{Name: "mimo-v2.5-pro", Alias: "claude-sonnet-4-6"}})
	app.managementAPI = func() *cliproxyapi.Client {
		return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			_ = method
			_ = query
			_ = body
			_ = contentType
			switch path {
			case "/v0/management/api-keys":
				return []byte(`{"api-keys":["sk-relay"]}`), 200, nil
			case "/v0/management/accounts":
				return testAccountsResponse(t, account), 200, nil
			case "/v0/management/gettokens/channel-routing/explain":
				return []byte(`{"channel":"claude","routeMode":"balanced","candidates":[{"id":"acct_mimo","displayName":"mimo","provider":"mimo","routeOrder":0}],"filtered":[]}`), 200, nil
			default:
				return nil, 404, nil
			}
		})
	}
	app.sidecarRequest = func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		_ = method
		_ = query
		_ = body
		_ = contentType
		switch path {
		case ManagementAPIPrefix + "/auth-files":
			return []byte(`{"files":[]}`), 200, nil
		case ManagementAPIPrefix + "/api-key-usage":
			return []byte(`{"mimo":{"https://platform.xiaomimimo.com/v1|sk-upstream":{"success":0,"failed":0}}}`), 200, nil
		case ManagementAPIPrefix + "/gettokens/live-sessions":
			if !used {
				return []byte(`{"generatedAt":"2026-06-15T12:00:00Z","sidecarReady":true,"source":"live","retentionLabel":"30m","summary":{"activeSessions":0,"activeRequests":0},"sessions":[]}`), 200, nil
			}
			return []byte(`{"generatedAt":"2026-06-15T12:00:01Z","sidecarReady":true,"source":"live","retentionLabel":"30m","summary":{"activeSessions":0,"activeRequests":0},"sessions":[{"sessionID":"sess-1","status":"completed","startedAt":"2026-06-15T12:00:00Z","lastEventAt":"2026-06-15T12:00:01Z","durationMs":1000,"requestCount":1,"model":"claude-sonnet-4-6","accountKey":"acct_mimo","provider":"mimo","downstreamTransport":"http","upstreamTransport":"http","recentEvents":[],"requests":[{"requestID":"req-1","sessionID":"sess-1","sequence":1,"model":"claude-sonnet-4-6","status":"completed","startedAt":"2026-06-15T12:00:01Z","completedAt":"2026-06-15T12:00:01Z","accountKey":"acct_mimo","provider":"mimo","downstreamTransport":"http","upstreamTransport":"http","timeline":[]}]}]}`), 200, nil
		default:
			return nil, 404, nil
		}
	}
	app.relayRequest = func(method string, path string, body io.Reader, contentType string, apiKey string, headers map[string]string) ([]byte, int, map[string][]string, error) {
		used = true
		return []byte(`{"content":[{"type":"text","text":"OK"}]}`), 200, nil, nil
	}

	result, err := app.ProbeClaudeCodeAccountRouting(ProbeClaudeCodeAccountRoutingInput{Model: "claude-sonnet-4-6", Attempts: 1})
	if err != nil {
		t.Fatalf("ProbeClaudeCodeAccountRouting returned error: %v", err)
	}
	attempt := result.Attempts[0]
	if attempt.AccountID != "acct_mimo" || attempt.Evidence != "live-session request" {
		t.Fatalf("attempt = %#v, want live-session evidence", attempt)
	}
}

func TestProbeClaudeCodeAccountRoutingPrefersRouteDecisionEvidenceBeforeLiveSession(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	used := false
	decisionCalls := 0
	app := New("dev", "", "AxApp/GetTokens")
	account := testOpenAICompatibleAccount("acct_mimo", "MIMO", 9, false, "https://api.example.com/v1", "", []cliproxyapi.OpenAICompatibleAPIKeyEntry{{APIKey: "sk-upstream"}}, nil, []cliproxyapi.OpenAICompatibleModel{{Name: "claude-sonnet-4-6", Alias: "claude-sonnet-4-6"}})
	account.OpenAICompatible.FormatBaseURLsJSON = mustJSONString(map[string]string{"anthropic": "https://api.example.com/v1"})
	app.managementAPI = func() *cliproxyapi.Client {
		return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			_ = method
			_ = query
			_ = body
			_ = contentType
			switch path {
			case "/v0/management/api-keys":
				return []byte(`{"api-keys":["sk-relay"]}`), 200, nil
			case "/v0/management/accounts":
				return testAccountsResponse(t, account), 200, nil
			case "/v0/management/gettokens/channel-routing/explain":
				return []byte(`{"channel":"claude","routeMode":"balanced","candidates":[{"id":"acct_mimo","displayName":"MIMO","provider":"mimo","routeOrder":0}],"filtered":[]}`), 200, nil
			case "/v0/management/gettokens/channel-routing/decisions":
				decisionCalls++
				if decisionCalls == 1 {
					return []byte(`{"items":[]}`), 200, nil
				}
				return []byte(`{"items":[{"id":"route-1","recordedAt":"2026-06-15T12:00:01Z","channel":"claude","model":"claude-sonnet-4-6","selectedAccountID":"acct_mimo","selectedProvider":"mimo","trace":[{"stage":"request","activated":true}]}]}`), 200, nil
			default:
				return nil, 404, nil
			}
		})
	}
	app.sidecarRequest = func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		_ = method
		_ = query
		_ = body
		_ = contentType
		switch path {
		case ManagementAPIPrefix + "/auth-files":
			return []byte(`{"files":[]}`), 200, nil
		case ManagementAPIPrefix + "/api-key-usage":
			return []byte(`{"mimo":{"https://api.example.com/v1|sk-upstream":{"success":0,"failed":0}}}`), 200, nil
		case ManagementAPIPrefix + "/gettokens/live-sessions":
			if !used {
				return []byte(`{"generatedAt":"2026-06-15T12:00:00Z","sidecarReady":true,"source":"live","retentionLabel":"30m","summary":{"activeSessions":0,"activeRequests":0},"sessions":[]}`), 200, nil
			}
			return []byte(`{"generatedAt":"2026-06-15T12:00:01Z","sidecarReady":true,"source":"live","retentionLabel":"30m","summary":{"activeSessions":0,"activeRequests":0},"sessions":[{"sessionID":"sess-1","status":"completed","startedAt":"2026-06-15T12:00:00Z","lastEventAt":"2026-06-15T12:00:01Z","durationMs":1000,"requestCount":1,"model":"claude-sonnet-4-6","accountKey":"acct_mimo","provider":"mimo","downstreamTransport":"http","upstreamTransport":"http","recentEvents":[],"requests":[{"requestID":"req-1","sessionID":"sess-1","sequence":1,"model":"claude-sonnet-4-6","status":"completed","startedAt":"2026-06-15T12:00:01Z","completedAt":"2026-06-15T12:00:01Z","accountKey":"acct_mimo","provider":"mimo","downstreamTransport":"http","upstreamTransport":"http","timeline":[]}]}]}`), 200, nil
		default:
			return nil, 404, nil
		}
	}
	app.relayRequest = func(method string, path string, body io.Reader, contentType string, apiKey string, headers map[string]string) ([]byte, int, map[string][]string, error) {
		used = true
		return []byte(`{"content":[{"type":"text","text":"OK"}]}`), 200, nil, nil
	}

	result, err := app.ProbeClaudeCodeAccountRouting(ProbeClaudeCodeAccountRoutingInput{Model: "claude-sonnet-4-6", Attempts: 1})
	if err != nil {
		t.Fatalf("ProbeClaudeCodeAccountRouting returned error: %v", err)
	}
	attempt := result.Attempts[0]
	if attempt.AccountID != "acct_mimo" || attempt.Evidence != "route-decision snapshot" {
		t.Fatalf("attempt = %#v, want route-decision evidence", attempt)
	}
}

func TestProbeClaudeCodeAccountRoutingFiltersNonAnthropicAccounts(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	app := New("dev", "", "AxApp/GetTokens")
	account := testOpenAICompatibleAccount("acct_copilot", "copilot", 9, false, "https://api.githubcopilot.com", "", []cliproxyapi.OpenAICompatibleAPIKeyEntry{{APIKey: "sk-copilot"}}, nil, nil)
	app.managementAPI = func() *cliproxyapi.Client {
		return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			_ = method
			_ = query
			_ = body
			_ = contentType
			switch path {
			case "/v0/management/api-keys":
				return []byte(`{"api-keys":["sk-relay"]}`), 200, nil
			case "/v0/management/accounts":
				return testAccountsResponse(t, account), 200, nil
			default:
				return nil, 404, nil
			}
		})
	}
	app.sidecarRequest = func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		_ = method
		_ = query
		_ = body
		_ = contentType
		if path == ManagementAPIPrefix+"/auth-files" {
			return []byte(`{"files":[]}`), 200, nil
		}
		return nil, 404, nil
	}

	_, err := app.ProbeClaudeCodeAccountRouting(ProbeClaudeCodeAccountRoutingInput{Model: "claude-sonnet-4-6"})
	if err == nil || !strings.Contains(err.Error(), "没有可用于探测") {
		t.Fatalf("expected no candidates error, got %v", err)
	}
}

func TestLoadClaudeCodeRoutingProbeCandidatesPrefersSidecarExplainOrder(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	app := New("dev", "", "AxApp/GetTokens")
	accountA := testOpenAICompatibleAccount("acct_a", "A", 1, false, "https://platform.example.com/v1", "", []cliproxyapi.OpenAICompatibleAPIKeyEntry{{APIKey: "sk-a", ProxyURL: "direct"}}, nil, []cliproxyapi.OpenAICompatibleModel{{Name: "claude-a", Alias: "claude-sonnet-4-6"}})
	accountB := testOpenAICompatibleAccount("acct_b", "B", 9, false, "https://platform.example.com/v1", "", []cliproxyapi.OpenAICompatibleAPIKeyEntry{{APIKey: "sk-b", ProxyURL: "direct"}}, nil, []cliproxyapi.OpenAICompatibleModel{{Name: "claude-b", Alias: "claude-sonnet-4-6"}})
	app.managementAPI = func() *cliproxyapi.Client {
		return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			_ = query
			_ = body
			_ = contentType
			switch {
			case method == "GET" && path == "/v0/management/accounts":
				return testAccountsResponse(t, accountA, accountB), 200, nil
			case method == "POST" && path == "/v0/management/gettokens/channel-routing/explain":
				return []byte(`{
					"channel":"claude",
					"routeMode":"balanced",
					"selectedAccountID":"acct_b",
					"candidates":[
						{"id":"acct_b","displayName":"B from sidecar","provider":"mimo","routeOrder":0},
						{"id":"acct_a","displayName":"A from sidecar","provider":"mimo","routeOrder":1}
					],
					"filtered":[]
				}`), 200, nil
			default:
				return nil, 404, nil
			}
		})
	}

	candidates, err := app.loadClaudeCodeRoutingProbeCandidates("claude-sonnet-4-6")
	if err != nil {
		t.Fatalf("loadClaudeCodeRoutingProbeCandidates returned error: %v", err)
	}
	if len(candidates) != 2 || candidates[0].ID != "acct_b" || candidates[1].ID != "acct_a" {
		t.Fatalf("candidates = %#v, want sidecar explain order", candidates)
	}
	if candidates[0].Label != "B from sidecar" || candidates[1].Label != "A from sidecar" {
		t.Fatalf("candidates labels = %#v, want sidecar labels", candidates)
	}
}

func TestProbeClaudeCodeAccountRoutingRequiresModel(t *testing.T) {
	app := New("dev", "", "AxApp/GetTokens")
	if _, err := app.ProbeClaudeCodeAccountRouting(ProbeClaudeCodeAccountRoutingInput{Model: " "}); err == nil {
		t.Fatal("expected model validation error")
	}
}
