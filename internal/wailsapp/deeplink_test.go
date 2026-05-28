package wailsapp

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseDeepLinkImportMergesConfigAndQueryWins(t *testing.T) {
	config := encodeDeepLinkTestConfig(`{
		"account": {
			"accountType": "codex-api-key",
			"label": "Config Label",
			"apiKey": "sk-config",
			"baseUrl": "https://config.example.com/v1"
		},
		"codexConfig": {
			"mode": "api-key",
			"providerScope": "create-new",
			"providerID": "config-provider",
			"model": "gpt-5-codex"
		}
	}`)

	request, err := ParseDeepLinkImportURL("gettokens://v1/import?channel=codex&resource=codex-setup&source=cc-switch&config=" + config + "&label=Query%20Label&providerScope=current-active&providerID=query-provider&baseUrl=https%3A%2F%2Fquery.example.com%2Fv1")
	if err != nil {
		t.Fatalf("ParseDeepLinkImportURL returned error: %v", err)
	}

	if request.Channel != "codex" {
		t.Fatalf("Channel = %q, want codex", request.Channel)
	}
	if request.Version != "v1" {
		t.Fatalf("Version = %q, want v1", request.Version)
	}
	if request.Resource != "codex-setup" {
		t.Fatalf("Resource = %q, want codex-setup", request.Resource)
	}
	if request.Source != "cc-switch" {
		t.Fatalf("Source = %q, want cc-switch", request.Source)
	}
	if request.Account == nil {
		t.Fatalf("expected account draft")
	}
	if request.Account.Label != "Query Label" {
		t.Fatalf("Account.Label = %q, want Query Label", request.Account.Label)
	}
	if request.Account.BaseURL != "https://query.example.com/v1" {
		t.Fatalf("Account.BaseURL = %q, want query override", request.Account.BaseURL)
	}
	if request.CodexConfig == nil {
		t.Fatalf("expected codex config draft")
	}
	if request.CodexConfig.ProviderScope != "current-active" {
		t.Fatalf("ProviderScope = %q, want current-active", request.CodexConfig.ProviderScope)
	}
	if request.CodexConfig.ProviderID != "query-provider" {
		t.Fatalf("ProviderID = %q, want query-provider", request.CodexConfig.ProviderID)
	}
}

func TestParseDeepLinkImportRejectsUnsupportedFieldsAndNonCodexChannel(t *testing.T) {
	cases := []string{
		"gettokens://v1/import?channel=claude&resource=account",
		"gettokens://v1/import?channel=codex&resource=account&configUrl=https%3A%2F%2Fexample.com%2Fconfig.json",
		"gettokens://v1/import?channel=codex&resource=account&usageScript=curl%20example.com",
		"gettokens://v1/import?channel=codex&resource=account&accountType=openai-compatible&headers.Authorization=Bearer%20secret",
	}

	for _, rawURL := range cases {
		if _, err := ParseDeepLinkImportURL(rawURL); err == nil {
			t.Fatalf("ParseDeepLinkImportURL(%q) expected error", rawURL)
		}
	}
}

func TestParseDeepLinkImportAuthFileBuildsAuthJSONFromDocuments(t *testing.T) {
	config := encodeDeepLinkTestConfig(`{
		"documents": [
			{
				"target": "auth.json",
				"format": "json",
				"mode": "merge",
				"operations": [
					{ "op": "set", "path": "/auth_mode", "value": "chatgpt" },
					{ "op": "set", "path": "/tokens/access_token", "value": "access-secret" },
					{ "op": "set", "path": "/user/email", "value": "team@example.com" }
				]
			}
		]
	}`)

	request, err := ParseDeepLinkImportURL("gettokens://v1/import?channel=codex&resource=account&accountType=auth-file&name=team-codex-auth.json&config=" + config)
	if err != nil {
		t.Fatalf("ParseDeepLinkImportURL returned error: %v", err)
	}

	if request.Account == nil {
		t.Fatalf("expected account draft")
	}
	if request.Account.AccountType != "auth-file" {
		t.Fatalf("AccountType = %q, want auth-file", request.Account.AccountType)
	}
	if request.Account.Name != "team-codex-auth.json" {
		t.Fatalf("Name = %q, want team-codex-auth.json", request.Account.Name)
	}
	if !strings.Contains(request.Account.AuthFileJSON, `"auth_mode": "chatgpt"`) {
		t.Fatalf("AuthFileJSON missing auth_mode: %s", request.Account.AuthFileJSON)
	}
	if !strings.Contains(request.Account.AuthFileJSON, `"email": "team@example.com"`) {
		t.Fatalf("AuthFileJSON missing email: %s", request.Account.AuthFileJSON)
	}
}

func TestPreviewDeepLinkImportBuildsCodexConfigFromDocuments(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	existingConfig := strings.Join([]string{
		`model_provider = "legacy-relay"`,
		``,
		`[model_providers.legacy-relay]`,
		`name = "Legacy Relay"`,
		`base_url = "https://legacy.example.com/v1"`,
	}, "\n") + "\n"
	if err := os.WriteFile(filepath.Join(codexHome, "config.toml"), []byte(existingConfig), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}
	config := encodeDeepLinkTestConfig(`{
		"codexConfig": {
			"providerScope": "current-active"
		},
		"documents": [
			{
				"target": "auth.json",
				"format": "json",
				"mode": "merge",
				"operations": [
					{ "op": "set", "path": "/auth_mode", "value": "apikey" },
					{ "op": "set", "path": "/OPENAI_API_KEY", "value": "sk-documents-secret" }
				]
			},
			{
				"target": "config.toml",
				"format": "toml",
				"mode": "patch",
				"operations": [
					{ "op": "set", "path": "model", "value": "gpt-5-codex" },
					{ "op": "set", "path": "model_reasoning_effort", "value": "high" },
					{ "op": "set", "path": "model_provider", "value": "team-relay" },
					{ "op": "set", "path": "model_providers.team-relay.name", "value": "Team Relay" },
					{ "op": "set", "path": "model_providers.team-relay.base_url", "value": "https://relay.example.com/v1" },
					{ "op": "set", "path": "model_providers.team-relay.requires_openai_auth", "value": false },
					{ "op": "set", "path": "model_providers.team-relay.wire_api", "value": "chat_completions" },
					{ "op": "set", "path": "model_providers.team-relay.supports_websockets", "value": false }
				]
			}
		]
	}`)

	preview, err := PreviewDeepLinkImportURL("gettokens://v1/import?channel=codex&resource=codex-config&config=" + config)
	if err != nil {
		t.Fatalf("PreviewDeepLinkImportURL returned error: %v", err)
	}

	if preview.LocalApplyInput == nil {
		t.Fatalf("expected local apply input")
	}
	if preview.LocalApplyInput.APIKey != redactSecret("sk-documents-secret") {
		t.Fatalf("APIKey preview = %q, want redacted document secret", preview.LocalApplyInput.APIKey)
	}
	if preview.LocalApplyInput.ProviderID != "team-relay" {
		t.Fatalf("ProviderID = %q, want team-relay", preview.LocalApplyInput.ProviderID)
	}
	if preview.LocalApplyInput.SupportsWebsockets {
		t.Fatalf("SupportsWebsockets = true, want explicit false from documents")
	}
	if !preview.LocalApplyInput.SupportsWebsocketsSet {
		t.Fatalf("SupportsWebsocketsSet = false, want true when documents include supports_websockets")
	}
	if preview.EffectiveProviderID != "legacy-relay" {
		t.Fatalf("EffectiveProviderID = %q, want legacy-relay", preview.EffectiveProviderID)
	}
	if preview.ProviderRewriteMode != "patch-current" {
		t.Fatalf("ProviderRewriteMode = %q, want patch-current", preview.ProviderRewriteMode)
	}
	if !strings.Contains(preview.ConfigTomlPreview, `model = "gpt-5-codex"`) {
		t.Fatalf("ConfigTomlPreview missing model from documents:\n%s", preview.ConfigTomlPreview)
	}
	if strings.Contains(preview.ConfigTomlPreview, `model_provider = "team-relay"`) {
		t.Fatalf("ConfigTomlPreview must preserve active model_provider:\n%s", preview.ConfigTomlPreview)
	}
	if !strings.Contains(preview.ConfigTomlPreview, `[model_providers.legacy-relay]`) {
		t.Fatalf("ConfigTomlPreview should patch current provider section:\n%s", preview.ConfigTomlPreview)
	}
	if !strings.Contains(preview.ConfigTomlPreview, `supports_websockets = false`) {
		t.Fatalf("ConfigTomlPreview should explicitly write supports_websockets=false when provided:\n%s", preview.ConfigTomlPreview)
	}
	if !strings.Contains(preview.ConfigTomlPreview, `requires_openai_auth = false`) {
		t.Fatalf("ConfigTomlPreview should explicitly write requires_openai_auth=false when provided:\n%s", preview.ConfigTomlPreview)
	}
	if !strings.Contains(preview.ConfigTomlPreview, `wire_api = "chat_completions"`) {
		t.Fatalf("ConfigTomlPreview should explicitly write wire_api from documents:\n%s", preview.ConfigTomlPreview)
	}
	if strings.Contains(preview.AuthJSONPreview, "sk-documents-secret") {
		t.Fatalf("AuthJSONPreview leaked document secret:\n%s", preview.AuthJSONPreview)
	}
}

func TestPreviewDeepLinkImportPreservesUnspecifiedConfigTomlFields(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	existingConfig := strings.Join([]string{
		`model = "old-model"`,
		`model_reasoning_effort = "low"`,
		`model_provider = "legacy-relay"`,
		``,
		`[model_providers.legacy-relay]`,
		`name = "Legacy Relay"`,
		`base_url = "https://legacy.example.com/v1"`,
		`requires_openai_auth = false`,
		`wire_api = "chat_completions"`,
		`supports_websockets = true`,
	}, "\n") + "\n"
	if err := os.WriteFile(filepath.Join(codexHome, "config.toml"), []byte(existingConfig), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	preview, err := PreviewDeepLinkImportURL("gettokens://v1/import?channel=codex&resource=codex-config&mode=api-key&providerScope=current-active")
	if err != nil {
		t.Fatalf("PreviewDeepLinkImportURL returned error: %v", err)
	}

	if preview.LocalApplyInput == nil {
		t.Fatalf("expected local apply input")
	}
	if preview.LocalApplyInput.SupportsWebsocketsSet {
		t.Fatalf("SupportsWebsocketsSet = true, want false when supportsWebsockets is omitted")
	}
	if preview.LocalApplyInput.ModelSet || preview.LocalApplyInput.ReasoningEffortSet || preview.LocalApplyInput.BaseURLSet || preview.LocalApplyInput.ProviderNameSet || preview.LocalApplyInput.RequiresOpenAIAuthSet || preview.LocalApplyInput.WireAPISet {
		t.Fatalf("unspecified fields should remain unset in local apply input: %#v", preview.LocalApplyInput)
	}
	for _, want := range []string{
		`model = "old-model"`,
		`model_reasoning_effort = "low"`,
		`name = "Legacy Relay"`,
		`base_url = "https://legacy.example.com/v1"`,
		`requires_openai_auth = false`,
		`wire_api = "chat_completions"`,
	} {
		if !strings.Contains(preview.ConfigTomlPreview, want) {
			t.Fatalf("ConfigTomlPreview should preserve %s when omitted:\n%s", want, preview.ConfigTomlPreview)
		}
	}
	if !strings.Contains(preview.ConfigTomlPreview, `supports_websockets = true`) {
		t.Fatalf("ConfigTomlPreview should preserve existing supports_websockets when omitted:\n%s", preview.ConfigTomlPreview)
	}
	if strings.Contains(preview.ConfigTomlPreview, `supports_websockets = false`) {
		t.Fatalf("ConfigTomlPreview should not force false when omitted:\n%s", preview.ConfigTomlPreview)
	}
}

func TestPreviewDeepLinkImportRedactsURLAndKeepsCurrentActiveProvider(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	existingConfig := strings.Join([]string{
		`model = "old-model"`,
		`model_provider = "legacy-relay"`,
		``,
		`[model_providers.legacy-relay]`,
		`name = "Legacy Relay"`,
		`base_url = "https://legacy.example.com/v1"`,
		`wire_api = "chat_completions"`,
	}, "\n") + "\n"
	if err := os.WriteFile(filepath.Join(codexHome, "config.toml"), []byte(existingConfig), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	rawURL := "gettokens://v1/import?channel=codex&resource=codex-config&mode=api-key&providerScope=current-active&providerID=team-relay&providerName=Team%20Relay&apiKey=sk-secret-123456&baseUrl=https%3A%2F%2Frelay.example.com%2Fv1&model=gpt-5-codex"
	preview, err := PreviewDeepLinkImportURL(rawURL)
	if err != nil {
		t.Fatalf("PreviewDeepLinkImportURL returned error: %v", err)
	}

	if strings.Contains(preview.RedactedURL, "sk-secret-123456") {
		t.Fatalf("RedactedURL leaked api key: %s", preview.RedactedURL)
	}
	if !strings.Contains(preview.RedactedURL, "apiKey=%5BREDACTED%5D") && !strings.Contains(preview.RedactedURL, "apiKey=[REDACTED]") {
		t.Fatalf("RedactedURL should mark apiKey as redacted: %s", preview.RedactedURL)
	}
	if preview.ProviderScope != "current-active" {
		t.Fatalf("ProviderScope = %q, want current-active", preview.ProviderScope)
	}
	if preview.ProviderRewriteMode != "patch-current" {
		t.Fatalf("ProviderRewriteMode = %q, want patch-current", preview.ProviderRewriteMode)
	}
	if preview.EffectiveProviderID != "legacy-relay" {
		t.Fatalf("EffectiveProviderID = %q, want legacy-relay", preview.EffectiveProviderID)
	}
	if strings.Contains(preview.ConfigTomlPreview, `model_provider = "team-relay"`) {
		t.Fatalf("preview must not rewrite model_provider when active provider exists:\n%s", preview.ConfigTomlPreview)
	}
	if !strings.Contains(preview.ConfigTomlPreview, `[model_providers.legacy-relay]`) {
		t.Fatalf("preview should patch active provider section:\n%s", preview.ConfigTomlPreview)
	}
	if strings.Contains(preview.AuthJSONPreview, "sk-secret-123456") {
		t.Fatalf("auth preview leaked api key:\n%s", preview.AuthJSONPreview)
	}
}

func TestPreviewDeepLinkImportCreatesProviderOnlyWhenNoExplicitActiveProvider(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())

	preview, err := PreviewDeepLinkImportURL("gettokens://v1/import?channel=codex&resource=codex-config&mode=api-key&providerScope=create-new&providerID=team-relay&providerName=Team%20Relay&apiKey=sk-secret&baseUrl=https%3A%2F%2Frelay.example.com%2Fv1&model=gpt-5-codex")
	if err != nil {
		t.Fatalf("PreviewDeepLinkImportURL returned error: %v", err)
	}

	if preview.ProviderRewriteMode != "create-new" {
		t.Fatalf("ProviderRewriteMode = %q, want create-new", preview.ProviderRewriteMode)
	}
	if preview.EffectiveProviderID != "team-relay" {
		t.Fatalf("EffectiveProviderID = %q, want team-relay", preview.EffectiveProviderID)
	}
	if !strings.Contains(preview.ConfigTomlPreview, `model_provider = "team-relay"`) {
		t.Fatalf("preview should create provider when there is no explicit active provider:\n%s", preview.ConfigTomlPreview)
	}
}

func TestApplyDeepLinkImportCodexSetupReportsPartialSuccess(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	home := t.TempDir()
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", home)

	config := encodeDeepLinkTestConfig(`{
		"account": {
			"accountType": "codex-api-key",
			"label": "Team Relay",
			"apiKey": "sk-account",
			"baseUrl": "https://relay.example.com/v1"
		},
		"codexConfig": {
			"mode": "preserve-chatgpt-provider",
			"providerScope": "current-active",
			"providerID": "team-relay",
			"providerName": "Team Relay",
			"apiKey": "sk-config",
			"baseUrl": "https://relay.example.com/v1",
			"model": "gpt-5-codex"
		}
	}`)

	app := New("test", "", "test/repo")
	result, err := app.ApplyDeepLinkImportURL("gettokens://v1/import?channel=codex&resource=codex-setup&config=" + config)
	if err != nil {
		t.Fatalf("ApplyDeepLinkImportURL should return partial result without top-level error: %v", err)
	}

	if !result.AccountApplied {
		t.Fatalf("expected account import to succeed: %#v", result)
	}
	if result.CodexConfigApplied {
		t.Fatalf("codex config should fail because ChatGPT auth is missing: %#v", result)
	}
	if result.Status != "partial" {
		t.Fatalf("Status = %q, want partial", result.Status)
	}
	if result.CodexConfigError == "" {
		t.Fatalf("expected codex config error in partial result")
	}
}

func encodeDeepLinkTestConfig(rawJSON string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(rawJSON))
}
