package accounts

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"time"
)

func convertSessionLikePayloadToCPA(payload map[string]interface{}) (map[string]interface{}, bool) {
	if strings.EqualFold(stringValue(payload, "type"), "codex") {
		return nil, false
	}

	rootToken := nestedMap(payload, "token")
	credentials := nestedMap(payload, "credentials")
	user := nestedMap(payload, "user")
	account := nestedMap(payload, "account")
	providerData := nestedMap(payload, "providerSpecificData")

	accessToken := firstNonEmpty(
		stringValue(payload, "accessToken"),
		stringValue(payload, "access_token"),
		stringValue(rootToken, "accessToken"),
		stringValue(rootToken, "access_token"),
		stringValue(credentials, "accessToken"),
		stringValue(credentials, "access_token"),
	)
	if accessToken == "" {
		return nil, false
	}

	accessClaims := parseJWTClaims(accessToken)
	openAIAuthClaims := nestedMap(accessClaims, "https://api.openai.com/auth")
	openAIProfileClaims := nestedMap(accessClaims, "https://api.openai.com/profile")

	idToken := firstNonEmpty(
		stringValue(payload, "idToken"),
		stringValue(payload, "id_token"),
		stringValue(rootToken, "idToken"),
		stringValue(rootToken, "id_token"),
		stringValue(credentials, "id_token"),
	)
	idClaims := parseJWTClaims(idToken)
	idAuthClaims := nestedMap(idClaims, "https://api.openai.com/auth")

	expiresAt := normalizeAuthFileTimestamp(firstNonEmpty(
		timestampFromJWTExp(accessClaims),
		stringValue(payload, "expires"),
		stringValue(payload, "expiresAt"),
		stringValue(payload, "expired"),
		stringValue(payload, "expires_at"),
	))

	email := firstNonEmpty(
		stringValue(user, "email"),
		stringValue(payload, "email"),
		stringValue(credentials, "email"),
		stringValue(providerData, "email"),
		stringValue(openAIProfileClaims, "email"),
		stringValue(idClaims, "email"),
		stringValue(accessClaims, "email"),
	)

	accountID := firstNonEmpty(
		stringValue(account, "id"),
		stringValue(payload, "account_id"),
		stringValue(payload, "accountId"),
		stringValue(payload, "chatgptAccountId"),
		stringValue(providerData, "chatgptAccountId"),
		stringValue(providerData, "chatgpt_account_id"),
		stringValue(credentials, "chatgpt_account_id"),
		stringValue(openAIAuthClaims, "chatgpt_account_id"),
		stringValue(idAuthClaims, "chatgpt_account_id"),
	)

	userID := firstNonEmpty(
		stringValue(user, "id"),
		stringValue(payload, "user_id"),
		stringValue(payload, "userId"),
		stringValue(payload, "chatgptUserId"),
		stringValue(providerData, "chatgptUserId"),
		stringValue(providerData, "chatgpt_user_id"),
		stringValue(openAIAuthClaims, "chatgpt_user_id"),
		stringValue(openAIAuthClaims, "user_id"),
		stringValue(idAuthClaims, "chatgpt_user_id"),
		stringValue(idAuthClaims, "user_id"),
	)

	planType := normalizePlanType(firstNonEmpty(
		stringValue(account, "planType"),
		stringValue(account, "plan_type"),
		stringValue(payload, "planType"),
		stringValue(payload, "plan_type"),
		stringValue(providerData, "chatgptPlanType"),
		stringValue(providerData, "chatgpt_plan_type"),
		stringValue(credentials, "plan_type"),
		stringValue(openAIAuthClaims, "chatgpt_plan_type"),
		stringValue(idAuthClaims, "chatgpt_plan_type"),
	))

	if email == "" && accountID == "" && userID == "" {
		return nil, false
	}

	syntheticIDToken := ""
	if idToken == "" {
		syntheticIDToken = buildSyntheticCodexIDToken(email, accountID, planType, userID, expiresAt)
		idToken = syntheticIDToken
	}

	converted := map[string]interface{}{
		"type":         "codex",
		"access_token": accessToken,
		"last_refresh": normalizeAuthFileTimestamp(time.Now().UTC().Format(time.RFC3339Nano)),
	}
	if value := firstNonEmpty(
		stringValue(payload, "sessionToken"),
		stringValue(payload, "session_token"),
		stringValue(rootToken, "sessionToken"),
		stringValue(rootToken, "session_token"),
		stringValue(credentials, "session_token"),
	); value != "" {
		converted["session_token"] = value
	}
	if value := firstNonEmpty(
		stringValue(payload, "refreshToken"),
		stringValue(payload, "refresh_token"),
		stringValue(rootToken, "refreshToken"),
		stringValue(rootToken, "refresh_token"),
		stringValue(credentials, "refresh_token"),
	); value != "" {
		converted["refresh_token"] = value
	}
	if idToken != "" {
		converted["id_token"] = idToken
	}
	if syntheticIDToken != "" {
		converted["id_token_synthetic"] = true
	}
	if email != "" {
		converted["email"] = email
	}
	if accountID != "" {
		converted["account_id"] = accountID
		converted["chatgpt_account_id"] = accountID
	}
	if planType != "" {
		converted["plan_type"] = planType
		converted["chatgpt_plan_type"] = planType
	}
	if expiresAt != "" {
		converted["expired"] = expiresAt
	}
	if priority := priorityValue(payload["priority"]); priority > 0 {
		converted["priority"] = priority
	}
	if disabled, ok := payload["disabled"].(bool); ok && disabled {
		converted["disabled"] = true
	}

	return converted, true
}

func buildSyntheticCodexIDToken(email, accountID, planType, userID, expiresAt string) string {
	if accountID == "" {
		return ""
	}

	now := time.Now().Unix()
	expires := epochSecondsFromAuthFileTimestamp(expiresAt)
	if expires <= 0 {
		expires = now + 90*24*60*60
	}

	authInfo := map[string]interface{}{
		"chatgpt_account_id": accountID,
	}
	if planType != "" {
		authInfo["chatgpt_plan_type"] = planType
	}
	if userID != "" {
		authInfo["chatgpt_user_id"] = userID
		authInfo["user_id"] = userID
	}

	idClaims := map[string]interface{}{
		"iat":                         now,
		"exp":                         expires,
		"https://api.openai.com/auth": authInfo,
	}
	if email != "" {
		idClaims["email"] = email
	}

	header := map[string]interface{}{
		"alg":           "none",
		"typ":           "JWT",
		"cpa_synthetic": true,
	}
	return encodeBase64URLJSON(header) + "." + encodeBase64URLJSON(idClaims) + "."
}

func encodeBase64URLJSON(value map[string]interface{}) string {
	encoded, _ := json.Marshal(value)
	return base64.RawURLEncoding.EncodeToString(encoded)
}

func timestampFromJWTExp(claims map[string]interface{}) string {
	if claims == nil {
		return ""
	}
	if numeric := numberValue(claims["exp"]); numeric != nil {
		seconds := int64(*numeric)
		if seconds <= 0 {
			return ""
		}
		return time.Unix(seconds, 0).UTC().Format(time.RFC3339Nano)
	}
	return ""
}

func normalizeAuthFileTimestamp(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	if parsed, err := time.Parse(time.RFC3339Nano, trimmed); err == nil {
		return parsed.UTC().Format(time.RFC3339Nano)
	}
	return trimmed
}

func epochSecondsFromAuthFileTimestamp(value string) int64 {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return 0
	}
	if parsed, err := time.Parse(time.RFC3339Nano, trimmed); err == nil {
		return parsed.UTC().Unix()
	}
	if numeric := numberValue(trimmed); numeric != nil {
		value := *numeric
		if value > 1e11 {
			return int64(value / 1000)
		}
		return int64(value)
	}
	return 0
}
