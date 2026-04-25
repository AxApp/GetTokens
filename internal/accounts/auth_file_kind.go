package accounts

import (
	"encoding/json"
	"strings"
)

// InferAuthFileKind derives a stable provider/type label from the raw auth file body
// when the sidecar list response only reports "unknown".
func InferAuthFileKind(body []byte) string {
	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		return ""
	}

	authMode := normalizeAuthMode(firstNonEmpty(
		stringValue(payload, "auth_mode"),
		stringValue(nestedMap(payload, "metadata"), "auth_mode"),
		stringValue(nestedMap(payload, "attributes"), "auth_mode"),
	))
	if mapped := providerFromAuthMode(authMode); mapped != "" {
		return mapped
	}

	tokens := nestedMap(payload, "tokens")
	nolonAccount := nestedMap(nestedMap(payload, "nolon"), "account")

	if strings.EqualFold(stringValue(nolonAccount, "kind"), "chatgptAccount") {
		return "codex"
	}

	if firstNonEmpty(
		stringValue(tokens, "access_token"),
		stringValue(tokens, "id_token"),
		stringValue(tokens, "account_id"),
	) != "" {
		return "codex"
	}

	return ""
}

func normalizeAuthMode(value string) string {
	replacer := strings.NewReplacer(" ", "", "-", "", "_", "")
	return replacer.Replace(strings.ToLower(strings.TrimSpace(value)))
}

func providerFromAuthMode(value string) string {
	switch value {
	case "chatgpt":
		return "codex"
	case "claude":
		return "claude"
	case "gemini":
		return "gemini"
	case "geminicli":
		return "gemini-cli"
	case "qwen":
		return "qwen"
	case "kimi":
		return "kimi"
	case "vertex":
		return "vertex"
	}
	return ""
}
