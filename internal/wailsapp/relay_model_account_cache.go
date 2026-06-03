package wailsapp

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	relayModelAccountCacheDirName  = "codex-model-account-cache"
	relayModelAccountCacheFileName = "account-models-v1.json"
)

type relayModelAccountCachePayload struct {
	Version         int                         `json:"version"`
	UpdatedAtUnixMs int64                       `json:"updatedAtUnixMs"`
	Accounts        []relayModelAccountSnapshot `json:"accounts"`
}

type relayModelAccountSnapshot struct {
	AccountKey   string                  `json:"accountKey"`
	Kind         string                  `json:"kind"`
	ProviderName string                  `json:"providerName,omitempty"`
	Models       []OpenAICompatibleModel `json:"models"`
}

func relayModelAccountCachePath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".config", "gettokens-data", relayModelAccountCacheDirName, relayModelAccountCacheFileName), nil
}

func loadRelayModelAccountCache() ([]relayModelAccountSnapshot, error) {
	payload, err := loadRelayModelAccountCachePayload()
	if err != nil {
		return nil, err
	}
	return payload.Accounts, nil
}

func loadRelayModelAccountCachePayload() (relayModelAccountCachePayload, error) {
	path, err := relayModelAccountCachePath()
	if err != nil {
		return relayModelAccountCachePayload{}, err
	}
	body, err := readOptionalTextFile(path)
	if err != nil {
		return relayModelAccountCachePayload{}, err
	}
	return parseRelayModelAccountCachePayload(body)
}

func parseRelayModelAccountCache(body string) ([]relayModelAccountSnapshot, error) {
	payload, err := parseRelayModelAccountCachePayload(body)
	if err != nil {
		return nil, err
	}
	return payload.Accounts, nil
}

func parseRelayModelAccountCachePayload(body string) (relayModelAccountCachePayload, error) {
	trimmed := strings.TrimSpace(body)
	if trimmed == "" {
		return relayModelAccountCachePayload{}, nil
	}
	var payload relayModelAccountCachePayload
	if err := json.Unmarshal([]byte(trimmed), &payload); err != nil {
		return relayModelAccountCachePayload{}, err
	}
	payload.Accounts = normalizeRelayModelAccountSnapshots(payload.Accounts)
	return payload, nil
}

func saveRelayModelAccountCache(snapshots []relayModelAccountSnapshot) error {
	path, err := relayModelAccountCachePath()
	if err != nil {
		return err
	}
	payload := relayModelAccountCachePayload{
		Version:         1,
		UpdatedAtUnixMs: time.Now().UnixMilli(),
		Accounts:        normalizeRelayModelAccountSnapshots(snapshots),
	}
	body, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	return writeFileAtomically(path, append(body, '\n'), 0600)
}

type relayModelCatalogTracePayload struct {
	GeneratedAtUnixMs int64                         `json:"generatedAtUnixMs"`
	CachePath         string                        `json:"cachePath"`
	CatalogPath       string                        `json:"catalogPath"`
	Accounts          []relayModelAccountSnapshot   `json:"accounts"`
	Models            []relayModelCatalogTraceModel `json:"models"`
}

type relayModelCatalogTraceModel struct {
	Slug           string   `json:"slug"`
	DisplayName    string   `json:"displayName,omitempty"`
	SourceAccounts []string `json:"sourceAccounts,omitempty"`
	SourceKinds    []string `json:"sourceKinds,omitempty"`
	ProviderNames  []string `json:"providerNames,omitempty"`
}

func relayModelCatalogTracePath() (string, error) {
	cachePath, err := relayModelAccountCachePath()
	if err != nil {
		return "", err
	}
	return filepath.Join(filepath.Dir(cachePath), relayModelCatalogTraceFileName), nil
}

func loadRelayModelCatalogTrace() (relayModelCatalogTracePayload, error) {
	path, err := relayModelCatalogTracePath()
	if err != nil {
		return relayModelCatalogTracePayload{}, err
	}
	body, err := readOptionalTextFile(path)
	if err != nil {
		return relayModelCatalogTracePayload{}, err
	}
	if strings.TrimSpace(body) == "" {
		return relayModelCatalogTracePayload{}, nil
	}
	var payload relayModelCatalogTracePayload
	if err := json.Unmarshal([]byte(body), &payload); err != nil {
		return relayModelCatalogTracePayload{}, err
	}
	payload.Accounts = normalizeRelayModelAccountSnapshots(payload.Accounts)
	return payload, nil
}

func saveRelayModelCatalogTrace(models []OpenAICompatibleModel, snapshots []relayModelAccountSnapshot) error {
	path, err := relayModelCatalogTracePath()
	if err != nil {
		return err
	}
	cachePath, err := relayModelAccountCachePath()
	if err != nil {
		return err
	}
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		codexHome = ""
	}
	index := buildDiagnosticCacheModelIndex(snapshots)
	traceModels := make([]relayModelCatalogTraceModel, 0, len(models))
	for _, model := range normalizeProviderModels(models) {
		slug := resolveCodexModelCatalogSlug(model)
		if slug == "" {
			continue
		}
		diagnostic := index[slug]
		traceModels = append(traceModels, relayModelCatalogTraceModel{
			Slug:           slug,
			DisplayName:    strings.TrimSpace(model.Alias),
			SourceAccounts: append([]string(nil), diagnostic.SourceAccounts...),
			SourceKinds:    append([]string(nil), diagnostic.SourceKinds...),
			ProviderNames:  append([]string(nil), diagnostic.ProviderNames...),
		})
	}
	payload := relayModelCatalogTracePayload{
		GeneratedAtUnixMs: time.Now().UnixMilli(),
		CachePath:         cachePath,
		CatalogPath:       getGetTokensCodexModelCatalogPath(codexHome),
		Accounts:          normalizeRelayModelAccountSnapshots(snapshots),
		Models:            traceModels,
	}
	body, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	return writeFileAtomically(path, append(body, '\n'), 0600)
}

func pruneRelayModelAccountCacheEntries(accountKeys ...string) error {
	remove := make(map[string]struct{})
	for _, accountKey := range accountKeys {
		trimmed := strings.TrimSpace(accountKey)
		if trimmed != "" {
			remove[trimmed] = struct{}{}
		}
	}
	if len(remove) == 0 {
		return nil
	}
	snapshots, err := loadRelayModelAccountCache()
	if err != nil {
		return err
	}
	next := make([]relayModelAccountSnapshot, 0, len(snapshots))
	for _, snapshot := range snapshots {
		if _, ok := remove[strings.TrimSpace(snapshot.AccountKey)]; ok {
			continue
		}
		next = append(next, snapshot)
	}
	return saveRelayModelAccountCache(next)
}

func normalizeRelayModelAccountSnapshots(snapshots []relayModelAccountSnapshot) []relayModelAccountSnapshot {
	out := make([]relayModelAccountSnapshot, 0, len(snapshots))
	seen := make(map[string]struct{})
	for _, snapshot := range snapshots {
		accountKey := strings.TrimSpace(snapshot.AccountKey)
		if accountKey == "" {
			continue
		}
		if _, ok := seen[accountKey]; ok {
			continue
		}
		models := normalizeProviderModels(snapshot.Models)
		if len(models) == 0 {
			continue
		}
		seen[accountKey] = struct{}{}
		out = append(out, relayModelAccountSnapshot{
			AccountKey:   accountKey,
			Kind:         strings.TrimSpace(snapshot.Kind),
			ProviderName: strings.TrimSpace(snapshot.ProviderName),
			Models:       models,
		})
	}
	return out
}

func indexRelayModelAccountSnapshots(snapshots []relayModelAccountSnapshot) map[string]relayModelAccountSnapshot {
	indexed := make(map[string]relayModelAccountSnapshot)
	for _, snapshot := range normalizeRelayModelAccountSnapshots(snapshots) {
		indexed[snapshot.AccountKey] = snapshot
	}
	return indexed
}

func loadRelaySupportedModelsFromAccountCache() ([]OpenAICompatibleModel, error) {
	snapshots, err := loadRelayModelAccountCache()
	if err != nil {
		return nil, err
	}
	cachedModels := make([]OpenAICompatibleModel, 0)
	for _, snapshot := range snapshots {
		cachedModels = append(cachedModels, snapshot.Models...)
	}

	localCodexModels, err := loadLocalCodexModelsCache()
	if err != nil {
		localCodexModels = nil
	}
	return listRelaySupportedModels(nil, nil, nil, append(cachedModels, localCodexModels...), nil), nil
}
