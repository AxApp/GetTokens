package wailsapp

import (
	"os"
	"strings"
	"testing"
)

func TestMenuBarOpenWindowNavigatesToAccounts(t *testing.T) {
	body, err := os.ReadFile("app_runtime_menubar.go")
	if err != nil {
		t.Fatalf("read app_runtime_menubar.go: %v", err)
	}
	source := string(body)

	for _, want := range []string{
		`wailsRuntime.Show(a.ctx)`,
		`wailsRuntime.WindowShow(a.ctx)`,
		`wailsRuntime.EventsEmit(a.ctx, "menubar:navigate", menuBarAccountsRiskPayload())`,
	} {
		if !strings.Contains(source, want) {
			t.Fatalf("menu bar open callback missing %q", want)
		}
	}

	if strings.Index(source, `wailsRuntime.WindowShow(a.ctx)`) > strings.Index(source, `"menubar:navigate"`) {
		t.Fatal("menu bar navigation event should be emitted after the window is shown")
	}
}

func TestMenuBarAccountsRiskPayloadTargetsRiskWorkspace(t *testing.T) {
	payload := menuBarAccountsRiskPayload()
	if payload["page"] != "accounts" || payload["workspace"] != "all" || payload["filter"] != "risk" {
		t.Fatalf("payload = %#v", payload)
	}
}
