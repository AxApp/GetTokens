package codexbinary

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestSnapshotWithoutManifestReturnsEmptyState(t *testing.T) {
	t.Setenv("PATH", "/usr/bin:/bin")
	service := NewService(ServiceOptions{RootDir: t.TempDir()})

	snapshot, err := service.Snapshot()
	if err != nil {
		t.Fatalf("Snapshot() error = %v", err)
	}

	if snapshot.SelectedVersionID != "" {
		t.Fatalf("SelectedVersionID = %q, want empty", snapshot.SelectedVersionID)
	}
	if len(snapshot.Versions) != 0 {
		t.Fatalf("len(Versions) = %d, want 0", len(snapshot.Versions))
	}
	if snapshot.ManagedBinPath == "" {
		t.Fatalf("ManagedBinPath should be populated")
	}
	if snapshot.ManagedConfig.IsPathConfigured {
		t.Fatalf("IsPathConfigured = true, want false")
	}
	if snapshot.ManagedConfig.EnableCommand == "" {
		t.Fatalf("EnableCommand should be populated")
	}
}

func TestImportLocalCopiesAndDeduplicatesBySHA(t *testing.T) {
	root := t.TempDir()
	service := NewService(ServiceOptions{RootDir: root, Now: fixedNow})
	binary := writeFakeCodex(t, root, "source-codex", "codex-cli 0.120.0")

	result, err := service.ImportLocal(ImportLocalInput{Path: binary})
	if err != nil {
		t.Fatalf("ImportLocal() error = %v", err)
	}
	if result.Version.ID == "" {
		t.Fatalf("imported version ID should not be empty")
	}
	if result.Version.DetectedVersion != "0.120.0" {
		t.Fatalf("DetectedVersion = %q, want 0.120.0", result.Version.DetectedVersion)
	}
	if _, err := os.Stat(filepath.Join(root, result.Version.BinaryRelativePath)); err != nil {
		t.Fatalf("imported binary missing: %v", err)
	}

	again, err := service.ImportLocal(ImportLocalInput{Path: binary})
	if err != nil {
		t.Fatalf("ImportLocal() second error = %v", err)
	}
	if again.Version.ID != result.Version.ID {
		t.Fatalf("duplicate import ID = %q, want %q", again.Version.ID, result.Version.ID)
	}

	snapshot, err := service.Snapshot()
	if err != nil {
		t.Fatalf("Snapshot() error = %v", err)
	}
	if len(snapshot.Versions) != 1 {
		t.Fatalf("len(Versions) = %d, want 1", len(snapshot.Versions))
	}
}

func TestActivateUpdatesSymlinksAndSnapshot(t *testing.T) {
	root := t.TempDir()
	service := NewService(ServiceOptions{RootDir: root, Now: fixedNow})
	binary := writeFakeCodex(t, root, "source-codex", "codex-cli 0.121.0")
	result, err := service.ImportLocal(ImportLocalInput{Path: binary})
	if err != nil {
		t.Fatalf("ImportLocal() error = %v", err)
	}

	useResult, err := service.Use(UseInput{VersionID: result.Version.ID})
	if err != nil {
		t.Fatalf("Use() error = %v", err)
	}
	if useResult.SelectedVersionID != result.Version.ID {
		t.Fatalf("SelectedVersionID = %q, want %q", useResult.SelectedVersionID, result.Version.ID)
	}

	binTarget, err := os.Readlink(filepath.Join(root, "bin", "codex"))
	if err != nil {
		t.Fatalf("bin symlink missing: %v", err)
	}
	if !strings.Contains(binTarget, result.Version.ID) {
		t.Fatalf("bin symlink target = %q, want version ID", binTarget)
	}

	t.Setenv("PATH", filepath.Join(root, "bin")+string(os.PathListSeparator)+"/usr/bin")
	snapshot, err := service.Snapshot()
	if err != nil {
		t.Fatalf("Snapshot() error = %v", err)
	}
	if snapshot.CurrentVersion == nil || snapshot.CurrentVersion.ID != result.Version.ID {
		t.Fatalf("CurrentVersion = %#v, want %q", snapshot.CurrentVersion, result.Version.ID)
	}
	if !snapshot.ManagedConfig.IsPathConfigured {
		t.Fatalf("IsPathConfigured = false, want true")
	}
	if !snapshot.ManagedConfig.IsResolvedToManaged {
		t.Fatalf("IsResolvedToManaged = false, resolved path %q", snapshot.ManagedConfig.ResolvedCodexPath)
	}
}

func TestVersionNotesUsesCacheWhenPresent(t *testing.T) {
	root := t.TempDir()
	service := NewService(ServiceOptions{RootDir: root, Now: fixedNow})
	if err := service.SaveVersionNotes(VersionNotesView{
		SourceID:      "openai-codex-github",
		Tag:           "rust-v0.120.0",
		Version:       "0.120.0",
		Title:         "rust-v0.120.0",
		BodyMarkdown:  "## Changed\n- Faster startup",
		BodyPlainText: "Changed\nFaster startup",
		Source:        "remote",
	}); err != nil {
		t.Fatalf("SaveVersionNotes() error = %v", err)
	}

	notes, err := service.VersionNotes(VersionNotesInput{SourceID: "openai-codex-github", Tag: "rust-v0.120.0"})
	if err != nil {
		t.Fatalf("VersionNotes() error = %v", err)
	}
	if notes.Source != "cache" {
		t.Fatalf("Source = %q, want cache", notes.Source)
	}
	if !strings.Contains(notes.BodyMarkdown, "Faster startup") {
		t.Fatalf("BodyMarkdown = %q, want cached body", notes.BodyMarkdown)
	}
}

func TestRefreshAvailableFiltersAndCachesGitHubReleases(t *testing.T) {
	root := t.TempDir()
	service := NewService(ServiceOptions{
		RootDir: root,
		Now:     fixedNow,
		GOOS:    "darwin",
		GOARCH:  "arm64",
		ReleaseClient: fakeReleaseClient{releases: []GitHubRelease{
			{
				TagName:     "rust-v0.120.0",
				Name:        "rust-v0.120.0",
				HTMLURL:     "https://github.com/openai/codex/releases/tag/rust-v0.120.0",
				PublishedAt: fixedNow(),
				Assets: []GitHubReleaseAsset{{
					Name:        "codex-aarch64-apple-darwin.tar.gz",
					DownloadURL: "https://example.com/codex-aarch64-apple-darwin.tar.gz",
					Size:        10,
				}},
			},
			{
				TagName: "rust-v0.119.0",
				Draft:   true,
				Assets:  []GitHubReleaseAsset{{Name: "codex-aarch64-apple-darwin.tar.gz"}},
			},
			{
				TagName: "npm-v0.118.0",
				Assets:  []GitHubReleaseAsset{{Name: "codex-aarch64-apple-darwin.tar.gz"}},
			},
			{
				TagName: "rust-v0.117.0",
				Assets:  []GitHubReleaseAsset{{Name: "codex-x86_64-unknown-linux-gnu.tar.gz"}},
			},
		}},
	})

	snapshot, err := service.RefreshAvailable(context.Background())
	if err != nil {
		t.Fatalf("RefreshAvailable() error = %v", err)
	}
	if len(snapshot.RemoteVersions) != 1 {
		t.Fatalf("len(RemoteVersions) = %d, want 1", len(snapshot.RemoteVersions))
	}
	if snapshot.RemoteVersions[0].Version != "0.120.0" {
		t.Fatalf("Version = %q, want 0.120.0", snapshot.RemoteVersions[0].Version)
	}
	if len(snapshot.VersionRows) != 1 || !snapshot.VersionRows[0].HasRemote {
		t.Fatalf("VersionRows = %#v, want one remote row", snapshot.VersionRows)
	}

	cached, err := service.Snapshot()
	if err != nil {
		t.Fatalf("Snapshot() error = %v", err)
	}
	if len(cached.RemoteVersions) != 1 {
		t.Fatalf("cached len(RemoteVersions) = %d, want 1", len(cached.RemoteVersions))
	}
}

func TestRefreshAvailableFallsBackToCacheOnNetworkError(t *testing.T) {
	root := t.TempDir()
	service := NewService(ServiceOptions{
		RootDir: root,
		Now:     fixedNow,
		GOOS:    "darwin",
		GOARCH:  "arm64",
		ReleaseClient: fakeReleaseClient{releases: []GitHubRelease{{
			TagName: "rust-v0.120.0",
			Assets: []GitHubReleaseAsset{{
				Name:        "codex-aarch64-apple-darwin.tar.gz",
				DownloadURL: "https://example.com/codex.tar.gz",
			}},
		}}},
	})
	if _, err := service.RefreshAvailable(context.Background()); err != nil {
		t.Fatalf("seed RefreshAvailable() error = %v", err)
	}

	service.releaseClient = fakeReleaseClient{err: errors.New("rate limited")}
	snapshot, err := service.RefreshAvailable(context.Background())
	if err != nil {
		t.Fatalf("RefreshAvailable() with cache error = %v", err)
	}
	if len(snapshot.RemoteVersions) != 1 {
		t.Fatalf("len(RemoteVersions) = %d, want cached 1", len(snapshot.RemoteVersions))
	}
	if snapshot.Doctor.Severity != "warning" {
		t.Fatalf("Doctor.Severity = %q, want warning", snapshot.Doctor.Severity)
	}
}

func TestDownloadInstallsAndActivatesTarGzRelease(t *testing.T) {
	root := t.TempDir()
	archive := codexTarGz(t, "codex-cli 0.122.0")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/codex-aarch64-apple-darwin.tar.gz" {
			t.Fatalf("unexpected download path: %s", r.URL.Path)
		}
		_, _ = w.Write(archive)
	}))
	defer server.Close()

	service := NewService(ServiceOptions{
		RootDir: root,
		Now:     fixedNow,
		GOOS:    "darwin",
		GOARCH:  "arm64",
		ReleaseClient: fakeReleaseClient{releases: []GitHubRelease{{
			TagName: "rust-v0.122.0",
			Assets: []GitHubReleaseAsset{{
				Name:        "codex-aarch64-apple-darwin.tar.gz",
				DownloadURL: server.URL + "/codex-aarch64-apple-darwin.tar.gz",
				Size:        int64(len(archive)),
			}},
		}}},
		HTTPClient: server.Client(),
	})

	result, err := service.Download(context.Background(), DownloadInput{
		SourceID:             "openai-codex-github",
		Tag:                  "rust-v0.122.0",
		ActivateAfterInstall: true,
	})
	if err != nil {
		t.Fatalf("Download() error = %v", err)
	}
	if !result.Activated {
		t.Fatalf("Activated = false, want true")
	}
	if result.Version.DetectedVersion != "0.122.0" {
		t.Fatalf("DetectedVersion = %q, want 0.122.0", result.Version.DetectedVersion)
	}
	if result.Snapshot.SelectedVersionID != result.Version.ID {
		t.Fatalf("SelectedVersionID = %q, want %q", result.Snapshot.SelectedVersionID, result.Version.ID)
	}
	if _, err := os.Lstat(filepath.Join(root, "bin", "codex")); err != nil {
		t.Fatalf("managed codex link missing: %v", err)
	}
}

func TestDownloadRejectsReleaseWithoutPlatformAsset(t *testing.T) {
	service := NewService(ServiceOptions{
		RootDir: t.TempDir(),
		GOOS:    "darwin",
		GOARCH:  "arm64",
		ReleaseClient: fakeReleaseClient{releases: []GitHubRelease{{
			TagName: "rust-v0.122.0",
			HTMLURL: "https://github.com/openai/codex/releases/tag/rust-v0.122.0",
			Assets: []GitHubReleaseAsset{{
				Name:        "codex-x86_64-unknown-linux-gnu.tar.gz",
				DownloadURL: "https://example.com/codex-linux.tar.gz",
			}},
		}}},
	})

	_, err := service.Download(context.Background(), DownloadInput{
		SourceID:             "openai-codex-github",
		Tag:                  "rust-v0.122.0",
		ActivateAfterInstall: true,
	})
	if err == nil || !strings.Contains(err.Error(), "codex_binary_release_missing") {
		t.Fatalf("Download() error = %v, want release missing", err)
	}
}

func TestEnableManagedPathCreatesProfileBlockAndBackup(t *testing.T) {
	root := t.TempDir()
	profilePath := filepath.Join(root, ".zshrc")
	if err := os.WriteFile(profilePath, []byte("# user config\nexport FOO=bar\n"), 0o644); err != nil {
		t.Fatalf("write profile: %v", err)
	}
	t.Setenv("PATH", "/usr/bin:/bin")
	service := NewService(ServiceOptions{
		RootDir:          filepath.Join(root, "codex"),
		Now:              fixedNow,
		ShellProfilePath: profilePath,
	})

	result, err := service.EnableManagedPath()
	if err != nil {
		t.Fatalf("EnableManagedPath() error = %v", err)
	}
	if !result.Changed {
		t.Fatalf("Changed = false, want true")
	}
	if result.BackupPath == "" {
		t.Fatalf("BackupPath should be populated")
	}
	content, err := os.ReadFile(profilePath)
	if err != nil {
		t.Fatalf("read profile: %v", err)
	}
	text := string(content)
	if !strings.Contains(text, "# user config") {
		t.Fatalf("profile lost user content: %q", text)
	}
	if !strings.Contains(text, managedPathBlockStart) || !strings.Contains(text, "export PATH=") {
		t.Fatalf("profile missing managed block: %q", text)
	}
	if !strings.Contains(text, `:"$PATH"`) {
		t.Fatalf("profile PATH block must expand existing PATH at shell runtime: %q", text)
	}
	if !result.Snapshot.ManagedConfig.IsPathConfigured {
		t.Fatalf("snapshot IsPathConfigured = false, want true")
	}
}

func TestEnableManagedPathIsIdempotent(t *testing.T) {
	root := t.TempDir()
	profilePath := filepath.Join(root, ".zshrc")
	service := NewService(ServiceOptions{
		RootDir:          filepath.Join(root, "codex"),
		Now:              fixedNow,
		ShellProfilePath: profilePath,
	})
	first, err := service.EnableManagedPath()
	if err != nil {
		t.Fatalf("EnableManagedPath() first error = %v", err)
	}
	if !first.Changed {
		t.Fatalf("first Changed = false, want true")
	}
	second, err := service.EnableManagedPath()
	if err != nil {
		t.Fatalf("EnableManagedPath() second error = %v", err)
	}
	if second.Changed {
		t.Fatalf("second Changed = true, want false")
	}
	content, err := os.ReadFile(profilePath)
	if err != nil {
		t.Fatalf("read profile: %v", err)
	}
	if count := strings.Count(string(content), managedPathBlockStart); count != 1 {
		t.Fatalf("managed block count = %d, want 1", count)
	}
}

func TestEnableManagedPathUsesExistingZprofileWhenZshrcMissing(t *testing.T) {
	root := t.TempDir()
	home := filepath.Join(root, "home")
	if err := os.MkdirAll(home, 0o755); err != nil {
		t.Fatalf("mkdir home: %v", err)
	}
	t.Setenv("HOME", home)
	t.Setenv("SHELL", "/bin/zsh")
	t.Setenv("PATH", "/usr/bin:/bin")
	zprofile := filepath.Join(home, ".zprofile")
	if err := os.WriteFile(zprofile, []byte("# login profile\n"), 0o644); err != nil {
		t.Fatalf("write zprofile: %v", err)
	}
	service := NewService(ServiceOptions{
		RootDir: filepath.Join(root, "codex"),
		Now:     fixedNow,
	})

	result, err := service.EnableManagedPath()
	if err != nil {
		t.Fatalf("EnableManagedPath() error = %v", err)
	}
	if result.ProfilePath != zprofile {
		t.Fatalf("ProfilePath = %q, want %q", result.ProfilePath, zprofile)
	}
	if _, err := os.Stat(filepath.Join(home, ".zshrc")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf(".zshrc should not be created when existing .zprofile is selected: %v", err)
	}
	content, err := os.ReadFile(zprofile)
	if err != nil {
		t.Fatalf("read zprofile: %v", err)
	}
	if !strings.Contains(string(content), managedPathBlockStart) {
		t.Fatalf("zprofile missing managed block: %q", string(content))
	}
}

func TestEnableManagedPathUsesZDOTDIRForZsh(t *testing.T) {
	root := t.TempDir()
	home := filepath.Join(root, "home")
	zdotdir := filepath.Join(root, "zsh-config")
	if err := os.MkdirAll(zdotdir, 0o755); err != nil {
		t.Fatalf("mkdir zdotdir: %v", err)
	}
	t.Setenv("HOME", home)
	t.Setenv("ZDOTDIR", zdotdir)
	t.Setenv("SHELL", "/bin/zsh")
	t.Setenv("PATH", "/usr/bin:/bin")

	service := NewService(ServiceOptions{
		RootDir: filepath.Join(root, "codex"),
		Now:     fixedNow,
	})

	result, err := service.EnableManagedPath()
	if err != nil {
		t.Fatalf("EnableManagedPath() error = %v", err)
	}
	wantProfile := filepath.Join(zdotdir, ".zshrc")
	if result.ProfilePath != wantProfile {
		t.Fatalf("ProfilePath = %q, want %q", result.ProfilePath, wantProfile)
	}
	if _, err := os.Stat(filepath.Join(home, ".zshrc")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("home .zshrc should not be created when ZDOTDIR is set: %v", err)
	}
}

func TestEnableManagedPathUsesExistingBashProfile(t *testing.T) {
	root := t.TempDir()
	home := filepath.Join(root, "home")
	if err := os.MkdirAll(home, 0o755); err != nil {
		t.Fatalf("mkdir home: %v", err)
	}
	t.Setenv("HOME", home)
	t.Setenv("SHELL", "/bin/bash")
	t.Setenv("PATH", "/usr/bin:/bin")
	bashProfile := filepath.Join(home, ".bash_profile")
	if err := os.WriteFile(bashProfile, []byte("# bash login profile\n"), 0o644); err != nil {
		t.Fatalf("write bash profile: %v", err)
	}
	service := NewService(ServiceOptions{
		RootDir: filepath.Join(root, "codex"),
		Now:     fixedNow,
	})

	result, err := service.EnableManagedPath()
	if err != nil {
		t.Fatalf("EnableManagedPath() error = %v", err)
	}
	if result.ProfilePath != bashProfile {
		t.Fatalf("ProfilePath = %q, want %q", result.ProfilePath, bashProfile)
	}
	if _, err := os.Stat(filepath.Join(home, ".bashrc")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf(".bashrc should not be created when existing .bash_profile is selected: %v", err)
	}
}

func fixedNow() time.Time {
	return time.Date(2026, 5, 12, 8, 0, 0, 0, time.UTC)
}

func writeFakeCodex(t *testing.T, dir string, name string, versionOutput string) string {
	t.Helper()
	path := filepath.Join(dir, name)
	content := "#!/bin/sh\nif [ \"$1\" = \"--version\" ]; then echo \"" + versionOutput + "\"; exit 0; fi\necho ok\n"
	if err := os.WriteFile(path, []byte(content), 0o755); err != nil {
		t.Fatalf("write fake codex: %v", err)
	}
	return path
}

func codexTarGz(t *testing.T, versionOutput string) []byte {
	t.Helper()
	var buffer bytes.Buffer
	gzipWriter := gzip.NewWriter(&buffer)
	tarWriter := tar.NewWriter(gzipWriter)
	content := []byte("#!/bin/sh\nif [ \"$1\" = \"--version\" ]; then echo \"" + versionOutput + "\"; exit 0; fi\necho ok\n")
	if err := tarWriter.WriteHeader(&tar.Header{
		Name: "codex",
		Mode: 0o755,
		Size: int64(len(content)),
	}); err != nil {
		t.Fatalf("write tar header: %v", err)
	}
	if _, err := tarWriter.Write(content); err != nil {
		t.Fatalf("write tar content: %v", err)
	}
	if err := tarWriter.Close(); err != nil {
		t.Fatalf("close tar: %v", err)
	}
	if err := gzipWriter.Close(); err != nil {
		t.Fatalf("close gzip: %v", err)
	}
	return buffer.Bytes()
}

type fakeReleaseClient struct {
	releases []GitHubRelease
	err      error
}

func (f fakeReleaseClient) ListReleases(ctx context.Context, source Source) ([]GitHubRelease, error) {
	if f.err != nil {
		return nil, f.err
	}
	return f.releases, nil
}
