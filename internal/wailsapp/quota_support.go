package wailsapp

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
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

func (r managementAPICallResponse) statusCode() int {
	if r.StatusCodeSnake > 0 {
		return r.StatusCodeSnake
	}
	return r.StatusCodeCamel
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
