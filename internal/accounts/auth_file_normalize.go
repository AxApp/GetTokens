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
	changed := false

	if kind != "" && stringValue(payload, "type") == "" {
		payload["type"] = kind
		changed = true
	}

	if kind == "codex" {
		for _, key := range []string{"access_token", "id_token", "refresh_token", "account_id"} {
			if stringValue(payload, key) != "" {
				continue
			}
			if value := stringValue(tokens, key); value != "" {
				payload[key] = value
				changed = true
			}
		}

		if stringValue(payload, "email") == "" && profile.Email != "" {
			payload["email"] = profile.Email
			changed = true
		}
		if stringValue(payload, "plan_type") == "" && profile.PlanType != "" {
			payload["plan_type"] = profile.PlanType
			changed = true
		}
	}

	if !changed {
		return body, false, nil
	}

	normalized, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return nil, false, err
	}
	return append(normalized, '\n'), true, nil
}
