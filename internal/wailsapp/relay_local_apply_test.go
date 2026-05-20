package wailsapp

import (
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestResolveCodexHomePathUsesCODEXHOMEOverride(t *testing.T) {
	override := filepath.Join(t.TempDir(), "custom-codex-home")
	t.Setenv("CODEX_HOME", override)

	path, err := resolveCodexHomePath()
	if err != nil {
		t.Fatalf("resolveCodexHomePath returned error: %v", err)
	}
	if path != override {
		t.Fatalf("path = %q, want %q", path, override)
	}
}

func TestApplyRelayServiceConfigToLocalWritesOpenAIProviderFacingFiles(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())

	result, err := applyRelayServiceConfigToLocal("sk-relay-test", "http://127.0.0.1:8317/v1", "gpt-5.5", "low", "openai", "OpenAI", false)
	if err != nil {
		t.Fatalf("applyRelayServiceConfigToLocal returned error: %v", err)
	}

	if result.CodexHomePath != codexHome {
		t.Fatalf("CodexHomePath = %q, want %q", result.CodexHomePath, codexHome)
	}

	configBody, err := os.ReadFile(result.ConfigPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	configContent := string(configBody)
	if !strings.Contains(configContent, `model = "gpt-5.5"`) {
		t.Fatalf("config.toml missing model: %s", configContent)
	}
	if !strings.Contains(configContent, `model_reasoning_effort = "low"`) {
		t.Fatalf("config.toml missing model_reasoning_effort: %s", configContent)
	}
	if !strings.Contains(configContent, `openai_base_url = "http://127.0.0.1:8317/v1"`) {
		t.Fatalf("config.toml missing openai_base_url: %s", configContent)
	}
	if strings.Contains(configContent, `model_provider =`) {
		t.Fatalf("config.toml should keep builtin openai provider shape: %s", configContent)
	}
}

func TestApplyRelayServiceConfigToLocalWritesCustomProviderFacingFiles(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())

	result, err := applyRelayServiceConfigToLocal("sk-relay-test", "http://127.0.0.1:8317/v1", "gpt-5.5", "xhigh", "gettokens", "GetTokens", true)
	if err != nil {
		t.Fatalf("applyRelayServiceConfigToLocal returned error: %v", err)
	}

	if result.CodexHomePath != codexHome {
		t.Fatalf("CodexHomePath = %q, want %q", result.CodexHomePath, codexHome)
	}

	authBody, err := os.ReadFile(result.AuthFilePath)
	if err != nil {
		t.Fatalf("ReadFile auth.json: %v", err)
	}
	authContent := string(authBody)
	if !strings.Contains(authContent, `"auth_mode": "apikey"`) {
		t.Fatalf("auth.json missing auth_mode: %s", authContent)
	}
	if !strings.Contains(authContent, `"OPENAI_API_KEY": "sk-relay-test"`) {
		t.Fatalf("auth.json missing OPENAI_API_KEY: %s", authContent)
	}
	if strings.Contains(authContent, "base_url") {
		t.Fatalf("auth.json should not include base_url: %s", authContent)
	}

	configBody, err := os.ReadFile(result.ConfigPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	configContent := string(configBody)
	if !strings.Contains(configContent, `model = "gpt-5.5"`) {
		t.Fatalf("config.toml missing model: %s", configContent)
	}
	if !strings.Contains(configContent, `model_reasoning_effort = "xhigh"`) {
		t.Fatalf("config.toml missing model_reasoning_effort: %s", configContent)
	}
	if !strings.Contains(configContent, `model_provider = "gettokens"`) {
		t.Fatalf("config.toml missing model_provider: %s", configContent)
	}
	if !strings.Contains(configContent, `[model_providers.gettokens]`) {
		t.Fatalf("config.toml missing provider section: %s", configContent)
	}
	if !strings.Contains(configContent, `name = "GetTokens"`) {
		t.Fatalf("config.toml missing provider name: %s", configContent)
	}
	if !strings.Contains(configContent, `base_url = "http://127.0.0.1:8317/v1"`) {
		t.Fatalf("config.toml missing base_url: %s", configContent)
	}
	if !strings.Contains(configContent, `requires_openai_auth = true`) {
		t.Fatalf("config.toml missing requires_openai_auth: %s", configContent)
	}
	if !strings.Contains(configContent, `wire_api = "responses"`) {
		t.Fatalf("config.toml missing wire_api: %s", configContent)
	}
	if !strings.Contains(configContent, `supports_websockets = true`) {
		t.Fatalf("config.toml missing supports_websockets: %s", configContent)
	}
}

func TestApplyRelayServiceConfigToLocalMarksLastUsedMetadata(t *testing.T) {
	t.Setenv("CODEX_HOME", filepath.Join(t.TempDir(), ".codex"))
	t.Setenv("HOME", t.TempDir())

	app := &App{}
	if _, err := app.ApplyRelayServiceConfigToLocal("sk-gettokens-test", "http://127.0.0.1:8317/v1", "gpt-5.4", "high", "openai", "OpenAI", false); err != nil {
		t.Fatalf("ApplyRelayServiceConfigToLocal returned error: %v", err)
	}

	metadata, err := loadRelayServiceAPIKeyMetadata()
	if err != nil {
		t.Fatalf("loadRelayServiceAPIKeyMetadata: %v", err)
	}

	item := metadata[relayServiceAPIKeyMetadataID("sk-gettokens-test")]
	if item.CreatedAt == "" {
		t.Fatalf("expected createdAt to be recorded")
	}
	if item.LastUsedAt == "" {
		t.Fatalf("expected lastUsedAt to be recorded")
	}
}

func TestApplyRelayServiceConfigToLocalPreservesExistingConfigOrderAndExtraEntries(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())

	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	existing := strings.Join([]string{
		`sandbox_mode = "workspace-write"`,
		`approval_policy = "on-request"`,
		`model = "old-model"`,
		`notify = ["terminal"]`,
		`model_provider = "legacy-relay" # keep line position`,
		``,
		`[mcp_servers.docs]`,
		`command = "docs-server"`,
		``,
		`[model_providers.legacy-relay]`,
		`name = "Legacy Relay"`,
		`base_url = "http://legacy/v1"`,
		`wire_api = "chat_completions"`,
	}, "\n") + "\n"
	if err := os.WriteFile(configPath, []byte(existing), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	if _, err := applyRelayServiceConfigToLocal("sk-relay-test", "http://127.0.0.1:8317/v1", "gpt-5.5", "low", "openai", "OpenAI", false); err != nil {
		t.Fatalf("applyRelayServiceConfigToLocal returned error: %v", err)
	}

	body, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	content := string(body)

	if !strings.Contains(content, `sandbox_mode = "workspace-write"`) || !strings.Contains(content, `approval_policy = "on-request"`) || !strings.Contains(content, `[mcp_servers.docs]`) {
		t.Fatalf("existing config entries should be preserved: %s", content)
	}
	if strings.Index(content, `sandbox_mode = "workspace-write"`) > strings.Index(content, `approval_policy = "on-request"`) {
		t.Fatalf("existing root key order changed: %s", content)
	}
	if strings.Index(content, `approval_policy = "on-request"`) > strings.Index(content, `notify = ["terminal"]`) {
		t.Fatalf("existing root key order changed: %s", content)
	}
	if !strings.Contains(content, `model = "gpt-5.5"`) {
		t.Fatalf("model not updated: %s", content)
	}
	if !strings.Contains(content, `model_reasoning_effort = "low"`) {
		t.Fatalf("reasoning effort not inserted: %s", content)
	}
	if !strings.Contains(content, `openai_base_url = "http://127.0.0.1:8317/v1"`) {
		t.Fatalf("openai_base_url not inserted: %s", content)
	}
	if !strings.Contains(content, `model_provider = "openai" # keep line position`) {
		t.Fatalf("existing model_provider line should be updated in place and preserve trailing comment: %s", content)
	}
}

func TestApplyRelayServiceConfigToLocalPreservesExistingProviderSectionAndWritesMinimalAPIKeyAuth(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())

	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}

	authPath := filepath.Join(codexHome, "auth.json")
	if err := os.WriteFile(authPath, []byte("{\n  \"auth_mode\": \"chatgpt\",\n  \"tokens\": {\"access_token\": \"abc\"},\n  \"last_refresh\": \"2026-05-20T00:00:00Z\",\n  \"agent_identity\": \"stale-agent-token\",\n  \"user\": {\"email\": \"dev@example.com\"}\n}\n"), 0600); err != nil {
		t.Fatalf("WriteFile auth.json: %v", err)
	}

	configPath := filepath.Join(codexHome, "config.toml")
	existingConfig := strings.Join([]string{
		`model = "gpt-4.1"`,
		``,
		`[model_providers.gettokens]`,
		`name = "Old Name"`,
		`env_key = "OPENAI_API_KEY"`,
		`wire_api = "chat_completions"`,
	}, "\n") + "\n"
	if err := os.WriteFile(configPath, []byte(existingConfig), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	if _, err := applyRelayServiceConfigToLocal("sk-relay-test", "http://127.0.0.1:8317/v1", "gpt-5.5", "xhigh", "gettokens", "GetTokens", true); err != nil {
		t.Fatalf("applyRelayServiceConfigToLocal returned error: %v", err)
	}

	authBody, err := os.ReadFile(authPath)
	if err != nil {
		t.Fatalf("ReadFile auth.json: %v", err)
	}
	var authPayload map[string]any
	if err := json.Unmarshal(authBody, &authPayload); err != nil {
		t.Fatalf("Unmarshal auth.json: %v", err)
	}
	if authPayload["auth_mode"] != "apikey" {
		t.Fatalf("auth_mode not updated: %#v", authPayload)
	}
	if authPayload["OPENAI_API_KEY"] != "sk-relay-test" {
		t.Fatalf("OPENAI_API_KEY not updated: %#v", authPayload)
	}
	if _, ok := authPayload["tokens"]; ok {
		t.Fatalf("API key auth.json should remove OAuth tokens: %#v", authPayload)
	}
	if _, ok := authPayload["last_refresh"]; ok {
		t.Fatalf("API key auth.json should remove last_refresh: %#v", authPayload)
	}
	if _, ok := authPayload["agent_identity"]; ok {
		t.Fatalf("API key auth.json should remove agent_identity: %#v", authPayload)
	}
	if _, ok := authPayload["user"]; ok {
		t.Fatalf("API key auth.json should remove user metadata: %#v", authPayload)
	}
	if len(authPayload) != 2 {
		t.Fatalf("API key auth.json should only keep auth_mode and OPENAI_API_KEY: %#v", authPayload)
	}

	configBody, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	configContent := string(configBody)
	if !strings.Contains(configContent, `env_key = "OPENAI_API_KEY"`) {
		t.Fatalf("existing provider section fields should be preserved: %s", configContent)
	}
	if !strings.Contains(configContent, `name = "GetTokens"`) || !strings.Contains(configContent, `base_url = "http://127.0.0.1:8317/v1"`) {
		t.Fatalf("provider section should be updated in place: %s", configContent)
	}
	if !strings.Contains(configContent, `requires_openai_auth = true`) || !strings.Contains(configContent, `wire_api = "responses"`) || !strings.Contains(configContent, `supports_websockets = true`) {
		t.Fatalf("provider section missing required fields: %s", configContent)
	}
	if strings.Index(configContent, `name = "GetTokens"`) > strings.Index(configContent, `env_key = "OPENAI_API_KEY"`) {
		t.Fatalf("existing provider key order should be preserved: %s", configContent)
	}
}

func TestGetLocalCodexAuthStateDetectsChatGPTTokens(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)

	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}

	authPath := filepath.Join(codexHome, "auth.json")
	authBody := "{\n  \"tokens\": {\"access_token\": \"abc\"},\n  \"user\": {\"email\": \"dev@example.com\"}\n}\n"
	if err := os.WriteFile(authPath, []byte(authBody), 0600); err != nil {
		t.Fatalf("WriteFile auth.json: %v", err)
	}

	state, err := getLocalCodexAuthState()
	if err != nil {
		t.Fatalf("getLocalCodexAuthState returned error: %v", err)
	}

	if !state.HasAuthFile {
		t.Fatalf("expected HasAuthFile to be true")
	}
	if state.AuthMode != "chatgpt_auth_tokens" {
		t.Fatalf("AuthMode = %q, want chatgpt_auth_tokens", state.AuthMode)
	}
	if !state.HasTokens {
		t.Fatalf("expected HasTokens to be true")
	}
	if state.HasOpenAIAPIKey {
		t.Fatalf("expected HasOpenAIAPIKey to be false")
	}
	if !state.CanPreserveChatGPTAuth {
		t.Fatalf("expected CanPreserveChatGPTAuth to be true")
	}
	if state.AccountEmail != "dev@example.com" {
		t.Fatalf("AccountEmail = %q, want dev@example.com", state.AccountEmail)
	}
}

func TestGetLocalCodexAuthStatePrefersExplicitChatGPTAuthModeOverAPIKey(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)

	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}

	authPath := filepath.Join(codexHome, "auth.json")
	authBody := "{\n  \"auth_mode\": \"chatgpt\",\n  \"OPENAI_API_KEY\": \"stale-api-key\",\n  \"tokens\": {\"access_token\": \"abc\"},\n  \"user\": {\"email\": \"dev@example.com\"}\n}\n"
	if err := os.WriteFile(authPath, []byte(authBody), 0600); err != nil {
		t.Fatalf("WriteFile auth.json: %v", err)
	}

	state, err := getLocalCodexAuthState()
	if err != nil {
		t.Fatalf("getLocalCodexAuthState returned error: %v", err)
	}

	if state.AuthMode != "chatgpt" {
		t.Fatalf("AuthMode = %q, want chatgpt", state.AuthMode)
	}
	if !state.HasOpenAIAPIKey {
		t.Fatalf("expected HasOpenAIAPIKey to record the stale field")
	}
	if !state.HasTokens {
		t.Fatalf("expected HasTokens to be true")
	}
	if !state.CanPreserveChatGPTAuth {
		t.Fatalf("expected CanPreserveChatGPTAuth to be true")
	}
	if len(state.Warnings) == 0 || !strings.Contains(state.Warnings[0], "auth_mode=chatgpt") {
		t.Fatalf("expected stale OPENAI_API_KEY warning, got %#v", state.Warnings)
	}
}

func TestApplyRelayServiceConfigToLocalV2PreserveChatGPTAuthKeepsAuthJSONAndWritesExperimentalBearerToken(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())

	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}

	authPath := filepath.Join(codexHome, "auth.json")
	originalAuth := "{\n  \"auth_mode\": \"chatgpt\",\n  \"OPENAI_API_KEY\": null,\n  \"tokens\": {\"access_token\": \"chatgpt-token\"}\n}\n"
	if err := os.WriteFile(authPath, []byte(originalAuth), 0600); err != nil {
		t.Fatalf("WriteFile auth.json: %v", err)
	}

	configPath := filepath.Join(codexHome, "config.toml")
	existingConfig := strings.Join([]string{
		`model = "gpt-4.1"`,
		``,
		`[model_providers.gettokens]`,
		`name = "Old Name"`,
		`env_key = "OPENAI_API_KEY"`,
		`wire_api = "chat_completions"`,
	}, "\n") + "\n"
	if err := os.WriteFile(configPath, []byte(existingConfig), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	result, err := applyRelayServiceConfigToLocalV2(RelayLocalApplyInput{
		APIKey:             "sk-relay-test",
		BaseURL:            "http://127.0.0.1:8317/v1",
		Model:              "gpt-5.5",
		ReasoningEffort:    "xhigh",
		ProviderID:         "gettokens",
		ProviderName:       "GetTokens",
		SupportsWebsockets: true,
		AuthStrategy:       relayLocalAuthStrategyPreserveChatGPTAuth,
	})
	if err != nil {
		t.Fatalf("applyRelayServiceConfigToLocalV2 returned error: %v", err)
	}

	authBody, err := os.ReadFile(result.AuthFilePath)
	if err != nil {
		t.Fatalf("ReadFile auth.json: %v", err)
	}
	if string(authBody) != originalAuth {
		t.Fatalf("auth.json should remain unchanged:\n%s", string(authBody))
	}

	configBody, err := os.ReadFile(result.ConfigPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	configContent := string(configBody)
	if !strings.Contains(configContent, `experimental_bearer_token = "sk-relay-test"`) {
		t.Fatalf("config.toml missing experimental_bearer_token: %s", configContent)
	}
	if strings.Contains(configContent, `env_key = "OPENAI_API_KEY"`) {
		t.Fatalf("preserve mode should remove env_key to avoid overriding experimental_bearer_token: %s", configContent)
	}
	if !strings.Contains(configContent, `requires_openai_auth = true`) || !strings.Contains(configContent, `wire_api = "responses"`) {
		t.Fatalf("config.toml missing required preserve-mode fields: %s", configContent)
	}
}

func TestApplyRelayServiceConfigToLocalV2ReplaceAuthWithOAuthWritesAuthJSON(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())

	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}

	configPath := filepath.Join(codexHome, "config.toml")
	existingConfig := strings.Join([]string{
		`model = "gpt-4.1"`,
		``,
		`[model_providers.team-codex-relay]`,
		`name = "Old Name"`,
		`env_key = "OPENAI_API_KEY"`,
		`experimental_bearer_token = "stale-token"`,
		`wire_api = "chat_completions"`,
	}, "\n") + "\n"
	if err := os.WriteFile(configPath, []byte(existingConfig), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	oauthAuthJSON := `{"auth_mode":"apikey","OPENAI_API_KEY":"stale","tokens":{"id_token":"` + fakeChatGPTIDToken("dev@example.com", "plus", "acct-1") + `","access_token":"oauth-token","refresh_token":"refresh-token","account_id":"acct-1"},"user":{"email":"dev@example.com"}}`
	result, err := applyRelayServiceConfigToLocalV2(RelayLocalApplyInput{
		AuthFileContentBase64: base64.StdEncoding.EncodeToString([]byte(oauthAuthJSON)),
		BaseURL:               "http://127.0.0.1:8317/v1",
		Model:                 "gpt-5.5",
		ReasoningEffort:       "high",
		ProviderID:            "team-codex-relay",
		ProviderName:          "Team Codex Relay",
		SupportsWebsockets:    true,
		AuthStrategy:          relayLocalAuthStrategyReplaceAuthWithOAuth,
	})
	if err != nil {
		t.Fatalf("applyRelayServiceConfigToLocalV2 returned error: %v", err)
	}

	authBody, err := os.ReadFile(result.AuthFilePath)
	if err != nil {
		t.Fatalf("ReadFile auth.json: %v", err)
	}
	var authPayload map[string]any
	if err := json.Unmarshal(authBody, &authPayload); err != nil {
		t.Fatalf("Unmarshal auth.json: %v", err)
	}
	if authPayload["auth_mode"] != "chatgpt" {
		t.Fatalf("auth_mode = %#v, want chatgpt", authPayload["auth_mode"])
	}
	if _, ok := authPayload["OPENAI_API_KEY"]; ok {
		t.Fatalf("OAuth auth.json should remove OPENAI_API_KEY: %#v", authPayload)
	}
	if !hasAuthTokens(authPayload["tokens"]) {
		t.Fatalf("OAuth auth.json should keep tokens: %#v", authPayload)
	}
	if readNestedAuthString(authPayload, "tokens", "access_token") != "oauth-token" {
		t.Fatalf("OAuth auth.json should keep access token: %#v", authPayload)
	}

	configBody, err := os.ReadFile(result.ConfigPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	configContent := string(configBody)
	if !strings.Contains(configContent, `model = "gpt-5.5"`) {
		t.Fatalf("config.toml missing model: %s", configContent)
	}
	if !strings.Contains(configContent, `model_provider = "team-codex-relay"`) {
		t.Fatalf("config.toml missing model_provider: %s", configContent)
	}
	if !strings.Contains(configContent, `base_url = "https://chatgpt.com/backend-api/codex"`) {
		t.Fatalf("OAuth config.toml should point provider at ChatGPT Codex backend: %s", configContent)
	}
	if !strings.Contains(configContent, `requires_openai_auth = true`) || !strings.Contains(configContent, `wire_api = "responses"`) {
		t.Fatalf("config.toml missing Codex OAuth provider fields: %s", configContent)
	}
	if strings.Contains(configContent, `env_key = "OPENAI_API_KEY"`) || strings.Contains(configContent, `experimental_bearer_token = "stale-token"`) {
		t.Fatalf("OAuth mode should remove provider token fields: %s", configContent)
	}
}

func TestApplyRelayServiceConfigToLocalV2ReplaceAuthWithOAuthAcceptsSidecarFlatAuthFile(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())

	oauthAuthJSON := `{"type":"codex","access_token":"flat-access","id_token":"` + fakeChatGPTIDToken("flat@example.com", "pro", "acct-flat") + `","refresh_token":"flat-refresh","account_id":"acct-flat","email":"flat@example.com","plan_type":"pro"}`
	result, err := applyRelayServiceConfigToLocalV2(RelayLocalApplyInput{
		AuthFileContentBase64: base64.StdEncoding.EncodeToString([]byte(oauthAuthJSON)),
		BaseURL:               "http://127.0.0.1:8317/v1",
		Model:                 "gpt-5.5",
		ReasoningEffort:       "high",
		ProviderID:            "team-codex-relay",
		ProviderName:          "Team Codex Relay",
		AuthStrategy:          relayLocalAuthStrategyReplaceAuthWithOAuth,
	})
	if err != nil {
		t.Fatalf("applyRelayServiceConfigToLocalV2 returned error: %v", err)
	}

	authBody, err := os.ReadFile(result.AuthFilePath)
	if err != nil {
		t.Fatalf("ReadFile auth.json: %v", err)
	}
	var authPayload map[string]any
	if err := json.Unmarshal(authBody, &authPayload); err != nil {
		t.Fatalf("Unmarshal auth.json: %v", err)
	}
	if authPayload["auth_mode"] != "chatgpt" {
		t.Fatalf("auth_mode = %#v, want chatgpt", authPayload["auth_mode"])
	}
	if _, ok := authPayload["access_token"]; ok {
		t.Fatalf("sidecar flat access_token should be moved under tokens: %#v", authPayload)
	}
	if readNestedAuthString(authPayload, "tokens", "access_token") != "flat-access" {
		t.Fatalf("tokens.access_token = %#v, want flat-access", authPayload["tokens"])
	}
	if readNestedAuthString(authPayload, "tokens", "refresh_token") != "flat-refresh" {
		t.Fatalf("tokens.refresh_token = %#v, want flat-refresh", authPayload["tokens"])
	}
	if readNestedAuthString(authPayload, "tokens", "account_id") != "acct-flat" {
		t.Fatalf("tokens.account_id = %#v, want acct-flat", authPayload["tokens"])
	}
	if readNestedAuthString(authPayload, "user", "email") != "flat@example.com" {
		t.Fatalf("user.email = %#v, want flat@example.com", authPayload["user"])
	}
}

func TestApplyRelayServiceConfigToLocalV2ReplaceAuthWithOAuthRemovesOpenAIBaseURL(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())

	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}

	configPath := filepath.Join(codexHome, "config.toml")
	existingConfig := strings.Join([]string{
		`model = "gpt-4.1"`,
		`openai_base_url = "http://127.0.0.1:8317/v1"`,
	}, "\n") + "\n"
	if err := os.WriteFile(configPath, []byte(existingConfig), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	oauthAuthJSON := `{"auth_mode":"chatgpt","tokens":{"id_token":"` + fakeChatGPTIDToken("dev@example.com", "plus", "acct-1") + `","access_token":"oauth-token","refresh_token":"refresh-token","account_id":"acct-1"}}`
	result, err := applyRelayServiceConfigToLocalV2(RelayLocalApplyInput{
		AuthFileContentBase64: base64.StdEncoding.EncodeToString([]byte(oauthAuthJSON)),
		BaseURL:               "http://127.0.0.1:8317/v1",
		Model:                 "gpt-5.5",
		ReasoningEffort:       "high",
		ProviderID:            "openai",
		ProviderName:          "OpenAI",
		AuthStrategy:          relayLocalAuthStrategyReplaceAuthWithOAuth,
	})
	if err != nil {
		t.Fatalf("applyRelayServiceConfigToLocalV2 returned error: %v", err)
	}

	configBody, err := os.ReadFile(result.ConfigPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	configContent := string(configBody)
	if strings.Contains(configContent, `openai_base_url`) {
		t.Fatalf("OAuth openai provider should remove openai_base_url so Codex uses ChatGPT backend: %s", configContent)
	}
}

func TestApplyRelayServiceConfigToLocalV2PreserveChatGPTAuthRejectsBuiltinOpenAIProvider(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)

	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	authPath := filepath.Join(codexHome, "auth.json")
	if err := os.WriteFile(authPath, []byte("{\n  \"auth_mode\": \"chatgpt\",\n  \"tokens\": {\"access_token\": \"abc\"}\n}\n"), 0600); err != nil {
		t.Fatalf("WriteFile auth.json: %v", err)
	}

	_, err := applyRelayServiceConfigToLocalV2(RelayLocalApplyInput{
		APIKey:          "sk-relay-test",
		BaseURL:         "http://127.0.0.1:8317/v1",
		Model:           "gpt-5.5",
		ReasoningEffort: "high",
		ProviderID:      "openai",
		ProviderName:    "OpenAI",
		AuthStrategy:    relayLocalAuthStrategyPreserveChatGPTAuth,
	})
	if err == nil || !strings.Contains(err.Error(), "openai") {
		t.Fatalf("expected openai provider rejection, got: %v", err)
	}
}

func TestApplyRelayServiceConfigToLocalV2PreserveChatGPTAuthRejectsMissingChatGPTAuth(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)

	_, err := applyRelayServiceConfigToLocalV2(RelayLocalApplyInput{
		APIKey:          "sk-relay-test",
		BaseURL:         "http://127.0.0.1:8317/v1",
		Model:           "gpt-5.5",
		ReasoningEffort: "high",
		ProviderID:      "gettokens",
		ProviderName:    "GetTokens",
		AuthStrategy:    relayLocalAuthStrategyPreserveChatGPTAuth,
	})
	if err == nil || !strings.Contains(err.Error(), "ChatGPT") {
		t.Fatalf("expected missing ChatGPT auth rejection, got: %v", err)
	}
}

func TestApplyRelayServiceConfigToLocalV2ReplaceAuthWithAPIKeyRemovesExperimentalBearerToken(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)

	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}

	configPath := filepath.Join(codexHome, "config.toml")
	existingConfig := strings.Join([]string{
		`model = "gpt-4.1"`,
		``,
		`[model_providers.gettokens]`,
		`name = "Old Name"`,
		`experimental_bearer_token = "stale-token"`,
		`wire_api = "responses"`,
	}, "\n") + "\n"
	if err := os.WriteFile(configPath, []byte(existingConfig), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	if _, err := applyRelayServiceConfigToLocalV2(RelayLocalApplyInput{
		APIKey:          "sk-relay-test",
		BaseURL:         "http://127.0.0.1:8317/v1",
		Model:           "gpt-5.5",
		ReasoningEffort: "high",
		ProviderID:      "gettokens",
		ProviderName:    "GetTokens",
		AuthStrategy:    relayLocalAuthStrategyReplaceAuthWithAPIKey,
	}); err != nil {
		t.Fatalf("applyRelayServiceConfigToLocalV2 returned error: %v", err)
	}

	configBody, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	if strings.Contains(string(configBody), `experimental_bearer_token = "stale-token"`) {
		t.Fatalf("replace_auth_with_apikey should remove stale experimental_bearer_token: %s", string(configBody))
	}
}

func fakeChatGPTIDToken(email string, planType string, accountID string) string {
	header, _ := json.Marshal(map[string]any{
		"alg": "none",
		"typ": "JWT",
	})
	payload, _ := json.Marshal(map[string]any{
		"email": email,
		"https://api.openai.com/auth": map[string]any{
			"chatgpt_plan_type":  planType,
			"chatgpt_account_id": accountID,
		},
	})
	return base64.RawURLEncoding.EncodeToString(header) + "." +
		base64.RawURLEncoding.EncodeToString(payload) + "." +
		base64.RawURLEncoding.EncodeToString([]byte("sig"))
}
