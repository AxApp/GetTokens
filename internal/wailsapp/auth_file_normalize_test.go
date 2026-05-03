package wailsapp

import (
	"strings"
	"testing"
)

func TestNormalizeAuthFileContentKeepsMinimalCodexFields(t *testing.T) {
	app := &App{}
	content := `{
  "auth_mode": "chatgpt",
  "nolon": {
    "account": {
      "kind": "chatgptAccount",
      "email": "tester@example.com"
    }
  },
  "tokens": {
    "access_token": "access-token",
    "id_token": "eyJhbGciOiJub25lIn0.eyJodHRwczovL2FwaS5vcGVuYWkuY29tL2F1dGgiOnsiY2hhdGdwdF9hY2NvdW50X2lkIjoiYWNjdF8xMjMiLCJjaGF0Z3B0X3BsYW5fdHlwZSI6InBsdXMifX0.",
    "refresh_token": "refresh-token",
    "account_id": "acct_123"
  }
}`

	normalized, err := app.NormalizeAuthFileContent(content)
	if err != nil {
		t.Fatalf("NormalizeAuthFileContent returned error: %v", err)
	}

	if !strings.Contains(normalized, `"type": "codex"`) {
		t.Fatalf("normalized content missing type: %s", normalized)
	}
	if strings.Contains(normalized, `"tokens"`) || strings.Contains(normalized, `"nolon"`) {
		t.Fatalf("normalized content should remove extra fields: %s", normalized)
	}
}
