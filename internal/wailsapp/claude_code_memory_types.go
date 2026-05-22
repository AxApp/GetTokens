package wailsapp

type ClaudeCodeMemoryFileScope string

const (
	MemoryFileScopeUser    ClaudeCodeMemoryFileScope = "user"
	MemoryFileScopeProject ClaudeCodeMemoryFileScope = "project"
	MemoryFileScopeLocal   ClaudeCodeMemoryFileScope = "local"
)

type ClaudeCodeMemoryFileRecord struct {
	Scope            ClaudeCodeMemoryFileScope    `json:"scope"`
	Path             string                       `json:"path"`
	Exists           bool                         `json:"exists"`
	GitIgnored       bool                         `json:"gitIgnored,omitempty"`
	Imports          []ClaudeCodeMemoryFileImport `json:"imports,omitempty"`
	Content          string                       `json:"content,omitempty"`
	ContentTruncated bool                         `json:"contentTruncated,omitempty"`
	Size             int64                        `json:"size"`
}

type ClaudeCodeMemoryFileImport struct {
	Raw      string `json:"raw"`
	Resolved string `json:"resolved"`
	Exists   bool   `json:"exists"`
	Depth    int    `json:"depth"`
}

type ClaudeCodeMemoryFilesSnapshot struct {
	ProjectPath string                       `json:"projectPath"`
	Files       []ClaudeCodeMemoryFileRecord `json:"files"`
	Warnings    []string                     `json:"warnings,omitempty"`
}

type SaveClaudeCodeMemoryFileInput struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

type SaveClaudeCodeMemoryFileResult struct {
	Path    string `json:"path"`
	Size    int64  `json:"size"`
	Warning string `json:"warning,omitempty"`
}

type ValidateClaudeCodeMemoryImportsResult struct {
	Path     string                       `json:"path"`
	Imports  []ClaudeCodeMemoryFileImport `json:"imports"`
	Warnings []string                     `json:"warnings,omitempty"`
}
