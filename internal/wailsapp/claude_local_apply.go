package wailsapp

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	claudeCodeSettingsFileName = "settings.json"
)

func (a *App) ApplyClaudeCodeAPIKeyConfigToLocal(apiKey string, baseURL string, model string) (*ClaudeCodeLocalApplyResult, error) {
	normalizedAPIKey := strings.TrimSpace(apiKey)
	if normalizedAPIKey == "" {
		return nil, errors.New("缺少 API KEY")
	}

	normalizedBaseURL := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if normalizedBaseURL == "" {
		return nil, errors.New("缺少 BASE URL")
	}

	return applyClaudeCodeAPIKeyConfigToLocal(normalizedAPIKey, normalizedBaseURL, strings.TrimSpace(model))
}

func applyClaudeCodeAPIKeyConfigToLocal(apiKey string, baseURL string, model string) (*ClaudeCodeLocalApplyResult, error) {
	claudeConfigDir, err := resolveClaudeConfigDirPath()
	if err != nil {
		return nil, err
	}

	settingsPath := filepath.Join(claudeConfigDir, claudeCodeSettingsFileName)
	existing, err := readOptionalTextFile(settingsPath)
	if err != nil {
		return nil, err
	}

	result := &ClaudeCodeLocalApplyResult{
		ClaudeConfigDirPath: claudeConfigDir,
		SettingsPath:        settingsPath,
		Warnings:            []string{},
		Conflicts:           []string{},
	}

	nextBody, err := buildClaudeCodeSettingsJSON(existing, apiKey, baseURL, model, result)
	if err != nil {
		return nil, err
	}

	if err := os.MkdirAll(claudeConfigDir, 0700); err != nil {
		return nil, err
	}
	if err := writeFileAtomically(settingsPath, nextBody, 0600); err != nil {
		return nil, err
	}

	return result, nil
}

func resolveClaudeConfigDirPath() (string, error) {
	if override := strings.TrimSpace(os.Getenv("CLAUDE_CONFIG_DIR")); override != "" {
		return override, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".claude"), nil
}

func buildClaudeCodeSettingsJSON(existing string, apiKey string, baseURL string, model string, result *ClaudeCodeLocalApplyResult) ([]byte, error) {
	if strings.TrimSpace(existing) == "" {
		payload := map[string]any{
			"env": buildClaudeCodeEnvPayload(map[string]any{}, apiKey, baseURL, model, result),
		}
		body, err := json.MarshalIndent(payload, "", "  ")
		if err != nil {
			return nil, fmt.Errorf("序列化 Claude Code settings.json 失败: %w", err)
		}
		return append(body, '\n'), nil
	}

	var root map[string]json.RawMessage
	if err := json.Unmarshal([]byte(existing), &root); err != nil {
		return nil, fmt.Errorf("现有 Claude Code settings.json 不是有效 JSON，已停止写入以避免覆盖: %w", err)
	}

	envPayload := map[string]any{}
	if rawEnv, ok := root["env"]; ok && strings.TrimSpace(string(rawEnv)) != "null" {
		if err := json.Unmarshal(rawEnv, &envPayload); err != nil {
			return nil, fmt.Errorf("现有 Claude Code settings.json 的 env 不是对象，已停止写入以避免覆盖: %w", err)
		}
	}
	envPayload = buildClaudeCodeEnvPayload(envPayload, apiKey, baseURL, model, result)

	envBody, err := json.MarshalIndent(envPayload, "  ", "  ")
	if err != nil {
		return nil, fmt.Errorf("序列化 Claude Code env 失败: %w", err)
	}

	if _, ok := root["env"]; ok {
		patched, err := replaceClaudeCodeEnvObject(existing, string(envBody))
		if err != nil {
			return nil, err
		}
		return []byte(ensureTrailingNewline(patched)), nil
	}

	patched, err := insertClaudeCodeEnvObject(existing, string(envBody))
	if err != nil {
		return nil, err
	}
	return []byte(ensureTrailingNewline(patched)), nil
}

func buildClaudeCodeEnvPayload(env map[string]any, apiKey string, baseURL string, model string, result *ClaudeCodeLocalApplyResult) map[string]any {
	if token, ok := env["ANTHROPIC_AUTH_TOKEN"]; ok && strings.TrimSpace(fmt.Sprint(token)) != "" {
		warning := "检测到 ANTHROPIC_AUTH_TOKEN，已保留该字段；Claude Code 可能优先使用 auth token"
		result.Warnings = append(result.Warnings, warning)
		result.Conflicts = append(result.Conflicts, "ANTHROPIC_AUTH_TOKEN")
	}

	env["ANTHROPIC_API_KEY"] = apiKey
	env["ANTHROPIC_BASE_URL"] = baseURL
	if model != "" {
		env["ANTHROPIC_MODEL"] = model
	} else {
		delete(env, "ANTHROPIC_MODEL")
	}
	return env
}

func replaceClaudeCodeEnvObject(existing string, envBody string) (string, error) {
	keyStart := findJSONStringKey(existing, "env")
	if keyStart < 0 {
		return "", errors.New("未找到 Claude Code settings.json env 字段")
	}

	colon := findNextNonSpace(existing, keyStart+len(`"env"`), ':')
	if colon < 0 {
		return "", errors.New("Claude Code settings.json env 字段格式异常")
	}
	valueStart := skipJSONWhitespace(existing, colon+1)
	if valueStart >= len(existing) || existing[valueStart] != '{' {
		return "", errors.New("Claude Code settings.json env 不是对象，已停止写入以避免覆盖")
	}
	valueEnd := findMatchingJSONBrace(existing, valueStart)
	if valueEnd < 0 {
		return "", errors.New("Claude Code settings.json env 对象格式异常")
	}

	return existing[:valueStart] + envBody + existing[valueEnd+1:], nil
}

func insertClaudeCodeEnvObject(existing string, envBody string) (string, error) {
	trimmed := strings.TrimRight(existing, " \t\r\n")
	closeIndex := strings.LastIndex(trimmed, "}")
	if closeIndex < 0 {
		return "", errors.New("Claude Code settings.json 根对象格式异常")
	}

	prefix := strings.TrimRight(trimmed[:closeIndex], " \t\r\n")
	separator := ""
	if strings.TrimSpace(prefix) != "{" {
		separator = ","
	}
	return prefix + separator + "\n  \"env\": " + envBody + "\n" + trimmed[closeIndex:] + "\n", nil
}

func findJSONStringKey(input string, key string) int {
	target := `"` + key + `"`
	inString := false
	escaped := false
	for index := 0; index <= len(input)-len(target); index++ {
		ch := input[index]
		if inString {
			if escaped {
				escaped = false
				continue
			}
			if ch == '\\' {
				escaped = true
				continue
			}
			if ch == '"' {
				inString = false
			}
			continue
		}
		if ch == '"' {
			if strings.HasPrefix(input[index:], target) {
				return index
			}
			inString = true
		}
	}
	return -1
}

func findNextNonSpace(input string, start int, expected byte) int {
	index := skipJSONWhitespace(input, start)
	if index < len(input) && input[index] == expected {
		return index
	}
	return -1
}

func skipJSONWhitespace(input string, start int) int {
	index := start
	for index < len(input) {
		switch input[index] {
		case ' ', '\t', '\r', '\n':
			index++
		default:
			return index
		}
	}
	return index
}

func findMatchingJSONBrace(input string, openIndex int) int {
	depth := 0
	inString := false
	escaped := false
	for index := openIndex; index < len(input); index++ {
		ch := input[index]
		if inString {
			if escaped {
				escaped = false
				continue
			}
			if ch == '\\' {
				escaped = true
				continue
			}
			if ch == '"' {
				inString = false
			}
			continue
		}
		switch ch {
		case '"':
			inString = true
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return index
			}
		}
	}
	return -1
}

func ensureTrailingNewline(input string) string {
	return strings.TrimRight(input, "\r\n") + "\n"
}
