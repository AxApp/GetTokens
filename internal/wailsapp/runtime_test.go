package wailsapp

import (
	"os"
	"strings"
	"testing"
)

func TestStartupDoesNotReplayLegacyCodexAPIKeysToSidecar(t *testing.T) {
	source, err := os.ReadFile("runtime.go")
	if err != nil {
		t.Fatalf("read runtime.go: %v", err)
	}
	if strings.Contains(string(source), "syncStoredCodexAPIKeysToSidecar") {
		t.Fatal("startup must not replay legacy codex-api-key store after account-store SQLite is source of truth")
	}
}
