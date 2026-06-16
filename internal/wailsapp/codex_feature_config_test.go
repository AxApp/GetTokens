package wailsapp

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func assertStringSliceEqual(t *testing.T, label string, got []string, want []string) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("%s = %#v, want %#v", label, got, want)
	}
	for index := range want {
		if got[index] != want[index] {
			t.Fatalf("%s = %#v, want %#v", label, got, want)
		}
	}
}

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
	if !strings.Contains(descriptionsByKey["hide_rate_limit_model_nudge"], "rate limit model switch reminder") {
		t.Fatalf("notice definition should include rate limit nudge description: %q", descriptionsByKey["hide_rate_limit_model_nudge"])
	}
	if !strings.Contains(descriptionsByKey["fast_default_opt_out"], "fast defaults") {
		t.Fatalf("notice definition should include fast default opt-out description: %q", descriptionsByKey["fast_default_opt_out"])
	}
}

func TestGetCodexFeatureConfigReturnsNoticeValues(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	existing := strings.Join([]string{
		`[notice]`,
		`fast_default_opt_out = true`,
		`hide_rate_limit_model_nudge = true`,
		`"hide_gpt-5.1-codex-max_migration_prompt" = false`,
	}, "\n") + "\n"
	if err := os.WriteFile(configPath, []byte(existing), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	snapshot, err := app.GetCodexFeatureConfig()
	if err != nil {
		t.Fatalf("GetCodexFeatureConfig returned error: %v", err)
	}
	if !snapshot.Values["hide_rate_limit_model_nudge"] {
		t.Fatalf("notice value not returned: %#v", snapshot.Values)
	}
	if !snapshot.Values["fast_default_opt_out"] {
		t.Fatalf("fast default opt-out value not returned: %#v", snapshot.Values)
	}
	if snapshot.Values["hide_gpt-5.1-codex-max_migration_prompt"] {
		t.Fatalf("quoted notice key should be parsed as false: %#v", snapshot.Values)
	}

	foundRateLimitDefinition := false
	foundFastDefaultDefinition := false
	for _, definition := range snapshot.Definitions {
		if definition.Section == "notice" && definition.Key == "hide_rate_limit_model_nudge" {
			foundRateLimitDefinition = true
		}
		if definition.Section == "notice" && definition.Key == "fast_default_opt_out" {
			foundFastDefaultDefinition = true
		}
	}
	if !foundRateLimitDefinition || !foundFastDefaultDefinition {
		t.Fatalf("notice definitions missing from snapshot: rateLimit=%v fastDefault=%v definitions=%#v", foundRateLimitDefinition, foundFastDefaultDefinition, snapshot.Definitions)
	}
}

func TestGetCodexFeatureConfigReturnsCompositeFeatureAndNoticeTables(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	existing := strings.Join([]string{
		`[features.multi_agent_v2]`,
		`enabled = true`,
		`usage_hint_enabled = false`,
		``,
		`[features.apps_mcp_path_override]`,
		`enabled = true`,
		`path = "/custom/apps-mcp"`,
		``,
		`[features.network_proxy]`,
		`enabled = true`,
		`proxy_url = "http://127.0.0.1:43128"`,
		``,
		`[notice.model_migrations]`,
		`"gpt-5.2" = "gpt-5.4"`,
		``,
		`[notice.external_config_migration_prompts]`,
		`home = true`,
		`home_last_prompted_at = 1760000000`,
	}, "\n") + "\n"
	if err := os.WriteFile(configPath, []byte(existing), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	snapshot, err := app.GetCodexFeatureConfig()
	if err != nil {
		t.Fatalf("GetCodexFeatureConfig returned error: %v", err)
	}
	for _, key := range []string{
		"apps_mcp_path_override",
		"network_proxy",
	} {
		var row *CodexFeatureDefinition
		for index := range snapshot.Definitions {
			if snapshot.Definitions[index].Key == key && snapshot.Definitions[index].Section == "features" {
				row = &snapshot.Definitions[index]
				break
			}
		}
		if row == nil {
			t.Fatalf("missing composite feature definition %q in %#v", key, snapshot.Definitions)
		}
		if row.ValueType != "toml" || row.ReadOnly || row.Unsupported {
			t.Fatalf("composite feature definition %q should be editable toml: %#v", key, row)
		}
		if raw := snapshot.RawValues[row.ID]; !strings.Contains(raw, "[features."+key+"]") {
			t.Fatalf("composite feature %q should include raw section body: %#v", key, raw)
		}
	}
	for _, item := range []struct {
		id    string
		value any
		raw   string
	}{
		{id: "features.multi_agent_v2.enabled", value: true, raw: "true"},
		{id: "features.multi_agent_v2.usage_hint_enabled", value: false, raw: "false"},
	} {
		if snapshot.TypedValues[item.id] != item.value {
			t.Fatalf("%s typed value = %#v, want %#v", item.id, snapshot.TypedValues[item.id], item.value)
		}
		if snapshot.RawValues[item.id] != item.raw {
			t.Fatalf("%s raw value = %#v, want %#v", item.id, snapshot.RawValues[item.id], item.raw)
		}
	}

	for _, key := range []string{"model_migrations", "external_config_migration_prompts"} {
		var row *CodexFeatureDefinition
		for index := range snapshot.Definitions {
			if snapshot.Definitions[index].Key == key && snapshot.Definitions[index].Section == "notice" {
				row = &snapshot.Definitions[index]
				break
			}
		}
		if row == nil {
			t.Fatalf("missing notice definition %q in %#v", key, snapshot.Definitions)
		}
		if row.ValueType != "toml" || row.ReadOnly || row.Unsupported {
			t.Fatalf("notice definition %q should be editable toml: %#v", key, row)
		}
		if raw := snapshot.RawValues[row.ID]; !strings.Contains(raw, "[notice."+key+"]") {
			t.Fatalf("notice definition %q should include raw section body: %#v", key, raw)
		}
	}
}

func TestGetCodexFeatureConfigReturnsRootValues(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	existing := strings.Join([]string{
		`hide_agent_reasoning = true`,
		`show_raw_agent_reasoning = true`,
		``,
		`[features]`,
		`goals = true`,
	}, "\n") + "\n"
	if err := os.WriteFile(configPath, []byte(existing), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	snapshot, err := app.GetCodexFeatureConfig()
	if err != nil {
		t.Fatalf("GetCodexFeatureConfig returned error: %v", err)
	}
	if !snapshot.Values["hide_agent_reasoning"] || !snapshot.Values["show_raw_agent_reasoning"] {
		t.Fatalf("root values not returned: %#v", snapshot.Values)
	}

	foundHideReasoning := false
	for _, definition := range snapshot.Definitions {
		if definition.Section == "root" && definition.Key == "hide_agent_reasoning" {
			foundHideReasoning = true
			if definition.DefaultEnabled {
				t.Fatalf("hide_agent_reasoning default should be false")
			}
		}
	}
	if !foundHideReasoning {
		t.Fatalf("root definition missing from snapshot: %#v", snapshot.Definitions)
	}
}

func TestGetCodexFeatureConfigMapsMultiAgentV2ScalarToEnabled(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	if err := os.WriteFile(configPath, []byte("[features]\nmulti_agent_v2 = true\n"), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	snapshot, err := app.GetCodexFeatureConfig()
	if err != nil {
		t.Fatalf("GetCodexFeatureConfig returned error: %v", err)
	}

	if snapshot.TypedValues["features.multi_agent_v2.enabled"] != true {
		t.Fatalf("scalar multi_agent_v2 should map to enabled typed value: %#v", snapshot.TypedValues)
	}
	if snapshot.RawValues["features.multi_agent_v2.enabled"] != "true" {
		t.Fatalf("scalar multi_agent_v2 raw should map to enabled raw value: %#v", snapshot.RawValues)
	}
}

func TestSaveCodexFeatureConfigAppendsRootKeyBeforeSections(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	existing := "[features]\ngoals = true\n"
	if err := os.WriteFile(configPath, []byte(existing), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	if _, err := app.SaveCodexFeatureConfig(SaveCodexFeatureConfigInput{
		Values: map[string]bool{"hide_agent_reasoning": true},
	}); err != nil {
		t.Fatalf("SaveCodexFeatureConfig returned error: %v", err)
	}

	body, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	content := string(body)
	if !strings.HasPrefix(content, "hide_agent_reasoning = true\n[features]\n") {
		t.Fatalf("root bool should be inserted before first section: %s", content)
	}
	if !strings.Contains(content, "goals = true\n") {
		t.Fatalf("features section should be preserved: %s", content)
	}
}

func TestSaveCodexFeatureConfigAppendsNoticeSectionWhenMissing(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	existing := "[features]\ngoals = true\n"
	if err := os.WriteFile(configPath, []byte(existing), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	if _, err := app.SaveCodexFeatureConfig(SaveCodexFeatureConfigInput{
		Values: map[string]bool{"hide_rate_limit_model_nudge": true},
	}); err != nil {
		t.Fatalf("SaveCodexFeatureConfig returned error: %v", err)
	}

	body, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	content := string(body)
	if !strings.Contains(content, existing) {
		t.Fatalf("features section should be preserved: %s", content)
	}
	if !strings.Contains(content, "\n[notice]\nhide_rate_limit_model_nudge = true\n") {
		t.Fatalf("notice section not appended as expected: %s", content)
	}
}

func TestSaveCodexFeatureConfigWritesQuotedNoticeKey(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	if err := os.WriteFile(configPath, []byte("[notice]\nexisting = \"value\"\n"), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	if _, err := app.SaveCodexFeatureConfig(SaveCodexFeatureConfigInput{
		Values: map[string]bool{"hide_gpt-5.1-codex-max_migration_prompt": true},
	}); err != nil {
		t.Fatalf("SaveCodexFeatureConfig returned error: %v", err)
	}

	body, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	content := string(body)
	if !strings.Contains(content, `"hide_gpt-5.1-codex-max_migration_prompt" = true`) {
		t.Fatalf("quoted notice key should be written with TOML quotes: %s", content)
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

func TestGetCodexFeatureConfigReturnsAllModelProviderSchemaFields(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	existing := strings.Join([]string{
		`model_provider = "gettokens"`,
		``,
		`[model_providers.gettokens]`,
		`name = "GetTokens"`,
		`base_url = "https://api.example.test/v1"`,
		`wire_api = "responses"`,
		`requires_openai_auth = false`,
		`env_key = "OPENAI_API_KEY"`,
		`env_key_instructions = "Set OPENAI_API_KEY before launch."`,
		`experimental_bearer_token = "token"`,
		`request_max_retries = 4`,
		`stream_idle_timeout_ms = 300000`,
		`stream_max_retries = 6`,
		`supports_websockets = true`,
		`websocket_connect_timeout_ms = 15000`,
		`query_params = { api-version = "2025-01-01" }`,
		``,
		`[model_providers.gettokens.auth]`,
		`command = "get-token"`,
		``,
		`[model_providers.gettokens.http_headers]`,
		`X-Test = "yes"`,
		``,
		`[model_providers.gettokens.env_http_headers]`,
		`X-Env-Test = "HEADER_ENV"`,
		``,
		`[model_providers.gettokens.aws]`,
		`region = "us-east-1"`,
	}, "\n") + "\n"
	if err := os.WriteFile(configPath, []byte(existing), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	snapshot, err := app.GetCodexFeatureConfig()
	if err != nil {
		t.Fatalf("GetCodexFeatureConfig returned error: %v", err)
	}

	requiredProviderFields := []string{
		"auth",
		"aws",
		"base_url",
		"env_http_headers",
		"env_key",
		"env_key_instructions",
		"experimental_bearer_token",
		"http_headers",
		"name",
		"query_params",
		"request_max_retries",
		"requires_openai_auth",
		"stream_idle_timeout_ms",
		"stream_max_retries",
		"supports_websockets",
		"websocket_connect_timeout_ms",
		"wire_api",
	}
	for _, key := range requiredProviderFields {
		id := "model_providers.gettokens." + key
		var row *CodexFeatureDefinition
		for index := range snapshot.Definitions {
			if snapshot.Definitions[index].ID == id {
				row = &snapshot.Definitions[index]
				break
			}
		}
		if row == nil {
			t.Fatalf("missing model provider definition %q", id)
		}
		if key == "wire_api" {
			assertStringSliceEqual(t, "model provider wire_api options", row.Options, []string{"responses"})
		}
	}

	if got := snapshot.TypedValues["model_providers.gettokens.request_max_retries"]; got != int64(4) {
		t.Fatalf("request_max_retries typed value = %#v", got)
	}
	if got := snapshot.TypedValues["model_providers.gettokens.supports_websockets"]; got != true {
		t.Fatalf("supports_websockets typed value = %#v", got)
	}
	if raw := snapshot.RawValues["model_providers.gettokens.auth"]; !strings.Contains(raw, "[model_providers.gettokens.auth]") || !strings.Contains(raw, `command = "get-token"`) {
		t.Fatalf("auth raw section missing: %#v", raw)
	}
	if raw := snapshot.RawValues["model_providers.gettokens.http_headers"]; !strings.Contains(raw, "[model_providers.gettokens.http_headers]") || !strings.Contains(raw, `X-Test = "yes"`) {
		t.Fatalf("http_headers raw section missing: %#v", raw)
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

func TestGetCodexFeatureConfigReturnsTypedRootDefinitionsAndValues(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	existing := strings.Join([]string{
		`model = "gpt-5.4"`,
		`model_provider = "gettokens"`,
		`model_reasoning_effort = "high"`,
		`model_context_window = 200000`,
		`notify = ["terminal-notifier", "-message"]`,
		`hide_agent_reasoning = true`,
	}, "\n") + "\n"
	if err := os.WriteFile(configPath, []byte(existing), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	snapshot, err := app.GetCodexFeatureConfig()
	if err != nil {
		t.Fatalf("GetCodexFeatureConfig returned error: %v", err)
	}

	values := snapshot.TypedValues
	if values["root.model"] != "gpt-5.4" {
		t.Fatalf("root.model typed value = %#v", values["root.model"])
	}
	if values["root.model_context_window"] != int64(200000) {
		t.Fatalf("root.model_context_window typed value = %#v", values["root.model_context_window"])
	}
	if got, ok := values["root.notify"].([]string); !ok || len(got) != 2 || got[0] != "terminal-notifier" {
		t.Fatalf("root.notify typed value = %#v", values["root.notify"])
	}

	seen := map[string]CodexFeatureDefinition{}
	for _, definition := range snapshot.Definitions {
		seen[definition.ID] = definition
	}
	if seen["root.model"].ValueType != "string" {
		t.Fatalf("root.model definition missing or wrong: %#v", seen["root.model"])
	}
	if seen["root.model_reasoning_effort"].ValueType != "enum" || len(seen["root.model_reasoning_effort"].Options) == 0 {
		t.Fatalf("root.model_reasoning_effort should be enum with options: %#v", seen["root.model_reasoning_effort"])
	}
	assertStringSliceEqual(t, "root.approvals_reviewer options", seen["root.approvals_reviewer"].Options, []string{"user", "auto_review", "guardian_subagent"})
	assertStringSliceEqual(t, "root.cli_auth_credentials_store options", seen["root.cli_auth_credentials_store"].Options, []string{"file", "keyring", "auto", "ephemeral"})
	assertStringSliceEqual(t, "root.mcp_oauth_credentials_store options", seen["root.mcp_oauth_credentials_store"].Options, []string{"auto", "file", "keyring"})
	assertStringSliceEqual(t, "root.model_auto_compact_token_limit_scope options", seen["root.model_auto_compact_token_limit_scope"].Options, []string{"total", "body_after_prefix"})
	assertStringSliceEqual(t, "root.personality options", seen["root.personality"].Options, []string{"none", "friendly", "pragmatic"})
	if seen["root.experimental_thread_store"].ValueType != "toml" {
		t.Fatalf("root.experimental_thread_store should be toml per Codex schema: %#v", seen["root.experimental_thread_store"])
	}
	if seen["root.notify"].ValueType != "string_array" {
		t.Fatalf("root.notify should be string_array: %#v", seen["root.notify"])
	}
}

func TestSaveCodexFeatureConfigWritesTypedRootChanges(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	existing := strings.Join([]string{
		`model = "gpt-5.2" # current model`,
		`model_context_window = 128000`,
		``,
		`[features]`,
		`goals = false`,
	}, "\n") + "\n"
	if err := os.WriteFile(configPath, []byte(existing), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	preview, err := app.SaveCodexFeatureConfig(SaveCodexFeatureConfigInput{
		Changes: []CodexConfigChangeInput{
			{ID: "root.model", Path: []string{"model"}, ValueType: "string", Value: "gpt-5.4"},
			{ID: "root.model_reasoning_effort", Path: []string{"model_reasoning_effort"}, ValueType: "enum", Value: "high"},
			{ID: "root.model_context_window", Path: []string{"model_context_window"}, ValueType: "integer", Value: float64(200000)},
			{ID: "root.notify", Path: []string{"notify"}, ValueType: "string_array", Value: []any{"terminal-notifier", "-message", "Codex"}},
		},
	})
	if err != nil {
		t.Fatalf("SaveCodexFeatureConfig returned error: %v", err)
	}
	if len(preview.Changes) != 4 {
		t.Fatalf("preview changes = %#v", preview.Changes)
	}

	body, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	content := string(body)
	if !strings.Contains(content, `model = "gpt-5.4" # current model`) {
		t.Fatalf("model string was not rewritten preserving comment: %s", content)
	}
	if !strings.Contains(content, `model_reasoning_effort = "high"`) {
		t.Fatalf("enum string was not inserted: %s", content)
	}
	if !strings.Contains(content, `model_context_window = 200000`) {
		t.Fatalf("integer was not rewritten: %s", content)
	}
	if !strings.Contains(content, `notify = ["terminal-notifier", "-message", "Codex"]`) {
		t.Fatalf("string array was not inserted: %s", content)
	}
	if !strings.Contains(content, "[features]\ngoals = false\n") {
		t.Fatalf("existing features section should be preserved: %s", content)
	}
}

func TestSaveCodexFeatureConfigRemovesTypedRootOverride(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	existing := strings.Join([]string{
		`model = "gpt-5.4"`,
		`model_auto_compact_token_limit = 180000`,
		`model_auto_compact_token_limit_scope = "total"`,
		``,
		`[features]`,
		`goals = false`,
	}, "\n") + "\n"
	if err := os.WriteFile(configPath, []byte(existing), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	preview, err := app.SaveCodexFeatureConfig(SaveCodexFeatureConfigInput{
		Changes: []CodexConfigChangeInput{
			{
				ID:        "root.model_auto_compact_token_limit",
				Path:      []string{"model_auto_compact_token_limit"},
				ValueType: "integer",
				Remove:    true,
			},
		},
	})
	if err != nil {
		t.Fatalf("SaveCodexFeatureConfig returned error: %v", err)
	}
	if len(preview.Changes) != 1 {
		t.Fatalf("preview changes = %#v", preview.Changes)
	}
	change := preview.Changes[0]
	if change.Type != "removed" || change.PreviousValue != int64(180000) || change.NextValue != nil {
		t.Fatalf("unexpected remove preview change: %#v", change)
	}

	body, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	content := string(body)
	if strings.Contains(content, `model_auto_compact_token_limit =`) {
		t.Fatalf("removed root key should be absent: %s", content)
	}
	for _, want := range []string{
		`model = "gpt-5.4"`,
		`model_auto_compact_token_limit_scope = "total"`,
		"[features]\ngoals = false",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("existing config fragment %q should remain: %s", want, content)
		}
	}
}

func TestSaveCodexFeatureConfigRemovesTypedNonNumericRootOverrides(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	existing := strings.Join([]string{
		`model = "gpt-5.4"`,
		`model_reasoning_effort = "medium"`,
		`notify = ["terminal-notifier", "-message", "Codex"]`,
		`profile = "work"`,
		``,
		`[experimental_thread_store]`,
		`enabled = true`,
		`backend = "sqlite"`,
		``,
		`[features]`,
		`goals = false`,
	}, "\n") + "\n"
	if err := os.WriteFile(configPath, []byte(existing), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	preview, err := app.SaveCodexFeatureConfig(SaveCodexFeatureConfigInput{
		Changes: []CodexConfigChangeInput{
			{ID: "root.model", Path: []string{"model"}, ValueType: "string", Remove: true},
			{ID: "root.model_reasoning_effort", Path: []string{"model_reasoning_effort"}, ValueType: "enum", Remove: true},
			{ID: "root.notify", Path: []string{"notify"}, ValueType: "string_array", Remove: true},
			{ID: "root.experimental_thread_store", Path: []string{"experimental_thread_store"}, ValueType: "toml", Remove: true},
		},
	})
	if err != nil {
		t.Fatalf("SaveCodexFeatureConfig returned error: %v", err)
	}
	if len(preview.Changes) != 4 {
		t.Fatalf("preview changes = %#v", preview.Changes)
	}
	for _, change := range preview.Changes {
		if change.Type != "removed" || change.NextValue != nil {
			t.Fatalf("unexpected remove preview change: %#v", change)
		}
	}

	body, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	content := string(body)
	for _, forbidden := range []string{
		`model = "gpt-5.4"`,
		`model_reasoning_effort = "medium"`,
		`notify = ["terminal-notifier", "-message", "Codex"]`,
		`[experimental_thread_store]`,
		`enabled = true`,
		`backend = "sqlite"`,
	} {
		if strings.Contains(content, forbidden) {
			t.Fatalf("removed root fragment %q should be absent: %s", forbidden, content)
		}
	}
	for _, want := range []string{
		`profile = "work"`,
		"[features]\ngoals = false",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("existing config fragment %q should remain: %s", want, content)
		}
	}
}

func TestSaveCodexFeatureConfigWritesNestedModelProviderChanges(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	if err := os.WriteFile(configPath, []byte("model_provider = \"gettokens\"\n"), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	if _, err := app.SaveCodexFeatureConfig(SaveCodexFeatureConfigInput{
		Changes: []CodexConfigChangeInput{
			{ID: "model_providers.gettokens.name", Path: []string{"model_providers", "gettokens", "name"}, ValueType: "string", Value: "GetTokens"},
			{ID: "model_providers.gettokens.base_url", Path: []string{"model_providers", "gettokens", "base_url"}, ValueType: "string", Value: "https://api.example.test/v1"},
			{ID: "model_providers.gettokens.wire_api", Path: []string{"model_providers", "gettokens", "wire_api"}, ValueType: "enum", Value: "responses"},
			{ID: "model_providers.gettokens.requires_openai_auth", Path: []string{"model_providers", "gettokens", "requires_openai_auth"}, ValueType: "boolean", Value: false},
		},
	}); err != nil {
		t.Fatalf("SaveCodexFeatureConfig returned error: %v", err)
	}

	body, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	content := string(body)
	if !strings.Contains(content, "\n[model_providers.gettokens]\n") {
		t.Fatalf("model provider section missing: %s", content)
	}
	for _, want := range []string{
		`name = "GetTokens"`,
		`base_url = "https://api.example.test/v1"`,
		`wire_api = "responses"`,
		`requires_openai_auth = false`,
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("nested provider value %q missing: %s", want, content)
		}
	}
}

func TestSaveCodexFeatureConfigWritesExpandableRootTableLeaves(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	initial := strings.Join([]string{
		`[plugins."browser@openai-bundled"]`,
		`enabled = true`,
		``,
		`[marketplaces.openai-bundled]`,
		`source_type = "local"`,
		`source = "/Users/linhey/.codex/.tmp/bundled-marketplaces/openai-bundled"`,
	}, "\n") + "\n"
	if err := os.WriteFile(configPath, []byte(initial), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	preview, err := app.SaveCodexFeatureConfig(SaveCodexFeatureConfigInput{
		Changes: []CodexConfigChangeInput{
			{
				ID:        "plugins.browser@openai-bundled.enabled",
				Path:      []string{"plugins", "browser@openai-bundled", "enabled"},
				ValueType: "boolean",
				Value:     false,
			},
			{
				ID:        "marketplaces.openai-bundled.last_updated",
				Path:      []string{"marketplaces", "openai-bundled", "last_updated"},
				ValueType: "string",
				Value:     "2026-05-27T07:30:43Z",
			},
		},
	})
	if err != nil {
		t.Fatalf("SaveCodexFeatureConfig returned error: %v", err)
	}
	if len(preview.Changes) != 2 {
		t.Fatalf("preview changes = %#v", preview.Changes)
	}
	if preview.Changes[0].PreviousEnabled == nil || *preview.Changes[0].PreviousEnabled != true || preview.Changes[0].NextEnabled != false {
		t.Fatalf("plugin enabled change did not preserve boolean previous/next values: %#v", preview.Changes[0])
	}

	body, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	content := string(body)
	for _, want := range []string{
		"[plugins.\"browser@openai-bundled\"]\nenabled = false",
		"[marketplaces.openai-bundled]\nsource_type = \"local\"\nsource = \"/Users/linhey/.codex/.tmp/bundled-marketplaces/openai-bundled\"\nlast_updated = \"2026-05-27T07:30:43Z\"",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("root table leaf output missing %q: %s", want, content)
		}
	}
}

func TestSaveCodexFeatureConfigWritesRawTomlSections(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	initial := strings.Join([]string{
		`model = "gpt-5.4"`,
		``,
		`[features]`,
		`goals = true`,
		``,
		`[features.network_proxy]`,
		`enabled = false`,
		`mode = "old"`,
		``,
		`[mcp_servers.old]`,
		`command = "old-server"`,
		``,
		`[model_providers.gettokens.auth]`,
		`command = "old-auth"`,
		``,
		`[model_providers.gettokens]`,
		`name = "GetTokens"`,
		``,
	}, "\n")
	if err := os.WriteFile(configPath, []byte(initial), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	_, err := app.SaveCodexFeatureConfig(SaveCodexFeatureConfigInput{
		Changes: []CodexConfigChangeInput{
			{
				ID:        "features.network_proxy",
				Path:      []string{"features", "network_proxy"},
				ValueType: "toml",
				Value: strings.Join([]string{
					`[features.network_proxy]`,
					`enabled = true`,
					`mode = "review"`,
				}, "\n"),
			},
			{
				ID:        "root.mcp_servers",
				Path:      []string{"mcp_servers"},
				ValueType: "toml",
				Value: strings.Join([]string{
					`[mcp_servers.new]`,
					`command = "new-server"`,
					``,
					`[mcp_servers.new.env]`,
					`TOKEN = "redacted"`,
				}, "\n"),
			},
			{
				ID:        "model_providers.gettokens.auth",
				Path:      []string{"model_providers", "gettokens", "auth"},
				ValueType: "toml",
				Value: strings.Join([]string{
					`[model_providers.gettokens.auth]`,
					`command = "new-auth"`,
				}, "\n"),
			},
		},
	})
	if err != nil {
		t.Fatalf("SaveCodexFeatureConfig returned error: %v", err)
	}

	body, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	content := string(body)
	for _, want := range []string{
		`model = "gpt-5.4"`,
		"[features]\ngoals = true",
		"[features.network_proxy]\nenabled = true\nmode = \"review\"",
		"[mcp_servers.new]\ncommand = \"new-server\"",
		"[mcp_servers.new.env]\nTOKEN = \"redacted\"",
		"[model_providers.gettokens.auth]\ncommand = \"new-auth\"",
		"[model_providers.gettokens]\nname = \"GetTokens\"",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("raw TOML output missing %q: %s", want, content)
		}
	}
	for _, forbidden := range []string{
		`mode = "old"`,
		`command = "old-server"`,
		`command = "old-auth"`,
	} {
		if strings.Contains(content, forbidden) {
			t.Fatalf("raw TOML output should not contain %q: %s", forbidden, content)
		}
	}
}

func TestSaveCodexFeatureConfigWritesMultiAgentV2Fields(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	initial := strings.Join([]string{
		`[features]`,
		`multi_agent_v2 = false`,
		`goals = true`,
	}, "\n") + "\n"
	if err := os.WriteFile(configPath, []byte(initial), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	preview, err := app.SaveCodexFeatureConfig(SaveCodexFeatureConfigInput{
		Changes: []CodexConfigChangeInput{
			{
				ID:        "features.multi_agent_v2.enabled",
				Path:      []string{"features", "multi_agent_v2", "enabled"},
				ValueType: "boolean",
				Value:     true,
			},
			{
				ID:        "features.multi_agent_v2.max_concurrent_threads_per_session",
				Path:      []string{"features", "multi_agent_v2", "max_concurrent_threads_per_session"},
				ValueType: "integer",
				Value:     float64(5),
			},
			{
				ID:        "features.multi_agent_v2.usage_hint_text",
				Path:      []string{"features", "multi_agent_v2", "usage_hint_text"},
				ValueType: "string",
				Value:     "Use subagents for bounded parallel work.",
			},
		},
	})
	if err != nil {
		t.Fatalf("SaveCodexFeatureConfig returned error: %v", err)
	}
	if len(preview.Changes) != 3 {
		t.Fatalf("preview changes = %#v", preview.Changes)
	}

	body, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	content := string(body)
	for _, want := range []string{
		"[features]\ngoals = true",
		"[features.multi_agent_v2]\nenabled = true\nmax_concurrent_threads_per_session = 5\nusage_hint_text = \"Use subagents for bounded parallel work.\"",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("multi_agent_v2 field output missing %q: %s", want, content)
		}
	}
	if strings.Contains(content, "multi_agent_v2 = false") {
		t.Fatalf("scalar multi_agent_v2 should be removed when writing nested fields: %s", content)
	}
}

func TestSaveCodexFeatureConfigRejectsRawTomlOutsidePath(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	if err := os.WriteFile(configPath, []byte("[features]\ngoals = true\n"), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	_, err := app.SaveCodexFeatureConfig(SaveCodexFeatureConfigInput{
		Changes: []CodexConfigChangeInput{
			{
				ID:        "features.network_proxy",
				Path:      []string{"features", "network_proxy"},
				ValueType: "toml",
				Value:     "[notice]\nhide_rate_limit_model_nudge = true\n",
			},
		},
	})
	if err == nil {
		t.Fatal("SaveCodexFeatureConfig should reject raw TOML outside the target path")
	}
	if !strings.Contains(err.Error(), "不属于 features.network_proxy") {
		t.Fatalf("unexpected error: %v", err)
	}
}
