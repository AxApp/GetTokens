package wailsapp

import (
	"testing"
	"time"
)

func TestNormalizeLocalProjectedUsageRefreshIntervalMinutes(t *testing.T) {
	testCases := []struct {
		name  string
		input int
		want  int
	}{
		{name: "five minutes", input: 5, want: 5},
		{name: "fifteen minutes", input: 15, want: 15},
		{name: "thirty minutes", input: 30, want: 30},
		{name: "sixty minutes", input: 60, want: 60},
		{name: "invalid uses default", input: 9, want: defaultLocalProjectedUsageRefreshIntervalMinutes},
		{name: "zero uses default", input: 0, want: defaultLocalProjectedUsageRefreshIntervalMinutes},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			got := normalizeLocalProjectedUsageRefreshIntervalMinutes(testCase.input)
			if got != testCase.want {
				t.Fatalf("normalizeLocalProjectedUsageRefreshIntervalMinutes(%d) = %d, want %d", testCase.input, got, testCase.want)
			}
		})
	}
}

func TestLocalProjectedUsageSettingsRoundTrip(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	app := &App{}
	updated, err := app.UpdateLocalProjectedUsageSettings(LocalProjectedUsageSettings{RefreshIntervalMinutes: 30})
	if err != nil {
		t.Fatalf("UpdateLocalProjectedUsageSettings returned error: %v", err)
	}
	if updated.RefreshIntervalMinutes != 30 {
		t.Fatalf("updated refresh interval = %d, want 30", updated.RefreshIntervalMinutes)
	}

	loaded, err := app.GetLocalProjectedUsageSettings()
	if err != nil {
		t.Fatalf("GetLocalProjectedUsageSettings returned error: %v", err)
	}
	if loaded.RefreshIntervalMinutes != 30 {
		t.Fatalf("loaded refresh interval = %d, want 30", loaded.RefreshIntervalMinutes)
	}
}

func TestShouldRunScheduledLocalUsageRefreshHonorsConfiguredInterval(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	app := &App{}
	if _, err := app.UpdateLocalProjectedUsageSettings(LocalProjectedUsageSettings{RefreshIntervalMinutes: 15}); err != nil {
		t.Fatalf("UpdateLocalProjectedUsageSettings returned error: %v", err)
	}

	now := time.Now()
	app.localUsage.cachedResponse = &LocalProjectedUsageResponse{Provider: localProjectedProvider}
	app.localUsage.lastRefreshAt = now.Add(-16 * time.Minute)
	if !app.shouldRunScheduledLocalUsageRefresh(now) {
		t.Fatalf("shouldRunScheduledLocalUsageRefresh() = false, want true after interval elapsed")
	}

	app.localUsage.lastRefreshAt = now.Add(-10 * time.Minute)
	if app.shouldRunScheduledLocalUsageRefresh(now) {
		t.Fatalf("shouldRunScheduledLocalUsageRefresh() = true, want false before interval elapsed")
	}
}
