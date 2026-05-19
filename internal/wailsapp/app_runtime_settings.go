package wailsapp

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

const (
	appRuntimeSettingsDirName  = "app-runtime"
	appRuntimeSettingsFileName = "settings.json"

	AppCloseActionQuitAppAndService    = "quit_app_and_service"
	AppCloseActionKeepServiceInMenuBar = "keep_service_in_menu_bar"

	gettokensLaunchAgentLabel = "com.linhay.gettokens.login"
	gettokensLoginItemArg     = "--gettokens-login-item"
)

func defaultAppRuntimeSettings() AppRuntimeSettings {
	return AppRuntimeSettings{
		CloseAction: AppCloseActionQuitAppAndService,
	}
}

func normalizeAppRuntimeSettings(settings *AppRuntimeSettings) AppRuntimeSettings {
	if settings == nil {
		return defaultAppRuntimeSettings()
	}
	normalized := AppRuntimeSettings{
		LaunchAtLogin: settings.LaunchAtLogin,
		CloseAction:   normalizeAppCloseAction(settings.CloseAction),
	}
	normalized.MenuBarResident = normalized.CloseAction == AppCloseActionKeepServiceInMenuBar
	return normalized
}

func normalizeAppCloseAction(value string) string {
	switch value {
	case AppCloseActionQuitAppAndService, AppCloseActionKeepServiceInMenuBar:
		return value
	default:
		return AppCloseActionQuitAppAndService
	}
}

func appRuntimeSettingsDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".config", "gettokens-data", appRuntimeSettingsDirName)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}
	return dir, nil
}

func appRuntimeSettingsPath() (string, error) {
	dir, err := appRuntimeSettingsDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, appRuntimeSettingsFileName), nil
}

func loadAppRuntimeSettings() (AppRuntimeSettings, error) {
	path, err := appRuntimeSettingsPath()
	if err != nil {
		return AppRuntimeSettings{}, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			settings := defaultAppRuntimeSettings()
			enrichAppRuntimeSettings(&settings, path)
			return settings, nil
		}
		return AppRuntimeSettings{}, err
	}
	var settings AppRuntimeSettings
	if err := json.Unmarshal(data, &settings); err != nil {
		return AppRuntimeSettings{}, err
	}
	normalized := normalizeAppRuntimeSettings(&settings)
	enrichAppRuntimeSettings(&normalized, path)
	return normalized, nil
}

func saveAppRuntimeSettings(settings AppRuntimeSettings) (AppRuntimeSettings, error) {
	normalized := normalizeAppRuntimeSettings(&settings)
	if err := syncLaunchAtLogin(normalized.LaunchAtLogin); err != nil {
		return AppRuntimeSettings{}, err
	}
	path, err := appRuntimeSettingsPath()
	if err != nil {
		return AppRuntimeSettings{}, err
	}
	data, err := json.MarshalIndent(normalized, "", "  ")
	if err != nil {
		return AppRuntimeSettings{}, err
	}
	if err := os.WriteFile(path, data, 0600); err != nil {
		return AppRuntimeSettings{}, err
	}
	enrichAppRuntimeSettings(&normalized, path)
	return normalized, nil
}

func enrichAppRuntimeSettings(settings *AppRuntimeSettings, configPath string) {
	settings.ConfigPath = configPath
	settings.MenuBarResident = settings.CloseAction == AppCloseActionKeepServiceInMenuBar
	settings.LaunchAtLoginSupported = launchAtLoginSupported()
	settings.LaunchAgentPath = launchAgentPath()
	if enabled, err := launchAtLoginEnabled(); err == nil {
		settings.LaunchAtLogin = enabled
	}
}

func (a *App) GetAppRuntimeSettings() (*AppRuntimeSettings, error) {
	settings, err := loadAppRuntimeSettings()
	if err != nil {
		return nil, err
	}
	return &settings, nil
}

func (a *App) UpdateAppRuntimeSettings(input AppRuntimeSettings) (*AppRuntimeSettings, error) {
	settings, err := saveAppRuntimeSettings(input)
	if err != nil {
		return nil, err
	}
	a.applyMenuBarResident(settings)
	return &settings, nil
}

func (a *App) shouldPreventCloseForRuntimeSettings(settings AppRuntimeSettings) bool {
	return normalizeAppRuntimeSettings(&settings).CloseAction == AppCloseActionKeepServiceInMenuBar
}

func launchAtLoginSupported() bool {
	if runtime.GOOS != "darwin" {
		return false
	}
	_, err := resolveLoginItemAppPath()
	return err == nil
}

func syncLaunchAtLogin(enabled bool) error {
	if runtime.GOOS != "darwin" {
		if enabled {
			return fmt.Errorf("launch at login is only supported on macOS")
		}
		return nil
	}
	if enabled {
		appPath, err := resolveLoginItemAppPath()
		if err != nil {
			return err
		}
		return writeLaunchAgent(appPath)
	}
	path := launchAgentPath()
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func launchAtLoginEnabled() (bool, error) {
	if runtime.GOOS != "darwin" {
		return false, nil
	}
	_, err := os.Stat(launchAgentPath())
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func launchAgentPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, "Library", "LaunchAgents", gettokensLaunchAgentLabel+".plist")
}

func writeLaunchAgent(appPath string) error {
	path := launchAgentPath()
	if path == "" {
		return fmt.Errorf("cannot resolve user LaunchAgents directory")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	body, err := buildLaunchAgentPlist(appPath)
	if err != nil {
		return err
	}
	return os.WriteFile(path, body, 0600)
}

func resolveLoginItemAppPath() (string, error) {
	if override := strings.TrimSpace(os.Getenv("GETTOKENS_LOGIN_ITEM_APP_PATH")); override != "" {
		return override, nil
	}
	executable, err := os.Executable()
	if err != nil {
		return "", err
	}
	dir := filepath.Clean(executable)
	for {
		if strings.HasSuffix(dir, ".app") {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return "", fmt.Errorf("cannot locate packaged GetTokens.app for launch at login")
}

func buildLaunchAgentPlist(appPath string) ([]byte, error) {
	escapedAppPath := strings.NewReplacer(
		"&", "&amp;",
		"<", "&lt;",
		">", "&gt;",
		`"`, "&quot;",
		"'", "&apos;",
	).Replace(appPath)
	body := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>%s</string>
    <key>ProgramArguments</key>
    <array>
      <string>/usr/bin/open</string>
      <string>%s</string>
      <string>--args</string>
      <string>%s</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
  </dict>
</plist>
`, gettokensLaunchAgentLabel, escapedAppPath, gettokensLoginItemArg)
	return []byte(body), nil
}
