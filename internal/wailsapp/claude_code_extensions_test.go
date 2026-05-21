package wailsapp

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestGetClaudeCodeExtensionsSnapshotScansSkillsCommandsAndMcpScopes(t *testing.T) {
	base := t.TempDir()
	home := filepath.Join(base, "home")
	project := filepath.Join(base, "project")
	claudeConfigDir := filepath.Join(home, ".claude")
	t.Setenv("HOME", home)
	t.Setenv("CLAUDE_CONFIG_DIR", claudeConfigDir)
	mustMkdirAll(t, project)

	previousCwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("Getwd: %v", err)
	}
	if err := os.Chdir(project); err != nil {
		t.Fatalf("Chdir project: %v", err)
	}
	project, err = os.Getwd()
	if err != nil {
		t.Fatalf("Getwd project: %v", err)
	}
	t.Cleanup(func() {
		_ = os.Chdir(previousCwd)
	})

	writeTextFile(t, filepath.Join(claudeConfigDir, "skills", "reviewer", "SKILL.md"), strings.Join([]string{
		"---",
		"name: reviewer",
		"description: Reviews changes.",
		"user-invocable: true",
		"---",
		"",
		"# Reviewer",
	}, "\n"))
	writeTextFile(t, filepath.Join(project, ".claude", "skills", "release-check", "SKILL.md"), strings.Join([]string{
		"---",
		"name: release-check",
		"description: Release validation.",
		"disable-model-invocation: true",
		"---",
		"",
		"# Release",
	}, "\n"))
	writeTextFile(t, filepath.Join(project, ".claude", "commands", "deploy.md"), "# Deploy\n\nDeploy preview command.")

	writeTextFile(t, filepath.Join(home, ".claude.json"), `{
  "hasCompletedOnboarding": true,
  "mcpServers": {
    "shared": {
      "type": "stdio",
      "command": "user-shared"
    },
    "user-http": {
      "type": "streamable-http",
      "url": "https://user.example.com/mcp",
      "headers": {
        "Authorization": "Bearer secret"
      }
    }
  },
  "projects": {
    "`+escapeJSONString(project)+`": {
      "mcpServers": {
        "shared": {
          "type": "stdio",
          "command": "local-shared"
        },
        "local-only": {
          "type": "sse",
          "url": "https://local.example.com/sse"
        }
      }
    }
  }
}`)
	writeTextFile(t, filepath.Join(project, ".mcp.json"), `{
  "mcpServers": {
    "shared": {
      "type": "stdio",
      "command": "project-shared"
    },
    "project-only": {
      "command": "node",
      "args": ["server.js"],
      "env": {
        "API_KEY": "secret"
      }
    }
  }
}`)

	app := &App{}
	snapshot, err := app.GetClaudeCodeExtensionsSnapshot()
	if err != nil {
		t.Fatalf("GetClaudeCodeExtensionsSnapshot returned error: %v", err)
	}

	if snapshot.ClaudeConfigDirPath != claudeConfigDir || snapshot.ProjectPath != project {
		t.Fatalf("snapshot paths mismatch: %#v", snapshot)
	}
	assertClaudeSkill(t, snapshot.Skills, "reviewer", "user", "manual", "enabled", "valid")
	assertClaudeSkill(t, snapshot.Skills, "release-check", "project", "auto", "disabled", "valid")
	assertClaudeSkill(t, snapshot.Skills, "/deploy", "legacy-command", "legacy", "enabled", "missing")

	localShared := assertClaudeMcp(t, snapshot.McpServers, "shared", "local", true, "stdio", "local-shared")
	if localShared.ShadowedBy != "" {
		t.Fatalf("active local server should not be shadowed: %#v", localShared)
	}
	assertClaudeMcp(t, snapshot.McpServers, "shared", "project", false, "stdio", "project-shared")
	assertClaudeMcp(t, snapshot.McpServers, "shared", "user", false, "stdio", "user-shared")
	assertClaudeMcp(t, snapshot.McpServers, "local-only", "local", true, "sse", "https://local.example.com/sse")
	assertClaudeMcp(t, snapshot.McpServers, "project-only", "project", true, "stdio", "node")
	userHTTP := assertClaudeMcp(t, snapshot.McpServers, "user-http", "user", true, "http", "https://user.example.com/mcp")
	if userHTTP.SecretState != "redacted" {
		t.Fatalf("expected user-http secret to be redacted: %#v", userHTTP)
	}
}

func TestGetClaudeCodeExtensionsSnapshotHandlesMissingAssets(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("CLAUDE_CONFIG_DIR", filepath.Join(home, ".claude"))

	app := &App{}
	snapshot, err := app.GetClaudeCodeExtensionsSnapshot()
	if err != nil {
		t.Fatalf("GetClaudeCodeExtensionsSnapshot returned error: %v", err)
	}
	if len(snapshot.Skills) != 0 || len(snapshot.McpServers) != 0 {
		t.Fatalf("expected empty snapshot, got %#v", snapshot)
	}
}

func TestSaveClaudeCodeMcpServerPatchesProjectServerPreservingUnknownFields(t *testing.T) {
	base := t.TempDir()
	home := filepath.Join(base, "home")
	project := filepath.Join(base, "project")
	t.Setenv("HOME", home)
	mustMkdirAll(t, project)

	previousCwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("Getwd: %v", err)
	}
	if err := os.Chdir(project); err != nil {
		t.Fatalf("Chdir project: %v", err)
	}
	project, err = os.Getwd()
	if err != nil {
		t.Fatalf("Getwd project: %v", err)
	}
	t.Cleanup(func() {
		_ = os.Chdir(previousCwd)
	})

	configPath := filepath.Join(project, ".mcp.json")
	writeTextFile(t, configPath, `{
  "projectUnknown": true,
  "mcpServers": {
    "target": {
      "type": "stdio",
      "command": "old-command",
      "args": ["--port", "3000"],
      "env": {
        "TOKEN": "${TOKEN}"
      },
      "unknownServerField": "keep"
    },
    "other": {
      "type": "sse",
      "url": "https://other.example.com/sse"
    }
  }
}`)

	app := &App{}
	result, err := app.SaveClaudeCodeMcpServer(SaveClaudeCodeMcpServerInput{
		Server: ClaudeCodeMcpAsset{
			Label:     "target",
			Scope:     "project",
			Transport: "stdio",
			Endpoint:  "new-command",
		},
	})
	if err != nil {
		t.Fatalf("SaveClaudeCodeMcpServer returned error: %v", err)
	}
	if result.ConfigPath != configPath || result.Server.Endpoint != "new-command" {
		t.Fatalf("unexpected result: %#v", result)
	}

	document := readJSONFile(t, configPath)
	if document["projectUnknown"] != true {
		t.Fatalf("top-level unknown field was not preserved: %#v", document)
	}
	servers := document["mcpServers"].(map[string]any)
	target := servers["target"].(map[string]any)
	if target["command"] != "new-command" || target["unknownServerField"] != "keep" {
		t.Fatalf("target server was not patched preservatively: %#v", target)
	}
	if _, exists := target["url"]; exists {
		t.Fatalf("stdio patch should remove stale url field: %#v", target)
	}
	args := target["args"].([]any)
	if len(args) != 2 || args[0] != "--port" || args[1] != "3000" {
		t.Fatalf("args were not preserved: %#v", target)
	}
	other := servers["other"].(map[string]any)
	if other["url"] != "https://other.example.com/sse" {
		t.Fatalf("other server was modified: %#v", other)
	}
}

func TestSaveClaudeCodeMcpServerPatchesLocalProjectSection(t *testing.T) {
	base := t.TempDir()
	home := filepath.Join(base, "home")
	project := filepath.Join(base, "project")
	t.Setenv("HOME", home)
	mustMkdirAll(t, project)

	previousCwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("Getwd: %v", err)
	}
	if err := os.Chdir(project); err != nil {
		t.Fatalf("Chdir project: %v", err)
	}
	project, err = os.Getwd()
	if err != nil {
		t.Fatalf("Getwd project: %v", err)
	}
	t.Cleanup(func() {
		_ = os.Chdir(previousCwd)
	})

	claudeJSONPath := filepath.Join(home, ".claude.json")
	writeTextFile(t, claudeJSONPath, `{
  "mcpServers": {
    "user-only": {
      "type": "stdio",
      "command": "user-command"
    }
  },
  "projects": {
    "`+escapeJSONString(project)+`": {
      "otherProjectField": "keep",
      "mcpServers": {
        "local-api": {
          "type": "http",
          "url": "https://old.example.com/mcp",
          "headers": {
            "Authorization": "Bearer ${TOKEN}"
          }
        }
      }
    }
  }
}`)

	app := &App{}
	result, err := app.SaveClaudeCodeMcpServer(SaveClaudeCodeMcpServerInput{
		Server: ClaudeCodeMcpAsset{
			Label:     "local-api",
			Scope:     "local",
			Transport: "http",
			Endpoint:  "https://new.example.com/mcp",
		},
	})
	if err != nil {
		t.Fatalf("SaveClaudeCodeMcpServer returned error: %v", err)
	}
	if result.ConfigPath != claudeJSONPath || result.Server.SecretState != "redacted" {
		t.Fatalf("unexpected result: %#v", result)
	}

	document := readJSONFile(t, claudeJSONPath)
	projects := document["projects"].(map[string]any)
	section := projects[project].(map[string]any)
	if section["otherProjectField"] != "keep" {
		t.Fatalf("local project unknown field was not preserved: %#v", section)
	}
	localAPI := section["mcpServers"].(map[string]any)["local-api"].(map[string]any)
	if localAPI["url"] != "https://new.example.com/mcp" || localAPI["type"] != "http" {
		t.Fatalf("local server was not patched: %#v", localAPI)
	}
	if _, exists := localAPI["command"]; exists {
		t.Fatalf("http patch should remove stale command field: %#v", localAPI)
	}
	userOnly := document["mcpServers"].(map[string]any)["user-only"].(map[string]any)
	if userOnly["command"] != "user-command" {
		t.Fatalf("user scope server was modified: %#v", userOnly)
	}
}

func TestSaveClaudeCodeMcpServerRejectsInvalidTransport(t *testing.T) {
	app := &App{}
	_, err := app.SaveClaudeCodeMcpServer(SaveClaudeCodeMcpServerInput{
		Server: ClaudeCodeMcpAsset{
			Label:     "bad",
			Scope:     "project",
			Transport: "websocket",
			Endpoint:  "ws://example.com",
		},
	})
	if err == nil {
		t.Fatal("expected invalid transport error")
	}
}

func assertClaudeSkill(t *testing.T, skills []ClaudeCodeSkillAsset, name string, scope string, invocation string, modelInvocation string, frontmatterStatus string) ClaudeCodeSkillAsset {
	t.Helper()
	for _, skill := range skills {
		if skill.Name == name && skill.Scope == scope {
			if skill.Invocation != invocation || skill.ModelInvocation != modelInvocation || skill.FrontmatterStatus != frontmatterStatus {
				t.Fatalf("skill %s/%s state mismatch: %#v", name, scope, skill)
			}
			return skill
		}
	}
	t.Fatalf("missing skill %s/%s in %#v", name, scope, skills)
	return ClaudeCodeSkillAsset{}
}

func assertClaudeMcp(t *testing.T, servers []ClaudeCodeMcpAsset, label string, scope string, active bool, transport string, endpoint string) ClaudeCodeMcpAsset {
	t.Helper()
	for _, server := range servers {
		if server.Label == label && server.Scope == scope {
			if server.Active != active || server.Transport != transport || server.Endpoint != endpoint {
				t.Fatalf("server %s/%s state mismatch: %#v", label, scope, server)
			}
			return server
		}
	}
	t.Fatalf("missing server %s/%s in %#v", label, scope, servers)
	return ClaudeCodeMcpAsset{}
}

func mustMkdirAll(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(path, 0700); err != nil {
		t.Fatalf("MkdirAll %s: %v", path, err)
	}
}

func writeTextFile(t *testing.T, path string, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		t.Fatalf("MkdirAll %s: %v", filepath.Dir(path), err)
	}
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatalf("WriteFile %s: %v", path, err)
	}
}

func escapeJSONString(input string) string {
	return strings.ReplaceAll(input, `\`, `\\`)
}

func readJSONFile(t *testing.T, path string) map[string]any {
	t.Helper()
	body, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile %s: %v", path, err)
	}
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatalf("Unmarshal %s: %v", path, err)
	}
	return payload
}
