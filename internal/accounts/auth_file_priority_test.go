package accounts

import (
	"encoding/json"
	"testing"
)

func TestExtractAuthFilePriority(t *testing.T) {
	body := []byte(`{"type":"codex","priority":"7"}`)

	if got := ExtractAuthFilePriority(body); got != 7 {
		t.Fatalf("ExtractAuthFilePriority() = %d, want 7", got)
	}
}

func TestSetAuthFilePriorityPreservesCodexMinimalShape(t *testing.T) {
	body := []byte(`{"type":"codex","access_token":"access-token","email":"tester@example.com"}`)

	updated, err := SetAuthFilePriority(body, 9)
	if err != nil {
		t.Fatalf("SetAuthFilePriority returned error: %v", err)
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(updated, &payload); err != nil {
		t.Fatalf("updated payload is invalid json: %v", err)
	}

	if got := priorityValue(payload["priority"]); got != 9 {
		t.Fatalf("priority = %d, want 9", got)
	}
	if got := stringValue(payload, "type"); got != "codex" {
		t.Fatalf("type = %q, want codex", got)
	}
	if got := stringValue(payload, "access_token"); got != "access-token" {
		t.Fatalf("access_token = %q, want access-token", got)
	}
}
