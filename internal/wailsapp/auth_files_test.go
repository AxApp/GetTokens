package wailsapp

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

func TestIsUnknownKind(t *testing.T) {
	tests := []struct {
		name  string
		value string
		want  bool
	}{
		{name: "empty", value: "", want: true},
		{name: "spaces", value: "   ", want: true},
		{name: "unknown", value: "unknown", want: true},
		{name: "unknown mixed case", value: " Unknown ", want: true},
		{name: "known provider", value: "codex", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isUnknownKind(tt.value); got != tt.want {
				t.Fatalf("isUnknownKind(%q) = %v, want %v", tt.value, got, tt.want)
			}
		})
	}
}

func TestNeedsAuthFileKindInference(t *testing.T) {
	tests := []struct {
		name string
		file AuthFileItem
		want bool
	}{
		{
			name: "provider unknown",
			file: AuthFileItem{Provider: "unknown", Type: "codex"},
			want: true,
		},
		{
			name: "type unknown",
			file: AuthFileItem{Provider: "codex", Type: ""},
			want: true,
		},
		{
			name: "both known",
			file: AuthFileItem{Provider: "codex", Type: "codex"},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := needsAuthFileKindInference(tt.file); got != tt.want {
				t.Fatalf("needsAuthFileKindInference(%+v) = %v, want %v", tt.file, got, tt.want)
			}
		})
	}
}

func TestNeedsAuthFileMetadataInference(t *testing.T) {
	tests := []struct {
		name string
		file AuthFileItem
		want bool
	}{
		{
			name: "missing email",
			file: AuthFileItem{Provider: "codex", Type: "codex", PlanType: "plus"},
			want: true,
		},
		{
			name: "missing plan type",
			file: AuthFileItem{Provider: "codex", Type: "codex", Email: "user@example.com"},
			want: true,
		},
		{
			name: "all metadata present",
			file: AuthFileItem{Provider: "codex", Type: "codex", Priority: 5, Email: "user@example.com", PlanType: "plus"},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := needsAuthFileMetadataInference(tt.file); got != tt.want {
				t.Fatalf("needsAuthFileMetadataInference(%+v) = %v, want %v", tt.file, got, tt.want)
			}
		})
	}
}

func TestUniqueAuthFileUploadName(t *testing.T) {
	existing := map[string]struct{}{
		"auth.json": {},
	}

	first := uniqueAuthFileUploadName("auth.json", existing)
	second := uniqueAuthFileUploadName("auth.json", existing)
	third := uniqueAuthFileUploadName("session", existing)

	if first != "auth-2.json" {
		t.Fatalf("unexpected first candidate: %q", first)
	}
	if second != "auth-3.json" {
		t.Fatalf("unexpected second candidate: %q", second)
	}
	if third != "session.json" {
		t.Fatalf("unexpected third candidate: %q", third)
	}
}

func TestUpdateAuthFilePriorityPreservesDisabledStatus(t *testing.T) {
	const fileName = "disabled.json"
	const originalBody = `{"type":"codex","access_token":"token","priority":2}`

	existingNames := map[string]struct{}{
		fileName: {},
	}
	disabledByName := map[string]bool{
		fileName: true,
	}
	statusPatched := false

	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			switch {
			case method == http.MethodGet && path == ManagementAPIPrefix+"/auth-files":
				files := make([]map[string]any, 0, len(existingNames))
				for name := range existingNames {
					files = append(files, map[string]any{
						"name":     name,
						"disabled": disabledByName[name],
						"provider": "codex",
						"type":     "codex",
						"email":    "tester@example.com",
						"planType": "plus",
						"priority": 2,
					})
				}
				payload, _ := json.Marshal(map[string]any{"files": files, "total": len(files)})
				return payload, http.StatusOK, nil
			case method == http.MethodGet && path == ManagementAPIPrefix+"/auth-files/download":
				if got := query.Get("name"); got != fileName {
					t.Fatalf("download name = %q, want %q", got, fileName)
				}
				return []byte(originalBody), http.StatusOK, nil
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
					delete(disabledByName, name)
				}
				return []byte(`{"status":"ok"}`), http.StatusOK, nil
			case method == http.MethodPost && path == ManagementAPIPrefix+"/auth-files":
				raw, err := io.ReadAll(body)
				if err != nil {
					t.Fatalf("ReadAll upload body: %v", err)
				}
				if !strings.Contains(string(raw), `"priority":7`) {
					t.Fatalf("upload body should contain updated priority: %s", raw)
				}
				existingNames[fileName] = struct{}{}
				disabledByName[fileName] = false
				return []byte(`{"status":"ok"}`), http.StatusOK, nil
			case method == http.MethodPatch && path == ManagementAPIPrefix+"/auth-files/status":
				raw, err := io.ReadAll(body)
				if err != nil {
					t.Fatalf("ReadAll patch body: %v", err)
				}
				var payload struct {
					Name     string `json:"name"`
					Disabled bool   `json:"disabled"`
				}
				if err := json.Unmarshal(raw, &payload); err != nil {
					t.Fatalf("Unmarshal patch body: %v", err)
				}
				if payload.Name != fileName {
					t.Fatalf("patched name = %q, want %q", payload.Name, fileName)
				}
				if !payload.Disabled {
					t.Fatalf("patched disabled = %v, want true", payload.Disabled)
				}
				disabledByName[fileName] = true
				statusPatched = true
				return []byte(`{"status":"ok"}`), http.StatusOK, nil
			default:
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 0, nil
			}
		},
	}

	if err := app.updateAuthFilePriority(fileName, 7); err != nil {
		t.Fatalf("updateAuthFilePriority: %v", err)
	}

	if !statusPatched {
		t.Fatal("expected disabled status to be restored after replacing auth file")
	}
	if !disabledByName[fileName] {
		t.Fatal("disabled status should remain true after priority update")
	}
}
