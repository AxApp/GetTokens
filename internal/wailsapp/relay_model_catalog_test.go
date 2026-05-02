package wailsapp

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/linhay/gettokens/internal/cliproxyapi"
)

func TestListRelaySupportedModelsAggregatesRemoteLocalAndCodexKeyModels(t *testing.T) {
	providers := []OpenAICompatibleProvider{
		{
			Name:    "deepseek",
			BaseURL: "https://api.deepseek.com/v1",
			APIKey:  "sk-deepseek",
			Models: []OpenAICompatibleModel{
				{Name: "deepseek-chat", Alias: "DeepSeek Chat"},
				{Name: "provider-local-only"},
			},
		},
		{
			Name:     "disabled",
			BaseURL:  "https://disabled.example.com/v1",
			APIKey:   "sk-disabled",
			Disabled: true,
			Models: []OpenAICompatibleModel{
				{Name: "should-not-appear"},
			},
		},
	}
	codexKeys := []cliproxyapi.CodexAPIKey{
		{
			APIKey: "sk-codex",
			Models: []cliproxyapi.CodexModel{
				{Name: "codex-local-only", Alias: "Codex Local"},
			},
		},
	}

	models := listRelaySupportedModels(providers, codexKeys, func(input FetchOpenAICompatibleProviderModelsInput) ([]OpenAICompatibleModel, error) {
		if input.BaseURL != "https://api.deepseek.com/v1" {
			t.Fatalf("unexpected remote fetch base url: %#v", input)
		}
		if input.APIKey != "sk-deepseek" {
			t.Fatalf("unexpected remote fetch api key: %#v", input)
		}
		return []OpenAICompatibleModel{
			{
				Name:                      "deepseek-chat",
				SupportedReasoningEfforts: []string{"minimal", "high"},
				DefaultReasoningEffort:    "high",
			},
			{Name: "remote-only"},
		}, nil
	}, nil, nil)

	if len(models) != 4 {
		t.Fatalf("unexpected model count: %#v", models)
	}
	if models[0].Name != "codex-local-only" || models[1].Name != "deepseek-chat" || models[2].Name != "provider-local-only" || models[3].Name != "remote-only" {
		t.Fatalf("unexpected aggregated models: %#v", models)
	}
	if models[1].Alias != "DeepSeek Chat" {
		t.Fatalf("expected local alias to be preserved after merge: %#v", models[1])
	}
	if models[1].DefaultReasoningEffort != "high" {
		t.Fatalf("expected remote default reasoning effort to be merged: %#v", models[1])
	}
	if len(models[1].SupportedReasoningEfforts) != 2 || models[1].SupportedReasoningEfforts[0] != "minimal" || models[1].SupportedReasoningEfforts[1] != "high" {
		t.Fatalf("unexpected merged reasoning efforts: %#v", models[1])
	}
}

func TestListRelaySupportedModelsFallsBackToLocalCodexModelsCacheWhenAggregatedEmpty(t *testing.T) {
	models := listRelaySupportedModels(nil, nil, nil, []OpenAICompatibleModel{
		{Name: "gpt-5.4", SupportedReasoningEfforts: []string{"low", "medium", "high", "xhigh"}, DefaultReasoningEffort: "medium"},
		{Name: "gpt-5.4-mini", SupportedReasoningEfforts: []string{"low", "medium", "high", "xhigh"}, DefaultReasoningEffort: "medium"},
	}, nil)

	if len(models) != 2 {
		t.Fatalf("unexpected fallback model count: %#v", models)
	}
	if models[0].Name != "gpt-5.4" || models[1].Name != "gpt-5.4-mini" {
		t.Fatalf("unexpected fallback models: %#v", models)
	}
}

func TestListRelaySupportedModelsSortsModelFamilyFromLargeToSmall(t *testing.T) {
	models := listRelaySupportedModels(nil, nil, nil, nil, []OpenAICompatibleModel{
		{Name: "gpt-5.2"},
		{Name: "gpt-4.1"},
		{Name: "gpt-5.4-mini"},
		{Name: "gpt-5.5"},
		{Name: "gpt-5.3-codex"},
		{Name: "gpt-5.4"},
	})

	want := []string{"gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex", "gpt-5.2", "gpt-4.1"}
	if len(models) != len(want) {
		t.Fatalf("unexpected model count: %#v", models)
	}
	for index, name := range want {
		if models[index].Name != name {
			t.Fatalf("model[%d] = %q, want %q; full list: %#v", index, models[index].Name, name, models)
		}
	}
}

func TestLoadLocalCodexModelsCacheReadsModelsCacheJSON(t *testing.T) {
	tempHome := t.TempDir()
	if err := os.MkdirAll(filepath.Join(tempHome, ".codex"), 0700); err != nil {
		t.Fatalf("mkdir codex home: %v", err)
	}
	if err := os.WriteFile(
		filepath.Join(tempHome, ".codex", "models_cache.json"),
		[]byte(`{
  "models": [
    {
      "slug": "gpt-5.4",
      "display_name": "gpt-5.4",
      "default_reasoning_level": "medium",
      "supported_reasoning_levels": [
        {"effort": "low"},
        {"effort": "medium"},
        {"effort": "high"},
        {"effort": "xhigh"}
      ]
    },
    {
      "slug": "gpt-5.4-mini",
      "display_name": "GPT 5.4 Mini",
      "default_reasoning_level": "high",
      "supported_reasoning_levels": [
        {"effort": "medium"},
        {"effort": "high"}
      ]
    }
  ]
}`),
		0600,
	); err != nil {
		t.Fatalf("write models_cache.json: %v", err)
	}

	previous := os.Getenv("CODEX_HOME")
	if err := os.Setenv("CODEX_HOME", filepath.Join(tempHome, ".codex")); err != nil {
		t.Fatalf("set CODEX_HOME: %v", err)
	}
	defer func() {
		if previous == "" {
			_ = os.Unsetenv("CODEX_HOME")
			return
		}
		_ = os.Setenv("CODEX_HOME", previous)
	}()

	models, err := loadLocalCodexModelsCache()
	if err != nil {
		t.Fatalf("loadLocalCodexModelsCache returned error: %v", err)
	}

	if len(models) != 2 {
		t.Fatalf("unexpected local codex model count: %#v", models)
	}
	if models[0].Name != "gpt-5.4" || models[0].DefaultReasoningEffort != "medium" {
		t.Fatalf("unexpected first local codex model: %#v", models[0])
	}
	if models[1].Name != "gpt-5.4-mini" || models[1].Alias != "GPT 5.4 Mini" || models[1].DefaultReasoningEffort != "high" {
		t.Fatalf("unexpected second local codex model: %#v", models[1])
	}
}

func TestParseSidecarModelDefinitions(t *testing.T) {
	body := `{
		"channel": "codex",
		"models": [
			{
				"id": "gpt-5.4",
				"display_name": "GPT 5.4",
				"thinking": {"levels": ["low", "medium", "high", "xhigh"]}
			},
			{
				"id": "gpt-5.4-mini",
				"display_name": "GPT 5.4 Mini",
				"thinking": {"levels": ["low", "medium", "high"]}
			},
			{
				"id": "skip-empty",
				"display_name": ""
			}
		]
	}`

	models, err := parseSidecarModelDefinitions(body)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(models) != 3 {
		t.Fatalf("expected 3 models, got %d: %#v", len(models), models)
	}

	gpt54 := models[0]
	if gpt54.Name != "gpt-5.4" {
		t.Fatalf("unexpected name: %#v", gpt54)
	}
	if gpt54.Alias != "GPT 5.4" {
		t.Fatalf("expected alias 'GPT 5.4', got %#v", gpt54.Alias)
	}
	if len(gpt54.SupportedReasoningEfforts) != 4 {
		t.Fatalf("expected 4 reasoning efforts, got %d: %#v", len(gpt54.SupportedReasoningEfforts), gpt54.SupportedReasoningEfforts)
	}
}

func TestParseSidecarModelDefinitionsEmpty(t *testing.T) {
	models, err := parseSidecarModelDefinitions("")
	if err != nil {
		t.Fatalf("unexpected error for empty body: %v", err)
	}
	if models != nil {
		t.Fatalf("expected nil for empty body, got %#v", models)
	}
}

func TestListRelaySupportedModelsMergesSidecarModels(t *testing.T) {
	sidecarModels := []OpenAICompatibleModel{
		{Name: "gpt-5.4", Alias: "GPT 5.4", SupportedReasoningEfforts: []string{"low", "medium", "high"}},
		{Name: "gpt-5.4-mini", Alias: "GPT 5.4 Mini"},
	}

	models := listRelaySupportedModels(nil, nil, nil, nil, sidecarModels)
	if len(models) != 2 {
		t.Fatalf("expected 2 sidecar models, got %d: %#v", len(models), models)
	}
	if models[0].Name != "gpt-5.4" || models[1].Name != "gpt-5.4-mini" {
		t.Fatalf("unexpected sidecar model names: %#v", models)
	}
}

func TestListRelaySupportedModelsProviderAliasOverridesSidecarAlias(t *testing.T) {
	providers := []OpenAICompatibleProvider{
		{
			Name:    "custom",
			BaseURL: "https://custom.example.com/v1",
			APIKey:  "sk-custom",
			Models: []OpenAICompatibleModel{
				{Name: "gpt-5.4", Alias: "Custom Alias"},
			},
		},
	}
	sidecarModels := []OpenAICompatibleModel{
		{Name: "gpt-5.4", Alias: "Sidecar Alias", SupportedReasoningEfforts: []string{"low", "medium", "high"}},
		{Name: "sidecar-only"},
	}

	models := listRelaySupportedModels(providers, nil, nil, nil, sidecarModels)
	if len(models) != 2 {
		t.Fatalf("expected 2 models, got %d: %#v", len(models), models)
	}

	var gpt54 *OpenAICompatibleModel
	for i := range models {
		if models[i].Name == "gpt-5.4" {
			gpt54 = &models[i]
		}
	}
	if gpt54 == nil {
		t.Fatalf("gpt-5.4 not found in models: %#v", models)
	}
	if gpt54.Alias != "Custom Alias" {
		t.Fatalf("expected provider alias 'Custom Alias' to win over sidecar alias, got %#v", gpt54.Alias)
	}
	if len(gpt54.SupportedReasoningEfforts) != 3 {
		t.Fatalf("expected sidecar reasoning efforts to be merged in: %#v", gpt54)
	}
}
