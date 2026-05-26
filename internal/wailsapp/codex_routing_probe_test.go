package wailsapp

import (
	"encoding/json"
	"io"
	"net/url"
	"strings"
	"testing"

	"github.com/linhay/gettokens/internal/cliproxyapi"
)

func TestProbeCodexAccountRoutingDetectsOpenAICompatibleProviderFromUsageDelta(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	used := false
	app := New("dev", "", "AxApp/GetTokens")
	app.managementAPI = func() *cliproxyapi.Client {
		return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			_ = method
			_ = query
			_ = body
			_ = contentType
			switch path {
			case "/v0/management/api-keys":
				return []byte(`{"api-keys":["sk-relay"]}`), 200, nil
			case "/v0/management/openai-compatibility":
				return []byte(`{"openai-compatibility":[{"name":"MI","priority":9,"base-url":"https://api.example.com/v1","api-key-entries":[{"api-key":"sk-upstream"}],"models":[{"name":"gpt-test","alias":"gpt-5.4"}]}]}`), 200, nil
			case "/v0/management/codex-api-key":
				return []byte(`{"codex-api-key":[]}`), 200, nil
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
	if attempt.AccountID != "openai-compatible:MI" {
		t.Fatalf("AccountID = %q, want openai-compatible:MI", attempt.AccountID)
	}
	if attempt.AccountLabel != "MI" || attempt.Provider != "mi" {
		t.Fatalf("unexpected account label/provider: %#v", attempt)
	}
	if !attempt.Success || attempt.StatusCode != 200 {
		t.Fatalf("unexpected attempt status: %#v", attempt)
	}
}

func TestProbeCodexAccountRoutingSendsRoutePolicyHeaders(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	app := New("dev", "", "AxApp/GetTokens")
	app.managementAPI = func() *cliproxyapi.Client {
		return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			_ = method
			_ = query
			_ = body
			_ = contentType
			switch path {
			case "/v0/management/api-keys":
				return []byte(`{"api-keys":["sk-relay"]}`), 200, nil
			case "/v0/management/openai-compatibility":
				return []byte(`{"openai-compatibility":[{"name":"MI","priority":9,"base-url":"https://api.example.com/v1","api-key-entries":[{"api-key":"sk-upstream"}],"models":[{"name":"gpt-test","alias":"gpt-5.4"}]}]}`), 200, nil
			case "/v0/management/codex-api-key":
				return []byte(`{"codex-api-key":[]}`), 200, nil
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
		if got := headers["X-GetTokens-Route-Order"]; got != "" {
			t.Fatalf("order header = %q, want empty", got)
		}
		if got := headers["X-GetTokens-Route-Fallback"]; got != "false" {
			t.Fatalf("fallback header = %q, want false", got)
		}
		return []byte(`{}`), 200, nil, nil
	}

	_, err := app.ProbeCodexAccountRouting(ProbeCodexAccountRoutingInput{
		Model:           "gpt-5.4",
		Attempts:        1,
		AllowAccountIDs: []string{"openai-compatible:MI"},
		OrderAccountIDs: []string{"openai-compatible:MI"},
		AllowFallback:   false,
	})
	if err != nil {
		t.Fatalf("ProbeCodexAccountRouting returned error: %v", err)
	}
}

func TestDetectCodexRoutingProbeHitPrefersCandidateWithUsageIncrease(t *testing.T) {
	candidates := []codexRoutingProbeCandidate{
		{ID: "auth-file:a.json", Label: "A"},
		{ID: "openai-compatible:MI", Label: "MI"},
	}
	before := codexRoutingUsageSnapshot{
		"auth-file:a.json":     1,
		"openai-compatible:MI": 10,
	}
	after := codexRoutingUsageSnapshot{
		"auth-file:a.json":     1,
		"openai-compatible:MI": 11,
	}

	selected, delta, ok := detectCodexRoutingProbeHit(before, after, candidates)
	if !ok {
		t.Fatal("expected selected candidate")
	}
	if selected.ID != "openai-compatible:MI" || delta != 1 {
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
	app.managementAPI = func() *cliproxyapi.Client {
		return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			_ = method
			_ = query
			_ = body
			_ = contentType
			switch path {
			case "/v0/management/api-keys":
				return []byte(`{"api-keys":["sk-relay"]}`), 200, nil
			case "/v0/management/openai-compatibility":
				return []byte(`{"openai-compatibility":[{"name":"MI","priority":9,"base-url":"https://api.example.com/v1","api-key-entries":[{"api-key":"sk-upstream"}]}]}`), 200, nil
			case "/v0/management/codex-api-key":
				return []byte(`{"codex-api-key":[]}`), 200, nil
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
