package accounts

import "encoding/json"

// NormalizeAuthFileForSidecar upgrades legacy auth JSON payloads into the
// flat shape expected by CLIProxyAPI's file watcher and codex executor.
func NormalizeAuthFileForSidecar(body []byte) ([]byte, bool, error) {
	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, false, err
	}

	kind := InferAuthFileKind(body)
	profile := ExtractAuthFileProfile(body)
	tokens := nestedMap(payload, "tokens")
	if kind == "codex" {
		minimalPayload := map[string]interface{}{
			"type": "codex",
		}

		for _, key := range []string{"access_token", "id_token", "refresh_token", "account_id"} {
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

	return body, false, nil
}
