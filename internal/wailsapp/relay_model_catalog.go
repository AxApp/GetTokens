package wailsapp

import (
	"encoding/json"
	"path/filepath"
	"sort"
	"strings"

	"github.com/linhay/gettokens/internal/cliproxyapi"
)

type relayModelFetcher func(FetchOpenAICompatibleProviderModelsInput) ([]OpenAICompatibleModel, error)

func (a *App) ListRelaySupportedModels() ([]OpenAICompatibleModel, error) {
	providers, err := a.ListOpenAICompatibleProviders()
	if err != nil {
		return nil, err
	}

	codexKeys, err := a.loadCodexAPIKeys()
	if err != nil {
		codexKeys = nil
	}

	localCodexModels, err := loadLocalCodexModelsCache()
	if err != nil {
		localCodexModels = nil
	}

	return listRelaySupportedModels(providers, codexKeys, func(input FetchOpenAICompatibleProviderModelsInput) ([]OpenAICompatibleModel, error) {
		result, err := a.FetchOpenAICompatibleProviderModels(input)
		if err != nil {
			return nil, err
		}
		return result.Models, nil
	}, localCodexModels), nil
}

func listRelaySupportedModels(
	providers []OpenAICompatibleProvider,
	codexKeys []cliproxyapi.CodexAPIKey,
	fetcher relayModelFetcher,
	localCodexModels []OpenAICompatibleModel,
) []OpenAICompatibleModel {
	merged := make(map[string]OpenAICompatibleModel)

	for _, provider := range providers {
		if provider.Disabled {
			continue
		}

		appendRelaySupportedModels(merged, provider.Models)

		if fetcher == nil {
			continue
		}
		if strings.TrimSpace(provider.BaseURL) == "" || strings.TrimSpace(provider.APIKey) == "" {
			continue
		}

		remoteModels, err := fetcher(FetchOpenAICompatibleProviderModelsInput{
			BaseURL: provider.BaseURL,
			APIKey:  provider.APIKey,
			Headers: cloneHeaders(provider.Headers),
		})
		if err != nil {
			continue
		}
		appendRelaySupportedModels(merged, remoteModels)
	}

	for _, key := range codexKeys {
		if key.Disabled {
			continue
		}

		models := make([]OpenAICompatibleModel, 0, len(key.Models))
		for _, model := range key.Models {
			models = append(models, OpenAICompatibleModel{
				Name:  model.Name,
				Alias: model.Alias,
			})
		}
		appendRelaySupportedModels(merged, models)
	}

	if len(merged) == 0 {
		appendRelaySupportedModels(merged, localCodexModels)
	}

	if len(merged) == 0 {
		return nil
	}

	names := make([]string, 0, len(merged))
	for name := range merged {
		names = append(names, name)
	}
	sort.Strings(names)

	models := make([]OpenAICompatibleModel, 0, len(names))
	for _, name := range names {
		models = append(models, merged[name])
	}
	return models
}

func appendRelaySupportedModels(target map[string]OpenAICompatibleModel, items []OpenAICompatibleModel) {
	for _, item := range normalizeProviderModels(items) {
		current, ok := target[item.Name]
		if !ok {
			target[item.Name] = item
			continue
		}
		target[item.Name] = mergeRelaySupportedModel(current, item)
	}
}

func mergeRelaySupportedModel(current OpenAICompatibleModel, incoming OpenAICompatibleModel) OpenAICompatibleModel {
	if strings.TrimSpace(current.Alias) == "" {
		current.Alias = strings.TrimSpace(incoming.Alias)
	}
	current.SupportedReasoningEfforts = mergeReasoningEfforts(
		current.SupportedReasoningEfforts,
		incoming.SupportedReasoningEfforts,
	)
	if normalizeReasoningEffort(current.DefaultReasoningEffort) == "" {
		current.DefaultReasoningEffort = normalizeReasoningEffort(incoming.DefaultReasoningEffort)
	}
	if normalizeReasoningEffort(current.DefaultReasoningEffort) != "" &&
		!containsString(current.SupportedReasoningEfforts, current.DefaultReasoningEffort) {
		current.SupportedReasoningEfforts = append(current.SupportedReasoningEfforts, current.DefaultReasoningEffort)
		current.SupportedReasoningEfforts = normalizeReasoningEfforts(current.SupportedReasoningEfforts)
	}
	return current
}

func mergeReasoningEfforts(left []string, right []string) []string {
	return normalizeReasoningEfforts(append(append([]string(nil), left...), right...))
}

func containsString(items []string, target string) bool {
	for _, item := range items {
		if item == target {
			return true
		}
	}
	return false
}

func loadLocalCodexModelsCache() ([]OpenAICompatibleModel, error) {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}

	cacheBody, err := readOptionalTextFile(filepath.Join(codexHome, "models_cache.json"))
	if err != nil {
		return nil, err
	}

	return parseLocalCodexModelsCache(cacheBody)
}

func parseLocalCodexModelsCache(body string) ([]OpenAICompatibleModel, error) {
	type localCodexReasoningLevel struct {
		Effort string `json:"effort"`
	}
	type localCodexModel struct {
		Slug                     string                     `json:"slug"`
		DisplayName              string                     `json:"display_name"`
		DefaultReasoningLevel    string                     `json:"default_reasoning_level"`
		SupportedReasoningLevels []localCodexReasoningLevel `json:"supported_reasoning_levels"`
	}
	var payload struct {
		Models []localCodexModel `json:"models"`
	}

	trimmed := strings.TrimSpace(body)
	if trimmed == "" {
		return nil, nil
	}
	if err := json.Unmarshal([]byte(trimmed), &payload); err != nil {
		return nil, err
	}

	models := make([]OpenAICompatibleModel, 0, len(payload.Models))
	for _, item := range payload.Models {
		name := strings.TrimSpace(item.Slug)
		if name == "" {
			name = strings.TrimSpace(item.DisplayName)
		}
		if name == "" {
			continue
		}

		alias := strings.TrimSpace(item.DisplayName)
		if alias == name {
			alias = ""
		}

		reasoningEfforts := make([]string, 0, len(item.SupportedReasoningLevels))
		for _, level := range item.SupportedReasoningLevels {
			reasoningEfforts = append(reasoningEfforts, level.Effort)
		}

		models = append(models, OpenAICompatibleModel{
			Name:                      name,
			Alias:                     alias,
			SupportedReasoningEfforts: normalizeReasoningEfforts(reasoningEfforts),
			DefaultReasoningEffort:    normalizeReasoningEffort(item.DefaultReasoningLevel),
		})
	}

	return normalizeProviderModels(models), nil
}
