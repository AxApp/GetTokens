package sidecar

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
)

// resolveBinaryPath returns the absolute path to the bundled sidecar binary.
func (m *Manager) resolveBinaryPath() (string, error) {
	binaryName := "cli-proxy-api"
	if runtime.GOOS == "windows" {
		binaryName += ".exe"
	}
	profile := resolveSidecarProfile()

	// 1. Next to the main executable (dev mode / extracted .app).
	exe, err := os.Executable()
	if err == nil {
		candidates := resolveBinaryCandidates(filepath.Dir(exe), binaryName, profile)
		for _, path := range candidates {
			if _, statErr := os.Stat(path); statErr == nil {
				return path, nil
			}
		}
	}

	// 2. Fallback: system PATH (useful for dev).
	if path, err := exec.LookPath(binaryName); err == nil {
		return path, nil
	}

	return "", fmt.Errorf("binary %q not found", binaryName)
}

func resolveBinaryCandidates(exeDir string, binaryName string, profile string) []string {
	if strings.EqualFold(profile, "dev") {
		return []string{
			filepath.Join(exeDir, "..", "..", "..", binaryName),
			filepath.Join(exeDir, binaryName),
			filepath.Join(exeDir, "..", "Resources", binaryName),
		}
	}
	return []string{
		filepath.Join(exeDir, binaryName),
		filepath.Join(exeDir, "..", "Resources", binaryName),
	}
}

// waitHealthy polls the health endpoint until it returns 200 or ctx/timeout expires.
func (m *Manager) waitHealthy(ctx context.Context, url string) error {
	deadline := time.Now().Add(startupTimeout)
	client := &http.Client{Timeout: 2 * time.Second}

	for time.Now().Before(deadline) {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		req, _ := http.NewRequestWithContext(ctx, http.MethodHead, url, nil)
		resp, err := client.Do(req)
		if err == nil && resp.StatusCode == http.StatusOK {
			resp.Body.Close()
			return nil
		}
		if resp != nil {
			resp.Body.Close()
		}
		time.Sleep(pollInterval)
	}
	return fmt.Errorf("timed out after %s", startupTimeout)
}

// ensureConfigDir creates and returns the profile-specific config dir under ~/.config.
func ensureConfigDir(profile string) (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".config", configDirNameForProfile(profile))
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}
	return dir, nil
}

func normalizeLegacyAuthFiles(dir string) (int, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0, err
	}

	changedCount := 0
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(strings.ToLower(entry.Name()), ".json") {
			continue
		}

		path := filepath.Join(dir, entry.Name())
		body, readErr := os.ReadFile(path)
		if readErr != nil || len(body) == 0 {
			continue
		}

		normalized, changed, normalizeErr := accountsdomain.NormalizeAuthFileForSidecar(body)
		if normalizeErr != nil || !changed {
			continue
		}
		if writeErr := os.WriteFile(path, normalized, 0600); writeErr != nil {
			return changedCount, writeErr
		}
		changedCount++
	}

	return changedCount, nil
}
