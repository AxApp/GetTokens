package accounts

import (
	"encoding/json"
	"strings"
)

func redactCodexQuotaHeaders(headers map[string]string) map[string]string {
	if len(headers) == 0 {
		return nil
	}
	result := make(map[string]string, len(headers))
	for key, value := range headers {
		if strings.EqualFold(key, "Authorization") {
			result[key] = "Bearer <redacted>"
			continue
		}
		result[key] = value
	}
	return result
}

func parseCodexQuotaDebugResponse(body []byte) interface{} {
	trimmed := strings.TrimSpace(string(body))
	if trimmed == "" {
		return ""
	}

	var payload interface{}
	if err := json.Unmarshal(body, &payload); err == nil {
		return payload
	}
	return trimmed
}

func emitCodexQuotaDebugRecord(observer func(CodexQuotaDebugRecord), record CodexQuotaDebugRecord) {
	if observer == nil {
		return
	}
	observer(record)
}
