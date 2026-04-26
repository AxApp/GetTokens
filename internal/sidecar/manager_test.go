package sidecar

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestWriteConfigCreatesMinimalConfig(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")

	apiKey, err := writeConfig(path, 9317, dir)
	if err != nil {
		t.Fatalf("writeConfig returned error: %v", err)
	}
	if !strings.HasPrefix(apiKey, "sk-gettokens-") {
		t.Fatalf("expected generated api key to have gettokens prefix, got %q", apiKey)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read config: %v", err)
	}
	content := string(data)

	assertContains(t, content, "host: \"\"")
	assertContains(t, content, "port: 9317")
	assertContains(t, content, "auth-dir: "+dir)
	assertContains(t, content, "remote-management:")
	assertContains(t, content, "allow-remote: false")
	assertContains(t, content, "secret-key: "+ManagementKey)
	assertContains(t, content, "api-keys:")
	assertContains(t, content, "- "+apiKey)
}

func TestWriteConfigPreservesCodexAPIKeys(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")
	original := `host: 127.0.0.1
port: 8317
auth-dir: /tmp/old-auth
codex-api-key:
  - api-key: sk-test
    base-url: https://api.openai.com/v1
    prefix: team-a
remote-management:
  allow-remote: true
  secret-key: old-key
api-keys:
  - relay-key-1
  - relay-key-2
`

	if err := os.WriteFile(path, []byte(original), 0600); err != nil {
		t.Fatalf("seed config: %v", err)
	}

	apiKey, err := writeConfig(path, 9417, dir)
	if err != nil {
		t.Fatalf("writeConfig returned error: %v", err)
	}
	if apiKey != "relay-key-1" {
		t.Fatalf("expected preserved first relay api key, got %q", apiKey)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read config: %v", err)
	}
	content := string(data)

	assertContains(t, content, "codex-api-key:")
	assertContains(t, content, "host: \"\"")
	assertContains(t, content, "api-key: sk-test")
	assertContains(t, content, "base-url: https://api.openai.com/v1")
	assertContains(t, content, "prefix: team-a")
	assertContains(t, content, "port: 9417")
	assertContains(t, content, "auth-dir: "+dir)
	assertContains(t, content, "allow-remote: false")
	assertContains(t, content, "secret-key: "+ManagementKey)
	assertContains(t, content, "api-keys:")
	assertContains(t, content, "- relay-key-1")
	assertContains(t, content, "- relay-key-2")
}

func TestNormalizeLegacyAuthFilesAddsCodexCompatibilityFields(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "auth.json")
	legacy := `{
  "auth_mode": "chatgpt",
  "nolon": {
    "account": {
      "kind": "chatgptAccount",
      "email": "tester@example.com"
    }
  },
  "tokens": {
    "access_token": "access-token",
    "id_token": "eyJhbGciOiJub25lIn0.eyJodHRwczovL2FwaS5vcGVuYWkuY29tL2F1dGgiOnsiY2hhdGdwdF9hY2NvdW50X2lkIjoiYWNjdF8xMjMiLCJjaGF0Z3B0X3BsYW5fdHlwZSI6InBsdXMifX0.",
    "refresh_token": "refresh-token",
    "account_id": "acct_123"
  }
}`
	if err := os.WriteFile(path, []byte(legacy), 0600); err != nil {
		t.Fatalf("seed auth file: %v", err)
	}

	changed, err := normalizeLegacyAuthFiles(dir)
	if err != nil {
		t.Fatalf("normalizeLegacyAuthFiles returned error: %v", err)
	}
	if changed != 1 {
		t.Fatalf("changed = %d, want 1", changed)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read auth file: %v", err)
	}
	content := string(data)
	assertContains(t, content, `"type": "codex"`)
	assertContains(t, content, `"access_token": "access-token"`)
	assertContains(t, content, `"refresh_token": "refresh-token"`)
	assertContains(t, content, `"account_id": "acct_123"`)
	assertContains(t, content, `"plan_type": "plus"`)
}

func assertContains(t *testing.T, content string, expected string) {
	t.Helper()
	if !strings.Contains(content, expected) {
		t.Fatalf("expected config to contain %q, got:\n%s", expected, content)
	}
}
