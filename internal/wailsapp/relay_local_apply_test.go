package wailsapp

import (
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

func TestApplyRelayServiceConfigToLocalWritesProviderFacingFiles(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())

	result, err := applyRelayServiceConfigToLocal("sk-relay-test", "http://127.0.0.1:8317/v1")
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
	if !strings.Contains(configContent, `model = "gpt-5.4"`) {
		t.Fatalf("config.toml missing model: %s", configContent)
	}
	if !strings.Contains(configContent, `openai_base_url = "http://127.0.0.1:8317/v1"`) {
		t.Fatalf("config.toml missing openai_base_url: %s", configContent)
	}
}

func TestApplyRelayServiceConfigToLocalMarksLastUsedMetadata(t *testing.T) {
	t.Setenv("CODEX_HOME", filepath.Join(t.TempDir(), ".codex"))
	t.Setenv("HOME", t.TempDir())

	app := &App{}
	if _, err := app.ApplyRelayServiceConfigToLocal("sk-gettokens-test", "http://127.0.0.1:8317/v1"); err != nil {
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
