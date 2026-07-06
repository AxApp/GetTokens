//go:build darwin

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestBuildLocalMacOSPackageScriptPlan(t *testing.T) {
	outputDir := filepath.Join(t.TempDir(), "release")
	cmd := exec.Command(
		"bash",
		"scripts/build-local-macos-package.sh",
		"--arch", "arm64",
		"--version", "v1.2.3",
		"--output-dir", outputDir,
		"--skip-tests",
	)
	cmd.Dir = repoRoot(t)
	cmd.Env = append(os.Environ(), "LOCAL_MACOS_PACKAGE_PRINT_PLAN=1")

	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("build-local-macos-package.sh dry run error = %v, output = %s", err, output)
	}

	plan := string(output)
	expectedParts := []string{
		"arch=arm64",
		"version=v1.2.3",
		"platform=darwin/arm64",
		"asset=GetTokens_local_macOS_AppleSilicon.dmg",
		"notarize=0",
		outputDir,
	}

	for _, part := range expectedParts {
		if !strings.Contains(plan, part) {
			t.Fatalf("build-local-macos-package.sh plan = %q, want substring %q", plan, part)
		}
	}
}
