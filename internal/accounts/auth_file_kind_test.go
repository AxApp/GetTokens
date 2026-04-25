package accounts

import "testing"

func TestInferAuthFileKindChatGPTAuthMode(t *testing.T) {
	body := []byte(`{"auth_mode":"chatgpt","tokens":{"access_token":"token"}}`)

	kind := InferAuthFileKind(body)
	if kind != "codex" {
		t.Fatalf("expected codex, got %q", kind)
	}
}

func TestInferAuthFileKindFromNolonAccountKind(t *testing.T) {
	body := []byte(`{"nolon":{"account":{"kind":"chatgptAccount"}}}`)

	kind := InferAuthFileKind(body)
	if kind != "codex" {
		t.Fatalf("expected codex, got %q", kind)
	}
}
