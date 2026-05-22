package wailsapp

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseSubagentFile_Valid(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "reviewer.md")
	content := `---
name: code-reviewer
description: Reviews code changes with project context
tools:
  - Read
  - Grep
  - Bash
model: claude-sonnet-4-6
permissionMode: default
maxTurns: 25
---

# Code Reviewer

You are a thorough code reviewer. Focus on correctness and security.
`
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}

	record := parseSubagentFile(path, "user")
	if !record.FrontmatterValid {
		t.Fatalf("expected valid frontmatter, got errors: %v", record.ValidationErrors)
	}
	if record.Name != "code-reviewer" {
		t.Fatalf("expected name 'code-reviewer', got '%s'", record.Name)
	}
	if record.Description != "Reviews code changes with project context" {
		t.Fatalf("unexpected description: %s", record.Description)
	}
	if record.Scope != "user" {
		t.Fatalf("expected scope 'user', got '%s'", record.Scope)
	}
	if record.BodyPreview == "" {
		t.Fatal("expected body preview")
	}
	if len(record.KnownFields) == 0 {
		t.Fatal("expected known fields")
	}
}

func TestParseSubagentFile_MissingName(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "bad.md")
	content := `---
description: Has a description but no name
tools: [Read]
---
`
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}

	record := parseSubagentFile(path, "user")
	if record.FrontmatterValid {
		t.Fatal("expected invalid frontmatter")
	}
	hasNameErr := false
	for _, e := range record.ValidationErrors {
		if strings.Contains(e, "name") {
			hasNameErr = true
		}
	}
	if !hasNameErr {
		t.Fatalf("expected 'name 为必填字段' error, got: %v", record.ValidationErrors)
	}
}

func TestParseSubagentFile_MissingDescription(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "nodesc.md")
	content := `---
name: no-desc
tools: [Read]
---
`
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}

	record := parseSubagentFile(path, "user")
	if record.FrontmatterValid {
		t.Fatal("expected invalid frontmatter (missing description)")
	}
}

func TestParseSubagentFile_NoFrontmatter(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "nofm.md")
	content := `# Just markdown, no frontmatter
`
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}

	record := parseSubagentFile(path, "user")
	if record.FrontmatterValid {
		t.Fatal("expected invalid frontmatter")
	}
	if !strings.Contains(record.FrontmatterError, "缺少 frontmatter") {
		t.Fatalf("expected missing frontmatter error, got: %s", record.FrontmatterError)
	}
}

func TestParseSubagentFile_BrokenYAML(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "broken.md")
	content := `---
name: [broken yaml
description: oops
---
`
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}

	record := parseSubagentFile(path, "user")
	if record.FrontmatterValid {
		t.Fatal("expected invalid frontmatter for broken YAML")
	}
	if record.FrontmatterError == "" {
		t.Fatal("expected frontmatter error message")
	}
}

func TestParseSubagentFile_PreservesUnknownFields(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "custom.md")
	content := `---
name: custom-agent
description: Agent with custom fields
tools: [Read]
color: blue
myCustomField: some-value
---
`
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}

	record := parseSubagentFile(path, "user")
	if !record.FrontmatterValid {
		t.Fatalf("expected valid frontmatter, got: %v", record.ValidationErrors)
	}
	// Unknown fields should be preserved
	if _, ok := record.UnknownFields["myCustomField"]; !ok {
		t.Fatal("expected myCustomField in unknown fields")
	}
}

func TestParseSubagentFile_ExposesFullBodyForEditing(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "long.md")
	longBody := strings.Repeat("long instructions line\n", 20)
	content := `---
name: long-agent
description: Agent with long editable body
tools: [Read]
color: blue
---
` + longBody
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}

	record := parseSubagentFile(path, "user")
	if record.Body != strings.TrimSpace(longBody) {
		t.Fatalf("Body should keep full editable content, got %d bytes want %d", len(record.Body), len(strings.TrimSpace(longBody)))
	}
	if !strings.HasSuffix(record.BodyPreview, "...") {
		t.Fatalf("BodyPreview should remain truncated for list display, got %q", record.BodyPreview)
	}
	if _, ok := record.KnownFields["tools"]; !ok {
		t.Fatal("expected tools frontmatter to be preserved in known fields")
	}
	if _, ok := record.KnownFields["color"]; !ok {
		t.Fatal("expected color frontmatter to be preserved in known fields")
	}
}

func TestParseSubagentFile_PluginDetection(t *testing.T) {
	dir := t.TempDir()
	pluginsDir := filepath.Join(dir, "plugins")
	if err := os.MkdirAll(pluginsDir, 0700); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(pluginsDir, "deploy.md")
	content := `---
name: deploy-helper
description: Plugin deploy helper
hooks:
  - type: command
    command: deploy.sh
permissionMode: accept-edits
---
`
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}

	record := parseSubagentFile(path, "user")
	if !record.IsPlugin {
		t.Fatal("expected plugin detection from path")
	}
	if len(record.IgnoredFields) == 0 {
		t.Fatal("expected ignored fields for plugin subagent")
	}
}

func TestBuildSubagentMarkdown(t *testing.T) {
	input := SaveClaudeCodeSubagentInput{
		Name:        "test-agent",
		Description: "A test agent",
		KnownFields: map[string]any{
			"tools": []interface{}{"Read", "Bash"},
			"model": "claude-haiku-4-5",
		},
		UnknownFields: map[string]any{
			"color": "green",
		},
		Body: "# Test Agent\n\nYou are a test.\n",
	}

	output := buildSubagentMarkdown(input)
	if !strings.Contains(output, "name: test-agent") {
		t.Fatal("expected name in markdown")
	}
	if !strings.Contains(output, "description: A test agent") {
		t.Fatal("expected description in markdown")
	}
	if !strings.Contains(output, "color: green") {
		t.Fatal("expected unknown field preserved")
	}
	if !strings.Contains(output, "# Test Agent") {
		t.Fatal("expected body in markdown")
	}
}

func TestSaveClaudeCodeSubagent_ValidatesRequired(t *testing.T) {
	app := &App{}
	_, err := app.SaveClaudeCodeSubagent(SaveClaudeCodeSubagentInput{
		Scope: "user",
		Name:  "",
		Body:  "# Test",
	})
	if err == nil {
		t.Fatal("expected error for empty name")
	}
	if !strings.Contains(err.Error(), "name") {
		t.Fatalf("unexpected error: %v", err)
	}

	_, err = app.SaveClaudeCodeSubagent(SaveClaudeCodeSubagentInput{
		Scope:       "user",
		Name:        "test",
		Description: "",
		Body:        "# Test",
	})
	if err == nil {
		t.Fatal("expected error for empty description")
	}
}

func TestSaveClaudeCodeSubagent_WritesFile(t *testing.T) {
	tmpHome := t.TempDir()
	t.Setenv("HOME", tmpHome)
	agentsDir := filepath.Join(tmpHome, ".claude", "agents")
	if err := os.MkdirAll(agentsDir, 0700); err != nil {
		t.Fatal(err)
	}

	app := &App{}
	result, err := app.SaveClaudeCodeSubagent(SaveClaudeCodeSubagentInput{
		Scope:       "user",
		Name:        "test-agent",
		Description: "A test agent for unit tests",
		Body:        "# Test Agent\n\nYou help with testing.",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Path == "" {
		t.Fatal("expected non-empty path")
	}
	if !strings.Contains(result.Preview, "name: test-agent") {
		t.Fatal("expected name in preview")
	}

	// Verify file exists
	if _, err := os.Stat(result.Path); os.IsNotExist(err) {
		t.Fatal("saved file does not exist")
	}
}

func TestSaveClaudeCodeSubagent_InvalidScope(t *testing.T) {
	app := &App{}
	_, err := app.SaveClaudeCodeSubagent(SaveClaudeCodeSubagentInput{
		Scope:       "invalid",
		Name:        "test",
		Description: "desc",
		Body:        "# Test",
	})
	if err == nil {
		t.Fatal("expected error for invalid scope")
	}
}

func TestDeleteClaudeCodeSubagent_RemovesFile(t *testing.T) {
	tmpHome := t.TempDir()
	t.Setenv("HOME", tmpHome)
	agentsDir := filepath.Join(tmpHome, ".claude", "agents")
	if err := os.MkdirAll(agentsDir, 0700); err != nil {
		t.Fatal(err)
	}

	path := filepath.Join(agentsDir, "to-delete.md")
	if err := os.WriteFile(path, []byte("---\nname: to-delete\ndescription: temp\n---\n"), 0600); err != nil {
		t.Fatal(err)
	}

	app := &App{}
	err := app.DeleteClaudeCodeSubagent(DeleteClaudeCodeSubagentInput{
		Scope: "user",
		Path:  path,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatal("file should have been deleted")
	}
}

func TestDeleteClaudeCodeSubagent_NonExistent(t *testing.T) {
	app := &App{}
	err := app.DeleteClaudeCodeSubagent(DeleteClaudeCodeSubagentInput{
		Scope: "user",
		Path:  "/nonexistent/path/agent.md",
	})
	if err == nil {
		t.Fatal("expected error for non-existent file")
	}
}

func TestGetClaudeCodeSubagentsSnapshot_UserScope(t *testing.T) {
	tmpHome := t.TempDir()
	t.Setenv("HOME", tmpHome)
	agentsDir := filepath.Join(tmpHome, ".claude", "agents")
	if err := os.MkdirAll(agentsDir, 0700); err != nil {
		t.Fatal(err)
	}

	path := filepath.Join(agentsDir, "test-agent.md")
	content := `---
name: test-agent
description: A test agent
tools: [Read, Write]
---
# Test Agent
`
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}

	app := &App{}
	snapshot, err := app.GetClaudeCodeSubagentsSnapshot()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(snapshot.Agents) == 0 {
		t.Fatal("expected at least one agent")
	}

	agent := snapshot.Agents[0]
	if agent.Name != "test-agent" {
		t.Fatalf("expected name 'test-agent', got '%s'", agent.Name)
	}
	if !agent.FrontmatterValid {
		t.Fatalf("expected valid frontmatter, got errors: %v", agent.ValidationErrors)
	}
}

func TestScanSubagentDirectory_Recursive(t *testing.T) {
	tmpHome := t.TempDir()
	t.Setenv("HOME", tmpHome)
	agentsDir := filepath.Join(tmpHome, ".claude", "agents")
	subDir := filepath.Join(agentsDir, "subgroup")
	if err := os.MkdirAll(subDir, 0700); err != nil {
		t.Fatal(err)
	}

	path := filepath.Join(subDir, "nested.md")
	content := `---
name: nested-agent
description: A nested subagent
---
`
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}

	app := &App{}
	snapshot, err := app.GetClaudeCodeSubagentsSnapshot()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	found := false
	for _, a := range snapshot.Agents {
		if a.Name == "nested-agent" {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("expected to find nested subagent via recursive scan")
	}
}
