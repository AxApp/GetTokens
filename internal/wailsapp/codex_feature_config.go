package wailsapp

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

type CodexFeatureDefinition struct {
	Section        string   `json:"section"`
	Key            string   `json:"key"`
	ID             string   `json:"id,omitempty"`
	Path           []string `json:"path,omitempty"`
	Description    string   `json:"description,omitempty"`
	Stage          string   `json:"stage"`
	ValueType      string   `json:"valueType,omitempty"`
	Options        []string `json:"options,omitempty"`
	DefaultValue   any      `json:"defaultValue,omitempty"`
	DefaultEnabled bool     `json:"defaultEnabled"`
	CanonicalKey   string   `json:"canonicalKey,omitempty"`
	LegacyAlias    bool     `json:"legacyAlias,omitempty"`
	ReadOnly       bool     `json:"readOnly,omitempty"`
	Unsupported    bool     `json:"unsupported,omitempty"`
}

type CodexFeatureConfigSnapshot struct {
	CodexHomePath   string                   `json:"codexHomePath"`
	ConfigPath      string                   `json:"configPath"`
	Exists          bool                     `json:"exists"`
	Definitions     []CodexFeatureDefinition `json:"definitions"`
	Values          map[string]bool          `json:"values"`
	TypedValues     map[string]any           `json:"typedValues,omitempty"`
	RawValues       map[string]string        `json:"rawValues,omitempty"`
	UnknownValues   map[string]bool          `json:"unknownValues,omitempty"`
	UnknownSections map[string]string        `json:"unknownSections,omitempty"`
	Raw             string                   `json:"raw"`
	Warnings        []string                 `json:"warnings"`
}

type SaveCodexFeatureConfigInput struct {
	Values  map[string]bool          `json:"values,omitempty"`
	Changes []CodexConfigChangeInput `json:"changes,omitempty"`
}

type CodexConfigChangeInput struct {
	ID        string   `json:"id,omitempty"`
	Section   string   `json:"section,omitempty"`
	Key       string   `json:"key,omitempty"`
	Path      []string `json:"path,omitempty"`
	ValueType string   `json:"valueType,omitempty"`
	Value     any      `json:"value,omitempty"`
	Remove    bool     `json:"remove,omitempty"`
}

type CodexFeatureConfigChange struct {
	ID              string   `json:"id,omitempty"`
	Section         string   `json:"section,omitempty"`
	Key             string   `json:"key"`
	Path            []string `json:"path,omitempty"`
	ValueType       string   `json:"valueType,omitempty"`
	Type            string   `json:"type"`
	PreviousEnabled *bool    `json:"previousEnabled,omitempty"`
	NextEnabled     bool     `json:"nextEnabled,omitempty"`
	PreviousValue   any      `json:"previousValue,omitempty"`
	NextValue       any      `json:"nextValue,omitempty"`
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
	sectionName       string
	lines             []string
	newline           string
	hasSection        bool
	sectionStart      int
	sectionEnd        int
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
	{Key: "tool_suggest", Stage: "stable", DefaultEnabled: true},
	{Key: "plugins", Stage: "stable", DefaultEnabled: true},
	{Key: "plugin_sharing", Stage: "stable", DefaultEnabled: true},
	{Key: "in_app_browser", Stage: "stable", DefaultEnabled: true},
	{Key: "browser_use", Stage: "stable", DefaultEnabled: true},
	{Key: "browser_use_external", Stage: "stable", DefaultEnabled: true},
	{Key: "computer_use", Stage: "stable", DefaultEnabled: true},
	{Key: "apps_mcp_path_override", Stage: "advanced", ValueType: "toml"},
	{Key: "image_generation", Stage: "stable", DefaultEnabled: true},
	{Key: "skill_mcp_dependency_install", Stage: "stable", DefaultEnabled: true},
	{Key: "guardian_approval", Stage: "stable", DefaultEnabled: true},
	{Key: "tool_call_mcp_elicitation", Stage: "stable", DefaultEnabled: true},
	{Key: "personality", Stage: "stable", DefaultEnabled: true},
	{Key: "fast_mode", Stage: "stable", DefaultEnabled: true},
	{Key: "goals", Stage: "stable", DefaultEnabled: true},
	{Key: "workspace_dependencies", Stage: "stable", DefaultEnabled: true},

	{Key: "terminal_resize_reflow", Stage: "experimental", DefaultEnabled: true},
	{Key: "memories", Stage: "experimental", DefaultEnabled: false},
	{Key: "external_migration", Stage: "experimental", DefaultEnabled: false},
	{Key: "mentions_v2", Stage: "experimental", DefaultEnabled: false},
	{Key: "prevent_idle_sleep", Stage: "experimental", DefaultEnabled: false},

	{Key: "shell_zsh_fork", Stage: "under_development", DefaultEnabled: false},
	{Key: "code_mode", Stage: "under_development", DefaultEnabled: false},
	{Key: "code_mode_only", Stage: "under_development", DefaultEnabled: false},
	{Key: "runtime_metrics", Stage: "under_development", DefaultEnabled: false},
	{Key: "chronicle", Stage: "under_development", DefaultEnabled: false},
	{Key: "child_agents_md", Stage: "under_development", DefaultEnabled: false},
	{
		Key:          "multi_agent_v2.enabled",
		Stage:        "advanced",
		ValueType:    "boolean",
		DefaultValue: false,
		Path:         []string{"features", "multi_agent_v2", "enabled"},
		Description:  "Enable Multi-Agent V2 tools.",
	},
	{
		Key:          "multi_agent_v2.max_concurrent_threads_per_session",
		Stage:        "advanced",
		ValueType:    "integer",
		DefaultValue: int64(4),
		Path:         []string{"features", "multi_agent_v2", "max_concurrent_threads_per_session"},
		Description:  "Maximum concurrent Multi-Agent V2 threads per session, including the root thread.",
	},
	{
		Key:          "multi_agent_v2.min_wait_timeout_ms",
		Stage:        "advanced",
		ValueType:    "integer",
		DefaultValue: int64(10000),
		Path:         []string{"features", "multi_agent_v2", "min_wait_timeout_ms"},
		Description:  "Minimum wait timeout for Multi-Agent V2 wait operations, in milliseconds.",
	},
	{
		Key:          "multi_agent_v2.max_wait_timeout_ms",
		Stage:        "advanced",
		ValueType:    "integer",
		DefaultValue: int64(3600000),
		Path:         []string{"features", "multi_agent_v2", "max_wait_timeout_ms"},
		Description:  "Maximum wait timeout for Multi-Agent V2 wait operations, in milliseconds.",
	},
	{
		Key:          "multi_agent_v2.default_wait_timeout_ms",
		Stage:        "advanced",
		ValueType:    "integer",
		DefaultValue: int64(30000),
		Path:         []string{"features", "multi_agent_v2", "default_wait_timeout_ms"},
		Description:  "Default wait timeout for Multi-Agent V2 wait operations, in milliseconds.",
	},
	{
		Key:          "multi_agent_v2.usage_hint_enabled",
		Stage:        "advanced",
		ValueType:    "boolean",
		DefaultValue: true,
		Path:         []string{"features", "multi_agent_v2", "usage_hint_enabled"},
		Description:  "Include Multi-Agent V2 usage hints in tool instructions.",
	},
	{
		Key:         "multi_agent_v2.usage_hint_text",
		Stage:       "advanced",
		ValueType:   "textarea",
		Path:        []string{"features", "multi_agent_v2", "usage_hint_text"},
		Description: "Custom usage hint text for Multi-Agent V2 tools.",
	},
	{
		Key:         "multi_agent_v2.root_agent_usage_hint_text",
		Stage:       "advanced",
		ValueType:   "textarea",
		Path:        []string{"features", "multi_agent_v2", "root_agent_usage_hint_text"},
		Description: "Custom Multi-Agent V2 usage hint for root agents.",
	},
	{
		Key:         "multi_agent_v2.subagent_usage_hint_text",
		Stage:       "advanced",
		ValueType:   "textarea",
		Path:        []string{"features", "multi_agent_v2", "subagent_usage_hint_text"},
		Description: "Custom Multi-Agent V2 usage hint for subagents.",
	},
	{
		Key:         "multi_agent_v2.tool_namespace",
		Stage:       "advanced",
		ValueType:   "string",
		Path:        []string{"features", "multi_agent_v2", "tool_namespace"},
		Description: "Optional namespace override for Multi-Agent V2 tools.",
	},
	{
		Key:          "multi_agent_v2.hide_spawn_agent_metadata",
		Stage:        "advanced",
		ValueType:    "boolean",
		DefaultValue: false,
		Path:         []string{"features", "multi_agent_v2", "hide_spawn_agent_metadata"},
		Description:  "Hide spawn-agent metadata from Multi-Agent V2 tool output.",
	},
	{
		Key:          "multi_agent_v2.non_code_mode_only",
		Stage:        "advanced",
		ValueType:    "boolean",
		DefaultValue: false,
		Path:         []string{"features", "multi_agent_v2", "non_code_mode_only"},
		Description:  "Expose Multi-Agent V2 tools only outside code-mode-only tool plans.",
	},
	{Key: "apply_patch_streaming_events", Stage: "under_development", DefaultEnabled: false},
	{Key: "exec_permission_approvals", Stage: "under_development", DefaultEnabled: false},
	{Key: "request_permissions_tool", Stage: "under_development", DefaultEnabled: false},
	{Key: "enable_fanout", Stage: "under_development", DefaultEnabled: false},
	{Key: "enable_mcp_apps", Stage: "under_development", DefaultEnabled: false},
	{Key: "tool_search_always_defer_mcp_tools", Stage: "under_development", DefaultEnabled: false},
	{Key: "remote_plugin", Stage: "under_development", DefaultEnabled: false},
	{Key: "default_mode_request_user_input", Stage: "under_development", DefaultEnabled: false},
	{Key: "auth_elicitation", Stage: "under_development", DefaultEnabled: false},
	{Key: "realtime_conversation", Stage: "under_development", DefaultEnabled: false},
	{Key: "responses_websocket_response_processed", Stage: "under_development", DefaultEnabled: false},
	{Key: "network_proxy", Stage: "advanced", ValueType: "toml"},
	{Key: "remote_compaction_v2", Stage: "under_development", DefaultEnabled: false},

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
	{Key: "codex_git_commit", Stage: "removed", DefaultEnabled: false},
	{Key: "apply_patch_freeform", Stage: "removed", DefaultEnabled: false},
	{Key: "tool_search", Stage: "removed", DefaultEnabled: false},
	{Key: "unavailable_dummy_tools", Stage: "removed", DefaultEnabled: false},
	{Key: "search_tool", Stage: "removed", DefaultEnabled: false},
	{Key: "use_linux_sandbox_bwrap", Stage: "removed", DefaultEnabled: false},
	{Key: "request_rule", Stage: "removed", DefaultEnabled: false},
	{Key: "experimental_windows_sandbox", Stage: "removed", DefaultEnabled: false},
	{Key: "elevated_windows_sandbox", Stage: "removed", DefaultEnabled: false},
	{Key: "remote_models", Stage: "removed", DefaultEnabled: false},
	{Key: "image_detail_original", Stage: "removed", DefaultEnabled: false},
	{Key: "plugin_hooks", Stage: "removed", DefaultEnabled: false},
	{Key: "skill_env_var_dependency_prompt", Stage: "removed", DefaultEnabled: false},
	{Key: "remote_control", Stage: "removed", DefaultEnabled: false},
	{Key: "workspace_owner_usage_nudge", Stage: "removed", DefaultEnabled: false},
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

var codexNoticeDefinitions = []CodexFeatureDefinition{
	{Section: "notice", Key: "hide_full_access_warning", Stage: "stable", DefaultEnabled: false},
	{Section: "notice", Key: "hide_world_writable_warning", Stage: "stable", DefaultEnabled: false},
	{Section: "notice", Key: "fast_default_opt_out", Stage: "stable", DefaultEnabled: false},
	{Section: "notice", Key: "hide_rate_limit_model_nudge", Stage: "stable", DefaultEnabled: false},
	{Section: "notice", Key: "hide_gpt5_1_migration_prompt", Stage: "stable", DefaultEnabled: false},
	{
		Section:        "notice",
		Key:            "hide_gpt-5.1-codex-max_migration_prompt",
		Description:    "Tracks whether the user has seen the gpt-5.1-codex-max migration prompt.",
		Stage:          "stable",
		DefaultEnabled: false,
	},
	{
		Section:     "notice",
		Key:         "external_config_migration_prompts",
		Description: "Tracks scopes where external config migration prompts should be suppressed.",
		Stage:       "stable",
		ValueType:   "toml",
	},
	{
		Section:     "notice",
		Key:         "model_migrations",
		Description: "Tracks acknowledged model migrations as old->new model slug mappings.",
		Stage:       "stable",
		ValueType:   "toml",
	},
}

var codexRootBoolDefinitions = []CodexFeatureDefinition{
	{Section: "root", Key: "allow_login_shell", Stage: "stable", DefaultEnabled: true},
	{Section: "root", Key: "check_for_update_on_startup", Stage: "stable", DefaultEnabled: true},
	{Section: "root", Key: "disable_paste_burst", Stage: "stable", DefaultEnabled: false},
	{Section: "root", Key: "experimental_use_unified_exec_tool", Stage: "legacy", DefaultEnabled: true, CanonicalKey: "unified_exec", LegacyAlias: true},
	{Section: "root", Key: "hide_agent_reasoning", Stage: "stable", DefaultEnabled: false},
	{Section: "root", Key: "show_raw_agent_reasoning", Stage: "stable", DefaultEnabled: false},
	{Section: "root", Key: "model_supports_reasoning_summaries", Stage: "advanced", DefaultEnabled: false},
	{Section: "root", Key: "suppress_unstable_features_warning", Stage: "advanced", DefaultEnabled: false},
	{Section: "root", Key: "include_permissions_instructions", Stage: "advanced", DefaultEnabled: true},
	{Section: "root", Key: "include_apps_instructions", Stage: "advanced", DefaultEnabled: true},
	{Section: "root", Key: "include_collaboration_mode_instructions", Stage: "advanced", DefaultEnabled: true},
	{Section: "root", Key: "include_environment_context", Stage: "advanced", DefaultEnabled: true},
}

var codexRootTypedDefinitions = []CodexFeatureDefinition{
	{Section: "root", Key: "approval_policy", Stage: "stable", ValueType: "enum", Options: []string{"untrusted", "on-failure", "on-request", "never"}},
	{Section: "root", Key: "approvals_reviewer", Stage: "advanced", ValueType: "enum", Options: []string{"user", "auto_review", "guardian_subagent"}},
	{Section: "root", Key: "apps_mcp_product_sku", Stage: "advanced", ValueType: "string"},
	{Section: "root", Key: "auto_review", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "background_terminal_max_timeout", Stage: "advanced", ValueType: "integer"},
	{Section: "root", Key: "chatgpt_base_url", Stage: "advanced", ValueType: "string"},
	{Section: "root", Key: "cli_auth_credentials_store", Stage: "advanced", ValueType: "enum", Options: []string{"file", "keyring", "auto", "ephemeral"}},
	{Section: "root", Key: "compact_prompt", Stage: "advanced", ValueType: "text"},
	{Section: "root", Key: "default_permissions", Stage: "advanced", ValueType: "string"},
	{Section: "root", Key: "developer_instructions", Stage: "advanced", ValueType: "text"},
	{Section: "root", Key: "experimental_compact_prompt_file", Stage: "advanced", ValueType: "string"},
	{Section: "root", Key: "experimental_realtime_start_instructions", Stage: "advanced", ValueType: "text"},
	{Section: "root", Key: "experimental_realtime_ws_backend_prompt", Stage: "advanced", ValueType: "text"},
	{Section: "root", Key: "experimental_realtime_ws_base_url", Stage: "advanced", ValueType: "string"},
	{Section: "root", Key: "experimental_realtime_ws_model", Stage: "advanced", ValueType: "string"},
	{Section: "root", Key: "experimental_realtime_ws_startup_context", Stage: "advanced", ValueType: "text"},
	{Section: "root", Key: "experimental_thread_config_endpoint", Stage: "advanced", ValueType: "string"},
	{Section: "root", Key: "experimental_thread_store", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "file_opener", Stage: "advanced", ValueType: "string"},
	{Section: "root", Key: "forced_chatgpt_workspace_id", Stage: "advanced", ValueType: "string_array"},
	{Section: "root", Key: "forced_login_method", Stage: "advanced", ValueType: "enum", Options: []string{"chatgpt", "api"}},
	{Section: "root", Key: "instructions", Stage: "advanced", ValueType: "text"},
	{Section: "root", Key: "log_dir", Stage: "advanced", ValueType: "string"},
	{Section: "root", Key: "mcp_oauth_callback_port", Stage: "advanced", ValueType: "integer"},
	{Section: "root", Key: "mcp_oauth_callback_url", Stage: "advanced", ValueType: "string"},
	{Section: "root", Key: "mcp_oauth_credentials_store", Stage: "advanced", ValueType: "enum", Options: []string{"auto", "file", "keyring"}},
	{Section: "root", Key: "model", Stage: "stable", ValueType: "string"},
	{Section: "root", Key: "model_auto_compact_token_limit", Stage: "advanced", ValueType: "integer"},
	{Section: "root", Key: "model_auto_compact_token_limit_scope", Stage: "advanced", ValueType: "enum", Options: []string{"total", "body_after_prefix"}},
	{Section: "root", Key: "model_catalog_json", Stage: "advanced", ValueType: "string"},
	{Section: "root", Key: "model_context_window", Stage: "advanced", ValueType: "integer"},
	{Section: "root", Key: "model_instructions_file", Stage: "advanced", ValueType: "string"},
	{Section: "root", Key: "model_provider", Stage: "stable", ValueType: "string"},
	{Section: "root", Key: "model_reasoning_effort", Stage: "stable", ValueType: "enum", Options: []string{"none", "minimal", "low", "medium", "high", "xhigh"}},
	{Section: "root", Key: "model_reasoning_summary", Stage: "stable", ValueType: "enum", Options: []string{"auto", "concise", "detailed", "none"}},
	{Section: "root", Key: "model_verbosity", Stage: "stable", ValueType: "enum", Options: []string{"low", "medium", "high"}},
	{Section: "root", Key: "notify", Stage: "stable", ValueType: "string_array"},
	{Section: "root", Key: "openai_base_url", Stage: "advanced", ValueType: "string"},
	{Section: "root", Key: "oss_provider", Stage: "advanced", ValueType: "string"},
	{Section: "root", Key: "personality", Stage: "advanced", ValueType: "enum", Options: []string{"none", "friendly", "pragmatic"}},
	{Section: "root", Key: "plan_mode_reasoning_effort", Stage: "advanced", ValueType: "enum", Options: []string{"none", "minimal", "low", "medium", "high", "xhigh"}},
	{Section: "root", Key: "profile", Stage: "stable", ValueType: "string"},
	{Section: "root", Key: "project_doc_fallback_filenames", Stage: "advanced", ValueType: "string_array"},
	{Section: "root", Key: "project_doc_max_bytes", Stage: "advanced", ValueType: "integer"},
	{Section: "root", Key: "project_root_markers", Stage: "advanced", ValueType: "string_array"},
	{Section: "root", Key: "review_model", Stage: "advanced", ValueType: "string"},
	{Section: "root", Key: "sandbox_mode", Stage: "stable", ValueType: "enum", Options: []string{"read-only", "workspace-write", "danger-full-access"}},
	{Section: "root", Key: "service_tier", Stage: "advanced", ValueType: "string"},
	{Section: "root", Key: "sqlite_home", Stage: "advanced", ValueType: "string"},
	{Section: "root", Key: "tool_output_token_limit", Stage: "advanced", ValueType: "integer"},
	{Section: "root", Key: "web_search", Stage: "stable", ValueType: "enum", Options: []string{"disabled", "cached", "live"}},

	{Section: "root", Key: "agents", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "analytics", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "apps", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "audio", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "debug", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "desktop", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "feedback", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "ghost_snapshot", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "history", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "hooks", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "marketplaces", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "mcp_servers", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "memories", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "model_providers", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "otel", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "permissions", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "plugins", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "profiles", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "projects", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "realtime", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "sandbox_workspace_write", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "shell_environment_policy", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "skills", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "tool_suggest", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "tools", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "tui", Stage: "advanced", ValueType: "toml"},
	{Section: "root", Key: "windows", Stage: "advanced", ValueType: "toml"},
}

var codexModelProviderEditableDefinitions = []CodexFeatureDefinition{
	{Section: "model_providers", Key: "name", Stage: "stable", ValueType: "string"},
	{Section: "model_providers", Key: "base_url", Stage: "stable", ValueType: "string"},
	{Section: "model_providers", Key: "wire_api", Stage: "stable", ValueType: "enum", Options: []string{"responses"}},
	{Section: "model_providers", Key: "requires_openai_auth", Stage: "advanced", ValueType: "boolean"},
	{Section: "model_providers", Key: "env_key", Stage: "advanced", ValueType: "string"},
	{Section: "model_providers", Key: "env_key_instructions", Stage: "advanced", ValueType: "text"},
	{Section: "model_providers", Key: "experimental_bearer_token", Stage: "advanced", ValueType: "string"},
	{Section: "model_providers", Key: "request_max_retries", Stage: "advanced", ValueType: "integer"},
	{Section: "model_providers", Key: "stream_idle_timeout_ms", Stage: "advanced", ValueType: "integer"},
	{Section: "model_providers", Key: "stream_max_retries", Stage: "advanced", ValueType: "integer"},
	{Section: "model_providers", Key: "supports_websockets", Stage: "advanced", ValueType: "boolean"},
	{Section: "model_providers", Key: "websocket_connect_timeout_ms", Stage: "advanced", ValueType: "integer"},
	{Section: "model_providers", Key: "auth", Stage: "advanced", ValueType: "toml"},
	{Section: "model_providers", Key: "aws", Stage: "advanced", ValueType: "toml"},
	{Section: "model_providers", Key: "env_http_headers", Stage: "advanced", ValueType: "toml"},
	{Section: "model_providers", Key: "http_headers", Stage: "advanced", ValueType: "toml"},
	{Section: "model_providers", Key: "query_params", Stage: "advanced", ValueType: "toml"},
}

var codexCompositeFeatureKeys = map[string]struct{}{
	"multi_agent_v2":         {},
	"apps_mcp_path_override": {},
	"network_proxy":          {},
}

var codexFeatureDescriptions = map[string]string{
	"shell_tool":                              "Enable the default shell tool.",
	"unified_exec":                            "Use the single unified PTY-backed exec tool.",
	"shell_snapshot":                          "Enable shell snapshotting.",
	"hooks":                                   "Enable Codex lifecycle hooks loaded from hooks.json files.",
	"enable_request_compression":              "Compress request bodies with zstd when sending streaming requests to codex-backend.",
	"multi_agent":                             "Enable collaboration and multi-agent tools.",
	"apps":                                    "Enable Codex apps.",
	"tool_suggest":                            "Enable discoverable tool suggestions for apps.",
	"plugins":                                 "Enable Codex plugins.",
	"plugin_sharing":                          "Enable remote plugin sharing flows.",
	"in_app_browser":                          "Allow the in-app browser pane in desktop apps.",
	"browser_use":                             "Allow Browser Use agent integration in desktop apps.",
	"browser_use_external":                    "Allow Browser Use integration with external browsers.",
	"computer_use":                            "Allow Codex Computer Use.",
	"image_generation":                        "Allow the model to invoke the built-in image generation tool.",
	"skill_mcp_dependency_install":            "Allow prompting for and installing missing MCP dependencies.",
	"guardian_approval":                       "Enable automatic review for approval prompts.",
	"tool_call_mcp_elicitation":               "Route MCP tool approval prompts through the MCP elicitation request path.",
	"personality":                             "Enable personality selection in the TUI.",
	"fast_mode":                               "Enable Fast mode selection in the TUI and request layer.",
	"goals":                                   "Enable persisted thread goals and automatic goal continuation.",
	"workspace_dependencies":                  "Enable workspace dependency support.",
	"terminal_resize_reflow":                  "Rebuild Codex-owned transcript scrollback when the terminal width changes.",
	"memories":                                "Allow Codex to create new memories from conversations and bring relevant memories into new conversations.",
	"external_migration":                      "Show a startup prompt when Codex detects migratable external agent config for this machine or project.",
	"mentions_v2":                             "Use a unified @ mention popup for files, folders, apps, plugins, and skills.",
	"prevent_idle_sleep":                      "Keep your computer awake while Codex is running a thread.",
	"shell_zsh_fork":                          "Route shell tool execution through the zsh exec bridge.",
	"code_mode":                               "Enable JavaScript code mode backed by the in-process V8 runtime.",
	"code_mode_only":                          "Restrict model-visible tools to code mode entrypoints such as exec and wait.",
	"runtime_metrics":                         "Enable runtime metrics snapshots via a manual reader.",
	"chronicle":                               "Enable the Chronicle sidecar for passive screen-context memories.",
	"child_agents_md":                         "Append additional AGENTS.md guidance to user instructions.",
	"apply_patch_streaming_events":            "Stream structured progress while apply_patch input is being generated.",
	"exec_permission_approvals":               "Allow exec tools to request additional permissions while staying sandboxed.",
	"request_permissions_tool":                "Expose the built-in request_permissions tool.",
	"enable_fanout":                           "Enable CSV-backed agent job fan-out tools.",
	"enable_mcp_apps":                         "Enable MCP apps.",
	"tool_search_always_defer_mcp_tools":      "Always defer MCP tools behind tool_search instead of exposing small sets directly.",
	"remote_plugin":                           "Enable the internal remote plugin catalog development path.",
	"default_mode_request_user_input":         "Allow request_user_input in Default collaboration mode.",
	"auth_elicitation":                        "Prompt Codex Apps connector auth failures through MCP URL elicitations.",
	"apps_mcp_path_override":                  "Composite feature that can be enabled as a bool or configured with a custom apps MCP path.",
	"realtime_conversation":                   "Enable experimental realtime voice conversation mode in the TUI.",
	"responses_websocket_response_processed":  "Send response.processed over Responses API websockets after a turn response is recorded.",
	"multi_agent_v2":                          "Composite multi-agent feature settings.",
	"network_proxy":                           "Composite network proxy feature settings.",
	"remote_compaction_v2":                    "Enable remote compaction v2 over the normal Responses API.",
	"hide_full_access_warning":                "Track whether the user has acknowledged the full access warning prompt.",
	"hide_world_writable_warning":             "Track whether the user has acknowledged the Windows world-writable directories warning.",
	"fast_default_opt_out":                    "Track whether the user opted out of Codex-managed fast defaults.",
	"hide_rate_limit_model_nudge":             "Track whether the user opted out of the rate limit model switch reminder.",
	"hide_gpt5_1_migration_prompt":            "Track whether the user has seen the model migration prompt.",
	"hide_gpt-5.1-codex-max_migration_prompt": "Track whether the user has seen the gpt-5.1-codex-max migration prompt.",
	"allow_login_shell":                       "Allow models to request login shells for shell-based tools.",
	"check_for_update_on_startup":             "Check for Codex updates on startup and surface update prompts.",
	"disable_paste_burst":                     "Disable burst-paste detection for typed input.",
	"hide_agent_reasoning":                    "Hide AgentReasoning events from Codex UI/output.",
	"show_raw_agent_reasoning":                "Show raw AgentReasoningRawContentEvent content in Codex UI/output.",
	"model_supports_reasoning_summaries":      "Force-enable reasoning summaries for the configured model.",
	"suppress_unstable_features_warning":      "Suppress warnings about enabled under-development features.",
	"include_permissions_instructions":        "Inject the permissions developer instruction block.",
	"include_apps_instructions":               "Inject the apps developer instruction block.",
	"include_collaboration_mode_instructions": "Inject the collaboration mode developer instruction block.",
	"include_environment_context":             "Inject the environment context user block.",
	"external_config_migration_prompts":       "Tracks scopes where external config migration prompts should be suppressed.",
	"model_migrations":                        "Tracks acknowledged model migrations as old->new model slug mappings.",
	"web_search_request":                      "Deprecated live web-search feature flag; use the top-level web_search setting instead.",
	"web_search_cached":                       "Deprecated cached web-search feature flag; use the top-level web_search setting instead.",
	"use_legacy_landlock":                     "Deprecated Linux Landlock fallback flag retained for compatibility.",
	"sqlite":                                  "Removed compatibility flag for local SQLite rollout metadata.",
	"steer":                                   "Removed compatibility flag; Enter-submit behavior is now always enabled.",
	"collaboration_modes":                     "Removed compatibility flag; collaboration modes are now always enabled.",
	"tui_app_server":                          "Removed compatibility flag; the TUI now always uses the app-server implementation.",
	"undo":                                    "Removed compatibility flag retained as a no-op for old configs.",
	"js_repl":                                 "Removed compatibility flag for the deleted JavaScript REPL feature.",
	"js_repl_tools_only":                      "Removed compatibility flag for the deleted JavaScript REPL tool-only mode.",
	"codex_git_commit":                        "Removed legacy git commit attribution guidance flag.",
	"apply_patch_freeform":                    "Removed compatibility flag for the deleted apply_patch fallback feature.",
	"tool_search":                             "Removed compatibility flag retained now that tool_search is always enabled.",
	"unavailable_dummy_tools":                 "Removed compatibility flag for unavailable-tool placeholder backfill.",
	"search_tool":                             "Removed legacy search-tool feature flag kept for backward compatibility.",
	"use_linux_sandbox_bwrap":                 "Removed legacy Linux bubblewrap opt-in flag retained as a no-op.",
	"request_rule":                            "Removed compatibility flag for exec approval rule requests.",
	"experimental_windows_sandbox":            "Removed compatibility flag for the Windows restricted-token sandbox.",
	"elevated_windows_sandbox":                "Removed compatibility flag for the elevated Windows sandbox pipeline.",
	"remote_models":                           "Removed legacy remote models flag kept for backward compatibility.",
	"image_detail_original":                   "Removed compatibility flag retained as a no-op for old wrappers.",
	"plugin_hooks":                            "Removed compatibility flag for plugin-bundled lifecycle hooks.",
	"skill_env_var_dependency_prompt":         "Removed compatibility flag for deleted skill env var dependency prompting.",
	"remote_control":                          "Removed compatibility flag for the deleted remote control feature.",
	"workspace_owner_usage_nudge":             "Removed compatibility flag retained now that workspace owner usage nudges are always enabled.",
	"responses_websockets":                    "Removed legacy rollout flag for Responses API WebSocket transport experiments.",
	"responses_websockets_v2":                 "Removed legacy rollout flag for Responses API WebSocket transport v2 experiments.",
}

func (a *App) GetCodexFeatureConfig() (*CodexFeatureConfigSnapshot, error) {
	diskFile, err := readCodexFeatureConfigDiskFile()
	if err != nil {
		return nil, err
	}
	rootDocument, err := parseCodexFeatureDocument(diskFile.body, "root")
	if err != nil {
		return nil, err
	}
	featureDocument, err := parseCodexFeatureDocument(diskFile.body, "features")
	if err != nil {
		return nil, err
	}
	noticeDocument, err := parseCodexFeatureDocument(diskFile.body, "notice")
	if err != nil {
		return nil, err
	}

	values := cloneBoolMap(rootDocument.values)
	for key, value := range featureDocument.values {
		values[key] = value
	}
	for key, value := range noticeDocument.values {
		values[key] = value
	}
	unknownValues := cloneBoolMap(rootDocument.unknownValues)
	unknownSections := make(map[string]string)
	for key := range rootDocument.unknownValues {
		unknownSections[key] = "root"
	}
	for key, value := range featureDocument.unknownValues {
		unknownValues[key] = value
		unknownSections[key] = "features"
	}
	for key, value := range noticeDocument.unknownValues {
		unknownValues[key] = value
		unknownSections[key] = "notice"
	}

	definitions := cloneCodexFeatureDefinitions()
	typedValues, rawValues := readCodexTypedValues(diskFile.body, definitions)

	return &CodexFeatureConfigSnapshot{
		CodexHomePath:   diskFile.codexHome,
		ConfigPath:      diskFile.configPath,
		Exists:          diskFile.exists,
		Definitions:     definitions,
		Values:          values,
		TypedValues:     typedValues,
		RawValues:       rawValues,
		UnknownValues:   unknownValues,
		UnknownSections: unknownSections,
		Raw:             diskFile.body,
		Warnings:        append(append(append([]string(nil), rootDocument.warnings...), featureDocument.warnings...), noticeDocument.warnings...),
	}, nil
}

func (a *App) PreviewCodexFeatureConfig(input SaveCodexFeatureConfigInput) (*CodexFeatureConfigPreview, error) {
	diskFile, err := readCodexFeatureConfigDiskFile()
	if err != nil {
		return nil, err
	}
	if len(input.Changes) > 0 {
		return previewCodexTypedConfigPatch(diskFile.configPath, diskFile.body, diskFile.exists, input.Changes)
	}
	return previewCodexFeatureConfigPatch(diskFile.configPath, diskFile.body, diskFile.exists, input.Values)
}

func (a *App) SaveCodexFeatureConfig(input SaveCodexFeatureConfigInput) (*CodexFeatureConfigPreview, error) {
	diskFile, err := readCodexFeatureConfigDiskFile()
	if err != nil {
		return nil, err
	}
	var preview *CodexFeatureConfigPreview
	if len(input.Changes) > 0 {
		preview, err = previewCodexTypedConfigPatch(diskFile.configPath, diskFile.body, diskFile.exists, input.Changes)
	} else {
		preview, err = previewCodexFeatureConfigPatch(diskFile.configPath, diskFile.body, diskFile.exists, input.Values)
	}
	if err != nil {
		return nil, err
	}
	if len(input.Values) == 0 && len(input.Changes) == 0 {
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
	rootDocument, err := parseCodexFeatureDocument(existing, "root")
	if err != nil {
		return nil, err
	}
	featureDocument, err := parseCodexFeatureDocument(existing, "features")
	if err != nil {
		return nil, err
	}
	noticeDocument, err := parseCodexFeatureDocument(existing, "notice")
	if err != nil {
		return nil, err
	}
	keySections, err := codexConfigKeySections(rootDocument, featureDocument, noticeDocument)
	if err != nil {
		return nil, err
	}
	definitionsByKey := codexFeatureDefinitionsByKey()
	groupedInput, err := groupCodexFeatureConfigInput(inputValues, keySections, definitionsByKey)
	if err != nil {
		return nil, err
	}

	lines := append([]string(nil), featureDocument.lines...)
	newline := featureDocument.newline
	changes := make([]CodexFeatureConfigChange, 0, len(inputValues))
	warnings := append(append(append([]string(nil), rootDocument.warnings...), featureDocument.warnings...), noticeDocument.warnings...)

	for _, sectionName := range []string{"root", "features", "notice"} {
		sectionInput := groupedInput[sectionName]
		if len(sectionInput) == 0 {
			continue
		}
		sectionDocument, err := parseCodexFeatureDocument(joinTomlDocument(lines, newline), sectionName)
		if err != nil {
			return nil, err
		}
		updatedLines, sectionChanges, _, err := previewCodexBoolSectionPatch(sectionDocument, sectionInput, definitionsByKey)
		if err != nil {
			return nil, err
		}
		lines = updatedLines
		changes = append(changes, sectionChanges...)
	}

	return &CodexFeatureConfigPreview{
		ConfigPath: configPath,
		WillCreate: !exists,
		Changes:    changes,
		Preview:    joinTomlDocument(lines, newline),
		Warnings:   warnings,
	}, nil
}

func previewCodexTypedConfigPatch(configPath string, existing string, exists bool, inputChanges []CodexConfigChangeInput) (*CodexFeatureConfigPreview, error) {
	if strings.Contains(existing, "\r\n") {
		withoutCRLF := strings.ReplaceAll(existing, "\r\n", "")
		if strings.Contains(withoutCRLF, "\n") {
			return nil, errors.New("config.toml 同时包含 CRLF 和 LF，已停止写入以避免破坏换行格式")
		}
	}

	lines, newline := splitTomlDocument(existing)
	definitionsByID := codexFeatureDefinitionsByID()
	changes := make([]CodexFeatureConfigChange, 0, len(inputChanges))

	for _, input := range inputChanges {
		normalized, definition, err := normalizeCodexTypedChangeInput(input, definitionsByID)
		if err != nil {
			return nil, err
		}
		if definition.ReadOnly {
			return nil, fmt.Errorf("%s 是只读配置，请使用对应专用编辑器或原始 config.toml 编辑器", normalized.ID)
		}

		if normalized.Remove {
			_, previousValue, hadPrevious := readCodexTypedValueFromLines(lines, newline, normalized.Path, normalized.ValueType)
			changeType := "unchanged"
			if hadPrevious {
				changeType = "removed"
				lines = deleteCodexTypedConfigPath(lines, normalized.Path, normalized.ValueType)
			}
			change := CodexFeatureConfigChange{
				ID:            normalized.ID,
				Section:       normalized.Section,
				Key:           normalized.Key,
				Path:          append([]string(nil), normalized.Path...),
				ValueType:     normalized.ValueType,
				Type:          changeType,
				PreviousValue: previousValue,
			}
			if (normalized.ValueType == "boolean" || normalized.ValueType == "bool") && hadPrevious {
				if previousBool, ok := previousValue.(bool); ok {
					previousCopy := previousBool
					change.PreviousEnabled = &previousCopy
				}
			}
			changes = append(changes, change)
			continue
		}

		formattedValue, nextValue, err := formatCodexTypedConfigValue(normalized.ValueType, normalized.Value)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", normalized.ID, err)
		}

		previousRaw, previousValue, hadPrevious := readCodexTypedValueFromLines(lines, newline, normalized.Path, normalized.ValueType)
		changeType := "added"
		if hadPrevious {
			if strings.TrimSpace(previousRaw) == formattedValue {
				changeType = "unchanged"
			} else {
				changeType = "updated"
			}
		}

		if isCodexTomlSectionValueType(normalized.ValueType) && codexRawTomlStartsWithSection(formattedValue) {
			lines, err = replaceCodexRawTomlSectionPath(lines, newline, normalized.Path, formattedValue)
			if err != nil {
				return nil, fmt.Errorf("%s: %w", normalized.ID, err)
			}
		} else {
			lines = upsertCodexTypedConfigPath(lines, normalized.Path, formattedValue)
		}
		change := CodexFeatureConfigChange{
			ID:            normalized.ID,
			Section:       normalized.Section,
			Key:           normalized.Key,
			Path:          append([]string(nil), normalized.Path...),
			ValueType:     normalized.ValueType,
			Type:          changeType,
			PreviousValue: previousValue,
			NextValue:     nextValue,
		}
		if normalized.ValueType == "boolean" || normalized.ValueType == "bool" {
			if previousBool, ok := previousValue.(bool); ok && hadPrevious {
				previousCopy := previousBool
				change.PreviousEnabled = &previousCopy
			}
			if nextBool, ok := nextValue.(bool); ok {
				change.NextEnabled = nextBool
			}
		}
		changes = append(changes, change)
	}

	return &CodexFeatureConfigPreview{
		ConfigPath: configPath,
		WillCreate: !exists,
		Changes:    changes,
		Preview:    joinTomlDocument(lines, newline),
		Warnings:   []string{},
	}, nil
}

func normalizeCodexTypedChangeInput(input CodexConfigChangeInput, definitionsByID map[string]CodexFeatureDefinition) (CodexConfigChangeInput, CodexFeatureDefinition, error) {
	path := append([]string(nil), input.Path...)
	for index := range path {
		path[index] = strings.TrimSpace(path[index])
		if path[index] == "" {
			return CodexConfigChangeInput{}, CodexFeatureDefinition{}, errors.New("配置 path 不能为空")
		}
	}
	if len(path) == 0 {
		section := strings.TrimSpace(input.Section)
		key := strings.TrimSpace(input.Key)
		if key == "" {
			return CodexConfigChangeInput{}, CodexFeatureDefinition{}, errors.New("缺少配置 key")
		}
		if section == "" || section == "root" {
			path = []string{key}
		} else {
			path = []string{section, key}
		}
	}
	if len(path) == 0 {
		return CodexConfigChangeInput{}, CodexFeatureDefinition{}, errors.New("缺少配置 path")
	}

	id := strings.TrimSpace(input.ID)
	if id == "" {
		id = codexConfigPathID(path)
	}
	definition, known := definitionsByID[id]
	if !known {
		if byPath, ok := definitionsByID[codexConfigPathID(path)]; ok {
			definition = byPath
			known = true
		}
	}
	if !known && len(path) == 3 && path[0] == "model_providers" {
		definition = CodexFeatureDefinition{
			ID:        codexConfigPathID(path),
			Section:   "model_providers",
			Key:       path[2],
			Path:      path,
			Stage:     "unknown",
			ValueType: "string",
		}
		known = true
	}
	if !known && isEditableCodexRootTableLeafPath(path) {
		definition = CodexFeatureDefinition{
			ID:        codexConfigPathID(path),
			Section:   "root",
			Key:       path[len(path)-1],
			Path:      path,
			Stage:     "unknown",
			ValueType: inferCodexConfigValueType(input.Value),
		}
		known = true
	}
	if !known {
		return CodexConfigChangeInput{}, CodexFeatureDefinition{}, fmt.Errorf("%s 不在当前 Codex 配置 definitions 中，已停止写入", id)
	}

	valueType := strings.TrimSpace(input.ValueType)
	if valueType == "" {
		valueType = definition.ValueType
	}
	if valueType == "" {
		valueType = "boolean"
	}
	section := definition.Section
	if section == "" {
		section = codexConfigPathSection(path)
	}
	key := definition.Key
	if key == "" {
		key = path[len(path)-1]
	}

	return CodexConfigChangeInput{
		ID:        id,
		Section:   section,
		Key:       key,
		Path:      path,
		ValueType: valueType,
		Value:     input.Value,
		Remove:    input.Remove,
	}, definition, nil
}

func upsertCodexTypedConfigPath(lines []string, path []string, value string) []string {
	if len(path) == 1 {
		return upsertRootTomlKey(lines, path[0], value, true)
	}
	if isCodexCompositeFeatureChildPath(path) {
		lines = deleteTomlSectionKey(lines, "features", path[1])
	}
	sectionName := formatTomlPath(path[:len(path)-1])
	return upsertTomlSectionKey(lines, sectionName, path[len(path)-1], value, true)
}

func deleteCodexTypedConfigPath(lines []string, path []string, valueType string) []string {
	if len(path) == 0 {
		return lines
	}
	if isCodexTomlSectionValueType(valueType) {
		return deleteCodexTomlSectionPath(lines, path)
	}
	if len(path) == 1 {
		return deleteTomlRootKey(lines, path[0])
	}
	if isCodexCompositeFeatureEnabledPath(path) {
		lines = deleteTomlSectionKey(lines, "features", path[1])
	}
	sectionName := formatTomlPath(path[:len(path)-1])
	return deleteTomlSectionKey(lines, sectionName, path[len(path)-1])
}

func isEditableCodexRootTableLeafPath(path []string) bool {
	if len(path) < 2 {
		return false
	}
	switch path[0] {
	case "marketplaces", "plugins":
		return true
	default:
		return false
	}
}

func isCodexCompositeFeatureChildPath(path []string) bool {
	if len(path) < 3 || path[0] != "features" {
		return false
	}
	_, ok := codexCompositeFeatureKeys[path[1]]
	return ok
}

func isCodexCompositeFeatureEnabledPath(path []string) bool {
	return isCodexCompositeFeatureChildPath(path) && path[len(path)-1] == "enabled"
}

func inferCodexConfigValueType(value any) string {
	switch typed := value.(type) {
	case bool:
		return "boolean"
	case int, int64:
		return "integer"
	case float64:
		if typed == float64(int64(typed)) {
			return "integer"
		}
		return "number"
	case []string, []any:
		return "string_array"
	default:
		return "string"
	}
}

func formatCodexTypedConfigValue(valueType string, value any) (string, any, error) {
	switch strings.ToLower(strings.TrimSpace(valueType)) {
	case "bool", "boolean":
		boolValue, ok := coerceCodexBool(value)
		if !ok {
			return "", nil, errors.New("需要 boolean 值")
		}
		return formatTomlBool(boolValue), boolValue, nil
	case "integer", "int":
		intValue, ok := coerceCodexInt(value)
		if !ok {
			return "", nil, errors.New("需要 integer 值")
		}
		return strconv.FormatInt(intValue, 10), intValue, nil
	case "number":
		numberValue, ok := coerceCodexNumber(value)
		if !ok {
			return "", nil, errors.New("需要 number 值")
		}
		return strconv.FormatFloat(numberValue, 'f', -1, 64), numberValue, nil
	case "string_array", "array":
		values, ok := coerceCodexStringArray(value)
		if !ok {
			return "", nil, errors.New("需要字符串数组，或用换行/逗号分隔的字符串")
		}
		quoted := make([]string, 0, len(values))
		for _, item := range values {
			quoted = append(quoted, quoteTomlString(item))
		}
		return "[" + strings.Join(quoted, ", ") + "]", values, nil
	case "toml", "raw", "raw_toml":
		text := strings.TrimSpace(fmt.Sprint(value))
		if text == "" {
			return "", nil, errors.New("TOML 原始值不能为空")
		}
		return text, text, nil
	case "text", "textarea", "enum", "string":
		text, ok := value.(string)
		if !ok {
			text = fmt.Sprint(value)
		}
		return quoteTomlString(text), text, nil
	default:
		text, ok := value.(string)
		if !ok {
			text = fmt.Sprint(value)
		}
		return quoteTomlString(text), text, nil
	}
}

func coerceCodexBool(value any) (bool, bool) {
	switch typed := value.(type) {
	case bool:
		return typed, true
	case string:
		switch strings.ToLower(strings.TrimSpace(typed)) {
		case "true":
			return true, true
		case "false":
			return false, true
		}
	default:
		return false, false
	}
	return false, false
}

func coerceCodexInt(value any) (int64, bool) {
	switch typed := value.(type) {
	case int:
		return int64(typed), true
	case int64:
		return typed, true
	case float64:
		if typed == float64(int64(typed)) {
			return int64(typed), true
		}
	case string:
		parsed, err := strconv.ParseInt(strings.TrimSpace(typed), 10, 64)
		return parsed, err == nil
	}
	return 0, false
}

func coerceCodexNumber(value any) (float64, bool) {
	switch typed := value.(type) {
	case int:
		return float64(typed), true
	case int64:
		return float64(typed), true
	case float64:
		return typed, true
	case string:
		parsed, err := strconv.ParseFloat(strings.TrimSpace(typed), 64)
		return parsed, err == nil
	}
	return 0, false
}

func coerceCodexStringArray(value any) ([]string, bool) {
	switch typed := value.(type) {
	case []string:
		return typed, true
	case []any:
		values := make([]string, 0, len(typed))
		for _, item := range typed {
			text, ok := item.(string)
			if !ok {
				return nil, false
			}
			values = append(values, text)
		}
		return values, true
	case string:
		if strings.TrimSpace(typed) == "" {
			return []string{}, true
		}
		parts := strings.FieldsFunc(typed, func(ch rune) bool {
			return ch == '\n' || ch == ','
		})
		values := make([]string, 0, len(parts))
		for _, part := range parts {
			if trimmed := strings.TrimSpace(part); trimmed != "" {
				values = append(values, trimmed)
			}
		}
		return values, true
	}
	return nil, false
}

func previewCodexBoolSectionPatch(document *codexFeatureDocument, inputValues map[string]bool, definitionsByKey map[string]CodexFeatureDefinition) ([]string, []CodexFeatureConfigChange, []string, error) {
	if err := validateCodexFeatureConfigInput(inputValues, document, definitionsByKey); err != nil {
		return nil, nil, nil, err
	}

	keys := make([]string, 0, len(inputValues))
	for key := range inputValues {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	lines := append([]string(nil), document.lines...)
	changes := make([]CodexFeatureConfigChange, 0, len(keys))
	if len(keys) > 0 && !document.hasSection {
		if len(lines) > 0 && strings.TrimSpace(lines[len(lines)-1]) != "" {
			lines = append(lines, "")
		}
		lines = append(lines, fmt.Sprintf("[%s]", document.sectionName))
		document.hasSection = true
		document.sectionStart = len(lines) - 1
		document.sectionEnd = len(lines)
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

		insertAt := document.sectionEnd
		lines = append(lines, "")
		copy(lines[insertAt+1:], lines[insertAt:])
		lines[insertAt] = fmt.Sprintf("%s = %s", formatTomlKey(key), formatTomlBool(next))
		document.sectionEnd++
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

	return lines, changes, append([]string(nil), document.warnings...), nil
}

func parseCodexFeatureDocument(input string, sectionName string) (*codexFeatureDocument, error) {
	if strings.Contains(input, "\r\n") {
		withoutCRLF := strings.ReplaceAll(input, "\r\n", "")
		if strings.Contains(withoutCRLF, "\n") {
			return nil, errors.New("config.toml 同时包含 CRLF 和 LF，已停止写入以避免破坏换行格式")
		}
	}

	lines, newline := splitTomlDocument(input)
	document := &codexFeatureDocument{
		sectionName:       sectionName,
		lines:             lines,
		newline:           newline,
		values:            make(map[string]bool),
		unknownValues:     make(map[string]bool),
		keyLineIndexes:    make(map[string]int),
		nonBoolKeyIndexes: make(map[string]int),
	}

	if sectionName == "root" {
		document.hasSection = true
		document.sectionStart = -1
		document.sectionEnd = firstTomlSectionIndex(lines)
		if document.sectionEnd < 0 {
			document.sectionEnd = len(lines)
		}
		return parseCodexBoolDocumentValues(document, 0, document.sectionEnd)
	}

	sectionStart := -1
	sectionEnd := -1
	header := fmt.Sprintf("[%s]", sectionName)
	for index, line := range lines {
		if strings.TrimSpace(stripTomlLineComment(line)) != header {
			continue
		}
		if sectionStart >= 0 {
			return nil, fmt.Errorf("config.toml 包含多个 [%s] section，无法安全 patch", sectionName)
		}
		sectionStart = index
		sectionEnd = len(lines)
		for next := index + 1; next < len(lines); next++ {
			if isTomlSectionHeader(lines[next]) {
				sectionEnd = next
				break
			}
		}
	}
	if sectionStart < 0 {
		return document, nil
	}

	document.hasSection = true
	document.sectionStart = sectionStart
	document.sectionEnd = sectionEnd
	return parseCodexBoolDocumentValues(document, sectionStart+1, sectionEnd)
}

func parseCodexBoolDocumentValues(document *codexFeatureDocument, start int, end int) (*codexFeatureDocument, error) {
	knownDefinitions := codexFeatureDefinitionsByKey()
	for index := start; index < end; index++ {
		key, value, isBool, hasSimpleKey := parseTomlBoolKeyValue(document.lines[index])
		if !hasSimpleKey {
			continue
		}
		if _, exists := document.keyLineIndexes[key]; exists {
			return nil, fmt.Errorf("[%s] 中 key %q 重复，无法安全 patch", document.sectionName, key)
		}
		if _, exists := document.nonBoolKeyIndexes[key]; exists {
			return nil, fmt.Errorf("[%s] 中 key %q 重复，无法安全 patch", document.sectionName, key)
		}
		if !isBool {
			document.nonBoolKeyIndexes[key] = index
			continue
		}

		document.keyLineIndexes[key] = index
		document.values[key] = value
		definition, known := knownDefinitions[key]
		if known && definition.Section == document.sectionName && definition.LegacyAlias {
			document.warnings = append(document.warnings, fmt.Sprintf("%s.%s 是 legacy alias，建议改用 canonical key %s.%s", document.sectionName, key, document.sectionName, definition.CanonicalKey))
			continue
		}
		if !known || definition.Section != document.sectionName {
			document.unknownValues[key] = value
		}
	}

	return document, nil
}

func validateCodexFeatureConfigInput(inputValues map[string]bool, document *codexFeatureDocument, knownDefinitions map[string]CodexFeatureDefinition) error {
	for key := range inputValues {
		if strings.TrimSpace(key) != key || key == "" {
			return fmt.Errorf("%s.%s 不是支持的 bool key", document.sectionName, key)
		}
		if document.sectionName == "features" {
			if _, composite := codexCompositeFeatureKeys[key]; composite {
				return fmt.Errorf("features.%s 是复合 feature，一期不支持写入", key)
			}
		}
		if definition, known := knownDefinitions[key]; known {
			if definition.Section != document.sectionName {
				return fmt.Errorf("%s.%s 不属于当前配置区块 [%s]", document.sectionName, key, document.sectionName)
			}
			if definition.LegacyAlias {
				return fmt.Errorf("%s.%s 是 legacy alias，请写入 canonical key %s.%s", document.sectionName, key, document.sectionName, definition.CanonicalKey)
			}
		} else if _, exists := document.values[key]; !exists {
			return fmt.Errorf("%s.%s 不在当前 bool definitions 中，且本地不存在该 bool key，已停止写入", document.sectionName, key)
		}
		if _, exists := document.nonBoolKeyIndexes[key]; exists {
			return fmt.Errorf("%s.%s 不是简单 bool 值，无法安全 patch", document.sectionName, key)
		}
	}
	return nil
}

func codexConfigKeySections(documents ...*codexFeatureDocument) (map[string]string, error) {
	sections := make(map[string]string)
	for _, document := range documents {
		for key := range document.values {
			if previous, exists := sections[key]; exists && previous != document.sectionName {
				return nil, fmt.Errorf("config.toml 中 key %q 同时存在于 [%s] 和 [%s]，无法安全 patch", key, previous, document.sectionName)
			}
			sections[key] = document.sectionName
		}
	}
	return sections, nil
}

func groupCodexFeatureConfigInput(inputValues map[string]bool, keySections map[string]string, definitionsByKey map[string]CodexFeatureDefinition) (map[string]map[string]bool, error) {
	grouped := make(map[string]map[string]bool)
	for key, value := range inputValues {
		section := keySections[key]
		if section == "" {
			definition, known := definitionsByKey[key]
			if !known {
				return nil, fmt.Errorf("%s 不在当前 bool definitions 中，且本地不存在该 bool key，已停止写入", key)
			}
			section = definition.Section
		}
		if grouped[section] == nil {
			grouped[section] = make(map[string]bool)
		}
		grouped[section][key] = value
	}
	return grouped, nil
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
	key, ok := parseTomlKey(strings.TrimSpace(parts[0]))
	if !ok {
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

func readCodexTypedValues(input string, definitions []CodexFeatureDefinition) (map[string]any, map[string]string) {
	lines, newline := splitTomlDocument(input)
	typedValues := make(map[string]any)
	rawValues := make(map[string]string)
	for _, definition := range definitions {
		if len(definition.Path) == 0 {
			continue
		}
		raw, value, ok := readCodexTypedValueFromLines(lines, newline, definition.Path, definition.ValueType)
		if !ok {
			continue
		}
		typedValues[definition.ID] = value
		rawValues[definition.ID] = raw
	}
	return typedValues, rawValues
}

func readCodexTypedValueFromLines(lines []string, newline string, path []string, valueType string) (string, any, bool) {
	raw, ok := findCodexTomlPathRawValue(lines, path)
	if !ok {
		if isCodexCompositeFeatureEnabledPath(path) {
			if parentRaw, ok := findCodexTomlPathRawValue(lines, path[:2]); ok {
				return parentRaw, parseCodexTomlRawValue(parentRaw, valueType), true
			}
		}
		if isCodexTomlSectionValueType(valueType) {
			if sectionRaw, ok := findCodexTomlSectionRawValue(lines, newline, path); ok {
				return sectionRaw, parseCodexTomlRawValue(sectionRaw, valueType), true
			}
		}
		return "", nil, false
	}
	value := parseCodexTomlRawValue(raw, valueType)
	return raw, value, true
}

func isCodexTomlSectionValueType(valueType string) bool {
	switch strings.ToLower(strings.TrimSpace(valueType)) {
	case "toml", "raw", "raw_toml":
		return true
	default:
		return false
	}
}

func codexRawTomlStartsWithSection(raw string) bool {
	for _, line := range strings.Split(strings.ReplaceAll(raw, "\r\n", "\n"), "\n") {
		trimmed := strings.TrimSpace(stripTomlLineComment(line))
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		return isTomlSectionHeader(line)
	}
	return false
}

func replaceCodexRawTomlSectionPath(lines []string, newline string, path []string, raw string) ([]string, error) {
	if len(path) == 0 {
		return nil, errors.New("TOML path 不能为空")
	}
	if err := validateCodexRawTomlSectionPath(raw, path); err != nil {
		return nil, err
	}

	rawLines, _ := splitTomlDocument(raw)
	if len(rawLines) == 0 {
		return nil, errors.New("TOML 原始 section 不能为空")
	}

	insertAt := -1
	output := make([]string, 0, len(lines)+len(rawLines))
	skipping := false
	for _, line := range lines {
		if sectionName, ok := parseTomlSectionHeaderName(line); ok {
			if codexTomlSectionMatchesPath(sectionName, path) {
				if insertAt < 0 {
					insertAt = len(output)
				}
				skipping = true
				continue
			}
			skipping = false
		}
		if skipping {
			continue
		}
		output = append(output, line)
	}

	if insertAt < 0 {
		if len(output) > 0 && strings.TrimSpace(output[len(output)-1]) != "" {
			output = append(output, "")
		}
		return append(output, rawLines...), nil
	}

	replacement := make([]string, 0, len(output)+len(rawLines))
	replacement = append(replacement, output[:insertAt]...)
	replacement = append(replacement, rawLines...)
	replacement = append(replacement, output[insertAt:]...)
	return replacement, nil
}

func deleteCodexTomlSectionPath(lines []string, path []string) []string {
	if len(path) == 0 {
		return lines
	}
	output := make([]string, 0, len(lines))
	skipping := false
	for _, line := range lines {
		if sectionName, ok := parseTomlSectionHeaderName(line); ok {
			if codexTomlSectionMatchesPath(sectionName, path) {
				skipping = true
				continue
			}
			skipping = false
		}
		if skipping {
			continue
		}
		output = append(output, line)
	}
	return output
}

func validateCodexRawTomlSectionPath(raw string, path []string) error {
	seenSection := false
	for _, line := range strings.Split(strings.ReplaceAll(raw, "\r\n", "\n"), "\n") {
		sectionName, ok := parseTomlSectionHeaderName(line)
		if !ok {
			continue
		}
		seenSection = true
		if !codexTomlSectionMatchesPath(sectionName, path) {
			return fmt.Errorf("TOML section [%s] 不属于 %s", sectionName, strings.Join(path, "."))
		}
	}
	if !seenSection {
		return errors.New("TOML 原始 section 必须包含 section header")
	}
	return nil
}

func parseTomlSectionHeaderName(line string) (string, bool) {
	trimmed := strings.TrimSpace(stripTomlLineComment(line))
	if strings.HasPrefix(trimmed, "[[") && strings.HasSuffix(trimmed, "]]") {
		name := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(trimmed, "[["), "]]"))
		return name, name != ""
	}
	if strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]") {
		name := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(trimmed, "["), "]"))
		return name, name != ""
	}
	return "", false
}

func codexTomlSectionMatchesPath(sectionName string, path []string) bool {
	sectionPath, ok := parseTomlDottedKeyPath(sectionName)
	if !ok {
		prefix := strings.Join(path, ".")
		return sectionName == prefix || strings.HasPrefix(sectionName, prefix+".")
	}
	if len(sectionPath) < len(path) {
		return false
	}
	for index := range path {
		if sectionPath[index] != path[index] {
			return false
		}
	}
	return true
}

func findCodexTomlSectionRawValue(lines []string, newline string, path []string) (string, bool) {
	if len(path) == 0 {
		return "", false
	}
	start, end, found := findTomlSectionByPath(lines, path)
	if !found {
		if prefixRaw, ok := findCodexTomlSectionPrefixRawValue(lines, newline, path); ok {
			return prefixRaw, true
		}
		return "", false
	}
	if newline == "" {
		newline = "\n"
	}
	return strings.Join(lines[start:end], newline) + newline, true
}

func findCodexTomlSectionPrefixRawValue(lines []string, newline string, path []string) (string, bool) {
	if len(path) == 0 {
		return "", false
	}
	if newline == "" {
		newline = "\n"
	}
	var blocks []string
	for index := 0; index < len(lines); {
		sectionName, ok := parseTomlSectionHeaderName(lines[index])
		if !ok || !codexTomlSectionMatchesPath(sectionName, path) {
			index++
			continue
		}
		end := len(lines)
		for next := index + 1; next < len(lines); next++ {
			if isTomlSectionHeader(lines[next]) {
				end = next
				break
			}
		}
		blocks = append(blocks, strings.Join(lines[index:end], newline))
		index = end
	}
	if len(blocks) == 0 {
		return "", false
	}
	return strings.Join(blocks, newline+newline) + newline, true
}

func findCodexTomlPathRawValue(lines []string, path []string) (string, bool) {
	if len(path) == 0 {
		return "", false
	}
	start := 0
	end := firstTomlSectionIndex(lines)
	if len(path) > 1 {
		sectionStart, sectionEnd, found := findTomlSectionByPath(lines, path[:len(path)-1])
		if !found {
			return "", false
		}
		start = sectionStart + 1
		end = sectionEnd
	}
	key := path[len(path)-1]
	for index := start; index < end; index++ {
		parsedKey, rawValue, ok := parseTomlSimpleKeyRawValue(lines[index])
		if ok && parsedKey == key {
			return rawValue, true
		}
	}
	return "", false
}

func parseTomlSimpleKeyRawValue(line string) (string, string, bool) {
	content := strings.TrimSpace(stripTomlLineComment(line))
	if content == "" || strings.HasPrefix(content, "#") {
		return "", "", false
	}
	parts := strings.SplitN(content, "=", 2)
	if len(parts) != 2 {
		return "", "", false
	}
	key, ok := parseTomlKey(strings.TrimSpace(parts[0]))
	if !ok {
		return "", "", false
	}
	return key, strings.TrimSpace(parts[1]), true
}

func parseCodexTomlRawValue(raw string, valueType string) any {
	trimmed := strings.TrimSpace(raw)
	switch strings.ToLower(strings.TrimSpace(valueType)) {
	case "bool", "boolean":
		return trimmed == "true"
	case "integer", "int":
		if parsed, err := strconv.ParseInt(trimmed, 10, 64); err == nil {
			return parsed
		}
	case "number":
		if parsed, err := strconv.ParseFloat(trimmed, 64); err == nil {
			return parsed
		}
	case "string_array", "array":
		if values, ok := parseTomlStringArray(trimmed); ok {
			return values
		}
	case "string", "enum", "text", "textarea":
		if parsed, ok := parseTomlStringValue(trimmed); ok {
			return parsed
		}
	}
	if parsed, ok := parseTomlStringValue(trimmed); ok {
		return parsed
	}
	return trimmed
}

func parseTomlStringValue(raw string) (string, bool) {
	if len(raw) >= 2 && raw[0] == '"' {
		parsed, err := strconv.Unquote(raw)
		return parsed, err == nil
	}
	if len(raw) >= 2 && raw[0] == '\'' && raw[len(raw)-1] == '\'' {
		return raw[1 : len(raw)-1], true
	}
	return "", false
}

func parseTomlStringArray(raw string) ([]string, bool) {
	trimmed := strings.TrimSpace(raw)
	if !strings.HasPrefix(trimmed, "[") || !strings.HasSuffix(trimmed, "]") {
		return nil, false
	}
	body := strings.TrimSpace(trimmed[1 : len(trimmed)-1])
	if body == "" {
		return []string{}, true
	}
	parts, ok := splitTomlArrayItems(body)
	if !ok {
		return nil, false
	}
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		value, ok := parseTomlStringValue(strings.TrimSpace(part))
		if !ok {
			return nil, false
		}
		values = append(values, value)
	}
	return values, true
}

func splitTomlArrayItems(body string) ([]string, bool) {
	var parts []string
	start := 0
	inSingle := false
	inDouble := false
	escaped := false
	for index, ch := range body {
		switch ch {
		case '\\':
			if inDouble {
				escaped = !escaped
			}
		case '"':
			if !inSingle && !escaped {
				inDouble = !inDouble
			}
			escaped = false
		case '\'':
			if !inDouble {
				inSingle = !inSingle
			}
			escaped = false
		case ',':
			if !inSingle && !inDouble {
				parts = append(parts, body[start:index])
				start = index + 1
			}
			escaped = false
		default:
			escaped = false
		}
	}
	if inSingle || inDouble {
		return nil, false
	}
	parts = append(parts, body[start:])
	return parts, true
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

func parseTomlKey(raw string) (string, bool) {
	if isBareTomlKey(raw) {
		return raw, true
	}
	if len(raw) >= 2 && raw[0] == '"' && raw[len(raw)-1] == '"' {
		unquoted, err := strconv.Unquote(raw)
		if err == nil {
			return unquoted, true
		}
	}
	if len(raw) >= 2 && raw[0] == '\'' && raw[len(raw)-1] == '\'' {
		return raw[1 : len(raw)-1], true
	}
	return "", false
}

func parseTomlDottedKeyPath(raw string) ([]string, bool) {
	parts, ok := splitTomlDottedKey(raw)
	if !ok || len(parts) == 0 {
		return nil, false
	}
	path := make([]string, 0, len(parts))
	for _, part := range parts {
		key, ok := parseTomlKey(strings.TrimSpace(part))
		if !ok {
			return nil, false
		}
		path = append(path, key)
	}
	return path, true
}

func splitTomlDottedKey(raw string) ([]string, bool) {
	var parts []string
	start := 0
	inSingle := false
	inDouble := false
	escaped := false
	for index, ch := range raw {
		switch ch {
		case '\\':
			if inDouble {
				escaped = !escaped
			}
		case '"':
			if !inSingle && !escaped {
				inDouble = !inDouble
			}
			escaped = false
		case '\'':
			if !inDouble {
				inSingle = !inSingle
			}
			escaped = false
		case '.':
			if !inSingle && !inDouble {
				parts = append(parts, raw[start:index])
				start = index + 1
			}
			escaped = false
		default:
			escaped = false
		}
	}
	if inSingle || inDouble {
		return nil, false
	}
	parts = append(parts, raw[start:])
	return parts, true
}

func formatTomlKey(key string) string {
	if isBareTomlKey(key) {
		return key
	}
	return quoteTomlString(key)
}

func formatTomlPath(path []string) string {
	parts := make([]string, 0, len(path))
	for _, key := range path {
		parts = append(parts, formatTomlKey(key))
	}
	return strings.Join(parts, ".")
}

func findTomlSectionByPath(lines []string, path []string) (int, int, bool) {
	header := "[" + formatTomlPath(path) + "]"
	if start, end, found := findTomlSection(lines, header); found {
		return start, end, true
	}
	for index, line := range lines {
		sectionName, ok := parseTomlSectionHeaderName(line)
		if !ok || !codexTomlSectionMatchesPath(sectionName, path) {
			continue
		}
		sectionPath, ok := parseTomlDottedKeyPath(sectionName)
		if !ok || len(sectionPath) != len(path) {
			continue
		}
		end := len(lines)
		for next := index + 1; next < len(lines); next++ {
			if isTomlSectionHeader(lines[next]) {
				end = next
				break
			}
		}
		return index, end, true
	}
	return 0, 0, false
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
	definitions := make([]CodexFeatureDefinition, 0, len(codexFeatureDefinitions)+len(codexNoticeDefinitions)+len(codexRootBoolDefinitions)+len(codexRootTypedDefinitions)+len(codexModelProviderEditableDefinitions))
	for _, definition := range codexRootBoolDefinitions {
		definitions = append(definitions, enrichCodexFeatureDefinition(definition))
	}
	for _, definition := range codexRootTypedDefinitions {
		definitions = append(definitions, enrichCodexFeatureDefinition(definition))
	}
	for _, definition := range codexFeatureDefinitions {
		definition.Section = "features"
		definitions = append(definitions, enrichCodexFeatureDefinition(definition))
	}
	for _, definition := range codexNoticeDefinitions {
		definitions = append(definitions, enrichCodexFeatureDefinition(definition))
	}
	for _, providerID := range codexConfiguredModelProviderIDs() {
		for _, definition := range codexModelProviderEditableDefinitions {
			definition.ID = strings.Join([]string{"model_providers", providerID, definition.Key}, ".")
			definition.Path = []string{"model_providers", providerID, definition.Key}
			definition.Section = "model_providers"
			definition.Description = fmt.Sprintf("Model provider %s field %s.", providerID, definition.Key)
			definitions = append(definitions, enrichCodexFeatureDefinition(definition))
		}
	}
	return definitions
}

func enrichCodexFeatureDefinition(definition CodexFeatureDefinition) CodexFeatureDefinition {
	if definition.Section == "" {
		definition.Section = "features"
	}
	if definition.ValueType == "" {
		definition.ValueType = "boolean"
	}
	if len(definition.Path) == 0 {
		if definition.Section == "root" {
			definition.Path = []string{definition.Key}
		} else {
			definition.Path = []string{definition.Section, definition.Key}
		}
	}
	if definition.ID == "" {
		definition.ID = codexConfigDefinitionID(definition)
	}
	if definition.DefaultValue == nil && (definition.ValueType == "boolean" || definition.ValueType == "bool") {
		definition.DefaultValue = definition.DefaultEnabled
	}
	if definition.Description == "" {
		definition.Description = codexFeatureDescription(definition)
	}
	return definition
}

func codexConfigDefinitionID(definition CodexFeatureDefinition) string {
	if len(definition.Path) > 0 {
		return codexConfigPathID(definition.Path)
	}
	if definition.Section == "root" {
		return "root." + definition.Key
	}
	return definition.Section + "." + definition.Key
}

func codexConfigPathID(path []string) string {
	if len(path) == 1 {
		return "root." + path[0]
	}
	return strings.Join(path, ".")
}

func codexConfigPathSection(path []string) string {
	if len(path) <= 1 {
		return "root"
	}
	return path[0]
}

func codexFeatureDescription(definition CodexFeatureDefinition) string {
	if description := codexFeatureDescriptions[definition.Key]; description != "" {
		return description
	}
	if definition.LegacyAlias && definition.CanonicalKey != "" {
		return fmt.Sprintf("Legacy alias for %s. Prefer the canonical feature key.", definition.CanonicalKey)
	}
	if definition.ValueType == "boolean" || definition.ValueType == "bool" {
		return fmt.Sprintf("Boolean Codex feature flag for %s.", definition.Key)
	}
	return fmt.Sprintf("Codex config %s.", definition.ID)
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
	definitionsByKey := make(map[string]CodexFeatureDefinition, len(codexFeatureDefinitions)+len(codexNoticeDefinitions)+len(codexRootBoolDefinitions)+len(codexRootTypedDefinitions))
	for _, definition := range codexRootBoolDefinitions {
		definitionsByKey[definition.Key] = enrichCodexFeatureDefinition(definition)
	}
	for _, definition := range codexRootTypedDefinitions {
		definitionsByKey[definition.Key] = enrichCodexFeatureDefinition(definition)
	}
	for _, definition := range codexFeatureDefinitions {
		definition.Section = "features"
		definitionsByKey[definition.Key] = enrichCodexFeatureDefinition(definition)
	}
	for _, definition := range codexNoticeDefinitions {
		definitionsByKey[definition.Key] = enrichCodexFeatureDefinition(definition)
	}
	return definitionsByKey
}

func codexFeatureDefinitionsByID() map[string]CodexFeatureDefinition {
	definitions := cloneCodexFeatureDefinitions()
	definitionsByID := make(map[string]CodexFeatureDefinition, len(definitions))
	for _, definition := range definitions {
		definitionsByID[definition.ID] = definition
		definitionsByID[codexConfigPathID(definition.Path)] = definition
	}
	return definitionsByID
}

func codexConfiguredModelProviderIDs() []string {
	ids := map[string]struct{}{
		"gettokens": {},
		"openai":    {},
	}
	diskFile, err := readCodexFeatureConfigDiskFile()
	if err != nil {
		return sortedCodexModelProviderIDs(ids)
	}
	lines, _ := splitTomlDocument(diskFile.body)
	if raw, ok := findCodexTomlPathRawValue(lines, []string{"model_provider"}); ok {
		if providerID, ok := parseTomlStringValue(raw); ok && strings.TrimSpace(providerID) != "" {
			ids[strings.TrimSpace(providerID)] = struct{}{}
		}
	}
	for _, line := range lines {
		trimmed := strings.TrimSpace(stripTomlLineComment(line))
		if !strings.HasPrefix(trimmed, "[model_providers.") || !strings.HasSuffix(trimmed, "]") {
			continue
		}
		id := strings.TrimSuffix(strings.TrimPrefix(trimmed, "[model_providers."), "]")
		id = strings.TrimSpace(id)
		if id != "" && !strings.Contains(id, ".") {
			ids[id] = struct{}{}
		}
	}
	return sortedCodexModelProviderIDs(ids)
}

func sortedCodexModelProviderIDs(ids map[string]struct{}) []string {
	out := make([]string, 0, len(ids))
	for id := range ids {
		out = append(out, id)
	}
	sort.Strings(out)
	return out
}
