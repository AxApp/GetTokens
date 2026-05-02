package wailsapp

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestApplyClaudeCodeAPIKeyConfigToLocalUsesCLAUDECONFIGDIROverride(t *testing.T) {
	claudeDir := filepath.Join(t.TempDir(), "custom-claude")
	t.Setenv("CLAUDE_CONFIG_DIR", claudeDir)
	t.Setenv("HOME", t.TempDir())

	app := &App{}
	result, err := app.ApplyClaudeCodeAPIKeyConfigToLocal("sk-ant-test", "http://127.0.0.1:8317", "")
	if err != nil {
		t.Fatalf("ApplyClaudeCodeAPIKeyConfigToLocal returned error: %v", err)
	}

	if result.ClaudeConfigDirPath != claudeDir {
		t.Fatalf("ClaudeConfigDirPath = %q, want %q", result.ClaudeConfigDirPath, claudeDir)
	}
	if result.SettingsPath != filepath.Join(claudeDir, "settings.json") {
		t.Fatalf("SettingsPath = %q, want settings.json under override dir", result.SettingsPath)
	}
	if _, err := os.Stat(result.SettingsPath); err != nil {
		t.Fatalf("settings.json should be written: %v", err)
	}
}

func TestApplyClaudeCodeAPIKeyConfigToLocalDefaultsToHomeClaudeSettings(t *testing.T) {
	home := t.TempDir()
	t.Setenv("CLAUDE_CONFIG_DIR", "")
	t.Setenv("HOME", home)

	app := &App{}
	result, err := app.ApplyClaudeCodeAPIKeyConfigToLocal("sk-ant-test", "http://127.0.0.1:8317", "")
	if err != nil {
		t.Fatalf("ApplyClaudeCodeAPIKeyConfigToLocal returned error: %v", err)
	}

	wantDir := filepath.Join(home, ".claude")
	if result.ClaudeConfigDirPath != wantDir {
		t.Fatalf("ClaudeConfigDirPath = %q, want %q", result.ClaudeConfigDirPath, wantDir)
	}
	if result.SettingsPath != filepath.Join(wantDir, "settings.json") {
		t.Fatalf("SettingsPath = %q, want default ~/.claude/settings.json", result.SettingsPath)
	}
}

func TestApplyClaudeCodeAPIKeyConfigToLocalCreatesNewSettingsFile(t *testing.T) {
	claudeDir := filepath.Join(t.TempDir(), ".claude")
	t.Setenv("CLAUDE_CONFIG_DIR", claudeDir)
	t.Setenv("HOME", t.TempDir())

	app := &App{}
	result, err := app.ApplyClaudeCodeAPIKeyConfigToLocal("sk-ant-test", "http://127.0.0.1:8317/", "")
	if err != nil {
		t.Fatalf("ApplyClaudeCodeAPIKeyConfigToLocal returned error: %v", err)
	}

	body, err := os.ReadFile(result.SettingsPath)
	if err != nil {
		t.Fatalf("ReadFile settings.json: %v", err)
	}

	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatalf("settings.json should be valid JSON: %v\n%s", err, body)
	}
	env, ok := payload["env"].(map[string]any)
	if !ok {
		t.Fatalf("settings.json should contain env object: %#v", payload)
	}
	if env["ANTHROPIC_API_KEY"] != "sk-ant-test" {
		t.Fatalf("ANTHROPIC_API_KEY not written: %#v", env)
	}
	if env["ANTHROPIC_BASE_URL"] != "http://127.0.0.1:8317" {
		t.Fatalf("ANTHROPIC_BASE_URL not normalized/written: %#v", env)
	}
	if _, ok := env["ANTHROPIC_MODEL"]; ok {
		t.Fatalf("ANTHROPIC_MODEL should not be written when model is empty: %#v", env)
	}
}

func TestApplyClaudeCodeAPIKeyConfigToLocalPreservesTopLevelAndEnvFields(t *testing.T) {
	claudeDir := filepath.Join(t.TempDir(), ".claude")
	t.Setenv("CLAUDE_CONFIG_DIR", claudeDir)
	t.Setenv("HOME", t.TempDir())

	if err := os.MkdirAll(claudeDir, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	settingsPath := filepath.Join(claudeDir, "settings.json")
	existing := strings.Join([]string{
		`{`,
		`  "permissions": {`,
		`    "allow": ["Bash(go test ./internal/wailsapp)"]`,
		`  },`,
		`  "env": {`,
		`    "HTTP_PROXY": "http://proxy.local:8080",`,
		`    "ANTHROPIC_API_KEY": "old-key"`,
		`  },`,
		`  "hooks": {`,
		`    "PreToolUse": []`,
		`  },`,
		`  "statusLine": {`,
		`    "type": "command",`,
		`    "command": "printf status"`,
		`  }`,
		`}`,
	}, "\n") + "\n"
	if err := os.WriteFile(settingsPath, []byte(existing), 0600); err != nil {
		t.Fatalf("WriteFile settings.json: %v", err)
	}

	app := &App{}
	if _, err := app.ApplyClaudeCodeAPIKeyConfigToLocal("sk-ant-new", "http://127.0.0.1:8317/v1", "claude-sonnet-test"); err != nil {
		t.Fatalf("ApplyClaudeCodeAPIKeyConfigToLocal returned error: %v", err)
	}

	body, err := os.ReadFile(settingsPath)
	if err != nil {
		t.Fatalf("ReadFile settings.json: %v", err)
	}
	content := string(body)
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatalf("patched settings.json should remain valid JSON: %v\n%s", err, content)
	}

	for _, expected := range []string{
		`"permissions": {`,
		`"allow": ["Bash(go test ./internal/wailsapp)"]`,
		`"hooks": {`,
		`"PreToolUse": []`,
		`"statusLine": {`,
		`"command": "printf status"`,
		`"HTTP_PROXY": "http://proxy.local:8080"`,
		`"ANTHROPIC_API_KEY": "sk-ant-new"`,
		`"ANTHROPIC_BASE_URL": "http://127.0.0.1:8317/v1"`,
		`"ANTHROPIC_MODEL": "claude-sonnet-test"`,
	} {
		if !strings.Contains(content, expected) {
			t.Fatalf("settings.json missing preserved or patched content %q:\n%s", expected, content)
		}
	}
}

func TestApplyClaudeCodeAPIKeyConfigToLocalPreservesAuthTokenAndReturnsWarning(t *testing.T) {
	claudeDir := filepath.Join(t.TempDir(), ".claude")
	t.Setenv("CLAUDE_CONFIG_DIR", claudeDir)
	t.Setenv("HOME", t.TempDir())

	if err := os.MkdirAll(claudeDir, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	settingsPath := filepath.Join(claudeDir, "settings.json")
	existing := "{\n  \"env\": {\n    \"ANTHROPIC_AUTH_TOKEN\": \"keep-token\",\n    \"HTTP_PROXY\": \"http://proxy.local:8080\"\n  }\n}\n"
	if err := os.WriteFile(settingsPath, []byte(existing), 0600); err != nil {
		t.Fatalf("WriteFile settings.json: %v", err)
	}

	app := &App{}
	result, err := app.ApplyClaudeCodeAPIKeyConfigToLocal("sk-ant-new", "http://127.0.0.1:8317", "")
	if err != nil {
		t.Fatalf("ApplyClaudeCodeAPIKeyConfigToLocal returned error: %v", err)
	}
	if len(result.Warnings) == 0 || len(result.Conflicts) == 0 {
		t.Fatalf("expected auth token warning/conflict in result: %#v", result)
	}

	body, err := os.ReadFile(settingsPath)
	if err != nil {
		t.Fatalf("ReadFile settings.json: %v", err)
	}
	content := string(body)
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatalf("patched settings.json should remain valid JSON: %v\n%s", err, content)
	}
	if !strings.Contains(content, `"ANTHROPIC_AUTH_TOKEN": "keep-token"`) {
		t.Fatalf("ANTHROPIC_AUTH_TOKEN should be preserved:\n%s", content)
	}
	if !strings.Contains(content, `"ANTHROPIC_API_KEY": "sk-ant-new"`) {
		t.Fatalf("ANTHROPIC_API_KEY should still be written:\n%s", content)
	}
}

func TestApplyClaudeCodeAPIKeyConfigToLocalRejectsInvalidJSON(t *testing.T) {
	claudeDir := filepath.Join(t.TempDir(), ".claude")
	t.Setenv("CLAUDE_CONFIG_DIR", claudeDir)
	t.Setenv("HOME", t.TempDir())

	if err := os.MkdirAll(claudeDir, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	settingsPath := filepath.Join(claudeDir, "settings.json")
	existing := "{ invalid json\n"
	if err := os.WriteFile(settingsPath, []byte(existing), 0600); err != nil {
		t.Fatalf("WriteFile settings.json: %v", err)
	}

	app := &App{}
	if _, err := app.ApplyClaudeCodeAPIKeyConfigToLocal("sk-ant-new", "http://127.0.0.1:8317", "claude-sonnet-test"); err == nil {
		t.Fatalf("expected invalid JSON error")
	}

	body, err := os.ReadFile(settingsPath)
	if err != nil {
		t.Fatalf("ReadFile settings.json: %v", err)
	}
	if string(body) != existing {
		t.Fatalf("invalid settings.json should not be overwritten:\n%s", body)
	}
}
