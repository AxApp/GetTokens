package wailsapp

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"
)

type CodexSkillFile struct {
	Path string `json:"path"`
	Kind string `json:"kind"`
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
	Enabled bool   `json:"enabled"`
}

type SaveCodexSkillEnabledResult struct {
	ConfigPath string `json:"configPath"`
	Preview    string `json:"preview"`
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

type CodexMcpServer struct {
	ID                string           `json:"id"`
	Label             string           `json:"label"`
	Enabled           bool             `json:"enabled"`
	Transport         string           `json:"transport"`
	Command           string           `json:"command,omitempty"`
	Args              []string         `json:"args,omitempty"`
	URL               string           `json:"url,omitempty"`
	Env               []CodexMcpEnvRow `json:"env,omitempty"`
	BearerTokenEnvVar string           `json:"bearerTokenEnvVar,omitempty"`
	SourcePath        string           `json:"sourcePath"`
	Status            string           `json:"status"`
	Warnings          []string         `json:"warnings,omitempty"`
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
	lines      []string
	newline    string
	configPath string
	exists     bool
	servers    []codexMcpServerSection
}

type codexMcpServerSection struct {
	id    string
	start int
	end   int
	lines []string
}

var openCodexConfigFile = openFileInEditor

func (a *App) GetCodexSkillsSnapshot() (*CodexSkillsSnapshot, error) {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}
	roots := resolveCodexSkillRoots(codexHome)
	disabledPaths, warnings := readDisabledCodexSkillPaths(filepath.Join(codexHome, "config.toml"))

	skills := []CodexSkillRecord{}
	for _, root := range roots {
		if !root.Exists {
			continue
		}
		entries, err := os.ReadDir(root.Path)
		if err != nil {
			warnings = append(warnings, fmt.Sprintf("读取 Skill root 失败 %s: %v", root.Path, err))
			continue
		}
		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}
			record, err := readCodexSkillRecord(root, filepath.Join(root.Path, entry.Name()), disabledPaths)
			if err != nil {
				warnings = append(warnings, err.Error())
				continue
			}
			if record != nil {
				skills = append(skills, *record)
			}
		}
	}
	sort.Slice(skills, func(i, j int) bool {
		if skills[i].RootLabel == skills[j].RootLabel {
			return skills[i].Name < skills[j].Name
		}
		return skills[i].RootLabel < skills[j].RootLabel
	})

	return &CodexSkillsSnapshot{
		CodexHomePath: codexHome,
		ConfigPath:    filepath.Join(codexHome, "config.toml"),
		Roots:         roots,
		Skills:        skills,
		Warnings:      warnings,
	}, nil
}

func (a *App) SaveCodexSkillEnabled(input SaveCodexSkillEnabledInput) (*SaveCodexSkillEnabledResult, error) {
	if strings.TrimSpace(input.Path) == "" {
		return nil, errors.New("skill path is required")
	}
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}
	configPath := filepath.Join(codexHome, "config.toml")
	body, err := os.ReadFile(configPath)
	if errors.Is(err, os.ErrNotExist) {
		body = nil
	} else if err != nil {
		return nil, err
	}
	next, err := patchCodexSkillEnabledConfig(string(body), input.Path, input.Enabled)
	if err != nil {
		return nil, err
	}
	if err := writeFileAtomically(configPath, []byte(next), 0600); err != nil {
		return nil, err
	}
	return &SaveCodexSkillEnabledResult{ConfigPath: configPath, Preview: next}, nil
}

func parseCodexGitSkillSource(raw string) (*CodexGitSkillSource, error) {
	value := strings.TrimSpace(raw)
	if !strings.HasPrefix(value, "tk://") {
		return nil, errors.New("skill source must start with tk://")
	}
	parsed, err := url.Parse("https://" + strings.TrimPrefix(value, "tk://"))
	if err != nil {
		return nil, err
	}
	host := strings.ToLower(parsed.Hostname())
	segments := strings.Split(strings.Trim(parsed.Path, "/"), "/")
	if len(segments) < 2 {
		return nil, errors.New("skill source must include namespace and repo")
	}
	ref := parsed.Query().Get("ref")
	if ref == "" {
		ref = "main"
	}
	skillPath := parsed.Query().Get("path")
	if skillPath == "" {
		skillPath = "."
	}
	if strings.Contains(skillPath, "..") || filepath.IsAbs(skillPath) {
		return nil, errors.New("skill source path must stay inside repository")
	}

	switch host {
	case "github.com":
		return &CodexGitSkillSource{
			Provider: "github",
			Host:     host,
			Repo:     strings.Join(segments[:2], "/"),
			Ref:      ref,
			Path:     skillPath,
		}, nil
	case "gitlab.com":
		return &CodexGitSkillSource{
			Provider: "gitlab",
			Host:     host,
			Repo:     strings.Join(segments, "/"),
			Ref:      ref,
			Path:     skillPath,
		}, nil
	default:
		return nil, fmt.Errorf("unsupported skill source host %s", host)
	}
}

func (a *App) GetCodexMcpServers() (*CodexMcpServersSnapshot, error) {
	document, err := readCodexMcpDocument()
	if err != nil {
		return nil, err
	}
	servers := make([]CodexMcpServer, 0, len(document.servers))
	warnings := []string{}
	for _, section := range document.servers {
		server, sectionWarnings := parseCodexMcpServerSection(section, document.configPath)
		servers = append(servers, server)
		warnings = append(warnings, sectionWarnings...)
	}
	sort.Slice(servers, func(i, j int) bool { return servers[i].ID < servers[j].ID })
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}
	return &CodexMcpServersSnapshot{
		CodexHomePath: codexHome,
		ConfigPath:    document.configPath,
		Exists:        document.exists,
		Servers:       servers,
		Warnings:      warnings,
	}, nil
}

func (a *App) SaveCodexMcpServer(input SaveCodexMcpServerInput) (*SaveCodexMcpServerResult, error) {
	document, err := readCodexMcpDocument()
	if err != nil {
		return nil, err
	}
	if err := validateCodexMcpServer(input.Server); err != nil {
		return nil, err
	}
	original := CodexMcpServer{ID: input.Server.ID, Label: input.Server.ID, Enabled: true, SourcePath: document.configPath, Status: "ready"}
	for _, section := range document.servers {
		if section.id == input.Server.ID {
			original, _ = parseCodexMcpServerSection(section, document.configPath)
			break
		}
	}
	nextLines := patchCodexMcpServerSection(document.lines, document.newline, input.Server)
	preview := joinTomlDocument(nextLines, document.newline)
	if err := writeFileAtomically(document.configPath, []byte(preview), 0600); err != nil {
		return nil, err
	}
	saved := input.Server
	saved.Label = saved.ID
	saved.SourcePath = document.configPath
	saved.Status = codexMcpStatus(saved)
	return &SaveCodexMcpServerResult{
		ConfigPath: document.configPath,
		Server:     saved,
		Preview:    preview,
		Changes:    buildCodexMcpChanges(original, saved),
	}, nil
}

func (a *App) OpenCodexConfigToml() (*OpenCodexConfigTomlResult, error) {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}
	configPath := filepath.Join(codexHome, "config.toml")
	if err := ensureEditableCodexConfigToml(configPath); err != nil {
		return nil, err
	}
	if err := openCodexConfigFile(configPath); err != nil {
		return nil, err
	}
	return &OpenCodexConfigTomlResult{ConfigPath: configPath}, nil
}

func (a *App) GetCodexConfigToml() (*CodexConfigTomlDocument, error) {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}
	configPath := filepath.Join(codexHome, "config.toml")
	body, err := os.ReadFile(configPath)
	exists := true
	if errors.Is(err, os.ErrNotExist) {
		body = nil
		exists = false
	} else if err != nil {
		return nil, err
	}
	return &CodexConfigTomlDocument{
		ConfigPath: configPath,
		Content:    string(body),
		Exists:     exists,
	}, nil
}

func (a *App) SaveCodexConfigToml(input SaveCodexConfigTomlInput) (*SaveCodexConfigTomlResult, error) {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}
	configPath := filepath.Join(codexHome, "config.toml")
	if err := os.MkdirAll(filepath.Dir(configPath), 0700); err != nil {
		return nil, err
	}
	if err := writeFileAtomically(configPath, []byte(input.Content), 0600); err != nil {
		return nil, err
	}
	return &SaveCodexConfigTomlResult{
		ConfigPath: configPath,
		Content:    input.Content,
	}, nil
}

func ensureEditableCodexConfigToml(configPath string) error {
	if err := os.MkdirAll(filepath.Dir(configPath), 0700); err != nil {
		return err
	}
	file, err := os.OpenFile(configPath, os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		return err
	}
	return file.Close()
}

func openFileInEditor(path string) error {
	switch runtime.GOOS {
	case "darwin":
		return exec.Command("open", "-t", path).Start()
	case "windows":
		return exec.Command("rundll32", "url.dll,FileProtocolHandler", path).Start()
	default:
		return exec.Command("xdg-open", path).Start()
	}
}

func resolveCodexSkillRoots(codexHome string) []CodexSkillRoot {
	home, _ := os.UserHomeDir()
	cwd, _ := os.Getwd()
	candidates := []CodexSkillRoot{
		{Label: "$CODEX_HOME/skills", Path: filepath.Join(codexHome, "skills"), SourceKind: "user"},
		{Label: "$HOME/.agents/skills", Path: filepath.Join(home, ".agents", "skills"), SourceKind: "user"},
		{Label: "$CODEX_HOME/skills/.system", Path: filepath.Join(codexHome, "skills", ".system"), SourceKind: "system"},
		{Label: "/etc/codex/skills", Path: filepath.Join(string(filepath.Separator), "etc", "codex", "skills"), SourceKind: "system"},
	}
	if cwd != "" {
		candidates = append(candidates,
			CodexSkillRoot{Label: "project .codex/skills", Path: filepath.Join(cwd, ".codex", "skills"), SourceKind: "project"},
			CodexSkillRoot{Label: "project .agents/skills", Path: filepath.Join(cwd, ".agents", "skills"), SourceKind: "project"},
		)
	}

	seen := map[string]struct{}{}
	roots := make([]CodexSkillRoot, 0, len(candidates))
	for _, candidate := range candidates {
		path, err := filepath.Abs(candidate.Path)
		if err == nil {
			candidate.Path = path
		}
		if _, exists := seen[candidate.Path]; exists {
			continue
		}
		seen[candidate.Path] = struct{}{}
		info, err := os.Stat(candidate.Path)
		candidate.Exists = err == nil && info.IsDir()
		roots = append(roots, candidate)
	}
	return roots
}

func readCodexSkillRecord(root CodexSkillRoot, dir string, disabledPaths map[string]bool) (*CodexSkillRecord, error) {
	skillPath := filepath.Join(dir, "SKILL.md")
	body, err := os.ReadFile(skillPath)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("读取 SKILL.md 失败 %s: %v", skillPath, err)
	}
	absSkillPath, err := filepath.Abs(skillPath)
	if err == nil {
		skillPath = absSkillPath
	}
	frontmatter, preview := parseCodexSkillMarkdown(string(body))
	name := strings.TrimSpace(frontmatter.Name)
	if name == "" {
		name = filepath.Base(dir)
	}
	description := strings.TrimSpace(frontmatter.Description)
	if description == "" {
		description = strings.TrimSpace(frontmatter.Metadata.ShortDescription)
	}
	return &CodexSkillRecord{
		ID:              skillPath,
		Name:            name,
		Description:     description,
		Enabled:         !disabledPaths[skillPath],
		RootLabel:       root.Label,
		RootPath:        dir,
		SourceKind:      root.SourceKind,
		Origin:          "local",
		VersionLabel:    "local",
		Files:           listCodexSkillFiles(dir),
		SkillMarkdown:   string(body),
		PreviewMarkdown: preview,
	}, nil
}

func parseCodexSkillMarkdown(markdown string) (codexSkillFrontmatter, string) {
	if !strings.HasPrefix(markdown, "---") {
		return codexSkillFrontmatter{}, strings.TrimSpace(markdown)
	}
	end := strings.Index(markdown[3:], "\n---")
	if end < 0 {
		return codexSkillFrontmatter{}, strings.TrimSpace(markdown)
	}
	yamlBody := markdown[3 : 3+end]
	preview := strings.TrimSpace(markdown[3+end+4:])
	var frontmatter codexSkillFrontmatter
	_ = yaml.Unmarshal([]byte(yamlBody), &frontmatter)
	return frontmatter, preview
}

func listCodexSkillFiles(root string) []CodexSkillFile {
	files := []CodexSkillFile{}
	_ = filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil || entry.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return nil
		}
		files = append(files, CodexSkillFile{Path: rel, Kind: codexSkillFileKind(rel)})
		return nil
	})
	sort.Slice(files, func(i, j int) bool { return files[i].Path < files[j].Path })
	return files
}

func codexSkillFileKind(path string) string {
	switch {
	case path == "SKILL.md":
		return "skill"
	case strings.HasPrefix(path, "scripts"+string(filepath.Separator)) || strings.HasPrefix(path, "scripts/"):
		return "script"
	case strings.HasPrefix(path, "assets"+string(filepath.Separator)) || strings.HasPrefix(path, "assets/"):
		return "asset"
	default:
		return "other"
	}
}

func readDisabledCodexSkillPaths(configPath string) (map[string]bool, []string) {
	body, err := os.ReadFile(configPath)
	if errors.Is(err, os.ErrNotExist) {
		return map[string]bool{}, nil
	}
	if err != nil {
		return map[string]bool{}, []string{fmt.Sprintf("读取 config.toml 失败: %v", err)}
	}
	disabled := map[string]bool{}
	for _, block := range parseSkillsConfigBlocks(string(body)) {
		if block.path != "" && block.enabled != nil && !*block.enabled {
			disabled[block.path] = true
		}
	}
	return disabled, nil
}

type codexSkillConfigBlock struct {
	start   int
	end     int
	path    string
	enabled *bool
}

func parseSkillsConfigBlocks(input string) []codexSkillConfigBlock {
	lines, _ := splitTomlDocument(input)
	blocks := []codexSkillConfigBlock{}
	for index := 0; index < len(lines); index++ {
		if strings.TrimSpace(stripTomlLineComment(lines[index])) != "[[skills.config]]" {
			continue
		}
		block := codexSkillConfigBlock{start: index, end: len(lines)}
		for next := index + 1; next < len(lines); next++ {
			if isTomlSectionHeader(lines[next]) {
				block.end = next
				break
			}
			if value, ok := parseTomlStringKeyValue(lines[next], "path"); ok {
				block.path = value
			}
			if key, value, isBool, ok := parseTomlBoolKeyValue(lines[next]); ok && isBool && key == "enabled" {
				copyValue := value
				block.enabled = &copyValue
			}
		}
		blocks = append(blocks, block)
		index = block.end - 1
	}
	return blocks
}

func patchCodexSkillEnabledConfig(existing string, skillPath string, enabled bool) (string, error) {
	if strings.Contains(existing, "\r\n") {
		withoutCRLF := strings.ReplaceAll(existing, "\r\n", "")
		if strings.Contains(withoutCRLF, "\n") {
			return "", errors.New("config.toml 同时包含 CRLF 和 LF，已停止写入以避免破坏换行格式")
		}
	}
	lines, newline := splitTomlDocument(existing)
	blocks := parseSkillsConfigBlocks(existing)
	remove := map[int]int{}
	hasDisabled := false
	for _, block := range blocks {
		if block.path != skillPath {
			continue
		}
		if enabled {
			remove[block.start] = block.end
			continue
		}
		hasDisabled = true
	}
	if len(remove) > 0 {
		next := []string{}
		for index := 0; index < len(lines); index++ {
			if end, ok := remove[index]; ok {
				index = end - 1
				continue
			}
			next = append(next, lines[index])
		}
		lines = next
	}
	if !enabled && !hasDisabled {
		if len(lines) > 0 && strings.TrimSpace(lines[len(lines)-1]) != "" {
			lines = append(lines, "")
		}
		lines = append(lines, "[[skills.config]]")
		lines = append(lines, fmt.Sprintf("path = %s", quoteTomlString(skillPath)))
		lines = append(lines, "enabled = false")
	}
	return joinTomlDocument(lines, newline), nil
}

func escapeTomlString(value string) string {
	quoted := quoteTomlString(value)
	return strings.TrimPrefix(strings.TrimSuffix(quoted, `"`), `"`)
}

func readCodexMcpDocument() (*codexMcpDocument, error) {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}
	configPath := filepath.Join(codexHome, "config.toml")
	body, err := os.ReadFile(configPath)
	exists := true
	if errors.Is(err, os.ErrNotExist) {
		body = nil
		exists = false
	} else if err != nil {
		return nil, err
	}
	lines, newline := splitTomlDocument(string(body))
	document := &codexMcpDocument{lines: lines, newline: newline, configPath: configPath, exists: exists}
	for index, line := range lines {
		section := strings.TrimSpace(stripTomlLineComment(line))
		if !strings.HasPrefix(section, "[mcp_servers.") || !strings.HasSuffix(section, "]") {
			continue
		}
		id, ok := parseCodexMcpServerSectionID(section)
		if !ok {
			continue
		}
		end := len(lines)
		for next := index + 1; next < len(lines); next++ {
			if isTomlSectionHeader(lines[next]) {
				end = next
				break
			}
		}
		document.servers = append(document.servers, codexMcpServerSection{id: id, start: index, end: end, lines: append([]string(nil), lines[index+1:end]...)})
	}
	return document, nil
}

func parseCodexMcpServerSectionID(section string) (string, bool) {
	path := strings.TrimSuffix(strings.TrimPrefix(section, "[mcp_servers."), "]")
	segments := splitTomlDottedPath(path)
	if len(segments) != 1 {
		return "", false
	}
	id := strings.TrimSpace(segments[0])
	id = strings.Trim(id, `"`)
	if id == "" {
		return "", false
	}
	return id, true
}

func splitTomlDottedPath(path string) []string {
	segments := []string{}
	var current strings.Builder
	inString := false
	escaped := false
	for _, r := range path {
		if escaped {
			current.WriteRune(r)
			escaped = false
			continue
		}
		if inString && r == '\\' {
			current.WriteRune(r)
			escaped = true
			continue
		}
		if r == '"' {
			current.WriteRune(r)
			inString = !inString
			continue
		}
		if r == '.' && !inString {
			segments = append(segments, strings.TrimSpace(current.String()))
			current.Reset()
			continue
		}
		current.WriteRune(r)
	}
	segments = append(segments, strings.TrimSpace(current.String()))
	return segments
}

func parseCodexMcpServerSection(section codexMcpServerSection, configPath string) (CodexMcpServer, []string) {
	server := CodexMcpServer{
		ID:         section.id,
		Label:      section.id,
		Enabled:    true,
		SourcePath: configPath,
		Status:     "ready",
	}
	warnings := []string{}
	for _, line := range section.lines {
		if value, ok := parseTomlStringKeyValue(line, "command"); ok {
			server.Command = value
			continue
		}
		if value, ok := parseTomlStringKeyValue(line, "url"); ok {
			server.URL = value
			continue
		}
		if value, ok := parseTomlStringKeyValue(line, "bearer_token_env_var"); ok {
			server.BearerTokenEnvVar = value
			continue
		}
		if value, ok := parseTomlStringArrayKeyValue(line, "args"); ok {
			server.Args = value
			continue
		}
		if value, ok := parseTomlInlineStringMap(line, "env"); ok {
			server.Env = codexMcpEnvRows(value)
			continue
		}
		if key, value, isBool, ok := parseTomlBoolKeyValue(line); ok && isBool && key == "enabled" {
			server.Enabled = value
			continue
		}
		if tomlLineDefinesKey(line, "bearer_token") {
			warnings = append(warnings, fmt.Sprintf("mcp_servers.%s 使用了无效 bearer_token，应改用 bearer_token_env_var", section.id))
		}
	}
	switch {
	case server.Command != "" && server.URL != "":
		server.Transport = "conflict"
		server.Status = "error"
		warnings = append(warnings, fmt.Sprintf("mcp_servers.%s 同时包含 command 与 url", section.id))
	case server.Command != "":
		server.Transport = "stdio"
	case server.URL != "":
		server.Transport = "streamable_http"
	default:
		server.Transport = "unknown"
		server.Status = "error"
	}
	if !server.Enabled {
		server.Status = "disabled"
	}
	server.Warnings = append([]string(nil), warnings...)
	return server, warnings
}

func validateCodexMcpServer(server CodexMcpServer) error {
	if strings.TrimSpace(server.ID) == "" || !isBareTomlKey(server.ID) {
		return errors.New("mcp server id must be a bare TOML key")
	}
	if server.Command != "" && server.URL != "" {
		return errors.New("transport conflict: command and url cannot both be set")
	}
	switch server.Transport {
	case "stdio":
		if strings.TrimSpace(server.Command) == "" {
			return errors.New("stdio mcp server requires command")
		}
		if server.URL != "" || server.BearerTokenEnvVar != "" {
			return errors.New("transport conflict: stdio does not support url or bearer_token_env_var")
		}
	case "streamable_http":
		if strings.TrimSpace(server.URL) == "" {
			return errors.New("streamable_http mcp server requires url")
		}
		if server.Command != "" || len(server.Args) > 0 || len(server.Env) > 0 {
			return errors.New("transport conflict: streamable_http does not support command, args, or env")
		}
	default:
		return fmt.Errorf("unsupported mcp transport %q", server.Transport)
	}
	return nil
}

func patchCodexMcpServerSection(lines []string, newline string, server CodexMcpServer) []string {
	header := "[mcp_servers." + server.ID + "]"
	start, end, found := findTomlSection(lines, header)
	if !found {
		if len(lines) > 0 && strings.TrimSpace(lines[len(lines)-1]) != "" {
			lines = append(lines, "")
		}
		lines = append(lines, header)
		lines = append(lines, formatCodexMcpServerKnownLines(server)...)
		return lines
	}

	known := map[string]bool{
		"command": true, "args": true, "env": true, "url": true, "bearer_token_env_var": true, "bearer_token": true, "enabled": true,
	}
	nextSection := []string{lines[start]}
	for _, line := range lines[start+1 : end] {
		key := tomlLineKey(line)
		if known[key] {
			continue
		}
		nextSection = append(nextSection, line)
	}
	nextSection = append(nextSection, formatCodexMcpServerKnownLines(server)...)
	next := append([]string{}, lines[:start]...)
	next = append(next, nextSection...)
	next = append(next, lines[end:]...)
	return next
}

func formatCodexMcpServerKnownLines(server CodexMcpServer) []string {
	lines := []string{}
	if server.Transport == "stdio" {
		lines = append(lines, fmt.Sprintf("command = %s", quoteTomlString(server.Command)))
		if len(server.Args) > 0 {
			lines = append(lines, fmt.Sprintf("args = %s", formatTomlStringArray(server.Args)))
		}
		if len(server.Env) > 0 {
			lines = append(lines, fmt.Sprintf("env = %s", formatTomlInlineEnv(server.Env)))
		}
	} else {
		lines = append(lines, fmt.Sprintf("url = %s", quoteTomlString(server.URL)))
		if strings.TrimSpace(server.BearerTokenEnvVar) != "" {
			lines = append(lines, fmt.Sprintf("bearer_token_env_var = %s", quoteTomlString(server.BearerTokenEnvVar)))
		}
	}
	if !server.Enabled {
		lines = append(lines, "enabled = false")
	}
	return lines
}

func parseTomlStringArrayKeyValue(line string, key string) ([]string, bool) {
	if !tomlLineDefinesKey(line, key) {
		return nil, false
	}
	content := strings.TrimSpace(stripTomlLineComment(line))
	parts := strings.SplitN(content, "=", 2)
	if len(parts) != 2 {
		return nil, false
	}
	value := strings.TrimSpace(parts[1])
	if !strings.HasPrefix(value, "[") || !strings.HasSuffix(value, "]") {
		return nil, false
	}
	inner := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(value, "["), "]"))
	if inner == "" {
		return []string{}, true
	}
	items := splitTomlCommaList(inner)
	result := make([]string, 0, len(items))
	for _, item := range items {
		unquoted, err := strconv.Unquote(strings.TrimSpace(item))
		if err != nil {
			return nil, false
		}
		result = append(result, unquoted)
	}
	return result, true
}

func parseTomlInlineStringMap(line string, key string) (map[string]string, bool) {
	if !tomlLineDefinesKey(line, key) {
		return nil, false
	}
	content := strings.TrimSpace(stripTomlLineComment(line))
	parts := strings.SplitN(content, "=", 2)
	if len(parts) != 2 {
		return nil, false
	}
	value := strings.TrimSpace(parts[1])
	if !strings.HasPrefix(value, "{") || !strings.HasSuffix(value, "}") {
		return nil, false
	}
	inner := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(value, "{"), "}"))
	if inner == "" {
		return map[string]string{}, true
	}
	result := map[string]string{}
	for _, item := range splitTomlCommaList(inner) {
		parts := strings.SplitN(item, "=", 2)
		if len(parts) != 2 {
			return nil, false
		}
		mapKey := strings.TrimSpace(parts[0])
		if !isBareTomlKey(mapKey) {
			return nil, false
		}
		mapValue, err := strconv.Unquote(strings.TrimSpace(parts[1]))
		if err != nil {
			return nil, false
		}
		result[mapKey] = mapValue
	}
	return result, true
}

func splitTomlCommaList(input string) []string {
	parts := []string{}
	start := 0
	inDouble := false
	escaped := false
	for index, ch := range input {
		switch ch {
		case '\\':
			if inDouble {
				escaped = !escaped
			}
		case '"':
			if !escaped {
				inDouble = !inDouble
			}
			escaped = false
		case ',':
			if !inDouble {
				parts = append(parts, strings.TrimSpace(input[start:index]))
				start = index + 1
			}
			escaped = false
		default:
			escaped = false
		}
	}
	parts = append(parts, strings.TrimSpace(input[start:]))
	return parts
}

func formatTomlStringArray(values []string) string {
	quoted := make([]string, 0, len(values))
	for _, value := range values {
		quoted = append(quoted, quoteTomlString(value))
	}
	return "[" + strings.Join(quoted, ", ") + "]"
}

func formatTomlInlineEnv(rows []CodexMcpEnvRow) string {
	parts := make([]string, 0, len(rows))
	for _, row := range rows {
		if !isBareTomlKey(row.Key) {
			continue
		}
		parts = append(parts, fmt.Sprintf("%s = %s", row.Key, quoteTomlString(row.Value)))
	}
	sort.Strings(parts)
	return "{ " + strings.Join(parts, ", ") + " }"
}

func codexMcpEnvRows(values map[string]string) []CodexMcpEnvRow {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	rows := make([]CodexMcpEnvRow, 0, len(keys))
	for _, key := range keys {
		rows = append(rows, CodexMcpEnvRow{Key: key, Value: values[key]})
	}
	return rows
}

func tomlLineKey(line string) string {
	content := strings.TrimSpace(stripTomlLineComment(line))
	parts := strings.SplitN(content, "=", 2)
	if len(parts) != 2 {
		return ""
	}
	key := strings.TrimSpace(parts[0])
	if !isBareTomlKey(key) {
		return ""
	}
	return key
}

func codexMcpStatus(server CodexMcpServer) string {
	if !server.Enabled {
		return "disabled"
	}
	return "ready"
}

func buildCodexMcpChanges(before CodexMcpServer, after CodexMcpServer) []CodexMcpChange {
	changes := []CodexMcpChange{}
	add := func(key string, oldValue string, newValue string) {
		if oldValue != newValue {
			changes = append(changes, CodexMcpChange{Key: key, Before: oldValue, After: newValue})
		}
	}
	add("enabled", strconv.FormatBool(before.Enabled), strconv.FormatBool(after.Enabled))
	add("command", before.Command, after.Command)
	add("args", strings.Join(before.Args, " "), strings.Join(after.Args, " "))
	add("url", before.URL, after.URL)
	add("bearer_token_env_var", before.BearerTokenEnvVar, after.BearerTokenEnvVar)
	return changes
}
