package wailsapp

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
)

func (a *App) GetCodexQuota(name string) (*CodexQuotaResponse, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("name 不能为空")
	}

	authFile, err := a.getRawAuthFileByName(name)
	if err != nil {
		return nil, err
	}

	body, err := a.downloadAuthFileBody(name)
	if err != nil {
		return nil, err
	}

	requestInfo, err := accountsdomain.ResolveCodexQuotaRequestInfo(body)
	if err != nil {
		return nil, err
	}
	authIndex := normalizeAuthIndex(authFile.AuthIndex)
	if authIndex == "" {
		return nil, errors.New("codex 凭证缺少 auth_index")
	}

	startedAt := time.Now()
	requestHeaders := map[string]string{
		"Authorization":      "Bearer $TOKEN$",
		"chatgpt-account-id": requestInfo.ChatGPTAccountID,
		"Accept":             "application/json",
	}
	requestPayload, err := json.Marshal(managementAPICallRequest{
		AuthIndex: authIndex,
		Method:    http.MethodGet,
		URL:       "https://chatgpt.com/backend-api/wham/usage",
		Header:    requestHeaders,
	})
	if err != nil {
		return nil, err
	}

	apiResponseBody, statusCode, err := a.SidecarRequest(
		http.MethodPost,
		ManagementAPIPrefix+"/api-call",
		nil,
		bytes.NewReader(requestPayload),
		"application/json",
	)
	var apiResponse managementAPICallResponse
	if len(apiResponseBody) > 0 {
		_ = json.Unmarshal(apiResponseBody, &apiResponse)
	}

	debugRecord := accountsdomain.CodexQuotaDebugRecord{
		Request: accountsdomain.CodexQuotaDebugRequest{
			Method: http.MethodGet,
			URL:    "https://chatgpt.com/backend-api/wham/usage",
			Headers: map[string]string{
				"Authorization":      "Bearer <redacted>",
				"chatgpt-account-id": requestInfo.ChatGPTAccountID,
				"Accept":             "application/json",
			},
		},
		StartedAt:  startedAt,
		EndedAt:    time.Now(),
		DurationMs: time.Since(startedAt).Milliseconds(),
		StatusCode: statusCode,
	}
	if len(strings.TrimSpace(apiResponse.Body)) > 0 {
		debugRecord.Response = parseDebugResponse(apiResponse.Body)
	}
	if err != nil {
		debugRecord.Error = err.Error()
		a.emitCodexQuotaDebugRecord(debugRecord)
		return nil, err
	}
	debugRecord.StatusCode = apiResponse.statusCode()
	debugRecord.EndedAt = time.Now()
	debugRecord.DurationMs = debugRecord.EndedAt.Sub(startedAt).Milliseconds()
	if len(strings.TrimSpace(apiResponse.Body)) > 0 {
		debugRecord.Response = parseDebugResponse(apiResponse.Body)
	}
	a.emitCodexQuotaDebugRecord(debugRecord)

	quota, err := accountsdomain.BuildCodexQuotaResponse(body, []byte(apiResponse.Body))
	if err != nil {
		return nil, err
	}

	windows := make([]CodexQuotaWindow, 0, len(quota.Windows))
	for _, window := range quota.Windows {
		windows = append(windows, CodexQuotaWindow{
			ID:               window.ID,
			Label:            window.Label,
			RemainingPercent: window.RemainingPercent,
			ResetLabel:       window.ResetLabel,
			ResetAtUnix:      window.ResetAtUnix,
		})
	}

	return &CodexQuotaResponse{
		PlanType: quota.PlanType,
		Windows:  windows,
	}, nil
}

func parseDebugResponse(body string) interface{} {
	trimmed := strings.TrimSpace(body)
	if trimmed == "" {
		return ""
	}
	var payload interface{}
	if err := json.Unmarshal([]byte(trimmed), &payload); err == nil {
		return payload
	}
	return trimmed
}

func toJSONString(value interface{}) string {
	if value == nil {
		return ""
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return ""
	}
	return string(encoded)
}
