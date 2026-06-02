package wailsapp

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	gettokensCodexModelCatalogFilename   = "gettokens-model-catalog.json"
	relayModelCatalogProjectionOff       = "off"
	relayModelCatalogProjectionGetTokens = "gettokens"
)

type codexModelCatalogPayload struct {
	Models []codexModelCatalogEntry `json:"models"`
}

type codexModelCatalogEntry struct {
	Slug                        string                       `json:"slug"`
	DisplayName                 string                       `json:"display_name"`
	Description                 string                       `json:"description,omitempty"`
	Visibility                  string                       `json:"visibility"`
	SupportedInAPI              bool                         `json:"supported_in_api"`
	Priority                    int                          `json:"priority"`
	ShellType                   string                       `json:"shell_type"`
	DefaultReasoningLevel       string                       `json:"default_reasoning_level,omitempty"`
	SupportedReasoningLevels    []codexModelCatalogReasoning `json:"supported_reasoning_levels"`
	BaseInstructions            string                       `json:"base_instructions"`
	SupportsReasoningSummaries  bool                         `json:"supports_reasoning_summaries"`
	SupportVerbosity            bool                         `json:"support_verbosity"`
	SupportsParallelToolCalls   bool                         `json:"supports_parallel_tool_calls,omitempty"`
	SupportsImageDetailOriginal bool                         `json:"supports_image_detail_original,omitempty"`
	InputModalities             []string                     `json:"input_modalities,omitempty"`
	SupportsSearchTool          bool                         `json:"supports_search_tool,omitempty"`
	ServiceTiers                []string                     `json:"service_tiers,omitempty"`
	TruncationPolicy            codexModelCatalogTruncation  `json:"truncation_policy"`
	ExperimentalSupportedTools  []string                     `json:"experimental_supported_tools"`
}

type codexModelCatalogReasoning struct {
	Effort      string `json:"effort"`
	Description string `json:"description,omitempty"`
}

type codexModelCatalogTruncation struct {
	Mode  string `json:"mode"`
	Limit int64  `json:"limit"`
}

func buildGetTokensCodexModelCatalog(models []OpenAICompatibleModel) ([]byte, error) {
	normalized := normalizeProviderModels(models)
	if len(normalized) == 0 {
		return nil, fmt.Errorf("缺少可投影到 Codex /model 的模型")
	}

	seen := make(map[string]bool)
	entries := make([]codexModelCatalogEntry, 0, len(normalized))
	for _, item := range normalized {
		slug := strings.TrimSpace(item.Alias)
		if slug == "" {
			slug = strings.TrimSpace(item.Name)
		}
		if slug == "" || seen[slug] {
			continue
		}
		seen[slug] = true

		reasoningEfforts := normalizeReasoningEfforts(item.SupportedReasoningEfforts)
		defaultReasoning := normalizeReasoningEffort(item.DefaultReasoningEffort)
		if defaultReasoning != "" && !containsString(reasoningEfforts, defaultReasoning) {
			reasoningEfforts = normalizeReasoningEfforts(append(reasoningEfforts, defaultReasoning))
		}

		entry := codexModelCatalogEntry{
			Slug:                       slug,
			DisplayName:                slug,
			Description:                buildCodexModelCatalogDescription(item),
			Visibility:                 "list",
			SupportedInAPI:             true,
			Priority:                   len(entries),
			ShellType:                  "shell_command",
			DefaultReasoningLevel:      defaultReasoning,
			SupportedReasoningLevels:   buildCodexModelCatalogReasoningLevels(reasoningEfforts),
			BaseInstructions:           "You are a helpful coding assistant.",
			SupportsReasoningSummaries: false,
			SupportVerbosity:           false,
			SupportsParallelToolCalls:  true,
			InputModalities:            []string{"text", "image"},
			ServiceTiers:               []string{},
			TruncationPolicy: codexModelCatalogTruncation{
				Mode:  "bytes",
				Limit: 10000,
			},
			ExperimentalSupportedTools: []string{},
		}
		entries = append(entries, entry)
	}
	if len(entries) == 0 {
		return nil, fmt.Errorf("缺少可投影到 Codex /model 的模型")
	}

	body, err := json.MarshalIndent(codexModelCatalogPayload{Models: entries}, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("序列化 Codex 模型目录失败: %w", err)
	}
	return append(body, '\n'), nil
}

func buildCodexModelCatalogDescription(model OpenAICompatibleModel) string {
	name := strings.TrimSpace(model.Name)
	alias := strings.TrimSpace(model.Alias)
	if alias == "" || alias == name {
		return "GetTokens relay model"
	}
	return fmt.Sprintf("GetTokens relay alias for %s", name)
}

func buildCodexModelCatalogReasoningLevels(efforts []string) []codexModelCatalogReasoning {
	levels := make([]codexModelCatalogReasoning, 0, len(efforts))
	for _, effort := range efforts {
		normalized := normalizeReasoningEffort(effort)
		if normalized == "" {
			continue
		}
		levels = append(levels, codexModelCatalogReasoning{
			Effort:      normalized,
			Description: codexReasoningDescription(normalized),
		})
	}
	return levels
}

func codexReasoningDescription(effort string) string {
	switch effort {
	case "minimal":
		return "Minimal reasoning"
	case "low":
		return "Fast responses"
	case "medium":
		return "Balanced reasoning"
	case "high":
		return "Deep reasoning"
	case "xhigh":
		return "Extra high reasoning"
	case "none":
		return "No reasoning"
	default:
		return ""
	}
}

func getGetTokensCodexModelCatalogPath(codexHome string) string {
	return filepath.Join(codexHome, gettokensCodexModelCatalogFilename)
}

func applyGetTokensCodexModelCatalogProjection(
	configBody string,
	codexHome string,
	models []OpenAICompatibleModel,
	overrideExternal bool,
) (string, string, string, bool, error) {
	catalogPath := getGetTokensCodexModelCatalogPath(codexHome)
	nextConfig, externalPath, shouldWritePointer := mergeCodexModelCatalogPointer(configBody, catalogPath, overrideExternal)
	if externalPath != "" && !shouldWritePointer {
		return configBody, "", externalPath, false, nil
	}

	catalogBody, err := buildGetTokensCodexModelCatalog(models)
	if err != nil {
		return "", "", "", false, err
	}
	if err := writeFileAtomically(catalogPath, catalogBody, 0600); err != nil {
		return "", "", "", false, err
	}

	return nextConfig, catalogPath, "", true, nil
}

func mergeCodexModelCatalogPointer(configBody string, catalogPath string, overrideExternal bool) (string, string, bool) {
	lines, newline := splitTomlDocument(configBody)
	currentPath, hasCurrentPath := parseLocalCodexRootStringKey(configBody, "model_catalog_json")
	if hasCurrentPath {
		trimmedCurrent := strings.TrimSpace(currentPath)
		if !isGetTokensCodexModelCatalogPath(trimmedCurrent, filepath.Dir(catalogPath)) && !overrideExternal {
			return configBody, trimmedCurrent, false
		}
	}

	lines = upsertRootTomlKey(lines, "model_catalog_json", quoteTomlString(catalogPath), true)
	if len(lines) == 0 {
		return "", "", true
	}
	return strings.Join(lines, newline) + newline, "", true
}

func disableGetTokensCodexModelCatalogProjection() (*RelayLocalApplyResult, error) {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}
	configPath := filepath.Join(codexHome, "config.toml")
	existingConfig, err := readOptionalTextFile(configPath)
	if err != nil {
		return nil, err
	}

	catalogPath := getGetTokensCodexModelCatalogPath(codexHome)
	nextConfig, removed := removeGetTokensCodexModelCatalogPointer(existingConfig, codexHome)
	if removed {
		if err := os.MkdirAll(codexHome, 0700); err != nil {
			return nil, err
		}
		if err := writeFileAtomically(configPath, []byte(nextConfig), 0600); err != nil {
			return nil, err
		}
	}

	return &RelayLocalApplyResult{
		CodexHomePath:               codexHome,
		ConfigPath:                  configPath,
		ModelCatalogPath:            catalogPath,
		ModelCatalogRequiresRestart: removed,
	}, nil
}

func enableGetTokensCodexModelCatalogProjection(
	models []OpenAICompatibleModel,
	overrideExternal bool,
) (*RelayLocalApplyResult, error) {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		return nil, err
	}

	configPath := filepath.Join(codexHome, "config.toml")
	existingConfig, err := readOptionalTextFile(configPath)
	if err != nil {
		return nil, err
	}

	nextConfig, catalogPath, externalPath, requiresRestart, err := applyGetTokensCodexModelCatalogProjection(
		existingConfig,
		codexHome,
		models,
		overrideExternal,
	)
	if err != nil {
		return nil, err
	}
	if catalogPath != "" {
		if err := writeFileAtomically(configPath, []byte(nextConfig), 0600); err != nil {
			return nil, err
		}
	}

	warnings := []string(nil)
	if externalPath != "" {
		warnings = append(warnings, "已保留现有外部 model_catalog_json，未改写为 GetTokens 模型目录")
	}

	return &RelayLocalApplyResult{
		CodexHomePath:                    codexHome,
		ConfigPath:                       configPath,
		ModelCatalogPath:                 catalogPath,
		ModelCatalogRequiresRestart:      requiresRestart,
		ExistingExternalModelCatalogPath: externalPath,
		Warnings:                         warnings,
	}, nil
}

func (a *App) DisableGetTokensCodexModelCatalogProjection() (*RelayLocalApplyResult, error) {
	return disableGetTokensCodexModelCatalogProjection()
}

func (a *App) EnableGetTokensCodexModelCatalogProjection(
	models []OpenAICompatibleModel,
) (*RelayLocalApplyResult, error) {
	if len(models) == 0 {
		relayModels, err := a.ListRelaySupportedModels()
		if err != nil {
			return nil, err
		}
		models = relayModels
	}
	return enableGetTokensCodexModelCatalogProjection(models, false)
}

func removeGetTokensCodexModelCatalogPointer(configBody string, codexHome string) (string, bool) {
	currentPath, hasCurrentPath := parseLocalCodexRootStringKey(configBody, "model_catalog_json")
	if !hasCurrentPath || !isGetTokensCodexModelCatalogPath(currentPath, codexHome) {
		return configBody, false
	}

	lines, newline := splitTomlDocument(configBody)
	lines = deleteTomlRootKey(lines, "model_catalog_json")
	if len(lines) == 0 {
		return "", true
	}
	return strings.Join(lines, newline) + newline, true
}

func isGetTokensCodexModelCatalogPath(value string, codexHome string) bool {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return false
	}
	return filepath.Clean(trimmed) == filepath.Clean(getGetTokensCodexModelCatalogPath(codexHome))
}

func normalizeRelayModelCatalogProjectionMode(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", relayModelCatalogProjectionOff:
		return relayModelCatalogProjectionOff
	case relayModelCatalogProjectionGetTokens:
		return relayModelCatalogProjectionGetTokens
	default:
		return relayModelCatalogProjectionOff
	}
}
