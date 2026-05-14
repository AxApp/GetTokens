package wailsapp

type CodexSkillFile struct {
	Path        string `json:"path"`
	Kind        string `json:"kind"`
	Content     string `json:"content,omitempty"`
	Previewable bool   `json:"previewable"`
}

type GetCodexSkillFilePreviewInput struct {
	SkillPath string `json:"skillPath"`
	FilePath  string `json:"filePath"`
}

type GetCodexSkillFilePreviewResult struct {
	Path        string `json:"path"`
	Content     string `json:"content,omitempty"`
	Previewable bool   `json:"previewable"`
}

type CodexSkillRecord struct {
	ID              string           `json:"id"`
	Name            string           `json:"name"`
	Description     string           `json:"description,omitempty"`
	Enabled         bool             `json:"enabled"`
	RootLabel       string           `json:"rootLabel"`
	RootPath        string           `json:"rootPath"`
	SourceKind      string           `json:"sourceKind"`
	Origin          string           `json:"origin"`
	VersionLabel    string           `json:"versionLabel,omitempty"`
	Files           []CodexSkillFile `json:"files"`
	SkillMarkdown   string           `json:"skillMarkdown"`
	PreviewMarkdown string           `json:"previewMarkdown"`
	Warnings        []string         `json:"warnings,omitempty"`
}

type CodexSkillsSnapshot struct {
	CodexHomePath string             `json:"codexHomePath"`
	ConfigPath    string             `json:"configPath"`
	Roots         []CodexSkillRoot   `json:"roots"`
	Skills        []CodexSkillRecord `json:"skills"`
	Warnings      []string           `json:"warnings,omitempty"`
}

type CodexSkillRoot struct {
	Label      string `json:"label"`
	Path       string `json:"path"`
	SourceKind string `json:"sourceKind"`
	Exists     bool   `json:"exists"`
}

type SaveCodexSkillEnabledInput struct {
	Path    string `json:"path"`
	Name    string `json:"name,omitempty"`
	Enabled bool   `json:"enabled"`
}

type SaveCodexSkillEnabledResult struct {
	ConfigPath string `json:"configPath"`
	Preview    string `json:"preview"`
}

type RemoveCodexSkillInput struct {
	Path string `json:"path"`
}

type RemoveCodexSkillResult struct {
	ConfigPath  string `json:"configPath"`
	RemovedPath string `json:"removedPath"`
	Preview     string `json:"preview"`
}

type OpenCodexSkillInFinderInput struct {
	Path string `json:"path"`
}

type OpenCodexSkillInFinderResult struct {
	Path string `json:"path"`
}

type CodexGitSkillSource struct {
	Provider string `json:"provider"`
	Host     string `json:"host"`
	Repo     string `json:"repo"`
	Ref      string `json:"ref"`
	Path     string `json:"path"`
}

type CodexMcpEnvRow struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type CodexMcpToolRow struct {
	Name         string `json:"name"`
	ApprovalMode string `json:"approvalMode,omitempty"`
}

type CodexMcpServer struct {
	ID                        string            `json:"id"`
	Label                     string            `json:"label"`
	Enabled                   bool              `json:"enabled"`
	Transport                 string            `json:"transport"`
	Command                   string            `json:"command,omitempty"`
	Args                      []string          `json:"args,omitempty"`
	Env                       []CodexMcpEnvRow  `json:"env,omitempty"`
	EnvVarsRaw                string            `json:"envVarsRaw,omitempty"`
	Cwd                       string            `json:"cwd,omitempty"`
	URL                       string            `json:"url,omitempty"`
	BearerTokenEnvVar         string            `json:"bearerTokenEnvVar,omitempty"`
	HTTPHeaders               []CodexMcpEnvRow  `json:"httpHeaders,omitempty"`
	EnvHTTPHeaders            []CodexMcpEnvRow  `json:"envHttpHeaders,omitempty"`
	ExperimentalEnvironment   string            `json:"experimentalEnvironment,omitempty"`
	Required                  bool              `json:"required,omitempty"`
	SupportsParallelToolCalls bool              `json:"supportsParallelToolCalls,omitempty"`
	StartupTimeoutSec         string            `json:"startupTimeoutSec,omitempty"`
	ToolTimeoutSec            string            `json:"toolTimeoutSec,omitempty"`
	DefaultToolsApprovalMode  string            `json:"defaultToolsApprovalMode,omitempty"`
	EnabledTools              []string          `json:"enabledTools,omitempty"`
	DisabledTools             []string          `json:"disabledTools,omitempty"`
	Scopes                    []string          `json:"scopes,omitempty"`
	OAuthResource             string            `json:"oauthResource,omitempty"`
	Tools                     []CodexMcpToolRow `json:"tools,omitempty"`
	RawConfig                 string            `json:"rawConfig,omitempty"`
	SourcePath                string            `json:"sourcePath"`
	Status                    string            `json:"status"`
	Warnings                  []string          `json:"warnings,omitempty"`
}

type CodexMcpServersSnapshot struct {
	CodexHomePath string           `json:"codexHomePath"`
	ConfigPath    string           `json:"configPath"`
	Exists        bool             `json:"exists"`
	Servers       []CodexMcpServer `json:"servers"`
	Warnings      []string         `json:"warnings,omitempty"`
}

type SaveCodexMcpServerInput struct {
	Server CodexMcpServer `json:"server"`
}

type SaveCodexMcpServerResult struct {
	ConfigPath string           `json:"configPath"`
	Server     CodexMcpServer   `json:"server"`
	Preview    string           `json:"preview"`
	Changes    []CodexMcpChange `json:"changes"`
}

type CodexMcpChange struct {
	Key    string `json:"key"`
	Before string `json:"before"`
	After  string `json:"after"`
}

type OpenCodexConfigTomlResult struct {
	ConfigPath string `json:"configPath"`
}

type CodexConfigTomlDocument struct {
	ConfigPath string `json:"configPath"`
	Content    string `json:"content"`
	Exists     bool   `json:"exists"`
}

type SaveCodexConfigTomlInput struct {
	Content string `json:"content"`
}

type SaveCodexConfigTomlResult struct {
	ConfigPath string `json:"configPath"`
	Content    string `json:"content"`
}

type codexSkillFrontmatter struct {
	Name        string `yaml:"name"`
	Description string `yaml:"description"`
	Metadata    struct {
		ShortDescription string `yaml:"short-description"`
	} `yaml:"metadata"`
}

type codexMcpDocument struct {
	lines        []string
	newline      string
	configPath   string
	exists       bool
	servers      []codexMcpServerSection
	tools        map[string][]CodexMcpToolRow
	toolSections map[string][]codexMcpServerSection
}

type codexMcpServerSection struct {
	id    string
	start int
	end   int
	lines []string
}
