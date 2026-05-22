package wailsapp

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestReadSettingsLayer_ValidJSON(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "settings.json")
	body := `{
  "env": {
    "ANTHROPIC_MODEL": "claude-sonnet-4-6"
  },
  "permissions": {
    "allow": ["Read", "Write"]
  },
  "disableAllHooks": false,
  "outputStyle": "default"
}`
	if err := os.WriteFile(path, []byte(body), 0600); err != nil {
		t.Fatal(err)
	}

	layer := readSettingsLayer(SettingsScopeUser, path)
	if !layer.Exists {
		t.Fatal("expected layer to exist")
	}
	if layer.ParseError != "" {
		t.Fatalf("unexpected parse error: %s", layer.ParseError)
	}
	if layer.KnownFields == nil {
		t.Fatal("expected known fields")
	}
	if layer.KnownFields.Env["ANTHROPIC_MODEL"] != "claude-sonnet-4-6" {
		t.Fatalf("expected env.ANTHROPIC_MODEL, got %v", layer.KnownFields.Env)
	}
	if layer.KnownFields.OutputStyle != "default" {
		t.Fatalf("expected outputStyle=default, got %s", layer.KnownFields.OutputStyle)
	}
	if layer.KnownFields.DisableAllHooks == nil || *layer.KnownFields.DisableAllHooks != false {
		t.Fatal("expected disableAllHooks=false")
	}
}

func TestReadSettingsLayer_InvalidJSON(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "settings.json")
	if err := os.WriteFile(path, []byte(`{ broken json`), 0600); err != nil {
		t.Fatal(err)
	}

	layer := readSettingsLayer(SettingsScopeUser, path)
	if !layer.Exists {
		t.Fatal("expected layer to exist (file present)")
	}
	if layer.ParseError == "" {
		t.Fatal("expected parse error for invalid JSON")
	}
	if layer.KnownFields != nil {
		t.Fatal("expected nil known fields on parse error")
	}
}

func TestReadSettingsLayer_FileNotExists(t *testing.T) {
	layer := readSettingsLayer(SettingsScopeUser, "/nonexistent/settings.json")
	if layer.Exists {
		t.Fatal("expected layer not to exist")
	}
}

func TestReadSettingsLayer_EmptyFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "settings.json")
	if err := os.WriteFile(path, []byte(""), 0600); err != nil {
		t.Fatal(err)
	}

	layer := readSettingsLayer(SettingsScopeUser, path)
	if layer.Exists {
		t.Fatal("expected empty file to report Exists=false")
	}
}

func TestGetClaudeCodeSettingsSnapshot_UserLayer(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("CLAUDE_CONFIG_DIR", dir)
	settingsPath := filepath.Join(dir, "settings.json")
	body := `{"env":{"ANTHROPIC_API_KEY":"sk-ant-test"}}`
	if err := os.WriteFile(settingsPath, []byte(body), 0600); err != nil {
		t.Fatal(err)
	}

	// We can't fully unit-test GetClaudeCodeSettingsSnapshot because it uses os.Getwd().
	// The layer reading functions are tested independently above.
	// This test verifies the read path works.
	layer := readSettingsLayer(SettingsScopeUser, settingsPath)
	if !layer.Exists {
		t.Fatal("expected user settings to exist")
	}
	if layer.KnownFields.Env["ANTHROPIC_API_KEY"] != "sk-ant-test" {
		t.Fatalf("unexpected env value: %v", layer.KnownFields.Env)
	}
}

func TestPatchClaudeCodeSettings_EnvOnly(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "settings.json")
	body := `{
  "env": {
    "ANTHROPIC_MODEL": "claude-sonnet-4-6"
  },
  "hooks": {
    "PostToolUse": []
  },
  "permissions": {
    "allow": ["Read", "Write"]
  },
  "statusLine": {"type": "none"}
}`
	if err := os.WriteFile(path, []byte(body), 0600); err != nil {
		t.Fatal(err)
	}

	app := &App{}
	result, err := app.PatchClaudeCodeSettings(PatchClaudeCodeSettingsInput{
		Scope: SettingsScopeUser,
		Path:  path,
		Patches: map[string]any{
			"env": map[string]string{
				"ANTHROPIC_MODEL": "claude-opus-4-7",
			},
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.ConfigPath != path {
		t.Fatalf("expected path %s, got %s", path, result.ConfigPath)
	}
	if len(result.Changes) == 0 {
		t.Fatal("expected at least one change")
	}

	// Verify file was written and preserves other fields
	saved, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var root map[string]json.RawMessage
	if err := json.Unmarshal(saved, &root); err != nil {
		t.Fatalf("saved file is not valid JSON: %v", err)
	}
	// Check env was updated
	var envMap map[string]string
	if err := json.Unmarshal(root["env"], &envMap); err != nil {
		t.Fatal("env is not valid after save")
	}
	if envMap["ANTHROPIC_MODEL"] != "claude-opus-4-7" {
		t.Fatalf("expected ANTHROPIC_MODEL=claude-opus-4-7, got %s", envMap["ANTHROPIC_MODEL"])
	}
	// Verify hooks preserved
	if _, ok := root["hooks"]; !ok {
		t.Fatal("expected hooks to be preserved")
	}
	// Verify permissions preserved
	if _, ok := root["permissions"]; !ok {
		t.Fatal("expected permissions to be preserved")
	}
	// Verify statusLine preserved
	if _, ok := root["statusLine"]; !ok {
		t.Fatal("expected statusLine to be preserved")
	}
}

func TestPatchClaudeCodeSettings_DisableAllHooks(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "settings.json")
	body := `{
  "hooks": {
    "PostToolUse": [{"matcher": "", "command": "echo hi"}]
  },
  "disableAllHooks": false
}`
	if err := os.WriteFile(path, []byte(body), 0600); err != nil {
		t.Fatal(err)
	}

	app := &App{}
	_, err := app.PatchClaudeCodeSettings(PatchClaudeCodeSettingsInput{
		Scope: SettingsScopeUser,
		Path:  path,
		Patches: map[string]any{
			"disableAllHooks": true,
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	saved, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var root map[string]json.RawMessage
	if err := json.Unmarshal(saved, &root); err != nil {
		t.Fatal(err)
	}
	var disableAllHooks bool
	if err := json.Unmarshal(root["disableAllHooks"], &disableAllHooks); err != nil {
		t.Fatal("disableAllHooks not found or invalid")
	}
	if !disableAllHooks {
		t.Fatal("expected disableAllHooks=true")
	}
	// hooks list should be preserved (not deleted)
	if _, ok := root["hooks"]; !ok {
		t.Fatal("expected hooks to be preserved when disableAllHooks is patched")
	}
}

func TestPatchClaudeCodeSettings_RejectUnknownKey(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "settings.json")
	if err := os.WriteFile(path, []byte(`{}`), 0600); err != nil {
		t.Fatal(err)
	}

	app := &App{}
	_, err := app.PatchClaudeCodeSettings(PatchClaudeCodeSettingsInput{
		Scope: SettingsScopeUser,
		Path:  path,
		Patches: map[string]any{
			"unknownField": "value",
		},
	})
	if err == nil {
		t.Fatal("expected error for unknown patch key")
	}
	if !strings.Contains(err.Error(), "不允许 patch 字段") {
		t.Fatalf("unexpected error message: %v", err)
	}
}

func TestPatchClaudeCodeSettings_RejectManagedScope(t *testing.T) {
	app := &App{}
	_, err := app.PatchClaudeCodeSettings(PatchClaudeCodeSettingsInput{
		Scope: SettingsScopeManaged,
		Path:  "/some/path",
		Patches: map[string]any{
			"outputStyle": "compact",
		},
	})
	if err == nil {
		t.Fatal("expected error for managed scope")
	}
}

func TestPatchClaudeCodeSettings_InvalidJSON(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "settings.json")
	if err := os.WriteFile(path, []byte(`{ invalid`), 0600); err != nil {
		t.Fatal(err)
	}

	app := &App{}
	_, err := app.PatchClaudeCodeSettings(PatchClaudeCodeSettingsInput{
		Scope: SettingsScopeUser,
		Path:  path,
		Patches: map[string]any{
			"outputStyle": "compact",
		},
	})
	if err == nil {
		t.Fatal("expected error for invalid JSON in existing file")
	}
}

func TestPatchClaudeCodeSettings_CreateNew(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "settings.json")

	app := &App{}
	result, err := app.PatchClaudeCodeSettings(PatchClaudeCodeSettingsInput{
		Scope: SettingsScopeUser,
		Path:  path,
		Patches: map[string]any{
			"env": map[string]string{
				"ANTHROPIC_MODEL": "claude-sonnet-4-6",
			},
		},
	})
	if err != nil {
		t.Fatalf("unexpected error creating new file: %v", err)
	}
	if result.ConfigPath != path {
		t.Fatalf("expected path %s, got %s", path, result.ConfigPath)
	}

	saved, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var root map[string]json.RawMessage
	if err := json.Unmarshal(saved, &root); err != nil {
		t.Fatal("new file is not valid JSON")
	}
	var envMap map[string]string
	if err := json.Unmarshal(root["env"], &envMap); err != nil {
		t.Fatal("env not found in new file")
	}
	if envMap["ANTHROPIC_MODEL"] != "claude-sonnet-4-6" {
		t.Fatalf("unexpected model: %s", envMap["ANTHROPIC_MODEL"])
	}
}

func TestParseSettingsFields_BadEnv(t *testing.T) {
	body := `{"env": "not-an-object"}`
	_, err := parseSettingsFields(body)
	if err == nil {
		t.Fatal("expected error for non-object env field")
	}
}

func TestParseSettingsFields_Partial(t *testing.T) {
	body := `{"outputStyle": "compact"}`
	fields, err := parseSettingsFields(body)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if fields.OutputStyle != "compact" {
		t.Fatalf("expected outputStyle='compact', got '%s'", fields.OutputStyle)
	}
	if fields.Env != nil {
		t.Fatal("expected nil env when not present")
	}
}
