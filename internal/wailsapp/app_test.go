package wailsapp

import "testing"

func TestParseDarwinProductMajorVersion(t *testing.T) {
	tests := []struct {
		name    string
		version string
		want    int
		wantErr bool
	}{
		{
			name:    "major minor",
			version: "26.4",
			want:    26,
		},
		{
			name:    "major only",
			version: "15",
			want:    15,
		},
		{
			name:    "trim spaces",
			version: " 14.7.1 \n",
			want:    14,
		},
		{
			name:    "invalid version",
			version: "sonoma",
			wantErr: true,
		},
		{
			name:    "empty version",
			version: "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseDarwinProductMajorVersion(tt.version)
			if tt.wantErr {
				if err == nil {
					t.Fatal("parseDarwinProductMajorVersion() expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("parseDarwinProductMajorVersion() error = %v", err)
			}
			if got != tt.want {
				t.Fatalf("parseDarwinProductMajorVersion() = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestShouldUseNativeUpdaterUI(t *testing.T) {
	tests := []struct {
		name                 string
		goos                 string
		sparkleAvailable     bool
		darwinProductVersion string
		want                 bool
	}{
		{
			name:                 "sparkle disabled",
			goos:                 "darwin",
			sparkleAvailable:     false,
			darwinProductVersion: "15.5",
			want:                 false,
		},
		{
			name:                 "non darwin",
			goos:                 "linux",
			sparkleAvailable:     true,
			darwinProductVersion: "26.4",
			want:                 false,
		},
		{
			name:                 "darwin before cutoff",
			goos:                 "darwin",
			sparkleAvailable:     true,
			darwinProductVersion: "15.5",
			want:                 true,
		},
		{
			name:                 "darwin at cutoff",
			goos:                 "darwin",
			sparkleAvailable:     true,
			darwinProductVersion: "26.0",
			want:                 false,
		},
		{
			name:                 "darwin after cutoff",
			goos:                 "darwin",
			sparkleAvailable:     true,
			darwinProductVersion: "26.4",
			want:                 false,
		},
		{
			name:                 "invalid darwin version",
			goos:                 "darwin",
			sparkleAvailable:     true,
			darwinProductVersion: "sonoma",
			want:                 false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := shouldUseNativeUpdaterUI(tt.goos, tt.sparkleAvailable, tt.darwinProductVersion); got != tt.want {
				t.Fatalf("shouldUseNativeUpdaterUI(%q, %v, %q) = %v, want %v", tt.goos, tt.sparkleAvailable, tt.darwinProductVersion, got, tt.want)
			}
		})
	}
}

func TestAppUpdateCapabilitiesRespectNativeUpdaterMode(t *testing.T) {
	originalUsesNativeUpdaterUI := usesNativeUpdaterUIFunc
	originalSupportsInPlaceApply := supportsInPlaceApplyFunc
	t.Cleanup(func() {
		usesNativeUpdaterUIFunc = originalUsesNativeUpdaterUI
		supportsInPlaceApplyFunc = originalSupportsInPlaceApply
	})

	app := New("v1.2.1", "1.2.1", "AxApp/GetTokens")

	usesNativeUpdaterUIFunc = func() bool { return true }
	if !app.CanApplyUpdate() {
		t.Fatal("CanApplyUpdate() = false, want true when native updater is enabled")
	}
	if !app.UsesNativeUpdaterUI() {
		t.Fatal("UsesNativeUpdaterUI() = false, want true when native updater is enabled")
	}

	usesNativeUpdaterUIFunc = func() bool { return false }
	supportsInPlaceApplyFunc = func() bool { return false }
	if app.CanApplyUpdate() {
		t.Fatal("CanApplyUpdate() = true, want false when native updater is disabled on darwin")
	}
	if app.UsesNativeUpdaterUI() {
		t.Fatal("UsesNativeUpdaterUI() = true, want false when native updater is disabled")
	}
}
