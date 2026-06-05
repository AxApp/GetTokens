package wailsapp

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
	"unicode"
)

const (
	gettokensCodexModelCatalogFilename   = "gettokens-model-catalog.json"
	codexModelCatalogTemplateSlug        = "gpt-5.5"
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

	template := loadCodexModelCatalogEntryTemplate()
	seen := make(map[string]bool)
	entries := make([]map[string]any, 0, len(normalized))
	for _, item := range normalized {
		slug := resolveCodexModelCatalogSlug(item)
		if slug == "" || seen[slug] {
			continue
		}
		seen[slug] = true

		entry := buildGetTokensCodexModelCatalogEntry(template, item, slug, len(entries))
		entries = append(entries, entry)
	}
	if len(entries) == 0 {
		return nil, fmt.Errorf("缺少可投影到 Codex /model 的模型")
	}

	body, err := json.MarshalIndent(map[string]any{"models": entries}, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("序列化 Codex 模型目录失败: %w", err)
	}
	return append(body, '\n'), nil
}

func buildGetTokensCodexModelCatalogEntry(
	template map[string]any,
	item OpenAICompatibleModel,
	slug string,
	priority int,
) map[string]any {
	entry := cloneCodexModelCatalogTemplate(template)
	if entry == nil {
		entry = defaultGetTokensCodexModelCatalogTemplate()
	}

	reasoningEfforts := normalizeReasoningEfforts(item.SupportedReasoningEfforts)
	defaultReasoning := normalizeReasoningEffort(item.DefaultReasoningEffort)
	if defaultReasoning != "" && !containsString(reasoningEfforts, defaultReasoning) {
		reasoningEfforts = normalizeReasoningEfforts(append(reasoningEfforts, defaultReasoning))
	}

	entry["slug"] = slug
	entry["display_name"] = resolveCodexModelCatalogDisplayName(item, slug)
	entry["description"] = buildCodexModelCatalogDescription(item, slug)
	entry["visibility"] = "list"
	entry["supported_in_api"] = true
	entry["priority"] = priority
	entry["shell_type"] = "shell_command"
	entry["base_instructions"] = stringValueOrDefault(entry["base_instructions"], "You are a helpful coding assistant.")
	entry["supports_parallel_tool_calls"] = true
	entry["input_modalities"] = arrayValueOrDefault(entry["input_modalities"], []any{"text", "image"})
	entry["experimental_supported_tools"] = arrayValueOrDefault(entry["experimental_supported_tools"], []any{})
	entry["additional_speed_tiers"] = []any{}
	entry["service_tiers"] = []any{}
	entry["availability_nux"] = nil
	entry["upgrade"] = nil

	if defaultReasoning != "" {
		entry["default_reasoning_level"] = defaultReasoning
	}
	if len(reasoningEfforts) > 0 {
		entry["supported_reasoning_levels"] = buildCodexModelCatalogReasoningLevels(reasoningEfforts)
	} else if _, ok := entry["supported_reasoning_levels"]; !ok {
		entry["supported_reasoning_levels"] = []codexModelCatalogReasoning{}
	}
	if _, ok := entry["truncation_policy"]; !ok {
		entry["truncation_policy"] = map[string]any{"mode": "bytes", "limit": 10000}
	}
	if _, ok := entry["supports_reasoning_summaries"]; !ok {
		entry["supports_reasoning_summaries"] = false
	}
	if _, ok := entry["support_verbosity"]; !ok {
		entry["support_verbosity"] = false
	}

	return entry
}

func cloneCodexModelCatalogTemplate(template map[string]any) map[string]any {
	if len(template) == 0 {
		return nil
	}
	body, err := json.Marshal(template)
	if err != nil {
		return nil
	}
	var cloned map[string]any
	if err := json.Unmarshal(body, &cloned); err != nil {
		return nil
	}
	return cloned
}

func arrayValueOrDefault(value any, fallback []any) any {
	items, ok := value.([]any)
	if !ok || items == nil {
		return fallback
	}
	return items
}

func stringValueOrDefault(value any, fallback string) string {
	text, ok := value.(string)
	if !ok || strings.TrimSpace(text) == "" {
		return fallback
	}
	return text
}

func loadCodexModelCatalogEntryTemplate() map[string]any {
	if template := loadCodexModelCatalogEntryTemplateFromCache(); template != nil {
		return template
	}
	if template := loadCodexModelCatalogEntryTemplateFromBundled(); template != nil {
		return template
	}
	return loadStaticCodexModelCatalogEntryTemplate()
}

func loadCodexModelCatalogEntryTemplateFromCache() map[string]any {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil
	}
	body, err := os.ReadFile(filepath.Join(codexHome, "models_cache.json"))
	if err != nil {
		return nil
	}
	return findCodexModelCatalogEntryTemplate(body)
}

func loadCodexModelCatalogEntryTemplateFromBundled() map[string]any {
	for _, candidate := range codexCLICandidatesForModelCatalog() {
		output, err := exec.Command(candidate, "debug", "models", "--bundled").Output()
		if err != nil {
			continue
		}
		if template := findCodexModelCatalogEntryTemplate(output); template != nil {
			return template
		}
	}
	return nil
}

func codexCLICandidatesForModelCatalog() []string {
	candidates := []string{"codex", "/opt/homebrew/bin/codex", "/usr/local/bin/codex"}
	if home, err := os.UserHomeDir(); err == nil && home != "" {
		candidates = append(candidates,
			filepath.Join(home, ".nvm/current/bin/codex"),
			filepath.Join(home, ".volta/bin/codex"),
			filepath.Join(home, ".asdf/shims/codex"),
			filepath.Join(home, ".local/bin/codex"),
			filepath.Join(home, "Library/pnpm/codex"),
		)
	}
	return dedupeStrings(candidates)
}

func dedupeStrings(items []string) []string {
	seen := make(map[string]bool, len(items))
	out := make([]string, 0, len(items))
	for _, item := range items {
		trimmed := strings.TrimSpace(item)
		if trimmed == "" || seen[trimmed] {
			continue
		}
		seen[trimmed] = true
		out = append(out, trimmed)
	}
	return out
}

func findCodexModelCatalogEntryTemplate(body []byte) map[string]any {
	var payload struct {
		Models []map[string]any `json:"models"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil
	}
	for _, model := range payload.Models {
		if slug, _ := model["slug"].(string); slug == codexModelCatalogTemplateSlug {
			return model
		}
	}
	return nil
}

func loadStaticCodexModelCatalogEntryTemplate() map[string]any {
	return defaultGetTokensCodexModelCatalogTemplate()
}

func defaultGetTokensCodexModelCatalogTemplate() map[string]any {
	return map[string]any{
		"slug":                           codexModelCatalogTemplateSlug,
		"display_name":                   "GPT-5.5",
		"description":                    "Codex model template",
		"default_reasoning_level":        "medium",
		"supported_reasoning_levels":     []codexModelCatalogReasoning{{Effort: "low", Description: "Fast responses"}, {Effort: "medium", Description: "Balanced reasoning"}, {Effort: "high", Description: "Deep reasoning"}, {Effort: "xhigh", Description: "Extra high reasoning"}},
		"shell_type":                     "shell_command",
		"visibility":                     "list",
		"supported_in_api":               true,
		"priority":                       0,
		"additional_speed_tiers":         []any{},
		"service_tiers":                  []any{},
		"availability_nux":               nil,
		"upgrade":                        nil,
		"base_instructions":              "You are a helpful coding assistant.",
		"supports_reasoning_summaries":   false,
		"support_verbosity":              false,
		"truncation_policy":              map[string]any{"mode": "bytes", "limit": 10000},
		"supports_parallel_tool_calls":   true,
		"supports_image_detail_original": true,
		"context_window":                 272000,
		"max_context_window":             272000,
		"experimental_supported_tools":   []any{},
		"input_modalities":               []any{"text", "image"},
		"supports_search_tool":           false,
	}
}

func resolveCodexModelCatalogSlug(model OpenAICompatibleModel) string {
	name := strings.TrimSpace(model.Name)
	alias := strings.TrimSpace(model.Alias)
	if isCodexRouteModelAlias(alias) && !isCodexModelDisplayAliasForName(name, alias) {
		return alias
	}
	return name
}

func isCodexModelDisplayAliasForName(name string, alias string) bool {
	name = strings.TrimSpace(name)
	alias = strings.TrimSpace(alias)
	return name != "" && alias != "" && strings.EqualFold(name, alias)
}

func resolveCodexModelCatalogDisplayName(model OpenAICompatibleModel, slug string) string {
	alias := strings.TrimSpace(model.Alias)
	if alias != "" {
		return alias
	}
	return strings.TrimSpace(slug)
}

func buildCodexModelCatalogDescription(model OpenAICompatibleModel, slug string) string {
	name := strings.TrimSpace(model.Name)
	if strings.TrimSpace(slug) == "" || strings.TrimSpace(slug) == name {
		return "GetTokens relay model"
	}
	return fmt.Sprintf("GetTokens relay alias for %s", name)
}

func isCodexRouteModelAlias(value string) bool {
	trimmed := strings.TrimSpace(value)
	return trimmed != "" && strings.IndexFunc(trimmed, unicode.IsSpace) == -1
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
	if err := writeFileAtomicallyIfChanged(catalogPath, catalogBody, 0600); err != nil {
		return "", "", "", false, err
	}

	return nextConfig, catalogPath, "", true, nil
}

func writeFileAtomicallyIfChanged(path string, body []byte, mode os.FileMode) error {
	existing, err := os.ReadFile(path)
	if err == nil && bytes.Equal(existing, body) {
		return nil
	}
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	return writeFileAtomically(path, body, mode)
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

	lines = upsertRootTomlKey(lines, "model_catalog_json", quoteTomlString(gettokensCodexModelCatalogFilename), true)
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

func applyPersistedCodexModelCatalogCacheSnapshot() error {
	settings, err := loadAppRuntimeSettings()
	if err != nil {
		return err
	}
	if !settings.CodexModelCatalogSyncEnabled {
		return nil
	}
	models, err := loadRelaySupportedModelsFromAccountCache()
	if err != nil {
		return err
	}
	if len(models) == 0 {
		return nil
	}
	_, err = enableGetTokensCodexModelCatalogProjection(models, false)
	return err
}

const defaultCodexModelCatalogRefreshDebounce = 150 * time.Millisecond

func (a *App) refreshCodexModelCatalogAfterAccountMutation() error {
	if a == nil || a.ctx == nil {
		return nil
	}
	if a.codexModelCatalogRefreshFunc != nil {
		return a.codexModelCatalogRefreshFunc()
	}
	return a.applyPersistedCodexModelCatalogSyncSetting()
}

func (a *App) scheduleCodexModelCatalogRefreshAfterAccountMutation() {
	if a == nil || a.ctx == nil {
		return
	}
	a.codexModelCatalogRefreshMu.Lock()
	if a.codexModelCatalogRefreshRunning {
		a.codexModelCatalogRefreshPending = true
		a.codexModelCatalogRefreshMu.Unlock()
		return
	}
	debounce := a.codexModelCatalogRefreshDebounce
	if debounce <= 0 {
		debounce = defaultCodexModelCatalogRefreshDebounce
	}
	if a.codexModelCatalogRefreshTimer != nil {
		a.codexModelCatalogRefreshTimer.Stop()
	}
	a.codexModelCatalogRefreshTimer = time.AfterFunc(debounce, a.runCodexModelCatalogRefreshAfterAccountMutation)
	a.codexModelCatalogRefreshMu.Unlock()
}

func (a *App) stopCodexModelCatalogRefreshAfterAccountMutation() {
	if a == nil {
		return
	}
	a.codexModelCatalogRefreshMu.Lock()
	if a.codexModelCatalogRefreshTimer != nil {
		a.codexModelCatalogRefreshTimer.Stop()
		a.codexModelCatalogRefreshTimer = nil
	}
	a.codexModelCatalogRefreshPending = false
	a.codexModelCatalogRefreshMu.Unlock()
}

func (a *App) runCodexModelCatalogRefreshAfterAccountMutation() {
	a.codexModelCatalogRefreshMu.Lock()
	if a.codexModelCatalogRefreshRunning {
		a.codexModelCatalogRefreshPending = true
		a.codexModelCatalogRefreshMu.Unlock()
		return
	}
	a.codexModelCatalogRefreshRunning = true
	a.codexModelCatalogRefreshPending = false
	a.codexModelCatalogRefreshMu.Unlock()

	for {
		if err := a.refreshCodexModelCatalogAfterAccountMutation(); err != nil {
			log.Printf("refresh Codex model catalog after account mutation failed: %v", err)
		}

		a.codexModelCatalogRefreshMu.Lock()
		if !a.codexModelCatalogRefreshPending {
			a.codexModelCatalogRefreshRunning = false
			a.codexModelCatalogRefreshMu.Unlock()
			return
		}
		a.codexModelCatalogRefreshPending = false
		a.codexModelCatalogRefreshMu.Unlock()
	}
}

func (a *App) applyPersistedCodexModelCatalogSyncSetting() error {
	settings, err := loadAppRuntimeSettings()
	if err != nil {
		return err
	}
	if !settings.CodexModelCatalogSyncEnabled {
		_, err := a.DisableGetTokensCodexModelCatalogProjection()
		return err
	}
	models, err := a.ListRelaySupportedModels()
	if err != nil {
		return err
	}
	if len(models) == 0 {
		_, err := disableGetTokensCodexModelCatalogProjection()
		return err
	}
	_, err = a.EnableGetTokensCodexModelCatalogProjection(models)
	return err
}

func (a *App) DisableGetTokensCodexModelCatalogProjection() (*RelayLocalApplyResult, error) {
	if _, err := a.SetCodexModelCatalogSyncEnabled(false); err != nil {
		return nil, err
	}
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
	if _, err := a.SetCodexModelCatalogSyncEnabled(true); err != nil {
		return nil, err
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
	if localPathBase(trimmed) == gettokensCodexModelCatalogFilename {
		return true
	}
	return filepath.Clean(trimmed) == filepath.Clean(getGetTokensCodexModelCatalogPath(codexHome))
}

func localPathBase(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	index := strings.LastIndexAny(trimmed, `/\`)
	if index >= 0 && index+1 < len(trimmed) {
		return trimmed[index+1:]
	}
	return filepath.Base(trimmed)
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

func normalizeRelayLocalModelCatalogProjectionMode(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	return normalizeRelayModelCatalogProjectionMode(trimmed)
}
