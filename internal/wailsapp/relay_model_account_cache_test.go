package wailsapp

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

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

func TestRefreshCodexModelCatalogAfterAccountMutationUpdatesCacheAndCatalog(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	if _, err := saveAppRuntimeSettings(AppRuntimeSettings{CodexModelCatalogSyncEnabled: true}); err != nil {
		t.Fatalf("save settings: %v", err)
	}

	account := testOpenAICompatibleAccount(
		"acct_deepseek",
		"DeepSeek",
		0,
		false,
		"https://api.deepseek.com/v1",
		"",
		nil,
		nil,
		[]cliproxyapi.OpenAICompatibleModel{{Name: "deepseek-v4-pro"}},
	)
	app := &App{ctx: context.Background()}
	app.managementAPI = func() *cliproxyapi.Client {
		return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			if method == http.MethodGet && path == "/v0/management/accounts" {
				return testAccountsResponse(t, account), 200, nil
			}
			t.Fatalf("unexpected request: %s %s", method, path)
			return nil, 0, nil
		})
	}

	if err := app.refreshCodexModelCatalogAfterAccountMutation(); err != nil {
		t.Fatalf("refreshCodexModelCatalogAfterAccountMutation returned error: %v", err)
	}

	cached, err := loadRelayModelAccountCache()
	if err != nil {
		t.Fatalf("load cache: %v", err)
	}
	if len(cached) != 1 || cached[0].AccountKey != "acct_deepseek" || cached[0].Models[0].Name != "deepseek-v4-pro" {
		t.Fatalf("unexpected refreshed cache: %#v", cached)
	}
	catalogBody, err := os.ReadFile(filepath.Join(codexHome, gettokensCodexModelCatalogFilename))
	if err != nil {
		t.Fatalf("read model catalog: %v", err)
	}
	if !strings.Contains(string(catalogBody), "deepseek-v4-pro") {
		t.Fatalf("catalog does not contain refreshed model: %s", catalogBody)
	}
}

func TestRefreshCodexModelCatalogAfterAccountMutationClearsCatalogWhenNoActiveModels(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	if _, err := saveAppRuntimeSettings(AppRuntimeSettings{CodexModelCatalogSyncEnabled: true}); err != nil {
		t.Fatalf("save settings: %v", err)
	}
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("mkdir codex home: %v", err)
	}
	if _, err := enableGetTokensCodexModelCatalogProjection([]OpenAICompatibleModel{{Name: "deepseek-v4-flash"}}, false); err != nil {
		t.Fatalf("seed catalog: %v", err)
	}

	account := testOpenAICompatibleAccount(
		"acct_deepseek",
		"DeepSeek",
		0,
		true,
		"https://api.deepseek.com/v1",
		"",
		nil,
		nil,
		[]cliproxyapi.OpenAICompatibleModel{{Name: "deepseek-v4-flash"}},
	)
	app := &App{ctx: context.Background()}
	app.managementAPI = func() *cliproxyapi.Client {
		return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			if method == http.MethodGet && path == "/v0/management/accounts" {
				return testAccountsResponse(t, account), 200, nil
			}
			t.Fatalf("unexpected request: %s %s", method, path)
			return nil, 0, nil
		})
	}

	if err := app.refreshCodexModelCatalogAfterAccountMutation(); err != nil {
		t.Fatalf("refreshCodexModelCatalogAfterAccountMutation returned error: %v", err)
	}
	configBody, err := os.ReadFile(filepath.Join(codexHome, "config.toml"))
	if err != nil {
		t.Fatalf("read codex config: %v", err)
	}
	if strings.Contains(string(configBody), "model_catalog_json") {
		t.Fatalf("expected stale model_catalog_json pointer to be removed, got: %s", configBody)
	}
	cached, err := loadRelayModelAccountCache()
	if err != nil {
		t.Fatalf("load cache: %v", err)
	}
	if len(cached) != 0 {
		t.Fatalf("disabled account should clear cache, got %#v", cached)
	}
}

func TestPruneRelayModelAccountCacheEntriesRemovesDeletedAccountImmediately(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	if err := saveRelayModelAccountCache([]relayModelAccountSnapshot{
		{AccountKey: "acct_keep", Kind: "openai-compatible", Models: []OpenAICompatibleModel{{Name: "gpt-5.5"}}},
		{AccountKey: "acct_delete", Kind: "openai-compatible", Models: []OpenAICompatibleModel{{Name: "deepseek-v4-flash"}}},
	}); err != nil {
		t.Fatalf("save cache: %v", err)
	}

	if err := pruneRelayModelAccountCacheEntries("acct_delete"); err != nil {
		t.Fatalf("pruneRelayModelAccountCacheEntries returned error: %v", err)
	}
	cached, err := loadRelayModelAccountCache()
	if err != nil {
		t.Fatalf("load cache: %v", err)
	}
	if len(cached) != 1 || cached[0].AccountKey != "acct_keep" {
		t.Fatalf("unexpected pruned cache: %#v", cached)
	}
}

func TestScheduleCodexModelCatalogRefreshDebouncesAndRunsOnce(t *testing.T) {
	app := &App{ctx: context.Background()}
	app.codexModelCatalogRefreshDebounce = time.Millisecond
	calls := 0
	done := make(chan struct{}, 1)
	app.codexModelCatalogRefreshFunc = func() error {
		calls++
		done <- struct{}{}
		return nil
	}

	app.scheduleCodexModelCatalogRefreshAfterAccountMutation()
	app.scheduleCodexModelCatalogRefreshAfterAccountMutation()
	app.scheduleCodexModelCatalogRefreshAfterAccountMutation()

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for debounced refresh")
	}
	time.Sleep(20 * time.Millisecond)
	if calls != 1 {
		t.Fatalf("expected one debounced refresh, got %d", calls)
	}
}

func TestScheduleCodexModelCatalogRefreshRunsPendingAfterInFlight(t *testing.T) {
	app := &App{ctx: context.Background()}
	app.codexModelCatalogRefreshDebounce = time.Millisecond
	started := make(chan struct{}, 2)
	release := make(chan struct{})
	done := make(chan struct{}, 2)
	calls := 0
	app.codexModelCatalogRefreshFunc = func() error {
		calls++
		started <- struct{}{}
		if calls == 1 {
			<-release
		}
		done <- struct{}{}
		return nil
	}

	app.scheduleCodexModelCatalogRefreshAfterAccountMutation()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for first refresh")
	}
	app.scheduleCodexModelCatalogRefreshAfterAccountMutation()
	close(release)
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for first completion")
	}
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for pending refresh")
	}
	if calls != 2 {
		t.Fatalf("expected pending refresh to run once after in-flight refresh, got %d", calls)
	}
}

func TestApplyGetTokensCodexModelCatalogProjectionDoesNotRewriteUnchangedCatalog(t *testing.T) {
	codexHome := t.TempDir()
	models := []OpenAICompatibleModel{{Name: "deepseek-v4-flash"}}
	if _, _, _, _, err := applyGetTokensCodexModelCatalogProjection("", codexHome, models, false); err != nil {
		t.Fatalf("first apply: %v", err)
	}
	catalogPath := filepath.Join(codexHome, gettokensCodexModelCatalogFilename)
	before, err := os.Stat(catalogPath)
	if err != nil {
		t.Fatalf("stat catalog: %v", err)
	}
	time.Sleep(10 * time.Millisecond)
	if _, _, _, _, err := applyGetTokensCodexModelCatalogProjection("", codexHome, models, false); err != nil {
		t.Fatalf("second apply: %v", err)
	}
	after, err := os.Stat(catalogPath)
	if err != nil {
		t.Fatalf("stat catalog after: %v", err)
	}
	if !after.ModTime().Equal(before.ModTime()) {
		t.Fatalf("unchanged catalog should not be rewritten: before=%s after=%s", before.ModTime(), after.ModTime())
	}
}

func TestCodexModelCatalogDiagnosticsReportsCacheCatalogAndWarnings(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	if _, err := saveAppRuntimeSettings(AppRuntimeSettings{CodexModelCatalogSyncEnabled: true}); err != nil {
		t.Fatalf("save settings: %v", err)
	}
	if err := saveRelayModelAccountCache([]relayModelAccountSnapshot{{
		AccountKey:   "acct_deepseek",
		Kind:         "openai-compatible",
		ProviderName: "DeepSeek",
		Models:       []OpenAICompatibleModel{{Name: "deepseek-v4-flash"}},
	}}); err != nil {
		t.Fatalf("save cache: %v", err)
	}
	if _, err := enableGetTokensCodexModelCatalogProjection([]OpenAICompatibleModel{{Name: "deepseek-v4-flash"}}, false); err != nil {
		t.Fatalf("enable catalog projection: %v", err)
	}

	diagnostics, err := GetCodexModelCatalogDiagnostics()
	if err != nil {
		t.Fatalf("GetCodexModelCatalogDiagnostics returned error: %v", err)
	}
	if !diagnostics.SyncEnabled || !diagnostics.HasGetTokensCatalogPointer || diagnostics.CatalogModelCount != 1 {
		t.Fatalf("unexpected diagnostics summary: %#v", diagnostics)
	}
	if diagnostics.CachedAccountCount != 1 || diagnostics.CachedModelCount != 1 {
		t.Fatalf("unexpected cache counts: %#v", diagnostics)
	}
	if len(diagnostics.Models) != 1 || diagnostics.Models[0].Slug != "deepseek-v4-flash" || diagnostics.Models[0].SourceAccounts[0] != "acct_deepseek" {
		t.Fatalf("unexpected diagnostics models: %#v", diagnostics.Models)
	}
}

func TestCodexModelCatalogDiagnosticsWarnsForExternalCatalogPointer(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	codexHome := filepath.Join(home, ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("mkdir codex home: %v", err)
	}
	if err := os.WriteFile(filepath.Join(codexHome, "config.toml"), []byte("model_catalog_json = \"/tmp/external-catalog.json\"\n"), 0600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	diagnostics, err := GetCodexModelCatalogDiagnostics()
	if err != nil {
		t.Fatalf("GetCodexModelCatalogDiagnostics returned error: %v", err)
	}
	if diagnostics.HasGetTokensCatalogPointer {
		t.Fatalf("expected external pointer, got %#v", diagnostics)
	}
	joined := strings.Join(diagnostics.Warnings, "\n")
	if !strings.Contains(joined, "外部 model_catalog_json") {
		t.Fatalf("expected external pointer warning, got %#v", diagnostics.Warnings)
	}
}

func TestRelayModelCatalogTraceWrittenFromAccountSnapshots(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("CODEX_HOME", filepath.Join(home, ".codex"))
	account := testOpenAICompatibleAccount(
		"acct_deepseek",
		"DeepSeek",
		0,
		false,
		"https://api.deepseek.com/v1",
		"",
		nil,
		nil,
		[]cliproxyapi.OpenAICompatibleModel{{Name: "deepseek-v4-flash"}},
	)
	app := &App{}
	app.managementAPI = func() *cliproxyapi.Client {
		return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			if method == http.MethodGet && path == "/v0/management/accounts" {
				return testAccountsResponse(t, account), 200, nil
			}
			t.Fatalf("unexpected request: %s %s", method, path)
			return nil, 0, nil
		})
	}

	models, err := app.ListRelaySupportedModels()
	if err != nil {
		t.Fatalf("ListRelaySupportedModels returned error: %v", err)
	}
	if len(models) != 1 || models[0].Name != "deepseek-v4-flash" {
		t.Fatalf("unexpected models: %#v", models)
	}
	trace, err := loadRelayModelCatalogTrace()
	if err != nil {
		t.Fatalf("load trace: %v", err)
	}
	if len(trace.Accounts) != 1 || trace.Accounts[0].AccountKey != "acct_deepseek" {
		t.Fatalf("unexpected trace accounts: %#v", trace)
	}
	if len(trace.Models) != 1 || trace.Models[0].Slug != "deepseek-v4-flash" || trace.Models[0].SourceAccounts[0] != "acct_deepseek" {
		t.Fatalf("unexpected trace models: %#v", trace)
	}
}
