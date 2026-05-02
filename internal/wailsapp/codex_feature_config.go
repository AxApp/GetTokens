package wailsapp

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type CodexFeatureDefinition struct {
	Key            string `json:"key"`
	Description    string `json:"description,omitempty"`
	Stage          string `json:"stage"`
	DefaultEnabled bool   `json:"defaultEnabled"`
	CanonicalKey   string `json:"canonicalKey,omitempty"`
	LegacyAlias    bool   `json:"legacyAlias,omitempty"`
}

type CodexFeatureConfigSnapshot struct {
	CodexHomePath string                   `json:"codexHomePath"`
	ConfigPath    string                   `json:"configPath"`
	Exists        bool                     `json:"exists"`
	Definitions   []CodexFeatureDefinition `json:"definitions"`
	Values        map[string]bool          `json:"values"`
	UnknownValues map[string]bool          `json:"unknownValues,omitempty"`
	Raw           string                   `json:"raw"`
	Warnings      []string                 `json:"warnings"`
}

type SaveCodexFeatureConfigInput struct {
	Values map[string]bool `json:"values"`
}

type CodexFeatureConfigChange struct {
	Key             string `json:"key"`
	Type            string `json:"type"`
	PreviousEnabled *bool  `json:"previousEnabled,omitempty"`
	NextEnabled     bool   `json:"nextEnabled"`
}

type CodexFeatureConfigPreview struct {
	ConfigPath string                     `json:"configPath"`
	WillCreate bool                       `json:"willCreate"`
	Changes    []CodexFeatureConfigChange `json:"changes"`
	Preview    string                     `json:"preview"`
	Warnings   []string                   `json:"warnings"`
}

type codexFeatureConfigDiskFile struct {
	codexHome  string
	configPath string
	body       string
	exists     bool
}

type codexFeatureDocument struct {
	lines             []string
	newline           string
	hasFeatures       bool
	featuresStart     int
	featuresEnd       int
	values            map[string]bool
	unknownValues     map[string]bool
	keyLineIndexes    map[string]int
	nonBoolKeyIndexes map[string]int
	warnings          []string
}

var codexFeatureDefinitions = []CodexFeatureDefinition{
	{Key: "shell_tool", Stage: "stable", DefaultEnabled: true},
	{Key: "unified_exec", Stage: "stable", DefaultEnabled: true},
	{Key: "shell_snapshot", Stage: "stable", DefaultEnabled: true},
	{Key: "hooks", Stage: "stable", DefaultEnabled: true},
	{Key: "enable_request_compression", Stage: "stable", DefaultEnabled: true},
	{Key: "multi_agent", Stage: "stable", DefaultEnabled: true},
	{Key: "apps", Stage: "stable", DefaultEnabled: true},
	{Key: "tool_search", Stage: "stable", DefaultEnabled: true},
	{Key: "unavailable_dummy_tools", Stage: "stable", DefaultEnabled: true},
	{Key: "tool_suggest", Stage: "stable", DefaultEnabled: true},
	{Key: "plugins", Stage: "stable", DefaultEnabled: true},
	{Key: "in_app_browser", Stage: "stable", DefaultEnabled: true},
	{Key: "browser_use", Stage: "stable", DefaultEnabled: true},
	{Key: "browser_use_external", Stage: "stable", DefaultEnabled: true},
	{Key: "computer_use", Stage: "stable", DefaultEnabled: true},
	{Key: "image_generation", Stage: "stable", DefaultEnabled: true},
	{Key: "skill_mcp_dependency_install", Stage: "stable", DefaultEnabled: true},
	{Key: "guardian_approval", Stage: "stable", DefaultEnabled: true},
	{Key: "tool_call_mcp_elicitation", Stage: "stable", DefaultEnabled: true},
	{Key: "personality", Stage: "stable", DefaultEnabled: true},
	{Key: "fast_mode", Stage: "stable", DefaultEnabled: true},
	{Key: "workspace_dependencies", Stage: "stable", DefaultEnabled: true},

	{Key: "terminal_resize_reflow", Stage: "experimental", DefaultEnabled: true},
	{Key: "memories", Stage: "experimental", DefaultEnabled: false},
	{Key: "external_migration", Stage: "experimental", DefaultEnabled: false},
	{Key: "goals", Stage: "experimental", DefaultEnabled: false},
	{Key: "prevent_idle_sleep", Stage: "experimental", DefaultEnabled: false},

	{Key: "shell_zsh_fork", Stage: "under_development", DefaultEnabled: false},
	{Key: "code_mode", Stage: "under_development", DefaultEnabled: false},
	{Key: "code_mode_only", Stage: "under_development", DefaultEnabled: false},
	{Key: "codex_git_commit", Stage: "under_development", DefaultEnabled: false},
	{Key: "runtime_metrics", Stage: "under_development", DefaultEnabled: false},
	{Key: "chronicle", Stage: "under_development", DefaultEnabled: false},
	{Key: "child_agents_md", Stage: "under_development", DefaultEnabled: false},
	{Key: "apply_patch_freeform", Stage: "under_development", DefaultEnabled: false},
	{Key: "apply_patch_streaming_events", Stage: "under_development", DefaultEnabled: false},
	{Key: "exec_permission_approvals", Stage: "under_development", DefaultEnabled: false},
	{Key: "request_permissions_tool", Stage: "under_development", DefaultEnabled: false},
	{Key: "enable_fanout", Stage: "under_development", DefaultEnabled: false},
	{Key: "enable_mcp_apps", Stage: "under_development", DefaultEnabled: false},
	{Key: "tool_search_always_defer_mcp_tools", Stage: "under_development", DefaultEnabled: false},
	{Key: "plugin_hooks", Stage: "under_development", DefaultEnabled: false},
	{Key: "remote_plugin", Stage: "under_development", DefaultEnabled: false},
	{Key: "skill_env_var_dependency_prompt", Stage: "under_development", DefaultEnabled: false},
	{Key: "default_mode_request_user_input", Stage: "under_development", DefaultEnabled: false},
	{Key: "realtime_conversation", Stage: "under_development", DefaultEnabled: false},
	{Key: "remote_control", Stage: "under_development", DefaultEnabled: false},
	{Key: "workspace_owner_usage_nudge", Stage: "under_development", DefaultEnabled: false},

	{Key: "web_search_request", Stage: "deprecated", DefaultEnabled: false},
	{Key: "web_search_cached", Stage: "deprecated", DefaultEnabled: false},
	{Key: "use_legacy_landlock", Stage: "deprecated", DefaultEnabled: false},

	{Key: "sqlite", Stage: "removed", DefaultEnabled: true},
	{Key: "steer", Stage: "removed", DefaultEnabled: true},
	{Key: "collaboration_modes", Stage: "removed", DefaultEnabled: true},
	{Key: "tui_app_server", Stage: "removed", DefaultEnabled: true},
	{Key: "undo", Stage: "removed", DefaultEnabled: false},
	{Key: "js_repl", Stage: "removed", DefaultEnabled: false},
	{Key: "js_repl_tools_only", Stage: "removed", DefaultEnabled: false},
	{Key: "search_tool", Stage: "removed", DefaultEnabled: false},
	{Key: "use_linux_sandbox_bwrap", Stage: "removed", DefaultEnabled: false},
	{Key: "request_rule", Stage: "removed", DefaultEnabled: false},
	{Key: "experimental_windows_sandbox", Stage: "removed", DefaultEnabled: false},
	{Key: "elevated_windows_sandbox", Stage: "removed", DefaultEnabled: false},
	{Key: "remote_models", Stage: "removed", DefaultEnabled: false},
	{Key: "image_detail_original", Stage: "removed", DefaultEnabled: false},
	{Key: "responses_websockets", Stage: "removed", DefaultEnabled: false},
	{Key: "responses_websockets_v2", Stage: "removed", DefaultEnabled: false},

	{Key: "codex_hooks", Stage: "legacy", DefaultEnabled: true, CanonicalKey: "hooks", LegacyAlias: true},
	{Key: "collab", Stage: "legacy", DefaultEnabled: true, CanonicalKey: "multi_agent", LegacyAlias: true},
	{Key: "connectors", Stage: "legacy", DefaultEnabled: true, CanonicalKey: "apps", LegacyAlias: true},
	{Key: "enable_experimental_windows_sandbox", Stage: "legacy", DefaultEnabled: false, CanonicalKey: "experimental_windows_sandbox", LegacyAlias: true},
	{Key: "experimental_use_freeform_apply_patch", Stage: "legacy", DefaultEnabled: false, CanonicalKey: "apply_patch_freeform", LegacyAlias: true},
	{Key: "experimental_use_unified_exec_tool", Stage: "legacy", DefaultEnabled: true, CanonicalKey: "unified_exec", LegacyAlias: true},
	{Key: "include_apply_patch_tool", Stage: "legacy", DefaultEnabled: false, CanonicalKey: "apply_patch_freeform", LegacyAlias: true},
	{Key: "memory_tool", Stage: "legacy", DefaultEnabled: false, CanonicalKey: "memories", LegacyAlias: true},
	{Key: "request_permissions", Stage: "legacy", DefaultEnabled: false, CanonicalKey: "exec_permission_approvals", LegacyAlias: true},
	{Key: "telepathy", Stage: "legacy", DefaultEnabled: false, CanonicalKey: "chronicle", LegacyAlias: true},
	{Key: "web_search", Stage: "legacy", DefaultEnabled: false, CanonicalKey: "web_search_request", LegacyAlias: true},
}

var codexCompositeFeatureKeys = map[string]struct{}{
	"multi_agent_v2":         {},
	"apps_mcp_path_override": {},
}

var codexFeatureDescriptions = map[string]string{
	"shell_tool":                         "Enable the default shell tool.",
	"unified_exec":                       "Use the single unified PTY-backed exec tool.",
	"shell_snapshot":                     "Enable shell snapshotting.",
	"hooks":                              "Enable Codex lifecycle hooks loaded from hooks.json files.",
	"enable_request_compression":         "Compress request bodies with zstd when sending streaming requests to codex-backend.",
	"multi_agent":                        "Enable collaboration and multi-agent tools.",
	"apps":                               "Enable Codex apps.",
	"tool_search":                        "Enable the tool_search tool for apps.",
	"unavailable_dummy_tools":            "Expose placeholder tools for unavailable historical tool calls.",
	"tool_suggest":                       "Enable discoverable tool suggestions for apps.",
	"plugins":                            "Enable Codex plugins.",
	"in_app_browser":                     "Allow the in-app browser pane in desktop apps.",
	"browser_use":                        "Allow Browser Use agent integration in desktop apps.",
	"browser_use_external":               "Allow Browser Use integration with external browsers.",
	"computer_use":                       "Allow Codex Computer Use.",
	"image_generation":                   "Allow the model to invoke the built-in image generation tool.",
	"skill_mcp_dependency_install":       "Allow prompting for and installing missing MCP dependencies.",
	"guardian_approval":                  "Enable automatic review for approval prompts.",
	"tool_call_mcp_elicitation":          "Route MCP tool approval prompts through the MCP elicitation request path.",
	"personality":                        "Enable personality selection in the TUI.",
	"fast_mode":                          "Enable Fast mode selection in the TUI and request layer.",
	"workspace_dependencies":             "Enable workspace dependency support.",
	"terminal_resize_reflow":             "Rebuild Codex-owned transcript scrollback when the terminal width changes.",
	"memories":                           "Allow Codex to create new memories from conversations and bring relevant memories into new conversations.",
	"external_migration":                 "Show a startup prompt when Codex detects migratable external agent config for this machine or project.",
	"goals":                              "Set a persistent goal Codex can continue over time.",
	"prevent_idle_sleep":                 "Keep your computer awake while Codex is running a thread.",
	"shell_zsh_fork":                     "Route shell tool execution through the zsh exec bridge.",
	"code_mode":                          "Enable JavaScript code mode backed by the in-process V8 runtime.",
	"code_mode_only":                     "Restrict model-visible tools to code mode entrypoints such as exec and wait.",
	"codex_git_commit":                   "Enable git commit attribution guidance via model instructions.",
	"runtime_metrics":                    "Enable runtime metrics snapshots via a manual reader.",
	"chronicle":                          "Enable the Chronicle sidecar for passive screen-context memories.",
	"child_agents_md":                    "Append additional AGENTS.md guidance to user instructions.",
	"apply_patch_freeform":               "Include the freeform apply_patch tool.",
	"apply_patch_streaming_events":       "Stream structured progress while apply_patch input is being generated.",
	"exec_permission_approvals":          "Allow exec tools to request additional permissions while staying sandboxed.",
	"request_permissions_tool":           "Expose the built-in request_permissions tool.",
	"enable_fanout":                      "Enable CSV-backed agent job fan-out tools.",
	"enable_mcp_apps":                    "Enable MCP apps.",
	"tool_search_always_defer_mcp_tools": "Always defer MCP tools behind tool_search instead of exposing small sets directly.",
	"plugin_hooks":                       "Enable plugin-bundled lifecycle hooks.",
	"remote_plugin":                      "Enable the internal remote plugin catalog development path.",
	"skill_env_var_dependency_prompt":    "Prompt for missing skill environment variable dependencies.",
	"default_mode_request_user_input":    "Allow request_user_input in Default collaboration mode.",
	"realtime_conversation":              "Enable experimental realtime voice conversation mode in the TUI.",
	"remote_control":                     "Connect app-server to the ChatGPT remote control service.",
	"workspace_owner_usage_nudge":        "Enable workspace-specific owner nudge copy and prompts in the TUI.",
	"web_search_request":                 "Deprecated live web-search feature flag; use the top-level web_search setting instead.",
	"web_search_cached":                  "Deprecated cached web-search feature flag; use the top-level web_search setting instead.",
	"use_legacy_landlock":                "Deprecated Linux Landlock fallback flag retained for compatibility.",
	"sqlite":                             "Removed compatibility flag for local SQLite rollout metadata.",
	"steer":                              "Removed compatibility flag; Enter-submit behavior is now always enabled.",
	"collaboration_modes":                "Removed compatibility flag; collaboration modes are now always enabled.",
	"tui_app_server":                     "Removed compatibility flag; the TUI now always uses the app-server implementation.",
	"undo":                               "Removed compatibility flag retained as a no-op for old configs.",
	"js_repl":                            "Removed compatibility flag for the deleted JavaScript REPL feature.",
	"js_repl_tools_only":                 "Removed compatibility flag for the deleted JavaScript REPL tool-only mode.",
	"search_tool":                        "Removed legacy search-tool feature flag kept for backward compatibility.",
	"use_linux_sandbox_bwrap":            "Removed legacy Linux bubblewrap opt-in flag retained as a no-op.",
	"request_rule":                       "Removed compatibility flag for exec approval rule requests.",
	"experimental_windows_sandbox":       "Removed compatibility flag for the Windows restricted-token sandbox.",
	"elevated_windows_sandbox":           "Removed compatibility flag for the elevated Windows sandbox pipeline.",
	"remote_models":                      "Removed legacy remote models flag kept for backward compatibility.",
	"image_detail_original":              "Removed compatibility flag retained as a no-op for old wrappers.",
	"responses_websockets":               "Removed legacy rollout flag for Responses API WebSocket transport experiments.",
	"responses_websockets_v2":            "Removed legacy rollout flag for Responses API WebSocket transport v2 experiments.",
}

func (a *App) GetCodexFeatureConfig() (*CodexFeatureConfigSnapshot, error) {
	diskFile, err := readCodexFeatureConfigDiskFile()
	if err != nil {
		return nil, err
	}
	document, err := parseCodexFeatureDocument(diskFile.body)
	if err != nil {
		return nil, err
	}

	return &CodexFeatureConfigSnapshot{
		CodexHomePath: diskFile.codexHome,
		ConfigPath:    diskFile.configPath,
		Exists:        diskFile.exists,
		Definitions:   cloneCodexFeatureDefinitions(),
		Values:        cloneBoolMap(document.values),
		UnknownValues: cloneBoolMap(document.unknownValues),
		Raw:           diskFile.body,
		Warnings:      append([]string(nil), document.warnings...),
	}, nil
}

func (a *App) PreviewCodexFeatureConfig(input SaveCodexFeatureConfigInput) (*CodexFeatureConfigPreview, error) {
	diskFile, err := readCodexFeatureConfigDiskFile()
	if err != nil {
		return nil, err
	}
	return previewCodexFeatureConfigPatch(diskFile.configPath, diskFile.body, diskFile.exists, input.Values)
}

func (a *App) SaveCodexFeatureConfig(input SaveCodexFeatureConfigInput) (*CodexFeatureConfigPreview, error) {
	diskFile, err := readCodexFeatureConfigDiskFile()
	if err != nil {
		return nil, err
	}
	preview, err := previewCodexFeatureConfigPatch(diskFile.configPath, diskFile.body, diskFile.exists, input.Values)
	if err != nil {
		return nil, err
	}
	if len(input.Values) == 0 {
		return preview, nil
	}
	if err := writeFileAtomically(diskFile.configPath, []byte(preview.Preview), 0600); err != nil {
		return nil, err
	}
	return preview, nil
}

func readCodexFeatureConfigDiskFile() (*codexFeatureConfigDiskFile, error) {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}
	configPath := filepath.Join(codexHome, "config.toml")

	body, err := os.ReadFile(configPath)
	if errors.Is(err, os.ErrNotExist) {
		return &codexFeatureConfigDiskFile{
			codexHome:  codexHome,
			configPath: configPath,
			body:       "",
			exists:     false,
		}, nil
	}
	if err != nil {
		return nil, err
	}
	return &codexFeatureConfigDiskFile{
		codexHome:  codexHome,
		configPath: configPath,
		body:       string(body),
		exists:     true,
	}, nil
}

func previewCodexFeatureConfigPatch(configPath string, existing string, exists bool, inputValues map[string]bool) (*CodexFeatureConfigPreview, error) {
	document, err := parseCodexFeatureDocument(existing)
	if err != nil {
		return nil, err
	}
	if err := validateCodexFeatureConfigInput(inputValues, document); err != nil {
		return nil, err
	}

	keys := make([]string, 0, len(inputValues))
	for key := range inputValues {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	lines := append([]string(nil), document.lines...)
	changes := make([]CodexFeatureConfigChange, 0, len(keys))
	if len(keys) > 0 && !document.hasFeatures {
		if len(lines) > 0 && strings.TrimSpace(lines[len(lines)-1]) != "" {
			lines = append(lines, "")
		}
		lines = append(lines, "[features]")
		document.hasFeatures = true
		document.featuresStart = len(lines) - 1
		document.featuresEnd = len(lines)
		document.keyLineIndexes = make(map[string]int)
		document.nonBoolKeyIndexes = make(map[string]int)
	}

	for _, key := range keys {
		next := inputValues[key]
		change := CodexFeatureConfigChange{
			Key:         key,
			Type:        "added",
			NextEnabled: next,
		}
		if previous, ok := document.values[key]; ok {
			previousCopy := previous
			change.PreviousEnabled = &previousCopy
			if previous == next {
				change.Type = "unchanged"
			} else {
				change.Type = "updated"
			}
		}
		changes = append(changes, change)

		if index, ok := document.keyLineIndexes[key]; ok {
			if change.Type != "unchanged" {
				lines[index] = rewriteTomlKeyLine(lines[index], key, formatTomlBool(next))
			}
			continue
		}

		insertAt := document.featuresEnd
		lines = append(lines, "")
		copy(lines[insertAt+1:], lines[insertAt:])
		lines[insertAt] = fmt.Sprintf("%s = %s", key, formatTomlBool(next))
		document.featuresEnd++
		for existingKey, index := range document.keyLineIndexes {
			if index >= insertAt {
				document.keyLineIndexes[existingKey] = index + 1
			}
		}
		for existingKey, index := range document.nonBoolKeyIndexes {
			if index >= insertAt {
				document.nonBoolKeyIndexes[existingKey] = index + 1
			}
		}
		document.keyLineIndexes[key] = insertAt
		document.values[key] = next
	}

	return &CodexFeatureConfigPreview{
		ConfigPath: configPath,
		WillCreate: !exists,
		Changes:    changes,
		Preview:    joinTomlDocument(lines, document.newline),
		Warnings:   append([]string(nil), document.warnings...),
	}, nil
}

func parseCodexFeatureDocument(input string) (*codexFeatureDocument, error) {
	if strings.Contains(input, "\r\n") {
		withoutCRLF := strings.ReplaceAll(input, "\r\n", "")
		if strings.Contains(withoutCRLF, "\n") {
			return nil, errors.New("config.toml 同时包含 CRLF 和 LF，已停止写入以避免破坏换行格式")
		}
	}

	lines, newline := splitTomlDocument(input)
	document := &codexFeatureDocument{
		lines:             lines,
		newline:           newline,
		values:            make(map[string]bool),
		unknownValues:     make(map[string]bool),
		keyLineIndexes:    make(map[string]int),
		nonBoolKeyIndexes: make(map[string]int),
	}

	featuresStart := -1
	featuresEnd := -1
	for index, line := range lines {
		if strings.TrimSpace(stripTomlLineComment(line)) != "[features]" {
			continue
		}
		if featuresStart >= 0 {
			return nil, errors.New("config.toml 包含多个 [features] section，无法安全 patch")
		}
		featuresStart = index
		featuresEnd = len(lines)
		for next := index + 1; next < len(lines); next++ {
			if isTomlSectionHeader(lines[next]) {
				featuresEnd = next
				break
			}
		}
	}
	if featuresStart < 0 {
		return document, nil
	}

	document.hasFeatures = true
	document.featuresStart = featuresStart
	document.featuresEnd = featuresEnd
	knownDefinitions := codexFeatureDefinitionsByKey()
	for index := featuresStart + 1; index < featuresEnd; index++ {
		key, value, isBool, hasSimpleKey := parseTomlBoolKeyValue(lines[index])
		if !hasSimpleKey {
			continue
		}
		if _, exists := document.keyLineIndexes[key]; exists {
			return nil, fmt.Errorf("[features] 中 key %q 重复，无法安全 patch", key)
		}
		if _, exists := document.nonBoolKeyIndexes[key]; exists {
			return nil, fmt.Errorf("[features] 中 key %q 重复，无法安全 patch", key)
		}
		if !isBool {
			document.nonBoolKeyIndexes[key] = index
			continue
		}

		document.keyLineIndexes[key] = index
		document.values[key] = value
		definition, known := knownDefinitions[key]
		if known && definition.LegacyAlias {
			document.warnings = append(document.warnings, fmt.Sprintf("features.%s 是 legacy alias，建议改用 canonical key features.%s", key, definition.CanonicalKey))
			continue
		}
		if !known {
			document.unknownValues[key] = value
		}
	}

	return document, nil
}

func validateCodexFeatureConfigInput(inputValues map[string]bool, document *codexFeatureDocument) error {
	knownDefinitions := codexFeatureDefinitionsByKey()
	for key := range inputValues {
		if strings.TrimSpace(key) != key || !isBareTomlKey(key) {
			return fmt.Errorf("features.%s 不是支持的 bool key", key)
		}
		if _, composite := codexCompositeFeatureKeys[key]; composite {
			return fmt.Errorf("features.%s 是复合 feature，一期不支持写入", key)
		}
		if definition, known := knownDefinitions[key]; known {
			if definition.LegacyAlias {
				return fmt.Errorf("features.%s 是 legacy alias，请写入 canonical key features.%s", key, definition.CanonicalKey)
			}
		} else if _, exists := document.values[key]; !exists {
			return fmt.Errorf("features.%s 不在当前 bool definitions 中，且本地不存在该 bool key，已停止写入", key)
		}
		if _, exists := document.nonBoolKeyIndexes[key]; exists {
			return fmt.Errorf("features.%s 不是简单 bool 值，无法安全 patch", key)
		}
	}
	return nil
}

func parseTomlBoolKeyValue(line string) (string, bool, bool, bool) {
	content := strings.TrimSpace(stripTomlLineComment(line))
	if content == "" || strings.HasPrefix(content, "#") {
		return "", false, false, false
	}
	parts := strings.SplitN(content, "=", 2)
	if len(parts) != 2 {
		return "", false, false, false
	}
	key := strings.TrimSpace(parts[0])
	if !isBareTomlKey(key) {
		return "", false, false, false
	}
	value := strings.TrimSpace(parts[1])
	switch value {
	case "true":
		return key, true, true, true
	case "false":
		return key, false, true, true
	default:
		return key, false, false, true
	}
}

func isBareTomlKey(key string) bool {
	if key == "" {
		return false
	}
	for _, ch := range key {
		switch {
		case ch >= 'a' && ch <= 'z':
		case ch >= 'A' && ch <= 'Z':
		case ch >= '0' && ch <= '9':
		case ch == '_' || ch == '-':
		default:
			return false
		}
	}
	return true
}

func formatTomlBool(value bool) string {
	if value {
		return "true"
	}
	return "false"
}

func joinTomlDocument(lines []string, newline string) string {
	if len(lines) == 0 {
		return ""
	}
	return strings.Join(lines, newline) + newline
}

func cloneCodexFeatureDefinitions() []CodexFeatureDefinition {
	definitions := make([]CodexFeatureDefinition, 0, len(codexFeatureDefinitions))
	for _, definition := range codexFeatureDefinitions {
		definitions = append(definitions, enrichCodexFeatureDefinition(definition))
	}
	return definitions
}

func enrichCodexFeatureDefinition(definition CodexFeatureDefinition) CodexFeatureDefinition {
	if definition.Description == "" {
		definition.Description = codexFeatureDescription(definition)
	}
	return definition
}

func codexFeatureDescription(definition CodexFeatureDefinition) string {
	if description := codexFeatureDescriptions[definition.Key]; description != "" {
		return description
	}
	if definition.LegacyAlias && definition.CanonicalKey != "" {
		return fmt.Sprintf("Legacy alias for %s. Prefer the canonical feature key.", definition.CanonicalKey)
	}
	return fmt.Sprintf("Boolean Codex feature flag for %s.", definition.Key)
}

func cloneBoolMap(input map[string]bool) map[string]bool {
	if len(input) == 0 {
		return map[string]bool{}
	}
	output := make(map[string]bool, len(input))
	for key, value := range input {
		output[key] = value
	}
	return output
}

func codexFeatureDefinitionsByKey() map[string]CodexFeatureDefinition {
	definitionsByKey := make(map[string]CodexFeatureDefinition, len(codexFeatureDefinitions))
	for _, definition := range codexFeatureDefinitions {
		definitionsByKey[definition.Key] = enrichCodexFeatureDefinition(definition)
	}
	return definitionsByKey
}
