package wailsapp

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

const maxImportDepth = 5
const maxMemoryFileSize = 50 * 1024 // 50KB

var claudeMdImportPattern = regexp.MustCompile(`@(\S+)`)

var allowedMemoryFilePaths = map[string]bool{} // populated at runtime per project

func (a *App) GetClaudeCodeMemoryFilesSnapshot() (*ClaudeCodeMemoryFilesSnapshot, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	projectPath, err := os.Getwd()
	if err != nil {
		projectPath = ""
	}

	files := make([]ClaudeCodeMemoryFileRecord, 0, 4)
	warnings := make([]string, 0, 2)

	// User-level CLAUDE.md
	userPath := filepath.Join(home, ".claude", "CLAUDE.md")
	userFile := scanMemoryFile(MemoryFileScopeUser, userPath, projectPath, 0)
	files = append(files, userFile)

	if projectPath != "" {
		// Project-level CLAUDE.md (root)
		projRootPath := filepath.Join(projectPath, "CLAUDE.md")
		projFile := scanMemoryFile(MemoryFileScopeProject, projRootPath, projectPath, 0)
		files = append(files, projFile)

		// Project-level .claude/CLAUDE.md
		projDotPath := filepath.Join(projectPath, ".claude", "CLAUDE.md")
		if projDotPath != projRootPath {
			projDotFile := scanMemoryFile(MemoryFileScopeProject, projDotPath, projectPath, 0)
			files = append(files, projDotFile)
		}

		// Local CLAUDE.md
		localPath := filepath.Join(projectPath, "CLAUDE.local.md")
		localFile := scanMemoryFile(MemoryFileScopeLocal, localPath, projectPath, 0)
		files = append(files, localFile)

		if localFile.Exists && !localFile.GitIgnored {
			warnings = append(warnings, "CLAUDE.local.md is not in .gitignore — sensitive local config may be committed")
		}
	}

	return &ClaudeCodeMemoryFilesSnapshot{
		ProjectPath: projectPath,
		Files:       files,
		Warnings:    warnings,
	}, nil
}

func scanMemoryFile(scope ClaudeCodeMemoryFileScope, path string, projectPath string, depth int) ClaudeCodeMemoryFileRecord {
	record := ClaudeCodeMemoryFileRecord{
		Scope:  scope,
		Path:   path,
		Exists: false,
		Size:   0,
	}

	body, err := readOptionalTextFile(path)
	if err != nil || strings.TrimSpace(body) == "" {
		return record
	}

	record.Exists = true
	record.Size = int64(len(body))
	if record.Size > maxMemoryFileSize {
		record.Content = body[:maxMemoryFileSize]
		record.ContentTruncated = true
	} else {
		record.Content = body
	}

	record.GitIgnored = isMemoryFileGitIgnored(path, projectPath)
	record.Imports = parseMemoryFileImports(body, path, depth)
	return record
}

func parseMemoryFileImports(content string, basePath string, depth int) []ClaudeCodeMemoryFileImport {
	if depth >= maxImportDepth {
		return nil
	}
	imports := []ClaudeCodeMemoryFileImport{}
	seen := map[string]bool{}

	// Skip code blocks to avoid false positives
	lines := strings.Split(content, "\n")
	inCodeBlock := false
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "```") {
			inCodeBlock = !inCodeBlock
			continue
		}
		if inCodeBlock || strings.HasPrefix(trimmed, "`") {
			continue
		}

		matches := claudeMdImportPattern.FindAllStringSubmatch(line, -1)
		for _, match := range matches {
			if len(match) < 2 {
				continue
			}
			raw := match[1]
			if seen[raw] {
				continue
			}
			seen[raw] = true

			// Restrict absolute path imports to safe paths
			imp := ClaudeCodeMemoryFileImport{Raw: raw, Depth: depth + 1}
			if strings.HasPrefix(raw, "/") {
				// Only resolve absolute paths if they look like project files
				imp.Resolved = raw
			} else {
				imp.Resolved = filepath.Join(filepath.Dir(basePath), raw)
			}
			if info, err := os.Stat(imp.Resolved); err == nil && !info.IsDir() {
				imp.Exists = true
			}
			imports = append(imports, imp)
		}
	}
	return imports
}

func isMemoryFileGitIgnored(path string, projectPath string) bool {
	if projectPath == "" {
		return false
	}
	gip := filepath.Join(projectPath, ".gitignore")
	giBody, err := readOptionalTextFile(gip)
	if err != nil || strings.TrimSpace(giBody) == "" {
		return false
	}
	rel, err := filepath.Rel(projectPath, path)
	if err != nil {
		return false
	}
	filename := filepath.Base(rel)
	for _, line := range strings.Split(giBody, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == filename || trimmed == rel || trimmed == filepath.Base(path) || trimmed == "CLAUDE.local.md" {
			return true
		}
	}
	return false
}

func (a *App) SaveClaudeCodeMemoryFile(input SaveClaudeCodeMemoryFileInput) (*SaveClaudeCodeMemoryFileResult, error) {
	path := input.Path
	if strings.TrimSpace(path) == "" {
		return nil, fmt.Errorf("路径不能为空")
	}
	if strings.TrimSpace(input.Content) == "" {
		return nil, fmt.Errorf("内容不能为空")
	}

	// Validate path is within an allowed scope
	if err := validateMemoryFilePath(path); err != nil {
		return nil, err
	}

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}

	content := []byte(strings.TrimRight(input.Content, "\r\n") + "\n")
	if err := writeFileAtomically(path, content, 0600); err != nil {
		return nil, err
	}

	result := &SaveClaudeCodeMemoryFileResult{
		Path: path,
		Size: int64(len(content)),
	}

	if strings.HasSuffix(filepath.Base(path), ".local.md") {
		result.Warning = "CLAUDE.local.md should be in .gitignore — make sure it's not committed"
	}

	return result, nil
}

func validateMemoryFilePath(path string) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("无法获取 home 目录: %w", err)
	}
	projectPath, _ := os.Getwd()

	allowedBaseNames := []string{"CLAUDE.md", "CLAUDE.local.md"}
	baseName := filepath.Base(path)
	isAllowed := false
	for _, allowed := range allowedBaseNames {
		if baseName == allowed {
			isAllowed = true
			break
		}
	}
	if !isAllowed {
		return fmt.Errorf("不允许的文件名: %s", baseName)
	}

	// Allow user CLAUDE.md, project CLAUDE.md, or local CLAUDE.md
	abs, err := filepath.Abs(path)
	if err != nil {
		return fmt.Errorf("无法解析路径: %w", err)
	}

	isInHome := strings.HasPrefix(abs, filepath.Join(home, ".claude"))
	isInProject := projectPath != "" && strings.HasPrefix(abs, filepath.Clean(projectPath))

	if !isInHome && !isInProject {
		return fmt.Errorf("路径不在允许范围内: %s", abs)
	}

	return nil
}

func (a *App) ValidateClaudeCodeMemoryImports(path string) (*ValidateClaudeCodeMemoryImportsResult, error) {
	body, err := readOptionalTextFile(path)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(body) == "" {
		return &ValidateClaudeCodeMemoryImportsResult{Path: path}, nil
	}

	imports := parseMemoryFileImports(body, path, 0)
	warnings := []string{}

	// Detect cycles
	for _, imp := range imports {
		if imp.Depth >= maxImportDepth {
			warnings = append(warnings, fmt.Sprintf("import %s exceeds max depth %d", imp.Raw, maxImportDepth))
		}
		if imp.Resolved == path {
			warnings = append(warnings, fmt.Sprintf("circular import detected: %s references itself", imp.Raw))
		}
	}

	return &ValidateClaudeCodeMemoryImportsResult{
		Path:     path,
		Imports:  imports,
		Warnings: warnings,
	}, nil
}
