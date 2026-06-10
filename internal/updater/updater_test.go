package updater

import (
	"context"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/creativeprojects/go-selfupdate"
)

func TestUpdaterConfigSupportsChecksums(t *testing.T) {
	config := updaterConfigFor("linux", "amd64")

	validator, ok := config.Validator.(*selfupdate.ChecksumValidator)
	if !ok {
		t.Fatal("validator is not ChecksumValidator")
	}

	if validator.UniqueFilename != "checksums.txt" {
		t.Fatalf("validator.UniqueFilename = %q, want %q", validator.UniqueFilename, "checksums.txt")
	}

	if config.UniversalArch != "" {
		t.Fatalf("config.UniversalArch = %q, want empty string", config.UniversalArch)
	}
}

func TestUpdaterAssetFilters(t *testing.T) {
	tests := []struct {
		name   string
		goos   string
		goarch string
		want   []string
	}{
		{
			name:   "darwin arm64",
			goos:   "darwin",
			goarch: "arm64",
			want: []string{
				`(^|/)gettokens_macos_applesilicon\.tar\.gz$`,
				`(^|/)gettokens_darwin_arm64\.tar\.gz$`,
			},
		},
		{
			name:   "darwin amd64",
			goos:   "darwin",
			goarch: "amd64",
			want: []string{
				`(^|/)gettokens_macos_intel\.tar\.gz$`,
				`(^|/)gettokens_darwin_amd64\.tar\.gz$`,
			},
		},
		{name: "linux unchanged", goos: "linux", goarch: "amd64", want: nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := updaterAssetFilters(tt.goos, tt.goarch)
			if strings.Join(got, "\n") != strings.Join(tt.want, "\n") {
				t.Fatalf("updaterAssetFilters(%q, %q) = %#v, want %#v", tt.goos, tt.goarch, got, tt.want)
			}
		})
	}
}

func TestDarwinUpdaterConfigDetectsFriendlyAndCompatibilityAssetNames(t *testing.T) {
	tests := []struct {
		name      string
		goarch    string
		assetName string
	}{
		{name: "apple silicon friendly asset", goarch: "arm64", assetName: "GetTokens_macOS_AppleSilicon.tar.gz"},
		{name: "apple silicon compatibility asset", goarch: "arm64", assetName: "GetTokens_darwin_arm64.tar.gz"},
		{name: "intel friendly asset", goarch: "amd64", assetName: "GetTokens_macOS_Intel.tar.gz"},
		{name: "intel compatibility asset", goarch: "amd64", assetName: "GetTokens_darwin_amd64.tar.gz"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := updaterConfigFor("darwin", tt.goarch)
			config.Source = fakeSelfUpdateSource{
				releases: []selfupdate.SourceRelease{
					fakeSelfUpdateRelease{
						tagName: "v1.2.3",
						name:    "v1.2.3",
						url:     "https://github.com/AxApp/GetTokens/releases/tag/v1.2.3",
						assets: []selfupdate.SourceAsset{
							fakeSelfUpdateAsset{id: 1, name: tt.assetName, url: "https://example.com/" + tt.assetName},
							fakeSelfUpdateAsset{id: 2, name: "checksums.txt", url: "https://example.com/checksums.txt"},
						},
					},
				},
			}

			up, err := selfupdate.NewUpdater(config)
			if err != nil {
				t.Fatalf("NewUpdater() error = %v", err)
			}

			release, found, err := up.DetectLatest(context.Background(), selfupdate.ParseSlug("AxApp/GetTokens"))
			if err != nil {
				t.Fatalf("DetectLatest() error = %v", err)
			}
			if !found {
				t.Fatal("DetectLatest() found = false, want true")
			}
			if release.AssetName != tt.assetName {
				t.Fatalf("release.AssetName = %q, want %q", release.AssetName, tt.assetName)
			}
		})
	}
}

type fakeSelfUpdateSource struct {
	releases []selfupdate.SourceRelease
}

func (s fakeSelfUpdateSource) ListReleases(context.Context, selfupdate.Repository) ([]selfupdate.SourceRelease, error) {
	return s.releases, nil
}

func (s fakeSelfUpdateSource) DownloadReleaseAsset(context.Context, *selfupdate.Release, int64) (io.ReadCloser, error) {
	return io.NopCloser(strings.NewReader("")), nil
}

type fakeSelfUpdateRelease struct {
	id      int64
	tagName string
	draft   bool
	pre     bool
	name    string
	url     string
	assets  []selfupdate.SourceAsset
}

func (r fakeSelfUpdateRelease) GetID() int64                        { return r.id }
func (r fakeSelfUpdateRelease) GetTagName() string                  { return r.tagName }
func (r fakeSelfUpdateRelease) GetDraft() bool                      { return r.draft }
func (r fakeSelfUpdateRelease) GetPrerelease() bool                 { return r.pre }
func (r fakeSelfUpdateRelease) GetPublishedAt() time.Time           { return time.Time{} }
func (r fakeSelfUpdateRelease) GetReleaseNotes() string             { return "" }
func (r fakeSelfUpdateRelease) GetName() string                     { return r.name }
func (r fakeSelfUpdateRelease) GetURL() string                      { return r.url }
func (r fakeSelfUpdateRelease) GetAssets() []selfupdate.SourceAsset { return r.assets }

type fakeSelfUpdateAsset struct {
	id   int64
	name string
	size int
	url  string
}

func (a fakeSelfUpdateAsset) GetID() int64                  { return a.id }
func (a fakeSelfUpdateAsset) GetName() string               { return a.name }
func (a fakeSelfUpdateAsset) GetSize() int                  { return a.size }
func (a fakeSelfUpdateAsset) GetBrowserDownloadURL() string { return a.url }

func TestNewSelfUpdater(t *testing.T) {
	updater, err := newSelfUpdater()
	if err != nil {
		t.Fatalf("newSelfUpdater() error = %v", err)
	}
	if updater == nil {
		t.Fatal("newSelfUpdater() returned nil updater")
	}
}

func TestHasNewerVersion(t *testing.T) {
	tests := []struct {
		name    string
		current string
		latest  string
		want    bool
		wantErr bool
	}{
		{
			name:    "newer release",
			current: "v0.1.0",
			latest:  "v0.2.0",
			want:    true,
		},
		{
			name:    "same release",
			current: "v0.2.0",
			latest:  "v0.2.0",
			want:    false,
		},
		{
			name:    "older release",
			current: "v0.2.0",
			latest:  "v0.1.0",
			want:    false,
		},
		{
			name:    "invalid current version",
			current: "dev",
			latest:  "v0.1.0",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := hasNewerVersion(tt.current, tt.latest)
			if tt.wantErr {
				if err == nil {
					t.Fatal("hasNewerVersion() expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("hasNewerVersion() error = %v", err)
			}
			if got != tt.want {
				t.Fatalf("hasNewerVersion() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestSupportsInPlaceApply(t *testing.T) {
	tests := []struct {
		goos string
		want bool
	}{
		{goos: "darwin", want: false},
		{goos: "linux", want: true},
		{goos: "windows", want: true},
	}

	for _, tt := range tests {
		t.Run(tt.goos, func(t *testing.T) {
			if got := supportsInPlaceApply(tt.goos); got != tt.want {
				t.Fatalf("supportsInPlaceApply(%q) = %v, want %v", tt.goos, got, tt.want)
			}
		})
	}
}
