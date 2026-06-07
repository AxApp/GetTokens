package wailsapp

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestNormalizeAppRuntimeSettings(t *testing.T) {
	settings := normalizeAppRuntimeSettings(&AppRuntimeSettings{
		LaunchAtLogin: true,
		CloseAction:   "invalid",
	})

	if !settings.LaunchAtLogin {
		t.Fatal("LaunchAtLogin = false, want true")
	}
	if settings.CloseAction != AppCloseActionQuitAppAndService {
		t.Fatalf("CloseAction = %q, want %q", settings.CloseAction, AppCloseActionQuitAppAndService)
	}
	if settings.MenuBarResident {
		t.Fatal("MenuBarResident = true for quit close action")
	}
	if !settings.ShowMenuBarIcon {
		t.Fatal("ShowMenuBarIcon = false for default settings, want true")
	}
}

func TestNormalizeAppRuntimeSettingsAllowsHidingMenuBarIconWithoutResidency(t *testing.T) {
	settings := normalizeAppRuntimeSettings(&AppRuntimeSettings{
		CloseAction:        AppCloseActionQuitAppAndService,
		ShowMenuBarIcon:    false,
		ShowMenuBarIconSet: true,
	})

	if settings.ShowMenuBarIcon {
		t.Fatal("ShowMenuBarIcon = true for explicit hidden icon, want false")
	}
	if settings.MenuBarResident {
		t.Fatal("MenuBarResident = true for quit close action")
	}
}

func TestNormalizeAppRuntimeSettingsForcesMenuBarIconForResidency(t *testing.T) {
	settings := normalizeAppRuntimeSettings(&AppRuntimeSettings{
		CloseAction:        AppCloseActionKeepServiceInMenuBar,
		ShowMenuBarIcon:    false,
		ShowMenuBarIconSet: true,
	})

	if !settings.ShowMenuBarIcon {
		t.Fatal("ShowMenuBarIcon = false for menu bar residency, want true")
	}
	if !settings.MenuBarResident {
		t.Fatal("MenuBarResident = false for menu bar residency, want true")
	}
}

func TestAppRuntimeSettingsRoundTrip(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	app := New("", "", "")
	updated, err := app.UpdateAppRuntimeSettings(AppRuntimeSettings{
		LaunchAtLogin:      false,
		CloseAction:        AppCloseActionKeepServiceInMenuBar,
		ShowMenuBarIcon:    false,
		ShowMenuBarIconSet: true,
	})
	if err != nil {
		t.Fatalf("UpdateAppRuntimeSettings() error = %v", err)
	}
	if updated.CloseAction != AppCloseActionKeepServiceInMenuBar {
		t.Fatalf("updated CloseAction = %q", updated.CloseAction)
	}
	if !updated.MenuBarResident {
		t.Fatal("MenuBarResident = false, want true")
	}
	if !updated.ShowMenuBarIcon {
		t.Fatal("ShowMenuBarIcon = false for resident close action, want true")
	}

	loaded, err := app.GetAppRuntimeSettings()
	if err != nil {
		t.Fatalf("GetAppRuntimeSettings() error = %v", err)
	}
	if loaded.CloseAction != AppCloseActionKeepServiceInMenuBar {
		t.Fatalf("loaded CloseAction = %q", loaded.CloseAction)
	}
	if !loaded.MenuBarResident {
		t.Fatal("loaded MenuBarResident = false, want true")
	}
	if !loaded.ShowMenuBarIcon {
		t.Fatal("loaded ShowMenuBarIcon = false for resident close action, want true")
	}
}

func TestAppRuntimeSettingsCanPersistHiddenMenuBarIconForForegroundMode(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	app := New("", "", "")
	updated, err := app.UpdateAppRuntimeSettings(AppRuntimeSettings{
		LaunchAtLogin:      false,
		CloseAction:        AppCloseActionQuitAppAndService,
		ShowMenuBarIcon:    false,
		ShowMenuBarIconSet: true,
	})
	if err != nil {
		t.Fatalf("UpdateAppRuntimeSettings() error = %v", err)
	}
	if updated.ShowMenuBarIcon {
		t.Fatal("updated ShowMenuBarIcon = true, want false")
	}
	if updated.MenuBarResident {
		t.Fatal("updated MenuBarResident = true, want false")
	}

	loaded, err := app.GetAppRuntimeSettings()
	if err != nil {
		t.Fatalf("GetAppRuntimeSettings() error = %v", err)
	}
	if loaded.ShowMenuBarIcon {
		t.Fatal("loaded ShowMenuBarIcon = true, want false")
	}
}

func TestAppRuntimeSettingsWritesLaunchAgent(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("GETTOKENS_LOGIN_ITEM_APP_PATH", "/Applications/GetTokens.app")

	app := New("", "", "")
	enabled, err := app.UpdateAppRuntimeSettings(AppRuntimeSettings{
		LaunchAtLogin: true,
		CloseAction:   AppCloseActionQuitAppAndService,
	})
	if err != nil {
		t.Fatalf("enable launch at login: %v", err)
	}
	if !enabled.LaunchAtLogin {
		t.Fatal("LaunchAtLogin = false after enable")
	}
	if !enabled.LaunchAtLoginSupported {
		t.Fatal("LaunchAtLoginSupported = false, want true")
	}
	agentPath := filepath.Join(home, "Library", "LaunchAgents", "com.linhay.gettokens.login.plist")
	body, err := os.ReadFile(agentPath)
	if err != nil {
		t.Fatalf("ReadFile launch agent: %v", err)
	}
	if !strings.Contains(string(body), "/Applications/GetTokens.app") {
		t.Fatalf("launch agent does not reference app path:\n%s", body)
	}
	if !strings.Contains(string(body), "--gettokens-login-item") {
		t.Fatalf("launch agent missing login item arg:\n%s", body)
	}

	disabled, err := app.UpdateAppRuntimeSettings(AppRuntimeSettings{
		LaunchAtLogin: false,
		CloseAction:   AppCloseActionQuitAppAndService,
	})
	if err != nil {
		t.Fatalf("disable launch at login: %v", err)
	}
	if disabled.LaunchAtLogin {
		t.Fatal("LaunchAtLogin = true after disable")
	}
	if _, err := os.Stat(agentPath); !os.IsNotExist(err) {
		t.Fatalf("launch agent still exists, err=%v", err)
	}
}

func TestLoginItemLaunchStartHiddenFollowsCloseAction(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	if LoginItemLaunchStartHidden() {
		t.Fatal("LoginItemLaunchStartHidden() = true for default settings, want false")
	}

	app := New("", "", "")
	if _, err := app.UpdateAppRuntimeSettings(AppRuntimeSettings{
		LaunchAtLogin: false,
		CloseAction:   AppCloseActionKeepServiceInMenuBar,
	}); err != nil {
		t.Fatalf("UpdateAppRuntimeSettings() error = %v", err)
	}

	if !LoginItemLaunchStartHidden() {
		t.Fatal("LoginItemLaunchStartHidden() = false for menu bar residency, want true")
	}
}

func TestShouldPreventCloseForRuntimeSettings(t *testing.T) {
	app := New("", "", "")

	if app.shouldPreventCloseForRuntimeSettings(defaultAppRuntimeSettings()) {
		t.Fatal("shouldPreventCloseForRuntimeSettings(default) = true, want false")
	}
	if !app.shouldPreventCloseForRuntimeSettings(AppRuntimeSettings{
		CloseAction: AppCloseActionKeepServiceInMenuBar,
	}) {
		t.Fatal("shouldPreventCloseForRuntimeSettings(keep service) = false, want true")
	}
}

func TestCodexModelCatalogSyncPreferencePersistsAcrossRuntimeSettingsUpdates(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	app := New("", "", "")
	updated, err := app.SetCodexModelCatalogSyncEnabled(true)
	if err != nil {
		t.Fatalf("SetCodexModelCatalogSyncEnabled(true): %v", err)
	}
	if !updated.CodexModelCatalogSyncEnabled {
		t.Fatal("CodexModelCatalogSyncEnabled = false after enable")
	}

	if _, err := app.UpdateAppRuntimeSettings(AppRuntimeSettings{
		LaunchAtLogin: false,
		CloseAction:   AppCloseActionKeepServiceInMenuBar,
	}); err != nil {
		t.Fatalf("UpdateAppRuntimeSettings: %v", err)
	}

	loaded, err := app.GetAppRuntimeSettings()
	if err != nil {
		t.Fatalf("GetAppRuntimeSettings: %v", err)
	}
	if !loaded.CodexModelCatalogSyncEnabled {
		t.Fatal("CodexModelCatalogSyncEnabled was reset by unrelated runtime settings update")
	}
	if loaded.CloseAction != AppCloseActionKeepServiceInMenuBar {
		t.Fatalf("CloseAction = %q, want keep menu bar", loaded.CloseAction)
	}
}
