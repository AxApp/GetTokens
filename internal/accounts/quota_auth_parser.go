package accounts

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
)

func parseCodexAuthFile(body []byte) (*codexAuthInfo, error) {
	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("codex 凭证解析失败: %w", err)
	}

	metadata := nestedMap(payload, "metadata")
	attributes := nestedMap(payload, "attributes")
	rootToken := nestedMap(payload, "token")
	tokens := nestedMap(payload, "tokens")
	metadataToken := nestedMap(metadata, "token")
	attributesToken := nestedMap(attributes, "token")

	accessToken := firstNonEmpty(
		stringValue(tokens, "access_token"),
		stringValue(tokens, "accessToken"),
		stringValue(payload, "access_token"),
		stringValue(payload, "accessToken"),
		stringValue(metadata, "access_token"),
		stringValue(metadata, "accessToken"),
		stringValue(attributes, "access_token"),
		stringValue(attributes, "accessToken"),
		stringValue(rootToken, "access_token"),
		stringValue(rootToken, "accessToken"),
		stringValue(metadataToken, "access_token"),
		stringValue(metadataToken, "accessToken"),
		stringValue(attributesToken, "access_token"),
		stringValue(attributesToken, "accessToken"),
	)

	idTokenRaw := firstNonEmpty(
		stringValue(payload, "id_token"),
		stringValue(metadata, "id_token"),
		stringValue(attributes, "id_token"),
		stringValue(tokens, "id_token"),
	)

	idClaims := parseJWTClaims(idTokenRaw)
	openAIAuthClaims := nestedMap(idClaims, "https://api.openai.com/auth")
	chatgptAccountID := firstNonEmpty(
		stringValue(tokens, "account_id"),
		stringValue(tokens, "accountId"),
		stringValue(payload, "account_id"),
		stringValue(payload, "accountId"),
		stringValue(idClaims, "chatgpt_account_id"),
		stringValue(idClaims, "chatgptAccountId"),
		stringValue(openAIAuthClaims, "chatgpt_account_id"),
		stringValue(openAIAuthClaims, "chatgptAccountId"),
	)

	planType := normalizePlanType(firstNonEmpty(
		stringValue(payload, "plan_type"),
		stringValue(payload, "planType"),
		stringValue(metadata, "plan_type"),
		stringValue(metadata, "planType"),
		stringValue(attributes, "plan_type"),
		stringValue(attributes, "planType"),
		stringValue(idClaims, "plan_type"),
		stringValue(idClaims, "planType"),
		stringValue(openAIAuthClaims, "chatgpt_plan_type"),
		stringValue(openAIAuthClaims, "chatgptPlanType"),
	))

	return &codexAuthInfo{
		AccessToken:      strings.TrimSpace(accessToken),
		ChatGPTAccountID: strings.TrimSpace(chatgptAccountID),
		PlanType:         planType,
	}, nil
}

func parseJWTClaims(raw string) map[string]interface{} {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return map[string]interface{}{}
	}

	parts := strings.Split(raw, ".")
	if len(parts) < 2 {
		return map[string]interface{}{}
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return map[string]interface{}{}
	}

	var claims map[string]interface{}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return map[string]interface{}{}
	}

	return claims
}

func nestedMap(root map[string]interface{}, key string) map[string]interface{} {
	if root == nil {
		return map[string]interface{}{}
	}
	value, ok := root[key]
	if !ok {
		return map[string]interface{}{}
	}
	typed, ok := value.(map[string]interface{})
	if !ok {
		return map[string]interface{}{}
	}
	return typed
}

func stringValue(root map[string]interface{}, key string) string {
	if root == nil {
		return ""
	}
	value, ok := root[key]
	if !ok {
		return ""
	}
	typed, ok := value.(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(typed)
}

func numberValue(value interface{}) *float64 {
	switch typed := value.(type) {
	case float64:
		return &typed
	case float32:
		converted := float64(typed)
		return &converted
	case int:
		converted := float64(typed)
		return &converted
	case int32:
		converted := float64(typed)
		return &converted
	case int64:
		converted := float64(typed)
		return &converted
	case json.Number:
		converted, err := typed.Float64()
		if err == nil {
			return &converted
		}
	case string:
		trimmed := strings.TrimSpace(typed)
		if trimmed == "" {
			return nil
		}
		converted, err := json.Number(trimmed).Float64()
		if err == nil {
			return &converted
		}
	}
	return nil
}

func firstNonNil(values ...interface{}) interface{} {
	for _, value := range values {
		if value != nil {
			return value
		}
	}
	return nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func normalizePlanType(value string) string {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	if trimmed == "" {
		return ""
	}
	replacer := strings.NewReplacer(" ", "", "-", "", "_", "")
	switch replacer.Replace(trimmed) {
	case "pro":
		return "pro"
	case "prolite":
		return "prolite"
	case "plus":
		return "plus"
	case "team":
		return "team"
	case "free":
		return "free"
	default:
		return trimmed
	}
}
