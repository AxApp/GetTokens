package wailsapp

type ClaudeCodeSubagentRecord struct {
	Name             string         `json:"name"`
	Description      string         `json:"description"`
	Path             string         `json:"path"`
	Scope            string         `json:"scope"`
	FrontmatterValid bool           `json:"frontmatterValid"`
	FrontmatterError string         `json:"frontmatterError,omitempty"`
	ValidationErrors []string       `json:"validationErrors,omitempty"`
	KnownFields      map[string]any `json:"knownFields,omitempty"`
	UnknownFields    map[string]any `json:"unknownFields,omitempty"`
	Body             string         `json:"body,omitempty"`
	BodyPreview      string         `json:"bodyPreview,omitempty"`
	IsPlugin         bool           `json:"isPlugin,omitempty"`
	IgnoredFields    []string       `json:"ignoredFields,omitempty"`
}

type ClaudeCodeSubagentsSnapshot struct {
	UserPath    string                     `json:"userPath"`
	ProjectPath string                     `json:"projectPath"`
	Agents      []ClaudeCodeSubagentRecord `json:"agents"`
	Warnings    []string                   `json:"warnings,omitempty"`
}

type SaveClaudeCodeSubagentInput struct {
	Scope         string         `json:"scope"`
	Path          string         `json:"path"`
	Name          string         `json:"name"`
	Description   string         `json:"description"`
	KnownFields   map[string]any `json:"knownFields,omitempty"`
	UnknownFields map[string]any `json:"unknownFields,omitempty"`
	Body          string         `json:"body"`
}

type SaveClaudeCodeSubagentResult struct {
	Path    string `json:"path"`
	Preview string `json:"preview"`
}

type DeleteClaudeCodeSubagentInput struct {
	Scope string `json:"scope"`
	Path  string `json:"path"`
}
