package wailsapp

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
	"github.com/linhay/gettokens/internal/cliproxyapi"
)

const (
	codexAPIKeyStoreDirName       = "codex-api-keys"
	legacyCodexAPIKeyStoreDirName = "codex-api-keys"
)

func codexAPIKeyStoreDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".config", "gettokens-data", codexAPIKeyStoreDirName)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}
	if err := migrateLegacyCodexAPIKeyStore(home, dir); err != nil {
		return "", err
	}
	return dir, nil
}

func migrateLegacyCodexAPIKeyStore(home string, targetDir string) error {
	legacyDir := filepath.Join(home, ".config", "gettokens", legacyCodexAPIKeyStoreDirName)
	entries, err := os.ReadDir(legacyDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		sourcePath := filepath.Join(legacyDir, entry.Name())
		targetPath := filepath.Join(targetDir, entry.Name())
		if _, err := os.Stat(targetPath); err == nil {
			if removeErr := os.Remove(sourcePath); removeErr != nil && !os.IsNotExist(removeErr) {
				return removeErr
			}
			continue
		}
		if err := os.Rename(sourcePath, targetPath); err != nil {
			data, readErr := os.ReadFile(sourcePath)
			if readErr != nil {
				return readErr
			}
			if writeErr := os.WriteFile(targetPath, data, 0600); writeErr != nil {
				return writeErr
			}
			if removeErr := os.Remove(sourcePath); removeErr != nil && !os.IsNotExist(removeErr) {
				return removeErr
			}
		}
	}

	_ = os.Remove(legacyDir)
	return nil
}

func codexAPIKeyFileName(apiKey string, baseURL string, prefix string) string {
	fingerprint := accountsdomain.APIKeyFingerprint(apiKey)
	if fingerprint == "" {
		fingerprint = "empty"
	}
	base := accountsdomain.NormalizeBaseURL(baseURL)
	if base == "" {
		base = "default"
	}
	base = sanitizeFileToken(base)
	pfx := accountsdomain.NormalizePrefix(prefix)
	if pfx == "" {
		pfx = "root"
	}
	pfx = sanitizeFileToken(pfx)
	return fmt.Sprintf("%s-%s-%s.json", fingerprint, base, pfx)
}

func sanitizeFileToken(value string) string {
	replacer := strings.NewReplacer("/", "-", ":", "-", "@", "-", "#", "-", "?", "-", "&", "-", "=", "-", "\\", "-")
	clean := replacer.Replace(strings.TrimSpace(value))
	clean = strings.Trim(clean, "-.")
	if clean == "" {
		return "default"
	}
	return clean
}

func loadStoredCodexAPIKeys() ([]cliproxyapi.CodexAPIKeyInput, error) {
	dir, err := codexAPIKeyStoreDir()
	if err != nil {
		return nil, err
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	items := make([]cliproxyapi.CodexAPIKeyInput, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, entry.Name()))
		if err != nil {
			return nil, err
		}
		var item cliproxyapi.CodexAPIKeyInput
		if err := json.Unmarshal(data, &item); err != nil {
			return nil, err
		}
		normalizeCodexAPIKeyInput(&item)
		if strings.TrimSpace(item.APIKey) == "" || strings.TrimSpace(item.BaseURL) == "" {
			continue
		}
		items = append(items, item)
	}

	sort.Slice(items, func(i, j int) bool {
		return codexAPIKeyAssetIDFromInput(items[i]) < codexAPIKeyAssetIDFromInput(items[j])
	})
	return items, nil
}

func saveStoredCodexAPIKey(item cliproxyapi.CodexAPIKeyInput) error {
	normalizeCodexAPIKeyInput(&item)
	if strings.TrimSpace(item.APIKey) == "" {
		return fmt.Errorf("api key 不能为空")
	}
	if strings.TrimSpace(item.BaseURL) == "" {
		return fmt.Errorf("base url 不能为空")
	}

	dir, err := codexAPIKeyStoreDir()
	if err != nil {
		return err
	}
	path := filepath.Join(dir, codexAPIKeyFileName(item.APIKey, item.BaseURL, item.Prefix))
	data, err := json.MarshalIndent(item, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0600)
}

func deleteStoredCodexAPIKey(id string) error {
	items, err := loadStoredCodexAPIKeys()
	if err != nil {
		return err
	}
	dir, err := codexAPIKeyStoreDir()
	if err != nil {
		return err
	}

	for _, item := range items {
		if codexAPIKeyAssetIDFromInput(item) != strings.TrimSpace(id) {
			continue
		}
		path := filepath.Join(dir, codexAPIKeyFileName(item.APIKey, item.BaseURL, item.Prefix))
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return err
		}
		return nil
	}
	return nil
}

func normalizeCodexAPIKeyInput(item *cliproxyapi.CodexAPIKeyInput) {
	if item == nil {
		return
	}
	item.LocalID = strings.TrimSpace(item.LocalID)
	item.APIKey = strings.TrimSpace(item.APIKey)
	item.Label = strings.TrimSpace(item.Label)
	item.BaseURL = accountsdomain.NormalizeBaseURL(item.BaseURL)
	item.Prefix = accountsdomain.NormalizePrefix(item.Prefix)
	item.ProxyURL = strings.TrimSpace(item.ProxyURL)
}

func codexAPIKeyAssetIDFromInput(item cliproxyapi.CodexAPIKeyInput) string {
	if trimmed := strings.TrimSpace(item.LocalID); trimmed != "" {
		return trimmed
	}
	return accountsdomain.CodexAPIKeyAssetID(item.APIKey, item.BaseURL, item.Prefix)
}

func codexAPIKeyConfigIdentityFromInput(item cliproxyapi.CodexAPIKeyInput) string {
	return accountsdomain.CodexAPIKeyAssetID(item.APIKey, item.BaseURL, item.Prefix)
}

func codexAPIKeyInputMatchesID(item cliproxyapi.CodexAPIKeyInput, id string) bool {
	targetID := strings.TrimSpace(id)
	if targetID == "" {
		return false
	}
	return codexAPIKeyAssetIDFromInput(item) == targetID || codexAPIKeyConfigIdentityFromInput(item) == targetID
}

func codexAPIKeyInputFromKey(item cliproxyapi.CodexAPIKey) cliproxyapi.CodexAPIKeyInput {
	input := cliproxyapi.CodexAPIKeyInput{
		LocalID:        item.LocalID,
		APIKey:         item.APIKey,
		Label:          item.Label,
		Priority:       item.Priority,
		Disabled:       item.Disabled,
		Prefix:         item.Prefix,
		BaseURL:        item.BaseURL,
		ProxyURL:       item.ProxyURL,
		Models:         item.Models,
		Headers:        item.Headers,
		ExcludedModels: item.ExcludedModels,
	}
	normalizeCodexAPIKeyInput(&input)
	return input
}

func ensureCodexAPIKeyLocalID(item *cliproxyapi.CodexAPIKeyInput) error {
	if item == nil {
		return nil
	}
	if strings.TrimSpace(item.LocalID) != "" {
		return nil
	}
	buf := make([]byte, 6)
	if _, err := rand.Read(buf); err != nil {
		return err
	}
	item.LocalID = "codex-api-key:" + hex.EncodeToString(buf)
	return nil
}

func mergeCodexAPIKeyInputs(stored []cliproxyapi.CodexAPIKeyInput, sidecarItems []cliproxyapi.CodexAPIKey) ([]cliproxyapi.CodexAPIKeyInput, bool) {
	merged := make([]cliproxyapi.CodexAPIKeyInput, 0, len(stored)+len(sidecarItems))
	seenIDs := make(map[string]struct{}, len(stored)+len(sidecarItems))
	seenConfigIdentities := make(map[string]struct{}, len(stored)+len(sidecarItems))

	for _, item := range stored {
		normalizeCodexAPIKeyInput(&item)
		id := codexAPIKeyAssetIDFromInput(item)
		configIdentity := codexAPIKeyConfigIdentityFromInput(item)
		if _, ok := seenIDs[id]; ok {
			continue
		}
		if _, ok := seenConfigIdentities[configIdentity]; ok {
			continue
		}
		seenIDs[id] = struct{}{}
		seenConfigIdentities[configIdentity] = struct{}{}
		merged = append(merged, item)
	}

	migrated := false
	for _, item := range sidecarItems {
		input := codexAPIKeyInputFromKey(item)
		id := codexAPIKeyAssetIDFromInput(input)
		configIdentity := codexAPIKeyConfigIdentityFromInput(input)
		if _, ok := seenIDs[id]; ok {
			continue
		}
		if _, ok := seenConfigIdentities[configIdentity]; ok {
			continue
		}
		seenIDs[id] = struct{}{}
		seenConfigIdentities[configIdentity] = struct{}{}
		migrated = true
		merged = append(merged, input)
	}

	sort.Slice(merged, func(i, j int) bool {
		return codexAPIKeyAssetIDFromInput(merged[i]) < codexAPIKeyAssetIDFromInput(merged[j])
	})
	return merged, migrated
}

func persistCodexAPIKeySet(items []cliproxyapi.CodexAPIKeyInput) error {
	dir, err := codexAPIKeyStoreDir()
	if err != nil {
		return err
	}

	existingEntries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}
	expected := make(map[string]struct{}, len(items))
	for _, item := range items {
		if err := ensureCodexAPIKeyLocalID(&item); err != nil {
			return err
		}
		fileName := codexAPIKeyFileName(item.APIKey, item.BaseURL, item.Prefix)
		expected[fileName] = struct{}{}
		if err := saveStoredCodexAPIKey(item); err != nil {
			return err
		}
	}

	for _, entry := range existingEntries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		if _, ok := expected[entry.Name()]; ok {
			continue
		}
		if err := os.Remove(filepath.Join(dir, entry.Name())); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	return nil
}
