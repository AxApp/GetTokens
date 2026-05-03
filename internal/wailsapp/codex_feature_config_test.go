package wailsapp

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSaveCodexFeatureConfigAppendsFeaturesSectionWhenMissing(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	existing := strings.Join([]string{
		`model = "gpt-5.4"`,
		``,
		`[model_providers.gettokens]`,
		`name = "GetTokens"`,
	}, "\n") + "\n"
	if err := os.WriteFile(configPath, []byte(existing), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	result, err := app.SaveCodexFeatureConfig(SaveCodexFeatureConfigInput{
		Values: map[string]bool{"goals": true},
	})
	if err != nil {
		t.Fatalf("SaveCodexFeatureConfig returned error: %v", err)
	}
	if result.WillCreate {
		t.Fatalf("WillCreate = true, want false for existing config")
	}

	body, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	content := string(body)
	if !strings.Contains(content, existing) {
		t.Fatalf("existing content should be preserved: %s", content)
	}
	if !strings.Contains(content, "\n[features]\ngoals = true\n") {
		t.Fatalf("features section not appended as expected: %s", content)
	}
}

func TestSaveCodexFeatureConfigPreservesTrailingCommentWhenUpdatingBool(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	existing := "[features]\n  tool_search = true # app tools\n"
	if err := os.WriteFile(configPath, []byte(existing), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	if _, err := app.SaveCodexFeatureConfig(SaveCodexFeatureConfigInput{
		Values: map[string]bool{"tool_search": false},
	}); err != nil {
		t.Fatalf("SaveCodexFeatureConfig returned error: %v", err)
	}

	body, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	if got, want := string(body), "[features]\n  tool_search = false # app tools\n"; got != want {
		t.Fatalf("config.toml = %q, want %q", got, want)
	}
}

func TestGetCodexFeatureConfigReportsLegacyAliasWarning(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	if err := os.WriteFile(configPath, []byte("[features]\ncollab = true\n"), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	snapshot, err := app.GetCodexFeatureConfig()
	if err != nil {
		t.Fatalf("GetCodexFeatureConfig returned error: %v", err)
	}
	if !snapshot.Values["collab"] {
		t.Fatalf("legacy alias value not returned: %#v", snapshot.Values)
	}
	if len(snapshot.Warnings) == 0 || !strings.Contains(strings.Join(snapshot.Warnings, "\n"), "collab") || !strings.Contains(strings.Join(snapshot.Warnings, "\n"), "multi_agent") {
		t.Fatalf("legacy alias warning missing canonical hint: %#v", snapshot.Warnings)
	}

	foundAliasDefinition := false
	for _, definition := range snapshot.Definitions {
		if definition.Key == "collab" && definition.LegacyAlias && definition.CanonicalKey == "multi_agent" {
			foundAliasDefinition = true
			break
		}
	}
	if !foundAliasDefinition {
		t.Fatalf("legacy alias definition not returned: %#v", snapshot.Definitions)
	}
}

func TestGetCodexFeatureConfigReturnsDescriptionsForDefinitions(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}

	app := &App{}
	snapshot, err := app.GetCodexFeatureConfig()
	if err != nil {
		t.Fatalf("GetCodexFeatureConfig returned error: %v", err)
	}
	if len(snapshot.Definitions) == 0 {
		t.Fatal("definitions should not be empty")
	}

	descriptionsByKey := map[string]string{}
	for _, definition := range snapshot.Definitions {
		if strings.TrimSpace(definition.Description) == "" {
			t.Fatalf("definition %q returned empty description", definition.Key)
		}
		descriptionsByKey[definition.Key] = definition.Description
	}
	if !strings.Contains(descriptionsByKey["memories"], "new memories") {
		t.Fatalf("memories description should come from upstream menu text: %q", descriptionsByKey["memories"])
	}
	if !strings.Contains(descriptionsByKey["collab"], "Legacy alias") {
		t.Fatalf("legacy alias should include a generated alias description: %q", descriptionsByKey["collab"])
	}
}

func TestSaveCodexFeatureConfigPreservesCompositeFeatureTable(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	existing := strings.Join([]string{
		`[features]`,
		`tool_search = true`,
		``,
		`[features.multi_agent_v2]`,
		`enabled = true`,
		`mode = "review"`,
	}, "\n") + "\n"
	if err := os.WriteFile(configPath, []byte(existing), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	if _, err := app.SaveCodexFeatureConfig(SaveCodexFeatureConfigInput{
		Values: map[string]bool{"goals": true},
	}); err != nil {
		t.Fatalf("SaveCodexFeatureConfig returned error: %v", err)
	}

	body, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	content := string(body)
	if !strings.Contains(content, "[features.multi_agent_v2]\nenabled = true\nmode = \"review\"\n") {
		t.Fatalf("composite feature table not preserved: %s", content)
	}
	if strings.Index(content, "goals = true") > strings.Index(content, "[features.multi_agent_v2]") {
		t.Fatalf("new bool key should be appended inside [features], before composite table: %s", content)
	}
}

func TestGetCodexFeatureConfigReturnsUnknownBoolValues(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	if err := os.WriteFile(configPath, []byte("[features]\nfuture_feature = true\ngoals = false\n"), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	snapshot, err := app.GetCodexFeatureConfig()
	if err != nil {
		t.Fatalf("GetCodexFeatureConfig returned error: %v", err)
	}
	if !snapshot.Values["future_feature"] {
		t.Fatalf("unknown bool should remain in values: %#v", snapshot.Values)
	}
	if !snapshot.UnknownValues["future_feature"] {
		t.Fatalf("unknown bool should be expressed in UnknownValues: %#v", snapshot.UnknownValues)
	}
}

func TestSaveCodexFeatureConfigPreservesUnknownBoolValues(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	if err := os.WriteFile(configPath, []byte("[features]\nfuture_feature = true\n"), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	if _, err := app.SaveCodexFeatureConfig(SaveCodexFeatureConfigInput{
		Values: map[string]bool{"goals": true},
	}); err != nil {
		t.Fatalf("SaveCodexFeatureConfig returned error: %v", err)
	}

	body, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	content := string(body)
	if !strings.Contains(content, "future_feature = true") || !strings.Contains(content, "goals = true") {
		t.Fatalf("unknown bool or new key missing after save: %s", content)
	}
}

func TestSaveCodexFeatureConfigPreservesCRLF(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	if err := os.WriteFile(configPath, []byte("[features]\r\ngoals = false\r\n"), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	if _, err := app.SaveCodexFeatureConfig(SaveCodexFeatureConfigInput{
		Values: map[string]bool{"goals": true},
	}); err != nil {
		t.Fatalf("SaveCodexFeatureConfig returned error: %v", err)
	}

	body, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	content := string(body)
	if strings.Contains(content, "\n") && !strings.Contains(content, "\r\n") {
		t.Fatalf("CRLF not preserved: %q", content)
	}
	if got, want := content, "[features]\r\ngoals = true\r\n"; got != want {
		t.Fatalf("config.toml = %q, want %q", got, want)
	}
}

func TestPreviewCodexFeatureConfigClassifiesChanges(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	if err := os.WriteFile(configPath, []byte("[features]\ngoals = false\ntool_search=true # compact unchanged\n"), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	preview, err := app.PreviewCodexFeatureConfig(SaveCodexFeatureConfigInput{
		Values: map[string]bool{
			"goals":       true,
			"tool_search": true,
			"memories":    true,
		},
	})
	if err != nil {
		t.Fatalf("PreviewCodexFeatureConfig returned error: %v", err)
	}
	changesByKey := make(map[string]CodexFeatureConfigChange)
	for _, change := range preview.Changes {
		changesByKey[change.Key] = change
	}
	if changesByKey["goals"].Type != "updated" {
		t.Fatalf("goals change = %#v, want updated", changesByKey["goals"])
	}
	if changesByKey["tool_search"].Type != "unchanged" {
		t.Fatalf("tool_search change = %#v, want unchanged", changesByKey["tool_search"])
	}
	if changesByKey["memories"].Type != "added" {
		t.Fatalf("memories change = %#v, want added", changesByKey["memories"])
	}
	if !strings.Contains(preview.Preview, "memories = true") || !strings.Contains(preview.Preview, "goals = true") {
		t.Fatalf("preview content not patched: %s", preview.Preview)
	}
	if !strings.Contains(preview.Preview, "tool_search=true # compact unchanged") {
		t.Fatalf("unchanged key line should not be reformatted: %s", preview.Preview)
	}
}
