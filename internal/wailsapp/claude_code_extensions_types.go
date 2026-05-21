package wailsapp

type ClaudeCodeExtensionsSnapshot struct {
	ClaudeConfigDirPath string                 `json:"claudeConfigDirPath"`
	ClaudeJSONPath      string                 `json:"claudeJsonPath"`
	ProjectPath         string                 `json:"projectPath"`
	Skills              []ClaudeCodeSkillAsset `json:"skills"`
	McpServers          []ClaudeCodeMcpAsset   `json:"mcpServers"`
	Warnings            []string               `json:"warnings,omitempty"`
}

type ClaudeCodeSkillAsset struct {
	ID                  string `json:"id"`
	Name                string `json:"name"`
	Description         string `json:"description"`
	Scope               string `json:"scope"`
	Path                string `json:"path"`
	FrontmatterStatus   string `json:"frontmatterStatus"`
	Invocation          string `json:"invocation"`
	ModelInvocation     string `json:"modelInvocation"`
	Removable           bool   `json:"removable"`
	FileCount           int    `json:"fileCount"`
	Risk                string `json:"risk,omitempty"`
	PreviewMarkdown     string `json:"previewMarkdown,omitempty"`
	FrontmatterError    string `json:"frontmatterError,omitempty"`
	LegacyCommandSource string `json:"legacyCommandSource,omitempty"`
}

type ClaudeCodeMcpAsset struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Transport   string `json:"transport"`
	Scope       string `json:"scope"`
	SourcePath  string `json:"sourcePath"`
	Endpoint    string `json:"endpoint"`
	Active      bool   `json:"active"`
	SecretState string `json:"secretState"`
	Dirty       bool   `json:"dirty,omitempty"`
	ShadowedBy  string `json:"shadowedBy,omitempty"`
}

type SaveClaudeCodeMcpServerInput struct {
	Server ClaudeCodeMcpAsset `json:"server"`
}

type ClaudeCodeMcpChange struct {
	Key    string `json:"key"`
	Before string `json:"before"`
	After  string `json:"after"`
}

type SaveClaudeCodeMcpServerResult struct {
	ConfigPath string                `json:"configPath"`
	Server     ClaudeCodeMcpAsset    `json:"server"`
	Preview    string                `json:"preview"`
	Changes    []ClaudeCodeMcpChange `json:"changes"`
}

type claudeCodeSkillFrontmatter struct {
	Name                   string `yaml:"name"`
	Description            string `yaml:"description"`
	WhenToUse              string `yaml:"when_to_use"`
	UserInvocable          *bool  `yaml:"user-invocable"`
	DisableModelInvocation *bool  `yaml:"disable-model-invocation"`
}
