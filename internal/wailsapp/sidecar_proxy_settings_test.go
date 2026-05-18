package wailsapp

import (
	"io"
	"net/url"
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

func TestPendingSidecarProxySettingsApplyOnReady(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("GETTOKENS_APP_PROFILE", "dev")

	app := New("", "", "")
	result, err := app.UpdateSidecarProxySettings(SidecarProxySettings{UseSystemProxy: true})
	if err != nil {
		t.Fatalf("UpdateSidecarProxySettings() error = %v", err)
	}
	if result.AppliedToRunningSidecar {
		t.Fatal("AppliedToRunningSidecar = true for stopped sidecar")
	}
	if !app.sidecarProxyPendingApply {
		t.Fatal("sidecarProxyPendingApply = false, want true")
	}

	var calls int
	app.sidecarRequest = func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		calls++
		if method != "PUT" {
			t.Fatalf("method = %q, want PUT", method)
		}
		if path != ManagementAPIPrefix+"/config.yaml" {
			t.Fatalf("path = %q, want config yaml endpoint", path)
		}
		if contentType != "application/x-yaml" {
			t.Fatalf("contentType = %q, want application/x-yaml", contentType)
		}
		payload, err := io.ReadAll(body)
		if err != nil {
			t.Fatalf("ReadAll request body: %v", err)
		}
		if !strings.Contains(string(payload), "use-system-proxy: true") {
			t.Fatalf("request body missing use-system-proxy: true:\n%s", payload)
		}
		return []byte(`{"ok":true}`), 200, nil
	}

	if err := app.applyPendingSidecarProxySettings(); err != nil {
		t.Fatalf("applyPendingSidecarProxySettings() error = %v", err)
	}
	if calls != 1 {
		t.Fatalf("sidecar request calls = %d, want 1", calls)
	}
	if app.sidecarProxyPendingApply {
		t.Fatal("sidecarProxyPendingApply = true after successful apply")
	}

	if err := app.applyPendingSidecarProxySettings(); err != nil {
		t.Fatalf("second applyPendingSidecarProxySettings() error = %v", err)
	}
	if calls != 1 {
		t.Fatalf("sidecar request calls after second apply = %d, want 1", calls)
	}
}
