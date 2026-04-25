package wailsapp

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type managementAPICallRequest struct {
	AuthIndex string            `json:"auth_index,omitempty"`
	Method    string            `json:"method"`
	URL       string            `json:"url"`
	Header    map[string]string `json:"header,omitempty"`
	Data      string            `json:"data,omitempty"`
}

type managementAPICallResponse struct {
	StatusCodeSnake int                 `json:"status_code"`
	StatusCodeCamel int                 `json:"statusCode"`
	Header          map[string][]string `json:"header,omitempty"`
	Body            string              `json:"body"`
}

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

func (r managementAPICallResponse) statusCode() int {
	if r.StatusCodeSnake > 0 {
		return r.StatusCodeSnake
	}
	return r.StatusCodeCamel
}

func (a *App) emitCodexQuotaDebugRecord(record accountsdomain.CodexQuotaDebugRecord) {
	if a.ctx == nil {
		return
	}
	endedAt := record.EndedAt
	if endedAt.IsZero() {
		endedAt = time.Now()
	}
	status := "success"
	if strings.TrimSpace(record.Error) != "" {
		status = "error"
	}
	wailsRuntime.EventsEmit(a.ctx, "debug:entry", map[string]interface{}{
		"name":       "GET https://chatgpt.com/backend-api/wham/usage",
		"transport":  "http",
		"status":     status,
		"request":    record.Request,
		"response":   record.Response,
		"error":      record.Error,
		"startedAt":  record.StartedAt.Format(time.RFC3339Nano),
		"endedAt":    endedAt.Format(time.RFC3339Nano),
		"durationMs": record.DurationMs,
	})
}

func (a *App) getRawAuthFileByName(name string) (*AuthFileItem, error) {
	body, _, err := a.SidecarRequest(http.MethodGet, ManagementAPIPrefix+"/auth-files", nil, nil, "")
	if err != nil {
		return nil, err
	}

	type rawAuthFileItem struct {
		Name           string      `json:"name"`
		Type           string      `json:"type,omitempty"`
		Provider       string      `json:"provider,omitempty"`
		Email          string      `json:"email,omitempty"`
		PlanType       string      `json:"planType,omitempty"`
		PlanTypeSnake  string      `json:"plan_type,omitempty"`
		Size           int64       `json:"size,omitempty"`
		AuthIndexSnake interface{} `json:"auth_index,omitempty"`
		AuthIndexCamel interface{} `json:"authIndex,omitempty"`
		RuntimeOnly    bool        `json:"runtimeOnly,omitempty"`
		Disabled       bool        `json:"disabled,omitempty"`
		Unavailable    bool        `json:"unavailable,omitempty"`
		Status         string      `json:"status,omitempty"`
		StatusMessage  string      `json:"statusMessage,omitempty"`
		LastRefresh    interface{} `json:"lastRefresh,omitempty"`
		Modified       int64       `json:"modified,omitempty"`
	}
	var result struct {
		Files []rawAuthFileItem `json:"files"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	for index := range result.Files {
		if strings.TrimSpace(result.Files[index].Name) == name {
			file := result.Files[index]
			return &AuthFileItem{
				Name:          file.Name,
				Type:          file.Type,
				Provider:      file.Provider,
				Email:         file.Email,
				PlanType:      firstNonEmptyString(file.PlanType, file.PlanTypeSnake),
				Size:          file.Size,
				AuthIndex:     firstNonNilValue(file.AuthIndexSnake, file.AuthIndexCamel),
				RuntimeOnly:   file.RuntimeOnly,
				Disabled:      file.Disabled,
				Unavailable:   file.Unavailable,
				Status:        file.Status,
				StatusMessage: file.StatusMessage,
				LastRefresh:   file.LastRefresh,
				Modified:      file.Modified,
			}, nil
		}
	}

	return nil, errors.New("未找到对应账号")
}

func firstNonNilValue(values ...interface{}) interface{} {
	for _, value := range values {
		if value != nil {
			return value
		}
	}
	return nil
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func normalizeAuthIndex(value interface{}) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case json.Number:
		return strings.TrimSpace(typed.String())
	case float64:
		return strings.TrimSpace(fmt.Sprintf("%.0f", typed))
	case int:
		return strings.TrimSpace(fmt.Sprintf("%d", typed))
	case int64:
		return strings.TrimSpace(fmt.Sprintf("%d", typed))
	case uint64:
		return strings.TrimSpace(fmt.Sprintf("%d", typed))
	default:
		return strings.TrimSpace(toJSONString(value))
	}
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
