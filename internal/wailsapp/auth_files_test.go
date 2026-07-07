package wailsapp

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
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

func TestListAuthFilesReadsMetadataFromAccountStoreAuthJSON(t *testing.T) {
	app := New("", "", "")
	listCount := 0
	app.sidecarRequest = func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		switch {
		case method == http.MethodGet && path == ManagementAPIPrefix+"/accounts":
			listCount++
			return []byte(`{"accounts":[{"account_key":"acct_team","kind":"auth-file","title":"codex-team.json","provider":"unknown","priority":7,"disabled":false,"auth_file":{"source_file_name":"codex-team.json","auth_json":"{\"type\":\"codex\",\"email\":\"team@example.com\",\"plan_type\":\"plus\",\"priority\":7}","auth_type":"unknown","size_bytes":91,"modified_unix_ms":1760000000}}]}`), http.StatusOK, nil
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

	if listCount != 2 {
		t.Fatalf("account list count = %d, want 2", listCount)
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

func TestListAuthFilesInfersKnownProviderWithIncompleteProfile(t *testing.T) {
	app := New("", "", "")
	app.sidecarRequest = func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		switch {
		case method == http.MethodGet && path == ManagementAPIPrefix+"/accounts":
			return []byte(`{"accounts":[{"account_key":"acct_minimal","kind":"auth-file","title":"codex-minimal.json","provider":"unknown","auth_file":{"source_file_name":"codex-minimal.json","auth_json":"{\"type\":\"codex\"}","auth_type":"unknown","size_bytes":42,"modified_unix_ms":1760000000}}]}`), http.StatusOK, nil
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

	for label, response := range map[string]*AuthFilesResponse{"first": first, "second": second} {
		file := response.Files[0]
		if file.Provider != "codex" || file.Type != "codex" {
			t.Fatalf("%s provider/type = %q/%q, want codex/codex", label, file.Provider, file.Type)
		}
	}
}

func TestListAuthFilesRefreshesMetadataWhenAccountStoreChanges(t *testing.T) {
	app := New("", "", "")
	modified := int64(1760000000)
	planType := "plus"
	priority := 7
	app.sidecarRequest = func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		switch {
		case method == http.MethodGet && path == ManagementAPIPrefix+"/accounts":
			payload, _ := json.Marshal(map[string]any{
				"accounts": []map[string]any{{
					"account_key": "acct_team",
					"kind":        "auth-file",
					"title":       "codex-team.json",
					"provider":    "unknown",
					"priority":    priority,
					"auth_file": map[string]any{
						"source_file_name": "codex-team.json",
						"auth_json":        fmt.Sprintf(`{"type":"codex","email":"team@example.com","plan_type":%q,"priority":%d}`, planType, priority),
						"auth_type":        "unknown",
						"size_bytes":       91,
						"modified_unix_ms": modified,
					},
				}},
			})
			return payload, http.StatusOK, nil
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
	planType = "pro"
	priority = 9
	second, err := app.ListAuthFiles()
	if err != nil {
		t.Fatalf("second ListAuthFiles: %v", err)
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

	var accountWrite map[string]interface{}
	var authFileCredential map[string]interface{}
	singleCreateCalls := 0

	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			switch {
			case method == http.MethodGet && path == ManagementAPIPrefix+"/accounts":
				return []byte(`{"accounts":[]}`), http.StatusOK, nil
			case method == http.MethodPost && path == ManagementAPIPrefix+"/accounts/batch-create":
				raw, err := io.ReadAll(body)
				if err != nil {
					t.Fatalf("ReadAll account body: %v", err)
				}
				var request struct {
					Accounts []map[string]interface{} `json:"accounts"`
				}
				if err := json.Unmarshal(raw, &request); err != nil {
					t.Fatalf("account payload is invalid json: %v; raw=%s", err, raw)
				}
				if len(request.Accounts) != 1 {
					t.Fatalf("batch accounts = %d, want 1", len(request.Accounts))
				}
				accountWrite = request.Accounts[0]
				rawCredential, err := json.Marshal(accountWrite["auth_file"])
				if err != nil {
					t.Fatalf("Marshal auth_file: %v", err)
				}
				if err := json.Unmarshal(rawCredential, &authFileCredential); err != nil {
					t.Fatalf("auth_file payload is invalid json: %v; raw=%s", err, rawCredential)
				}
				return []byte(`{"accounts":[{"account_key":"acct_imported","kind":"auth-file","title":"chatgpt-session.json","provider":"codex","auth_file":{"source_file_name":"chatgpt-session.json"}}],"errors":[],"succeeded":1,"failed":0}`), http.StatusOK, nil
			case method == http.MethodPost && path == ManagementAPIPrefix+"/accounts":
				singleCreateCalls++
				t.Fatalf("single CreateAccount should not be used when batch-create is supported")
				return nil, 0, nil
			default:
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 0, nil
			}
		},
	}

	result, err := app.UploadAuthFiles([]UploadFilePayload{{
		Name:          "chatgpt-session.json",
		ContentBase64: base64.StdEncoding.EncodeToString([]byte(sessionBody)),
	}})
	if err != nil {
		t.Fatalf("UploadAuthFiles: %v", err)
	}
	if result == nil || result.Succeeded != 1 || result.Skipped != 0 || result.Failed != 0 {
		t.Fatalf("UploadAuthFiles result = %#v, want one success", result)
	}
	if singleCreateCalls != 0 {
		t.Fatalf("single create calls = %d, want 0", singleCreateCalls)
	}

	if got := accountWrite["kind"]; got != "auth-file" {
		t.Fatalf("kind = %#v, want auth-file", got)
	}
	if got := accountWrite["title"]; got != "chatgpt-session.json" {
		t.Fatalf("title = %#v, want chatgpt-session.json", got)
	}
	if got := authFileCredential["source_file_name"]; got != "chatgpt-session.json" {
		t.Fatalf("source_file_name = %#v, want chatgpt-session.json", got)
	}
	uploadedPayload := map[string]interface{}{}
	if raw, ok := authFileCredential["auth_json"].(string); !ok {
		t.Fatalf("auth_json = %#v, want string", authFileCredential["auth_json"])
	} else if err := json.Unmarshal([]byte(raw), &uploadedPayload); err != nil {
		t.Fatalf("auth_json is invalid json: %v; raw=%s", err, raw)
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

func TestUploadAuthFilesFallsBackToSingleCreateWhenBatchCreateUnsupported(t *testing.T) {
	app := &App{}
	batchCreateCalls := 0
	singleCreateCalls := 0
	app.sidecarRequest = func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		switch {
		case method == http.MethodGet && path == ManagementAPIPrefix+"/accounts":
			return []byte(`{"accounts":[]}`), http.StatusOK, nil
		case method == http.MethodPost && path == ManagementAPIPrefix+"/accounts/batch-create":
			batchCreateCalls++
			return []byte(`{"error":"not found"}`), http.StatusNotFound, nil
		case method == http.MethodPost && path == ManagementAPIPrefix+"/accounts":
			singleCreateCalls++
			raw, err := io.ReadAll(body)
			if err != nil {
				t.Fatalf("ReadAll fallback account body: %v", err)
			}
			if !strings.Contains(string(raw), `"kind":"auth-file"`) {
				t.Fatalf("fallback account payload = %s, want auth-file kind", raw)
			}
			return []byte(`{"account_key":"acct_imported","kind":"auth-file","title":"imported.json","provider":"codex"}`), http.StatusOK, nil
		default:
			t.Fatalf("unexpected request: %s %s", method, path)
			return nil, 0, nil
		}
	}

	files := []UploadFilePayload{
		{Name: "one.json", ContentBase64: base64.StdEncoding.EncodeToString([]byte(`{"type":"codex","email":"one@example.com","access_token":"a","refresh_token":"r"}`))},
		{Name: "two.json", ContentBase64: base64.StdEncoding.EncodeToString([]byte(`{"type":"codex","email":"two@example.com","access_token":"a","refresh_token":"r"}`))},
	}
	result, err := app.UploadAuthFiles(files)
	if err != nil {
		t.Fatalf("UploadAuthFiles: %v", err)
	}
	if result == nil || result.Succeeded != 2 || !result.FallbackUsed {
		t.Fatalf("UploadAuthFiles fallback result = %#v, want two successes with fallback", result)
	}
	if batchCreateCalls != 1 {
		t.Fatalf("batch create calls = %d, want 1", batchCreateCalls)
	}
	if singleCreateCalls != 2 {
		t.Fatalf("single create calls = %d, want 2", singleCreateCalls)
	}
}

func TestUploadAuthFilesReturnsSkippedDuplicateSummary(t *testing.T) {
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			switch {
			case method == http.MethodGet && path == ManagementAPIPrefix+"/accounts":
				return []byte(`{"accounts":[]}`), http.StatusOK, nil
			case method == http.MethodPost && path == ManagementAPIPrefix+"/accounts/batch-create":
				return []byte(`{"accounts":[],"skipped":[{"index":0,"title":"one.json","reason":"existing_account","existing_account_key":"acct_existing"},{"index":1,"title":"two.json","reason":"duplicate_in_batch","existing_account_key":"acct_existing"}],"errors":[],"succeeded":0,"skipped_count":2,"failed":0}`), http.StatusOK, nil
			default:
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 0, nil
			}
		},
	}

	files := []UploadFilePayload{
		{Name: "one.json", ContentBase64: base64.StdEncoding.EncodeToString([]byte(`{"type":"codex","email":"one@example.com","access_token":"a","id_token":"same"}`))},
		{Name: "two.json", ContentBase64: base64.StdEncoding.EncodeToString([]byte(`{"type":"codex","email":"two@example.com","access_token":"b","id_token":"same"}`))},
	}
	result, err := app.UploadAuthFiles(files)
	if err != nil {
		t.Fatalf("UploadAuthFiles: %v", err)
	}
	if result == nil || result.Succeeded != 0 || result.Skipped != 2 || result.SkippedExisting != 1 || result.SkippedInBatch != 1 || result.Failed != 0 {
		t.Fatalf("UploadAuthFiles result = %#v, want skipped duplicate summary", result)
	}
}

func TestPreviewAuthFileUploadsReturnsSkippedDuplicateSummary(t *testing.T) {
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			switch {
			case method == http.MethodGet && path == ManagementAPIPrefix+"/accounts":
				return []byte(`{"accounts":[]}`), http.StatusOK, nil
			case method == http.MethodPost && path == ManagementAPIPrefix+"/accounts/batch-preview":
				raw, err := io.ReadAll(body)
				if err != nil {
					t.Fatalf("ReadAll preview body: %v", err)
				}
				if !strings.Contains(string(raw), `"accounts":[{"kind":"auth-file"`) {
					t.Fatalf("preview payload = %s, want auth-file account writes", raw)
				}
				return []byte(`{"items":[{"index":0,"title":"one.json","action":"skip","reason":"existing_account"},{"index":1,"title":"two.json","action":"skip","reason":"duplicate_in_batch"}],"skipped":[{"index":0,"title":"one.json","reason":"existing_account","existing_account_key":"acct_existing"},{"index":1,"title":"two.json","reason":"duplicate_in_batch","existing_account_key":"acct_existing"}],"errors":[],"would_create":0,"skipped_count":2,"failed":0}`), http.StatusOK, nil
			default:
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 0, nil
			}
		},
	}

	files := []UploadFilePayload{
		{Name: "one.json", ContentBase64: base64.StdEncoding.EncodeToString([]byte(`{"type":"codex","email":"one@example.com","access_token":"a","id_token":"same"}`))},
		{Name: "two.json", ContentBase64: base64.StdEncoding.EncodeToString([]byte(`{"type":"codex","email":"two@example.com","access_token":"b","id_token":"same"}`))},
	}
	result, err := app.PreviewAuthFileUploads(files)
	if err != nil {
		t.Fatalf("PreviewAuthFileUploads: %v", err)
	}
	if result == nil || !result.Supported || result.WouldCreate != 0 || result.Skipped != 2 || result.SkippedExisting != 1 || result.SkippedInBatch != 1 || result.Failed != 0 {
		t.Fatalf("PreviewAuthFileUploads result = %#v, want skipped duplicate summary", result)
	}
}

func TestPreviewAuthFileUploadsReturnsUnsupportedForOldSidecar(t *testing.T) {
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			switch {
			case method == http.MethodGet && path == ManagementAPIPrefix+"/accounts":
				return []byte(`{"accounts":[]}`), http.StatusOK, nil
			case method == http.MethodPost && path == ManagementAPIPrefix+"/accounts/batch-preview":
				return []byte(`{"error":"not found"}`), http.StatusNotFound, nil
			default:
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 0, nil
			}
		},
	}

	files := []UploadFilePayload{
		{Name: "one.json", ContentBase64: base64.StdEncoding.EncodeToString([]byte(`{"type":"codex","email":"one@example.com","access_token":"a","id_token":"one"}`))},
		{Name: "two.json", ContentBase64: base64.StdEncoding.EncodeToString([]byte(`{"type":"codex","email":"two@example.com","access_token":"b","id_token":"two"}`))},
	}
	result, err := app.PreviewAuthFileUploads(files)
	if err != nil {
		t.Fatalf("PreviewAuthFileUploads: %v", err)
	}
	if result == nil || result.Supported || result.WouldCreate != 2 || result.Skipped != 0 || result.Failed != 0 {
		t.Fatalf("PreviewAuthFileUploads old sidecar result = %#v, want unsupported with wouldCreate=2", result)
	}
}

func TestUpdateAuthFilePriorityPreservesDisabledStatus(t *testing.T) {
	const fileName = "disabled.json"
	const originalBody = `{"type":"codex","access_token":"token","priority":2}`

	disabledByName := map[string]bool{
		fileName: true,
	}
	priorityPatched := false

	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			switch {
			case method == http.MethodGet && path == ManagementAPIPrefix+"/accounts":
				payload, _ := json.Marshal(map[string]any{"accounts": []map[string]any{{
					"account_key": "acct_disabled",
					"kind":        "auth-file",
					"title":       fileName,
					"provider":    "codex",
					"priority":    2,
					"disabled":    disabledByName[fileName],
					"auth_file": map[string]any{
						"source_file_name": fileName,
						"auth_json":        originalBody,
						"auth_type":        "codex",
						"email":            "tester@example.com",
						"plan_type":        "plus",
					},
				}}})
				return payload, http.StatusOK, nil
			case method == http.MethodPatch && path == ManagementAPIPrefix+"/accounts/acct_disabled/priority":
				raw, err := io.ReadAll(body)
				if err != nil {
					t.Fatalf("ReadAll priority body: %v", err)
				}
				var payload struct {
					Priority int `json:"priority"`
				}
				if err := json.Unmarshal(raw, &payload); err != nil {
					t.Fatalf("Unmarshal priority body: %v", err)
				}
				if payload.Priority != 7 {
					t.Fatalf("patched priority = %d, want 7", payload.Priority)
				}
				priorityPatched = true
				response, _ := json.Marshal(map[string]any{
					"account_key": "acct_disabled",
					"kind":        "auth-file",
					"title":       "disabled.json",
					"provider":    "codex",
					"priority":    7,
					"disabled":    true,
					"auth_file": map[string]any{
						"source_file_name": "disabled.json",
						"auth_json":        originalBody,
						"auth_type":        "codex",
					},
				})
				return response, http.StatusOK, nil
			default:
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 0, nil
			}
		},
	}

	if err := app.updateAuthFilePriority(fileName, 7); err != nil {
		t.Fatalf("updateAuthFilePriority: %v", err)
	}

	if !priorityPatched {
		t.Fatal("expected account priority to be patched")
	}
	if !disabledByName[fileName] {
		t.Fatal("disabled status should remain true after priority update")
	}
}

func TestApplyAuthFileConfigPatchesAccountStoreAuthJSON(t *testing.T) {
	const fileName = "codex-team.json"
	const originalBody = `{"type":"codex","email":"old@example.com","plan_type":"plus","refresh_token":"old"}`
	const nextBody = `{"type":"codex","email":"new@example.com","plan_type":"pro","refresh_token":"new"}`

	patched := false
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			switch {
			case method == http.MethodGet && path == ManagementAPIPrefix+"/accounts":
				payload, _ := json.Marshal(map[string]any{"accounts": []map[string]any{{
					"account_key": "acct_auth",
					"kind":        "auth-file",
					"title":       fileName,
					"provider":    "codex",
					"priority":    1,
					"auth_file": map[string]any{
						"source_file_name": fileName,
						"auth_json":        originalBody,
						"auth_type":        "codex",
						"email":            "old@example.com",
						"plan_type":        "plus",
						"size_bytes":       len(originalBody),
					},
				}}})
				return payload, http.StatusOK, nil
			case method == http.MethodPatch && path == ManagementAPIPrefix+"/accounts/acct_auth":
				raw, err := io.ReadAll(body)
				if err != nil {
					t.Fatalf("ReadAll patch body: %v", err)
				}
				var payload struct {
					AuthFile struct {
						AuthJSON string `json:"auth_json"`
						Email    string `json:"email"`
						PlanType string `json:"plan_type"`
						Size     int64  `json:"size_bytes"`
					} `json:"auth_file"`
				}
				if err := json.Unmarshal(raw, &payload); err != nil {
					t.Fatalf("Unmarshal patch body: %v", err)
				}
				var authJSON map[string]any
				if err := json.Unmarshal([]byte(payload.AuthFile.AuthJSON), &authJSON); err != nil {
					t.Fatalf("Unmarshal patched auth_json: %v", err)
				}
				if authJSON["refresh_token"] != "new" {
					t.Fatalf("auth_json refresh_token = %#v, want new", authJSON["refresh_token"])
				}
				if payload.AuthFile.Email != "new@example.com" || payload.AuthFile.PlanType != "pro" || payload.AuthFile.Size != int64(len(payload.AuthFile.AuthJSON)) {
					t.Fatalf("auth metadata not refreshed: %#v", payload.AuthFile)
				}
				patched = true
				return raw, http.StatusOK, nil
			default:
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 0, nil
			}
		},
	}

	if err := app.ApplyAuthFileConfig(fileName, nextBody); err != nil {
		t.Fatalf("ApplyAuthFileConfig: %v", err)
	}
	if !patched {
		t.Fatal("expected account store patch")
	}
}
