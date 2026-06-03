package wailsapp

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/linhay/gettokens/internal/cliproxyapi"
)

func TestRelayModelAccountCacheRoundTrip(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	snapshots := []relayModelAccountSnapshot{
		{
			AccountKey:   "acct_deepseek",
			Kind:         "openai-compatible",
			ProviderName: "DeepSeek",
			Models: []OpenAICompatibleModel{
				{Name: "deepseek-v4-flash", Alias: "deepseek-v4-flash", SupportedReasoningEfforts: []string{"low", "high"}, DefaultReasoningEffort: "high"},
				{Name: "deepseek-v4-pro"},
			},
		},
	}

	if err := saveRelayModelAccountCache(snapshots); err != nil {
		t.Fatalf("saveRelayModelAccountCache returned error: %v", err)
	}

	path, err := relayModelAccountCachePath()
	if err != nil {
		t.Fatalf("relayModelAccountCachePath returned error: %v", err)
	}
	if filepath.Dir(path) != filepath.Join(home, ".config", "gettokens-data", "codex-model-account-cache") {
		t.Fatalf("unexpected cache path: %s", path)
	}

	loaded, err := loadRelayModelAccountCache()
	if err != nil {
		t.Fatalf("loadRelayModelAccountCache returned error: %v", err)
	}
	if len(loaded) != 1 || loaded[0].AccountKey != "acct_deepseek" || len(loaded[0].Models) != 2 {
		t.Fatalf("unexpected loaded cache: %#v", loaded)
	}
	if loaded[0].Models[0].Name != "deepseek-v4-flash" || loaded[0].Models[0].DefaultReasoningEffort != "high" {
		t.Fatalf("unexpected normalized model: %#v", loaded[0].Models[0])
	}
}

func TestListRelaySupportedModelsUsesAccountCacheForActiveAccountWhenRemoteUnavailable(t *testing.T) {
	providers := []OpenAICompatibleProvider{
		{
			AccountKey: "acct_deepseek",
			Name:       "DeepSeek",
			BaseURL:    "https://api.deepseek.com/v1",
			APIKey:     "sk-deepseek",
		},
		{
			AccountKey: "acct_disabled",
			Name:       "Disabled DeepSeek",
			Disabled:   true,
			BaseURL:    "https://api.deepseek.com/v1",
			APIKey:     "sk-disabled",
		},
	}
	cached := map[string]relayModelAccountSnapshot{
		"acct_deepseek": {
			AccountKey: "acct_deepseek",
			Models: []OpenAICompatibleModel{
				{Name: "deepseek-v4-flash"},
			},
		},
		"acct_disabled": {
			AccountKey: "acct_disabled",
			Models: []OpenAICompatibleModel{
				{Name: "should-not-appear"},
			},
		},
		"acct_deleted": {
			AccountKey: "acct_deleted",
			Models: []OpenAICompatibleModel{
				{Name: "deleted-should-not-appear"},
			},
		},
	}

	models, snapshots := listRelaySupportedModelsWithAccountSnapshots(providers, nil, func(input FetchOpenAICompatibleProviderModelsInput) ([]OpenAICompatibleModel, error) {
		return nil, os.ErrNotExist
	}, nil, []OpenAICompatibleModel{{Name: "deepseek-sidecar-only"}}, cached)

	if len(models) != 1 || models[0].Name != "deepseek-v4-flash" {
		t.Fatalf("expected only active account cached model, got %#v", models)
	}
	if len(snapshots) != 1 || snapshots[0].AccountKey != "acct_deepseek" || len(snapshots[0].Models) != 1 {
		t.Fatalf("unexpected snapshots: %#v", snapshots)
	}
}

func TestListRelaySupportedModelsRefreshesAccountCacheWithLatestRemoteModels(t *testing.T) {
	providers := []OpenAICompatibleProvider{
		{
			AccountKey: "acct_deepseek",
			Name:       "DeepSeek",
			BaseURL:    "https://api.deepseek.com/v1",
			APIKey:     "sk-deepseek",
			Models: []OpenAICompatibleModel{
				{Name: "deepseek-v4-flash"},
			},
		},
	}

	models, snapshots := listRelaySupportedModelsWithAccountSnapshots(providers, nil, func(input FetchOpenAICompatibleProviderModelsInput) ([]OpenAICompatibleModel, error) {
		return []OpenAICompatibleModel{{Name: "deepseek-v4-pro"}}, nil
	}, nil, nil, nil)

	if len(models) != 2 || models[0].Name != "deepseek-v4-flash" || models[1].Name != "deepseek-v4-pro" {
		t.Fatalf("unexpected refreshed models: %#v", models)
	}
	if len(snapshots) != 1 || len(snapshots[0].Models) != 2 {
		t.Fatalf("expected latest per-account snapshot, got %#v", snapshots)
	}
}

func TestLoadRelaySupportedModelsFromAccountCacheIncludesLocalCodexCache(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("mkdir codex home: %v", err)
	}
	if err := os.WriteFile(filepath.Join(codexHome, "models_cache.json"), []byte(`{"models":[{"slug":"gpt-5.5","display_name":"GPT-5.5"}]}`), 0600); err != nil {
		t.Fatalf("write local codex cache: %v", err)
	}
	if err := saveRelayModelAccountCache([]relayModelAccountSnapshot{{
		AccountKey: "acct_deepseek",
		Kind:       "openai-compatible",
		Models:     []OpenAICompatibleModel{{Name: "deepseek-v4-flash"}},
	}}); err != nil {
		t.Fatalf("save cache: %v", err)
	}

	models, err := loadRelaySupportedModelsFromAccountCache()
	if err != nil {
		t.Fatalf("loadRelaySupportedModelsFromAccountCache returned error: %v", err)
	}
	if len(models) != 2 || models[0].Name != "deepseek-v4-flash" || models[1].Name != "gpt-5.5" {
		t.Fatalf("unexpected cached startup models: %#v", models)
	}
}

func TestCodexAPIKeyAccountCacheUsesLocalID(t *testing.T) {
	models, snapshots := listRelaySupportedModelsWithAccountSnapshots(nil, []cliproxyapi.CodexAPIKey{{
		LocalID: "acct_codex_key",
		Models:  []cliproxyapi.CodexModel{{Name: "mimo-v2-pro"}},
	}}, nil, nil, nil, nil)
	if len(models) != 1 || models[0].Name != "mimo-v2-pro" {
		t.Fatalf("unexpected codex key models: %#v", models)
	}
	if len(snapshots) != 1 || snapshots[0].AccountKey != "acct_codex_key" || snapshots[0].Kind != "codex-api-key" {
		t.Fatalf("unexpected codex key snapshot: %#v", snapshots)
	}
}

func TestApplyPersistedCodexModelCatalogCacheSnapshotWritesCatalogBeforeSidecarReady(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	if _, err := saveAppRuntimeSettings(AppRuntimeSettings{CodexModelCatalogSyncEnabled: true}); err != nil {
		t.Fatalf("save settings: %v", err)
	}
	if err := saveRelayModelAccountCache([]relayModelAccountSnapshot{{
		AccountKey: "acct_deepseek",
		Kind:       "openai-compatible",
		Models:     []OpenAICompatibleModel{{Name: "deepseek-v4-flash"}},
	}}); err != nil {
		t.Fatalf("save cache: %v", err)
	}

	if err := applyPersistedCodexModelCatalogCacheSnapshot(); err != nil {
		t.Fatalf("applyPersistedCodexModelCatalogCacheSnapshot returned error: %v", err)
	}

	catalogBody, err := os.ReadFile(filepath.Join(codexHome, gettokensCodexModelCatalogFilename))
	if err != nil {
		t.Fatalf("read model catalog: %v", err)
	}
	if !strings.Contains(string(catalogBody), "deepseek-v4-flash") {
		t.Fatalf("catalog does not contain cached DeepSeek model: %s", catalogBody)
	}
	configBody, err := os.ReadFile(filepath.Join(codexHome, "config.toml"))
	if err != nil {
		t.Fatalf("read codex config: %v", err)
	}
	if !strings.Contains(string(configBody), "model_catalog_json") {
		t.Fatalf("config does not contain model_catalog_json pointer: %s", configBody)
	}
}

func TestApplyPersistedCodexModelCatalogCacheSnapshotSkipsWhenDisabled(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("CODEX_HOME", filepath.Join(home, ".codex"))
	if _, err := saveAppRuntimeSettings(AppRuntimeSettings{CodexModelCatalogSyncEnabled: false}); err != nil {
		t.Fatalf("save settings: %v", err)
	}
	if err := saveRelayModelAccountCache([]relayModelAccountSnapshot{{
		AccountKey: "acct_deepseek",
		Kind:       "openai-compatible",
		Models:     []OpenAICompatibleModel{{Name: "deepseek-v4-flash"}},
	}}); err != nil {
		t.Fatalf("save cache: %v", err)
	}

	if err := applyPersistedCodexModelCatalogCacheSnapshot(); err != nil {
		t.Fatalf("apply disabled setting returned error: %v", err)
	}
	if _, err := os.Stat(filepath.Join(home, ".codex", gettokensCodexModelCatalogFilename)); !os.IsNotExist(err) {
		t.Fatalf("expected no catalog when sync disabled, stat err=%v", err)
	}
}
