package wailsapp

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/linhay/gettokens/internal/cliproxyapi"
)

func TestStoredCodexAPIKeysRoundTrip(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	first := cliproxyapi.CodexAPIKeyInput{
		APIKey:  "sk-test-1111",
		BaseURL: "https://api.openai.com/v1",
		Prefix:  "team-a",
	}
	second := cliproxyapi.CodexAPIKeyInput{
		APIKey:  "sk-test-2222",
		BaseURL: "https://api.openai.com/v1",
	}

	if err := persistCodexAPIKeySet([]cliproxyapi.CodexAPIKeyInput{first, second}); err != nil {
		t.Fatalf("persistCodexAPIKeySet: %v", err)
	}

	items, err := loadStoredCodexAPIKeys()
	if err != nil {
		t.Fatalf("loadStoredCodexAPIKeys: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(items))
	}

	if err := deleteStoredCodexAPIKey(codexAPIKeyAssetIDFromInput(first)); err != nil {
		t.Fatalf("deleteStoredCodexAPIKey: %v", err)
	}

	items, err = loadStoredCodexAPIKeys()
	if err != nil {
		t.Fatalf("loadStoredCodexAPIKeys after delete: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 item after delete, got %d", len(items))
	}
	if items[0].APIKey != second.APIKey {
		t.Fatalf("expected remaining api key %q, got %q", second.APIKey, items[0].APIKey)
	}
}

func TestMergeCodexAPIKeyInputsMigratesSidecarOnlyItems(t *testing.T) {
	stored := []cliproxyapi.CodexAPIKeyInput{
		{APIKey: "sk-test-1111", BaseURL: "https://api.openai.com/v1", Prefix: "team-a"},
	}
	sidecarItems := []cliproxyapi.CodexAPIKey{
		{APIKey: "sk-test-1111", BaseURL: "https://api.openai.com/v1/", Prefix: "/team-a/"},
		{APIKey: "sk-test-2222", BaseURL: "https://api.openai.com/v1"},
	}

	merged, migrated := mergeCodexAPIKeyInputs(stored, sidecarItems)
	if !migrated {
		t.Fatal("expected migrated to be true")
	}
	if len(merged) != 2 {
		t.Fatalf("expected 2 merged items, got %d", len(merged))
	}
}

func TestPersistCodexAPIKeySetRemovesStaleFiles(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	if err := persistCodexAPIKeySet([]cliproxyapi.CodexAPIKeyInput{
		{APIKey: "sk-test-1111", BaseURL: "https://api.openai.com/v1"},
		{APIKey: "sk-test-2222", BaseURL: "https://api.openai.com/v1"},
	}); err != nil {
		t.Fatalf("seed persist: %v", err)
	}

	if err := persistCodexAPIKeySet([]cliproxyapi.CodexAPIKeyInput{
		{APIKey: "sk-test-2222", BaseURL: "https://api.openai.com/v1"},
	}); err != nil {
		t.Fatalf("second persist: %v", err)
	}

	dir, err := codexAPIKeyStoreDir()
	if err != nil {
		t.Fatalf("codexAPIKeyStoreDir: %v", err)
	}
	files, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("ReadDir: %v", err)
	}
	count := 0
	for _, entry := range files {
		if !entry.IsDir() && filepath.Ext(entry.Name()) == ".json" {
			count++
		}
	}
	if count != 1 {
		t.Fatalf("expected 1 json file, got %d", count)
	}
}

func TestCodexAPIKeyStoreMigratesLegacyDirectory(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	home, err := os.UserHomeDir()
	if err != nil {
		t.Fatalf("UserHomeDir: %v", err)
	}

	legacyDir := filepath.Join(home, ".config", "gettokens", legacyCodexAPIKeyStoreDirName)
	if err := os.MkdirAll(legacyDir, 0700); err != nil {
		t.Fatalf("MkdirAll legacyDir: %v", err)
	}
	legacyFile := filepath.Join(legacyDir, "legacy.json")
	if err := os.WriteFile(legacyFile, []byte(`{"api-key":"sk-legacy","base-url":"https://api.openai.com/v1"}`), 0600); err != nil {
		t.Fatalf("WriteFile legacyFile: %v", err)
	}

	dir, err := codexAPIKeyStoreDir()
	if err != nil {
		t.Fatalf("codexAPIKeyStoreDir: %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, "legacy.json")); err != nil {
		t.Fatalf("expected migrated file in new dir: %v", err)
	}
	if _, err := os.Stat(legacyFile); !os.IsNotExist(err) {
		t.Fatalf("expected legacy file removed, got err=%v", err)
	}
}
