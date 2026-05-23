package accounts

import "encoding/json"

// NormalizeAuthFileForSidecar upgrades legacy auth JSON payloads into the
// flat shape expected by CLIProxyAPI's file watcher and codex executor.
func NormalizeAuthFileForSidecar(body []byte) ([]byte, bool, error) {
	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, false, err
	}

	convertedFromSession := false
	if converted, ok := convertSessionLikePayloadToCPA(payload); ok {
		payload = converted
		body = mustMarshalJSON(payload)
		convertedFromSession = true
	}

	kind := InferAuthFileKind(body)
	profile := ExtractAuthFileProfile(body)
	tokens := nestedMap(payload, "tokens")
	if kind == "codex" {
		minimalPayload := map[string]interface{}{
			"type": "codex",
		}

		for _, key := range []string{
			"access_token",
			"id_token",
			"refresh_token",
			"session_token",
			"account_id",
			"chatgpt_account_id",
			"expired",
			"last_refresh",
		} {
			value := firstNonEmpty(
				stringValue(payload, key),
				stringValue(tokens, key),
			)
			if value != "" {
				minimalPayload[key] = value
			}
		}

		if profile.Email != "" {
			minimalPayload["email"] = profile.Email
		}
		if profile.PlanType != "" {
			minimalPayload["plan_type"] = profile.PlanType
		}
		if value := stringValue(payload, "chatgpt_plan_type"); value != "" {
			minimalPayload["chatgpt_plan_type"] = normalizePlanType(value)
		}
		if value, ok := payload["id_token_synthetic"].(bool); ok && value {
			minimalPayload["id_token_synthetic"] = true
		}
		if priority := priorityValue(payload["priority"]); priority > 0 {
			minimalPayload["priority"] = priority
		}

		normalized, err := json.MarshalIndent(minimalPayload, "", "  ")
		if err != nil {
			return nil, false, err
		}
		normalized = append(normalized, '\n')
		return normalized, string(normalized) != string(body), nil
	}

	if kind != "" && stringValue(payload, "type") == "" {
		payload["type"] = kind
		normalized, err := json.MarshalIndent(payload, "", "  ")
		if err != nil {
			return nil, false, err
		}
		normalized = append(normalized, '\n')
		return normalized, true, nil
	}

	if convertedFromSession {
		normalized, err := json.MarshalIndent(payload, "", "  ")
		if err != nil {
			return nil, false, err
		}
		normalized = append(normalized, '\n')
		return normalized, true, nil
	}

	return body, false, nil
}
