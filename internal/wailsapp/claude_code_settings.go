package wailsapp

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

var allowedSettingsPatchKeys = map[string]bool{
	"env":             true,
	"permissions":     true,
	"disableAllHooks": true,
	"outputStyle":     true,
}

func (a *App) GetClaudeCodeSettingsSnapshot() (*ClaudeCodeSettingsSnapshot, error) {
	claudeConfigDir, err := resolveClaudeConfigDirPath()
	if err != nil {
		return nil, err
	}
	projectPath, err := os.Getwd()
	if err != nil {
		projectPath = ""
	}

	layers := make([]ClaudeCodeSettingsLayer, 0, 3)
	warnings := make([]string, 0, 3)

	userLayer := readSettingsLayer(SettingsScopeUser, filepath.Join(claudeConfigDir, claudeCodeSettingsFileName))
	layers = append(layers, userLayer)
	if userLayer.ParseError != "" {
		warnings = append(warnings, fmt.Sprintf("user settings parse error: %s", userLayer.ParseError))
	}

	if projectPath != "" {
		projectLayer := readSettingsLayer(SettingsScopeProject, filepath.Join(projectPath, ".claude", claudeCodeSettingsFileName))
		layers = append(layers, projectLayer)
		if projectLayer.ParseError != "" {
			warnings = append(warnings, fmt.Sprintf("project settings parse error: %s", projectLayer.ParseError))
		}

		localLayer := readSettingsLayer(SettingsScopeLocal, filepath.Join(projectPath, ".claude", "settings.local.json"))
		layers = append(layers, localLayer)
		if localLayer.ParseError != "" {
			warnings = append(warnings, fmt.Sprintf("local settings parse error: %s", localLayer.ParseError))
		}
	}

	// Sort layers by priority: managed > local > project > user
	sort.Slice(layers, func(i, j int) bool {
		return settingsScopePriority(layers[i].Scope) < settingsScopePriority(layers[j].Scope)
	})

	return &ClaudeCodeSettingsSnapshot{
		ProjectPath: projectPath,
		Layers:      layers,
		Warnings:    warnings,
	}, nil
}

func settingsScopePriority(scope ClaudeCodeSettingsScope) int {
	switch scope {
	case SettingsScopeManaged:
		return 0
	case SettingsScopeLocal:
		return 1
	case SettingsScopeProject:
		return 2
	case SettingsScopeUser:
		return 3
	default:
		return 99
	}
}

func readSettingsLayer(scope ClaudeCodeSettingsScope, path string) ClaudeCodeSettingsLayer {
	layer := ClaudeCodeSettingsLayer{
		Scope:  scope,
		Path:   path,
		Exists: false,
	}

	body, err := readOptionalTextFile(path)
	if err != nil {
		layer.ParseError = err.Error()
		return layer
	}
	if strings.TrimSpace(body) == "" {
		return layer
	}

	layer.Exists = true
	fields, err := parseSettingsFields(body)
	if err != nil {
		layer.ParseError = err.Error()
		return layer
	}
	layer.KnownFields = fields
	return layer
}

func parseSettingsFields(body string) (*ClaudeCodeSettingsFields, error) {
	var root map[string]json.RawMessage
	if err := json.Unmarshal([]byte(body), &root); err != nil {
		return nil, fmt.Errorf("settings.json 不是有效 JSON: %w", err)
	}

	fields := &ClaudeCodeSettingsFields{}

	if rawEnv, ok := root["env"]; ok && strings.TrimSpace(string(rawEnv)) != "null" {
		var envMap map[string]string
		if err := json.Unmarshal(rawEnv, &envMap); err != nil {
			return nil, fmt.Errorf("env 字段不是有效的键值对: %w", err)
		}
		fields.Env = envMap
	}

	if rawPerms, ok := root["permissions"]; ok && strings.TrimSpace(string(rawPerms)) != "null" {
		var permsMap map[string]any
		if err := json.Unmarshal(rawPerms, &permsMap); err == nil {
			fields.Permissions = permsMap
		}
	}

	if rawHooks, ok := root["disableAllHooks"]; ok {
		var disableAllHooks bool
		if err := json.Unmarshal(rawHooks, &disableAllHooks); err == nil {
			fields.DisableAllHooks = &disableAllHooks
		}
	}

	if rawStyle, ok := root["outputStyle"]; ok && strings.TrimSpace(string(rawStyle)) != "null" {
		var style string
		if err := json.Unmarshal(rawStyle, &style); err == nil {
			fields.OutputStyle = style
		}
	}

	return fields, nil
}

func (a *App) PatchClaudeCodeSettings(input PatchClaudeCodeSettingsInput) (*PatchClaudeCodeSettingsResult, error) {
	if input.Scope == SettingsScopeManaged {
		return nil, errors.New("不允许编辑 managed policy")
	}
	if input.Scope != SettingsScopeUser && input.Scope != SettingsScopeProject && input.Scope != SettingsScopeLocal {
		return nil, fmt.Errorf("不支持的 scope: %s", input.Scope)
	}

	if err := validateSettingsPatches(input.Patches); err != nil {
		return nil, err
	}

	settingsPath, err := validateClaudeCodeSettingsPath(input.Scope, input.Path)
	if err != nil {
		return nil, err
	}

	existing, err := readOptionalTextFile(settingsPath)
	if err != nil {
		return nil, err
	}

	nextBody, original, err := applySettingsPatches(existing, input.Patches)
	if err != nil {
		return nil, err
	}

	if err := os.MkdirAll(filepath.Dir(settingsPath), 0700); err != nil {
		return nil, err
	}
	if err := writeFileAtomically(settingsPath, nextBody, 0600); err != nil {
		return nil, err
	}

	// Re-parse after save to verify
	saved := string(nextBody)
	if _, parseErr := parseSettingsFields(saved); parseErr != nil {
		return &PatchClaudeCodeSettingsResult{
			ConfigPath: settingsPath,
			Preview:    saved,
			Changes:    buildSettingsChanges(original, saved),
		}, fmt.Errorf("保存后 settings.json 无法解析: %w", parseErr)
	}

	changes := buildSettingsChanges(original, saved)
	preview := saved
	if len(preview) > 8000 {
		preview = preview[:8000] + "\n// ... (截断)"
	}

	return &PatchClaudeCodeSettingsResult{
		ConfigPath: settingsPath,
		Preview:    preview,
		Changes:    changes,
	}, nil
}

func validateClaudeCodeSettingsPath(scope ClaudeCodeSettingsScope, path string) (string, error) {
	expected, err := resolveClaudeCodeSettingsPath(scope)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(path) == "" {
		return expected, nil
	}
	absPath, err := filepath.Abs(path)
	if err != nil {
		return "", fmt.Errorf("无法解析 settings 路径: %w", err)
	}
	absExpected, err := filepath.Abs(expected)
	if err != nil {
		return "", fmt.Errorf("无法解析允许的 settings 路径: %w", err)
	}
	if filepath.Clean(absPath) != filepath.Clean(absExpected) {
		return "", fmt.Errorf("settings 路径不属于 %s scope: %s", scope, absPath)
	}
	return absExpected, nil
}

func resolveClaudeCodeSettingsPath(scope ClaudeCodeSettingsScope) (string, error) {
	switch scope {
	case SettingsScopeUser:
		claudeConfigDir, err := resolveClaudeConfigDirPath()
		if err != nil {
			return "", err
		}
		return filepath.Join(claudeConfigDir, claudeCodeSettingsFileName), nil
	case SettingsScopeProject:
		projectPath, err := os.Getwd()
		if err != nil {
			return "", err
		}
		return filepath.Join(projectPath, ".claude", claudeCodeSettingsFileName), nil
	case SettingsScopeLocal:
		projectPath, err := os.Getwd()
		if err != nil {
			return "", err
		}
		return filepath.Join(projectPath, ".claude", "settings.local.json"), nil
	default:
		return "", fmt.Errorf("不支持的 scope: %s", scope)
	}
}

func validateSettingsPatches(patches map[string]any) error {
	if len(patches) == 0 {
		return errors.New("patch 不能为空")
	}
	for key := range patches {
		if !allowedSettingsPatchKeys[key] {
			return fmt.Errorf("不允许 patch 字段: %s", key)
		}
	}
	return nil
}

func applySettingsPatches(existing string, patches map[string]any) ([]byte, string, error) {
	original := existing
	if strings.TrimSpace(existing) == "" {
		original = "{ }"
		existing = "{ }"
	}

	var root map[string]json.RawMessage
	if err := json.Unmarshal([]byte(existing), &root); err != nil {
		return nil, "", fmt.Errorf("现有 settings.json 不是有效 JSON，已停止写入以避免覆盖: %w", err)
	}

	for key, value := range patches {
		if value == nil {
			delete(root, key)
			continue
		}
		raw, err := json.Marshal(value)
		if err != nil {
			return nil, "", fmt.Errorf("序列化 patch %s 失败: %w", key, err)
		}
		root[key] = raw
	}

	body, err := json.MarshalIndent(root, "", "  ")
	if err != nil {
		return nil, "", fmt.Errorf("序列化 settings.json 失败: %w", err)
	}
	return append(body, '\n'), original, nil
}

func buildSettingsChanges(original string, saved string) []ClaudeCodeSettingsChange {
	var origRoot map[string]any
	var savedRoot map[string]any
	changes := []ClaudeCodeSettingsChange{}

	if err := json.Unmarshal([]byte(original), &origRoot); err != nil {
		origRoot = map[string]any{}
	}
	if err := json.Unmarshal([]byte(saved), &savedRoot); err != nil {
		return changes
	}

	for key, newVal := range savedRoot {
		oldVal, existed := origRoot[key]
		if !existed {
			changes = append(changes, ClaudeCodeSettingsChange{Key: key, Before: nil, After: newVal})
		} else {
			oldJSON, _ := json.Marshal(oldVal)
			newJSON, _ := json.Marshal(newVal)
			if string(oldJSON) != string(newJSON) {
				changes = append(changes, ClaudeCodeSettingsChange{Key: key, Before: oldVal, After: newVal})
			}
		}
	}

	for key := range origRoot {
		if _, ok := savedRoot[key]; !ok {
			changes = append(changes, ClaudeCodeSettingsChange{Key: key, Before: origRoot[key], After: nil})
		}
	}

	return changes
}
