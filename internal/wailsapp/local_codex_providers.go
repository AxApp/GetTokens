package wailsapp

import (
	"path/filepath"
	"strconv"
	"strings"
)

type LocalCodexModelProvider struct {
	ProviderID   string `json:"providerID"`
	ProviderName string `json:"providerName"`
	BaseURL      string `json:"baseUrl,omitempty"`
}

type LocalCodexModelProviderState struct {
	CurrentModel                         string                    `json:"currentModel"`
	HasExplicitCurrentModel              bool                      `json:"hasExplicitCurrentModel"`
	CurrentProviderID                    string                    `json:"currentProviderID"`
	CurrentProviderName                  string                    `json:"currentProviderName"`
	CurrentProviderBaseURL               string                    `json:"currentProviderBaseUrl,omitempty"`
	CurrentProviderIsBuiltin             bool                      `json:"currentProviderIsBuiltin"`
	CurrentProviderExists                bool                      `json:"currentProviderExists"`
	CurrentProviderSupportsWebsockets    bool                      `json:"currentProviderSupportsWebsockets"`
	CurrentProviderSupportsWebsocketsSet bool                      `json:"currentProviderSupportsWebsocketsSet"`
	HasExplicitCurrentProvider           bool                      `json:"hasExplicitCurrentProvider"`
	Providers                            []LocalCodexModelProvider `json:"providers"`
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

func (a *App) GetLocalCodexModelProviderState() (*LocalCodexModelProviderState, error) {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}

	configPath := filepath.Join(codexHome, "config.toml")
	configBody, err := readOptionalTextFile(configPath)
	if err != nil {
		return nil, err
	}

	state := parseLocalCodexModelProviderState(configBody)
	return &state, nil
}

func parseLocalCodexModelProviderState(configBody string) LocalCodexModelProviderState {
	providers := parseLocalCodexModelProviders(configBody)
	currentModel, hasExplicitCurrentModel := parseLocalCodexRootStringKey(configBody, "model")
	if currentModel == "" {
		currentModel = relayCodexDefaultModel
	}
	currentProviderID, hasExplicitCurrentProvider := parseLocalCodexRootStringKey(configBody, "model_provider")
	currentProviderIsBuiltin := false
	if currentProviderID == "" {
		currentProviderID = relayCodexOpenAIProviderID
		currentProviderIsBuiltin = true
	} else if currentProviderID == relayCodexOpenAIProviderID {
		currentProviderIsBuiltin = true
	}

	currentProviderName := currentProviderID
	currentProviderBaseURL := ""
	currentProviderSupportsWebsockets := false
	currentProviderSupportsWebsocketsSet := false
	currentProviderExists := currentProviderIsBuiltin
	for _, provider := range providers {
		if provider.ProviderID == currentProviderID {
			currentProviderName = provider.ProviderName
			currentProviderBaseURL = provider.BaseURL
			currentProviderExists = true
			break
		}
	}
	if providerState, ok := parseLocalCodexModelProviderDetails(configBody, currentProviderID); ok {
		if strings.TrimSpace(providerState.ProviderName) != "" {
			currentProviderName = providerState.ProviderName
		}
		currentProviderBaseURL = providerState.BaseURL
		currentProviderSupportsWebsockets = providerState.SupportsWebsockets
		currentProviderSupportsWebsocketsSet = providerState.SupportsWebsocketsSet
	}
	if currentProviderIsBuiltin && currentProviderID == relayCodexOpenAIProviderID {
		currentProviderName = "OpenAI"
	}

	return LocalCodexModelProviderState{
		CurrentModel:                         currentModel,
		HasExplicitCurrentModel:              hasExplicitCurrentModel,
		CurrentProviderID:                    currentProviderID,
		CurrentProviderName:                  currentProviderName,
		CurrentProviderBaseURL:               currentProviderBaseURL,
		CurrentProviderIsBuiltin:             currentProviderIsBuiltin,
		CurrentProviderExists:                currentProviderExists,
		CurrentProviderSupportsWebsockets:    currentProviderSupportsWebsockets,
		CurrentProviderSupportsWebsocketsSet: currentProviderSupportsWebsocketsSet,
		HasExplicitCurrentProvider:           hasExplicitCurrentProvider,
		Providers:                            providers,
	}
}

func parseLocalCodexRootStringKey(configBody string, key string) (string, bool) {
	lines, _ := splitTomlDocument(configBody)
	if len(lines) == 0 {
		return "", false
	}

	rootEnd := firstTomlSectionIndex(lines)
	for index := 0; index < rootEnd; index++ {
		if value, ok := parseTomlStringKeyValue(lines[index], key); ok {
			return strings.TrimSpace(value), true
		}
	}
	return "", false
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
		baseURL := ""
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
				continue
			}
			if value, ok := parseTomlStringKeyValue(lines[next], "base_url"); ok {
				baseURL = strings.TrimSpace(value)
			}
		}

		seen[providerID] = struct{}{}
		providers = append(providers, LocalCodexModelProvider{
			ProviderID:   providerID,
			ProviderName: providerName,
			BaseURL:      baseURL,
		})
	}

	return providers
}

type localCodexModelProviderDetails struct {
	ProviderName          string
	BaseURL               string
	SupportsWebsockets    bool
	SupportsWebsocketsSet bool
}

func parseLocalCodexModelProviderDetails(configBody string, providerID string) (localCodexModelProviderDetails, bool) {
	providerID = strings.TrimSpace(providerID)
	if providerID == "" {
		return localCodexModelProviderDetails{}, false
	}
	lines, _ := splitTomlDocument(configBody)
	for index := 0; index < len(lines); index++ {
		sectionName, ok := parseModelProvidersSectionHeader(lines[index])
		if !ok || sectionName != providerID {
			continue
		}
		details := localCodexModelProviderDetails{}
		end := len(lines)
		for next := index + 1; next < len(lines); next++ {
			if isTomlSectionHeader(lines[next]) {
				end = next
				break
			}
		}
		for next := index + 1; next < end; next++ {
			if value, ok := parseTomlStringKeyValue(lines[next], "name"); ok {
				details.ProviderName = strings.TrimSpace(value)
				continue
			}
			if value, ok := parseTomlStringKeyValue(lines[next], "base_url"); ok {
				details.BaseURL = strings.TrimSpace(value)
				continue
			}
			if key, value, isBool, ok := parseTomlBoolKeyValue(lines[next]); ok && key == "supports_websockets" {
				details.SupportsWebsocketsSet = true
				if isBool {
					details.SupportsWebsockets = value
				}
			}
		}
		return details, true
	}
	return localCodexModelProviderDetails{}, false
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
