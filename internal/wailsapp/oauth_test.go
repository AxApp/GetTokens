package wailsapp

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

func TestStartCodexOAuthReturnsAuthURLAndState(t *testing.T) {
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			if method != http.MethodGet {
				t.Fatalf("unexpected method: %s", method)
			}
			if path != ManagementAPIPrefix+"/codex-auth-url" {
				t.Fatalf("unexpected path: %s", path)
			}
			if got := query.Get("is_webui"); got != "true" {
				t.Fatalf("is_webui = %q, want true", got)
			}
			return []byte(`{"status":"ok","url":"https://auth.openai.com/authorize","state":"oauth-state-123"}`), http.StatusOK, nil
		},
	}

	result, err := app.StartCodexOAuth()
	if err != nil {
		t.Fatalf("StartCodexOAuth returned error: %v", err)
	}

	if result.URL != "https://auth.openai.com/authorize" {
		t.Fatalf("URL = %q, want auth url", result.URL)
	}
	if result.State != "oauth-state-123" {
		t.Fatalf("State = %q, want oauth-state-123", result.State)
	}
}

func TestFinalizeCodexOAuthReplacesExistingAuthFile(t *testing.T) {
	existingNames := map[string]struct{}{
		"expired.json":   {},
		"fresh-login.json": {},
	}
	const freshContent = `{"type":"codex","access_token":"fresh-access","refresh_token":"fresh-refresh"}`

	var uploadedBody string

	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			switch {
			case method == http.MethodGet && path == ManagementAPIPrefix+"/auth-files":
				files := make([]map[string]any, 0, len(existingNames))
				for name := range existingNames {
					files = append(files, map[string]any{
						"name":       name,
						"provider":   "codex",
						"type":       "codex",
						"email":      "tester@example.com",
						"planType":   "plus",
						"status":     "active",
						"disabled":   false,
						"runtimeOnly": false,
					})
				}
				payload, _ := json.Marshal(map[string]any{"files": files, "total": len(files)})
				return payload, http.StatusOK, nil
			case method == http.MethodGet && path == ManagementAPIPrefix+"/auth-files/download":
				if got := query.Get("name"); got != "fresh-login.json" {
					t.Fatalf("download name = %q, want fresh-login.json", got)
				}
				return []byte(freshContent), http.StatusOK, nil
			case method == http.MethodDelete && path == ManagementAPIPrefix+"/auth-files":
				raw, err := io.ReadAll(body)
				if err != nil {
					t.Fatalf("ReadAll delete body: %v", err)
				}
				var payload struct {
					Names []string `json:"names"`
				}
				if err := json.Unmarshal(raw, &payload); err != nil {
					t.Fatalf("Unmarshal delete body: %v", err)
				}
				for _, name := range payload.Names {
					delete(existingNames, name)
				}
				return []byte(`{"status":"ok"}`), http.StatusOK, nil
			case method == http.MethodPost && path == ManagementAPIPrefix+"/auth-files":
				raw, err := io.ReadAll(body)
				if err != nil {
					t.Fatalf("ReadAll upload body: %v", err)
				}
				uploadedBody = string(raw)
				existingNames["expired.json"] = struct{}{}
				return []byte(`{"status":"ok"}`), http.StatusOK, nil
			default:
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 0, nil
			}
		},
	}

	err := app.FinalizeCodexOAuth(CompleteCodexOAuthInput{
		ExistingName:  "expired.json",
		PreviousNames: []string{"expired.json"},
	})
	if err != nil {
		t.Fatalf("FinalizeCodexOAuth returned error: %v", err)
	}

	if _, ok := existingNames["fresh-login.json"]; ok {
		t.Fatalf("fresh-login.json should be deleted after replacement")
	}
	if _, ok := existingNames["expired.json"]; !ok {
		t.Fatalf("expired.json should exist after replacement")
	}
	if !strings.Contains(uploadedBody, `filename="expired.json"`) {
		t.Fatalf("upload body should keep original file name: %s", uploadedBody)
	}
	if !strings.Contains(uploadedBody, `"access_token":"fresh-access"`) {
		t.Fatalf("upload body should contain new auth content: %s", uploadedBody)
	}
}

func TestResolveReplacementCodexAuthFileNameRejectsAmbiguousResults(t *testing.T) {
	_, err := resolveReplacementCodexAuthFileName("expired.json", []string{"expired.json"}, []AuthFileItem{
		{Name: "fresh-a.json", Provider: "codex", Type: "codex"},
		{Name: "fresh-b.json", Provider: "codex", Type: "codex"},
	})
	if err == nil {
		t.Fatal("expected ambiguity error, got nil")
	}
}
