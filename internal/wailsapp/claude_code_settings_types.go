package wailsapp

type ClaudeCodeSettingsScope string

const (
	SettingsScopeUser    ClaudeCodeSettingsScope = "user"
	SettingsScopeProject ClaudeCodeSettingsScope = "project"
	SettingsScopeLocal   ClaudeCodeSettingsScope = "local"
	SettingsScopeManaged ClaudeCodeSettingsScope = "managed"
)

type ClaudeCodeSettingsLayer struct {
	Scope       ClaudeCodeSettingsScope  `json:"scope"`
	Path        string                   `json:"path"`
	Exists      bool                     `json:"exists"`
	ParseError  string                   `json:"parseError,omitempty"`
	KnownFields *ClaudeCodeSettingsFields `json:"knownFields,omitempty"`
}

type ClaudeCodeSettingsFields struct {
	Env             map[string]string `json:"env,omitempty"`
	Permissions     map[string]any    `json:"permissions,omitempty"`
	DisableAllHooks *bool             `json:"disableAllHooks,omitempty"`
	OutputStyle     string            `json:"outputStyle,omitempty"`
}

type ClaudeCodeSettingsSnapshot struct {
	ProjectPath string                    `json:"projectPath"`
	Layers      []ClaudeCodeSettingsLayer `json:"layers"`
	Warnings    []string                  `json:"warnings,omitempty"`
}

type PatchClaudeCodeSettingsInput struct {
	Scope   ClaudeCodeSettingsScope `json:"scope"`
	Path    string                  `json:"path"`
	Patches map[string]any          `json:"patches"`
}

type ClaudeCodeSettingsChange struct {
	Key    string `json:"key"`
	Before any    `json:"before"`
	After  any    `json:"after"`
}

type PatchClaudeCodeSettingsResult struct {
	ConfigPath string                     `json:"configPath"`
	Preview    string                     `json:"preview"`
	Changes    []ClaudeCodeSettingsChange `json:"changes"`
}
