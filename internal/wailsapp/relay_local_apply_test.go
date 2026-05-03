package wailsapp

import (
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

	result, err := applyRelayServiceConfigToLocal("sk-relay-test", "http://127.0.0.1:8317/v1", "gpt-5.5", "low", "openai", "OpenAI")
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

	result, err := applyRelayServiceConfigToLocal("sk-relay-test", "http://127.0.0.1:8317/v1", "gpt-5.5", "xhigh", "gettokens", "GetTokens")
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
}

func TestApplyRelayServiceConfigToLocalMarksLastUsedMetadata(t *testing.T) {
	t.Setenv("CODEX_HOME", filepath.Join(t.TempDir(), ".codex"))
	t.Setenv("HOME", t.TempDir())

	app := &App{}
	if _, err := app.ApplyRelayServiceConfigToLocal("sk-gettokens-test", "http://127.0.0.1:8317/v1", "gpt-5.4", "high", "openai", "OpenAI"); err != nil {
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

	if _, err := applyRelayServiceConfigToLocal("sk-relay-test", "http://127.0.0.1:8317/v1", "gpt-5.5", "low", "openai", "OpenAI"); err != nil {
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

func TestApplyRelayServiceConfigToLocalPreservesExistingProviderSectionAndAuthFields(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())

	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}

	authPath := filepath.Join(codexHome, "auth.json")
	if err := os.WriteFile(authPath, []byte("{\n  \"auth_mode\": \"chatgpt\",\n  \"tokens\": {\"access_token\": \"abc\"}\n}\n"), 0600); err != nil {
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

	if _, err := applyRelayServiceConfigToLocal("sk-relay-test", "http://127.0.0.1:8317/v1", "gpt-5.5", "xhigh", "gettokens", "GetTokens"); err != nil {
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
	if _, ok := authPayload["tokens"]; !ok {
		t.Fatalf("existing auth.json fields should be preserved: %#v", authPayload)
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
	if !strings.Contains(configContent, `requires_openai_auth = true`) || !strings.Contains(configContent, `wire_api = "responses"`) {
		t.Fatalf("provider section missing required fields: %s", configContent)
	}
	if strings.Index(configContent, `name = "GetTokens"`) > strings.Index(configContent, `env_key = "OPENAI_API_KEY"`) {
		t.Fatalf("existing provider key order should be preserved: %s", configContent)
	}
}
