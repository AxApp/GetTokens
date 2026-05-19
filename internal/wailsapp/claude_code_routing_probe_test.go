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
				return []byte(`{"openai-compatibility":[{"name":"mimo","priority":9,"base-url":"https://platform.xiaomimimo.com/v1","api-key-entries":[{"api-key":"sk-upstream","proxy-url":"direct"}],"models":[{"name":"mimo-v2.5-pro","alias":"claude-sonnet-4-6"}]}]}`), 200, nil
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
		AllowAccountIDs: []string{"openai-compatible:mimo"},
		OrderAccountIDs: []string{"openai-compatible:mimo"},
	})
	if err != nil {
		t.Fatalf("ProbeClaudeCodeAccountRouting returned error: %v", err)
	}
	if len(result.Attempts) != 1 {
		t.Fatalf("attempts len = %d, want 1", len(result.Attempts))
	}
	attempt := result.Attempts[0]
	if attempt.AccountID != "openai-compatible:mimo" || attempt.Provider != "mimo" || !attempt.Success {
		t.Fatalf("unexpected attempt: %#v", attempt)
	}
}

func TestProbeClaudeCodeAccountRoutingFiltersNonAnthropicAccounts(t *testing.T) {
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
				return []byte(`{"openai-compatibility":[{"name":"copilot","priority":9,"base-url":"https://api.githubcopilot.com","api-key-entries":[{"api-key":"sk-copilot"}]}]}`), 200, nil
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

func TestProbeClaudeCodeAccountRoutingRequiresModel(t *testing.T) {
	app := New("dev", "", "AxApp/GetTokens")
	if _, err := app.ProbeClaudeCodeAccountRouting(ProbeClaudeCodeAccountRoutingInput{Model: " "}); err == nil {
		t.Fatal("expected model validation error")
	}
}
