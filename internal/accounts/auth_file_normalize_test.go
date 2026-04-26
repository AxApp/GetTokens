package accounts

import (
	"encoding/json"
	"testing"
)

func TestNormalizeAuthFileForSidecarCodexLegacyPayload(t *testing.T) {
	body := []byte(`{
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
}`)

	normalized, changed, err := NormalizeAuthFileForSidecar(body)
	if err != nil {
		t.Fatalf("NormalizeAuthFileForSidecar returned error: %v", err)
	}
	if !changed {
		t.Fatal("expected normalization to change legacy codex auth file")
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(normalized, &payload); err != nil {
		t.Fatalf("normalized payload is invalid json: %v", err)
	}

	if got := stringValue(payload, "type"); got != "codex" {
		t.Fatalf("type = %q, want codex", got)
	}
	if got := stringValue(payload, "access_token"); got != "access-token" {
		t.Fatalf("access_token = %q, want access-token", got)
	}
	if got := stringValue(payload, "refresh_token"); got != "refresh-token" {
		t.Fatalf("refresh_token = %q, want refresh-token", got)
	}
	if got := stringValue(payload, "account_id"); got != "acct_123" {
		t.Fatalf("account_id = %q, want acct_123", got)
	}
	if got := stringValue(payload, "email"); got != "tester@example.com" {
		t.Fatalf("email = %q, want tester@example.com", got)
	}
	if got := stringValue(payload, "plan_type"); got != "plus" {
		t.Fatalf("plan_type = %q, want plus", got)
	}
}

func TestNormalizeAuthFileForSidecarLeavesNormalizedPayloadUntouched(t *testing.T) {
	body := []byte(`{"type":"codex","access_token":"access-token","email":"tester@example.com"}`)

	normalized, changed, err := NormalizeAuthFileForSidecar(body)
	if err != nil {
		t.Fatalf("NormalizeAuthFileForSidecar returned error: %v", err)
	}
	if changed {
		t.Fatal("expected normalized payload to remain unchanged")
	}
	if string(normalized) != string(body) {
		t.Fatalf("normalized body changed unexpectedly: %s", string(normalized))
	}
}
