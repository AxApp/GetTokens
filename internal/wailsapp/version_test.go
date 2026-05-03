package wailsapp

import "testing"

func TestGetReleaseLabel(t *testing.T) {
	app := New("v0.1.0", "2026.04.06.11", "linhay/GetTokens")

	if got := app.GetVersion(); got != "v0.1.0" {
		t.Fatalf("GetVersion() = %q, want %q", got, "v0.1.0")
	}

	if got := app.GetReleaseLabel(); got != "2026.04.06.11" {
		t.Fatalf("GetReleaseLabel() = %q, want %q", got, "2026.04.06.11")
	}
}
