package codexbinary

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
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

func TestDeleteVersionRemovesNonSelectedVersion(t *testing.T) {
	root := t.TempDir()
	service := NewService(ServiceOptions{RootDir: root, Now: fixedNow})
	activeBinary := writeFakeCodex(t, root, "active-codex", "codex-cli 0.121.0")
	oldBinary := writeFakeCodex(t, root, "old-codex", "codex-cli 0.120.0")
	active, err := service.ImportLocal(ImportLocalInput{Path: activeBinary, ActivateAfterInstall: true})
	if err != nil {
		t.Fatalf("ImportLocal(active) error = %v", err)
	}
	old, err := service.ImportLocal(ImportLocalInput{Path: oldBinary})
	if err != nil {
		t.Fatalf("ImportLocal(old) error = %v", err)
	}

	result, err := service.DeleteVersion(VersionActionInput{VersionID: old.Version.ID})
	if err != nil {
		t.Fatalf("DeleteVersion() error = %v", err)
	}
	if result.DeletedVersionID != old.Version.ID {
		t.Fatalf("DeletedVersionID = %q, want %q", result.DeletedVersionID, old.Version.ID)
	}
	if result.Snapshot.SelectedVersionID != active.Version.ID {
		t.Fatalf("SelectedVersionID = %q, want active %q", result.Snapshot.SelectedVersionID, active.Version.ID)
	}
	if _, err := os.Stat(filepath.Join(root, old.Version.BinaryRelativePath)); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("deleted binary stat error = %v, want not exist", err)
	}
	for _, version := range result.Snapshot.Versions {
		if version.ID == old.Version.ID {
			t.Fatalf("deleted version still in snapshot: %#v", version)
		}
	}
}

func TestDeleteVersionRejectsSelectedVersion(t *testing.T) {
	root := t.TempDir()
	service := NewService(ServiceOptions{RootDir: root, Now: fixedNow})
	binary := writeFakeCodex(t, root, "active-codex", "codex-cli 0.121.0")
	active, err := service.ImportLocal(ImportLocalInput{Path: binary, ActivateAfterInstall: true})
	if err != nil {
		t.Fatalf("ImportLocal() error = %v", err)
	}

	_, err = service.DeleteVersion(VersionActionInput{VersionID: active.Version.ID})
	if err == nil || !strings.Contains(err.Error(), "codex_binary_delete_active_version") {
		t.Fatalf("DeleteVersion() error = %v, want active-version rejection", err)
	}
	if _, err := os.Stat(filepath.Join(root, active.Version.BinaryRelativePath)); err != nil {
		t.Fatalf("active binary should remain: %v", err)
	}
}

func TestVersionNotesPrefersRemoteWhenCacheExists(t *testing.T) {
	root := t.TempDir()
	service := NewService(ServiceOptions{
		RootDir: root,
		Now:     fixedNow,
		ReleaseClient: fakeReleaseClient{releases: []GitHubRelease{{
			TagName:     "rust-v0.120.0",
			Name:        "rust-v0.120.0",
			Body:        "## Changed\n- Remote body",
			HTMLURL:     "https://github.com/openai/codex/releases/tag/rust-v0.120.0",
			PublishedAt: fixedNow(),
			Assets: []GitHubReleaseAsset{{
				Name:        "codex-aarch64-apple-darwin.tar.gz",
				DownloadURL: "https://example.com/codex-aarch64-apple-darwin.tar.gz",
				Size:        10,
			}}},
		}},
		GOOS:   "darwin",
		GOARCH: "arm64",
	})
	if err := service.SaveVersionNotes(VersionNotesView{
		SourceID:      "openai-codex-github",
		Tag:           "rust-v0.120.0",
		Version:       "0.120.0",
		Title:         "rust-v0.120.0",
		BodyMarkdown:  "## Changed\n- Cached body",
		BodyPlainText: "Changed\nCached body",
		Source:        "remote",
	}); err != nil {
		t.Fatalf("SaveVersionNotes() error = %v", err)
	}

	notes, err := service.VersionNotes(context.Background(), VersionNotesInput{SourceID: "openai-codex-github", Tag: "rust-v0.120.0"})
	if err != nil {
		t.Fatalf("VersionNotes() error = %v", err)
	}
	if notes.Source != "remote" {
		t.Fatalf("Source = %q, want remote", notes.Source)
	}
	if !strings.Contains(notes.BodyMarkdown, "Remote body") {
		t.Fatalf("BodyMarkdown = %q, want remote body", notes.BodyMarkdown)
	}
}

func TestVersionNotesFallsBackToCacheWhenRemoteFails(t *testing.T) {
	root := t.TempDir()
	service := NewService(ServiceOptions{
		RootDir:       root,
		Now:           fixedNow,
		ReleaseClient: fakeReleaseClient{err: errors.New("rate limited")},
	})
	if err := service.SaveVersionNotes(VersionNotesView{
		SourceID:      "openai-codex-github",
		Tag:           "rust-v0.120.0",
		Version:       "0.120.0",
		Title:         "rust-v0.120.0",
		BodyMarkdown:  "## Changed\n- Cached body",
		BodyPlainText: "Changed\nCached body",
		Source:        "remote",
	}); err != nil {
		t.Fatalf("SaveVersionNotes() error = %v", err)
	}

	notes, err := service.VersionNotes(context.Background(), VersionNotesInput{SourceID: "openai-codex-github", Tag: "rust-v0.120.0"})
	if err != nil {
		t.Fatalf("VersionNotes() error = %v", err)
	}
	if notes.Source != "cache" {
		t.Fatalf("Source = %q, want cache", notes.Source)
	}
	if !strings.Contains(notes.BodyMarkdown, "Cached body") {
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
				TagName:    "rust-v0.121.0-alpha.1",
				Name:       "rust-v0.121.0-alpha.1",
				HTMLURL:    "https://github.com/openai/codex/releases/tag/rust-v0.121.0-alpha.1",
				Prerelease: true,
				Assets: []GitHubReleaseAsset{{
					Name:        "codex-aarch64-apple-darwin.tar.gz",
					DownloadURL: "https://example.com/codex-aarch64-apple-darwin-alpha.tar.gz",
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
	if len(snapshot.RemoteVersions) != 2 {
		t.Fatalf("len(RemoteVersions) = %d, want 2", len(snapshot.RemoteVersions))
	}
	if !containsRemoteVersion(snapshot.RemoteVersions, "0.120.0", false) {
		t.Fatalf("RemoteVersions = %#v, want stable 0.120.0", snapshot.RemoteVersions)
	}
	if !containsRemoteVersion(snapshot.RemoteVersions, "0.121.0-alpha.1", true) {
		t.Fatalf("RemoteVersions = %#v, want alpha 0.121.0-alpha.1", snapshot.RemoteVersions)
	}
	if len(snapshot.VersionRows) != 2 {
		t.Fatalf("VersionRows = %#v, want stable and alpha remote rows", snapshot.VersionRows)
	}

	cached, err := service.Snapshot()
	if err != nil {
		t.Fatalf("Snapshot() error = %v", err)
	}
	if len(cached.RemoteVersions) != 2 {
		t.Fatalf("cached len(RemoteVersions) = %d, want 2", len(cached.RemoteVersions))
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
	archive := codexTarGzNamed(t, "codex-aarch64-apple-darwin", "codex-cli 0.122.0")
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

func TestDownloadInstallsWithoutActivatingTarGzRelease(t *testing.T) {
	root := t.TempDir()
	activeBinary := writeFakeCodex(t, root, "active-codex", "codex-cli 0.121.0")
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
	active, err := service.ImportLocal(ImportLocalInput{Path: activeBinary, ActivateAfterInstall: true})
	if err != nil {
		t.Fatalf("ImportLocal() error = %v", err)
	}

	result, err := service.Download(context.Background(), DownloadInput{
		SourceID:             "openai-codex-github",
		Tag:                  "rust-v0.122.0",
		ActivateAfterInstall: false,
	})
	if err != nil {
		t.Fatalf("Download() error = %v", err)
	}
	if result.Activated {
		t.Fatalf("Activated = true, want false")
	}
	if result.Snapshot.SelectedVersionID != active.Version.ID {
		t.Fatalf("SelectedVersionID = %q, want active %q", result.Snapshot.SelectedVersionID, active.Version.ID)
	}
	downloaded := findRowByVersion(result.Snapshot.VersionRows, "0.122.0")
	if downloaded == nil || !downloaded.IsInstalled {
		t.Fatalf("downloaded row = %#v, want installed 0.122.0", downloaded)
	}
	if downloaded.PrimaryAction != "activate" {
		t.Fatalf("PrimaryAction = %q, want activate", downloaded.PrimaryAction)
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

func TestCopyWithProgressReportsBytes(t *testing.T) {
	var output bytes.Buffer
	var seen []int64
	err := copyWithProgress(&output, strings.NewReader("abcdef"), 6, func(done int64, total int64) {
		if total != 6 {
			t.Fatalf("total = %d, want 6", total)
		}
		seen = append(seen, done)
	})
	if err != nil {
		t.Fatalf("copyWithProgress() error = %v", err)
	}
	if output.String() != "abcdef" {
		t.Fatalf("output = %q, want abcdef", output.String())
	}
	if len(seen) == 0 || seen[len(seen)-1] != 6 {
		t.Fatalf("progress = %v, want final 6", seen)
	}
}

func TestGitHubRESTReleaseClientPaginatesReleases(t *testing.T) {
	pageCalls := []string{}
	pageOne := make([]githubReleasePayload, 0, githubReleaseAPIPerPage)
	for idx := 0; idx < githubReleaseAPIPerPage; idx++ {
		pageOne = append(pageOne, githubReleasePayload{
			TagName:     fmt.Sprintf("rust-v0.131.0-alpha.%d", idx+1),
			Name:        fmt.Sprintf("rust-v0.131.0-alpha.%d", idx+1),
			HTMLURL:     fmt.Sprintf("https://github.com/openai/codex/releases/tag/rust-v0.131.0-alpha.%d", idx+1),
			PublishedAt: "2026-05-13T00:00:00Z",
			Prerelease:  true,
			Assets: []githubReleaseAssetPayload{{
				Name:               "codex-aarch64-apple-darwin.tar.gz",
				BrowserDownloadURL: "https://example.com/codex-alpha.tar.gz",
			}},
		})
	}
	client := NewGitHubRESTReleaseClient(&http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			if req.URL.Host != "api.github.com" {
				t.Fatalf("unexpected request: %s", req.URL.String())
			}
			page := req.URL.Query().Get("page")
			pageCalls = append(pageCalls, page)
			switch page {
			case "1":
				return stringResponse(http.StatusOK, githubReleaseJSON(t, pageOne)), nil
			case "2":
				return stringResponse(http.StatusOK, githubReleaseJSON(t, []githubReleasePayload{
					{
						TagName:     "rust-v0.130.0",
						Name:        "rust-v0.130.0",
						HTMLURL:     "https://github.com/openai/codex/releases/tag/rust-v0.130.0",
						PublishedAt: "2026-05-10T00:00:00Z",
						Assets: []githubReleaseAssetPayload{{
							Name:               "codex-aarch64-apple-darwin.tar.gz",
							BrowserDownloadURL: "https://example.com/codex-stable.tar.gz",
						}},
					},
				})), nil
			default:
				t.Fatalf("unexpected page %q", page)
				return stringResponse(http.StatusNotFound, "not found"), nil
			}
		}),
	})

	releases, err := client.ListReleases(context.Background(), Source{
		Repo:      "openai/codex",
		TagPrefix: "rust-v",
	})
	if err != nil {
		t.Fatalf("ListReleases() error = %v", err)
	}
	if strings.Join(pageCalls, ",") != "1,2" {
		t.Fatalf("page calls = %v, want [1 2]", pageCalls)
	}
	if !containsRelease(releases, "rust-v0.130.0", false) {
		t.Fatalf("releases missing page 2 stable: %#v", releases)
	}
	if !containsRelease(releases, "rust-v0.131.0-alpha.1", true) {
		t.Fatalf("releases missing page 1 alpha: %#v", releases)
	}
}

func TestGitHubReleaseFallbackSupplementsStableFromHTMLWhenAtomOnlyHasAlpha(t *testing.T) {
	client := NewGitHubRESTReleaseClient(&http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			switch {
			case req.URL.Host == "api.github.com":
				return stringResponse(http.StatusForbidden, "rate limited"), nil
			case req.URL.Host == "github.com" && req.URL.Path == "/openai/codex/releases.atom":
				return stringResponse(http.StatusOK, `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>tag:github.com,2008:Repository/1/rust-v0.131.0-alpha.9</id>
    <updated>2026-05-12T00:00:00Z</updated>
    <title>rust-v0.131.0-alpha.9</title>
    <link rel="alternate" href="https://github.com/openai/codex/releases/tag/rust-v0.131.0-alpha.9"/>
    <content type="html">&lt;p&gt;alpha&lt;/p&gt;</content>
  </entry>
</feed>`), nil
			case req.URL.Host == "github.com" && req.URL.Path == "/openai/codex/releases" && req.URL.Query().Get("page") == "1":
				return stringResponse(http.StatusOK, `<a href="/openai/codex/releases/tag/rust-v0.131.0-alpha.9">alpha</a>`), nil
			case req.URL.Host == "github.com" && req.URL.Path == "/openai/codex/releases" && req.URL.Query().Get("page") == "2":
				return stringResponse(http.StatusOK, `<a href="/openai/codex/releases/tag/rust-v0.130.0">stable</a>`), nil
			case req.URL.Host == "github.com" && req.URL.Path == "/openai/codex/releases" && req.URL.Query().Get("page") == "3":
				return stringResponse(http.StatusOK, ``), nil
			default:
				t.Fatalf("unexpected request: %s", req.URL.String())
				return stringResponse(http.StatusNotFound, "not found"), nil
			}
		}),
	})

	releases, err := client.ListReleases(context.Background(), Source{
		Repo:      "openai/codex",
		TagPrefix: "rust-v",
	})
	if err != nil {
		t.Fatalf("ListReleases() error = %v", err)
	}
	if !containsRelease(releases, "rust-v0.131.0-alpha.9", true) {
		t.Fatalf("releases = %#v, want alpha from atom", releases)
	}
	if !containsRelease(releases, "rust-v0.130.0", false) {
		t.Fatalf("releases = %#v, want stable from html fallback", releases)
	}
}

func TestGitHubReleaseFallbackPaginatesHTMLHistory(t *testing.T) {
	client := NewGitHubRESTReleaseClient(&http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			switch {
			case req.URL.Host == "api.github.com":
				return stringResponse(http.StatusForbidden, "rate limited"), nil
			case req.URL.Host == "github.com" && req.URL.Path == "/openai/codex/releases.atom":
				return stringResponse(http.StatusOK, `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>`), nil
			case req.URL.Host == "github.com" && req.URL.Path == "/openai/codex/releases" && req.URL.Query().Get("page") == "1":
				return stringResponse(http.StatusOK, `<a href="/openai/codex/releases/tag/rust-v0.131.0-alpha.9">alpha</a>`), nil
			case req.URL.Host == "github.com" && req.URL.Path == "/openai/codex/releases" && req.URL.Query().Get("page") == "2":
				return stringResponse(http.StatusOK, `<a href="/openai/codex/releases/tag/rust-v0.130.0">stable</a>`), nil
			case req.URL.Host == "github.com" && req.URL.Path == "/openai/codex/releases" && req.URL.Query().Get("page") == "3":
				return stringResponse(http.StatusOK, `<a href="/openai/codex/releases/tag/rust-v0.129.0">older stable</a>`), nil
			case req.URL.Host == "github.com" && req.URL.Path == "/openai/codex/releases" && req.URL.Query().Get("page") == "4":
				return stringResponse(http.StatusOK, ``), nil
			default:
				t.Fatalf("unexpected request: %s", req.URL.String())
				return stringResponse(http.StatusNotFound, "not found"), nil
			}
		}),
	})

	releases, err := client.ListReleases(context.Background(), Source{
		Repo:      "openai/codex",
		TagPrefix: "rust-v",
	})
	if err != nil {
		t.Fatalf("ListReleases() error = %v", err)
	}
	if !containsRelease(releases, "rust-v0.130.0", false) {
		t.Fatalf("releases = %#v, want page 2 stable", releases)
	}
	if !containsRelease(releases, "rust-v0.129.0", false) {
		t.Fatalf("releases = %#v, want page 3 stable", releases)
	}
}

func TestGitHubReleaseFallbackDoesNotMarkRustStableAtomTagAsPrerelease(t *testing.T) {
	client := NewGitHubRESTReleaseClient(&http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			switch {
			case req.URL.Host == "api.github.com":
				return stringResponse(http.StatusForbidden, "rate limited"), nil
			case req.URL.Host == "github.com" && req.URL.Path == "/openai/codex/releases.atom":
				return stringResponse(http.StatusOK, `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>tag:github.com,2008:Repository/1/rust-v0.129.0</id>
    <updated>2026-05-10T00:00:00Z</updated>
    <title>rust-v0.129.0</title>
    <link rel="alternate" href="https://github.com/openai/codex/releases/tag/rust-v0.129.0"/>
    <content type="html">&lt;p&gt;stable&lt;/p&gt;</content>
  </entry>
</feed>`), nil
			default:
				t.Fatalf("unexpected request: %s", req.URL.String())
				return stringResponse(http.StatusNotFound, "not found"), nil
			}
		}),
	})

	releases, err := client.ListReleases(context.Background(), Source{
		Repo:      "openai/codex",
		TagPrefix: "rust-v",
	})
	if err != nil {
		t.Fatalf("ListReleases() error = %v", err)
	}
	if !containsRelease(releases, "rust-v0.129.0", false) {
		t.Fatalf("releases = %#v, want stable atom tag not marked prerelease", releases)
	}
}

func TestReleasesFromGitHubHTMLFiltersCodexRustSemverTags(t *testing.T) {
	releases := releasesFromGitHubHTML(`
<a href="/openai/codex/releases/tag/rust-v0.130.0">stable</a>
<a href="/openai/codex/releases/tag/rust-v0.131.0-alpha.9">alpha</a>
<a href="/openai/codex/releases/tag/npm-v0.130.0">npm</a>
<a href="/openai/codex/releases/tag/rust-vnot-semver">bad</a>
<a href="/other/repo/releases/tag/rust-v0.999.0">other repo</a>
`, "openai", "codex", "rust-v")

	if len(releases) != 2 {
		t.Fatalf("len(releases) = %d, want 2: %#v", len(releases), releases)
	}
	if !containsRelease(releases, "rust-v0.130.0", false) {
		t.Fatalf("releases = %#v, want stable", releases)
	}
	if !containsRelease(releases, "rust-v0.131.0-alpha.9", true) {
		t.Fatalf("releases = %#v, want alpha", releases)
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

func TestManagedPathSnapshotUsesProfileBlockAfterAppRestart(t *testing.T) {
	root := t.TempDir()
	profilePath := filepath.Join(root, ".zshrc")
	service := NewService(ServiceOptions{
		RootDir:          filepath.Join(root, "codex"),
		Now:              fixedNow,
		ShellProfilePath: profilePath,
	})
	t.Setenv("PATH", "/usr/bin:/bin")
	if _, err := service.EnableManagedPath(); err != nil {
		t.Fatalf("EnableManagedPath() error = %v", err)
	}

	t.Setenv("PATH", "/usr/bin:/bin")
	restarted := NewService(ServiceOptions{
		RootDir:          filepath.Join(root, "codex"),
		Now:              fixedNow,
		ShellProfilePath: profilePath,
	})
	snapshot, err := restarted.Snapshot()
	if err != nil {
		t.Fatalf("Snapshot() error = %v", err)
	}
	if !snapshot.ManagedConfig.IsPathConfigured {
		t.Fatalf("IsPathConfigured = false after restart, want true from managed profile block")
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

func TestBuildRowsMarksPrereleaseVersions(t *testing.T) {
	rows := buildRows(
		[]VersionView{
			{
				ID:              "stable",
				DetectedVersion: "0.120.0",
				ReleaseTag:      "rust-v0.120.0",
				SourceID:        "openai-codex-github",
				InstalledAt:     "2026-05-12T00:00:00Z",
			},
		},
		[]RemoteVersionView{
			{
				SourceID:     "openai-codex-github",
				Version:      "0.131.0-alpha.9",
				Tag:          "rust-v0.131.0-alpha.9",
				HTMLURL:      "https://github.com/openai/codex/releases/tag/rust-v0.131.0-alpha.9",
				AssetSize:    18400000,
				PublishedAt:  "2026-05-12T01:00:00Z",
				IsPrerelease: true,
			},
		},
		nil,
		"",
	)
	alpha := findRowByVersion(rows, "0.131.0-alpha.9")
	if alpha == nil || !alpha.IsPrerelease {
		t.Fatalf("alpha row = %#v, want prerelease", alpha)
	}
	if alpha.HTMLURL != "https://github.com/openai/codex/releases/tag/rust-v0.131.0-alpha.9" {
		t.Fatalf("alpha HTMLURL = %q, want release page", alpha.HTMLURL)
	}
	if alpha.AssetSize != 18400000 {
		t.Fatalf("alpha AssetSize = %d, want 18400000", alpha.AssetSize)
	}
	stable := findRowByVersion(rows, "0.120.0")
	if stable == nil || stable.IsPrerelease {
		t.Fatalf("stable row = %#v, want non-prerelease", stable)
	}
}

func findRowByVersion(rows []VersionRowView, version string) *VersionRowView {
	for idx := range rows {
		if rows[idx].Version == version {
			return &rows[idx]
		}
	}
	return nil
}

func containsRelease(releases []GitHubRelease, tag string, prerelease bool) bool {
	for _, release := range releases {
		if release.TagName == tag && release.Prerelease == prerelease {
			return true
		}
	}
	return false
}

func containsRemoteVersion(remotes []RemoteVersionView, version string, prerelease bool) bool {
	for _, remote := range remotes {
		if remote.Version == version && remote.IsPrerelease == prerelease {
			return true
		}
	}
	return false
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
	return codexTarGzNamed(t, "codex", versionOutput)
}

func codexTarGzNamed(t *testing.T, name string, versionOutput string) []byte {
	t.Helper()
	var buffer bytes.Buffer
	gzipWriter := gzip.NewWriter(&buffer)
	tarWriter := tar.NewWriter(gzipWriter)
	content := []byte("#!/bin/sh\nif [ \"$1\" = \"--version\" ]; then echo \"" + versionOutput + "\"; exit 0; fi\necho ok\n")
	if err := tarWriter.WriteHeader(&tar.Header{
		Name: name,
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

type roundTripFunc func(req *http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func stringResponse(status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

func githubReleaseJSON(t *testing.T, payload []githubReleasePayload) string {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal github release payload: %v", err)
	}
	return string(body)
}
