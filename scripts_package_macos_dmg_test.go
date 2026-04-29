//go:build darwin

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestPackageMacOSDMGScript(t *testing.T) {
	appPath := filepath.Join(t.TempDir(), "GetTokens.app")
	if err := os.MkdirAll(appPath, 0o755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}

	dmgPath := filepath.Join(t.TempDir(), "GetTokens.dmg")
	cmd := exec.Command("bash", "scripts/package-macos-dmg.sh", dmgPath, appPath)
	cmd.Env = append(os.Environ(), "PRINT_CREATE_DMG_COMMAND=1")

	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("package-macos-dmg.sh error = %v, output = %s", err, output)
	}

	command := string(output)
	expectedParts := []string{
		"--volname GetTokens",
		"--window-size 660 400",
		"--icon-size 100",
		"--icon GetTokens.app 180 170",
		"--hide-extension GetTokens.app",
		"--app-drop-link 480 170",
		dmgPath,
		appPath,
	}

	for _, part := range expectedParts {
		if !strings.Contains(command, part) {
			t.Fatalf("package-macos-dmg.sh output = %q, want substring %q", command, part)
		}
	}
}
