//go:build darwin

package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestSyncMacOSBundleVersionScript(t *testing.T) {
	t.Run("syncs bundle version from release tag", func(t *testing.T) {
		appPath := createTempAppBundle(t)

		cmd := exec.Command("bash", "scripts/sync-macos-bundle-version.sh", appPath, "v0.1.10")
		output, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("sync-macos-bundle-version.sh error = %v, output = %s", err, output)
		}

		plist := readPlistAsJSON(t, filepath.Join(appPath, "Contents", "Info.plist"))
		if got := plist["CFBundleShortVersionString"]; got != "0.1.10" {
			t.Fatalf("CFBundleShortVersionString = %#v, want %q", got, "0.1.10")
		}
		if got := plist["CFBundleVersion"]; got != "0.1.10" {
			t.Fatalf("CFBundleVersion = %#v, want %q", got, "0.1.10")
		}
	})

	t.Run("syncs binary plist bundle metadata", func(t *testing.T) {
		appPath := createTempAppBundle(t)
		convertPlistToBinary(t, filepath.Join(appPath, "Contents", "Info.plist"))

		cmd := exec.Command("bash", "scripts/sync-macos-bundle-version.sh", appPath, "v0.1.11")
		output, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("sync-macos-bundle-version.sh error = %v, output = %s", err, output)
		}

		plist := readPlistAsJSON(t, filepath.Join(appPath, "Contents", "Info.plist"))
		if got := plist["CFBundleShortVersionString"]; got != "0.1.11" {
			t.Fatalf("CFBundleShortVersionString = %#v, want %q", got, "0.1.11")
		}
		if got := plist["CFBundleVersion"]; got != "0.1.11" {
			t.Fatalf("CFBundleVersion = %#v, want %q", got, "0.1.11")
		}
	})

	t.Run("rejects non release version", func(t *testing.T) {
		appPath := createTempAppBundle(t)

		cmd := exec.Command("bash", "scripts/sync-macos-bundle-version.sh", appPath, "dev")
		output, err := cmd.CombinedOutput()
		if err == nil {
			t.Fatalf("sync-macos-bundle-version.sh expected error, output = %s", output)
		}
		if !strings.Contains(string(output), "unsupported app version") {
			t.Fatalf("sync-macos-bundle-version.sh output = %q, want unsupported app version", output)
		}
	})
}

func createTempAppBundle(t *testing.T) string {
	t.Helper()

	appPath := filepath.Join(t.TempDir(), "GetTokens.app")
	contentsPath := filepath.Join(appPath, "Contents")
	if err := os.MkdirAll(contentsPath, 0o755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}

	const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>GetTokens</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleVersion</key>
  <string>1.0.0</string>
</dict>
</plist>
`

	plistPath := filepath.Join(contentsPath, "Info.plist")
	if err := os.WriteFile(plistPath, []byte(plist), 0o644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	return appPath
}

func readPlistAsJSON(t *testing.T, plistPath string) map[string]any {
	t.Helper()

	cmd := exec.Command("plutil", "-convert", "json", "-o", "-", plistPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("plutil error = %v, output = %s", err, output)
	}

	var data map[string]any
	if err := json.Unmarshal(output, &data); err != nil {
		t.Fatalf("json.Unmarshal() error = %v, output = %s", err, output)
	}

	return data
}

func convertPlistToBinary(t *testing.T, plistPath string) {
	t.Helper()

	cmd := exec.Command("plutil", "-convert", "binary1", plistPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("plutil binary convert error = %v, output = %s", err, output)
	}
}
