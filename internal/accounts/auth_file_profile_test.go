package accounts

import (
	"encoding/base64"
	"encoding/json"
	"testing"
)

func TestExtractAuthFileProfile(t *testing.T) {
	claims := map[string]interface{}{
		"https://api.openai.com/auth": map[string]interface{}{
			"chatgpt_plan_type": "plus",
		},
		"https://api.openai.com/profile": map[string]interface{}{
			"email": "user@example.com",
		},
	}
	claimBytes, err := json.Marshal(claims)
	if err != nil {
		t.Fatalf("marshal claims: %v", err)
	}

	body := []byte(`{"tokens":{"id_token":"header.` + base64.RawURLEncoding.EncodeToString(claimBytes) + `.sig"}}`)
	profile := ExtractAuthFileProfile(body)

	if profile.Email != "user@example.com" {
		t.Fatalf("unexpected email: %q", profile.Email)
	}
	if profile.PlanType != "plus" {
		t.Fatalf("unexpected plan type: %q", profile.PlanType)
	}
}
