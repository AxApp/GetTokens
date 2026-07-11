package wailsapp

import (
	"encoding/json"
	"io"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/linhay/gettokens/internal/cliproxyapi"
)

func TestProbeCodexAccountRoutingDetectsOpenAICompatibleProviderFromUsageDelta(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	used := false
	app := New("dev", "", "AxApp/GetTokens")
	account := testOpenAICompatibleAccount("acct_mi", "MI", 9, false, "https://api.example.com/v1", "", []cliproxyapi.OpenAICompatibleAPIKeyEntry{{APIKey: "sk-upstream"}}, nil, []cliproxyapi.OpenAICompatibleModel{{Name: "gpt-test", Alias: "gpt-5.4"}})
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
				"mi": {
					"https://api.example.com/v1|sk-upstream": {
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
		_ = headers
		if method != "POST" || path != "/v1/chat/completions" {
			t.Fatalf("unexpected relay request: %s %s", method, path)
		}
		if apiKey != "sk-relay" {
			t.Fatalf("apiKey = %q, want sk-relay", apiKey)
		}
		requestBody, _ := io.ReadAll(body)
		if !strings.Contains(string(requestBody), `"model":"gpt-5.4"`) {
			t.Fatalf("request body should include selected model: %s", requestBody)
		}
		used = true
		return []byte(`{"choices":[{"message":{"content":"OK"}}]}`), 200, nil, nil
	}

	result, err := app.ProbeCodexAccountRouting(ProbeCodexAccountRoutingInput{Model: "gpt-5.4", Attempts: 1})
	if err != nil {
		t.Fatalf("ProbeCodexAccountRouting returned error: %v", err)
	}
	if len(result.Attempts) != 1 {
		t.Fatalf("attempts len = %d, want 1", len(result.Attempts))
	}
	attempt := result.Attempts[0]
	if attempt.AccountID != "acct_mi" {
		t.Fatalf("AccountID = %q, want acct_mi", attempt.AccountID)
	}
	if attempt.AccountLabel != "MI" || attempt.Provider != "mi" {
		t.Fatalf("unexpected account label/provider: %#v", attempt)
	}
	if !attempt.Success || attempt.StatusCode != 200 {
		t.Fatalf("unexpected attempt status: %#v", attempt)
	}
}

func TestProbeCodexAccountRoutingPrefersLiveSessionEvidenceBeforeUsageDelta(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	used := false
	app := New("dev", "", "AxApp/GetTokens")
	account := testOpenAICompatibleAccount("acct_mi", "MI", 9, false, "https://api.example.com/v1", "", []cliproxyapi.OpenAICompatibleAPIKeyEntry{{APIKey: "sk-upstream"}}, nil, []cliproxyapi.OpenAICompatibleModel{{Name: "gpt-test", Alias: "gpt-5.4"}})
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
				return []byte(`{"channel":"codex","routeMode":"balanced","candidates":[{"id":"acct_mi","displayName":"MI","provider":"mi","routeOrder":0}],"filtered":[]}`), 200, nil
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
			return []byte(`{"mi":{"https://api.example.com/v1|sk-upstream":{"success":0,"failed":0}}}`), 200, nil
		case ManagementAPIPrefix + "/gettokens/live-sessions":
			if !used {
				return []byte(`{"generatedAt":"2026-06-15T12:00:00Z","sidecarReady":true,"source":"live","retentionLabel":"30m","summary":{"activeSessions":0,"activeRequests":0},"sessions":[]}`), 200, nil
			}
			return []byte(`{"generatedAt":"2026-06-15T12:00:01Z","sidecarReady":true,"source":"live","retentionLabel":"30m","summary":{"activeSessions":0,"activeRequests":0},"sessions":[{"sessionID":"sess-1","status":"completed","startedAt":"2026-06-15T12:00:00Z","lastEventAt":"2026-06-15T12:00:01Z","durationMs":1000,"requestCount":1,"model":"gpt-5.4","accountKey":"acct_mi","provider":"mi","downstreamTransport":"http","upstreamTransport":"http","recentEvents":[],"requests":[{"requestID":"req-1","sessionID":"sess-1","sequence":1,"model":"gpt-5.4","status":"completed","startedAt":"2026-06-15T12:00:01Z","completedAt":"2026-06-15T12:00:01Z","accountKey":"acct_mi","provider":"mi","downstreamTransport":"http","upstreamTransport":"http","timeline":[]}]}]}`), 200, nil
		default:
			return nil, 404, nil
		}
	}
	app.relayRequest = func(method string, path string, body io.Reader, contentType string, apiKey string, headers map[string]string) ([]byte, int, map[string][]string, error) {
		used = true
		return []byte(`{"choices":[{"message":{"content":"OK"}}]}`), 200, nil, nil
	}

	result, err := app.ProbeCodexAccountRouting(ProbeCodexAccountRoutingInput{Model: "gpt-5.4", Attempts: 1})
	if err != nil {
		t.Fatalf("ProbeCodexAccountRouting returned error: %v", err)
	}
	attempt := result.Attempts[0]
	if attempt.AccountID != "acct_mi" || attempt.Evidence != "live-session request" {
		t.Fatalf("attempt = %#v, want live-session evidence", attempt)
	}
}

func TestProbeCodexAccountRoutingPrefersRouteDecisionEvidenceBeforeLiveSession(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	used := false
	decisionCalls := 0
	app := New("dev", "", "AxApp/GetTokens")
	account := testOpenAICompatibleAccount("acct_mi", "MI", 9, false, "https://api.example.com/v1", "", []cliproxyapi.OpenAICompatibleAPIKeyEntry{{APIKey: "sk-upstream"}}, nil, []cliproxyapi.OpenAICompatibleModel{{Name: "gpt-test", Alias: "gpt-5.4"}})
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
				return []byte(`{"channel":"codex","routeMode":"balanced","candidates":[{"id":"acct_mi","displayName":"MI","provider":"mi","routeOrder":0}],"filtered":[]}`), 200, nil
			case "/v0/management/gettokens/channel-routing/decisions":
				decisionCalls++
				if decisionCalls == 1 {
					return []byte(`{"items":[]}`), 200, nil
				}
				return []byte(`{"items":[{"id":"route-1","recordedAt":"2026-06-15T12:00:01Z","channel":"codex","model":"gpt-5.4","selectedAccountID":"acct_mi","selectedProvider":"mi","trace":[{"stage":"request","activated":true}]}]}`), 200, nil
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
			return []byte(`{"mi":{"https://api.example.com/v1|sk-upstream":{"success":0,"failed":0}}}`), 200, nil
		case ManagementAPIPrefix + "/gettokens/live-sessions":
			if !used {
				return []byte(`{"generatedAt":"2026-06-15T12:00:00Z","sidecarReady":true,"source":"live","retentionLabel":"30m","summary":{"activeSessions":0,"activeRequests":0},"sessions":[]}`), 200, nil
			}
			return []byte(`{"generatedAt":"2026-06-15T12:00:01Z","sidecarReady":true,"source":"live","retentionLabel":"30m","summary":{"activeSessions":0,"activeRequests":0},"sessions":[{"sessionID":"sess-1","status":"completed","startedAt":"2026-06-15T12:00:00Z","lastEventAt":"2026-06-15T12:00:01Z","durationMs":1000,"requestCount":1,"model":"gpt-5.4","accountKey":"acct_mi","provider":"mi","downstreamTransport":"http","upstreamTransport":"http","recentEvents":[],"requests":[{"requestID":"req-1","sessionID":"sess-1","sequence":1,"model":"gpt-5.4","status":"completed","startedAt":"2026-06-15T12:00:01Z","completedAt":"2026-06-15T12:00:01Z","accountKey":"acct_mi","provider":"mi","downstreamTransport":"http","upstreamTransport":"http","timeline":[]}]}]}`), 200, nil
		default:
			return nil, 404, nil
		}
	}
	app.relayRequest = func(method string, path string, body io.Reader, contentType string, apiKey string, headers map[string]string) ([]byte, int, map[string][]string, error) {
		used = true
		return []byte(`{"choices":[{"message":{"content":"OK"}}]}`), 200, nil, nil
	}

	result, err := app.ProbeCodexAccountRouting(ProbeCodexAccountRoutingInput{Model: "gpt-5.4", Attempts: 1})
	if err != nil {
		t.Fatalf("ProbeCodexAccountRouting returned error: %v", err)
	}
	attempt := result.Attempts[0]
	if attempt.AccountID != "acct_mi" || attempt.Evidence != "route-decision snapshot" {
		t.Fatalf("attempt = %#v, want route-decision evidence", attempt)
	}
}

func TestProbeCodexAccountRoutingSendsRoutePolicyHeaders(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	app := New("dev", "", "AxApp/GetTokens")
	account := testOpenAICompatibleAccount("acct_mi", "MI", 9, false, "https://api.example.com/v1", "", []cliproxyapi.OpenAICompatibleAPIKeyEntry{{APIKey: "sk-upstream"}}, nil, []cliproxyapi.OpenAICompatibleModel{{Name: "gpt-test", Alias: "gpt-5.4"}})
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
			return []byte(`{"mi":{"https://api.example.com/v1|sk-upstream":{"success":0,"failed":0}}}`), 200, nil
		default:
			return nil, 404, nil
		}
	}
	app.relayRequest = func(method string, path string, body io.Reader, contentType string, apiKey string, headers map[string]string) ([]byte, int, map[string][]string, error) {
		_ = method
		_ = path
		_ = body
		_ = contentType
		_ = apiKey
		expectedRouteID := buildStableRouteAuthID("openai-compatibility:mi", "sk-upstream", "https://api.example.com/v1", "")
		if got := headers["X-GetTokens-Route-Allow"]; got != expectedRouteID {
			t.Fatalf("allow header = %q, want %q", got, expectedRouteID)
		}
		if got := headers["X-GetTokens-Route-Deny"]; got != "" {
			t.Fatalf("deny header = %q, want empty", got)
		}
		if got := headers["X-GetTokens-Route-Order"]; got != expectedRouteID {
			t.Fatalf("order header = %q, want %q", got, expectedRouteID)
		}
		if got := headers["X-GetTokens-Route-Fallback"]; got != "false" {
			t.Fatalf("fallback header = %q, want false", got)
		}
		return []byte(`{}`), 200, nil, nil
	}

	_, err := app.ProbeCodexAccountRouting(ProbeCodexAccountRoutingInput{
		Model:           "gpt-5.4",
		Attempts:        1,
		AllowAccountIDs: []string{"acct_mi"},
		OrderAccountIDs: []string{"acct_mi"},
		AllowFallback:   false,
	})
	if err != nil {
		t.Fatalf("ProbeCodexAccountRouting returned error: %v", err)
	}
}

func TestLoadCodexRoutingProbeCandidatesPrefersSidecarExplainOrder(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	app := New("dev", "", "AxApp/GetTokens")
	accountA := testOpenAICompatibleAccount("acct_a", "A", 1, false, "https://api.example.com/v1", "", []cliproxyapi.OpenAICompatibleAPIKeyEntry{{APIKey: "sk-a"}}, nil, []cliproxyapi.OpenAICompatibleModel{{Name: "gpt-a", Alias: "gpt-5.4"}})
	accountB := testOpenAICompatibleAccount("acct_b", "B", 9, false, "https://api.example.com/v1", "", []cliproxyapi.OpenAICompatibleAPIKeyEntry{{APIKey: "sk-b"}}, nil, []cliproxyapi.OpenAICompatibleModel{{Name: "gpt-b", Alias: "gpt-5.4"}})
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
					"channel":"codex",
					"routeMode":"balanced",
					"selectedAccountID":"acct_a",
					"candidates":[
						{"id":"acct_a","displayName":"A from sidecar","provider":"mi","routeOrder":0},
						{"id":"acct_b","displayName":"B from sidecar","provider":"mi","routeOrder":1}
					],
					"filtered":[]
				}`), 200, nil
			default:
				return nil, 404, nil
			}
		})
	}

	candidates, err := app.loadCodexRoutingProbeCandidates("gpt-5.4")
	if err != nil {
		t.Fatalf("loadCodexRoutingProbeCandidates returned error: %v", err)
	}
	if len(candidates) != 2 || candidates[0].ID != "acct_a" || candidates[1].ID != "acct_b" {
		t.Fatalf("candidates = %#v, want sidecar explain order", candidates)
	}
	if candidates[0].Label != "A from sidecar" || candidates[1].Label != "B from sidecar" {
		t.Fatalf("candidates labels = %#v, want sidecar labels", candidates)
	}
}

func TestProbeCodexAccountRoutingSendsAuthFileAllowHeaderFromUnifiedAccountID(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	app := New("dev", "", "AxApp/GetTokens")
	account := cliproxyapi.UnifiedAccount{
		AccountKey: "acct_auth",
		Kind:       cliproxyapi.AccountKindAuthFile,
		Title:      "Codex Plus",
		Provider:   "codex",
		Priority:   8,
		AuthFile: &cliproxyapi.AuthFileAccountCredential{
			SourceFileName: "codex-plus-nightly.json",
			AuthType:       "codex",
			AuthJSON:       `{"type":"codex","access_token":"test"}`,
		},
	}
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
		default:
			return nil, 404, nil
		}
	}
	app.relayRequest = func(method string, path string, body io.Reader, contentType string, apiKey string, headers map[string]string) ([]byte, int, map[string][]string, error) {
		_ = method
		_ = path
		_ = body
		_ = contentType
		_ = apiKey
		if got := headers["X-GetTokens-Route-Allow"]; got != "codex-plus-nightly.json" {
			t.Fatalf("allow header = %q, want codex-plus-nightly.json", got)
		}
		if got := headers["X-GetTokens-Route-Fallback"]; got != "false" {
			t.Fatalf("fallback header = %q, want false", got)
		}
		return []byte(`{"choices":[{"message":{"content":"OK"}}]}`), 200, nil, nil
	}

	_, err := app.ProbeCodexAccountRouting(ProbeCodexAccountRoutingInput{
		Model:           "gpt-5.4",
		Attempts:        1,
		AllowAccountIDs: []string{"acct_auth"},
		OrderAccountIDs: []string{"acct_auth"},
		AllowFallback:   false,
	})
	if err != nil {
		t.Fatalf("ProbeCodexAccountRouting returned error: %v", err)
	}
}

func TestLoadCodexRoutingProbeCandidatesFiltersRuntimeBlockedAccounts(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	app := New("dev", "", "AxApp/GetTokens")
	blocked := cliproxyapi.UnifiedAccount{
		AccountKey: "acct_blocked",
		Kind:       cliproxyapi.AccountKindAuthFile,
		Title:      "Blocked Codex",
		Provider:   "codex",
		Priority:   10,
		AuthFile: &cliproxyapi.AuthFileAccountCredential{
			SourceFileName: "blocked-codex.json",
			AuthType:       "codex",
		},
	}
	available := cliproxyapi.UnifiedAccount{
		AccountKey: "acct_available",
		Kind:       cliproxyapi.AccountKindAuthFile,
		Title:      "Available Codex",
		Provider:   "codex",
		Priority:   1,
		AuthFile: &cliproxyapi.AuthFileAccountCredential{
			SourceFileName: "available-codex.json",
			AuthType:       "codex",
		},
	}
	app.managementAPI = func() *cliproxyapi.Client {
		return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			_ = method
			_ = body
			_ = contentType
			switch path {
			case "/v0/management/accounts":
				return testAccountsResponse(t, blocked, available), 200, nil
			case "/v0/management/gettokens/quota-status":
				if got := query.Get("account_keys"); got != "acct_blocked,acct_available" {
					t.Fatalf("quota account_keys = %q, want blocked and available ids", got)
				}
				return []byte(`{"items":[{"account_key":"acct_blocked","status":"success","blocked":true,"sources":[{"source":"quota-empty","reason":"quota empty: weekly"}]},{"account_key":"acct_available","status":"success","blocked":false,"sources":[]}]}`), 200, nil
			default:
				return nil, 404, nil
			}
		})
	}

	candidates, err := app.loadCodexRoutingProbeCandidates("gpt-5.4")
	if err != nil {
		t.Fatalf("loadCodexRoutingProbeCandidates returned error: %v", err)
	}
	if len(candidates) != 1 || candidates[0].ID != "acct_available" {
		t.Fatalf("candidates = %#v, want only available account", candidates)
	}
}

func TestLoadCodexRoutingProbeCandidatesFiltersPersistedQuotaEmptyRuntimeState(t *testing.T) {
	t.Skip("obsolete: probe does not consume channel runtimeStates")
	t.Setenv("HOME", t.TempDir())

	blocked := cliproxyapi.UnifiedAccount{
		AccountKey: "acct_blocked",
		Kind:       cliproxyapi.AccountKindAuthFile,
		Title:      "Blocked Codex",
		Provider:   "codex",
		Priority:   10,
		AuthFile: &cliproxyapi.AuthFileAccountCredential{
			SourceFileName: "blocked-codex.json",
			AuthType:       "codex",
		},
	}
	available := cliproxyapi.UnifiedAccount{
		AccountKey: "acct_available",
		Kind:       cliproxyapi.AccountKindAuthFile,
		Title:      "Available Codex",
		Provider:   "codex",
		Priority:   1,
		AuthFile: &cliproxyapi.AuthFileAccountCredential{
			SourceFileName: "available-codex.json",
			AuthType:       "codex",
		},
	}

	now := time.Now().UTC()
	store := defaultChannelRoutingStore()
	store.RuntimeStates["acct_blocked"] = ChannelAccountRuntimeState{
		AccountID: "acct_blocked",
		UpdatedAt: now.Format(time.RFC3339Nano),
		Sources: map[string]ChannelRuntimeStateSource{
			"quota-empty": {
				Source:    "quota-empty",
				Reason:    "quota empty: weekly",
				ExpiresAt: now.Add(24 * time.Hour).Format(time.RFC3339Nano),
				UpdatedAt: now.Format(time.RFC3339Nano),
			},
		},
	}
	if err := saveChannelRoutingStore(store); err != nil {
		t.Fatalf("saveChannelRoutingStore: %v", err)
	}

	app := New("dev", "", "AxApp/GetTokens")
	app.managementAPI = func() *cliproxyapi.Client {
		return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			_ = method
			_ = query
			_ = body
			_ = contentType
			switch path {
			case "/v0/management/accounts":
				return testAccountsResponse(t, blocked, available), 200, nil
			case "/v0/management/gettokens/quota-status":
				return []byte(`{"items":[{"account_key":"acct_blocked","status":"stale","blocked":false,"sources":[]},{"account_key":"acct_available","status":"stale","blocked":false,"sources":[]}]}`), 200, nil
			default:
				return nil, 404, nil
			}
		})
	}

	candidates, err := app.loadCodexRoutingProbeCandidates("gpt-5.4")
	if err != nil {
		t.Fatalf("loadCodexRoutingProbeCandidates returned error: %v", err)
	}
	if len(candidates) != 1 || candidates[0].ID != "acct_available" {
		t.Fatalf("candidates = %#v, want persisted quota-empty account filtered out", candidates)
	}
}

func TestLoadCodexRoutingProbeCandidatesSkipsRuntimeUnrouteableAccounts(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	app := New("dev", "", "AxApp/GetTokens")
	split := cliproxyapi.UnifiedAccount{
		AccountKey:                "acct_split",
		Kind:                      cliproxyapi.AccountKindCodexAPIKey,
		Title:                     "Company 1",
		Provider:                  "codex",
		Priority:                  10,
		RuntimeApplyStatus:        "applied",
		RuntimeRouteabilityStatus: "applied_not_registered",
		RuntimeRouteabilityReason: "runtime auth missing from registry",
		CodexAPIKey: &cliproxyapi.CodexAPIKeyAccountCredential{
			APIKey:  "sk-company",
			BaseURL: "https://codex.example.com/v1",
		},
	}
	available := cliproxyapi.UnifiedAccount{
		AccountKey:                   "acct_available",
		Kind:                         cliproxyapi.AccountKindCodexAPIKey,
		Title:                        "Available",
		Provider:                     "codex",
		Priority:                     1,
		RuntimeApplyStatus:           "applied",
		RuntimeRouteabilityStatus:    "registered_routeable",
		RuntimeRegisteredModelsCount: 3,
		CodexAPIKey: &cliproxyapi.CodexAPIKeyAccountCredential{
			APIKey:  "sk-available",
			BaseURL: "https://codex.example.com/v1",
		},
	}
	app.managementAPI = func() *cliproxyapi.Client {
		return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			_ = method
			_ = body
			_ = contentType
			switch path {
			case "/v0/management/accounts":
				return testAccountsResponse(t, split, available), 200, nil
			case "/v0/management/gettokens/quota-status":
				return []byte(`{"items":[{"account_key":"acct_split","status":"success","blocked":false,"sources":[]},{"account_key":"acct_available","status":"success","blocked":false,"sources":[]}]}`), 200, nil
			default:
				return nil, 404, nil
			}
		})
	}

	candidates, err := app.loadCodexRoutingProbeCandidates("gpt-5.4")
	if err != nil {
		t.Fatalf("loadCodexRoutingProbeCandidates returned error: %v", err)
	}
	if len(candidates) != 1 || candidates[0].ID != "acct_available" {
		t.Fatalf("candidates = %#v, want only runtime routeable account", candidates)
	}
}

func TestDetectCodexRoutingProbeHitPrefersCandidateWithUsageIncrease(t *testing.T) {
	candidates := []codexRoutingProbeCandidate{
		{ID: "acct_auth_a", Label: "A"},
		{ID: "acct_mi", Label: "MI"},
	}
	before := codexRoutingUsageSnapshot{
		"acct_auth_a": 1,
		"acct_mi":     10,
	}
	after := codexRoutingUsageSnapshot{
		"acct_auth_a": 1,
		"acct_mi":     11,
	}

	selected, delta, ok := detectCodexRoutingProbeHit(before, after, candidates)
	if !ok {
		t.Fatal("expected selected candidate")
	}
	if selected.ID != "acct_mi" || delta != 1 {
		t.Fatalf("selected = %#v delta=%d", selected, delta)
	}
}

func TestProbeCodexAccountRoutingRequiresModel(t *testing.T) {
	app := New("dev", "", "AxApp/GetTokens")
	if _, err := app.ProbeCodexAccountRouting(ProbeCodexAccountRoutingInput{Model: " "}); err == nil {
		t.Fatal("expected model validation error")
	}
}

func TestSidecarRelayRequestUsesInjectedRelayRequest(t *testing.T) {
	app := New("dev", "", "AxApp/GetTokens")
	app.relayRequest = func(method string, path string, body io.Reader, contentType string, apiKey string, headers map[string]string) ([]byte, int, map[string][]string, error) {
		_ = body
		_ = headers
		if method != "GET" || path != "/v1/models" || contentType != "" || apiKey != "sk-relay" {
			t.Fatalf("unexpected relay call: %s %s %s %s", method, path, contentType, apiKey)
		}
		return []byte(`{}`), 200, map[string][]string{"X-Test": {"ok"}}, nil
	}

	body, status, headers, err := app.SidecarRelayRequest("GET", "/v1/models", nil, "", "sk-relay")
	if err != nil {
		t.Fatalf("SidecarRelayRequest returned error: %v", err)
	}
	if status != 200 || string(body) != `{}` || headers["X-Test"][0] != "ok" {
		t.Fatalf("unexpected response: status=%d body=%s headers=%v", status, body, headers)
	}
}

func TestProbeCodexAccountRoutingClampsAttempts(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	app := New("dev", "", "AxApp/GetTokens")
	account := testOpenAICompatibleAccount("acct_mi", "MI", 9, false, "https://api.example.com/v1", "", []cliproxyapi.OpenAICompatibleAPIKeyEntry{{APIKey: "sk-upstream"}}, nil, nil)
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
			return []byte(`{"mi":{"https://api.example.com/v1|sk-upstream":{"success":0,"failed":0}}}`), 200, nil
		default:
			return nil, 404, nil
		}
	}
	app.relayRequest = func(method string, path string, body io.Reader, contentType string, apiKey string, headers map[string]string) ([]byte, int, map[string][]string, error) {
		_ = method
		_ = path
		_ = body
		_ = contentType
		_ = apiKey
		_ = headers
		return []byte(`{}`), 200, nil, nil
	}

	result, err := app.ProbeCodexAccountRouting(ProbeCodexAccountRoutingInput{Model: "gpt-5.4", Attempts: 99})
	if err != nil {
		t.Fatalf("ProbeCodexAccountRouting returned error: %v", err)
	}
	if len(result.Attempts) != 5 {
		t.Fatalf("attempts len = %d, want 5", len(result.Attempts))
	}
}
