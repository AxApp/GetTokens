package wailsapp

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"path/filepath"
	"strings"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
	"github.com/linhay/gettokens/internal/cliproxyapi"
)

const (
	deepLinkProtocolGT       = "gt"
	deepLinkProtocolGTDev    = "gt-dev"
	deepLinkSchemaImportV1   = "gettokens.import.v1"
	deepLinkPayloadByteLimit = 32 * 1024
)

type DeepLinkImportRequest struct {
	RawURL      string                      `json:"rawURL,omitempty"`
	RedactedURL string                      `json:"redactedURL,omitempty"`
	Protocol    string                      `json:"protocol"`
	Schema      string                      `json:"schema"`
	Source      DeepLinkImportSource        `json:"source"`
	Options     DeepLinkImportOptions       `json:"options"`
	Accounts    []DeepLinkAccountImportItem `json:"accounts"`
}

type DeepLinkImportSource struct {
	Name string `json:"name,omitempty"`
	URL  string `json:"url,omitempty"`
}

type DeepLinkImportOptions struct {
	ContinueOnError bool `json:"continueOnError"`
}

type DeepLinkAccountImportItem struct {
	Index int                             `json:"index"`
	Ref   string                          `json:"ref,omitempty"`
	Write cliproxyapi.AccountWriteRequest `json:"-"`
}

type DeepLinkImportPreview struct {
	Protocol    string                       `json:"protocol"`
	RedactedURL string                       `json:"redactedURL"`
	Source      DeepLinkImportSource         `json:"source"`
	Accounts    []DeepLinkAccountPreviewItem `json:"accounts"`
	Warnings    []string                     `json:"warnings,omitempty"`
	Blocking    []string                     `json:"blocking,omitempty"`
}

type DeepLinkAccountPreviewItem struct {
	Index         int      `json:"index"`
	Ref           string   `json:"ref,omitempty"`
	Kind          string   `json:"kind"`
	Title         string   `json:"title"`
	Provider      string   `json:"provider,omitempty"`
	BaseURL       string   `json:"baseUrl,omitempty"`
	APIKeyPreview string   `json:"apiKeyPreview,omitempty"`
	KeyCount      int      `json:"keyCount,omitempty"`
	ModelCount    int      `json:"modelCount,omitempty"`
	Disabled      bool     `json:"disabled,omitempty"`
	Warnings      []string `json:"warnings,omitempty"`
	Blocking      []string `json:"blocking,omitempty"`
}

type DeepLinkApplyResult struct {
	Status   string                           `json:"status"`
	Total    int                              `json:"total"`
	Created  int                              `json:"created"`
	Failed   int                              `json:"failed"`
	Accounts []DeepLinkAccountApplyResultItem `json:"accounts,omitempty"`
}

type DeepLinkAccountApplyResultItem struct {
	Index      int    `json:"index"`
	Ref        string `json:"ref,omitempty"`
	Kind       string `json:"kind"`
	Title      string `json:"title"`
	AccountKey string `json:"accountKey,omitempty"`
	Status     string `json:"status"`
	Error      string `json:"error,omitempty"`
}

type deepLinkPayload struct {
	Schema   string                      `json:"schema"`
	Source   DeepLinkImportSource        `json:"source,omitempty"`
	Options  deepLinkPayloadOptions      `json:"options,omitempty"`
	Accounts []deepLinkPayloadAccountRaw `json:"accounts"`
}

type deepLinkPayloadOptions struct {
	ContinueOnError *bool `json:"continue_on_error,omitempty"`
}

type deepLinkPayloadAccountRaw struct {
	Ref              string                                         `json:"ref,omitempty"`
	Kind             cliproxyapi.AccountKind                        `json:"kind"`
	Title            string                                         `json:"title,omitempty"`
	Provider         string                                         `json:"provider,omitempty"`
	Priority         int                                            `json:"priority,omitempty"`
	Disabled         bool                                           `json:"disabled,omitempty"`
	AuthFile         *cliproxyapi.AuthFileAccountCredential         `json:"auth_file,omitempty"`
	CodexAPIKey      *cliproxyapi.CodexAPIKeyAccountCredential      `json:"codex_api_key,omitempty"`
	OpenAICompatible *cliproxyapi.OpenAICompatibleAccountCredential `json:"openai_compatible,omitempty"`
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
	result := &DeepLinkApplyResult{
		Status: "noop",
		Total:  len(request.Accounts),
	}
	if len(request.Accounts) == 0 {
		return result, nil
	}

	client := a.managementClient()
	var openAICompatibleNames map[string]struct{}
	for _, account := range request.Accounts {
		write := account.Write
		if write.Kind == cliproxyapi.AccountKindOpenAICompatible && write.OpenAICompatible != nil {
			names, err := a.ensureDeepLinkOpenAICompatibleNames(openAICompatibleNames)
			if err != nil {
				return nil, err
			}
			openAICompatibleNames = names
			applyDeepLinkUniqueOpenAICompatibleName(&write, openAICompatibleNames)
		}
		item := DeepLinkAccountApplyResultItem{
			Index:  account.Index,
			Ref:    account.Ref,
			Kind:   string(write.Kind),
			Title:  write.Title,
			Status: "failed",
		}
		created, err := client.CreateAccount(write)
		if err != nil {
			item.Error = err.Error()
			result.Failed++
			result.Accounts = append(result.Accounts, item)
			if !request.Options.ContinueOnError {
				break
			}
			continue
		}
		item.Status = "created"
		item.AccountKey = created.AccountKey
		result.Created++
		result.Accounts = append(result.Accounts, item)
	}

	switch {
	case result.Created == 0 && result.Failed > 0:
		result.Status = "failed"
	case result.Failed > 0:
		result.Status = "partial"
	case result.Created == result.Total:
		result.Status = "applied"
	default:
		result.Status = "partial"
	}
	return result, nil
}

func ParseDeepLinkImportURL(rawURL string) (DeepLinkImportRequest, error) {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return DeepLinkImportRequest{}, errors.New("missing_url: deep link 不能为空")
	}
	parsed, err := url.Parse(trimmed)
	if err != nil {
		return DeepLinkImportRequest{}, fmt.Errorf("invalid_url: %w", err)
	}
	protocol := strings.ToLower(strings.TrimSpace(parsed.Scheme))
	if !isSupportedDeepLinkProtocol(protocol) {
		return DeepLinkImportRequest{}, fmt.Errorf("unsupported_scheme: 只支持 gt://app/v1/import")
	}
	if !strings.EqualFold(parsed.Host, "app") || strings.TrimRight(parsed.Path, "/") != "/v1/import" {
		return DeepLinkImportRequest{}, fmt.Errorf("unsupported_route: 只支持 gt://app/v1/import?payload=...")
	}

	query := parsed.Query()
	encodedPayload := strings.TrimSpace(query.Get("payload"))
	if encodedPayload == "" {
		return DeepLinkImportRequest{}, errors.New("missing_payload: 缺少 payload")
	}
	body, err := decodeDeepLinkPayload(encodedPayload)
	if err != nil {
		return DeepLinkImportRequest{}, err
	}
	payload, err := parseDeepLinkPayload(body)
	if err != nil {
		return DeepLinkImportRequest{}, err
	}
	request, err := compileDeepLinkPayload(trimmed, protocol, payload)
	if err != nil {
		return DeepLinkImportRequest{}, err
	}
	return request, nil
}

func PreviewDeepLinkImportURL(rawURL string) (*DeepLinkImportPreview, error) {
	request, err := ParseDeepLinkImportURL(rawURL)
	if err != nil {
		return nil, err
	}
	return PreviewDeepLinkImportRequest(request), nil
}

func PreviewDeepLinkImportRequest(request DeepLinkImportRequest) *DeepLinkImportPreview {
	preview := &DeepLinkImportPreview{
		Protocol:    request.Protocol,
		RedactedURL: request.RedactedURL,
		Source:      request.Source,
		Accounts:    make([]DeepLinkAccountPreviewItem, 0, len(request.Accounts)),
	}
	for _, account := range request.Accounts {
		preview.Accounts = append(preview.Accounts, previewDeepLinkAccount(account))
	}
	return preview
}

func decodeDeepLinkPayload(encoded string) ([]byte, error) {
	body, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		if padded, paddedErr := base64.URLEncoding.DecodeString(encoded); paddedErr == nil {
			body = padded
		} else {
			return nil, fmt.Errorf("invalid_payload: payload 不是有效 Base64URL JSON: %w", err)
		}
	}
	if len(body) > deepLinkPayloadByteLimit {
		return nil, fmt.Errorf("payload_too_large: payload 超过 %d 字节", deepLinkPayloadByteLimit)
	}
	return body, nil
}

func parseDeepLinkPayload(body []byte) (deepLinkPayload, error) {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(body, &raw); err != nil {
		return deepLinkPayload{}, fmt.Errorf("invalid_payload: payload 不是有效 JSON: %w", err)
	}
	if err := rejectForbiddenDeepLinkPayloadFields(raw); err != nil {
		return deepLinkPayload{}, err
	}
	var payload deepLinkPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return deepLinkPayload{}, fmt.Errorf("invalid_payload: payload 结构无效: %w", err)
	}
	return payload, nil
}

func compileDeepLinkPayload(rawURL string, protocol string, payload deepLinkPayload) (DeepLinkImportRequest, error) {
	payload.Schema = strings.TrimSpace(payload.Schema)
	if payload.Schema != deepLinkSchemaImportV1 {
		return DeepLinkImportRequest{}, fmt.Errorf("unsupported_schema: schema 必须是 %s", deepLinkSchemaImportV1)
	}
	continueOnError := true
	if payload.Options.ContinueOnError != nil {
		continueOnError = *payload.Options.ContinueOnError
	}
	request := DeepLinkImportRequest{
		RawURL:      rawURL,
		RedactedURL: redactDeepLinkURL(rawURL),
		Protocol:    protocol,
		Schema:      payload.Schema,
		Source: DeepLinkImportSource{
			Name: strings.TrimSpace(payload.Source.Name),
			URL:  strings.TrimSpace(payload.Source.URL),
		},
		Options:  DeepLinkImportOptions{ContinueOnError: continueOnError},
		Accounts: make([]DeepLinkAccountImportItem, 0, len(payload.Accounts)),
	}
	for index, item := range payload.Accounts {
		write, err := compileDeepLinkAccountWrite(item)
		if err != nil {
			return DeepLinkImportRequest{}, fmt.Errorf("account[%d]: %w", index, err)
		}
		request.Accounts = append(request.Accounts, DeepLinkAccountImportItem{
			Index: index,
			Ref:   strings.TrimSpace(item.Ref),
			Write: write,
		})
	}
	return request, nil
}

func isSupportedDeepLinkProtocol(protocol string) bool {
	switch strings.ToLower(strings.TrimSpace(protocol)) {
	case deepLinkProtocolGT, deepLinkProtocolGTDev:
		return true
	default:
		return false
	}
}

func compileDeepLinkAccountWrite(item deepLinkPayloadAccountRaw) (cliproxyapi.AccountWriteRequest, error) {
	write := cliproxyapi.AccountWriteRequest{
		Kind:     item.Kind,
		Title:    strings.TrimSpace(item.Title),
		Provider: strings.TrimSpace(item.Provider),
		Priority: item.Priority,
		Disabled: item.Disabled,
	}
	switch item.Kind {
	case cliproxyapi.AccountKindAuthFile:
		if item.AuthFile == nil {
			return write, errors.New("auth_file 必填")
		}
		credential, err := normalizeDeepLinkAuthFileCredential(*item.AuthFile)
		if err != nil {
			return write, err
		}
		write.AuthFile = credential
		if write.Title == "" {
			write.Title = credential.SourceFileName
		}
		if write.Provider == "" {
			write.Provider = firstNonEmpty(credential.AuthType, "codex")
		}
	case cliproxyapi.AccountKindCodexAPIKey:
		if item.CodexAPIKey == nil {
			return write, errors.New("codex_api_key 必填")
		}
		credential := normalizeDeepLinkCodexAPIKeyCredential(*item.CodexAPIKey)
		if credential.APIKey == "" {
			return write, errors.New("codex_api_key.api_key 必填")
		}
		if credential.BaseURL == "" {
			return write, errors.New("codex_api_key.base_url 必填")
		}
		write.CodexAPIKey = &credential
		if write.Title == "" {
			write.Title = "Codex API Key"
		}
		if write.Provider == "" {
			write.Provider = "codex"
		}
	case cliproxyapi.AccountKindOpenAICompatible:
		if item.OpenAICompatible == nil {
			return write, errors.New("openai_compatible 必填")
		}
		credential := normalizeDeepLinkOpenAICompatibleCredential(*item.OpenAICompatible)
		if credential.ProviderName == "" {
			return write, errors.New("openai_compatible.provider_name 必填")
		}
		if credential.BaseURL == "" {
			return write, errors.New("openai_compatible.base_url 必填")
		}
		if !openAICompatibleAPIKeyEntriesHasKey(credential.APIKeyEntriesJSON) {
			return write, errors.New("openai_compatible.api_key_entries_json 至少需要一个 api-key")
		}
		write.OpenAICompatible = &credential
		if write.Title == "" {
			write.Title = credential.ProviderName
		}
		if write.Provider == "" {
			write.Provider = credential.ProviderName
		}
	default:
		return write, errors.New("kind 只支持 auth-file / codex-api-key / openai-compatible")
	}
	return write, nil
}

func normalizeDeepLinkAuthFileCredential(input cliproxyapi.AuthFileAccountCredential) (*cliproxyapi.AuthFileAccountCredential, error) {
	sourceFileName := filepath.Base(firstNonEmpty(input.SourceFileName, "deep-link-auth.json"))
	authJSON := strings.TrimSpace(input.AuthJSON)
	if authJSON == "" {
		return nil, errors.New("auth_file.auth_json 必填")
	}
	normalized, _, err := accountsdomain.NormalizeAuthFileForSidecar([]byte(authJSON))
	if err != nil {
		return nil, err
	}
	provider := firstNonEmpty(input.AuthType, accountsdomain.InferAuthFileKind(normalized), "codex")
	profile := accountsdomain.ExtractAuthFileProfile(normalized)
	return &cliproxyapi.AuthFileAccountCredential{
		SourceFileName: sourceFileName,
		AuthJSON:       string(normalized),
		AuthType:       provider,
		Email:          firstNonEmpty(input.Email, profile.Email),
		PlanType:       firstNonEmpty(input.PlanType, profile.PlanType),
		SizeBytes:      int64(len(normalized)),
	}, nil
}

func normalizeDeepLinkCodexAPIKeyCredential(input cliproxyapi.CodexAPIKeyAccountCredential) cliproxyapi.CodexAPIKeyAccountCredential {
	input.APIKey = strings.TrimSpace(input.APIKey)
	input.BaseURL = accountsdomain.NormalizeBaseURL(input.BaseURL)
	input.Prefix = accountsdomain.NormalizePrefix(input.Prefix)
	input.ProxyURL = strings.TrimSpace(input.ProxyURL)
	input.QuotaCurl = strings.TrimSpace(input.QuotaCurl)
	input.BillingCurl = strings.TrimSpace(input.BillingCurl)
	if !input.Websockets {
		input.Websockets = true
	}
	input.QuotaEnabled = input.QuotaEnabled && input.QuotaCurl != ""
	input.BillingEnabled = input.BillingEnabled && input.BillingCurl != ""
	return input
}

func normalizeDeepLinkOpenAICompatibleCredential(input cliproxyapi.OpenAICompatibleAccountCredential) cliproxyapi.OpenAICompatibleAccountCredential {
	input.ProviderName = strings.TrimSpace(input.ProviderName)
	input.BaseURL = strings.TrimSpace(input.BaseURL)
	input.Prefix = strings.TrimSpace(input.Prefix)
	input.APIKeyEntriesJSON = strings.TrimSpace(input.APIKeyEntriesJSON)
	input.HeadersJSON = strings.TrimSpace(input.HeadersJSON)
	input.ModelsJSON = strings.TrimSpace(input.ModelsJSON)
	return input
}

func openAICompatibleAPIKeyEntriesHasKey(rawJSON string) bool {
	var entries []map[string]any
	if err := json.Unmarshal([]byte(rawJSON), &entries); err != nil {
		return false
	}
	for _, entry := range entries {
		if strings.TrimSpace(fmt.Sprint(entry["api-key"])) != "" {
			return true
		}
	}
	return false
}

func previewDeepLinkAccount(account DeepLinkAccountImportItem) DeepLinkAccountPreviewItem {
	write := account.Write
	preview := DeepLinkAccountPreviewItem{
		Index:    account.Index,
		Ref:      account.Ref,
		Kind:     string(write.Kind),
		Title:    write.Title,
		Provider: write.Provider,
		Disabled: write.Disabled,
	}
	switch write.Kind {
	case cliproxyapi.AccountKindAuthFile:
		if write.AuthFile != nil {
			preview.Title = firstNonEmpty(preview.Title, write.AuthFile.SourceFileName)
			preview.KeyCount = boolToCount(strings.TrimSpace(write.AuthFile.AuthJSON) != "")
		}
	case cliproxyapi.AccountKindCodexAPIKey:
		if write.CodexAPIKey != nil {
			preview.BaseURL = write.CodexAPIKey.BaseURL
			preview.APIKeyPreview = redactSecret(write.CodexAPIKey.APIKey)
			preview.KeyCount = boolToCount(write.CodexAPIKey.APIKey != "")
			preview.ModelCount = countJSONArray(write.CodexAPIKey.ModelsJSON)
		}
	case cliproxyapi.AccountKindOpenAICompatible:
		if write.OpenAICompatible != nil {
			preview.BaseURL = write.OpenAICompatible.BaseURL
			preview.KeyCount = countJSONArray(write.OpenAICompatible.APIKeyEntriesJSON)
			preview.ModelCount = countJSONArray(write.OpenAICompatible.ModelsJSON)
		}
	}
	return preview
}

func (a *App) ensureDeepLinkOpenAICompatibleNames(cached map[string]struct{}) (map[string]struct{}, error) {
	if cached != nil {
		return cached, nil
	}
	accounts, err := a.managementClient().ListAccounts()
	if err != nil {
		return nil, err
	}
	names := make(map[string]struct{}, len(accounts))
	for _, account := range accounts {
		if account.Kind != cliproxyapi.AccountKindOpenAICompatible {
			continue
		}
		name := strings.TrimSpace(account.Provider)
		if account.OpenAICompatible != nil && strings.TrimSpace(account.OpenAICompatible.ProviderName) != "" {
			name = strings.TrimSpace(account.OpenAICompatible.ProviderName)
		}
		if name != "" {
			names[strings.ToLower(name)] = struct{}{}
		}
	}
	return names, nil
}

func applyDeepLinkUniqueOpenAICompatibleName(write *cliproxyapi.AccountWriteRequest, existing map[string]struct{}) {
	if write == nil || write.OpenAICompatible == nil {
		return
	}
	originalName := strings.TrimSpace(write.OpenAICompatible.ProviderName)
	if originalName == "" {
		return
	}
	nextName := resolveDeepLinkNumberedName(originalName, existing)
	if nextName == originalName {
		existing[strings.ToLower(nextName)] = struct{}{}
		return
	}
	originalTitle := strings.TrimSpace(write.Title)
	write.OpenAICompatible.ProviderName = nextName
	write.Provider = nextName
	if originalTitle == "" || strings.EqualFold(originalTitle, originalName) {
		write.Title = nextName
	}
	existing[strings.ToLower(nextName)] = struct{}{}
}

func resolveDeepLinkNumberedName(name string, existing map[string]struct{}) string {
	base := stripDeepLinkNumberedSuffix(strings.TrimSpace(name))
	if base == "" {
		return strings.TrimSpace(name)
	}
	if _, exists := existing[strings.ToLower(base)]; !exists {
		return base
	}
	for index := 2; ; index++ {
		candidate := fmt.Sprintf("%s #%d", base, index)
		if _, exists := existing[strings.ToLower(candidate)]; !exists {
			return candidate
		}
	}
}

func stripDeepLinkNumberedSuffix(name string) string {
	trimmed := strings.TrimSpace(name)
	hashIndex := strings.LastIndex(trimmed, " #")
	if hashIndex < 0 {
		return trimmed
	}
	suffix := strings.TrimSpace(trimmed[hashIndex+2:])
	if suffix == "" {
		return trimmed
	}
	for _, char := range suffix {
		if char < '0' || char > '9' {
			return trimmed
		}
	}
	return strings.TrimSpace(trimmed[:hashIndex])
}

func rejectForbiddenDeepLinkPayloadFields(raw map[string]json.RawMessage) error {
	for key, value := range raw {
		normalized := strings.ToLower(strings.TrimSpace(key))
		switch normalized {
		case "account_key", "credential_source", "runtime_apply_status", "runtime_apply_error",
			"documents", "operations", "codexlocal", "claudelocal", "configurl", "usagescript":
			return fmt.Errorf("forbidden_field: %s", key)
		}
		var object map[string]json.RawMessage
		if json.Unmarshal(value, &object) == nil && len(object) > 0 {
			if err := rejectForbiddenDeepLinkPayloadFields(object); err != nil {
				return err
			}
			continue
		}
		var array []map[string]json.RawMessage
		if json.Unmarshal(value, &array) == nil {
			for _, item := range array {
				if err := rejectForbiddenDeepLinkPayloadFields(item); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

func redactDeepLinkURL(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return "[INVALID URL]"
	}
	query := parsed.Query()
	if query.Has("payload") {
		query.Set("payload", "[REDACTED]")
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

func countJSONArray(rawJSON string) int {
	trimmed := strings.TrimSpace(rawJSON)
	if trimmed == "" {
		return 0
	}
	var items []any
	if err := json.Unmarshal([]byte(trimmed), &items); err != nil {
		return 0
	}
	return len(items)
}

func boolToCount(value bool) int {
	if value {
		return 1
	}
	return 0
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
