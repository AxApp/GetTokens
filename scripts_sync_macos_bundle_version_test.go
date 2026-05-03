package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestSyncMacOSBundleVersionScriptUpdatesBinaryPlist(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("requires macOS plist tooling")
	}

	appPath := filepath.Join(t.TempDir(), "GetTokens.app")
	contentsPath := filepath.Join(appPath, "Contents")
	if err := os.MkdirAll(contentsPath, 0o755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}

	plistPath := filepath.Join(contentsPath, "Info.plist")
	plistContent := `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleShortVersionString</key>
  <string>0.0.1</string>
  <key>CFBundleVersion</key>
  <string>0.0.1</string>
</dict>
</plist>
`
	if err := os.WriteFile(plistPath, []byte(plistContent), 0o644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	convert := exec.Command("plutil", "-convert", "binary1", plistPath)
	if output, err := convert.CombinedOutput(); err != nil {
		t.Fatalf("plutil convert error = %v, output = %s", err, output)
	}

	cmd := exec.Command("bash", "scripts/sync-macos-bundle-version.sh", appPath, "v1.2.3")
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("sync-macos-bundle-version.sh error = %v, output = %s", err, output)
	}

	shortVersion := plistBuddyPrint(t, plistPath, "CFBundleShortVersionString")
	if shortVersion != "1.2.3" {
		t.Fatalf("CFBundleShortVersionString = %q, want %q", shortVersion, "1.2.3")
	}

	bundleVersion := plistBuddyPrint(t, plistPath, "CFBundleVersion")
	if bundleVersion != "1.2.3" {
		t.Fatalf("CFBundleVersion = %q, want %q", bundleVersion, "1.2.3")
	}
}

func plistBuddyPrint(t *testing.T, plistPath, key string) string {
	t.Helper()

	cmd := exec.Command("/usr/libexec/PlistBuddy", "-c", "Print :"+key, plistPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("PlistBuddy print %s error = %v, output = %s", key, err, output)
	}

	return strings.TrimSpace(string(output))
}
