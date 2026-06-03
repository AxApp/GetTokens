package wailsapp

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"strings"
	"testing"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
	"github.com/linhay/gettokens/internal/cliproxyapi"
)

func TestParseDeepLinkImportPayloadSupportsMultipleAccounts(t *testing.T) {
	rawURL := buildDeepLinkTestURL(`{
		"schema": "gettokens.import.v1",
		"source": {
			"name": "team-doc",
			"url": "https://example.com/setup"
		},
		"accounts": [
			{
				"ref": "team-relay",
				"kind": "codex-api-key",
				"title": "Team Relay",
				"provider": "codex",
				"disabled": false,
				"codex_api_key": {
					"api_key": "sk-team-relay",
					"base_url": "https://relay.example.com/v1",
					"websockets": false,
					"models_json": "[{\"name\":\"gpt-5-codex\",\"alias\":\"gpt-5-codex\"}]"
				}
			},
			{
				"ref": "deepseek",
				"kind": "openai-compatible",
				"title": "DeepSeek",
				"provider": "deepseek",
				"openai_compatible": {
					"provider_name": "deepseek",
					"base_url": "https://api.deepseek.com/v1",
					"api_key_entries_json": "[{\"api-key\":\"sk-deepseek\"}]",
					"models_json": "[{\"name\":\"deepseek-chat\",\"alias\":\"deepseek-chat\"}]"
				}
			}
		]
	}`)

	request, err := ParseDeepLinkImportURL(rawURL)
	if err != nil {
		t.Fatalf("ParseDeepLinkImportURL returned error: %v", err)
	}

	if request.Protocol != "gt" {
		t.Fatalf("Protocol = %q, want gt", request.Protocol)
	}
	if request.Schema != "gettokens.import.v1" {
		t.Fatalf("Schema = %q, want gettokens.import.v1", request.Schema)
	}
	if request.Source.Name != "team-doc" || request.Source.URL != "https://example.com/setup" {
		t.Fatalf("unexpected source: %#v", request.Source)
	}
	if len(request.Accounts) != 2 {
		t.Fatalf("account count = %d, want 2", len(request.Accounts))
	}
	if request.Accounts[0].Ref != "team-relay" || request.Accounts[0].Write.Kind != cliproxyapi.AccountKindCodexAPIKey {
		t.Fatalf("unexpected first account: %#v", request.Accounts[0])
	}
	if request.Accounts[0].Write.CodexAPIKey == nil || request.Accounts[0].Write.CodexAPIKey.APIKey != "sk-team-relay" {
		t.Fatalf("first account missing codex api key: %#v", request.Accounts[0].Write)
	}
	if request.Accounts[1].Write.OpenAICompatible == nil || request.Accounts[1].Write.OpenAICompatible.ProviderName != "deepseek" {
		t.Fatalf("second account missing openai compatible credential: %#v", request.Accounts[1].Write)
	}
	if strings.Contains(request.RedactedURL, "sk-team-relay") || !strings.Contains(request.RedactedURL, "payload=%5BREDACTED%5D") {
		t.Fatalf("redacted URL leaked payload: %s", request.RedactedURL)
	}
}

func TestParseDeepLinkImportPayloadPreservesOpenAICompatibleModelFetchCredential(t *testing.T) {
	rawURL := buildDeepLinkTestURL(`{
		"schema": "gettokens.import.v1",
		"accounts": [
			{
				"ref": "mimo-token-plan",
				"kind": "openai-compatible",
				"openai_compatible": {
					"provider_name": "Xiaomi MiMo Token Plan",
					"base_url": " https://token-plan-cn.xiaomimimo.com/v1 ",
					"api_key_entries_json": "[{\"api-key\":\"tp-agent\"}]",
					"model_fetch_api_key": " sk-models ",
					"model_fetch_base_url": " https://api.xiaomimimo.com/v1 "
				}
			}
		]
	}`)

	request, err := ParseDeepLinkImportURL(rawURL)
	if err != nil {
		t.Fatalf("ParseDeepLinkImportURL returned error: %v", err)
	}
	credential := request.Accounts[0].Write.OpenAICompatible
	if credential == nil {
		t.Fatalf("missing openai compatible credential")
	}
	if credential.ModelFetchAPIKey != "sk-models" {
		t.Fatalf("ModelFetchAPIKey = %q, want sk-models", credential.ModelFetchAPIKey)
	}
	if credential.ModelFetchBaseURL != "https://api.xiaomimimo.com/v1" {
		t.Fatalf("ModelFetchBaseURL = %q", credential.ModelFetchBaseURL)
	}
}

func TestParseDeepLinkImportPayloadSupportsDevScheme(t *testing.T) {
	rawURL := strings.Replace(buildDeepLinkTestURL(`{
		"schema": "gettokens.import.v1",
		"accounts": [
			{
				"ref": "team-relay",
				"kind": "codex-api-key",
				"title": "Team Relay",
				"provider": "codex",
				"codex_api_key": {
					"api_key": "sk-team-relay",
					"base_url": "https://relay.example.com/v1"
				}
			}
		]
	}`), "gt://", "gt-dev://", 1)

	request, err := ParseDeepLinkImportURL(rawURL)
	if err != nil {
		t.Fatalf("ParseDeepLinkImportURL returned error: %v", err)
	}
	if request.Protocol != "gt-dev" {
		t.Fatalf("Protocol = %q, want gt-dev", request.Protocol)
	}
	if len(request.Accounts) != 1 {
		t.Fatalf("account count = %d, want 1", len(request.Accounts))
	}
}

func TestParseDeepLinkImportRejectsLegacyRoutesAndForbiddenPayloadFields(t *testing.T) {
	cases := []struct {
		name    string
		rawURL  string
		wantErr string
	}{
		{
			name:    "legacy scheme",
			rawURL:  "gettokens://v1/import?channel=codex&resource=account",
			wantErr: "unsupported_scheme",
		},
		{
			name:    "missing app host",
			rawURL:  "gt://v1/import?resource=provider",
			wantErr: "unsupported_route",
		},
		{
			name:    "payload as path",
			rawURL:  "gt://app/v1/import/payload=abc",
			wantErr: "unsupported_route",
		},
		{
			name:    "missing payload",
			rawURL:  "gt://app/v1/import?resource=account",
			wantErr: "missing_payload",
		},
		{
			name: "account key forbidden",
			rawURL: buildDeepLinkTestURL(`{
				"schema": "gettokens.import.v1",
				"accounts": [
					{
						"ref": "bad",
						"account_key": "acct_existing",
						"kind": "codex-api-key",
						"codex_api_key": {
							"api_key": "sk-bad",
							"base_url": "https://relay.example.com/v1"
						}
					}
				]
			}`),
			wantErr: "forbidden_field",
		},
		{
			name: "documents forbidden",
			rawURL: buildDeepLinkTestURL(`{
				"schema": "gettokens.import.v1",
				"documents": [],
				"accounts": []
			}`),
			wantErr: "forbidden_field",
		},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ParseDeepLinkImportURL(tt.rawURL)
			if err == nil {
				t.Fatalf("ParseDeepLinkImportURL expected error")
			}
			if !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("error = %q, want contains %q", err.Error(), tt.wantErr)
			}
		})
	}
}

func TestPreviewDeepLinkImportBuildsBatchAccountSummary(t *testing.T) {
	preview, err := PreviewDeepLinkImportURL(buildDeepLinkTestURL(`{
		"schema": "gettokens.import.v1",
		"source": { "name": "team-doc" },
		"accounts": [
			{
				"ref": "relay",
				"kind": "codex-api-key",
				"title": "Team Relay",
				"provider": "codex",
				"codex_api_key": {
					"api_key": "sk-team-relay",
					"base_url": "https://relay.example.com/v1",
					"models_json": "[{\"name\":\"gpt-5-codex\",\"alias\":\"gpt-5-codex\"}]"
				}
			}
		]
	}`))
	if err != nil {
		t.Fatalf("PreviewDeepLinkImportURL returned error: %v", err)
	}

	if preview.Protocol != "gt" || preview.Source.Name != "team-doc" {
		t.Fatalf("unexpected preview metadata: %#v", preview)
	}
	if len(preview.Accounts) != 1 {
		t.Fatalf("preview account count = %d, want 1", len(preview.Accounts))
	}
	account := preview.Accounts[0]
	if account.Index != 0 || account.Ref != "relay" || account.Kind != string(cliproxyapi.AccountKindCodexAPIKey) {
		t.Fatalf("unexpected preview account: %#v", account)
	}
	if account.APIKeyPreview == "sk-team-relay" || !strings.Contains(account.APIKeyPreview, "****") {
		t.Fatalf("API key preview not redacted: %q", account.APIKeyPreview)
	}
	if account.ModelCount != 1 {
		t.Fatalf("ModelCount = %d, want 1", account.ModelCount)
	}
}

func TestApplyDeepLinkImportCreatesAccountsAndContinuesOnError(t *testing.T) {
	rawURL := buildDeepLinkTestURL(`{
		"schema": "gettokens.import.v1",
		"options": { "continue_on_error": true },
		"accounts": [
			{
				"ref": "ok-1",
				"kind": "codex-api-key",
				"title": "First",
				"provider": "codex",
				"codex_api_key": {
					"api_key": "sk-first",
					"base_url": "https://first.example.com/v1"
				}
			},
			{
				"ref": "fail",
				"kind": "codex-api-key",
				"title": "Fail",
				"provider": "codex",
				"codex_api_key": {
					"api_key": "sk-fail",
					"base_url": "https://fail.example.com/v1"
				}
			},
			{
				"ref": "ok-2",
				"kind": "codex-api-key",
				"title": "Second",
				"provider": "codex",
				"codex_api_key": {
					"api_key": "sk-second",
					"base_url": "https://second.example.com/v1"
				}
			}
		]
	}`)
	rawURL = strings.Replace(rawURL, "gt://", "gt-dev://", 1)

	app, created := newDeepLinkApplyTestApp(t, map[string]error{"Fail": errors.New("sidecar rejected account")})
	result, err := app.ApplyDeepLinkImportURL(rawURL)
	if err != nil {
		t.Fatalf("ApplyDeepLinkImportURL returned error: %v", err)
	}

	if result.Status != "partial" || result.Total != 3 || result.Created != 2 || result.Failed != 1 {
		t.Fatalf("unexpected result summary: %#v", result)
	}
	if len(*created) != 3 {
		t.Fatalf("create attempts = %d, want 3", len(*created))
	}
	if result.Accounts[0].AccountKey == "" || result.Accounts[1].Status != "failed" || result.Accounts[2].AccountKey == "" {
		t.Fatalf("unexpected item results: %#v", result.Accounts)
	}
}

func TestApplyDeepLinkImportStopsOnErrorWhenContinueOnErrorFalse(t *testing.T) {
	rawURL := buildDeepLinkTestURL(`{
		"schema": "gettokens.import.v1",
		"options": { "continue_on_error": false },
		"accounts": [
			{
				"ref": "ok-1",
				"kind": "codex-api-key",
				"title": "First",
				"provider": "codex",
				"codex_api_key": {
					"api_key": "sk-first",
					"base_url": "https://first.example.com/v1"
				}
			},
			{
				"ref": "fail",
				"kind": "codex-api-key",
				"title": "Fail",
				"provider": "codex",
				"codex_api_key": {
					"api_key": "sk-fail",
					"base_url": "https://fail.example.com/v1"
				}
			},
			{
				"ref": "skipped",
				"kind": "codex-api-key",
				"title": "Skipped",
				"provider": "codex",
				"codex_api_key": {
					"api_key": "sk-skipped",
					"base_url": "https://skipped.example.com/v1"
				}
			}
		]
	}`)

	app, created := newDeepLinkApplyTestApp(t, map[string]error{"Fail": errors.New("sidecar rejected account")})
	result, err := app.ApplyDeepLinkImportURL(rawURL)
	if err != nil {
		t.Fatalf("ApplyDeepLinkImportURL returned error: %v", err)
	}

	if result.Status != "partial" || result.Total != 3 || result.Created != 1 || result.Failed != 1 {
		t.Fatalf("unexpected result summary: %#v", result)
	}
	if len(*created) != 2 {
		t.Fatalf("create attempts = %d, want 2", len(*created))
	}
	if len(result.Accounts) != 2 || result.Accounts[1].Ref != "fail" {
		t.Fatalf("unexpected item results: %#v", result.Accounts)
	}
}

func TestApplyDeepLinkImportNormalizesAuthFileThroughAccountWrite(t *testing.T) {
	authJSON := `{"type":"codex","access_token":"access-secret","email":"team@example.com","plan_type":"plus"}`
	rawURL := buildDeepLinkTestURL(fmt.Sprintf(`{
		"schema": "gettokens.import.v1",
		"accounts": [
			{
				"ref": "auth",
				"kind": "auth-file",
				"title": "team-auth.json",
				"provider": "codex",
				"auth_file": {
					"source_file_name": "team-auth.json",
					"auth_json": %q,
					"auth_type": "codex"
				}
			}
		]
	}`, authJSON))

	app, created := newDeepLinkApplyTestApp(t, nil)
	result, err := app.ApplyDeepLinkImportURL(rawURL)
	if err != nil {
		t.Fatalf("ApplyDeepLinkImportURL returned error: %v", err)
	}
	if result.Status != "applied" || result.Created != 1 {
		t.Fatalf("unexpected result: %#v", result)
	}
	if len(*created) != 1 || (*created)[0].AuthFile == nil {
		t.Fatalf("expected auth-file account write: %#v", *created)
	}
	if (*created)[0].AuthFile.Email != "team@example.com" || (*created)[0].AuthFile.SizeBytes == 0 {
		t.Fatalf("auth-file metadata was not normalized: %#v", (*created)[0].AuthFile)
	}
}

func TestApplyDeepLinkImportRenamesOpenAICompatibleProviderOnConflict(t *testing.T) {
	rawURL := buildDeepLinkTestURL(`{
		"schema": "gettokens.import.v1",
		"accounts": [
			{
				"ref": "deepseek",
				"kind": "openai-compatible",
				"title": "deepseek",
				"provider": "deepseek",
				"openai_compatible": {
					"provider_name": "deepseek",
					"base_url": "https://api.deepseek.com/v1",
					"api_key_entries_json": "[{\"api-key\":\"sk-deepseek\"}]"
				}
			}
		]
	}`)

	app, created := newDeepLinkApplyTestAppWithExisting(t, []cliproxyapi.UnifiedAccount{
		{
			AccountKey: "acct_existing",
			Kind:       cliproxyapi.AccountKindOpenAICompatible,
			Title:      "deepseek",
			Provider:   "deepseek",
			OpenAICompatible: &cliproxyapi.OpenAICompatibleAccountCredential{
				ProviderName:      "deepseek",
				BaseURL:           "https://api.deepseek.com/v1",
				APIKeyEntriesJSON: `[{"api-key":"sk-existing"}]`,
			},
		},
	}, nil)
	result, err := app.ApplyDeepLinkImportURL(rawURL)
	if err != nil {
		t.Fatalf("ApplyDeepLinkImportURL returned error: %v", err)
	}
	if result.Status != "applied" || result.Created != 1 {
		t.Fatalf("unexpected result: %#v", result)
	}
	if len(*created) != 1 || (*created)[0].OpenAICompatible == nil {
		t.Fatalf("expected openai-compatible create: %#v", *created)
	}
	if (*created)[0].OpenAICompatible.ProviderName != "deepseek #2" || (*created)[0].Provider != "deepseek #2" || (*created)[0].Title != "deepseek #2" {
		t.Fatalf("provider name was not suffixed: %#v", (*created)[0])
	}
}

func buildDeepLinkTestURL(rawJSON string) string {
	payload := base64.RawURLEncoding.EncodeToString([]byte(rawJSON))
	return "gt://app/v1/import?payload=" + payload
}

func newDeepLinkApplyTestApp(t *testing.T, failures map[string]error) (*App, *[]cliproxyapi.AccountWriteRequest) {
	return newDeepLinkApplyTestAppWithExisting(t, nil, failures)
}

func newDeepLinkApplyTestAppWithExisting(t *testing.T, existing []cliproxyapi.UnifiedAccount, failures map[string]error) (*App, *[]cliproxyapi.AccountWriteRequest) {
	t.Helper()
	created := []cliproxyapi.AccountWriteRequest{}
	app := &App{
		managementAPI: func() *cliproxyapi.Client {
			return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
				if method == "GET" && path == "/v0/management/accounts" {
					body, err := json.Marshal(cliproxyapi.UnifiedAccountsResponse{Items: existing})
					if err != nil {
						t.Fatalf("marshal existing accounts: %v", err)
					}
					return body, 200, nil
				}
				if method != "POST" || path != "/v0/management/accounts" {
					t.Fatalf("unexpected request: %s %s", method, path)
				}
				payload, err := io.ReadAll(body)
				if err != nil {
					t.Fatalf("read request body: %v", err)
				}
				var write cliproxyapi.AccountWriteRequest
				if err := json.Unmarshal(payload, &write); err != nil {
					t.Fatalf("unmarshal account write: %v", err)
				}
				created = append(created, write)
				if fail := failures[write.Title]; fail != nil {
					return []byte(`{"error":"failed"}`), 500, fail
				}
				account := cliproxyapi.UnifiedAccount{
					AccountKey:  "acct_" + strings.ToLower(strings.ReplaceAll(write.Title, " ", "_")),
					Kind:        write.Kind,
					Title:       write.Title,
					Provider:    write.Provider,
					Disabled:    write.Disabled,
					AuthFile:    write.AuthFile,
					CodexAPIKey: write.CodexAPIKey,
				}
				if write.OpenAICompatible != nil {
					account.OpenAICompatible = write.OpenAICompatible
				}
				responseBody, err := json.Marshal(account)
				if err != nil {
					t.Fatalf("marshal account response: %v", err)
				}
				return responseBody, 200, nil
			})
		},
	}
	return app, &created
}

var _ = accountsdomain.NormalizeAuthFileForSidecar
