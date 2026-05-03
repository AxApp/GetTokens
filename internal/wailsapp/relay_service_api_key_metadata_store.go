package wailsapp

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const relayServiceAPIKeyMetadataFileName = "relay-service-api-key-metadata.json"

type RelayServiceAPIKeyItem struct {
	Value      string `json:"value"`
	CreatedAt  string `json:"createdAt,omitempty"`
	LastUsedAt string `json:"lastUsedAt,omitempty"`
}

type relayServiceAPIKeyMetadata struct {
	CreatedAt  string `json:"createdAt,omitempty"`
	LastUsedAt string `json:"lastUsedAt,omitempty"`
}

func relayServiceAPIKeyMetadataFilePath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".config", "gettokens-data")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}
	return filepath.Join(dir, relayServiceAPIKeyMetadataFileName), nil
}

func loadRelayServiceAPIKeyMetadata() (map[string]relayServiceAPIKeyMetadata, error) {
	path, err := relayServiceAPIKeyMetadataFilePath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]relayServiceAPIKeyMetadata{}, nil
		}
		return nil, err
	}

	var result map[string]relayServiceAPIKeyMetadata
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	if result == nil {
		return map[string]relayServiceAPIKeyMetadata{}, nil
	}
	return result, nil
}

func saveRelayServiceAPIKeyMetadata(items map[string]relayServiceAPIKeyMetadata) error {
	path, err := relayServiceAPIKeyMetadataFilePath()
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(data, '\n'), 0600)
}

func relayServiceAPIKeyMetadataID(apiKey string) string {
	trimmed := strings.TrimSpace(apiKey)
	if trimmed == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(trimmed))
	return hex.EncodeToString(sum[:])
}

func mergeRelayServiceAPIKeyMetadata(apiKeys []string, existing map[string]relayServiceAPIKeyMetadata, now time.Time) (map[string]relayServiceAPIKeyMetadata, bool) {
	if existing == nil {
		existing = map[string]relayServiceAPIKeyMetadata{}
	}

	next := make(map[string]relayServiceAPIKeyMetadata, len(apiKeys))
	changed := false
	nowText := now.UTC().Format(time.RFC3339)

	for _, apiKey := range apiKeys {
		id := relayServiceAPIKeyMetadataID(apiKey)
		if id == "" {
			continue
		}

		item := existing[id]
		if strings.TrimSpace(item.CreatedAt) == "" {
			item.CreatedAt = nowText
			changed = true
		}
		next[id] = item
		if previous, ok := existing[id]; !ok || previous != item {
			changed = true
		}
	}

	if len(next) != len(existing) {
		changed = true
	}

	return next, changed
}

func markRelayServiceAPIKeyLastUsed(existing map[string]relayServiceAPIKeyMetadata, apiKey string, now time.Time) (map[string]relayServiceAPIKeyMetadata, bool) {
	id := relayServiceAPIKeyMetadataID(apiKey)
	if id == "" {
		return existing, false
	}

	next := make(map[string]relayServiceAPIKeyMetadata, len(existing)+1)
	for key, value := range existing {
		next[key] = value
	}

	item := next[id]
	nowText := now.UTC().Format(time.RFC3339)
	changed := false
	if strings.TrimSpace(item.CreatedAt) == "" {
		item.CreatedAt = nowText
		changed = true
	}
	if item.LastUsedAt != nowText {
		item.LastUsedAt = nowText
		changed = true
	}
	next[id] = item
	return next, changed
}

func buildRelayServiceAPIKeyItems(apiKeys []string, metadata map[string]relayServiceAPIKeyMetadata) []RelayServiceAPIKeyItem {
	if len(apiKeys) == 0 {
		return nil
	}

	items := make([]RelayServiceAPIKeyItem, 0, len(apiKeys))
	for _, apiKey := range apiKeys {
		id := relayServiceAPIKeyMetadataID(apiKey)
		meta := metadata[id]
		items = append(items, RelayServiceAPIKeyItem{
			Value:      apiKey,
			CreatedAt:  meta.CreatedAt,
			LastUsedAt: meta.LastUsedAt,
		})
	}
	return items
}

func sortRelayServiceAPIKeyMetadataKeys(items map[string]relayServiceAPIKeyMetadata) []string {
	keys := make([]string, 0, len(items))
	for key := range items {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}
