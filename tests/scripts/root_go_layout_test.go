package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestRootGoFilesLiveUnderWailsCommand(t *testing.T) {
	rootEntries, err := os.ReadDir(repoPath(t))
	if err != nil {
		t.Fatalf("read repo root: %v", err)
	}
	for _, entry := range rootEntries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".go" {
			continue
		}
		t.Fatalf("repo root contains Go file %q; Wails command files must live under cmd/gettokens", entry.Name())
	}

	for _, name := range []string{
		"app.go",
		"app_types.go",
		"app_mappers.go",
		"main.go",
		"proxy_pool.go",
		"wails.json",
	} {
		if _, err := os.Stat(repoPath(t, "cmd", "gettokens", name)); err != nil {
			t.Fatalf("cmd/gettokens/%s missing: %v", name, err)
		}
	}
	if _, err := os.Stat(repoPath(t, "wails.json")); !os.IsNotExist(err) {
		t.Fatalf("root wails.json should be moved to cmd/gettokens, stat err = %v", err)
	}
}

func TestWailsCommandConfigKeepsRootWorkspaceContracts(t *testing.T) {
	data, err := os.ReadFile(repoPath(t, "cmd", "gettokens", "wails.json"))
	if err != nil {
		t.Fatalf("read cmd/gettokens/wails.json: %v", err)
	}
	var config map[string]any
	if err := json.Unmarshal(data, &config); err != nil {
		t.Fatalf("parse cmd/gettokens/wails.json: %v", err)
	}

	assertConfigValue(t, config, "frontend:dir", "../../frontend")
	assertConfigValue(t, config, "wailsjsdir", "../../frontend")
	assertConfigValue(t, config, "build:dir", "../../build")
	assertConfigValue(t, config, "frontend:build", "npm run build:wails")
}

func assertConfigValue(t *testing.T, config map[string]any, key string, want string) {
	t.Helper()
	if got, ok := config[key].(string); !ok || got != want {
		t.Fatalf("wails config %s = %#v, want %q", key, config[key], want)
	}
}
