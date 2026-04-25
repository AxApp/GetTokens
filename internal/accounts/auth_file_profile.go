package accounts

import "encoding/json"

type AuthFileProfile struct {
	Email    string
	PlanType string
}

func ExtractAuthFileProfile(body []byte) AuthFileProfile {
	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		return AuthFileProfile{}
	}

	metadata := nestedMap(payload, "metadata")
	attributes := nestedMap(payload, "attributes")
	tokens := nestedMap(payload, "tokens")
	nolonAccount := nestedMap(nestedMap(payload, "nolon"), "account")

	idClaims := parseJWTClaims(firstNonEmpty(
		stringValue(payload, "id_token"),
		stringValue(metadata, "id_token"),
		stringValue(attributes, "id_token"),
		stringValue(tokens, "id_token"),
	))
	openAIAuthClaims := nestedMap(idClaims, "https://api.openai.com/auth")
	openAIProfileClaims := nestedMap(idClaims, "https://api.openai.com/profile")

	email := firstNonEmpty(
		stringValue(payload, "email"),
		stringValue(metadata, "email"),
		stringValue(attributes, "email"),
		stringValue(nolonAccount, "email"),
		stringValue(openAIProfileClaims, "email"),
		stringValue(idClaims, "email"),
	)

	planType := normalizePlanType(firstNonEmpty(
		stringValue(payload, "plan"),
		stringValue(payload, "plan_type"),
		stringValue(payload, "planType"),
		stringValue(metadata, "plan"),
		stringValue(metadata, "plan_type"),
		stringValue(metadata, "planType"),
		stringValue(attributes, "plan"),
		stringValue(attributes, "plan_type"),
		stringValue(attributes, "planType"),
		stringValue(openAIAuthClaims, "chatgpt_plan_type"),
		stringValue(openAIAuthClaims, "chatgptPlanType"),
		stringValue(idClaims, "plan_type"),
		stringValue(idClaims, "planType"),
	))

	return AuthFileProfile{
		Email:    email,
		PlanType: planType,
	}
}
