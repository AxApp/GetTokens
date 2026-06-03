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
	AccountKey     string                  `json:"accountKey,omitempty"`
	Name           string                  `json:"name"`
	Priority       int                     `json:"priority,omitempty"`
	Disabled       bool                    `json:"disabled,omitempty"`
	BaseURL        string                  `json:"baseUrl"`
	Prefix         string                  `json:"prefix,omitempty"`
	ProxyURL       string                  `json:"proxyUrl,omitempty"`
	APIKey         string                  `json:"apiKey"`
	APIKeys        []string                `json:"apiKeys,omitempty"`
	Models         []OpenAICompatibleModel `json:"models,omitempty"`
	Headers        map[string]string       `json:"headers,omitempty"`
	FormatBaseURLs map[string]string       `json:"formatBaseUrls,omitempty"`
	KeyCount       int                     `json:"keyCount,omitempty"`
	ModelCount     int                     `json:"modelCount,omitempty"`
	HasHeaders     bool                    `json:"hasHeaders,omitempty"`
}

type OpenAICompatibleModel struct {
	Name                      string   `json:"name"`
	Alias                     string   `json:"alias,omitempty"`
	SupportedReasoningEfforts []string `json:"supportedReasoningEfforts,omitempty"`
	DefaultReasoningEffort    string   `json:"defaultReasoningEffort,omitempty"`
}

type CreateOpenAICompatibleProviderInput struct {
	Name           string                  `json:"name"`
	BaseURL        string                  `json:"baseUrl"`
	Prefix         string                  `json:"prefix,omitempty"`
	APIKey         string                  `json:"apiKey"`
	FormatBaseURLs map[string]string       `json:"formatBaseUrls,omitempty"`
	Models         []OpenAICompatibleModel `json:"models,omitempty"`
}

type UpdateOpenAICompatibleProviderInput struct {
	CurrentName string                  `json:"currentName"`
	Name        string                  `json:"name"`
	BaseURL     string                  `json:"baseUrl"`
	Prefix      string                  `json:"prefix,omitempty"`
	ProxyURL    *string                 `json:"proxyUrl,omitempty"`
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
	accounts, err := a.managementClient().ListAccounts()
	if err != nil {
		return nil, err
	}
	providers := make([]OpenAICompatibleProvider, 0, len(accounts))
	for _, account := range accounts {
		if account.Kind != cliproxyapi.AccountKindOpenAICompatible {
			continue
		}
		providers = append(providers, openAICompatibleProviderFromUnifiedAccount(account))
	}
	return providers, nil
}

func (a *App) CreateOpenAICompatibleProvider(input CreateOpenAICompatibleProviderInput) error {
	name := strings.TrimSpace(input.Name)
	baseURL := strings.TrimSpace(input.BaseURL)
	apiKey := strings.TrimSpace(input.APIKey)

	switch {
	case name == "":
		return errors.New("name 不能为空")
	case baseURL == "":
		return errors.New("base url 不能为空")
	case apiKey == "":
		return errors.New("api key 不能为空")
	}

	if err := a.ensureOpenAICompatibleProviderNameAvailable(name, ""); err != nil {
		return err
	}
	models := normalizeProviderModels(input.Models)
	nextModels := make([]cliproxyapi.OpenAICompatibleModel, 0, len(models))
	for _, model := range models {
		nextModels = append(nextModels, cliproxyapi.OpenAICompatibleModel{Name: model.Name, Alias: model.Alias})
	}
	_, err := a.managementClient().CreateAccount(openAICompatibleAccountWrite(
		name,
		name,
		0,
		false,
		baseURL,
		strings.TrimSpace(input.Prefix),
		[]cliproxyapi.OpenAICompatibleAPIKeyEntry{{APIKey: apiKey}},
		nil,
		normalizeFormatBaseURLs(input.FormatBaseURLs),
		nextModels,
	))
	return err
}

func (a *App) DeleteOpenAICompatibleProvider(name string) error {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return errors.New("name 不能为空")
	}
	account, err := a.findOpenAICompatibleAccount(trimmed)
	if err != nil {
		return err
	}
	return a.managementClient().DeleteAccount(account.AccountKey)
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

	target, err := a.findOpenAICompatibleAccount(currentName)
	if err != nil {
		return err
	}
	if target.OpenAICompatible == nil {
		return errors.New("provider 不存在")
	}
	if err := a.ensureOpenAICompatibleProviderNameAvailable(name, target.AccountKey); err != nil {
		return err
	}

	nextModels := make([]cliproxyapi.OpenAICompatibleModel, 0, len(models))
	for _, model := range models {
		nextModels = append(nextModels, cliproxyapi.OpenAICompatibleModel{
			Name:  model.Name,
			Alias: model.Alias,
		})
	}
	previous := unifiedOpenAICompatibleProvider(*target)
	entries := make([]cliproxyapi.OpenAICompatibleAPIKeyEntry, 0, len(apiKeys))
	for index, item := range apiKeys {
		entry := cliproxyapi.OpenAICompatibleAPIKeyEntry{APIKey: item}
		if index == 0 && input.ProxyURL != nil {
			entry.ProxyURL = strings.TrimSpace(*input.ProxyURL)
		} else if index < len(previous.APIKeyEntries) {
			entry.ProxyURL = strings.TrimSpace(previous.APIKeyEntries[index].ProxyURL)
		}
		entries = append(entries, entry)
	}

	title := strings.TrimSpace(target.Title)
	if title == "" || strings.EqualFold(title, strings.TrimSpace(target.Provider)) || strings.EqualFold(title, strings.TrimSpace(target.OpenAICompatible.ProviderName)) {
		title = name
	}
	_, err = a.managementClient().PatchAccount(target.AccountKey, openAICompatibleAccountWrite(
		title,
		name,
		target.Priority,
		target.Disabled,
		baseURL,
		prefix,
		entries,
		normalizeVerifyHeaders(input.Headers),
		parseStringMapJSON(target.OpenAICompatible.FormatBaseURLsJSON),
		nextModels,
	))
	return err
}

func (a *App) UpdateOpenAICompatibleProviderPriority(name string, priority int) error {
	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		return errors.New("provider name 不能为空")
	}
	account, err := a.findOpenAICompatibleAccount(trimmedName)
	if err != nil {
		return err
	}
	_, err = a.managementClient().PatchAccountPriority(account.AccountKey, priority)
	return err
}

func (a *App) SetOpenAICompatibleProviderStatus(name string, disabled bool) error {
	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		return errors.New("provider name 不能为空")
	}
	account, err := a.findOpenAICompatibleAccount(trimmedName)
	if err != nil {
		return err
	}
	_, err = a.managementClient().PatchAccountStatus(account.AccountKey, disabled)
	return err
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
		alias := strings.TrimSpace(item.Alias)
		if name == "" {
			continue
		}
		key := name + "\x00" + alias
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		normalized = append(normalized, OpenAICompatibleModel{
			Name:                      name,
			Alias:                     alias,
			SupportedReasoningEfforts: normalizeReasoningEfforts(item.SupportedReasoningEfforts),
			DefaultReasoningEffort:    normalizeReasoningEffort(item.DefaultReasoningEffort),
		})
	}
	return normalized
}

func (a *App) findOpenAICompatibleAccount(name string) (*cliproxyapi.UnifiedAccount, error) {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return nil, errors.New("provider name 不能为空")
	}
	if isUnifiedAccountID(trimmed) {
		account, err := a.managementClient().GetAccount(trimmed)
		if err != nil {
			return nil, err
		}
		if account == nil || account.Kind != cliproxyapi.AccountKindOpenAICompatible {
			return nil, errors.New("provider 不存在")
		}
		return account, nil
	}
	accounts, err := a.managementClient().ListAccounts()
	if err != nil {
		return nil, err
	}
	for index := range accounts {
		account := accounts[index]
		if account.Kind != cliproxyapi.AccountKindOpenAICompatible {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(account.Provider), trimmed) {
			return &accounts[index], nil
		}
		if account.OpenAICompatible != nil && strings.EqualFold(strings.TrimSpace(account.OpenAICompatible.ProviderName), trimmed) {
			return &accounts[index], nil
		}
	}
	return nil, errors.New("provider 不存在")
}

func openAICompatibleProviderFromSidecarConfig(item cliproxyapi.OpenAICompatibleProvider) OpenAICompatibleProvider {
	apiKey := ""
	proxyURL := ""
	apiKeys := make([]string, 0, len(item.APIKeyEntries))
	models := make([]OpenAICompatibleModel, 0, len(item.Models))
	if len(item.APIKeyEntries) > 0 {
		apiKey = strings.TrimSpace(item.APIKeyEntries[0].APIKey)
		proxyURL = strings.TrimSpace(item.APIKeyEntries[0].ProxyURL)
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
	return OpenAICompatibleProvider{
		Name:           strings.TrimSpace(item.Name),
		Priority:       item.Priority,
		Disabled:       item.Disabled,
		BaseURL:        strings.TrimSpace(item.BaseURL),
		Prefix:         strings.TrimSpace(item.Prefix),
		ProxyURL:       proxyURL,
		APIKey:         apiKey,
		APIKeys:        apiKeys,
		Models:         models,
		Headers:        cloneHeaders(item.Headers),
		FormatBaseURLs: cloneHeaders(item.FormatBaseURLs),
		KeyCount:       len(item.APIKeyEntries),
		ModelCount:     len(item.Models),
		HasHeaders:     len(item.Headers) > 0,
	}
}

func unifiedOpenAICompatibleProvider(account cliproxyapi.UnifiedAccount) cliproxyapi.OpenAICompatibleProvider {
	provider := cliproxyapi.OpenAICompatibleProvider{
		Name:     strings.TrimSpace(account.Provider),
		Priority: account.Priority,
		Disabled: account.Disabled,
	}
	if account.OpenAICompatible == nil {
		return provider
	}
	if name := strings.TrimSpace(account.OpenAICompatible.ProviderName); name != "" {
		provider.Name = name
	}
	provider.BaseURL = strings.TrimSpace(account.OpenAICompatible.BaseURL)
	provider.Prefix = strings.TrimSpace(account.OpenAICompatible.Prefix)
	_ = json.Unmarshal([]byte(strings.TrimSpace(account.OpenAICompatible.APIKeyEntriesJSON)), &provider.APIKeyEntries)
	_ = json.Unmarshal([]byte(strings.TrimSpace(account.OpenAICompatible.HeadersJSON)), &provider.Headers)
	_ = json.Unmarshal([]byte(strings.TrimSpace(account.OpenAICompatible.FormatBaseURLsJSON)), &provider.FormatBaseURLs)
	_ = json.Unmarshal([]byte(strings.TrimSpace(account.OpenAICompatible.ModelsJSON)), &provider.Models)
	return provider
}

func openAICompatibleProviderFromUnifiedAccount(account cliproxyapi.UnifiedAccount) OpenAICompatibleProvider {
	provider := openAICompatibleProviderFromSidecarConfig(unifiedOpenAICompatibleProvider(account))
	provider.AccountKey = strings.TrimSpace(account.AccountKey)
	return provider
}

func (a *App) ensureOpenAICompatibleProviderNameAvailable(name string, exceptAccountKey string) error {
	trimmedName := strings.TrimSpace(name)
	accounts, err := a.managementClient().ListAccounts()
	if err != nil {
		return err
	}
	for _, account := range accounts {
		if account.Kind != cliproxyapi.AccountKindOpenAICompatible {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(account.AccountKey), strings.TrimSpace(exceptAccountKey)) {
			continue
		}
		providerName := strings.TrimSpace(account.Provider)
		if account.OpenAICompatible != nil && strings.TrimSpace(account.OpenAICompatible.ProviderName) != "" {
			providerName = strings.TrimSpace(account.OpenAICompatible.ProviderName)
		}
		if strings.EqualFold(providerName, trimmedName) {
			return errors.New("provider name 已存在")
		}
	}
	return nil
}

func openAICompatibleAccountWrite(
	title string,
	name string,
	priority int,
	disabled bool,
	baseURL string,
	prefix string,
	entries []cliproxyapi.OpenAICompatibleAPIKeyEntry,
	headers map[string]string,
	formatBaseURLs map[string]string,
	models []cliproxyapi.OpenAICompatibleModel,
) cliproxyapi.AccountWriteRequest {
	trimmedName := strings.TrimSpace(name)
	return cliproxyapi.AccountWriteRequest{
		Kind:     cliproxyapi.AccountKindOpenAICompatible,
		Title:    strings.TrimSpace(title),
		Provider: trimmedName,
		Priority: priority,
		Disabled: disabled,
		OpenAICompatible: &cliproxyapi.OpenAICompatibleAccountCredential{
			ProviderName:       trimmedName,
			RuntimeProviderKey: "",
			BaseURL:            strings.TrimSpace(baseURL),
			Prefix:             strings.TrimSpace(prefix),
			APIKeyEntriesJSON:  mustJSONString(entries),
			HeadersJSON:        mustJSONString(headers),
			FormatBaseURLsJSON: mustJSONString(formatBaseURLs),
			ModelsJSON:         mustJSONString(models),
		},
	}
}

func normalizeFormatBaseURLs(items map[string]string) map[string]string {
	if len(items) == 0 {
		return nil
	}
	out := make(map[string]string, len(items))
	for key, value := range items {
		trimmedKey := strings.TrimSpace(key)
		trimmedValue := strings.TrimSpace(value)
		if trimmedKey == "" || trimmedValue == "" {
			continue
		}
		out[trimmedKey] = trimmedValue
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func parseStringMapJSON(raw string) map[string]string {
	var values map[string]string
	if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &values); err != nil {
		return nil
	}
	return normalizeFormatBaseURLs(values)
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
