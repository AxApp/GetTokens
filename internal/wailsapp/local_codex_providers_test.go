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

func TestParseLocalCodexModelProviderStateReadsCurrentProvider(t *testing.T) {
	state := parseLocalCodexModelProviderState(`
model = "gpt-5.5"
model_provider = "corp"

[model_providers.corp]
name = "Corp Relay"
base_url = "http://relay.example/v1"
`)

	if state.CurrentProviderID != "corp" {
		t.Fatalf("CurrentProviderID = %q, want corp", state.CurrentProviderID)
	}
	if state.CurrentProviderName != "Corp Relay" {
		t.Fatalf("CurrentProviderName = %q, want Corp Relay", state.CurrentProviderName)
	}
	if state.CurrentProviderIsBuiltin {
		t.Fatalf("CurrentProviderIsBuiltin = true, want false")
	}
	if !state.CurrentProviderExists {
		t.Fatalf("CurrentProviderExists = false, want true")
	}
}

func TestParseLocalCodexModelProviderStateDefaultsToBuiltinOpenAI(t *testing.T) {
	state := parseLocalCodexModelProviderState(`
model = "gpt-5.5"
`)

	if state.CurrentProviderID != "openai" {
		t.Fatalf("CurrentProviderID = %q, want openai", state.CurrentProviderID)
	}
	if state.CurrentProviderName != "OpenAI" {
		t.Fatalf("CurrentProviderName = %q, want OpenAI", state.CurrentProviderName)
	}
	if !state.CurrentProviderIsBuiltin {
		t.Fatalf("CurrentProviderIsBuiltin = false, want true")
	}
	if !state.CurrentProviderExists {
		t.Fatalf("CurrentProviderExists = false, want true")
	}
}

func TestParseLocalCodexModelProviderStateFallsBackForMissingSection(t *testing.T) {
	state := parseLocalCodexModelProviderState(`
model_provider = "missing-relay"

[model_providers.other]
name = "Other Relay"
`)

	if state.CurrentProviderID != "missing-relay" {
		t.Fatalf("CurrentProviderID = %q, want missing-relay", state.CurrentProviderID)
	}
	if state.CurrentProviderName != "missing-relay" {
		t.Fatalf("CurrentProviderName = %q, want missing-relay", state.CurrentProviderName)
	}
	if state.CurrentProviderIsBuiltin {
		t.Fatalf("CurrentProviderIsBuiltin = true, want false")
	}
	if state.CurrentProviderExists {
		t.Fatalf("CurrentProviderExists = true, want false")
	}
}

func TestGetLocalCodexModelProviderStateReadsConfigTomlFromCodexHome(t *testing.T) {
	codexHome := filepath.Join(t.TempDir(), ".codex")
	t.Setenv("CODEX_HOME", codexHome)
	t.Setenv("HOME", t.TempDir())

	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.WriteFile(configPath, []byte(`
model_provider = "relay_a"

[model_providers.relay_a]
name = "Relay A"
`), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	state, err := app.GetLocalCodexModelProviderState()
	if err != nil {
		t.Fatalf("GetLocalCodexModelProviderState returned error: %v", err)
	}
	if state.CurrentProviderID != "relay_a" || state.CurrentProviderName != "Relay A" {
		t.Fatalf("unexpected current provider: %#v", state)
	}
}
