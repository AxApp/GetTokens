package wailsapp

import (
	"encoding/json"
	"io"
	"net/url"
	"strings"
	"testing"

	"github.com/linhay/gettokens/internal/cliproxyapi"
)

func TestRequestOrchestrationConfigRoundTrip(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	app := &App{}
	config := RequestOrchestrationConfig{
		ActiveFlowID: "default",
		Flows: []RequestOrchestrationFlowConfig{
			{
				ID:                "default",
				Label:             "默认组",
				CLI:               "codex",
				GroupID:           "codex",
				AccountID:         "auth-file:codex-main",
				EnabledAccountIDs: []string{"auth-file:codex-main"},
				Routes:            map[string]string{"auth-file:codex-main": ""},
			},
		},
	}

	saved, err := app.SaveRequestOrchestrationConfig(config)
	if err != nil {
		t.Fatalf("SaveRequestOrchestrationConfig: %v", err)
	}
	loaded, err := app.GetRequestOrchestrationConfig()
	if err != nil {
		t.Fatalf("GetRequestOrchestrationConfig: %v", err)
	}

	if saved.ActiveFlowID != "default" || loaded.ActiveFlowID != "default" {
		t.Fatalf("unexpected active flow: saved=%q loaded=%q", saved.ActiveFlowID, loaded.ActiveFlowID)
	}
	if len(loaded.Flows) != 1 || loaded.Flows[0].EnabledAccountIDs[0] != "auth-file:codex-main" {
		t.Fatalf("unexpected loaded config: %#v", loaded)
	}
}

func TestApplyAndRestoreRequestOrchestrationDisablesNonParticipants(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	authStatus := map[string]bool{
		"codex-main":  false,
		"claude-main": true,
	}
	providers := []cliproxyapi.OpenAICompatibleProvider{
		{
			Name:          "deepseek",
			BaseURL:       "https://api.deepseek.com/v1",
			APIKeyEntries: []cliproxyapi.OpenAICompatibleAPIKeyEntry{{APIKey: "sk-test"}},
			Disabled:      false,
		},
	}
	var routingYAML string
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			switch {
			case method == "GET" && path == "/v0/management/config":
				return []byte(`{"request-retry":2,"max-retry-credentials":3,"max-retry-interval":4,"routing":{"strategy":"round-robin","session-affinity":true,"session-affinity-ttl":"20m"},"quota-exceeded":{"switch-project":true,"switch-preview-model":false,"antigravity-credits":false}}`), 200, nil
			case method == "GET" && path == "/v0/management/config.yaml":
				return []byte("routing:\n  strategy: round-robin\n  session-affinity: true\nrequest-retry: 2\n"), 200, nil
			case method == "PUT" && path == "/v0/management/config.yaml":
				payload, err := io.ReadAll(body)
				if err != nil {
					t.Fatalf("read routing yaml: %v", err)
				}
				routingYAML = string(payload)
				return nil, 200, nil
			case method == "GET" && path == "/v0/management/auth-files":
				payload := `{"files":[{"name":"codex-main","type":"codex","provider":"codex","email":"codex@example.com","planType":"pro","priority":1,"disabled":` + boolJSON(authStatus["codex-main"]) + `},{"name":"claude-main","type":"anthropic","provider":"anthropic","email":"claude@example.com","planType":"pro","priority":2,"disabled":` + boolJSON(authStatus["claude-main"]) + `}]}`
				return []byte(payload), 200, nil
			case method == "PATCH" && path == "/v0/management/auth-files/status":
				var payload struct {
					Name     string `json:"name"`
					Disabled bool   `json:"disabled"`
				}
				if err := json.NewDecoder(body).Decode(&payload); err != nil {
					t.Fatalf("decode auth status patch: %v", err)
				}
				authStatus[payload.Name] = payload.Disabled
				return nil, 200, nil
			default:
				t.Fatalf("unexpected sidecar request: %s %s", method, path)
				return nil, 0, nil
			}
		},
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				switch {
				case method == "GET" && path == "/v0/management/codex-api-key":
					return []byte(`{"codex-api-key":[]}`), 200, nil
				case method == "GET" && path == "/v0/management/openai-compatibility":
					body, err := json.Marshal(map[string]any{"openai-compatibility": providers})
					if err != nil {
						t.Fatalf("marshal providers: %v", err)
					}
					return body, 200, nil
				case method == "PUT" && path == "/v0/management/openai-compatibility":
					payload, err := io.ReadAll(body)
					if err != nil {
						t.Fatalf("read providers payload: %v", err)
					}
					var next []cliproxyapi.OpenAICompatibleProvider
					if err := json.Unmarshal(payload, &next); err != nil {
						t.Fatalf("unmarshal providers payload: %v", err)
					}
					providers = next
					return nil, 200, nil
				default:
					t.Fatalf("unexpected management request: %s %s", method, path)
					return nil, 0, nil
				}
			})
		},
	}

	_, err := app.SaveRequestOrchestrationConfig(RequestOrchestrationConfig{
		ActiveFlowID: "default",
		Flows: []RequestOrchestrationFlowConfig{
			{
				ID:                "default",
				Label:             "默认组",
				CLI:               "codex",
				GroupID:           "codex",
				AccountID:         "auth-file:codex-main",
				EnabledAccountIDs: []string{"auth-file:codex-main"},
			},
		},
	})
	if err != nil {
		t.Fatalf("SaveRequestOrchestrationConfig: %v", err)
	}

	applyResult, err := app.ApplyRequestOrchestration()
	if err != nil {
		t.Fatalf("ApplyRequestOrchestration: %v", err)
	}
	if applyResult.AppliedFlowID != "default" || applyResult.EnabledCount != 1 || applyResult.DisabledCount != 2 {
		t.Fatalf("unexpected apply result: %#v", applyResult)
	}
	if authStatus["codex-main"] {
		t.Fatal("codex-main should remain enabled")
	}
	if !authStatus["claude-main"] {
		t.Fatal("claude-main should be disabled by apply")
	}
	if len(providers) != 1 || !providers[0].Disabled {
		t.Fatalf("deepseek provider should be disabled by apply: %#v", providers)
	}

	snapshot, err := app.GetRequestOrchestrationSnapshot()
	if err != nil {
		t.Fatalf("GetRequestOrchestrationSnapshot: %v", err)
	}
	if !snapshot.Applied || snapshot.Routing.Strategy != "round-robin" {
		t.Fatalf("unexpected snapshot: %#v", snapshot)
	}
	for _, account := range snapshot.Accounts {
		if account.ID == "openai-compatible:deepseek" && account.Disabled {
			t.Fatalf("snapshot should preserve original provider enabled state: %#v", snapshot.Accounts)
		}
	}

	restoreResult, err := app.RestoreRequestOrchestration()
	if err != nil {
		t.Fatalf("RestoreRequestOrchestration: %v", err)
	}
	if restoreResult.RestoredCount != 3 {
		t.Fatalf("unexpected restore result: %#v", restoreResult)
	}
	if authStatus["codex-main"] || !authStatus["claude-main"] {
		t.Fatalf("auth statuses not restored: %#v", authStatus)
	}
	if providers[0].Disabled {
		t.Fatalf("provider status not restored: %#v", providers)
	}
	if !strings.Contains(routingYAML, "strategy: round-robin") || !strings.Contains(routingYAML, "session-affinity: true") {
		t.Fatalf("routing yaml was not restored: %s", routingYAML)
	}
}

func boolJSON(value bool) string {
	if value {
		return "true"
	}
	return "false"
}
