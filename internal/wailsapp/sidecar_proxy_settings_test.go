package wailsapp

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestUpdateSidecarProxySettingsPersistsConfig(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("GETTOKENS_APP_PROFILE", "dev")

	app := New("", "", "")
	result, err := app.UpdateSidecarProxySettings(SidecarProxySettings{UseSystemProxy: true})
	if err != nil {
		t.Fatalf("UpdateSidecarProxySettings() error = %v", err)
	}
	if !result.UseSystemProxy {
		t.Fatal("UseSystemProxy = false, want true")
	}
	if result.AppliedToRunningSidecar {
		t.Fatal("AppliedToRunningSidecar = true for stopped sidecar")
	}

	wantPath := filepath.Join(home, ".config", "gettokens-dev", "config.yaml")
	if result.ConfigPath != wantPath {
		t.Fatalf("ConfigPath = %q, want %q", result.ConfigPath, wantPath)
	}
	body, err := os.ReadFile(wantPath)
	if err != nil {
		t.Fatalf("ReadFile config: %v", err)
	}
	if !strings.Contains(string(body), "use-system-proxy: true") {
		t.Fatalf("config missing use-system-proxy: true:\n%s", body)
	}

	loaded, err := app.GetSidecarProxySettings()
	if err != nil {
		t.Fatalf("GetSidecarProxySettings() error = %v", err)
	}
	if !loaded.UseSystemProxy {
		t.Fatal("loaded UseSystemProxy = false, want true")
	}
}
