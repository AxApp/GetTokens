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
	path, err := relayModelAccountCachePath()
	if err != nil {
		return nil, err
	}
	body, err := readOptionalTextFile(path)
	if err != nil {
		return nil, err
	}
	return parseRelayModelAccountCache(body)
}

func parseRelayModelAccountCache(body string) ([]relayModelAccountSnapshot, error) {
	trimmed := strings.TrimSpace(body)
	if trimmed == "" {
		return nil, nil
	}
	var payload relayModelAccountCachePayload
	if err := json.Unmarshal([]byte(trimmed), &payload); err != nil {
		return nil, err
	}
	return normalizeRelayModelAccountSnapshots(payload.Accounts), nil
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
