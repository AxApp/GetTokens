package wailsapp

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestBuildGetTokensCodexModelCatalogProjectsAliasesAndReasoning(t *testing.T) {
	body, err := buildGetTokensCodexModelCatalog([]OpenAICompatibleModel{
		{
			Name:                      "deepseek-chat",
			Alias:                     "deepseek",
			SupportedReasoningEfforts: []string{"low", "high"},
			DefaultReasoningEffort:    "high",
		},
		{
			Name:                      "gpt-5.4",
			SupportedReasoningEfforts: []string{"minimal", "medium"},
			DefaultReasoningEffort:    "medium",
		},
		{
			Name:  "deepseek-chat",
			Alias: "deepseek",
		},
	})
	if err != nil {
		t.Fatalf("buildGetTokensCodexModelCatalog returned error: %v", err)
	}

	var payload struct {
		Models []map[string]any `json:"models"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatalf("catalog is not valid JSON: %v\n%s", err, string(body))
	}
	if len(payload.Models) != 2 {
		t.Fatalf("models length = %d, want 2: %s", len(payload.Models), string(body))
	}

	first := payload.Models[0]
	if first["slug"] != "deepseek" {
		t.Fatalf("first slug = %v, want deepseek: %#v", first["slug"], first)
	}
	if first["display_name"] != "deepseek" {
		t.Fatalf("display_name = %v, want deepseek", first["display_name"])
	}
	if first["visibility"] != "list" || first["supported_in_api"] != true {
		t.Fatalf("catalog entry should be visible and API-supported: %#v", first)
	}
	if first["default_reasoning_level"] != "high" {
		t.Fatalf("default_reasoning_level = %v, want high", first["default_reasoning_level"])
	}
	levels, ok := first["supported_reasoning_levels"].([]any)
	if !ok || len(levels) != 2 {
		t.Fatalf("supported_reasoning_levels = %#v, want two entries", first["supported_reasoning_levels"])
	}
}

func TestBuildGetTokensCodexModelCatalogUsesModelIDForDisplayAliases(t *testing.T) {
	body, err := buildGetTokensCodexModelCatalog([]OpenAICompatibleModel{
		{
			Name:  "gpt-5.5",
			Alias: "GPT 5.5",
		},
		{
			Name:  "gpt-5.4-mini",
			Alias: "GPT 5.4 Mini",
		},
		{
			Name:  "deepseek-chat",
			Alias: "deepseek",
		},
	})
	if err != nil {
		t.Fatalf("buildGetTokensCodexModelCatalog returned error: %v", err)
	}

	var payload struct {
		Models []map[string]any `json:"models"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatalf("catalog is not valid JSON: %v\n%s", err, string(body))
	}
	if len(payload.Models) != 3 {
		t.Fatalf("models length = %d, want 3: %s", len(payload.Models), string(body))
	}

	got := make(map[string]string, len(payload.Models))
	for _, model := range payload.Models {
		slug, _ := model["slug"].(string)
		displayName, _ := model["display_name"].(string)
		got[slug] = displayName
	}
	if got["gpt-5.5"] != "GPT 5.5" {
		t.Fatalf("gpt-5.5 should use model id as slug and display alias as display name: %#v", got)
	}
	if got["gpt-5.4-mini"] != "GPT 5.4 Mini" {
		t.Fatalf("gpt-5.4-mini should use model id as slug and display alias as display name: %#v", got)
	}
	if got["deepseek"] != "deepseek" {
		t.Fatalf("route alias should remain usable as catalog slug: %#v", got)
	}
	if _, ok := got["GPT 5.5"]; ok {
		t.Fatalf("display alias must not become request slug: %#v", got)
	}
}

func TestApplyRelayServiceConfigToLocalV2WritesGetTokensModelCatalogPointer(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())

	result, err := applyRelayServiceConfigToLocalV2(RelayLocalApplyInput{
		APIKey:                     "sk-relay-test",
		BaseURL:                    "http://127.0.0.1:8317/v1",
		Model:                      "deepseek",
		ReasoningEffort:            "high",
		ProviderID:                 "gettokens",
		ProviderName:               "GetTokens",
		AuthStrategy:               relayLocalAuthStrategyReplaceAuthWithAPIKey,
		ModelCatalogProjectionMode: relayModelCatalogProjectionGetTokens,
		ModelCatalogModels: []OpenAICompatibleModel{
			{Name: "deepseek-chat", Alias: "deepseek"},
			{Name: "gpt-5.4"},
		},
	})
	if err != nil {
		t.Fatalf("applyRelayServiceConfigToLocalV2 returned error: %v", err)
	}

	wantCatalogPath := filepath.Join(codexHome, gettokensCodexModelCatalogFilename)
	if result.ModelCatalogPath != wantCatalogPath {
		t.Fatalf("ModelCatalogPath = %q, want %q", result.ModelCatalogPath, wantCatalogPath)
	}
	if !result.ModelCatalogRequiresRestart {
		t.Fatalf("ModelCatalogRequiresRestart should be true")
	}

	configBody, err := os.ReadFile(result.ConfigPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	if !strings.Contains(string(configBody), `model_catalog_json = "`+wantCatalogPath+`"`) {
		t.Fatalf("config.toml missing GetTokens catalog pointer:\n%s", string(configBody))
	}

	catalogBody, err := os.ReadFile(wantCatalogPath)
	if err != nil {
		t.Fatalf("ReadFile catalog: %v", err)
	}
	if !strings.Contains(string(catalogBody), `"slug": "deepseek"`) {
		t.Fatalf("catalog should contain deepseek alias:\n%s", string(catalogBody))
	}
}

func TestEnableGetTokensCodexModelCatalogProjectionWritesPointerWithoutRelayApply(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.WriteFile(configPath, []byte(`model = "deepseek"`+"\n"), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	result, err := enableGetTokensCodexModelCatalogProjection([]OpenAICompatibleModel{
		{Name: "deepseek-chat", Alias: "deepseek"},
	}, false)
	if err != nil {
		t.Fatalf("enableGetTokensCodexModelCatalogProjection returned error: %v", err)
	}

	wantCatalogPath := filepath.Join(codexHome, gettokensCodexModelCatalogFilename)
	if result.ModelCatalogPath != wantCatalogPath {
		t.Fatalf("ModelCatalogPath = %q, want %q", result.ModelCatalogPath, wantCatalogPath)
	}
	if !result.ModelCatalogRequiresRestart {
		t.Fatalf("ModelCatalogRequiresRestart should be true")
	}

	configBody, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	if !strings.Contains(string(configBody), `model_catalog_json = "`+wantCatalogPath+`"`) {
		t.Fatalf("config.toml missing GetTokens catalog pointer:\n%s", string(configBody))
	}
	if !strings.Contains(string(configBody), `model = "deepseek"`) {
		t.Fatalf("enable should preserve unrelated local Codex config:\n%s", string(configBody))
	}
}

func TestApplyRelayServiceConfigToLocalV2DoesNotOverwriteExternalModelCatalogPointer(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	configPath := filepath.Join(codexHome, "config.toml")
	existingCatalog := filepath.Join(t.TempDir(), "user-catalog.json")
	if err := os.WriteFile(configPath, []byte(`model_catalog_json = "`+existingCatalog+`"`+"\n"), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	result, err := applyRelayServiceConfigToLocalV2(RelayLocalApplyInput{
		APIKey:                     "sk-relay-test",
		BaseURL:                    "http://127.0.0.1:8317/v1",
		Model:                      "deepseek",
		ProviderID:                 "gettokens",
		ProviderName:               "GetTokens",
		AuthStrategy:               relayLocalAuthStrategyReplaceAuthWithAPIKey,
		ModelCatalogProjectionMode: relayModelCatalogProjectionGetTokens,
		ModelCatalogModels:         []OpenAICompatibleModel{{Name: "deepseek-chat", Alias: "deepseek"}},
	})
	if err != nil {
		t.Fatalf("applyRelayServiceConfigToLocalV2 returned error: %v", err)
	}

	if result.ModelCatalogPath != "" {
		t.Fatalf("ModelCatalogPath = %q, want empty when external pointer is active", result.ModelCatalogPath)
	}
	if result.ExistingExternalModelCatalogPath != existingCatalog {
		t.Fatalf("ExistingExternalModelCatalogPath = %q, want %q", result.ExistingExternalModelCatalogPath, existingCatalog)
	}
	configBody, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	if !strings.Contains(string(configBody), `model_catalog_json = "`+existingCatalog+`"`) {
		t.Fatalf("external model_catalog_json pointer should be preserved:\n%s", string(configBody))
	}
}

func TestDisableGetTokensCodexModelCatalogProjectionRemovesOnlyOwnedPointer(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	configPath := filepath.Join(codexHome, "config.toml")
	ownedCatalogPath := filepath.Join(codexHome, gettokensCodexModelCatalogFilename)
	if err := os.WriteFile(configPath, []byte(strings.Join([]string{
		`model = "deepseek"`,
		`model_catalog_json = "` + ownedCatalogPath + `"`,
		``,
		`[model_providers.gettokens]`,
		`name = "GetTokens"`,
	}, "\n")+"\n"), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	result, err := disableGetTokensCodexModelCatalogProjection()
	if err != nil {
		t.Fatalf("disableGetTokensCodexModelCatalogProjection returned error: %v", err)
	}
	if result.ModelCatalogPath != ownedCatalogPath {
		t.Fatalf("ModelCatalogPath = %q, want %q", result.ModelCatalogPath, ownedCatalogPath)
	}
	if !result.ModelCatalogRequiresRestart {
		t.Fatalf("ModelCatalogRequiresRestart should be true")
	}

	configBody, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	if strings.Contains(string(configBody), "model_catalog_json") {
		t.Fatalf("owned pointer should be removed:\n%s", string(configBody))
	}
	if !strings.Contains(string(configBody), `[model_providers.gettokens]`) {
		t.Fatalf("unrelated config should be preserved:\n%s", string(configBody))
	}
}
