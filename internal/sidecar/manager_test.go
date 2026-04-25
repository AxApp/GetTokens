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

	if err := writeConfig(path, 9317, dir); err != nil {
		t.Fatalf("writeConfig returned error: %v", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read config: %v", err)
	}
	content := string(data)

	assertContains(t, content, "host: 127.0.0.1")
	assertContains(t, content, "port: 9317")
	assertContains(t, content, "auth-dir: "+dir)
	assertContains(t, content, "remote-management:")
	assertContains(t, content, "allow-remote: false")
	assertContains(t, content, "secret-key: "+ManagementKey)
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
`

	if err := os.WriteFile(path, []byte(original), 0600); err != nil {
		t.Fatalf("seed config: %v", err)
	}

	if err := writeConfig(path, 9417, dir); err != nil {
		t.Fatalf("writeConfig returned error: %v", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read config: %v", err)
	}
	content := string(data)

	assertContains(t, content, "codex-api-key:")
	assertContains(t, content, "api-key: sk-test")
	assertContains(t, content, "base-url: https://api.openai.com/v1")
	assertContains(t, content, "prefix: team-a")
	assertContains(t, content, "port: 9417")
	assertContains(t, content, "auth-dir: "+dir)
	assertContains(t, content, "allow-remote: false")
	assertContains(t, content, "secret-key: "+ManagementKey)
}

func assertContains(t *testing.T, content string, expected string) {
	t.Helper()
	if !strings.Contains(content, expected) {
		t.Fatalf("expected config to contain %q, got:\n%s", expected, content)
	}
}
