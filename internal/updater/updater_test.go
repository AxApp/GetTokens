package updater

import (
	"testing"

	"github.com/creativeprojects/go-selfupdate"
)

func TestUpdaterConfigSupportsChecksumsAndUniversalMacAssets(t *testing.T) {
	config := updaterConfig()

	validator, ok := config.Validator.(*selfupdate.ChecksumValidator)
	if !ok {
		t.Fatal("validator is not ChecksumValidator")
	}

	if validator.UniqueFilename != "checksums.txt" {
		t.Fatalf("validator.UniqueFilename = %q, want %q", validator.UniqueFilename, "checksums.txt")
	}

	if config.UniversalArch != "universal" {
		t.Fatalf("config.UniversalArch = %q, want %q", config.UniversalArch, "universal")
	}
}

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
