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
		"expired.json":     {},
		"fresh-login.json": {},
	}
	const freshContent = `{"type":"codex","access_token":"fresh-access","refresh_token":"fresh-refresh"}`
	const existingContent = `{"type":"codex","access_token":"expired-access","priority":6}`

	var patchedAuthJSON string

	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			switch {
			case method == http.MethodGet && path == ManagementAPIPrefix+"/accounts":
				accounts := make([]map[string]any, 0, len(existingNames))
				for name := range existingNames {
					accountKey := "acct_expired"
					authJSON := existingContent
					if name == "fresh-login.json" {
						accountKey = "acct_fresh"
						authJSON = freshContent
					}
					accounts = append(accounts, map[string]any{
						"account_key": accountKey,
						"kind":        "auth-file",
						"title":       name,
						"provider":    "codex",
						"priority":    0,
						"disabled":    false,
						"auth_file": map[string]any{
							"source_file_name": name,
							"auth_json":        authJSON,
							"auth_type":        "codex",
							"email":            "tester@example.com",
							"plan_type":        "plus",
						},
					})
				}
				payload, _ := json.Marshal(map[string]any{"accounts": accounts})
				return payload, http.StatusOK, nil
			case method == http.MethodPatch && path == ManagementAPIPrefix+"/accounts/acct_expired":
				raw, err := io.ReadAll(body)
				if err != nil {
					t.Fatalf("ReadAll patch body: %v", err)
				}
				var payload struct {
					AuthFile struct {
						AuthJSON string `json:"auth_json"`
					} `json:"auth_file"`
				}
				if err := json.Unmarshal(raw, &payload); err != nil {
					t.Fatalf("Unmarshal patch body: %v", err)
				}
				patchedAuthJSON = payload.AuthFile.AuthJSON
				response, _ := json.Marshal(map[string]any{
					"account_key": "acct_expired",
					"kind":        "auth-file",
					"title":       "expired.json",
					"provider":    "codex",
					"auth_file": map[string]any{
						"source_file_name": "expired.json",
						"auth_json":        patchedAuthJSON,
						"auth_type":        "codex",
					},
				})
				return response, http.StatusOK, nil
			case method == http.MethodDelete && path == ManagementAPIPrefix+"/accounts/acct_fresh":
				delete(existingNames, "fresh-login.json")
				return []byte(`{"ok":true}`), http.StatusOK, nil
			case strings.HasPrefix(path, ManagementAPIPrefix+"/auth-files"):
				t.Fatalf("FinalizeCodexOAuth must not call deprecated auth-files endpoint: %s %s", method, path)
				return nil, 0, nil
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
	if !strings.Contains(patchedAuthJSON, `"access_token": "fresh-access"`) {
		t.Fatalf("patched auth_json should contain new auth content: %s", patchedAuthJSON)
	}
	if !strings.Contains(patchedAuthJSON, `"priority": 6`) {
		t.Fatalf("patched auth_json should preserve old priority: %s", patchedAuthJSON)
	}
}

func TestFinalizeCodexOAuthAcceptsAccountStoreInPlaceUpdate(t *testing.T) {
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			switch {
			case method == http.MethodGet && path == ManagementAPIPrefix+"/accounts":
				return []byte(`{"accounts":[{"account_key":"acct_existing","kind":"auth-file","title":"expired.json","provider":"codex","priority":6,"disabled":false,"auth_file":{"source_file_name":"expired.json","auth_json":"{\"type\":\"codex\",\"access_token\":\"fresh-access\",\"refresh_token\":\"fresh-refresh\",\"email\":\"tester@example.com\",\"plan_type\":\"plus\"}","auth_type":"codex","email":"tester@example.com","plan_type":"plus"}}]}`), http.StatusOK, nil
			case strings.HasPrefix(path, ManagementAPIPrefix+"/auth-files"):
				t.Fatalf("FinalizeCodexOAuth must not call deprecated auth-files endpoint: %s %s", method, path)
				return nil, 0, nil
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

func TestResolveReplacementCodexAuthFileNamePrefersMatchingEmail(t *testing.T) {
	got, err := resolveReplacementCodexAuthFileName("expired.json", []string{"expired.json"}, []AuthFileItem{
		{Name: "expired.json", Provider: "codex", Type: "codex", Email: "ops@example.com"},
		{Name: "fresh-login.json", Provider: "unknown", Type: "unknown", Email: "ops@example.com"},
		{Name: "fresh-other.json", Provider: "codex", Type: "codex", Email: "other@example.com"},
	})
	if err != nil {
		t.Fatalf("resolveReplacementCodexAuthFileName returned error: %v", err)
	}
	if got != "fresh-login.json" {
		t.Fatalf("resolveReplacementCodexAuthFileName() = %q, want fresh-login.json", got)
	}
}
