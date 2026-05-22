package wailsapp

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

var knownSubagentFrontmatterFields = map[string]bool{
	"name":            true,
	"description":     true,
	"tools":           true,
	"disallowedTools": true,
	"model":           true,
	"permissionMode":  true,
	"maxTurns":        true,
	"skills":          true,
	"mcpServers":      true,
	"hooks":           true,
	"memory":          true,
	"background":      true,
	"effort":          true,
	"isolation":       true,
	"color":           true,
	"initialPrompt":   true,
}

var pluginIgnoredSubagentFields = []string{"hooks", "mcpServers", "permissionMode"}

type subagentFrontmatter struct {
	Name        string `yaml:"name"`
	Description string `yaml:"description"`
}

func (a *App) GetClaudeCodeSubagentsSnapshot() (*ClaudeCodeSubagentsSnapshot, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	projectPath, err := os.Getwd()
	if err != nil {
		projectPath = ""
	}

	userAgentsPath := filepath.Join(home, ".claude", "agents")
	warnings := []string{}
	agents := []ClaudeCodeSubagentRecord{}

	userAgents, userWarnings := scanSubagentDirectory(userAgentsPath, "user")
	agents = append(agents, userAgents...)
	warnings = append(warnings, userWarnings...)

	if projectPath != "" {
		projectAgentsPath := filepath.Join(projectPath, ".claude", "agents")
		projectAgents, projWarnings := scanSubagentDirectory(projectAgentsPath, "project")
		agents = append(agents, projectAgents...)
		warnings = append(warnings, projWarnings...)
	}

	return &ClaudeCodeSubagentsSnapshot{
		UserPath:    userAgentsPath,
		ProjectPath: projectPath,
		Agents:      agents,
		Warnings:    warnings,
	}, nil
}

func scanSubagentDirectory(dir string, scope string) ([]ClaudeCodeSubagentRecord, []string) {
	agents := []ClaudeCodeSubagentRecord{}
	warnings := []string{}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return agents, warnings
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
			if entry.IsDir() {
				subDir := filepath.Join(dir, entry.Name())
				subAgents, subWarnings := scanSubagentDirectory(subDir, scope)
				agents = append(agents, subAgents...)
				warnings = append(warnings, subWarnings...)
			}
			continue
		}

		path := filepath.Join(dir, entry.Name())
		record := parseSubagentFile(path, scope)
		agents = append(agents, record)
	}
	return agents, warnings
}

func parseSubagentFile(path string, scope string) ClaudeCodeSubagentRecord {
	record := ClaudeCodeSubagentRecord{
		Path:             path,
		Scope:            scope,
		FrontmatterValid: false,
	}

	body, err := readOptionalTextFile(path)
	if err != nil || strings.TrimSpace(body) == "" {
		record.FrontmatterError = "无法读取文件"
		return record
	}

	fm, bodyContent, err := splitSubagentFrontmatter(body)
	if err != nil {
		record.FrontmatterError = err.Error()
		return record
	}

	validationErrors := []string{}
	if strings.TrimSpace(fm.Name) == "" {
		validationErrors = append(validationErrors, "name 为必填字段")
	} else {
		record.Name = strings.TrimSpace(fm.Name)
	}

	if strings.TrimSpace(fm.Description) == "" {
		validationErrors = append(validationErrors, "description 为必填字段")
	} else {
		record.Description = strings.TrimSpace(fm.Description)
	}

	record.FrontmatterValid = len(validationErrors) == 0
	record.ValidationErrors = validationErrors

	record.Body = strings.TrimSpace(bodyContent)

	// Parse full frontmatter to extract known and unknown fields
	var allFields map[string]any
	if fmBody, ok := subagentFrontmatterBody(body); ok {
		if err := yaml.Unmarshal([]byte(fmBody), &allFields); err != nil {
			allFields = nil
		}
	}
	if allFields != nil {
		// Extract known fields
		knownFields := map[string]any{}
		unknownFields := map[string]any{}
		for key, value := range allFields {
			if knownSubagentFrontmatterFields[key] {
				knownFields[key] = value
			} else if key != "name" && key != "description" { // name/desc already in record
				unknownFields[key] = value
			}
		}
		record.KnownFields = knownFields
		record.UnknownFields = unknownFields
	}

	// Detect plugin subagents (check for plugin marker in path or frontmatter)
	if isPluginSubagent(path, allFields) {
		record.IsPlugin = true
		record.IgnoredFields = pluginIgnoredSubagentFields
	}

	if len(record.Body) > 200 {
		record.BodyPreview = record.Body[:200] + "..."
	} else {
		record.BodyPreview = record.Body
	}

	return record
}

func subagentFrontmatterBody(content string) (string, bool) {
	trimmed := strings.TrimSpace(content)
	if !strings.HasPrefix(trimmed, "---") {
		return "", false
	}
	rest := trimmed[3:]
	endIdx := strings.Index(rest, "\n---")
	if endIdx < 0 {
		return "", false
	}
	return rest[:endIdx], true
}

func splitSubagentFrontmatter(content string) (subagentFrontmatter, string, error) {
	trimmed := strings.TrimSpace(content)
	if !strings.HasPrefix(trimmed, "---") {
		return subagentFrontmatter{}, trimmed, fmt.Errorf("缺少 frontmatter")
	}

	rest := trimmed[3:]
	endIdx := strings.Index(rest, "\n---")
	if endIdx < 0 {
		return subagentFrontmatter{}, "", fmt.Errorf("frontmatter 格式错误: 未找到结束标记")
	}

	fmBody := rest[:endIdx]
	bodyContent := rest[endIdx+4:]

	var fm subagentFrontmatter
	if err := yaml.Unmarshal([]byte(fmBody), &fm); err != nil {
		return subagentFrontmatter{}, "", fmt.Errorf("frontmatter YAML 解析失败: %w", err)
	}

	return fm, bodyContent, nil
}

func isPluginSubagent(path string, allFields map[string]any) bool {
	// Check if path contains plugin markers or frontmatter has plugin source
	if strings.Contains(path, "plugins") || strings.Contains(path, "marketplace") {
		return true
	}
	if source, ok := allFields["source"]; ok {
		if src, ok := source.(string); ok && (src == "plugin" || src == "marketplace") {
			return true
		}
	}
	return false
}

func (a *App) SaveClaudeCodeSubagent(input SaveClaudeCodeSubagentInput) (*SaveClaudeCodeSubagentResult, error) {
	if strings.TrimSpace(input.Name) == "" {
		return nil, fmt.Errorf("name 为必填字段")
	}
	if strings.TrimSpace(input.Description) == "" {
		return nil, fmt.Errorf("description 为必填字段")
	}
	if input.Scope != "user" && input.Scope != "project" {
		return nil, fmt.Errorf("不支持的 scope: %s", input.Scope)
	}

	path := input.Path
	if strings.TrimSpace(path) == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, err
		}
		safeName := filepath.Base(strings.ReplaceAll(input.Name, " ", "-"))
		if input.Scope == "user" {
			path = filepath.Join(home, ".claude", "agents", safeName+".md")
		} else {
			projectPath, _ := os.Getwd()
			path = filepath.Join(projectPath, ".claude", "agents", safeName+".md")
		}
	}
	if err := validateSubagentPath(path); err != nil {
		return nil, err
	}

	content := buildSubagentMarkdown(input)
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}
	if err := writeFileAtomically(path, []byte(content), 0600); err != nil {
		return nil, err
	}

	return &SaveClaudeCodeSubagentResult{
		Path:    path,
		Preview: content,
	}, nil
}

func buildSubagentMarkdown(input SaveClaudeCodeSubagentInput) string {
	var sb strings.Builder
	sb.WriteString("---\n")
	sb.WriteString(fmt.Sprintf("name: %s\n", input.Name))
	sb.WriteString(fmt.Sprintf("description: %s\n", input.Description))

	if input.KnownFields != nil {
		for key, value := range input.KnownFields {
			if key == "name" || key == "description" {
				continue
			}
			writeYAMLField(&sb, key, value)
		}
	}

	if input.UnknownFields != nil {
		for key, value := range input.UnknownFields {
			writeYAMLField(&sb, key, value)
		}
	}

	sb.WriteString("---\n\n")
	sb.WriteString(input.Body)
	if !strings.HasSuffix(input.Body, "\n") {
		sb.WriteString("\n")
	}
	return sb.String()
}

func writeYAMLField(sb *strings.Builder, key string, value any) {
	switch v := value.(type) {
	case string:
		sb.WriteString(fmt.Sprintf("%s: %s\n", key, v))
	case []interface{}:
		sb.WriteString(fmt.Sprintf("%s:\n", key))
		for _, item := range v {
			sb.WriteString(fmt.Sprintf("  - %v\n", item))
		}
	case bool:
		sb.WriteString(fmt.Sprintf("%s: %v\n", key, v))
	case int, int64, float64:
		sb.WriteString(fmt.Sprintf("%s: %v\n", key, v))
	default:
		sb.WriteString(fmt.Sprintf("%s: %q\n", key, fmt.Sprintf("%v", v)))
	}
}

func validateSubagentPath(path string) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	projectPath, err := os.Getwd()
	if err != nil {
		projectPath = ""
	}

	abs, err := filepath.Abs(path)
	if err != nil {
		return fmt.Errorf("无法解析路径: %w", err)
	}

	userAgentsDir := filepath.Join(home, ".claude", "agents")
	projAgentsDir := filepath.Join(projectPath, ".claude", "agents")

	if !pathWithinDir(abs, userAgentsDir) && (projectPath == "" || !pathWithinDir(abs, projAgentsDir)) {
		return fmt.Errorf("路径不在允许的子代理目录内: %s", abs)
	}
	if !strings.HasSuffix(abs, ".md") {
		return fmt.Errorf("只允许 .md 文件: %s", abs)
	}
	return nil
}

func (a *App) DeleteClaudeCodeSubagent(input DeleteClaudeCodeSubagentInput) error {
	if input.Scope != "user" && input.Scope != "project" {
		return fmt.Errorf("不支持的 scope: %s", input.Scope)
	}
	if strings.TrimSpace(input.Path) == "" {
		return fmt.Errorf("path 不能为空")
	}
	if err := validateSubagentPath(input.Path); err != nil {
		return err
	}
	if _, err := os.Stat(input.Path); os.IsNotExist(err) {
		return fmt.Errorf("文件不存在: %s", input.Path)
	}
	return os.Remove(input.Path)
}
