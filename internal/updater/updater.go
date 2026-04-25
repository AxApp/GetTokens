// Package updater wraps go-selfupdate for cross-platform auto-update.
package updater

import (
	"context"
	"fmt"
	"os"
	"runtime"

	"github.com/Masterminds/semver/v3"
	"github.com/creativeprojects/go-selfupdate"
)

// ReleaseInfo is returned to the frontend when a new version is available.
// It carries only JSON-serialisable fields so it can be emitted as a Wails event.
type ReleaseInfo struct {
	Version     string `json:"version"`
	ReleaseURL  string `json:"releaseUrl"`
	AssetName   string `json:"assetName"`
	ReleaseNote string `json:"releaseNote"`
}

// Updater checks and applies application updates from GitHub Releases.
type Updater struct {
	repo    string
	current string

	// cachedRelease holds the last detected release so Apply can use it directly.
	cachedRelease *selfupdate.Release
}

func updaterConfig() selfupdate.Config {
	return selfupdate.Config{
		Validator:     &selfupdate.ChecksumValidator{UniqueFilename: "checksums.txt"},
		UniversalArch: "universal",
	}
}

func newSelfUpdater() (*selfupdate.Updater, error) {
	return selfupdate.NewUpdater(updaterConfig())
}

func hasNewerVersion(currentVersion, latestVersion string) (bool, error) {
	current, err := semver.NewVersion(currentVersion)
	if err != nil {
		return false, fmt.Errorf("parse current version: %w", err)
	}

	latest, err := semver.NewVersion(latestVersion)
	if err != nil {
		return false, fmt.Errorf("parse latest version: %w", err)
	}

	return latest.GreaterThan(current), nil
}

func supportsInPlaceApply(goos string) bool {
	return goos != "darwin"
}

func SupportsInPlaceApply() bool {
	return supportsInPlaceApply(runtime.GOOS)
}

// New creates an Updater targeting the given GitHub repo slug (e.g. "owner/repo").
func New(repo, currentVersion string) *Updater {
	return &Updater{repo: repo, current: currentVersion}
}

// Check queries GitHub Releases for a newer version.
// Returns (nil, false, nil) when already up-to-date.
func (u *Updater) Check(ctx context.Context) (*ReleaseInfo, bool, error) {
	if u.current == "dev" {
		// Skip update checks in development builds.
		return nil, false, nil
	}

	up, err := newSelfUpdater()
	if err != nil {
		return nil, false, fmt.Errorf("create updater: %w", err)
	}

	latest, found, err := up.DetectLatest(ctx, selfupdate.ParseSlug(u.repo))
	if err != nil {
		return nil, false, fmt.Errorf("detect latest: %w", err)
	}
	if !found {
		return nil, false, nil
	}

	hasNewer, err := hasNewerVersion(u.current, latest.Version())
	if err != nil {
		return nil, false, fmt.Errorf("compare versions: %w", err)
	}
	if !hasNewer {
		return nil, false, nil
	}

	u.cachedRelease = latest
	return &ReleaseInfo{
		Version:     latest.Version(),
		ReleaseURL:  latest.URL,
		AssetName:   latest.AssetName,
		ReleaseNote: latest.ReleaseNotes,
	}, true, nil
}

// Apply downloads and installs the cached release, replacing the running executable.
// Call Check first; if no release is cached this returns an error.
func (u *Updater) Apply(ctx context.Context) error {
	if !SupportsInPlaceApply() {
		return fmt.Errorf("in-place update is not supported on %s; download and reinstall from the release page", runtime.GOOS)
	}

	if u.cachedRelease == nil {
		return fmt.Errorf("no update available; call Check first")
	}

	exe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("resolve executable path: %w", err)
	}

	up, err := newSelfUpdater()
	if err != nil {
		return fmt.Errorf("create updater: %w", err)
	}

	if err := up.UpdateTo(ctx, u.cachedRelease, exe); err != nil {
		return fmt.Errorf("apply update: %w", err)
	}
	return nil
}

// CurrentPlatform returns the OS/arch string for display purposes.
func CurrentPlatform() string {
	return fmt.Sprintf("%s/%s", runtime.GOOS, runtime.GOARCH)
}
