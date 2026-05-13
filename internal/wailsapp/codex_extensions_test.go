package wailsapp

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestGetCodexSkillsSnapshotScansRootsAndStripsFrontmatter(t *testing.T) {
	home := t.TempDir()
	codexHome := filepath.Join(home, ".codex")
	t.Setenv("HOME", home)
	t.Setenv("CODEX_HOME", codexHome)

	skillDir := filepath.Join(home, ".agents", "skills", "demo")
	if err := os.MkdirAll(skillDir, 0700); err != nil {
		t.Fatalf("MkdirAll skillDir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte(strings.Join([]string{
		"---",
		"name: demo",
		"description: Demo skill.",
		"---",
		"",
		"# Demo",
		"",
		"Body",
	}, "\n")), 0600); err != nil {
		t.Fatalf("WriteFile SKILL.md: %v", err)
	}
	referencesDir := filepath.Join(skillDir, "references")
	if err := os.MkdirAll(referencesDir, 0700); err != nil {
		t.Fatalf("MkdirAll referencesDir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(referencesDir, "notes.md"), []byte("# Notes\n\nPreview me."), 0600); err != nil {
		t.Fatalf("WriteFile references/notes.md: %v", err)
	}

	app := &App{}
	snapshot, err := app.GetCodexSkillsSnapshot()
	if err != nil {
		t.Fatalf("GetCodexSkillsSnapshot returned error: %v", err)
	}
	if len(snapshot.Skills) != 1 {
		t.Fatalf("skills len = %d, want 1: %#v", len(snapshot.Skills), snapshot.Skills)
	}
	skill := snapshot.Skills[0]
	if skill.Name != "demo" || skill.Description != "Demo skill." {
		t.Fatalf("frontmatter not parsed: %#v", skill)
	}
	if strings.Contains(skill.PreviewMarkdown, "name: demo") || !strings.Contains(skill.PreviewMarkdown, "# Demo") {
		t.Fatalf("PreviewMarkdown should strip frontmatter and keep body: %q", skill.PreviewMarkdown)
	}
	if !skill.Enabled {
		t.Fatalf("skill should default to enabled")
	}
	var notesFile *CodexSkillFile
	for index := range skill.Files {
		if skill.Files[index].Path == filepath.Join("references", "notes.md") {
			notesFile = &skill.Files[index]
			break
		}
	}
	if notesFile == nil || !notesFile.Previewable || notesFile.Content != "" {
		t.Fatalf("expected snapshot to include previewability but not file content, got %#v", notesFile)
	}
}

func TestGetCodexSkillsSnapshotOmitsProjectSkillRoots(t *testing.T) {
	base := t.TempDir()
	home := filepath.Join(base, "home")
	project := filepath.Join(base, "project")
	codexHome := filepath.Join(home, ".codex")
	t.Setenv("HOME", home)
	t.Setenv("CODEX_HOME", codexHome)
	if err := os.MkdirAll(project, 0700); err != nil {
		t.Fatalf("MkdirAll project: %v", err)
	}
	previousCwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("Getwd: %v", err)
	}
	if err := os.Chdir(project); err != nil {
		t.Fatalf("Chdir project: %v", err)
	}
	t.Cleanup(func() {
		_ = os.Chdir(previousCwd)
	})

	projectSkillDir := filepath.Join(project, ".agents", "skills", "project-demo")
	if err := os.MkdirAll(projectSkillDir, 0700); err != nil {
		t.Fatalf("MkdirAll projectSkillDir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(projectSkillDir, "SKILL.md"), []byte("---\nname: project-demo\ndescription: Project skill.\n---\n\n# Project\n"), 0600); err != nil {
		t.Fatalf("WriteFile project SKILL.md: %v", err)
	}

	app := &App{}
	snapshot, err := app.GetCodexSkillsSnapshot()
	if err != nil {
		t.Fatalf("GetCodexSkillsSnapshot returned error: %v", err)
	}
	for _, root := range snapshot.Roots {
		if root.SourceKind == "project" {
			t.Fatalf("project skill root should not be listed: %#v", root)
		}
	}
	for _, skill := range snapshot.Skills {
		if skill.Name == "project-demo" || skill.SourceKind == "project" {
			t.Fatalf("project skill should not be listed: %#v", skill)
		}
	}
}

func TestGetCodexSkillFilePreviewReadsSingleFileOnDemand(t *testing.T) {
	home := t.TempDir()
	codexHome := filepath.Join(home, ".codex")
	t.Setenv("HOME", home)
	t.Setenv("CODEX_HOME", codexHome)

	skillDir := filepath.Join(home, ".agents", "skills", "demo")
	referencesDir := filepath.Join(skillDir, "references")
	if err := os.MkdirAll(referencesDir, 0700); err != nil {
		t.Fatalf("MkdirAll referencesDir: %v", err)
	}
	skillPath := filepath.Join(skillDir, "SKILL.md")
	if err := os.WriteFile(skillPath, []byte("# Demo"), 0600); err != nil {
		t.Fatalf("WriteFile SKILL.md: %v", err)
	}
	if err := os.WriteFile(filepath.Join(referencesDir, "notes.md"), []byte("# Notes\n\nPreview me."), 0600); err != nil {
		t.Fatalf("WriteFile notes.md: %v", err)
	}

	app := &App{}
	result, err := app.GetCodexSkillFilePreview(GetCodexSkillFilePreviewInput{
		SkillPath: skillPath,
		FilePath:  filepath.Join("references", "notes.md"),
	})
	if err != nil {
		t.Fatalf("GetCodexSkillFilePreview returned error: %v", err)
	}
	if result.Path != filepath.Join("references", "notes.md") || !result.Previewable || !strings.Contains(result.Content, "Preview me.") {
		t.Fatalf("preview result mismatch: %#v", result)
	}
}

func TestGetCodexSkillFilePreviewRejectsPathTraversal(t *testing.T) {
	home := t.TempDir()
	codexHome := filepath.Join(home, ".codex")
	t.Setenv("HOME", home)
	t.Setenv("CODEX_HOME", codexHome)

	skillDir := filepath.Join(home, ".agents", "skills", "demo")
	if err := os.MkdirAll(skillDir, 0700); err != nil {
		t.Fatalf("MkdirAll skillDir: %v", err)
	}
	skillPath := filepath.Join(skillDir, "SKILL.md")
	if err := os.WriteFile(skillPath, []byte("# Demo"), 0600); err != nil {
		t.Fatalf("WriteFile SKILL.md: %v", err)
	}
	if err := os.WriteFile(filepath.Join(home, ".agents", "skills", "outside.md"), []byte("secret"), 0600); err != nil {
		t.Fatalf("WriteFile outside.md: %v", err)
	}

	app := &App{}
	if _, err := app.GetCodexSkillFilePreview(GetCodexSkillFilePreviewInput{
		SkillPath: skillPath,
		FilePath:  filepath.Join("..", "outside.md"),
	}); err == nil {
		t.Fatalf("GetCodexSkillFilePreview should reject path traversal")
	}
}

func TestSaveCodexSkillEnabledWritesAndRemovesDisabledOverride(t *testing.T) {
	home := t.TempDir()
	codexHome := filepath.Join(home, ".codex")
	t.Setenv("HOME", home)
	t.Setenv("CODEX_HOME", codexHome)
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll codexHome: %v", err)
	}
	skillPath := filepath.Join(home, ".agents", "skills", "demo", "SKILL.md")

	app := &App{}
	if _, err := app.SaveCodexSkillEnabled(SaveCodexSkillEnabledInput{
		Path:    skillPath,
		Enabled: false,
	}); err != nil {
		t.Fatalf("SaveCodexSkillEnabled disable returned error: %v", err)
	}

	body, err := os.ReadFile(filepath.Join(codexHome, "config.toml"))
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	content := string(body)
	if !strings.Contains(content, "[[skills.config]]") ||
		!strings.Contains(content, `path = "`+escapeTomlString(skillPath)+`"`) ||
		!strings.Contains(content, "enabled = false") {
		t.Fatalf("disabled override not written: %s", content)
	}

	if _, err := app.SaveCodexSkillEnabled(SaveCodexSkillEnabledInput{
		Path:    skillPath,
		Enabled: true,
	}); err != nil {
		t.Fatalf("SaveCodexSkillEnabled enable returned error: %v", err)
	}
	body, err = os.ReadFile(filepath.Join(codexHome, "config.toml"))
	if err != nil {
		t.Fatalf("ReadFile config.toml after enable: %v", err)
	}
	if strings.Contains(string(body), "[[skills.config]]") || strings.Contains(string(body), "enabled = true") {
		t.Fatalf("enabling should remove disabled override without writing enabled=true: %s", string(body))
	}
}

func TestSaveCodexSkillEnabledRemovesNameOverrideWhenEnabling(t *testing.T) {
	home := t.TempDir()
	codexHome := filepath.Join(home, ".codex")
	t.Setenv("HOME", home)
	t.Setenv("CODEX_HOME", codexHome)
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll codexHome: %v", err)
	}
	config := strings.Join([]string{
		`[[skills.config]]`,
		`name = "demo-skill"`,
		`enabled = false`,
	}, "\n") + "\n"
	if err := os.WriteFile(filepath.Join(codexHome, "config.toml"), []byte(config), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	if _, err := app.SaveCodexSkillEnabled(SaveCodexSkillEnabledInput{
		Path:    filepath.Join(home, ".agents", "skills", "demo", "SKILL.md"),
		Name:    "demo-skill",
		Enabled: true,
	}); err != nil {
		t.Fatalf("SaveCodexSkillEnabled enable returned error: %v", err)
	}
	body, err := os.ReadFile(filepath.Join(codexHome, "config.toml"))
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	if strings.Contains(string(body), "[[skills.config]]") || strings.Contains(string(body), "demo-skill") {
		t.Fatalf("enabling should remove matching name override: %s", string(body))
	}
}

func TestGetCodexSkillsSnapshotAppliesNameSkillConfigSelector(t *testing.T) {
	home := t.TempDir()
	codexHome := filepath.Join(home, ".codex")
	t.Setenv("HOME", home)
	t.Setenv("CODEX_HOME", codexHome)
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll codexHome: %v", err)
	}
	skillDir := filepath.Join(home, ".agents", "skills", "demo")
	if err := os.MkdirAll(skillDir, 0700); err != nil {
		t.Fatalf("MkdirAll skillDir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte(strings.Join([]string{
		"---",
		"name: demo-skill",
		"description: Demo skill.",
		"---",
		"",
		"# Demo",
	}, "\n")), 0600); err != nil {
		t.Fatalf("WriteFile SKILL.md: %v", err)
	}
	config := strings.Join([]string{
		`[[skills.config]]`,
		`name = "demo-skill"`,
		`enabled = false`,
	}, "\n") + "\n"
	if err := os.WriteFile(filepath.Join(codexHome, "config.toml"), []byte(config), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	snapshot, err := app.GetCodexSkillsSnapshot()
	if err != nil {
		t.Fatalf("GetCodexSkillsSnapshot returned error: %v", err)
	}
	if len(snapshot.Skills) != 1 {
		t.Fatalf("skills len = %d, want 1: %#v", len(snapshot.Skills), snapshot.Skills)
	}
	if snapshot.Skills[0].Enabled {
		t.Fatalf("name selector should disable matching skill: %#v", snapshot.Skills[0])
	}
}

func TestCodexSkillConfigRulesApplyInOrderAndNormalizePath(t *testing.T) {
	home := t.TempDir()
	skillDir := filepath.Join(home, ".agents", "skills", "demo")
	if err := os.MkdirAll(skillDir, 0700); err != nil {
		t.Fatalf("MkdirAll skillDir: %v", err)
	}
	skillPath := filepath.Join(skillDir, "SKILL.md")
	if err := os.WriteFile(skillPath, []byte("# Demo"), 0600); err != nil {
		t.Fatalf("WriteFile SKILL.md: %v", err)
	}
	nonCanonicalPath := filepath.Join(skillDir, "..", "demo", "SKILL.md")
	rules := []codexSkillConfigRule{
		{path: normalizeCodexSkillConfigPath(nonCanonicalPath), enabled: false},
		{name: "demo-skill", enabled: true},
	}

	if !codexSkillEnabled(skillPath, "demo-skill", rules) {
		t.Fatalf("later name selector with enabled=true should re-enable the skill")
	}

	rules = []codexSkillConfigRule{
		{name: "demo-skill", enabled: false},
		{path: normalizeCodexSkillConfigPath(nonCanonicalPath), enabled: true},
	}
	if !codexSkillEnabled(skillPath, "demo-skill", rules) {
		t.Fatalf("later path selector with enabled=true should re-enable the skill")
	}

	rules = []codexSkillConfigRule{
		{path: normalizeCodexSkillConfigPath(nonCanonicalPath), enabled: false},
	}
	if codexSkillEnabled(skillPath, "demo-skill", rules) {
		t.Fatalf("canonicalized path selector should disable the skill")
	}
}

func TestRemoveCodexSkillDeletesWritableSkillAndConfigOverride(t *testing.T) {
	home := t.TempDir()
	codexHome := filepath.Join(home, ".codex")
	t.Setenv("HOME", home)
	t.Setenv("CODEX_HOME", codexHome)
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll codexHome: %v", err)
	}
	skillDir := filepath.Join(home, ".agents", "skills", "demo")
	if err := os.MkdirAll(skillDir, 0700); err != nil {
		t.Fatalf("MkdirAll skillDir: %v", err)
	}
	skillPath := filepath.Join(skillDir, "SKILL.md")
	if err := os.WriteFile(skillPath, []byte("# Demo"), 0600); err != nil {
		t.Fatalf("WriteFile SKILL.md: %v", err)
	}

	app := &App{}
	if _, err := app.SaveCodexSkillEnabled(SaveCodexSkillEnabledInput{
		Path:    skillPath,
		Enabled: false,
	}); err != nil {
		t.Fatalf("SaveCodexSkillEnabled disable returned error: %v", err)
	}

	wantRemovedPath := filepath.Dir(normalizeCodexSkillConfigPath(skillPath))
	result, err := app.RemoveCodexSkill(RemoveCodexSkillInput{Path: skillPath})
	if err != nil {
		t.Fatalf("RemoveCodexSkill returned error: %v", err)
	}
	if result.RemovedPath != wantRemovedPath {
		t.Fatalf("RemovedPath = %q, want %q", result.RemovedPath, wantRemovedPath)
	}
	if _, err := os.Stat(skillDir); !os.IsNotExist(err) {
		t.Fatalf("skill directory should be removed, stat err = %v", err)
	}
	body, err := os.ReadFile(filepath.Join(codexHome, "config.toml"))
	if err != nil {
		t.Fatalf("ReadFile config.toml after remove: %v", err)
	}
	if strings.Contains(string(body), "[[skills.config]]") || strings.Contains(string(body), skillPath) {
		t.Fatalf("remove should clear disabled override: %s", string(body))
	}
}

func TestRemoveCodexSkillRejectsSystemRoot(t *testing.T) {
	home := t.TempDir()
	codexHome := filepath.Join(home, ".codex")
	t.Setenv("HOME", home)
	t.Setenv("CODEX_HOME", codexHome)
	skillDir := filepath.Join(codexHome, "skills", ".system", "demo")
	if err := os.MkdirAll(skillDir, 0700); err != nil {
		t.Fatalf("MkdirAll system skillDir: %v", err)
	}
	skillPath := filepath.Join(skillDir, "SKILL.md")
	if err := os.WriteFile(skillPath, []byte("# Demo"), 0600); err != nil {
		t.Fatalf("WriteFile SKILL.md: %v", err)
	}

	app := &App{}
	if _, err := app.RemoveCodexSkill(RemoveCodexSkillInput{Path: skillPath}); err == nil {
		t.Fatalf("RemoveCodexSkill should reject system roots")
	}
	if _, err := os.Stat(skillDir); err != nil {
		t.Fatalf("system skill directory should remain, stat err = %v", err)
	}
}

func TestOpenCodexSkillInFinderOpensSkillPath(t *testing.T) {
	home := t.TempDir()
	codexHome := filepath.Join(home, ".codex")
	t.Setenv("HOME", home)
	t.Setenv("CODEX_HOME", codexHome)
	skillDir := filepath.Join(home, ".agents", "skills", "demo")
	if err := os.MkdirAll(skillDir, 0700); err != nil {
		t.Fatalf("MkdirAll skillDir: %v", err)
	}
	skillPath := filepath.Join(skillDir, "SKILL.md")
	if err := os.WriteFile(skillPath, []byte("# Demo"), 0600); err != nil {
		t.Fatalf("WriteFile SKILL.md: %v", err)
	}

	var openedPath string
	previousOpen := openCodexSkillInFileManager
	openCodexSkillInFileManager = func(path string) error {
		openedPath = path
		return nil
	}
	t.Cleanup(func() {
		openCodexSkillInFileManager = previousOpen
	})

	app := &App{}
	result, err := app.OpenCodexSkillInFinder(OpenCodexSkillInFinderInput{Path: skillPath})
	if err != nil {
		t.Fatalf("OpenCodexSkillInFinder returned error: %v", err)
	}
	if result.Path != skillPath || openedPath != skillPath {
		t.Fatalf("opened path mismatch: result=%q opened=%q want=%q", result.Path, openedPath, skillPath)
	}
}

func TestOpenCodexSkillInFinderRejectsOutsideRoots(t *testing.T) {
	home := t.TempDir()
	codexHome := filepath.Join(home, ".codex")
	t.Setenv("HOME", home)
	t.Setenv("CODEX_HOME", codexHome)
	outsideDir := filepath.Join(home, "outside")
	if err := os.MkdirAll(outsideDir, 0700); err != nil {
		t.Fatalf("MkdirAll outsideDir: %v", err)
	}
	outsidePath := filepath.Join(outsideDir, "SKILL.md")
	if err := os.WriteFile(outsidePath, []byte("# Demo"), 0600); err != nil {
		t.Fatalf("WriteFile outside SKILL.md: %v", err)
	}

	app := &App{}
	if _, err := app.OpenCodexSkillInFinder(OpenCodexSkillInFinderInput{Path: outsidePath}); err == nil {
		t.Fatalf("OpenCodexSkillInFinder should reject paths outside skill roots")
	}
}

func TestParseCodexGitSkillSourceSupportsGitHubAndGitLab(t *testing.T) {
	github, err := parseCodexGitSkillSource("tk://github.com/ln/xxx?ref=main&path=skills/foo")
	if err != nil {
		t.Fatalf("parse github source: %v", err)
	}
	if github.Provider != "github" || github.Repo != "ln/xxx" || github.Ref != "main" || github.Path != "skills/foo" {
		t.Fatalf("github source parsed incorrectly: %#v", github)
	}

	gitlab, err := parseCodexGitSkillSource("tk://gitlab.com/f2e/axure-helper/axure-skill-group?ref=main&path=skills/foo")
	if err != nil {
		t.Fatalf("parse gitlab source: %v", err)
	}
	if gitlab.Provider != "gitlab" || gitlab.Repo != "f2e/axure-helper/axure-skill-group" {
		t.Fatalf("gitlab nested repo parsed incorrectly: %#v", gitlab)
	}

	if _, err := parseCodexGitSkillSource("https://github.com/ln/xxx"); err == nil {
		t.Fatalf("plain https source should be rejected")
	}
}

func TestGetCodexMcpServersParsesSectionServers(t *testing.T) {
	home := t.TempDir()
	codexHome := filepath.Join(home, ".codex")
	t.Setenv("HOME", home)
	t.Setenv("CODEX_HOME", codexHome)
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll codexHome: %v", err)
	}
	config := strings.Join([]string{
		`model = "gpt-5.4"`,
		``,
		`[mcp_servers.filesystem]`,
		`command = "npx"`,
		`args = ["-y", "@modelcontextprotocol/server-filesystem", "~/Projects"]`,
		`env = { NODE_ENV = "production" }`,
		`env_vars = ["GITHUB_TOKEN", { name = "REMOTE_TOKEN", source = "remote" }]`,
		`cwd = "/tmp/workspace"`,
		`required = true`,
		`supports_parallel_tool_calls = true`,
		`startup_timeout_sec = 10`,
		`tool_timeout_sec = 30`,
		`default_tools_approval_mode = "prompt"`,
		`enabled_tools = ["read_file"]`,
		`disabled_tools = ["write_file"]`,
		``,
		`[mcp_servers.linear]`,
		`url = "https://mcp.linear.app/mcp"`,
		`bearer_token_env_var = "LINEAR_API_KEY"`,
		`http_headers = { X-Client = "GetTokens" }`,
		`env_http_headers = { Authorization = "LINEAR_AUTH_HEADER" }`,
		`scopes = ["read", "write"]`,
		`oauth_resource = "https://api.linear.app"`,
		`enabled = false`,
	}, "\n") + "\n"
	if err := os.WriteFile(filepath.Join(codexHome, "config.toml"), []byte(config), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	snapshot, err := app.GetCodexMcpServers()
	if err != nil {
		t.Fatalf("GetCodexMcpServers returned error: %v", err)
	}
	if len(snapshot.Servers) != 2 {
		t.Fatalf("servers len = %d, want 2: %#v", len(snapshot.Servers), snapshot.Servers)
	}
	if snapshot.Servers[0].ID != "filesystem" || snapshot.Servers[0].Transport != "stdio" || snapshot.Servers[0].Args[1] != "@modelcontextprotocol/server-filesystem" {
		t.Fatalf("filesystem server parsed incorrectly: %#v", snapshot.Servers[0])
	}
	filesystem := snapshot.Servers[0]
	if filesystem.EnvVarsRaw != `["GITHUB_TOKEN", { name = "REMOTE_TOKEN", source = "remote" }]` ||
		filesystem.Cwd != "/tmp/workspace" ||
		!filesystem.Required ||
		!filesystem.SupportsParallelToolCalls ||
		filesystem.StartupTimeoutSec != "10" ||
		filesystem.ToolTimeoutSec != "30" ||
		filesystem.DefaultToolsApprovalMode != "prompt" ||
		len(filesystem.EnabledTools) != 1 ||
		filesystem.EnabledTools[0] != "read_file" ||
		len(filesystem.DisabledTools) != 1 ||
		filesystem.DisabledTools[0] != "write_file" {
		t.Fatalf("filesystem extended fields parsed incorrectly: %#v", filesystem)
	}
	if snapshot.Servers[1].ID != "linear" || snapshot.Servers[1].Transport != "streamable_http" || snapshot.Servers[1].Enabled {
		t.Fatalf("linear server parsed incorrectly: %#v", snapshot.Servers[1])
	}
	linear := snapshot.Servers[1]
	if len(linear.HTTPHeaders) != 1 || linear.HTTPHeaders[0].Key != "X-Client" || linear.HTTPHeaders[0].Value != "GetTokens" ||
		len(linear.EnvHTTPHeaders) != 1 || linear.EnvHTTPHeaders[0].Key != "Authorization" ||
		len(linear.Scopes) != 2 ||
		linear.OAuthResource != "https://api.linear.app" {
		t.Fatalf("linear extended fields parsed incorrectly: %#v", linear)
	}
}

func TestGetCodexMcpServersTreatsToolApprovalSectionsAsNestedConfig(t *testing.T) {
	home := t.TempDir()
	codexHome := filepath.Join(home, ".codex")
	t.Setenv("HOME", home)
	t.Setenv("CODEX_HOME", codexHome)
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll codexHome: %v", err)
	}
	config := strings.Join([]string{
		`[mcp_servers.chrome-devtools]`,
		`command = "npx"`,
		`args = ["-y", "chrome-devtools-mcp@latest"]`,
		``,
		`[mcp_servers.chrome-devtools.tools.emulate]`,
		`approval_mode = "approve"`,
		``,
		`[mcp_servers.chrome-devtools.tools.evaluate_script]`,
		`approval_mode = "approve"`,
		``,
		`[mcp_servers.chrome-devtools.tools.click]`,
		`approval_mode = "approve"`,
	}, "\n") + "\n"
	if err := os.WriteFile(filepath.Join(codexHome, "config.toml"), []byte(config), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	snapshot, err := app.GetCodexMcpServers()
	if err != nil {
		t.Fatalf("GetCodexMcpServers returned error: %v", err)
	}
	if len(snapshot.Servers) != 1 {
		t.Fatalf("servers len = %d, want 1: %#v", len(snapshot.Servers), snapshot.Servers)
	}
	server := snapshot.Servers[0]
	if server.ID != "chrome-devtools" || server.Transport != "stdio" || server.Command != "npx" || len(server.Args) != 2 || server.Args[1] != "chrome-devtools-mcp@latest" {
		t.Fatalf("chrome-devtools server parsed incorrectly: %#v", server)
	}
	if len(server.Tools) != 3 ||
		server.Tools[0].Name != "click" ||
		server.Tools[0].ApprovalMode != "approve" ||
		server.Tools[1].Name != "emulate" ||
		server.Tools[2].Name != "evaluate_script" {
		t.Fatalf("tool sections should be nested under the parent server: %#v", server.Tools)
	}
}

func TestSaveCodexMcpServerPatchesTargetSectionOnly(t *testing.T) {
	home := t.TempDir()
	codexHome := filepath.Join(home, ".codex")
	t.Setenv("HOME", home)
	t.Setenv("CODEX_HOME", codexHome)
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		t.Fatalf("MkdirAll codexHome: %v", err)
	}
	configPath := filepath.Join(codexHome, "config.toml")
	config := strings.Join([]string{
		`model = "gpt-5.4"`,
		``,
		`[mcp_servers.filesystem]`,
		`command = "npx"`,
		`unknown = "keep"`,
		``,
		`[mcp_servers.linear]`,
		`url = "https://mcp.linear.app/mcp"`,
		`bearer_token_env_var = "LINEAR_API_KEY"`,
		``,
		`[mcp_servers.linear.tools.search]`,
		`approval_mode = "approve"`,
	}, "\n") + "\n"
	if err := os.WriteFile(configPath, []byte(config), 0600); err != nil {
		t.Fatalf("WriteFile config.toml: %v", err)
	}

	app := &App{}
	if _, err := app.SaveCodexMcpServer(SaveCodexMcpServerInput{
		Server: CodexMcpServer{
			ID:                "linear",
			Enabled:           true,
			Transport:         "streamable_http",
			URL:               "https://mcp.linear.app/sse",
			BearerTokenEnvVar: "LINEAR_TOKEN",
			HTTPHeaders:       []CodexMcpEnvRow{{Key: "X-Client", Value: "GetTokens"}},
			EnvHTTPHeaders:    []CodexMcpEnvRow{{Key: "Authorization", Value: "LINEAR_AUTH_HEADER"}},
			Scopes:            []string{"read", "write"},
			OAuthResource:     "https://api.linear.app",
			ToolTimeoutSec:    "45",
		},
	}); err != nil {
		t.Fatalf("SaveCodexMcpServer returned error: %v", err)
	}

	body, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("ReadFile config.toml: %v", err)
	}
	content := string(body)
	if !strings.Contains(content, `model = "gpt-5.4"`) ||
		!strings.Contains(content, `unknown = "keep"`) ||
		!strings.Contains(content, `url = "https://mcp.linear.app/sse"`) ||
		!strings.Contains(content, `bearer_token_env_var = "LINEAR_TOKEN"`) ||
		!strings.Contains(content, `http_headers = { X-Client = "GetTokens" }`) ||
		!strings.Contains(content, `env_http_headers = { Authorization = "LINEAR_AUTH_HEADER" }`) ||
		!strings.Contains(content, `scopes = ["read", "write"]`) ||
		!strings.Contains(content, `oauth_resource = "https://api.linear.app"`) ||
		!strings.Contains(content, `tool_timeout_sec = 45`) ||
		!strings.Contains(content, `[mcp_servers.linear.tools.search]`) ||
		!strings.Contains(content, `approval_mode = "approve"`) {
		t.Fatalf("target patch did not preserve expected content: %s", content)
	}
	if strings.Contains(content, `bearer_token =`) {
		t.Fatalf("bearer_token must never be written: %s", content)
	}
}

func TestSaveCodexMcpServerRejectsTransportConflict(t *testing.T) {
	app := &App{}
	_, err := app.SaveCodexMcpServer(SaveCodexMcpServerInput{
		Server: CodexMcpServer{
			ID:        "bad",
			Transport: "stdio",
			Command:   "npx",
			URL:       "https://mcp.example.com/mcp",
		},
	})
	if err == nil || !strings.Contains(err.Error(), "transport") {
		t.Fatalf("expected transport conflict error, got %v", err)
	}
}

func TestOpenCodexConfigTomlCreatesMissingConfigBeforeOpening(t *testing.T) {
	home := t.TempDir()
	codexHome := filepath.Join(home, ".codex")
	t.Setenv("HOME", home)
	t.Setenv("CODEX_HOME", codexHome)

	var openedPath string
	previousOpen := openCodexConfigFile
	openCodexConfigFile = func(path string) error {
		openedPath = path
		return nil
	}
	t.Cleanup(func() {
		openCodexConfigFile = previousOpen
	})

	app := &App{}
	result, err := app.OpenCodexConfigToml()
	if err != nil {
		t.Fatalf("OpenCodexConfigToml returned error: %v", err)
	}
	wantPath := filepath.Join(codexHome, "config.toml")
	if result.ConfigPath != wantPath || openedPath != wantPath {
		t.Fatalf("opened path mismatch: result=%q opened=%q want=%q", result.ConfigPath, openedPath, wantPath)
	}
	if _, err := os.Stat(wantPath); err != nil {
		t.Fatalf("config.toml should be created before opening: %v", err)
	}
}

func TestCodexConfigTomlDocumentReadsAndSavesRawContent(t *testing.T) {
	home := t.TempDir()
	codexHome := filepath.Join(home, ".codex")
	t.Setenv("HOME", home)
	t.Setenv("CODEX_HOME", codexHome)

	app := &App{}
	initial, err := app.GetCodexConfigToml()
	if err != nil {
		t.Fatalf("GetCodexConfigToml returned error: %v", err)
	}
	if initial.Exists || initial.Content != "" {
		t.Fatalf("missing config should return empty non-existing document: %#v", initial)
	}

	content := strings.Join([]string{
		`model = "gpt-5.4"`,
		``,
		`[mcp_servers.linear]`,
		`url = "https://mcp.linear.app/mcp"`,
	}, "\n") + "\n"
	saved, err := app.SaveCodexConfigToml(SaveCodexConfigTomlInput{Content: content})
	if err != nil {
		t.Fatalf("SaveCodexConfigToml returned error: %v", err)
	}
	if saved.Content != content {
		t.Fatalf("saved content mismatch: %q", saved.Content)
	}

	reloaded, err := app.GetCodexConfigToml()
	if err != nil {
		t.Fatalf("GetCodexConfigToml after save returned error: %v", err)
	}
	if !reloaded.Exists || reloaded.Content != content {
		t.Fatalf("saved config not reloaded exactly: %#v", reloaded)
	}
}
