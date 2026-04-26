package accounts

import (
	"encoding/json"
	"strconv"
	"strings"
)

func ExtractAuthFilePriority(body []byte) int {
	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		return 0
	}

	return priorityValue(payload["priority"])
}

func SetAuthFilePriority(body []byte, priority int) ([]byte, error) {
	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}

	if priority <= 0 {
		delete(payload, "priority")
	} else {
		payload["priority"] = priority
	}

	normalized, _, err := NormalizeAuthFileForSidecar(mustMarshalJSON(payload))
	if err != nil {
		return nil, err
	}
	return normalized, nil
}

func priorityValue(raw interface{}) int {
	switch value := raw.(type) {
	case float64:
		if value <= 0 {
			return 0
		}
		return int(value)
	case string:
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			return 0
		}
		parsed, err := strconv.Atoi(trimmed)
		if err != nil || parsed <= 0 {
			return 0
		}
		return parsed
	default:
		return 0
	}
}

func mustMarshalJSON(payload map[string]interface{}) []byte {
	encoded, _ := json.Marshal(payload)
	return encoded
}
