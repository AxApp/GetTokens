package wailsapp

import (
	"encoding/json"
	"os"
	"path/filepath"
)

const (
	localProjectedUsageSettingsDirName               = "usage-desk"
	localProjectedUsageSettingsFileName              = "settings.json"
	defaultLocalProjectedUsageRefreshIntervalMinutes = 15
)

var supportedLocalProjectedUsageRefreshIntervals = map[int]struct{}{
	5:  {},
	15: {},
	30: {},
	60: {},
}

func defaultLocalProjectedUsageSettings() LocalProjectedUsageSettings {
	return LocalProjectedUsageSettings{
		RefreshIntervalMinutes: defaultLocalProjectedUsageRefreshIntervalMinutes,
	}
}

func normalizeLocalProjectedUsageRefreshIntervalMinutes(value int) int {
	if _, ok := supportedLocalProjectedUsageRefreshIntervals[value]; ok {
		return value
	}
	return defaultLocalProjectedUsageRefreshIntervalMinutes
}

func normalizeLocalProjectedUsageSettings(settings *LocalProjectedUsageSettings) LocalProjectedUsageSettings {
	if settings == nil {
		return defaultLocalProjectedUsageSettings()
	}
	return LocalProjectedUsageSettings{
		RefreshIntervalMinutes: normalizeLocalProjectedUsageRefreshIntervalMinutes(settings.RefreshIntervalMinutes),
	}
}

func localProjectedUsageSettingsDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".config", "gettokens-data", localProjectedUsageSettingsDirName)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}
	return dir, nil
}

func localProjectedUsageSettingsPath() (string, error) {
	dir, err := localProjectedUsageSettingsDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, localProjectedUsageSettingsFileName), nil
}

func loadLocalProjectedUsageSettings() (LocalProjectedUsageSettings, error) {
	path, err := localProjectedUsageSettingsPath()
	if err != nil {
		return LocalProjectedUsageSettings{}, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return defaultLocalProjectedUsageSettings(), nil
		}
		return LocalProjectedUsageSettings{}, err
	}
	var settings LocalProjectedUsageSettings
	if err := json.Unmarshal(data, &settings); err != nil {
		return LocalProjectedUsageSettings{}, err
	}
	return normalizeLocalProjectedUsageSettings(&settings), nil
}

func saveLocalProjectedUsageSettings(settings LocalProjectedUsageSettings) (LocalProjectedUsageSettings, error) {
	normalized := normalizeLocalProjectedUsageSettings(&settings)
	path, err := localProjectedUsageSettingsPath()
	if err != nil {
		return LocalProjectedUsageSettings{}, err
	}
	data, err := json.MarshalIndent(normalized, "", "  ")
	if err != nil {
		return LocalProjectedUsageSettings{}, err
	}
	if err := os.WriteFile(path, data, 0600); err != nil {
		return LocalProjectedUsageSettings{}, err
	}
	return normalized, nil
}

func (a *App) GetLocalProjectedUsageSettings() (*LocalProjectedUsageSettings, error) {
	settings, err := loadLocalProjectedUsageSettings()
	if err != nil {
		return nil, err
	}
	return &settings, nil
}

func (a *App) UpdateLocalProjectedUsageSettings(input LocalProjectedUsageSettings) (*LocalProjectedUsageSettings, error) {
	settings, err := saveLocalProjectedUsageSettings(input)
	if err != nil {
		return nil, err
	}
	return &settings, nil
}
