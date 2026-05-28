package wailsapp

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

func (a *App) GetClaudeCodeExtensionsSnapshot() (*ClaudeCodeExtensionsSnapshot, error) {
	claudeConfigDir, err := resolveClaudeConfigDirPath()
	if err != nil {
		return nil, err
	}
	claudeJSONPath, err := resolveClaudeCodeJSONPath()
	if err != nil {
		return nil, err
	}
	projectPath, err := os.Getwd()
	if err != nil {
		projectPath = ""
	}

	warnings := []string{}
	skills, skillWarnings := scanClaudeCodeSkills(claudeConfigDir, projectPath)
	warnings = append(warnings, skillWarnings...)

	mcpServers, mcpWarnings := scanClaudeCodeMcpServers(claudeJSONPath, projectPath)
	warnings = append(warnings, mcpWarnings...)

	return &ClaudeCodeExtensionsSnapshot{
		ClaudeConfigDirPath: claudeConfigDir,
		ClaudeJSONPath:      claudeJSONPath,
		ProjectPath:         projectPath,
		Skills:              skills,
		McpServers:          mcpServers,
		Warnings:            warnings,
	}, nil
}

func (a *App) SaveClaudeCodeMcpServer(input SaveClaudeCodeMcpServerInput) (*SaveClaudeCodeMcpServerResult, error) {
	if err := validateClaudeCodeMcpServer(input.Server); err != nil {
		return nil, err
	}
	claudeJSONPath, err := resolveClaudeCodeJSONPath()
	if err != nil {
		return nil, err
	}
	projectPath, err := os.Getwd()
	if err != nil {
		projectPath = ""
	}
	if input.Server.Scope != "user" && projectPath == "" {
		return nil, fmt.Errorf("保存 Claude Code MCP %s scope 需要当前项目路径", input.Server.Scope)
	}

	var configPath string
	var document map[string]any
	switch input.Server.Scope {
	case "project":
		configPath = filepath.Join(projectPath, ".mcp.json")
		document, err = readClaudeCodeMcpJSONObject(configPath)
		if err != nil {
			return nil, err
		}
		patchClaudeCodeMcpServerMap(document, input.Server)
	case "user":
		configPath = claudeJSONPath
		document, err = readClaudeCodeMcpJSONObject(configPath)
		if err != nil {
			return nil, err
		}
		patchClaudeCodeMcpServerMap(document, input.Server)
	case "local":
		configPath = claudeJSONPath
		document, err = readClaudeCodeMcpJSONObject(configPath)
		if err != nil {
			return nil, err
		}
		section := ensureClaudeCodeLocalProjectSection(document, projectPath)
		patchClaudeCodeMcpServerMap(section, input.Server)
	}

	preview, err := marshalClaudeCodeMcpJSONObject(document)
	if err != nil {
		return nil, err
	}
	if err := writeFileAtomically(configPath, []byte(preview), 0600); err != nil {
		return nil, err
	}

	savedServers, warnings := scanClaudeCodeMcpServers(claudeJSONPath, projectPath)
	if len(warnings) > 0 {
		return nil, errors.New(strings.Join(warnings, "; "))
	}
	saved := input.Server
	for _, server := range savedServers {
		if server.Scope == input.Server.Scope && server.Label == input.Server.Label {
			saved = server
			break
		}
	}

	return &SaveClaudeCodeMcpServerResult{
		ConfigPath: configPath,
		Server:     saved,
		Preview:    preview,
		Changes:    buildClaudeCodeMcpChanges(input.Server, saved),
	}, nil
}

func resolveClaudeCodeJSONPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".claude.json"), nil
}

func validateClaudeCodeMcpServer(server ClaudeCodeMcpAsset) error {
	if strings.TrimSpace(server.Label) == "" {
		return fmt.Errorf("Claude Code MCP server label 不能为空")
	}
	switch server.Scope {
	case "user", "project", "local":
	default:
		return fmt.Errorf("不支持的 Claude Code MCP scope: %s", server.Scope)
	}
	switch server.Transport {
	case "stdio", "http", "sse":
	default:
		return fmt.Errorf("不支持的 Claude Code MCP transport: %s", server.Transport)
	}
	if strings.TrimSpace(server.Endpoint) == "" {
		return fmt.Errorf("Claude Code MCP endpoint 不能为空")
	}
	return nil
}

func readClaudeCodeMcpJSONObject(path string) (map[string]any, error) {
	body, err := readOptionalTextFile(path)
	if err != nil {
		return nil, fmt.Errorf("读取 Claude Code MCP JSON 失败: %s: %w", path, err)
	}
	if strings.TrimSpace(body) == "" {
		return map[string]any{}, nil
	}
	var document map[string]any
	if err := json.Unmarshal([]byte(body), &document); err != nil {
		return nil, fmt.Errorf("解析 Claude Code MCP JSON 失败: %s: %w", path, err)
	}
	return document, nil
}

func marshalClaudeCodeMcpJSONObject(document map[string]any) (string, error) {
	body, err := json.MarshalIndent(document, "", "  ")
	if err != nil {
		return "", fmt.Errorf("序列化 Claude Code MCP JSON 失败: %w", err)
	}
	return string(body) + "\n", nil
}

func ensureClaudeCodeLocalProjectSection(document map[string]any, projectPath string) map[string]any {
	projects := mapFromAny(document["projects"])
	if projects == nil {
		projects = map[string]any{}
		document["projects"] = projects
	}
	key := projectPath
	for _, candidate := range claudeCodeProjectPathCandidates(projectPath) {
		if _, exists := projects[candidate]; exists {
			key = candidate
			break
		}
	}
	section := mapFromAny(projects[key])
	if section == nil {
		section = map[string]any{}
		projects[key] = section
	}
	return section
}

func patchClaudeCodeMcpServerMap(document map[string]any, server ClaudeCodeMcpAsset) {
	servers := mapFromAny(document["mcpServers"])
	if servers == nil {
		servers = map[string]any{}
		document["mcpServers"] = servers
	}
	payload := mapFromAny(servers[server.Label])
	if payload == nil {
		payload = map[string]any{}
		servers[server.Label] = payload
	}
	payload["type"] = server.Transport
	switch server.Transport {
	case "stdio":
		payload["command"] = server.Endpoint
		delete(payload, "url")
	case "http", "sse":
		payload["url"] = server.Endpoint
		delete(payload, "command")
		delete(payload, "args")
		delete(payload, "cwd")
	}
}

func mapFromAny(value any) map[string]any {
	items, ok := value.(map[string]any)
	if !ok {
		return nil
	}
	return items
}

func buildClaudeCodeMcpChanges(before ClaudeCodeMcpAsset, after ClaudeCodeMcpAsset) []ClaudeCodeMcpChange {
	changes := []ClaudeCodeMcpChange{}
	push := func(key string, previous string, next string) {
		if previous != next {
			changes = append(changes, ClaudeCodeMcpChange{Key: key, Before: previous, After: next})
		}
	}
	push("scope", before.Scope, after.Scope)
	push("transport", before.Transport, after.Transport)
	push("endpoint", before.Endpoint, after.Endpoint)
	push("active", fmt.Sprint(before.Active), fmt.Sprint(after.Active))
	push("secretState", before.SecretState, after.SecretState)
	return changes
}

type claudeCodeSkillRoot struct {
	scope     string
	path      string
	commands  bool
	removable bool
}

func scanClaudeCodeSkills(claudeConfigDir string, projectPath string) ([]ClaudeCodeSkillAsset, []string) {
	home, homeErr := os.UserHomeDir()
	roots := []claudeCodeSkillRoot{
		{scope: "user", path: filepath.Join(claudeConfigDir, "skills"), removable: true},
	}
	if homeErr == nil && home != "" {
		roots = append(roots, claudeCodeSkillRoot{scope: "user", path: filepath.Join(home, ".agents", "skills"), removable: true})
	}
	if projectPath != "" {
		roots = append(roots,
			claudeCodeSkillRoot{scope: "project", path: filepath.Join(projectPath, ".agents", "skills")},
			claudeCodeSkillRoot{scope: "project", path: filepath.Join(projectPath, ".claude", "skills")},
			claudeCodeSkillRoot{scope: "legacy-command", path: filepath.Join(projectPath, ".claude", "commands"), commands: true},
		)
	}

	skills := []ClaudeCodeSkillAsset{}
	warnings := []string{}
	for _, root := range roots {
		entries, err := os.ReadDir(root.path)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			warnings = append(warnings, fmt.Sprintf("读取 Claude Code asset root 失败: %s: %v", root.path, err))
			continue
		}
		sort.Slice(entries, func(i, j int) bool { return entries[i].Name() < entries[j].Name() })
		for _, entry := range entries {
			if root.commands {
				if entry.IsDir() || !strings.HasSuffix(strings.ToLower(entry.Name()), ".md") {
					continue
				}
				asset, err := readClaudeCodeLegacyCommandAsset(root, filepath.Join(root.path, entry.Name()))
				if err != nil {
					warnings = append(warnings, err.Error())
					continue
				}
				skills = append(skills, asset)
				continue
			}
			if !entry.IsDir() {
				continue
			}
			asset, ok, err := readClaudeCodeSkillAsset(root, filepath.Join(root.path, entry.Name()))
			if err != nil {
				warnings = append(warnings, err.Error())
				continue
			}
			if ok {
				skills = append(skills, asset)
			}
		}
	}
	return skills, warnings
}

func readClaudeCodeSkillAsset(root claudeCodeSkillRoot, dir string) (ClaudeCodeSkillAsset, bool, error) {
	skillPath := filepath.Join(dir, "SKILL.md")
	body, err := os.ReadFile(skillPath)
	if err != nil {
		if os.IsNotExist(err) {
			return ClaudeCodeSkillAsset{}, false, nil
		}
		return ClaudeCodeSkillAsset{}, false, fmt.Errorf("读取 Claude Code skill 失败: %s: %w", skillPath, err)
	}
	frontmatter, preview, status, frontmatterErr := parseClaudeCodeSkillMarkdown(string(body))
	name := strings.TrimSpace(frontmatter.Name)
	if name == "" {
		name = filepath.Base(dir)
	}
	description := strings.TrimSpace(frontmatter.Description)
	if description == "" {
		description = firstMarkdownParagraph(preview)
	}
	if description == "" {
		description = strings.TrimSpace(frontmatter.WhenToUse)
	}
	invocation := "auto"
	if frontmatter.UserInvocable != nil && *frontmatter.UserInvocable {
		invocation = "manual"
	}
	modelInvocation := "enabled"
	if frontmatter.DisableModelInvocation != nil && *frontmatter.DisableModelInvocation {
		modelInvocation = "disabled"
	}
	asset := ClaudeCodeSkillAsset{
		ID:                root.scope + ":" + skillPath,
		Name:              name,
		Description:       description,
		Scope:             root.scope,
		Path:              skillPath,
		FrontmatterStatus: status,
		Invocation:        invocation,
		ModelInvocation:   modelInvocation,
		Removable:         root.removable,
		FileCount:         countFilesUnder(dir),
		PreviewMarkdown:   preview,
	}
	if frontmatterErr != nil {
		asset.FrontmatterError = frontmatterErr.Error()
	}
	return asset, true, nil
}

func readClaudeCodeLegacyCommandAsset(root claudeCodeSkillRoot, commandPath string) (ClaudeCodeSkillAsset, error) {
	body, err := os.ReadFile(commandPath)
	if err != nil {
		return ClaudeCodeSkillAsset{}, fmt.Errorf("读取 Claude Code legacy command 失败: %s: %w", commandPath, err)
	}
	frontmatter, preview, status, frontmatterErr := parseClaudeCodeSkillMarkdown(string(body))
	name := "/" + strings.TrimSuffix(filepath.Base(commandPath), filepath.Ext(commandPath))
	description := strings.TrimSpace(frontmatter.Description)
	if description == "" {
		description = firstMarkdownParagraph(preview)
	}
	asset := ClaudeCodeSkillAsset{
		ID:                  root.scope + ":" + commandPath,
		Name:                name,
		Description:         description,
		Scope:               root.scope,
		Path:                commandPath,
		FrontmatterStatus:   status,
		Invocation:          "legacy",
		ModelInvocation:     "enabled",
		Removable:           false,
		FileCount:           1,
		Risk:                "legacy command compatibility asset",
		PreviewMarkdown:     preview,
		LegacyCommandSource: commandPath,
	}
	if frontmatterErr != nil {
		asset.FrontmatterError = frontmatterErr.Error()
	}
	return asset, nil
}

func parseClaudeCodeSkillMarkdown(markdown string) (claudeCodeSkillFrontmatter, string, string, error) {
	trimmed := strings.TrimSpace(markdown)
	if !strings.HasPrefix(trimmed, "---") {
		return claudeCodeSkillFrontmatter{}, trimmed, "missing", nil
	}
	end := strings.Index(trimmed[3:], "\n---")
	if end < 0 {
		return claudeCodeSkillFrontmatter{}, trimmed, "invalid", fmt.Errorf("frontmatter 未闭合")
	}
	yamlBody := trimmed[3 : 3+end]
	preview := strings.TrimSpace(trimmed[3+end+4:])
	var frontmatter claudeCodeSkillFrontmatter
	if err := yaml.Unmarshal([]byte(yamlBody), &frontmatter); err != nil {
		return frontmatter, preview, "invalid", err
	}
	return frontmatter, preview, "valid", nil
}

func firstMarkdownParagraph(markdown string) string {
	for _, line := range strings.Split(markdown, "\n") {
		trimmed := strings.TrimSpace(strings.TrimLeft(line, "#"))
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func countFilesUnder(root string) int {
	count := 0
	_ = filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err == nil && !entry.IsDir() {
			count++
		}
		return nil
	})
	return count
}

type claudeCodeMcpDocument struct {
	McpServers map[string]json.RawMessage             `json:"mcpServers"`
	Projects   map[string]claudeCodeMcpProjectSection `json:"projects"`
}

type claudeCodeMcpProjectSection struct {
	McpServers map[string]json.RawMessage `json:"mcpServers"`
}

func scanClaudeCodeMcpServers(claudeJSONPath string, projectPath string) ([]ClaudeCodeMcpAsset, []string) {
	warnings := []string{}
	localServers, localWarnings := readClaudeCodeLocalMcpServers(claudeJSONPath, projectPath)
	warnings = append(warnings, localWarnings...)
	projectServers, projectWarnings := readClaudeCodeProjectMcpServers(projectPath)
	warnings = append(warnings, projectWarnings...)
	userServers, userWarnings := readClaudeCodeUserMcpServers(claudeJSONPath)
	warnings = append(warnings, userWarnings...)

	servers := append([]ClaudeCodeMcpAsset{}, localServers...)
	servers = append(servers, projectServers...)
	servers = append(servers, userServers...)
	markClaudeCodeMcpPrecedence(servers)
	return servers, warnings
}

func readClaudeCodeUserMcpServers(path string) ([]ClaudeCodeMcpAsset, []string) {
	document, ok, warnings := readClaudeCodeMcpDocument(path)
	if !ok {
		return nil, warnings
	}
	return mapClaudeCodeMcpServerMap(document.McpServers, "user", path), warnings
}

func readClaudeCodeLocalMcpServers(path string, projectPath string) ([]ClaudeCodeMcpAsset, []string) {
	if projectPath == "" {
		return nil, nil
	}
	document, ok, warnings := readClaudeCodeMcpDocument(path)
	if !ok {
		return nil, warnings
	}
	project, ok := document.Projects[projectPath]
	if !ok {
		for _, candidate := range claudeCodeProjectPathCandidates(projectPath) {
			if section, exists := document.Projects[candidate]; exists {
				project = section
				ok = true
				break
			}
		}
	}
	if !ok {
		return nil, warnings
	}
	return mapClaudeCodeMcpServerMap(project.McpServers, "local", path), warnings
}

func readClaudeCodeProjectMcpServers(projectPath string) ([]ClaudeCodeMcpAsset, []string) {
	if projectPath == "" {
		return nil, nil
	}
	path := filepath.Join(projectPath, ".mcp.json")
	document, ok, warnings := readClaudeCodeMcpDocument(path)
	if !ok {
		return nil, warnings
	}
	return mapClaudeCodeMcpServerMap(document.McpServers, "project", path), warnings
}

func claudeCodeProjectPathCandidates(projectPath string) []string {
	candidates := []string{}
	seen := map[string]bool{}
	add := func(value string) {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			return
		}
		seen[value] = true
		candidates = append(candidates, value)
	}
	add(projectPath)
	add(filepath.Clean(projectPath))
	if evaluated, err := filepath.EvalSymlinks(projectPath); err == nil {
		add(evaluated)
		add(filepath.Clean(evaluated))
	}
	if strings.HasPrefix(projectPath, "/private/") {
		add(strings.TrimPrefix(projectPath, "/private"))
	}
	if strings.HasPrefix(projectPath, "/var/") {
		add("/private" + projectPath)
	}
	return candidates
}

func readClaudeCodeMcpDocument(path string) (claudeCodeMcpDocument, bool, []string) {
	body, err := readOptionalTextFile(path)
	if err != nil {
		return claudeCodeMcpDocument{}, false, []string{fmt.Sprintf("读取 Claude Code MCP JSON 失败: %s: %v", path, err)}
	}
	if strings.TrimSpace(body) == "" {
		return claudeCodeMcpDocument{}, false, nil
	}
	var document claudeCodeMcpDocument
	if err := json.Unmarshal([]byte(body), &document); err != nil {
		return claudeCodeMcpDocument{}, false, []string{fmt.Sprintf("解析 Claude Code MCP JSON 失败: %s: %v", path, err)}
	}
	return document, true, nil
}

func mapClaudeCodeMcpServerMap(rawServers map[string]json.RawMessage, scope string, sourcePath string) []ClaudeCodeMcpAsset {
	if len(rawServers) == 0 {
		return nil
	}
	ids := make([]string, 0, len(rawServers))
	for id := range rawServers {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	servers := make([]ClaudeCodeMcpAsset, 0, len(ids))
	for _, id := range ids {
		servers = append(servers, mapClaudeCodeMcpServer(id, rawServers[id], scope, sourcePath))
	}
	return servers
}

func mapClaudeCodeMcpServer(id string, raw json.RawMessage, scope string, sourcePath string) ClaudeCodeMcpAsset {
	payload := map[string]any{}
	_ = json.Unmarshal(raw, &payload)
	transport := normalizeClaudeCodeMcpTransport(stringValue(payload["type"]))
	command := stringValue(payload["command"])
	url := stringValue(payload["url"])
	if transport == "" {
		if url != "" {
			transport = "http"
		} else {
			transport = "stdio"
		}
	}
	endpoint := command
	if transport == "http" || transport == "sse" {
		endpoint = url
	}
	return ClaudeCodeMcpAsset{
		ID:          scope + ":" + id,
		Label:       id,
		Transport:   transport,
		Scope:       scope,
		SourcePath:  sourcePath,
		Endpoint:    endpoint,
		Active:      true,
		SecretState: claudeCodeMcpSecretState(payload),
	}
}

func normalizeClaudeCodeMcpTransport(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "http", "streamable-http", "streamable_http":
		return "http"
	case "sse":
		return "sse"
	case "stdio":
		return "stdio"
	default:
		return ""
	}
}

func markClaudeCodeMcpPrecedence(servers []ClaudeCodeMcpAsset) {
	activeScopes := map[string]string{}
	for index := range servers {
		label := servers[index].Label
		if scope, exists := activeScopes[label]; exists {
			servers[index].Active = false
			servers[index].ShadowedBy = scope
			continue
		}
		servers[index].Active = true
		activeScopes[label] = servers[index].Scope
	}
}

func claudeCodeMcpSecretState(payload map[string]any) string {
	if mapHasSecret(payload["env"]) || mapHasSecret(payload["headers"]) {
		return "redacted"
	}
	return "none"
}

func mapHasSecret(value any) bool {
	items, ok := value.(map[string]any)
	if !ok {
		return false
	}
	for key, rawValue := range items {
		if isSecretKey(key) || strings.TrimSpace(fmt.Sprint(rawValue)) != "" {
			return true
		}
	}
	return false
}

func isSecretKey(key string) bool {
	normalized := strings.ToLower(key)
	return strings.Contains(normalized, "token") ||
		strings.Contains(normalized, "secret") ||
		strings.Contains(normalized, "key") ||
		normalized == "authorization"
}

func stringValue(value any) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(value))
}
