package wailsapp

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestScanMemoryFile_ValidFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "CLAUDE.md")
	content := "# Project\n\n@AGENTS.md\n@.claude/testing.md\n"
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}

	record := scanMemoryFile(MemoryFileScopeProject, path, dir, 0)
	if !record.Exists {
		t.Fatal("expected file to exist")
	}
	if record.Size == 0 {
		t.Fatal("expected non-zero size")
	}
	if len(record.Imports) != 2 {
		t.Fatalf("expected 2 imports, got %d", len(record.Imports))
	}
}

func TestScanMemoryFile_EmptyFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "CLAUDE.md")
	if err := os.WriteFile(path, []byte(""), 0600); err != nil {
		t.Fatal(err)
	}

	record := scanMemoryFile(MemoryFileScopeProject, path, dir, 0)
	if record.Exists {
		t.Fatal("expected empty file to report Exists=false")
	}
}

func TestParseMemoryFileImports_FindsImports(t *testing.T) {
	content := "# Header\n\n@AGENTS.md\n@.claude/style.md\nSome text\n@../shared/rules.md"
	imports := parseMemoryFileImports(content, "/project/CLAUDE.md", 0)

	if len(imports) != 3 {
		t.Fatalf("expected 3 imports, got %d", len(imports))
	}
	if imports[0].Raw != "AGENTS.md" {
		t.Fatalf("expected AGENTS.md, got %s", imports[0].Raw)
	}
	if imports[1].Raw != ".claude/style.md" {
		t.Fatalf("expected .claude/style.md, got %s", imports[1].Raw)
	}
	if imports[2].Raw != "../shared/rules.md" {
		t.Fatalf("expected ../shared/rules.md, got %s", imports[2].Raw)
	}
}

func TestParseMemoryFileImports_Deduplicates(t *testing.T) {
	content := "@AGENTS.md\n@AGENTS.md"
	imports := parseMemoryFileImports(content, "/project/CLAUDE.md", 0)
	if len(imports) != 1 {
		t.Fatalf("expected 1 deduplicated import, got %d", len(imports))
	}
}

func TestParseMemoryFileImports_MaxDepth(t *testing.T) {
	content := "@a.md"
	imports := parseMemoryFileImports(content, "/project/CLAUDE.md", maxImportDepth)
	if len(imports) != 0 {
		t.Fatalf("expected no imports at max depth, got %d", len(imports))
	}
}

func TestParseMemoryFileImports_ImportExists(t *testing.T) {
	dir := t.TempDir()
	importPath := filepath.Join(dir, "imported.md")
	if err := os.WriteFile(importPath, []byte("# Imported"), 0600); err != nil {
		t.Fatal(err)
	}

	content := "@" + importPath
	imports := parseMemoryFileImports(content, filepath.Join(dir, "CLAUDE.md"), 0)

	if len(imports) != 1 {
		t.Fatalf("expected 1 import, got %d", len(imports))
	}
	if !imports[0].Exists {
		t.Fatal("expected import to exist")
	}
}

func TestParseMemoryFileImports_ImportMissing(t *testing.T) {
	content := "@nonexistent/file.md"
	imports := parseMemoryFileImports(content, "/project/CLAUDE.md", 0)

	if len(imports) != 1 {
		t.Fatalf("expected 1 import, got %d", len(imports))
	}
	if imports[0].Exists {
		t.Fatal("expected import to be missing")
	}
}

func TestIsMemoryFileGitIgnored_MatchesPattern(t *testing.T) {
	dir := t.TempDir()
	gitignorePath := filepath.Join(dir, ".gitignore")
	if err := os.WriteFile(gitignorePath, []byte("CLAUDE.local.md\n"), 0600); err != nil {
		t.Fatal(err)
	}

	localPath := filepath.Join(dir, "CLAUDE.local.md")
	if err := os.WriteFile(localPath, []byte("# local"), 0600); err != nil {
		t.Fatal(err)
	}

	if !isMemoryFileGitIgnored(localPath, dir) {
		t.Fatal("expected CLAUDE.local.md to be gitignored")
	}
}

func TestIsMemoryFileGitIgnored_NotIgnored(t *testing.T) {
	dir := t.TempDir()
	gitignorePath := filepath.Join(dir, ".gitignore")
	if err := os.WriteFile(gitignorePath, []byte("*.log\n"), 0600); err != nil {
		t.Fatal(err)
	}

	localPath := filepath.Join(dir, "CLAUDE.local.md")
	if err := os.WriteFile(localPath, []byte("# local"), 0600); err != nil {
		t.Fatal(err)
	}

	if isMemoryFileGitIgnored(localPath, dir) {
		t.Fatal("expected CLAUDE.local.md NOT to be gitignored")
	}
}

func TestValidateMemoryFilePath_RejectsInvalidPath(t *testing.T) {
	err := validateMemoryFilePath("/etc/passwd")
	if err == nil {
		t.Fatal("expected error for path outside allowed scope")
	}
}

func TestValidateMemoryFilePath_RejectsInvalidFilename(t *testing.T) {
	err := validateMemoryFilePath("/tmp/random.md")
	if err == nil {
		t.Fatal("expected error for invalid filename")
	}
	if !strings.Contains(err.Error(), "不允许的文件名") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestSaveClaudeCodeMemoryFile_HomeDirScope(t *testing.T) {
	tmpHome := t.TempDir()
	t.Setenv("HOME", tmpHome)
	claudeDir := filepath.Join(tmpHome, ".claude")
	if err := os.MkdirAll(claudeDir, 0700); err != nil {
		t.Fatal(err)
	}

	path := filepath.Join(claudeDir, "CLAUDE.md")
	app := &App{}
	result, err := app.SaveClaudeCodeMemoryFile(SaveClaudeCodeMemoryFileInput{
		Path:    path,
		Content: "# Test Memory",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Size == 0 {
		t.Fatal("expected non-zero size")
	}

	saved, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(saved), "# Test Memory") {
		t.Fatal("saved content doesn't match")
	}
}

func TestSaveClaudeCodeMemoryFile_LocalFileWarning(t *testing.T) {
	tmpHome := t.TempDir()
	t.Setenv("HOME", tmpHome)
	claudeDir := filepath.Join(tmpHome, ".claude")
	path := filepath.Join(claudeDir, "CLAUDE.local.md")

	app := &App{}
	result, err := app.SaveClaudeCodeMemoryFile(SaveClaudeCodeMemoryFileInput{
		Path:    path,
		Content: "# Local",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Warning, "gitignore") {
		t.Fatalf("expected gitignore warning, got: %s", result.Warning)
	}
}

func TestSaveClaudeCodeMemoryFile_EmptyContent(t *testing.T) {
	app := &App{}
	_, err := app.SaveClaudeCodeMemoryFile(SaveClaudeCodeMemoryFileInput{
		Path:    "/tmp/test.md",
		Content: "",
	})
	if err == nil {
		t.Fatal("expected error for empty content")
	}
}

func TestValidateClaudeCodeMemoryImports_Circular(t *testing.T) {
	tmpHome := t.TempDir()
	t.Setenv("HOME", tmpHome)
	claudeDir := filepath.Join(tmpHome, ".claude")
	if err := os.MkdirAll(claudeDir, 0700); err != nil {
		t.Fatal(err)
	}

	path := filepath.Join(claudeDir, "CLAUDE.md")
	if err := os.WriteFile(path, []byte("@CLAUDE.md"), 0600); err != nil {
		t.Fatal(err)
	}

	app := &App{}
	result, err := app.ValidateClaudeCodeMemoryImports(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	hasCircular := false
	for _, w := range result.Warnings {
		if strings.Contains(w, "circular") {
			hasCircular = true
		}
	}
	if !hasCircular {
		t.Fatal("expected circular import warning")
	}
}

func TestGetClaudeCodeMemoryFilesSnapshot_UsesHomeDir(t *testing.T) {
	tmpHome := t.TempDir()
	t.Setenv("HOME", tmpHome)
	claudeDir := filepath.Join(tmpHome, ".claude")
	if err := os.MkdirAll(claudeDir, 0700); err != nil {
		t.Fatal(err)
	}
	userPath := filepath.Join(claudeDir, "CLAUDE.md")
	if err := os.WriteFile(userPath, []byte("# User Memory\n@AGENTS.md"), 0600); err != nil {
		t.Fatal(err)
	}

	app := &App{}
	snapshot, err := app.GetClaudeCodeMemoryFilesSnapshot()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var userFile *ClaudeCodeMemoryFileRecord
	for i := range snapshot.Files {
		if snapshot.Files[i].Scope == MemoryFileScopeUser {
			userFile = &snapshot.Files[i]
			break
		}
	}
	if userFile == nil {
		t.Fatal("expected user-level file in snapshot")
	}
	if !userFile.Exists {
		t.Fatal("expected user CLAUDE.md to exist")
	}
	if len(userFile.Imports) == 0 {
		t.Fatal("expected at least one import")
	}
}
