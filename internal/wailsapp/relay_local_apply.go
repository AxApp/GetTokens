package wailsapp

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func (a *App) ApplyRelayServiceConfigToLocal(apiKey string, baseURL string) (*RelayLocalApplyResult, error) {
	normalizedAPIKey := strings.TrimSpace(apiKey)
	if normalizedAPIKey == "" {
		return nil, errors.New("缺少 API KEY")
	}

	normalizedBaseURL := normalizeRelayLocalBaseURL(baseURL)
	if normalizedBaseURL == "" {
		return nil, errors.New("缺少 BASE URL")
	}

	return applyRelayServiceConfigToLocal(normalizedAPIKey, normalizedBaseURL)
}

func applyRelayServiceConfigToLocal(apiKey string, baseURL string) (*RelayLocalApplyResult, error) {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		return nil, err
	}

	authPath := filepath.Join(codexHome, "auth.json")
	configPath := filepath.Join(codexHome, "config.toml")

	authPayload, err := buildRelayCodexAuthJSON(apiKey)
	if err != nil {
		return nil, err
	}
	configPayload := buildRelayCodexConfigToml(baseURL)

	if err := os.WriteFile(authPath, authPayload, 0600); err != nil {
		return nil, err
	}
	if err := os.WriteFile(configPath, []byte(configPayload), 0600); err != nil {
		return nil, err
	}

	return &RelayLocalApplyResult{
		CodexHomePath: codexHome,
		AuthFilePath:  authPath,
		ConfigPath:    configPath,
	}, nil
}

func resolveCodexHomePath() (string, error) {
	if override := strings.TrimSpace(os.Getenv("CODEX_HOME")); override != "" {
		return override, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".codex"), nil
}

func normalizeRelayLocalBaseURL(value string) string {
	trimmed := strings.TrimSpace(value)
	return strings.TrimRight(trimmed, "/")
}

func buildRelayCodexAuthJSON(apiKey string) ([]byte, error) {
	payload := map[string]string{
		"auth_mode":      "apikey",
		"OPENAI_API_KEY": strings.TrimSpace(apiKey),
	}
	body, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("序列化 auth.json 失败: %w", err)
	}
	return append(body, '\n'), nil
}

func buildRelayCodexConfigToml(baseURL string) string {
	return fmt.Sprintf("model = \"gpt-5.4\"\nopenai_base_url = %q\n", strings.TrimSpace(baseURL))
}
