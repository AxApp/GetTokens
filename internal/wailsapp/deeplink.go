package wailsapp

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"path/filepath"
	"strings"
)

const (
	deepLinkChannelCodex = "codex"

	deepLinkResourceAccount     = "account"
	deepLinkResourceCodexConfig = "codex-config"
	deepLinkResourceCodexSetup  = "codex-setup"

	deepLinkProviderScopeCurrentActive = "current-active"
	deepLinkProviderScopeCreateNew     = "create-new"
)

type DeepLinkImportRequest struct {
	RawURL      string                  `json:"rawURL,omitempty"`
	RedactedURL string                  `json:"redactedURL,omitempty"`
	Channel     string                  `json:"channel"`
	Version     string                  `json:"version"`
	Resource    string                  `json:"resource"`
	Source      string                  `json:"source,omitempty"`
	Nonce       string                  `json:"nonce,omitempty"`
	Apply       bool                    `json:"apply,omitempty"`
	Enabled     bool                    `json:"enabled,omitempty"`
	Account     *DeepLinkAccountDraft   `json:"account,omitempty"`
	CodexConfig *DeepLinkCodexConfig    `json:"codexConfig,omitempty"`
	Documents   []DeepLinkDocumentPatch `json:"documents,omitempty"`
}

type DeepLinkAccountDraft struct {
	AccountType    string                  `json:"accountType"`
	Name           string                  `json:"name,omitempty"`
	Label          string                  `json:"label,omitempty"`
	APIKey         string                  `json:"apiKey,omitempty"`
	APIKeys        []string                `json:"apiKeys,omitempty"`
	BaseURL        string                  `json:"baseUrl,omitempty"`
	Prefix         string                  `json:"prefix,omitempty"`
	ProxyURL       string                  `json:"proxyUrl,omitempty"`
	Models         []OpenAICompatibleModel `json:"models,omitempty"`
	FormatBaseURLs map[string]string       `json:"formatBaseUrls,omitempty"`
	QuotaCurl      string                  `json:"quotaCurl,omitempty"`
	QuotaEnabled   bool                    `json:"quotaEnabled,omitempty"`
	BillingCurl    string                  `json:"billingCurl,omitempty"`
	BillingEnabled bool                    `json:"billingEnabled,omitempty"`
	AuthFileName   string                  `json:"authFileName,omitempty"`
	AuthFileJSON   string                  `json:"authFileJSON,omitempty"`
	Enabled        bool                    `json:"enabled,omitempty"`
}

type DeepLinkCodexConfig struct {
	Mode                  string `json:"mode"`
	AccountRef            string `json:"accountRef,omitempty"`
	Model                 string `json:"model,omitempty"`
	ModelSet              bool   `json:"modelSet,omitempty"`
	ReasoningEffort       string `json:"reasoningEffort,omitempty"`
	ReasoningEffortSet    bool   `json:"reasoningEffortSet,omitempty"`
	ProviderID            string `json:"providerID,omitempty"`
	ProviderIDSet         bool   `json:"providerIDSet,omitempty"`
	ProviderName          string `json:"providerName,omitempty"`
	ProviderNameSet       bool   `json:"providerNameSet,omitempty"`
	ProviderScope         string `json:"providerScope,omitempty"`
	BaseURL               string `json:"baseUrl,omitempty"`
	BaseURLSet            bool   `json:"baseUrlSet,omitempty"`
	APIKey                string `json:"apiKey,omitempty"`
	APIKeySet             bool   `json:"apiKeySet,omitempty"`
	RequiresOpenAIAuth    bool   `json:"requiresOpenAIAuth,omitempty"`
	RequiresOpenAIAuthSet bool   `json:"requiresOpenAIAuthSet,omitempty"`
	WireAPI               string `json:"wireAPI,omitempty"`
	WireAPISet            bool   `json:"wireAPISet,omitempty"`
	SupportsWebsockets    bool   `json:"supportsWebsockets,omitempty"`
	SupportsWebsocketsSet bool   `json:"supportsWebsocketsSet,omitempty"`
	Apply                 bool   `json:"apply,omitempty"`
	AuthFileContentBase64 string `json:"authFileContentBase64,omitempty"`
	AuthFileContentSet    bool   `json:"authFileContentSet,omitempty"`
}

type DeepLinkDocumentPatch struct {
	Target          string                     `json:"target"`
	Format          string                     `json:"format"`
	Mode            string                     `json:"mode,omitempty"`
	Operations      []DeepLinkPatchOperation   `json:"operations,omitempty"`
	PreserveUnknown *bool                      `json:"preserveUnknown,omitempty"`
	Backup          *bool                      `json:"backup,omitempty"`
	Raw             map[string]json.RawMessage `json:"-"`
}

type DeepLinkPatchOperation struct {
	Op            string          `json:"op"`
	Path          string          `json:"path"`
	Value         json.RawMessage `json:"value,omitempty"`
	ValueEncoding string          `json:"valueEncoding,omitempty"`
	AllowCreate   *bool           `json:"allowCreate,omitempty"`
}

type DeepLinkImportPreview struct {
	Request               DeepLinkImportRequest   `json:"request"`
	RedactedURL           string                  `json:"redactedURL"`
	Resource              string                  `json:"resource"`
	Source                string                  `json:"source,omitempty"`
	AccountSummary        *DeepLinkAccountSummary `json:"accountSummary,omitempty"`
	ProviderScope         string                  `json:"providerScope,omitempty"`
	ProviderRewriteMode   string                  `json:"providerRewriteMode,omitempty"`
	ProviderCompatibility string                  `json:"providerCompatibility,omitempty"`
	EffectiveProviderID   string                  `json:"effectiveProviderID,omitempty"`
	EffectiveProviderName string                  `json:"effectiveProviderName,omitempty"`
	AuthJSONPreview       string                  `json:"authJSONPreview,omitempty"`
	ConfigTomlPreview     string                  `json:"configTomlPreview,omitempty"`
	LocalApplyInput       *RelayLocalApplyInput   `json:"localApplyInput,omitempty"`
	Warnings              []string                `json:"warnings,omitempty"`
	BlockingWarnings      []string                `json:"blockingWarnings,omitempty"`
}

type DeepLinkAccountSummary struct {
	AccountType   string `json:"accountType"`
	Title         string `json:"title"`
	BaseURL       string `json:"baseUrl,omitempty"`
	APIKeyPreview string `json:"apiKeyPreview,omitempty"`
}

type DeepLinkApplyResult struct {
	Status             string                 `json:"status"`
	AccountApplied     bool                   `json:"accountApplied,omitempty"`
	CodexConfigApplied bool                   `json:"codexConfigApplied,omitempty"`
	AccountError       string                 `json:"accountError,omitempty"`
	CodexConfigError   string                 `json:"codexConfigError,omitempty"`
	LocalApplyResult   *RelayLocalApplyResult `json:"localApplyResult,omitempty"`
}

type deepLinkConfigEnvelope struct {
	Account     *DeepLinkAccountDraft   `json:"account,omitempty"`
	CodexConfig *DeepLinkCodexConfig    `json:"codexConfig,omitempty"`
	Documents   []DeepLinkDocumentPatch `json:"documents,omitempty"`
}

func (a *App) ParseDeepLink(rawURL string) (*DeepLinkImportRequest, error) {
	request, err := ParseDeepLinkImportURL(rawURL)
	if err != nil {
		return nil, err
	}
	return &request, nil
}

func (a *App) PreviewDeepLinkImport(rawURL string) (*DeepLinkImportPreview, error) {
	return PreviewDeepLinkImportURL(rawURL)
}

func (a *App) ApplyDeepLinkImportURL(rawURL string) (*DeepLinkApplyResult, error) {
	request, err := ParseDeepLinkImportURL(rawURL)
	if err != nil {
		return nil, err
	}
	return a.ApplyDeepLinkImport(request)
}

func (a *App) ApplyDeepLinkImport(request DeepLinkImportRequest) (*DeepLinkApplyResult, error) {
	result := &DeepLinkApplyResult{Status: "noop"}
	if request.Resource == deepLinkResourceAccount || request.Resource == deepLinkResourceCodexSetup {
		if request.Account == nil {
			return nil, errors.New("缺少账号导入草稿")
		}
		if err := a.applyDeepLinkAccount(*request.Account, request.Documents); err != nil {
			result.AccountError = err.Error()
			result.Status = "failed"
			return result, nil
		}
		result.AccountApplied = true
		result.Status = "account-applied"
	}

	if request.Resource == deepLinkResourceCodexConfig || request.Resource == deepLinkResourceCodexSetup {
		input, err := buildDeepLinkLocalApplyInput(request)
		if err != nil {
			result.CodexConfigError = err.Error()
			if result.AccountApplied {
				result.Status = "partial"
				return result, nil
			}
			result.Status = "failed"
			return result, nil
		}
		localResult, err := a.ApplyRelayServiceConfigToLocalV2(input)
		if err != nil {
			result.CodexConfigError = err.Error()
			if result.AccountApplied {
				result.Status = "partial"
				return result, nil
			}
			result.Status = "failed"
			return result, nil
		}
		result.CodexConfigApplied = true
		result.LocalApplyResult = localResult
		if result.AccountApplied {
			result.Status = "applied"
		} else {
			result.Status = "codex-config-applied"
		}
	}

	return result, nil
}

func ParseDeepLinkImportURL(rawURL string) (DeepLinkImportRequest, error) {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return DeepLinkImportRequest{}, errors.New("deep link 不能为空")
	}
	parsed, err := url.Parse(trimmed)
	if err != nil {
		return DeepLinkImportRequest{}, fmt.Errorf("deep link URL 无效: %w", err)
	}
	if parsed.Scheme != "gettokens" {
		return DeepLinkImportRequest{}, errors.New("deep link scheme 必须是 gettokens")
	}
	version := strings.Trim(strings.TrimSpace(parsed.Host), "/")
	if version == "" {
		version = "v1"
	}
	action := strings.Trim(parsed.Path, "/")
	if action != "import" {
		return DeepLinkImportRequest{}, errors.New("deep link path 必须是 /import")
	}

	query := parsed.Query()
	if err := rejectUnsupportedDeepLinkQuery(query); err != nil {
		return DeepLinkImportRequest{}, err
	}

	request := DeepLinkImportRequest{
		RawURL:      trimmed,
		RedactedURL: redactDeepLinkURL(trimmed),
		Version:     version,
		Channel:     strings.TrimSpace(query.Get("channel")),
		Resource:    strings.TrimSpace(query.Get("resource")),
		Source:      strings.TrimSpace(query.Get("source")),
		Nonce:       strings.TrimSpace(query.Get("nonce")),
		Apply:       parseDeepLinkBool(query.Get("apply")),
		Enabled:     parseDeepLinkBool(query.Get("enabled")),
	}
	if request.Channel != deepLinkChannelCodex {
		return DeepLinkImportRequest{}, errors.New("deep link 必须显式指定 channel=codex")
	}
	if !isSupportedDeepLinkResource(request.Resource) {
		return DeepLinkImportRequest{}, errors.New("resource 只支持 account / codex-config / codex-setup")
	}

	if encoded := strings.TrimSpace(query.Get("config")); encoded != "" {
		envelope, err := decodeDeepLinkConfig(encoded)
		if err != nil {
			return DeepLinkImportRequest{}, err
		}
		request.Account = envelope.Account
		request.CodexConfig = envelope.CodexConfig
		request.Documents = envelope.Documents
	}

	applyDeepLinkQueryOverrides(&request, query)
	if err := normalizeDeepLinkRequest(&request); err != nil {
		return DeepLinkImportRequest{}, err
	}
	return request, nil
}

func PreviewDeepLinkImportURL(rawURL string) (*DeepLinkImportPreview, error) {
	request, err := ParseDeepLinkImportURL(rawURL)
	if err != nil {
		return nil, err
	}
	return PreviewDeepLinkImportRequest(request)
}

func PreviewDeepLinkImportRequest(request DeepLinkImportRequest) (*DeepLinkImportPreview, error) {
	preview := &DeepLinkImportPreview{
		Request:     request,
		RedactedURL: request.RedactedURL,
		Resource:    request.Resource,
		Source:      request.Source,
	}
	if request.Account != nil {
		preview.AccountSummary = summarizeDeepLinkAccount(*request.Account)
	}
	if request.Resource != deepLinkResourceCodexConfig && request.Resource != deepLinkResourceCodexSetup {
		return preview, nil
	}

	input, err := buildDeepLinkLocalApplyInput(request)
	if err != nil {
		return nil, err
	}
	state, err := readDeepLinkLocalProviderState()
	if err != nil {
		return nil, err
	}
	authState, err := getLocalCodexAuthState()
	if err != nil {
		return nil, err
	}

	providerScope := normalizeDeepLinkProviderScope(request.CodexConfig.ProviderScope)
	effectiveProviderID := input.ProviderID
	effectiveProviderName := input.ProviderName
	rewriteMode := "create-new"
	compatibility := "compatible"
	if state.HasExplicitCurrentProvider && strings.TrimSpace(state.CurrentProviderID) != "" {
		effectiveProviderID = state.CurrentProviderID
		effectiveProviderName = state.CurrentProviderName
		rewriteMode = "patch-current"
	} else if providerScope == deepLinkProviderScopeCurrentActive {
		rewriteMode = "create-new"
		preview.Warnings = append(preview.Warnings, "当前没有显式 model_provider，将按 deep link providerID 创建新 provider")
	}
	if input.AuthStrategy == relayLocalAuthStrategyPreserveChatGPTAuth {
		if effectiveProviderID == relayCodexOpenAIProviderID {
			compatibility = "blocked_builtin_openai"
			preview.BlockingWarnings = append(preview.BlockingWarnings, "preserve-chatgpt-provider 不支持内置 openai provider")
		}
		if !authState.CanPreserveChatGPTAuth {
			compatibility = "missing_chatgpt_auth"
			preview.BlockingWarnings = append(preview.BlockingWarnings, "当前本地 auth.json 不是可保留的 ChatGPT 登录态")
		}
	}
	if state.HasExplicitCurrentProvider && !state.CurrentProviderExists {
		compatibility = "missing_provider_section"
		preview.Warnings = append(preview.Warnings, "当前 model_provider 缺少 provider section，应用时将补齐当前 section")
	}

	preview.ProviderScope = providerScope
	preview.ProviderRewriteMode = rewriteMode
	preview.ProviderCompatibility = compatibility
	preview.EffectiveProviderID = effectiveProviderID
	preview.EffectiveProviderName = effectiveProviderName

	redactedInput := input
	redactedInput.APIKey = redactSecret(input.APIKey)
	authPreview, err := buildDeepLinkAuthPreview(redactedInput)
	if err != nil {
		return nil, err
	}
	preview.AuthJSONPreview = authPreview

	existingConfig, err := readDeepLinkLocalConfigToml()
	if err != nil {
		return nil, err
	}
	preview.ConfigTomlPreview = mergeRelayCodexConfigToml(existingConfig, redactedInput)
	localApplyInput := input
	localApplyInput.APIKey = redactSecret(localApplyInput.APIKey)
	localApplyInput.AuthFileContentBase64 = redactSecret(localApplyInput.AuthFileContentBase64)
	preview.LocalApplyInput = &localApplyInput
	return preview, nil
}

func (a *App) applyDeepLinkAccount(account DeepLinkAccountDraft, documents []DeepLinkDocumentPatch) error {
	switch account.AccountType {
	case "codex-api-key":
		return a.CreateCodexAPIKey(CreateCodexAPIKeyInput{
			APIKey:         account.APIKey,
			Label:          account.Label,
			BaseURL:        account.BaseURL,
			FormatBaseURLs: account.FormatBaseURLs,
			Prefix:         account.Prefix,
			ProxyURL:       account.ProxyURL,
			Models:         account.Models,
			QuotaCurl:      account.QuotaCurl,
			QuotaEnabled:   account.QuotaEnabled,
			BillingCurl:    account.BillingCurl,
			BillingEnabled: account.BillingEnabled,
		})
	case "openai-compatible":
		return a.CreateOpenAICompatibleProvider(CreateOpenAICompatibleProviderInput{
			Name:    firstNonEmpty(account.Name, account.Label),
			BaseURL: account.BaseURL,
			Prefix:  account.Prefix,
			APIKey:  account.APIKey,
		})
	case "auth-file":
		name := firstNonEmpty(account.AuthFileName, account.Name)
		content := strings.TrimSpace(account.AuthFileJSON)
		if content == "" {
			body, err := buildAuthJSONFromDeepLinkDocuments(documents)
			if err != nil {
				return err
			}
			content = string(body)
		}
		return a.UploadAuthFiles([]UploadFilePayload{{
			Name:          filepath.Base(name),
			ContentBase64: base64.StdEncoding.EncodeToString([]byte(content)),
		}})
	default:
		return errors.New("不支持的账号类型")
	}
}

func buildDeepLinkLocalApplyInput(request DeepLinkImportRequest) (RelayLocalApplyInput, error) {
	if request.CodexConfig == nil {
		return RelayLocalApplyInput{}, errors.New("缺少 Codex 配置草稿")
	}
	config := request.CodexConfig
	authStrategy, err := deepLinkModeToAuthStrategy(config.Mode)
	if err != nil {
		return RelayLocalApplyInput{}, err
	}
	input := RelayLocalApplyInput{
		PreserveUnspecifiedFields: true,
		APIKey:                    strings.TrimSpace(config.APIKey),
		APIKeySet:                 config.APIKeySet,
		AuthFileContentBase64:     strings.TrimSpace(config.AuthFileContentBase64),
		AuthFileContentSet:        config.AuthFileContentSet,
		BaseURL:                   strings.TrimSpace(config.BaseURL),
		BaseURLSet:                config.BaseURLSet,
		Model:                     strings.TrimSpace(config.Model),
		ModelSet:                  config.ModelSet,
		ReasoningEffort:           strings.TrimSpace(config.ReasoningEffort),
		ReasoningEffortSet:        config.ReasoningEffortSet,
		ProviderID:                strings.TrimSpace(config.ProviderID),
		ProviderIDSet:             config.ProviderIDSet,
		ProviderName:              strings.TrimSpace(config.ProviderName),
		ProviderNameSet:           config.ProviderNameSet,
		RequiresOpenAIAuth:        config.RequiresOpenAIAuth,
		RequiresOpenAIAuthSet:     config.RequiresOpenAIAuthSet,
		WireAPI:                   strings.TrimSpace(config.WireAPI),
		WireAPISet:                config.WireAPISet,
		SupportsWebsockets:        config.SupportsWebsockets,
		SupportsWebsocketsSet:     config.SupportsWebsocketsSet,
		AuthStrategy:              authStrategy,
		SkipRelayKeyMetadata:      true,
	}
	if input.APIKey == "" && request.Account != nil {
		input.APIKey = strings.TrimSpace(request.Account.APIKey)
		input.APIKeySet = input.APIKey != ""
	}
	if input.BaseURL == "" && request.Account != nil {
		input.BaseURL = strings.TrimSpace(request.Account.BaseURL)
		input.BaseURLSet = input.BaseURL != ""
	}
	if input.ProviderID == "" && request.Account != nil {
		input.ProviderID = strings.TrimSpace(firstNonEmpty(request.Account.Name, request.Account.Label))
		input.ProviderIDSet = input.ProviderID != ""
	}
	if input.ProviderName == "" && request.Account != nil {
		input.ProviderName = strings.TrimSpace(firstNonEmpty(request.Account.Label, request.Account.Name))
		input.ProviderNameSet = input.ProviderName != ""
	}
	return normalizeRelayLocalApplyInput(input)
}

func decodeDeepLinkConfig(encoded string) (deepLinkConfigEnvelope, error) {
	body, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		if padded, paddedErr := base64.URLEncoding.DecodeString(encoded); paddedErr == nil {
			body = padded
		} else {
			return deepLinkConfigEnvelope{}, fmt.Errorf("config 不是有效 Base64URL JSON: %w", err)
		}
	}
	if len(body) > 32*1024 {
		return deepLinkConfigEnvelope{}, errors.New("config 超过 32KB，请改用文件导入")
	}
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(body, &raw); err != nil {
		return deepLinkConfigEnvelope{}, fmt.Errorf("config 不是有效 JSON: %w", err)
	}
	if err := rejectUnsupportedDeepLinkJSON(raw); err != nil {
		return deepLinkConfigEnvelope{}, err
	}
	var envelope deepLinkConfigEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		return deepLinkConfigEnvelope{}, fmt.Errorf("config 结构无效: %w", err)
	}
	if envelope.CodexConfig != nil {
		if codexRaw, ok := raw["codexConfig"]; ok {
			var codexObject map[string]json.RawMessage
			if json.Unmarshal(codexRaw, &codexObject) == nil {
				markDeepLinkCodexConfigFieldPresence(envelope.CodexConfig, codexObject)
			}
		}
	}
	return envelope, nil
}

func markDeepLinkCodexConfigFieldPresence(config *DeepLinkCodexConfig, raw map[string]json.RawMessage) {
	if _, exists := raw["apiKey"]; exists {
		config.APIKeySet = true
	}
	if _, exists := raw["authFileContentBase64"]; exists {
		config.AuthFileContentSet = true
	}
	if _, exists := raw["baseUrl"]; exists {
		config.BaseURLSet = true
	}
	if _, exists := raw["model"]; exists {
		config.ModelSet = true
	}
	if _, exists := raw["reasoningEffort"]; exists {
		config.ReasoningEffortSet = true
	}
	if _, exists := raw["providerID"]; exists {
		config.ProviderIDSet = true
	}
	if _, exists := raw["providerName"]; exists {
		config.ProviderNameSet = true
	}
	if _, exists := raw["requiresOpenAIAuth"]; exists {
		config.RequiresOpenAIAuthSet = true
	}
	if _, exists := raw["wireAPI"]; exists {
		config.WireAPISet = true
	}
	if _, exists := raw["supportsWebsockets"]; exists {
		config.SupportsWebsocketsSet = true
	}
}

func applyDeepLinkQueryOverrides(request *DeepLinkImportRequest, query url.Values) {
	if value := strings.TrimSpace(query.Get("source")); value != "" {
		request.Source = value
	}
	if value := strings.TrimSpace(query.Get("nonce")); value != "" {
		request.Nonce = value
	}
	if query.Has("apply") {
		request.Apply = parseDeepLinkBool(query.Get("apply"))
	}
	if query.Has("enabled") {
		request.Enabled = parseDeepLinkBool(query.Get("enabled"))
	}

	needsAccount := request.Resource == deepLinkResourceAccount || request.Resource == deepLinkResourceCodexSetup
	if needsAccount {
		if request.Account == nil {
			request.Account = &DeepLinkAccountDraft{}
		}
		applyDeepLinkAccountQueryOverrides(request.Account, query)
		request.Account.Enabled = request.Enabled
	}

	needsCodexConfig := request.Resource == deepLinkResourceCodexConfig || request.Resource == deepLinkResourceCodexSetup
	if needsCodexConfig {
		if request.CodexConfig == nil {
			request.CodexConfig = &DeepLinkCodexConfig{}
		}
		applyDeepLinkCodexConfigQueryOverrides(request.CodexConfig, query)
		request.CodexConfig.Apply = request.Apply
	}
}

func applyDeepLinkAccountQueryOverrides(account *DeepLinkAccountDraft, query url.Values) {
	setString := func(key string, target *string) {
		if value := strings.TrimSpace(query.Get(key)); value != "" {
			*target = value
		}
	}
	setString("accountType", &account.AccountType)
	setString("name", &account.Name)
	setString("label", &account.Label)
	setString("apiKey", &account.APIKey)
	setString("baseUrl", &account.BaseURL)
	setString("prefix", &account.Prefix)
	setString("proxyUrl", &account.ProxyURL)
	setString("quotaCurl", &account.QuotaCurl)
	setString("billingCurl", &account.BillingCurl)
	setString("authFileName", &account.AuthFileName)
	if query.Has("quotaEnabled") {
		account.QuotaEnabled = parseDeepLinkBool(query.Get("quotaEnabled"))
	}
	if query.Has("billingEnabled") {
		account.BillingEnabled = parseDeepLinkBool(query.Get("billingEnabled"))
	}
}

func applyDeepLinkCodexConfigQueryOverrides(config *DeepLinkCodexConfig, query url.Values) {
	setString := func(key string, target *string) {
		if value := strings.TrimSpace(query.Get(key)); value != "" {
			*target = value
		}
	}
	setString("mode", &config.Mode)
	setString("accountRef", &config.AccountRef)
	setString("model", &config.Model)
	setString("reasoningEffort", &config.ReasoningEffort)
	setString("providerID", &config.ProviderID)
	setString("providerName", &config.ProviderName)
	setString("providerScope", &config.ProviderScope)
	setString("baseUrl", &config.BaseURL)
	setString("apiKey", &config.APIKey)
	if query.Has("model") {
		config.ModelSet = true
	}
	if query.Has("reasoningEffort") {
		config.ReasoningEffortSet = true
	}
	if query.Has("providerID") {
		config.ProviderIDSet = true
	}
	if query.Has("providerName") {
		config.ProviderNameSet = true
	}
	if query.Has("baseUrl") {
		config.BaseURLSet = true
	}
	if query.Has("apiKey") {
		config.APIKeySet = true
	}
	if query.Has("requiresOpenAIAuth") {
		config.RequiresOpenAIAuth = parseDeepLinkBool(query.Get("requiresOpenAIAuth"))
		config.RequiresOpenAIAuthSet = true
	}
	if query.Has("wireAPI") {
		config.WireAPI = strings.TrimSpace(query.Get("wireAPI"))
		config.WireAPISet = true
	}
	if query.Has("supportsWebsockets") {
		config.SupportsWebsockets = parseDeepLinkBool(query.Get("supportsWebsockets"))
		config.SupportsWebsocketsSet = true
	}
}

func normalizeDeepLinkRequest(request *DeepLinkImportRequest) error {
	request.Channel = strings.TrimSpace(request.Channel)
	request.Resource = strings.TrimSpace(request.Resource)
	request.Source = strings.TrimSpace(request.Source)
	request.Nonce = strings.TrimSpace(request.Nonce)

	if request.Account != nil {
		request.Account.AccountType = strings.TrimSpace(request.Account.AccountType)
		request.Account.Name = strings.TrimSpace(request.Account.Name)
		request.Account.Label = strings.TrimSpace(request.Account.Label)
		request.Account.APIKey = strings.TrimSpace(request.Account.APIKey)
		request.Account.BaseURL = strings.TrimSpace(request.Account.BaseURL)
		request.Account.Prefix = strings.TrimSpace(request.Account.Prefix)
		request.Account.ProxyURL = strings.TrimSpace(request.Account.ProxyURL)
		request.Account.AuthFileName = strings.TrimSpace(request.Account.AuthFileName)
		if request.Account.AccountType == "" {
			return errors.New("缺少 accountType")
		}
		if request.Account.AccountType == "auth-file" && strings.TrimSpace(request.Account.AuthFileJSON) == "" && len(request.Documents) > 0 {
			body, err := buildAuthJSONFromDeepLinkDocuments(request.Documents)
			if err != nil {
				return err
			}
			request.Account.AuthFileJSON = string(body)
		}
	}
	if request.CodexConfig != nil {
		if err := applyDeepLinkDocumentsToCodexConfig(request.CodexConfig, request.Documents); err != nil {
			return err
		}
		request.CodexConfig.Mode = strings.TrimSpace(request.CodexConfig.Mode)
		request.CodexConfig.ProviderScope = normalizeDeepLinkProviderScope(request.CodexConfig.ProviderScope)
		request.CodexConfig.ProviderID = strings.TrimSpace(request.CodexConfig.ProviderID)
		request.CodexConfig.ProviderName = strings.TrimSpace(request.CodexConfig.ProviderName)
		request.CodexConfig.APIKey = strings.TrimSpace(request.CodexConfig.APIKey)
		request.CodexConfig.BaseURL = strings.TrimSpace(request.CodexConfig.BaseURL)
		if request.CodexConfig.Mode == "" {
			request.CodexConfig.Mode = "api-key"
		}
	}
	return nil
}

func deepLinkModeToAuthStrategy(mode string) (string, error) {
	switch strings.TrimSpace(strings.ToLower(mode)) {
	case "", "api-key", relayLocalAuthStrategyReplaceAuthWithAPIKey:
		return relayLocalAuthStrategyReplaceAuthWithAPIKey, nil
	case "oauth-auth-file", relayLocalAuthStrategyReplaceAuthWithOAuth:
		return relayLocalAuthStrategyReplaceAuthWithOAuth, nil
	case "preserve-chatgpt-provider", relayLocalAuthStrategyPreserveChatGPTAuth:
		return relayLocalAuthStrategyPreserveChatGPTAuth, nil
	default:
		return "", errors.New("Codex config mode 只支持 api-key / oauth-auth-file / preserve-chatgpt-provider")
	}
}

func readDeepLinkLocalProviderState() (LocalCodexModelProviderState, error) {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return LocalCodexModelProviderState{}, err
	}
	configBody, err := readOptionalTextFile(filepath.Join(codexHome, "config.toml"))
	if err != nil {
		return LocalCodexModelProviderState{}, err
	}
	return parseLocalCodexModelProviderState(configBody), nil
}

func readDeepLinkLocalConfigToml() (string, error) {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return "", err
	}
	return readOptionalTextFile(filepath.Join(codexHome, "config.toml"))
}

func buildDeepLinkAuthPreview(input RelayLocalApplyInput) (string, error) {
	switch input.AuthStrategy {
	case relayLocalAuthStrategyReplaceAuthWithAPIKey:
		if !input.APIKeySet {
			return "auth.json 保留现有内容，deep link 未提供 auth.json 改写字段\n", nil
		}
		body, err := buildRelayCodexAuthJSON(input.APIKey)
		return string(body), err
	case relayLocalAuthStrategyReplaceAuthWithOAuth:
		if !input.AuthFileContentSet {
			return "auth.json 保留现有内容，deep link 未提供 OAuth auth-file 内容\n", nil
		}
		body, err := buildRelayCodexOAuthAuthJSON(input.AuthFileContentBase64)
		if err != nil {
			return "", err
		}
		return redactDeepLinkJSONSecrets(string(body)), nil
	case relayLocalAuthStrategyPreserveChatGPTAuth:
		return "auth.json 保持当前 ChatGPT 登录态，不由 deep link 改写\n", nil
	default:
		return "", errors.New("未知 authStrategy")
	}
}

func summarizeDeepLinkAccount(account DeepLinkAccountDraft) *DeepLinkAccountSummary {
	title := firstNonEmpty(account.Label, account.Name, account.AuthFileName, account.AccountType)
	return &DeepLinkAccountSummary{
		AccountType:   account.AccountType,
		Title:         title,
		BaseURL:       account.BaseURL,
		APIKeyPreview: redactSecret(account.APIKey),
	}
}

func rejectUnsupportedDeepLinkQuery(query url.Values) error {
	for key := range query {
		normalized := strings.ToLower(strings.TrimSpace(key))
		if normalized == "configurl" {
			return errors.New("首期不支持 configUrl")
		}
		if normalized == "usagescript" {
			return errors.New("首期不支持 usageScript")
		}
		if normalized == "headers" || strings.HasPrefix(normalized, "headers.") || strings.HasPrefix(normalized, "header.") {
			return errors.New("首期不支持 deep link 写入 headers")
		}
	}
	return nil
}

func rejectUnsupportedDeepLinkJSON(raw map[string]json.RawMessage) error {
	for key, value := range raw {
		normalized := strings.ToLower(strings.TrimSpace(key))
		if normalized == "configurl" {
			return errors.New("首期不支持 configUrl")
		}
		if normalized == "usagescript" {
			return errors.New("首期不支持 usageScript")
		}
		if normalized == "headers" {
			return errors.New("首期不支持 deep link 写入 headers")
		}
		var nested map[string]json.RawMessage
		if json.Unmarshal(value, &nested) == nil && len(nested) > 0 {
			if err := rejectUnsupportedDeepLinkJSON(nested); err != nil {
				return err
			}
		}
	}
	return nil
}

func isSupportedDeepLinkResource(resource string) bool {
	switch resource {
	case deepLinkResourceAccount, deepLinkResourceCodexConfig, deepLinkResourceCodexSetup:
		return true
	default:
		return false
	}
}

func normalizeDeepLinkProviderScope(value string) string {
	switch strings.TrimSpace(strings.ToLower(value)) {
	case deepLinkProviderScopeCreateNew:
		return deepLinkProviderScopeCreateNew
	default:
		return deepLinkProviderScopeCurrentActive
	}
}

func parseDeepLinkBool(value string) bool {
	switch strings.TrimSpace(strings.ToLower(value)) {
	case "1", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}

func redactDeepLinkURL(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return "[INVALID URL]"
	}
	query := parsed.Query()
	for _, key := range []string{"apiKey", "config", "authFileContentBase64", "token", "access_token", "refresh_token", "id_token"} {
		if query.Has(key) {
			query.Set(key, "[REDACTED]")
		}
	}
	parsed.RawQuery = query.Encode()
	return parsed.String()
}

func redactSecret(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	if len(trimmed) <= 8 {
		return "[REDACTED]"
	}
	return trimmed[:4] + strings.Repeat("*", 4) + trimmed[len(trimmed)-4:]
}

func redactDeepLinkJSONSecrets(input string) string {
	replacer := strings.NewReplacer(
		`"access_token":`, `"access_token_redacted":`,
		`"refresh_token":`, `"refresh_token_redacted":`,
		`"id_token":`, `"id_token_redacted":`,
	)
	return replacer.Replace(input)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
