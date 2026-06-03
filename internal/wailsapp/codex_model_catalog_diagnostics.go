package wailsapp

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

const relayModelCatalogTraceFileName = "catalog-trace-v1.json"

type CodexModelCatalogDiagnostics struct {
	SyncEnabled                bool                               `json:"syncEnabled"`
	CodexHomePath              string                             `json:"codexHomePath"`
	ConfigPath                 string                             `json:"configPath"`
	CatalogPath                string                             `json:"catalogPath"`
	ConfiguredCatalogPath      string                             `json:"configuredCatalogPath,omitempty"`
	HasModelCatalogPointer     bool                               `json:"hasModelCatalogPointer"`
	HasGetTokensCatalogPointer bool                               `json:"hasGetTokensCatalogPointer"`
	CatalogExists              bool                               `json:"catalogExists"`
	CatalogUpdatedAtUnixMs     int64                              `json:"catalogUpdatedAtUnixMs,omitempty"`
	CatalogModelCount          int                                `json:"catalogModelCount"`
	CachePath                  string                             `json:"cachePath"`
	CacheExists                bool                               `json:"cacheExists"`
	CacheUpdatedAtUnixMs       int64                              `json:"cacheUpdatedAtUnixMs,omitempty"`
	CachedAccountCount         int                                `json:"cachedAccountCount"`
	CachedModelCount           int                                `json:"cachedModelCount"`
	TracePath                  string                             `json:"tracePath"`
	TraceExists                bool                               `json:"traceExists"`
	TraceUpdatedAtUnixMs       int64                              `json:"traceUpdatedAtUnixMs,omitempty"`
	CurrentModel               string                             `json:"currentModel"`
	CurrentProviderID          string                             `json:"currentProviderID"`
	CurrentProviderName        string                             `json:"currentProviderName"`
	HasExplicitCurrentModel    bool                               `json:"hasExplicitCurrentModel"`
	HasExplicitCurrentProvider bool                               `json:"hasExplicitCurrentProvider"`
	Models                     []CodexModelCatalogDiagnosticModel `json:"models,omitempty"`
	Warnings                   []string                           `json:"warnings,omitempty"`
}

type CodexModelCatalogDiagnosticModel struct {
	Slug           string   `json:"slug"`
	DisplayName    string   `json:"displayName,omitempty"`
	SourceAccounts []string `json:"sourceAccounts,omitempty"`
	SourceKinds    []string `json:"sourceKinds,omitempty"`
	ProviderNames  []string `json:"providerNames,omitempty"`
}

func (a *App) GetCodexModelCatalogDiagnostics() (*CodexModelCatalogDiagnostics, error) {
	return GetCodexModelCatalogDiagnostics()
}

func GetCodexModelCatalogDiagnostics() (*CodexModelCatalogDiagnostics, error) {
	settings, err := loadAppRuntimeSettings()
	if err != nil {
		return nil, err
	}
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}
	configPath := filepath.Join(codexHome, "config.toml")
	catalogPath := getGetTokensCodexModelCatalogPath(codexHome)
	cachePath, err := relayModelAccountCachePath()
	if err != nil {
		return nil, err
	}
	tracePath, err := relayModelCatalogTracePath()
	if err != nil {
		return nil, err
	}

	configBody, err := readOptionalTextFile(configPath)
	if err != nil {
		return nil, err
	}
	configuredCatalogPath, hasPointer := parseLocalCodexRootStringKey(configBody, "model_catalog_json")
	configuredCatalogPath = strings.TrimSpace(configuredCatalogPath)
	hasGetTokensPointer := hasPointer && isGetTokensCodexModelCatalogPath(configuredCatalogPath, codexHome)

	cachePayload, err := loadRelayModelAccountCachePayload()
	if err != nil {
		return nil, err
	}
	cacheModelsBySlug := buildDiagnosticCacheModelIndex(cachePayload.Accounts)

	diagnostics := &CodexModelCatalogDiagnostics{
		SyncEnabled:                settings.CodexModelCatalogSyncEnabled,
		CodexHomePath:              codexHome,
		ConfigPath:                 configPath,
		CatalogPath:                catalogPath,
		ConfiguredCatalogPath:      configuredCatalogPath,
		HasModelCatalogPointer:     hasPointer,
		HasGetTokensCatalogPointer: hasGetTokensPointer,
		CachePath:                  cachePath,
		TracePath:                  tracePath,
		CachedAccountCount:         len(cachePayload.Accounts),
		CurrentModel:               relayCodexDefaultModel,
	}

	for _, account := range cachePayload.Accounts {
		diagnostics.CachedModelCount += len(account.Models)
	}
	if cachePayload.UpdatedAtUnixMs > 0 {
		diagnostics.CacheUpdatedAtUnixMs = cachePayload.UpdatedAtUnixMs
	}
	if stat, err := os.Stat(cachePath); err == nil {
		diagnostics.CacheExists = true
		if diagnostics.CacheUpdatedAtUnixMs == 0 {
			diagnostics.CacheUpdatedAtUnixMs = stat.ModTime().UnixMilli()
		}
	} else if !os.IsNotExist(err) {
		return nil, err
	}
	if stat, err := os.Stat(tracePath); err == nil {
		diagnostics.TraceExists = true
		diagnostics.TraceUpdatedAtUnixMs = stat.ModTime().UnixMilli()
	} else if !os.IsNotExist(err) {
		return nil, err
	}

	if providerState := parseLocalCodexModelProviderState(configBody); providerState.CurrentProviderID != "" || providerState.CurrentModel != "" {
		diagnostics.CurrentModel = providerState.CurrentModel
		diagnostics.CurrentProviderID = providerState.CurrentProviderID
		diagnostics.CurrentProviderName = providerState.CurrentProviderName
		diagnostics.HasExplicitCurrentModel = providerState.HasExplicitCurrentModel
		diagnostics.HasExplicitCurrentProvider = providerState.HasExplicitCurrentProvider
	}

	catalogModels, catalogUpdatedAt, catalogExists, err := loadCodexModelCatalogDiagnosticModels(catalogPath, cacheModelsBySlug)
	if err != nil {
		return nil, err
	}
	diagnostics.CatalogExists = catalogExists
	diagnostics.CatalogUpdatedAtUnixMs = catalogUpdatedAt
	diagnostics.CatalogModelCount = len(catalogModels)
	diagnostics.Models = catalogModels

	if !settings.CodexModelCatalogSyncEnabled {
		diagnostics.Warnings = append(diagnostics.Warnings, "Codex 模型目录同步未开启")
	}
	if hasPointer && !hasGetTokensPointer {
		diagnostics.Warnings = append(diagnostics.Warnings, "当前 Codex config 使用外部 model_catalog_json，GetTokens 不会覆盖该模型目录")
	}
	if settings.CodexModelCatalogSyncEnabled && !hasPointer {
		diagnostics.Warnings = append(diagnostics.Warnings, "Codex config 尚未写入 model_catalog_json 指针")
	}
	if hasGetTokensPointer && !diagnostics.CatalogExists {
		diagnostics.Warnings = append(diagnostics.Warnings, "GetTokens model catalog 文件不存在")
	}
	if diagnostics.CachedAccountCount == 0 {
		diagnostics.Warnings = append(diagnostics.Warnings, "账号模型缓存为空")
	}
	return diagnostics, nil
}

func loadCodexModelCatalogDiagnosticModels(path string, cacheIndex map[string]CodexModelCatalogDiagnosticModel) ([]CodexModelCatalogDiagnosticModel, int64, bool, error) {
	stat, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, 0, false, nil
		}
		return nil, 0, false, err
	}
	body, err := os.ReadFile(path)
	if err != nil {
		return nil, 0, false, err
	}
	var payload codexModelCatalogPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, 0, true, err
	}
	models := make([]CodexModelCatalogDiagnosticModel, 0, len(payload.Models))
	for _, item := range payload.Models {
		slug := strings.TrimSpace(item.Slug)
		if slug == "" {
			continue
		}
		model := CodexModelCatalogDiagnosticModel{Slug: slug, DisplayName: strings.TrimSpace(item.DisplayName)}
		if cached, ok := cacheIndex[slug]; ok {
			model.SourceAccounts = append([]string(nil), cached.SourceAccounts...)
			model.SourceKinds = append([]string(nil), cached.SourceKinds...)
			model.ProviderNames = append([]string(nil), cached.ProviderNames...)
		}
		models = append(models, model)
	}
	return models, stat.ModTime().UnixMilli(), true, nil
}

func buildDiagnosticCacheModelIndex(accounts []relayModelAccountSnapshot) map[string]CodexModelCatalogDiagnosticModel {
	indexed := make(map[string]CodexModelCatalogDiagnosticModel)
	for _, account := range accounts {
		for _, model := range account.Models {
			slug := resolveCodexModelCatalogSlug(model)
			if slug == "" {
				continue
			}
			current := indexed[slug]
			current.Slug = slug
			current.SourceAccounts = appendUniqueDiagnosticString(current.SourceAccounts, account.AccountKey)
			current.SourceKinds = appendUniqueDiagnosticString(current.SourceKinds, account.Kind)
			current.ProviderNames = appendUniqueDiagnosticString(current.ProviderNames, account.ProviderName)
			indexed[slug] = current
		}
	}
	return indexed
}

func appendUniqueDiagnosticString(items []string, value string) []string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return items
	}
	for _, item := range items {
		if item == trimmed {
			return items
		}
	}
	return append(items, trimmed)
}
