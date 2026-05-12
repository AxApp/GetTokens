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
		``,
		`[mcp_servers.linear]`,
		`url = "https://mcp.linear.app/mcp"`,
		`bearer_token_env_var = "LINEAR_API_KEY"`,
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
	if snapshot.Servers[1].ID != "linear" || snapshot.Servers[1].Transport != "streamable_http" || snapshot.Servers[1].Enabled {
		t.Fatalf("linear server parsed incorrectly: %#v", snapshot.Servers[1])
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
		!strings.Contains(content, `bearer_token_env_var = "LINEAR_TOKEN"`) {
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
