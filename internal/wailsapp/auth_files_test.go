package wailsapp

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/url"
	"strconv"
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

func TestListAuthFilesCachesInferredMetadataAcrossRepeatedCalls(t *testing.T) {
	app := New("", "", "")
	downloadCount := 0
	app.sidecarRequest = func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		switch {
		case method == http.MethodGet && path == ManagementAPIPrefix+"/auth-files":
			return []byte(`{"files":[{"name":"codex-team.json","type":"unknown","provider":"unknown","size":91,"modified":1760000000}],"total":1}`), http.StatusOK, nil
		case method == http.MethodGet && path == ManagementAPIPrefix+"/auth-files/download":
			if got := query.Get("name"); got != "codex-team.json" {
				t.Fatalf("download name = %q, want codex-team.json", got)
			}
			downloadCount++
			return []byte(`{"type":"codex","email":"team@example.com","plan_type":"plus","priority":7}`), http.StatusOK, nil
		default:
			t.Fatalf("unexpected request: %s %s", method, path)
			return nil, 0, nil
		}
	}

	first, err := app.ListAuthFiles()
	if err != nil {
		t.Fatalf("first ListAuthFiles: %v", err)
	}
	second, err := app.ListAuthFiles()
	if err != nil {
		t.Fatalf("second ListAuthFiles: %v", err)
	}

	if downloadCount != 1 {
		t.Fatalf("download count = %d, want 1", downloadCount)
	}
	for label, response := range map[string]*AuthFilesResponse{"first": first, "second": second} {
		if len(response.Files) != 1 {
			t.Fatalf("%s files = %d, want 1", label, len(response.Files))
		}
		file := response.Files[0]
		if file.Provider != "codex" || file.Type != "codex" || file.Email != "team@example.com" || file.PlanType != "plus" || file.Priority != 7 {
			t.Fatalf("%s file metadata not inferred from cache/content: %#v", label, file)
		}
	}
}

func TestListAuthFilesDoesNotRedownloadWhenCachedMetadataRemainsIncomplete(t *testing.T) {
	app := New("", "", "")
	downloadCount := 0
	app.sidecarRequest = func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		switch {
		case method == http.MethodGet && path == ManagementAPIPrefix+"/auth-files":
			return []byte(`{"files":[{"name":"codex-minimal.json","type":"unknown","provider":"unknown","size":42,"modified":1760000000}],"total":1}`), http.StatusOK, nil
		case method == http.MethodGet && path == ManagementAPIPrefix+"/auth-files/download":
			downloadCount++
			return []byte(`{"type":"codex"}`), http.StatusOK, nil
		default:
			t.Fatalf("unexpected request: %s %s", method, path)
			return nil, 0, nil
		}
	}

	first, err := app.ListAuthFiles()
	if err != nil {
		t.Fatalf("first ListAuthFiles: %v", err)
	}
	second, err := app.ListAuthFiles()
	if err != nil {
		t.Fatalf("second ListAuthFiles: %v", err)
	}

	if downloadCount != 1 {
		t.Fatalf("download count = %d, want 1 after incomplete metadata is cached", downloadCount)
	}
	for label, response := range map[string]*AuthFilesResponse{"first": first, "second": second} {
		file := response.Files[0]
		if file.Provider != "codex" || file.Type != "codex" {
			t.Fatalf("%s provider/type = %q/%q, want codex/codex", label, file.Provider, file.Type)
		}
	}
}

func TestListAuthFilesRefreshesMetadataCacheWhenFingerprintChanges(t *testing.T) {
	app := New("", "", "")
	downloadCount := 0
	modified := int64(1760000000)
	app.sidecarRequest = func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		switch {
		case method == http.MethodGet && path == ManagementAPIPrefix+"/auth-files":
			payload, _ := json.Marshal(map[string]any{
				"files": []map[string]any{{
					"name":     "codex-team.json",
					"type":     "unknown",
					"provider": "unknown",
					"size":     91,
					"modified": modified,
				}},
				"total": 1,
			})
			return payload, http.StatusOK, nil
		case method == http.MethodGet && path == ManagementAPIPrefix+"/auth-files/download":
			downloadCount++
			if downloadCount == 1 {
				return []byte(`{"type":"codex","email":"team@example.com","plan_type":"plus","priority":7}`), http.StatusOK, nil
			}
			return []byte(`{"type":"codex","email":"team@example.com","plan_type":"pro","priority":9}`), http.StatusOK, nil
		default:
			t.Fatalf("unexpected request: %s %s", method, path)
			return nil, 0, nil
		}
	}

	first, err := app.ListAuthFiles()
	if err != nil {
		t.Fatalf("first ListAuthFiles: %v", err)
	}
	modified = 1760000001
	second, err := app.ListAuthFiles()
	if err != nil {
		t.Fatalf("second ListAuthFiles: %v", err)
	}

	if downloadCount != 2 {
		t.Fatalf("download count = %d, want 2 after fingerprint change", downloadCount)
	}
	if first.Files[0].PlanType != "plus" || first.Files[0].Priority != 7 {
		t.Fatalf("first metadata = %#v, want plus priority 7", first.Files[0])
	}
	if second.Files[0].PlanType != "pro" || second.Files[0].Priority != 9 {
		t.Fatalf("second metadata = %#v, want pro priority 9", second.Files[0])
	}
}

func TestAuthFileMetadataCacheUsesNameForIdentityAndFingerprintForFreshness(t *testing.T) {
	app := New("", "", "")
	first := AuthFileItem{
		Name:     " codex-team.json ",
		Size:     91,
		Modified: 1760000000,
		Type:     "codex",
		Provider: "codex",
		Email:    "team@example.com",
		PlanType: "plus",
		Priority: 7,
	}
	second := first
	second.Size = 92
	second.Modified = 1760000001
	second.PlanType = "pro"
	second.Priority = 9

	app.storeAuthFileMetadata(first)
	if _, ok := app.cachedAuthFileMetadata(AuthFileItem{Name: "codex-team.json", Size: 91, Modified: 1760000000}); !ok {
		t.Fatal("expected original fingerprint to hit the metadata cache")
	}

	app.storeAuthFileMetadata(second)
	if len(app.authFileMetadataCache) != 1 {
		t.Fatalf("metadata cache entries = %d, want 1 keyed by auth-file name", len(app.authFileMetadataCache))
	}
	if _, ok := app.cachedAuthFileMetadata(AuthFileItem{Name: "codex-team.json", Size: 91, Modified: 1760000000}); ok {
		t.Fatal("old fingerprint should miss after the same auth-file name is refreshed")
	}
	cached, ok := app.cachedAuthFileMetadata(AuthFileItem{Name: "codex-team.json", Size: 92, Modified: 1760000001})
	if !ok {
		t.Fatal("expected refreshed fingerprint to hit the metadata cache")
	}
	if cached.PlanType != "pro" || cached.Priority != 9 {
		t.Fatalf("cached metadata = %#v, want refreshed pro priority 9", cached)
	}
}

func BenchmarkAuthFileMetadataCacheSameNameFingerprintChurn(b *testing.B) {
	files := buildAuthFileMetadataCacheBenchmarkFiles(10_000)
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		app := New("", "", "")
		for _, file := range files {
			app.storeAuthFileMetadata(file)
		}
		if got := len(app.authFileMetadataCache); got != 1 {
			b.Fatalf("metadata cache entries = %d, want 1 keyed by auth-file name", got)
		}
	}
}

func BenchmarkAuthFileMetadataCacheCompositeKeyFingerprintChurnBaseline(b *testing.B) {
	files := buildAuthFileMetadataCacheBenchmarkFiles(10_000)
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		cache := map[string]authFileMetadataCacheEntry{}
		for _, file := range files {
			name := authFileMetadataCacheName(file.Name)
			cache[authFileMetadataCompositeKeyBaseline(name, file.Size, file.Modified)] = authFileMetadataCacheEntry{
				Name:        name,
				Fingerprint: authFileMetadataFingerprintFor(file),
				Type:        file.Type,
				Provider:    file.Provider,
				Priority:    file.Priority,
				Email:       file.Email,
				PlanType:    file.PlanType,
			}
		}
		if got := len(cache); got != len(files) {
			b.Fatalf("baseline metadata cache entries = %d, want %d", got, len(files))
		}
	}
}

func buildAuthFileMetadataCacheBenchmarkFiles(count int) []AuthFileItem {
	files := make([]AuthFileItem, 0, count)
	for index := 0; index < count; index++ {
		files = append(files, AuthFileItem{
			Name:     "codex-team.json",
			Size:     int64(91 + index),
			Modified: int64(1760000000 + index),
			Type:     "codex",
			Provider: "codex",
			Email:    "team@example.com",
			PlanType: "plus",
			Priority: 7,
		})
	}
	return files
}

func authFileMetadataCompositeKeyBaseline(name string, size int64, modified int64) string {
	return name + "|" + strconv.FormatInt(size, 10) + "|" + strconv.FormatInt(modified, 10)
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

func TestUploadAuthFilesConvertsChatGPTSessionToCPA(t *testing.T) {
	const sessionBody = `{
  "user": {"id": "user_123", "email": "tester@example.com"},
  "expires": "2026-08-06T14:29:36.155Z",
  "account": {"id": "acct_123", "planType": "plus"},
  "accessToken": "access-token",
  "sessionToken": "session-token"
}`

	var uploadedName string
	var uploadedPayload map[string]interface{}

	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			switch {
			case method == http.MethodGet && path == ManagementAPIPrefix+"/auth-files":
				return []byte(`{"files":[],"total":0}`), http.StatusOK, nil
			case method == http.MethodPost && path == ManagementAPIPrefix+"/auth-files":
				_, params, err := mime.ParseMediaType(contentType)
				if err != nil {
					t.Fatalf("ParseMediaType: %v", err)
				}
				reader := multipart.NewReader(body, params["boundary"])
				part, err := reader.NextPart()
				if err != nil {
					t.Fatalf("NextPart: %v", err)
				}
				uploadedName = part.FileName()
				raw, err := io.ReadAll(part)
				if err != nil {
					t.Fatalf("ReadAll upload part: %v", err)
				}
				if err := json.Unmarshal(raw, &uploadedPayload); err != nil {
					t.Fatalf("uploaded payload is invalid json: %v; raw=%s", err, raw)
				}
				return []byte(`{"status":"ok"}`), http.StatusOK, nil
			default:
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 0, nil
			}
		},
	}

	err := app.UploadAuthFiles([]UploadFilePayload{{
		Name:          "chatgpt-session.json",
		ContentBase64: base64.StdEncoding.EncodeToString([]byte(sessionBody)),
	}})
	if err != nil {
		t.Fatalf("UploadAuthFiles: %v", err)
	}

	if uploadedName != "chatgpt-session.json" {
		t.Fatalf("uploaded filename = %q, want chatgpt-session.json", uploadedName)
	}
	if got := uploadedPayload["type"]; got != "codex" {
		t.Fatalf("type = %#v, want codex", got)
	}
	if got := uploadedPayload["access_token"]; got != "access-token" {
		t.Fatalf("access_token = %#v, want access-token", got)
	}
	if got := uploadedPayload["session_token"]; got != "session-token" {
		t.Fatalf("session_token = %#v, want session-token", got)
	}
	if got := uploadedPayload["account_id"]; got != "acct_123" {
		t.Fatalf("account_id = %#v, want acct_123", got)
	}
	if got := uploadedPayload["email"]; got != "tester@example.com" {
		t.Fatalf("email = %#v, want tester@example.com", got)
	}
	if got := uploadedPayload["plan_type"]; got != "plus" {
		t.Fatalf("plan_type = %#v, want plus", got)
	}
	if got := uploadedPayload["id_token_synthetic"]; got != true {
		t.Fatalf("id_token_synthetic = %#v, want true", got)
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
				if !strings.Contains(string(raw), `"priority": 7`) {
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
