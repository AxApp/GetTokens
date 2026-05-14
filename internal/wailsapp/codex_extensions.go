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

var openCodexConfigFile = openFileInEditor
var openCodexSkillInFileManager = openPathInFileManager

func (a *App) GetCodexSkillsSnapshot() (*CodexSkillsSnapshot, error) {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}
	roots := resolveCodexSkillRoots(codexHome)
	skillConfigRules, warnings := readCodexSkillConfigRules(filepath.Join(codexHome, "config.toml"))

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
			record, err := readCodexSkillRecord(root, filepath.Join(root.Path, entry.Name()), skillConfigRules)
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
	normalizedSkillPath := normalizeCodexSkillConfigPath(input.Path)
	next, err := patchCodexSkillEnabledConfig(string(body), normalizedSkillPath, input.Name, input.Enabled)
	if err != nil {
		return nil, err
	}
	if err := writeFileAtomically(configPath, []byte(next), 0600); err != nil {
		return nil, err
	}
	return &SaveCodexSkillEnabledResult{ConfigPath: configPath, Preview: next}, nil
}

func (a *App) GetCodexSkillFilePreview(input GetCodexSkillFilePreviewInput) (*GetCodexSkillFilePreviewResult, error) {
	if strings.TrimSpace(input.SkillPath) == "" {
		return nil, errors.New("skill path is required")
	}
	if strings.TrimSpace(input.FilePath) == "" {
		return nil, errors.New("file path is required")
	}
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}
	skillPath, err := resolveCodexSkillPathInRoots(input.SkillPath, resolveCodexSkillRoots(codexHome))
	if err != nil {
		return nil, err
	}
	targetPath, relPath, err := resolveCodexSkillFilePreviewTarget(filepath.Dir(skillPath), input.FilePath)
	if err != nil {
		return nil, err
	}
	content, ok := readCodexSkillFilePreview(targetPath, maxCodexSkillPreviewBytes)
	return &GetCodexSkillFilePreviewResult{
		Path:        relPath,
		Content:     content,
		Previewable: ok,
	}, nil
}

func (a *App) RemoveCodexSkill(input RemoveCodexSkillInput) (*RemoveCodexSkillResult, error) {
	skillPath := strings.TrimSpace(input.Path)
	if skillPath == "" {
		return nil, errors.New("skill path is required")
	}
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}
	targetDir, normalizedSkillPath, err := resolveCodexSkillRemovalTarget(skillPath, resolveCodexSkillRoots(codexHome))
	if err != nil {
		return nil, err
	}
	if err := os.RemoveAll(targetDir); err != nil {
		return nil, err
	}
	if _, err := os.Stat(targetDir); err == nil {
		return nil, fmt.Errorf("skill directory still exists after removal: %s", targetDir)
	} else if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}

	configPath := filepath.Join(codexHome, "config.toml")
	body, err := os.ReadFile(configPath)
	if errors.Is(err, os.ErrNotExist) {
		return &RemoveCodexSkillResult{ConfigPath: configPath, RemovedPath: targetDir}, nil
	} else if err != nil {
		return nil, err
	}
	next, err := patchCodexSkillEnabledConfig(string(body), normalizedSkillPath, "", true)
	if err != nil {
		return nil, err
	}
	if err := writeFileAtomically(configPath, []byte(next), 0600); err != nil {
		return nil, err
	}
	return &RemoveCodexSkillResult{ConfigPath: configPath, RemovedPath: targetDir, Preview: next}, nil
}

func (a *App) OpenCodexSkillInFinder(input OpenCodexSkillInFinderInput) (*OpenCodexSkillInFinderResult, error) {
	skillPath := strings.TrimSpace(input.Path)
	if skillPath == "" {
		return nil, errors.New("skill path is required")
	}
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}
	normalizedSkillPath, err := resolveCodexSkillPathInRoots(skillPath, resolveCodexSkillRoots(codexHome))
	if err != nil {
		return nil, err
	}
	if err := openCodexSkillInFileManager(normalizedSkillPath); err != nil {
		return nil, err
	}
	return &OpenCodexSkillInFinderResult{Path: normalizedSkillPath}, nil
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
		server.Tools = append([]CodexMcpToolRow(nil), document.tools[server.ID]...)
		server.RawConfig = formatCodexMcpRawConfig(document.lines, section, document.toolSections[server.ID])
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
			original.Tools = append([]CodexMcpToolRow(nil), document.tools[original.ID]...)
			original.RawConfig = formatCodexMcpRawConfig(document.lines, section, document.toolSections[original.ID])
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
	saved.Tools = append([]CodexMcpToolRow(nil), document.tools[saved.ID]...)
	saved.RawConfig = formatMcpCurrentConfigToml(saved)
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

func openPathInFileManager(path string) error {
	switch runtime.GOOS {
	case "darwin":
		return exec.Command("open", "-R", path).Start()
	case "windows":
		return exec.Command("explorer", "/select,", path).Start()
	default:
		return exec.Command("xdg-open", filepath.Dir(path)).Start()
	}
}

func resolveCodexSkillRoots(codexHome string) []CodexSkillRoot {
	home, _ := os.UserHomeDir()
	candidates := []CodexSkillRoot{
		{Label: "$CODEX_HOME/skills", Path: filepath.Join(codexHome, "skills"), SourceKind: "user"},
		{Label: "$HOME/.agents/skills", Path: filepath.Join(home, ".agents", "skills"), SourceKind: "user"},
		{Label: "$CODEX_HOME/skills/.system", Path: filepath.Join(codexHome, "skills", ".system"), SourceKind: "system"},
		{Label: "/etc/codex/skills", Path: filepath.Join(string(filepath.Separator), "etc", "codex", "skills"), SourceKind: "system"},
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

func readCodexSkillRecord(root CodexSkillRoot, dir string, skillConfigRules []codexSkillConfigRule) (*CodexSkillRecord, error) {
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
		Enabled:         codexSkillEnabled(skillPath, name, skillConfigRules),
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

func resolveCodexSkillRemovalTarget(skillPath string, roots []CodexSkillRoot) (string, string, error) {
	absSkillPath, matchedRoot, err := resolveCodexSkillPathAndRoot(skillPath, roots)
	if err != nil {
		return "", "", err
	}
	normalizedSkillPath := normalizeCodexSkillConfigPath(absSkillPath)
	targetDir := filepath.Dir(normalizedSkillPath)
	if matchedRoot.SourceKind == "system" {
		return "", "", errors.New("system skills cannot be removed")
	}
	return targetDir, normalizedSkillPath, nil
}

func resolveCodexSkillPathInRoots(skillPath string, roots []CodexSkillRoot) (string, error) {
	absSkillPath, _, err := resolveCodexSkillPathAndRoot(skillPath, roots)
	return absSkillPath, err
}

func resolveCodexSkillPathAndRoot(skillPath string, roots []CodexSkillRoot) (string, *CodexSkillRoot, error) {
	absSkillPath, err := filepath.Abs(filepath.Clean(skillPath))
	if err != nil {
		return "", nil, err
	}
	if filepath.Base(absSkillPath) != "SKILL.md" {
		return "", nil, errors.New("skill path must point to SKILL.md")
	}
	targetDir := filepath.Dir(absSkillPath)
	var matchedRoot *CodexSkillRoot
	matchedRootPath := ""
	for _, root := range roots {
		rootPath, err := filepath.Abs(filepath.Clean(root.Path))
		if err != nil {
			continue
		}
		rel, err := filepath.Rel(rootPath, targetDir)
		if err != nil || rel == "." || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
			continue
		}
		if len(rootPath) > len(matchedRootPath) {
			rootCopy := root
			matchedRoot = &rootCopy
			matchedRootPath = rootPath
		}
	}
	if matchedRoot == nil {
		return "", nil, errors.New("skill is outside configured roots")
	}
	if _, err := os.Stat(absSkillPath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", nil, errors.New("skill does not exist")
		}
		return "", nil, err
	}
	return absSkillPath, matchedRoot, nil
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
		file := CodexSkillFile{Path: rel, Kind: codexSkillFileKind(rel)}
		if info, err := entry.Info(); err == nil && info.Size() <= maxCodexSkillPreviewBytes {
			file.Previewable = true
		}
		files = append(files, file)
		return nil
	})
	sort.Slice(files, func(i, j int) bool { return files[i].Path < files[j].Path })
	return files
}

const maxCodexSkillPreviewBytes = 64 * 1024

func resolveCodexSkillFilePreviewTarget(skillDir string, filePath string) (string, string, error) {
	cleanRel := filepath.Clean(filePath)
	if cleanRel == "." || filepath.IsAbs(cleanRel) {
		return "", "", errors.New("file path must be relative to the skill directory")
	}
	targetPath := filepath.Join(skillDir, cleanRel)
	rel, err := filepath.Rel(skillDir, targetPath)
	if err != nil || rel == "." || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", "", errors.New("file path is outside the skill directory")
	}
	info, err := os.Stat(targetPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", "", errors.New("skill file does not exist")
		}
		return "", "", err
	}
	if info.IsDir() {
		return "", "", errors.New("skill file path points to a directory")
	}
	return targetPath, rel, nil
}

func readCodexSkillFilePreview(path string, maxBytes int64) (string, bool) {
	info, err := os.Stat(path)
	if err != nil || info.Size() > maxBytes {
		return "", false
	}
	body, err := os.ReadFile(path)
	if err != nil {
		return "", false
	}
	if bytesContainNUL(body) {
		return "", false
	}
	return string(body), true
}

func bytesContainNUL(body []byte) bool {
	for _, value := range body {
		if value == 0 {
			return true
		}
	}
	return false
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

type codexSkillConfigRule struct {
	path    string
	name    string
	enabled bool
}

func readCodexSkillConfigRules(configPath string) ([]codexSkillConfigRule, []string) {
	body, err := os.ReadFile(configPath)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, []string{fmt.Sprintf("读取 config.toml 失败: %v", err)}
	}
	rules := []codexSkillConfigRule{}
	for _, block := range parseSkillsConfigBlocks(string(body)) {
		if block.enabled == nil {
			continue
		}
		if block.path != "" && block.name != "" {
			continue
		}
		if block.path != "" {
			rules = append(rules, codexSkillConfigRule{
				path:    normalizeCodexSkillConfigPath(block.path),
				enabled: *block.enabled,
			})
			continue
		}
		if strings.TrimSpace(block.name) != "" {
			rules = append(rules, codexSkillConfigRule{
				name:    strings.TrimSpace(block.name),
				enabled: *block.enabled,
			})
		}
	}
	return rules, nil
}

func codexSkillEnabled(skillPath string, skillName string, rules []codexSkillConfigRule) bool {
	normalizedPath := normalizeCodexSkillConfigPath(skillPath)
	enabled := true
	for _, rule := range rules {
		if rule.path != "" && rule.path == normalizedPath {
			enabled = rule.enabled
			continue
		}
		if rule.name != "" && rule.name == skillName {
			enabled = rule.enabled
		}
	}
	return enabled
}

type codexSkillConfigBlock struct {
	start   int
	end     int
	path    string
	name    string
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
			if value, ok := parseTomlStringKeyValue(lines[next], "name"); ok {
				block.name = value
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

func patchCodexSkillEnabledConfig(existing string, skillPath string, skillName string, enabled bool) (string, error) {
	if strings.Contains(existing, "\r\n") {
		withoutCRLF := strings.ReplaceAll(existing, "\r\n", "")
		if strings.Contains(withoutCRLF, "\n") {
			return "", errors.New("config.toml 同时包含 CRLF 和 LF，已停止写入以避免破坏换行格式")
		}
	}
	lines, newline := splitTomlDocument(existing)
	blocks := parseSkillsConfigBlocks(existing)
	normalizedSkillPath := normalizeCodexSkillConfigPath(skillPath)
	normalizedSkillName := strings.TrimSpace(skillName)
	remove := map[int]int{}
	hasDisabled := false
	for _, block := range blocks {
		pathMatches := block.path != "" && normalizeCodexSkillConfigPath(block.path) == normalizedSkillPath
		nameMatches := normalizedSkillName != "" && strings.TrimSpace(block.name) == normalizedSkillName
		if !pathMatches && !nameMatches {
			continue
		}
		if enabled {
			remove[block.start] = block.end
			continue
		}
		if pathMatches && block.enabled != nil && !*block.enabled {
			hasDisabled = true
		}
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
		lines = append(lines, fmt.Sprintf("path = %s", quoteTomlString(normalizedSkillPath)))
		lines = append(lines, "enabled = false")
	}
	return joinTomlDocument(lines, newline), nil
}

func normalizeCodexSkillConfigPath(path string) string {
	cleaned := filepath.Clean(path)
	absolute, err := filepath.Abs(cleaned)
	if err != nil {
		absolute = cleaned
	}
	if evaluated, err := filepath.EvalSymlinks(absolute); err == nil {
		return evaluated
	}
	return absolute
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
	document := &codexMcpDocument{
		lines:        lines,
		newline:      newline,
		configPath:   configPath,
		exists:       exists,
		tools:        map[string][]CodexMcpToolRow{},
		toolSections: map[string][]codexMcpServerSection{},
	}
	for index, line := range lines {
		section := strings.TrimSpace(stripTomlLineComment(line))
		if !strings.HasPrefix(section, "[mcp_servers.") || !strings.HasSuffix(section, "]") {
			continue
		}
		if serverID, toolName, ok := parseCodexMcpToolSectionID(section); ok {
			approvalMode := ""
			for next := index + 1; next < len(lines); next++ {
				if isTomlSectionHeader(lines[next]) {
					break
				}
				if value, ok := parseTomlStringKeyValue(lines[next], "approval_mode"); ok {
					approvalMode = value
					break
				}
			}
			end := len(lines)
			for next := index + 1; next < len(lines); next++ {
				if isTomlSectionHeader(lines[next]) {
					end = next
					break
				}
			}
			document.tools[serverID] = append(document.tools[serverID], CodexMcpToolRow{Name: toolName, ApprovalMode: approvalMode})
			document.toolSections[serverID] = append(document.toolSections[serverID], codexMcpServerSection{
				id:    toolName,
				start: index,
				end:   end,
				lines: append([]string(nil), lines[index+1:end]...),
			})
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
	for serverID := range document.tools {
		sort.Slice(document.tools[serverID], func(i, j int) bool {
			return document.tools[serverID][i].Name < document.tools[serverID][j].Name
		})
	}
	for serverID := range document.toolSections {
		sort.Slice(document.toolSections[serverID], func(i, j int) bool {
			return document.toolSections[serverID][i].start < document.toolSections[serverID][j].start
		})
	}
	return document, nil
}

func parseCodexMcpToolSectionID(section string) (string, string, bool) {
	path := strings.TrimSuffix(strings.TrimPrefix(section, "[mcp_servers."), "]")
	segments := splitTomlDottedPath(path)
	if len(segments) != 3 || strings.Trim(segments[1], `"`) != "tools" {
		return "", "", false
	}
	serverID := strings.Trim(strings.TrimSpace(segments[0]), `"`)
	toolName := strings.Trim(strings.TrimSpace(segments[2]), `"`)
	if serverID == "" || toolName == "" {
		return "", "", false
	}
	return serverID, toolName, true
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
		if value, ok := parseTomlStringKeyValue(line, "cwd"); ok {
			server.Cwd = value
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
		if value, ok := parseTomlStringKeyValue(line, "experimental_environment"); ok {
			server.ExperimentalEnvironment = value
			continue
		}
		if value, ok := parseTomlStringKeyValue(line, "default_tools_approval_mode"); ok {
			server.DefaultToolsApprovalMode = value
			continue
		}
		if value, ok := parseTomlStringKeyValue(line, "oauth_resource"); ok {
			server.OAuthResource = value
			continue
		}
		if value, ok := parseTomlStringArrayKeyValue(line, "args"); ok {
			server.Args = value
			continue
		}
		if value, ok := parseTomlStringArrayKeyValue(line, "enabled_tools"); ok {
			server.EnabledTools = value
			continue
		}
		if value, ok := parseTomlStringArrayKeyValue(line, "disabled_tools"); ok {
			server.DisabledTools = value
			continue
		}
		if value, ok := parseTomlStringArrayKeyValue(line, "scopes"); ok {
			server.Scopes = value
			continue
		}
		if value, ok := parseTomlRawKeyValue(line, "env_vars"); ok {
			server.EnvVarsRaw = value
			continue
		}
		if value, ok := parseTomlRawKeyValue(line, "startup_timeout_sec"); ok {
			server.StartupTimeoutSec = value
			continue
		}
		if value, ok := parseTomlRawKeyValue(line, "startup_timeout_ms"); ok && server.StartupTimeoutSec == "" {
			if ms, err := strconv.ParseFloat(strings.TrimSpace(value), 64); err == nil {
				server.StartupTimeoutSec = strconv.FormatFloat(ms/1000, 'f', -1, 64)
			}
			continue
		}
		if value, ok := parseTomlRawKeyValue(line, "tool_timeout_sec"); ok {
			server.ToolTimeoutSec = value
			continue
		}
		if value, ok := parseTomlInlineStringMap(line, "env"); ok {
			server.Env = codexMcpEnvRows(value)
			continue
		}
		if value, ok := parseTomlInlineStringMap(line, "http_headers"); ok {
			server.HTTPHeaders = codexMcpEnvRows(value)
			continue
		}
		if value, ok := parseTomlInlineStringMap(line, "env_http_headers"); ok {
			server.EnvHTTPHeaders = codexMcpEnvRows(value)
			continue
		}
		if key, value, isBool, ok := parseTomlBoolKeyValue(line); ok && isBool {
			switch key {
			case "enabled":
				server.Enabled = value
				continue
			case "required":
				server.Required = value
				continue
			case "supports_parallel_tool_calls":
				server.SupportsParallelToolCalls = value
				continue
			}
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
		if server.URL != "" || server.BearerTokenEnvVar != "" || len(server.HTTPHeaders) > 0 || len(server.EnvHTTPHeaders) > 0 || server.OAuthResource != "" {
			return errors.New("transport conflict: stdio does not support url, bearer_token_env_var, http headers, or oauth_resource")
		}
		if strings.TrimSpace(server.EnvVarsRaw) != "" && !strings.HasPrefix(strings.TrimSpace(server.EnvVarsRaw), "[") {
			return errors.New("env_vars must be a TOML array")
		}
	case "streamable_http":
		if strings.TrimSpace(server.URL) == "" {
			return errors.New("streamable_http mcp server requires url")
		}
		if server.Command != "" || len(server.Args) > 0 || len(server.Env) > 0 || strings.TrimSpace(server.EnvVarsRaw) != "" || server.Cwd != "" {
			return errors.New("transport conflict: streamable_http does not support command, args, env, env_vars, or cwd")
		}
	default:
		return fmt.Errorf("unsupported mcp transport %q", server.Transport)
	}
	if server.DefaultToolsApprovalMode != "" && server.DefaultToolsApprovalMode != "auto" && server.DefaultToolsApprovalMode != "prompt" && server.DefaultToolsApprovalMode != "approve" {
		return errors.New("default_tools_approval_mode must be auto, prompt, or approve")
	}
	if err := validateOptionalNonNegativeNumber(server.StartupTimeoutSec, "startup_timeout_sec"); err != nil {
		return err
	}
	if err := validateOptionalNonNegativeNumber(server.ToolTimeoutSec, "tool_timeout_sec"); err != nil {
		return err
	}
	return nil
}

func validateOptionalNonNegativeNumber(value string, field string) error {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	number, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
	if err != nil || number < 0 {
		return fmt.Errorf("%s must be a non-negative number", field)
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
		"command": true, "args": true, "env": true, "env_vars": true, "cwd": true,
		"url": true, "bearer_token_env_var": true, "bearer_token": true, "http_headers": true, "env_http_headers": true,
		"enabled": true, "required": true, "supports_parallel_tool_calls": true, "experimental_environment": true,
		"startup_timeout_sec": true, "startup_timeout_ms": true, "tool_timeout_sec": true,
		"default_tools_approval_mode": true, "enabled_tools": true, "disabled_tools": true, "scopes": true, "oauth_resource": true,
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
		if strings.TrimSpace(server.EnvVarsRaw) != "" {
			lines = append(lines, fmt.Sprintf("env_vars = %s", strings.TrimSpace(server.EnvVarsRaw)))
		}
		if strings.TrimSpace(server.Cwd) != "" {
			lines = append(lines, fmt.Sprintf("cwd = %s", quoteTomlString(server.Cwd)))
		}
	} else {
		lines = append(lines, fmt.Sprintf("url = %s", quoteTomlString(server.URL)))
		if strings.TrimSpace(server.BearerTokenEnvVar) != "" {
			lines = append(lines, fmt.Sprintf("bearer_token_env_var = %s", quoteTomlString(server.BearerTokenEnvVar)))
		}
		if len(server.HTTPHeaders) > 0 {
			lines = append(lines, fmt.Sprintf("http_headers = %s", formatTomlInlineEnv(server.HTTPHeaders)))
		}
		if len(server.EnvHTTPHeaders) > 0 {
			lines = append(lines, fmt.Sprintf("env_http_headers = %s", formatTomlInlineEnv(server.EnvHTTPHeaders)))
		}
	}
	if !server.Enabled {
		lines = append(lines, "enabled = false")
	}
	if strings.TrimSpace(server.ExperimentalEnvironment) != "" {
		lines = append(lines, fmt.Sprintf("experimental_environment = %s", quoteTomlString(server.ExperimentalEnvironment)))
	}
	if server.Required {
		lines = append(lines, "required = true")
	}
	if server.SupportsParallelToolCalls {
		lines = append(lines, "supports_parallel_tool_calls = true")
	}
	if strings.TrimSpace(server.StartupTimeoutSec) != "" {
		lines = append(lines, fmt.Sprintf("startup_timeout_sec = %s", strings.TrimSpace(server.StartupTimeoutSec)))
	}
	if strings.TrimSpace(server.ToolTimeoutSec) != "" {
		lines = append(lines, fmt.Sprintf("tool_timeout_sec = %s", strings.TrimSpace(server.ToolTimeoutSec)))
	}
	if strings.TrimSpace(server.DefaultToolsApprovalMode) != "" {
		lines = append(lines, fmt.Sprintf("default_tools_approval_mode = %s", quoteTomlString(server.DefaultToolsApprovalMode)))
	}
	if len(server.EnabledTools) > 0 {
		lines = append(lines, fmt.Sprintf("enabled_tools = %s", formatTomlStringArray(server.EnabledTools)))
	}
	if len(server.DisabledTools) > 0 {
		lines = append(lines, fmt.Sprintf("disabled_tools = %s", formatTomlStringArray(server.DisabledTools)))
	}
	if len(server.Scopes) > 0 {
		lines = append(lines, fmt.Sprintf("scopes = %s", formatTomlStringArray(server.Scopes)))
	}
	if strings.TrimSpace(server.OAuthResource) != "" {
		lines = append(lines, fmt.Sprintf("oauth_resource = %s", quoteTomlString(server.OAuthResource)))
	}
	return lines
}

func formatCodexMcpRawConfig(lines []string, section codexMcpServerSection, toolSections []codexMcpServerSection) string {
	if section.start < 0 || section.end > len(lines) || section.start >= section.end {
		return ""
	}
	raw := append([]string(nil), lines[section.start:section.end]...)
	for _, toolSection := range toolSections {
		if toolSection.start < 0 || toolSection.end > len(lines) || toolSection.start >= toolSection.end {
			continue
		}
		if len(raw) > 0 && strings.TrimSpace(raw[len(raw)-1]) != "" {
			raw = append(raw, "")
		}
		raw = append(raw, lines[toolSection.start:toolSection.end]...)
	}
	return strings.TrimRight(strings.Join(raw, "\n"), "\n")
}

func formatMcpCurrentConfigToml(server CodexMcpServer) string {
	lines := []string{"[mcp_servers." + server.ID + "]"}
	lines = append(lines, formatCodexMcpServerKnownLines(server)...)
	for _, tool := range server.Tools {
		if strings.TrimSpace(tool.Name) == "" {
			continue
		}
		lines = append(lines, "", "[mcp_servers."+server.ID+".tools."+tool.Name+"]")
		if strings.TrimSpace(tool.ApprovalMode) != "" {
			lines = append(lines, fmt.Sprintf("approval_mode = %s", quoteTomlString(tool.ApprovalMode)))
		}
	}
	return strings.Join(lines, "\n")
}

func parseTomlRawKeyValue(line string, key string) (string, bool) {
	if !tomlLineDefinesKey(line, key) {
		return "", false
	}
	content := strings.TrimSpace(stripTomlLineComment(line))
	parts := strings.SplitN(content, "=", 2)
	if len(parts) != 2 {
		return "", false
	}
	return strings.TrimSpace(parts[1]), true
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
	add("required", strconv.FormatBool(before.Required), strconv.FormatBool(after.Required))
	add("supports_parallel_tool_calls", strconv.FormatBool(before.SupportsParallelToolCalls), strconv.FormatBool(after.SupportsParallelToolCalls))
	add("transport", before.Transport, after.Transport)
	add("command", before.Command, after.Command)
	add("args", strings.Join(before.Args, " "), strings.Join(after.Args, " "))
	add("env", formatMcpEnvRowsForChange(before.Env), formatMcpEnvRowsForChange(after.Env))
	add("env_vars", before.EnvVarsRaw, after.EnvVarsRaw)
	add("cwd", before.Cwd, after.Cwd)
	add("url", before.URL, after.URL)
	add("bearer_token_env_var", before.BearerTokenEnvVar, after.BearerTokenEnvVar)
	add("http_headers", formatMcpEnvRowsForChange(before.HTTPHeaders), formatMcpEnvRowsForChange(after.HTTPHeaders))
	add("env_http_headers", formatMcpEnvRowsForChange(before.EnvHTTPHeaders), formatMcpEnvRowsForChange(after.EnvHTTPHeaders))
	add("experimental_environment", before.ExperimentalEnvironment, after.ExperimentalEnvironment)
	add("startup_timeout_sec", before.StartupTimeoutSec, after.StartupTimeoutSec)
	add("tool_timeout_sec", before.ToolTimeoutSec, after.ToolTimeoutSec)
	add("default_tools_approval_mode", before.DefaultToolsApprovalMode, after.DefaultToolsApprovalMode)
	add("enabled_tools", strings.Join(before.EnabledTools, ", "), strings.Join(after.EnabledTools, ", "))
	add("disabled_tools", strings.Join(before.DisabledTools, ", "), strings.Join(after.DisabledTools, ", "))
	add("scopes", strings.Join(before.Scopes, ", "), strings.Join(after.Scopes, ", "))
	add("oauth_resource", before.OAuthResource, after.OAuthResource)
	return changes
}

func formatMcpEnvRowsForChange(rows []CodexMcpEnvRow) string {
	if len(rows) == 0 {
		return ""
	}
	parts := make([]string, 0, len(rows))
	for _, row := range rows {
		parts = append(parts, row.Key+"="+row.Value)
	}
	sort.Strings(parts)
	return strings.Join(parts, "\n")
}
