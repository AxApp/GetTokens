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
	if _, ok := payload["nolon"]; ok {
		t.Fatalf("expected nolon metadata to be removed: %#v", payload)
	}
	if _, ok := payload["tokens"]; ok {
		t.Fatalf("expected nested tokens to be removed: %#v", payload)
	}
	if len(payload) != 7 {
		t.Fatalf("expected minimal codex payload, got %d keys: %#v", len(payload), payload)
	}
}

func TestNormalizeAuthFileForSidecarStripsExtraFieldsFromCodexPayload(t *testing.T) {
	body := []byte(`{"type":"codex","access_token":"access-token","email":"tester@example.com","tokens":{"access_token":"nested"},"nolon":{"account":{"kind":"chatgptAccount"}}}`)

	normalized, changed, err := NormalizeAuthFileForSidecar(body)
	if err != nil {
		t.Fatalf("NormalizeAuthFileForSidecar returned error: %v", err)
	}
	if !changed {
		t.Fatal("expected normalized payload with extra fields to change")
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(normalized, &payload); err != nil {
		t.Fatalf("normalized payload is invalid json: %v", err)
	}

	if _, ok := payload["tokens"]; ok {
		t.Fatalf("expected nested tokens to be removed: %#v", payload)
	}
	if _, ok := payload["nolon"]; ok {
		t.Fatalf("expected nolon metadata to be removed: %#v", payload)
	}
	if len(payload) != 3 {
		t.Fatalf("expected minimal payload, got %d keys: %#v", len(payload), payload)
	}
}

func TestNormalizeAuthFileForSidecarKeepsPriorityForCodexPayload(t *testing.T) {
	body := []byte(`{"type":"codex","access_token":"access-token","priority":"5","tokens":{"access_token":"nested"}}`)

	normalized, changed, err := NormalizeAuthFileForSidecar(body)
	if err != nil {
		t.Fatalf("NormalizeAuthFileForSidecar returned error: %v", err)
	}
	if !changed {
		t.Fatal("expected normalized payload with priority to change")
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(normalized, &payload); err != nil {
		t.Fatalf("normalized payload is invalid json: %v", err)
	}

	if got := priorityValue(payload["priority"]); got != 5 {
		t.Fatalf("priority = %d, want 5", got)
	}
}

func TestNormalizeAuthFileForSidecarConvertsChatGPTWebSessionToCPA(t *testing.T) {
	body := []byte(`{
  "user": {
    "id": "user_123",
    "email": "tester@example.com"
  },
  "expires": "2026-08-06T14:29:36.155Z",
  "account": {
    "id": "acct_123",
    "planType": "plus"
  },
  "accessToken": "access-token",
  "sessionToken": "session-token"
}`)

	normalized, changed, err := NormalizeAuthFileForSidecar(body)
	if err != nil {
		t.Fatalf("NormalizeAuthFileForSidecar returned error: %v", err)
	}
	if !changed {
		t.Fatal("expected ChatGPT Web session to be converted")
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
	if got := stringValue(payload, "session_token"); got != "session-token" {
		t.Fatalf("session_token = %q, want session-token", got)
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
	if got := stringValue(payload, "expired"); got != "2026-08-06T14:29:36.155Z" {
		t.Fatalf("expired = %q, want session expires", got)
	}
	if got, ok := payload["id_token_synthetic"].(bool); !ok || !got {
		t.Fatalf("id_token_synthetic = %#v, want true", payload["id_token_synthetic"])
	}

	idClaims := parseJWTClaims(stringValue(payload, "id_token"))
	openAIAuthClaims := nestedMap(idClaims, "https://api.openai.com/auth")
	if got := stringValue(openAIAuthClaims, "chatgpt_account_id"); got != "acct_123" {
		t.Fatalf("synthetic id_token account = %q, want acct_123", got)
	}
	if got := stringValue(openAIAuthClaims, "chatgpt_plan_type"); got != "plus" {
		t.Fatalf("synthetic id_token plan = %q, want plus", got)
	}
	if got := stringValue(idClaims, "email"); got != "tester@example.com" {
		t.Fatalf("synthetic id_token email = %q, want tester@example.com", got)
	}
}

func TestNormalizeAuthFileForSidecarConverts9RouterCodexOAuthToCPA(t *testing.T) {
	body := []byte(`{
  "accessToken": "router-access-token",
  "refreshToken": "router-refresh-token",
  "expiresAt": "2026-09-01T00:00:00.000Z",
  "providerSpecificData": {
    "chatgptAccountId": "acct_456",
    "chatgptPlanType": "team"
  },
  "provider": "codex",
  "authType": "oauth",
  "email": "router@example.com",
  "priority": 4
}`)

	normalized, changed, err := NormalizeAuthFileForSidecar(body)
	if err != nil {
		t.Fatalf("NormalizeAuthFileForSidecar returned error: %v", err)
	}
	if !changed {
		t.Fatal("expected 9router Codex OAuth JSON to be converted")
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(normalized, &payload); err != nil {
		t.Fatalf("normalized payload is invalid json: %v", err)
	}

	if got := stringValue(payload, "type"); got != "codex" {
		t.Fatalf("type = %q, want codex", got)
	}
	if got := stringValue(payload, "access_token"); got != "router-access-token" {
		t.Fatalf("access_token = %q, want router-access-token", got)
	}
	if got := stringValue(payload, "refresh_token"); got != "router-refresh-token" {
		t.Fatalf("refresh_token = %q, want router-refresh-token", got)
	}
	if got := stringValue(payload, "account_id"); got != "acct_456" {
		t.Fatalf("account_id = %q, want acct_456", got)
	}
	if got := stringValue(payload, "email"); got != "router@example.com" {
		t.Fatalf("email = %q, want router@example.com", got)
	}
	if got := stringValue(payload, "plan_type"); got != "team" {
		t.Fatalf("plan_type = %q, want team", got)
	}
	if got := priorityValue(payload["priority"]); got != 4 {
		t.Fatalf("priority = %d, want 4", got)
	}
}

func TestNormalizeAuthFileForSidecarDoesNotConvertUnknownJSON(t *testing.T) {
	body := []byte(`{"name":"not-a-session","token":"plain-token"}`)

	normalized, changed, err := NormalizeAuthFileForSidecar(body)
	if err != nil {
		t.Fatalf("NormalizeAuthFileForSidecar returned error: %v", err)
	}
	if changed {
		t.Fatalf("unknown JSON should not be converted: %s", normalized)
	}
	if string(normalized) != string(body) {
		t.Fatalf("unknown JSON changed unexpectedly: %s", normalized)
	}
}
