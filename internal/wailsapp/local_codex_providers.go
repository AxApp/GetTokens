package wailsapp

import (
	"path/filepath"
	"strconv"
	"strings"
)

type LocalCodexModelProvider struct {
	ProviderID   string `json:"providerID"`
	ProviderName string `json:"providerName"`
}

func (a *App) ListLocalCodexModelProviders() ([]LocalCodexModelProvider, error) {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}

	configPath := filepath.Join(codexHome, "config.toml")
	configBody, err := readOptionalTextFile(configPath)
	if err != nil {
		return nil, err
	}

	return parseLocalCodexModelProviders(configBody), nil
}

func parseLocalCodexModelProviders(configBody string) []LocalCodexModelProvider {
	lines, _ := splitTomlDocument(configBody)
	if len(lines) == 0 {
		return nil
	}

	providers := make([]LocalCodexModelProvider, 0)
	seen := make(map[string]struct{})

	for index := 0; index < len(lines); index++ {
		sectionName, ok := parseModelProvidersSectionHeader(lines[index])
		if !ok {
			continue
		}

		providerID := strings.TrimSpace(sectionName)
		if providerID == "" {
			continue
		}
		if _, exists := seen[providerID]; exists {
			continue
		}

		providerName := providerID
		end := len(lines)
		for next := index + 1; next < len(lines); next++ {
			if isTomlSectionHeader(lines[next]) {
				end = next
				break
			}
		}
		for next := index + 1; next < end; next++ {
			if value, ok := parseTomlStringKeyValue(lines[next], "name"); ok {
				if strings.TrimSpace(value) != "" {
					providerName = strings.TrimSpace(value)
				}
				break
			}
		}

		seen[providerID] = struct{}{}
		providers = append(providers, LocalCodexModelProvider{
			ProviderID:   providerID,
			ProviderName: providerName,
		})
	}

	return providers
}

func parseModelProvidersSectionHeader(line string) (string, bool) {
	trimmed := strings.TrimSpace(stripTomlLineComment(line))
	const prefix = "[model_providers."
	if !strings.HasPrefix(trimmed, prefix) || !strings.HasSuffix(trimmed, "]") {
		return "", false
	}
	return strings.TrimSuffix(strings.TrimPrefix(trimmed, prefix), "]"), true
}

func parseTomlStringKeyValue(line string, key string) (string, bool) {
	if !tomlLineDefinesKey(line, key) {
		return "", false
	}
	content := strings.TrimSpace(stripTomlLineComment(line))
	parts := strings.SplitN(content, "=", 2)
	if len(parts) != 2 {
		return "", false
	}
	value := strings.TrimSpace(parts[1])
	if len(value) < 2 || value[0] != '"' || value[len(value)-1] != '"' {
		return "", false
	}
	unquoted, err := strconv.Unquote(value)
	if err != nil {
		return "", false
	}
	return unquoted, true
}
