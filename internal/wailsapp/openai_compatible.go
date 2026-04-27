package wailsapp

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/linhay/gettokens/internal/cliproxyapi"
)

type OpenAICompatibleProvider struct {
	Name       string            `json:"name"`
	BaseURL    string            `json:"baseUrl"`
	Prefix     string            `json:"prefix,omitempty"`
	APIKey     string            `json:"apiKey"`
	Headers    map[string]string `json:"headers,omitempty"`
	KeyCount   int               `json:"keyCount,omitempty"`
	ModelCount int               `json:"modelCount,omitempty"`
	HasHeaders bool              `json:"hasHeaders,omitempty"`
}

type CreateOpenAICompatibleProviderInput struct {
	Name    string `json:"name"`
	BaseURL string `json:"baseUrl"`
	Prefix  string `json:"prefix,omitempty"`
	APIKey  string `json:"apiKey"`
}

type UpdateOpenAICompatibleProviderInput struct {
	CurrentName string `json:"currentName"`
	Name        string `json:"name"`
	BaseURL     string `json:"baseUrl"`
	Prefix      string `json:"prefix,omitempty"`
	APIKey      string `json:"apiKey"`
}

type VerifyOpenAICompatibleProviderInput struct {
	BaseURL string            `json:"baseUrl"`
	APIKey  string            `json:"apiKey"`
	Model   string            `json:"model"`
	Headers map[string]string `json:"headers,omitempty"`
}

type VerifyOpenAICompatibleProviderResult struct {
	Success      bool   `json:"success"`
	StatusCode   int    `json:"statusCode,omitempty"`
	Message      string `json:"message,omitempty"`
	ResponseBody string `json:"responseBody,omitempty"`
}

func (a *App) ListOpenAICompatibleProviders() ([]OpenAICompatibleProvider, error) {
	items, err := a.managementClient().ListOpenAICompatibleProviders()
	if err != nil {
		return nil, err
	}

	providers := make([]OpenAICompatibleProvider, 0, len(items))
	for _, item := range items {
		apiKey := ""
		if len(item.APIKeyEntries) > 0 {
			apiKey = strings.TrimSpace(item.APIKeyEntries[0].APIKey)
		}
		providers = append(providers, OpenAICompatibleProvider{
			Name:       strings.TrimSpace(item.Name),
			BaseURL:    strings.TrimSpace(item.BaseURL),
			Prefix:     strings.TrimSpace(item.Prefix),
			APIKey:     apiKey,
			Headers:    cloneHeaders(item.Headers),
			KeyCount:   len(item.APIKeyEntries),
			ModelCount: len(item.Models),
			HasHeaders: len(item.Headers) > 0,
		})
	}
	return providers, nil
}

func (a *App) CreateOpenAICompatibleProvider(input CreateOpenAICompatibleProviderInput) error {
	name := strings.TrimSpace(input.Name)
	baseURL := strings.TrimSpace(input.BaseURL)
	apiKey := strings.TrimSpace(input.APIKey)
	prefix := strings.TrimSpace(input.Prefix)

	switch {
	case name == "":
		return errors.New("name 不能为空")
	case baseURL == "":
		return errors.New("base url 不能为空")
	case apiKey == "":
		return errors.New("api key 不能为空")
	}

	current, err := a.managementClient().ListOpenAICompatibleProviders()
	if err != nil {
		return err
	}

	for _, item := range current {
		if strings.EqualFold(strings.TrimSpace(item.Name), name) {
			return errors.New("provider name 已存在")
		}
	}

	current = append(current, cliproxyapi.OpenAICompatibleProvider{
		Name:    name,
		BaseURL: baseURL,
		Prefix:  prefix,
		APIKeyEntries: []cliproxyapi.OpenAICompatibleAPIKeyEntry{
			{APIKey: apiKey},
		},
	})

	return a.managementClient().PutOpenAICompatibleProviders(current)
}

func (a *App) DeleteOpenAICompatibleProvider(name string) error {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return errors.New("name 不能为空")
	}
	return a.managementClient().DeleteOpenAICompatibleProvider(trimmed)
}

func (a *App) UpdateOpenAICompatibleProvider(input UpdateOpenAICompatibleProviderInput) error {
	currentName := strings.TrimSpace(input.CurrentName)
	name := strings.TrimSpace(input.Name)
	baseURL := strings.TrimSpace(input.BaseURL)
	apiKey := strings.TrimSpace(input.APIKey)
	prefix := strings.TrimSpace(input.Prefix)

	switch {
	case currentName == "":
		return errors.New("current name 不能为空")
	case name == "":
		return errors.New("name 不能为空")
	case baseURL == "":
		return errors.New("base url 不能为空")
	case apiKey == "":
		return errors.New("api key 不能为空")
	}

	current, err := a.managementClient().ListOpenAICompatibleProviders()
	if err != nil {
		return err
	}

	targetIndex := -1
	for index, item := range current {
		trimmedName := strings.TrimSpace(item.Name)
		if strings.EqualFold(trimmedName, currentName) {
			targetIndex = index
			continue
		}
		if strings.EqualFold(trimmedName, name) {
			return errors.New("provider name 已存在")
		}
	}

	if targetIndex < 0 {
		return errors.New("provider 不存在")
	}

	target := current[targetIndex]
	target.Name = name
	target.BaseURL = baseURL
	target.Prefix = prefix
	if len(target.APIKeyEntries) == 0 {
		target.APIKeyEntries = []cliproxyapi.OpenAICompatibleAPIKeyEntry{{APIKey: apiKey}}
	} else {
		target.APIKeyEntries[0].APIKey = apiKey
	}
	current[targetIndex] = target

	return a.managementClient().PutOpenAICompatibleProviders(current)
}

func (a *App) VerifyOpenAICompatibleProvider(input VerifyOpenAICompatibleProviderInput) (*VerifyOpenAICompatibleProviderResult, error) {
	baseURL := strings.TrimSpace(input.BaseURL)
	apiKey := strings.TrimSpace(input.APIKey)
	model := strings.TrimSpace(input.Model)

	switch {
	case baseURL == "":
		return nil, errors.New("base url 不能为空")
	case apiKey == "":
		return nil, errors.New("api key 不能为空")
	case model == "":
		return nil, errors.New("model 不能为空")
	}

	requestHeaders := normalizeVerifyHeaders(input.Headers)
	if _, ok := requestHeaders["Authorization"]; !ok {
		requestHeaders["Authorization"] = "Bearer " + apiKey
	}
	if _, ok := requestHeaders["Content-Type"]; !ok {
		requestHeaders["Content-Type"] = "application/json"
	}

	payloadBody, err := json.Marshal(map[string]any{
		"model":      model,
		"messages":   []map[string]string{{"role": "user", "content": "Hi"}},
		"stream":     false,
		"max_tokens": 5,
	})
	if err != nil {
		return nil, err
	}

	requestPayload, err := json.Marshal(managementAPICallRequest{
		Method: http.MethodPost,
		URL:    buildOpenAICompatibleChatCompletionsURL(baseURL),
		Header: requestHeaders,
		Data:   string(payloadBody),
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
	if err != nil {
		return nil, err
	}

	var apiResponse managementAPICallResponse
	if len(apiResponseBody) > 0 {
		if err := json.Unmarshal(apiResponseBody, &apiResponse); err != nil {
			return nil, err
		}
	}

	finalStatusCode := apiResponse.statusCode()
	if finalStatusCode == 0 {
		finalStatusCode = statusCode
	}
	success := finalStatusCode >= 200 && finalStatusCode < 300
	message := "provider 验证失败"
	if success {
		message = "provider 验证成功"
	}

	return &VerifyOpenAICompatibleProviderResult{
		Success:      success,
		StatusCode:   finalStatusCode,
		Message:      message,
		ResponseBody: strings.TrimSpace(apiResponse.Body),
	}, nil
}

func buildOpenAICompatibleChatCompletionsURL(baseURL string) string {
	trimmed := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if strings.HasSuffix(trimmed, "/chat/completions") {
		return trimmed
	}
	return trimmed + "/chat/completions"
}

func normalizeVerifyHeaders(headers map[string]string) map[string]string {
	if len(headers) == 0 {
		return map[string]string{}
	}

	normalized := make(map[string]string, len(headers))
	for key, value := range headers {
		trimmedKey := strings.TrimSpace(key)
		trimmedValue := strings.TrimSpace(value)
		if trimmedKey == "" || trimmedValue == "" {
			continue
		}
		if strings.EqualFold(trimmedKey, "authorization") {
			normalized["Authorization"] = trimmedValue
			continue
		}
		if strings.EqualFold(trimmedKey, "content-type") {
			normalized["Content-Type"] = trimmedValue
			continue
		}
		normalized[trimmedKey] = trimmedValue
	}
	return normalized
}

func cloneHeaders(headers map[string]string) map[string]string {
	if len(headers) == 0 {
		return nil
	}
	cloned := make(map[string]string, len(headers))
	for key, value := range headers {
		cloned[key] = value
	}
	return cloned
}
