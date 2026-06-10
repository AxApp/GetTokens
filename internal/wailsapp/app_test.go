package wailsapp

import "testing"

func TestShouldUseNativeUpdaterUI(t *testing.T) {
	tests := []struct {
		name             string
		goos             string
		sparkleAvailable bool
		want             bool
	}{
		{
			name:             "sparkle disabled",
			goos:             "darwin",
			sparkleAvailable: false,
			want:             false,
		},
		{
			name:             "non darwin",
			goos:             "linux",
			sparkleAvailable: true,
			want:             false,
		},
		{
			name:             "darwin sparkle available",
			goos:             "darwin",
			sparkleAvailable: true,
			want:             true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := shouldUseNativeUpdaterUI(tt.goos, tt.sparkleAvailable); got != tt.want {
				t.Fatalf("shouldUseNativeUpdaterUI(%q, %v) = %v, want %v", tt.goos, tt.sparkleAvailable, got, tt.want)
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
