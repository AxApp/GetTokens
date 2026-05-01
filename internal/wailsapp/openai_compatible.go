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
	Name       string                  `json:"name"`
	Priority   int                     `json:"priority,omitempty"`
	Disabled   bool                    `json:"disabled,omitempty"`
	BaseURL    string                  `json:"baseUrl"`
	Prefix     string                  `json:"prefix,omitempty"`
	APIKey     string                  `json:"apiKey"`
	APIKeys    []string                `json:"apiKeys,omitempty"`
	Models     []OpenAICompatibleModel `json:"models,omitempty"`
	Headers    map[string]string       `json:"headers,omitempty"`
	KeyCount   int                     `json:"keyCount,omitempty"`
	ModelCount int                     `json:"modelCount,omitempty"`
	HasHeaders bool                    `json:"hasHeaders,omitempty"`
}

type OpenAICompatibleModel struct {
	Name                      string   `json:"name"`
	Alias                     string   `json:"alias,omitempty"`
	SupportedReasoningEfforts []string `json:"supportedReasoningEfforts,omitempty"`
	DefaultReasoningEffort    string   `json:"defaultReasoningEffort,omitempty"`
}

type CreateOpenAICompatibleProviderInput struct {
	Name    string `json:"name"`
	BaseURL string `json:"baseUrl"`
	Prefix  string `json:"prefix,omitempty"`
	APIKey  string `json:"apiKey"`
}

type UpdateOpenAICompatibleProviderInput struct {
	CurrentName string                  `json:"currentName"`
	Name        string                  `json:"name"`
	BaseURL     string                  `json:"baseUrl"`
	Prefix      string                  `json:"prefix,omitempty"`
	APIKey      string                  `json:"apiKey"`
	APIKeys     []string                `json:"apiKeys,omitempty"`
	Headers     map[string]string       `json:"headers,omitempty"`
	Models      []OpenAICompatibleModel `json:"models,omitempty"`
}

type VerifyOpenAICompatibleProviderInput struct {
	BaseURL string            `json:"baseUrl"`
	APIKey  string            `json:"apiKey"`
	Model   string            `json:"model"`
	Headers map[string]string `json:"headers,omitempty"`
}

type FetchOpenAICompatibleProviderModelsInput struct {
	BaseURL string            `json:"baseUrl"`
	APIKey  string            `json:"apiKey"`
	Headers map[string]string `json:"headers,omitempty"`
}

type VerifyOpenAICompatibleProviderResult struct {
	Success      bool   `json:"success"`
	StatusCode   int    `json:"statusCode,omitempty"`
	Message      string `json:"message,omitempty"`
	ResponseBody string `json:"responseBody,omitempty"`
}

type FetchOpenAICompatibleProviderModelsResult struct {
	Models       []OpenAICompatibleModel `json:"models,omitempty"`
	StatusCode   int                     `json:"statusCode,omitempty"`
	Message      string                  `json:"message,omitempty"`
	ResponseBody string                  `json:"responseBody,omitempty"`
}

func (a *App) ListOpenAICompatibleProviders() ([]OpenAICompatibleProvider, error) {
	items, err := a.managementClient().ListOpenAICompatibleProviders()
	if err != nil {
		return nil, err
	}

	providers := make([]OpenAICompatibleProvider, 0, len(items))
	for _, item := range items {
		apiKey := ""
		apiKeys := make([]string, 0, len(item.APIKeyEntries))
		models := make([]OpenAICompatibleModel, 0, len(item.Models))
		if len(item.APIKeyEntries) > 0 {
			apiKey = strings.TrimSpace(item.APIKeyEntries[0].APIKey)
		}
		for _, entry := range item.APIKeyEntries {
			trimmedAPIKey := strings.TrimSpace(entry.APIKey)
			if trimmedAPIKey == "" {
				continue
			}
			apiKeys = append(apiKeys, trimmedAPIKey)
		}
		for _, model := range item.Models {
			trimmedName := strings.TrimSpace(model.Name)
			if trimmedName == "" {
				continue
			}
			models = append(models, OpenAICompatibleModel{
				Name:  trimmedName,
				Alias: strings.TrimSpace(model.Alias),
			})
		}
		providers = append(providers, OpenAICompatibleProvider{
			Name:       strings.TrimSpace(item.Name),
			Priority:   item.Priority,
			Disabled:   item.Disabled,
			BaseURL:    strings.TrimSpace(item.BaseURL),
			Prefix:     strings.TrimSpace(item.Prefix),
			APIKey:     apiKey,
			APIKeys:    apiKeys,
			Models:     models,
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
		Name:     name,
		BaseURL:  baseURL,
		Prefix:   prefix,
		Priority: 0,
		Disabled: false,
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
	apiKeys := normalizeProviderAPIKeys(append([]string{apiKey}, input.APIKeys...))
	models := normalizeProviderModels(input.Models)

	switch {
	case currentName == "":
		return errors.New("current name 不能为空")
	case name == "":
		return errors.New("name 不能为空")
	case baseURL == "":
		return errors.New("base url 不能为空")
	case len(apiKeys) == 0:
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
	target.Headers = normalizeVerifyHeaders(input.Headers)
	target.Models = make([]cliproxyapi.OpenAICompatibleModel, 0, len(models))
	for _, model := range models {
		target.Models = append(target.Models, cliproxyapi.OpenAICompatibleModel{
			Name:  model.Name,
			Alias: model.Alias,
		})
	}
	target.APIKeyEntries = make([]cliproxyapi.OpenAICompatibleAPIKeyEntry, 0, len(apiKeys))
	for index, item := range apiKeys {
		entry := cliproxyapi.OpenAICompatibleAPIKeyEntry{APIKey: item}
		if index < len(current[targetIndex].APIKeyEntries) {
			entry.ProxyURL = strings.TrimSpace(current[targetIndex].APIKeyEntries[index].ProxyURL)
		}
		target.APIKeyEntries = append(target.APIKeyEntries, entry)
	}
	current[targetIndex] = target

	return a.managementClient().PutOpenAICompatibleProviders(current)
}

func (a *App) UpdateOpenAICompatibleProviderPriority(name string, priority int) error {
	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		return errors.New("provider name 不能为空")
	}

	current, err := a.managementClient().ListOpenAICompatibleProviders()
	if err != nil {
		return err
	}

	found := false
	for index := range current {
		if !strings.EqualFold(strings.TrimSpace(current[index].Name), trimmedName) {
			continue
		}
		current[index].Priority = priority
		found = true
		break
	}

	if !found {
		return errors.New("provider 不存在")
	}

	return a.managementClient().PutOpenAICompatibleProviders(current)
}

func (a *App) SetOpenAICompatibleProviderStatus(name string, disabled bool) error {
	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		return errors.New("provider name 不能为空")
	}

	current, err := a.managementClient().ListOpenAICompatibleProviders()
	if err != nil {
		return err
	}

	found := false
	for index := range current {
		if !strings.EqualFold(strings.TrimSpace(current[index].Name), trimmedName) {
			continue
		}
		current[index].Disabled = disabled
		found = true
		break
	}

	if !found {
		return errors.New("provider 不存在")
	}

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

func (a *App) FetchOpenAICompatibleProviderModels(input FetchOpenAICompatibleProviderModelsInput) (*FetchOpenAICompatibleProviderModelsResult, error) {
	baseURL := strings.TrimSpace(input.BaseURL)
	apiKey := strings.TrimSpace(input.APIKey)

	switch {
	case baseURL == "":
		return nil, errors.New("base url 不能为空")
	case apiKey == "":
		return nil, errors.New("api key 不能为空")
	}

	requestHeaders := normalizeVerifyHeaders(input.Headers)
	if _, ok := requestHeaders["Authorization"]; !ok {
		requestHeaders["Authorization"] = "Bearer " + apiKey
	}

	requestPayload, err := json.Marshal(managementAPICallRequest{
		Method: http.MethodGet,
		URL:    buildOpenAICompatibleModelsURL(baseURL),
		Header: requestHeaders,
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
	models, parseErr := parseOpenAICompatibleModelsResponse(apiResponse.Body)
	if parseErr != nil && finalStatusCode >= 200 && finalStatusCode < 300 {
		return nil, parseErr
	}
	message := "模型拉取失败"
	if finalStatusCode >= 200 && finalStatusCode < 300 {
		message = "已拉取模型列表"
	}

	return &FetchOpenAICompatibleProviderModelsResult{
		Models:       models,
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

func buildOpenAICompatibleModelsURL(baseURL string) string {
	trimmed := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if strings.HasSuffix(trimmed, "/models") {
		return trimmed
	}
	return trimmed + "/models"
}

func parseOpenAICompatibleModelsResponse(body string) ([]OpenAICompatibleModel, error) {
	type remoteModelItem struct {
		ID                       string   `json:"id"`
		Name                     string   `json:"name"`
		Slug                     string   `json:"slug"`
		SupportedReasoningLevels []string `json:"supported_reasoning_levels"`
		DefaultReasoningLevel    string   `json:"default_reasoning_level"`
	}
	var payload struct {
		Data   []remoteModelItem `json:"data"`
		Models []remoteModelItem `json:"models"`
	}
	if err := json.Unmarshal([]byte(strings.TrimSpace(body)), &payload); err != nil {
		return nil, err
	}

	items := payload.Data
	if len(items) == 0 {
		items = payload.Models
	}
	models := make([]OpenAICompatibleModel, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		name := strings.TrimSpace(item.ID)
		if name == "" {
			name = strings.TrimSpace(item.Slug)
		}
		if name == "" {
			name = strings.TrimSpace(item.Name)
		}
		if name == "" {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		models = append(models, OpenAICompatibleModel{
			Name:                      name,
			SupportedReasoningEfforts: normalizeReasoningEfforts(item.SupportedReasoningLevels),
			DefaultReasoningEffort:    normalizeReasoningEffort(item.DefaultReasoningLevel),
		})
	}
	if len(models) == 0 {
		return nil, errors.New("未解析到任何模型")
	}
	return models, nil
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

func normalizeProviderAPIKeys(items []string) []string {
	normalized := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		trimmed := strings.TrimSpace(item)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	return normalized
}

func normalizeProviderModels(items []OpenAICompatibleModel) []OpenAICompatibleModel {
	normalized := make([]OpenAICompatibleModel, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		name := strings.TrimSpace(item.Name)
		if name == "" {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		normalized = append(normalized, OpenAICompatibleModel{
			Name:                      name,
			Alias:                     strings.TrimSpace(item.Alias),
			SupportedReasoningEfforts: normalizeReasoningEfforts(item.SupportedReasoningEfforts),
			DefaultReasoningEffort:    normalizeReasoningEffort(item.DefaultReasoningEffort),
		})
	}
	return normalized
}

func normalizeReasoningEfforts(items []string) []string {
	normalized := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		effort := normalizeReasoningEffort(item)
		if effort == "" {
			continue
		}
		if _, ok := seen[effort]; ok {
			continue
		}
		seen[effort] = struct{}{}
		normalized = append(normalized, effort)
	}
	return normalized
}

func normalizeReasoningEffort(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "none", "minimal", "low", "medium", "high", "xhigh":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return ""
	}
}
