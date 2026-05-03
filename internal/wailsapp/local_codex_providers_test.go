package wailsapp

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseLocalCodexModelProvidersReadsProviderIDsAndNames(t *testing.T) {
	configBody := `
model = "gpt-5.5"
model_provider = "corp"

[model_providers.corp]
name = "Corp Relay"
base_url = "http://relay.example/v1"

[mcp_servers.docs]
command = "docs"

[model_providers.second]
base_url = "http://second.example/v1"

[model_providers.third]
name = "Third Relay"
`

	providers := parseLocalCodexModelProviders(configBody)
	if len(providers) != 3 {
		t.Fatalf("provider count = %d, want 3 (%#v)", len(providers), providers)
	}
	if providers[0].ProviderID != "corp" || providers[0].ProviderName != "Corp Relay" {
		t.Fatalf("unexpected first provider: %#v", providers[0])
	}
	if providers[1].ProviderID != "second" || providers[1].ProviderName != "second" {
		t.Fatalf("unexpected second provider fallback name: %#v", providers[1])
	}
	if providers[2].ProviderID != "third" || providers[2].ProviderName != "Third Relay" {
		t.Fatalf("unexpected third provider: %#v", providers[2])
	}
}

func TestListLocalCodexModelProvidersReadsConfigTomlFromCodexHome(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())

	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.WriteFile(configPath, []byte(`
[model_providers.relay_a]
name = "Relay A"

[model_providers.relay_b]
base_url = "http://relay-b/v1"
`), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	providers, err := app.ListLocalCodexModelProviders()
	if err != nil {
		t.Fatalf("ListLocalCodexModelProviders returned error: %v", err)
	}
	if len(providers) != 2 {
		t.Fatalf("provider count = %d, want 2 (%#v)", len(providers), providers)
	}
	if providers[0].ProviderID != "relay_a" || providers[0].ProviderName != "Relay A" {
		t.Fatalf("unexpected first provider: %#v", providers[0])
	}
	if providers[1].ProviderID != "relay_b" || providers[1].ProviderName != "relay_b" {
		t.Fatalf("unexpected second provider: %#v", providers[1])
	}
}
