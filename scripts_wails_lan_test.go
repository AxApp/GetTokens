package main

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func TestWailsDevFrontendBindsToLAN(t *testing.T) {
	data, err := os.ReadFile("frontend/package.json")
	if err != nil {
		t.Fatalf("read frontend/package.json: %v", err)
	}

	var pkg struct {
		Scripts map[string]string `json:"scripts"`
	}
	if err := json.Unmarshal(data, &pkg); err != nil {
		t.Fatalf("parse frontend/package.json: %v", err)
	}

	devScript := pkg.Scripts["dev"]
	if !strings.Contains(devScript, "--host 0.0.0.0") {
		t.Fatalf("frontend dev script = %q, want Vite to bind 0.0.0.0 for LAN preview", devScript)
	}
}
