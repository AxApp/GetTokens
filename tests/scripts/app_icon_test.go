package main

import (
	"crypto/sha256"
	"os"
	"testing"
)

func TestWailsAppIconUsesBrandingLogo(t *testing.T) {
	appIcon := readFileSHA256(t, repoPath(t, "build", "appicon.png"))
	brandLogo := readFileSHA256(t, repoPath(t, "resources", "branding", "logo-brutalist-key.png"))
	if appIcon != brandLogo {
		t.Fatalf("build/appicon.png must match resources/branding/logo-brutalist-key.png")
	}
}

func readFileSHA256(t *testing.T, path string) [sha256.Size]byte {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return sha256.Sum256(data)
}
