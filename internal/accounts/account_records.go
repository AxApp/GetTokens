package accounts

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/url"
	"sort"
	"strings"

	"github.com/linhay/gettokens/internal/cliproxyapi"
)

const (
	CredentialSourceAuthFile = "auth-file"
	CredentialSourceAPIKey   = "api-key"
)

const (
	AccountKindAuthFile         = "auth-file"
	AccountKindCodexAPIKey      = "codex-api-key"
	AccountKindOpenAICompatible = "openai-compatible"
)

const (
	APIFmtAnthropic       = "anthropic"
	APIFmtOpenAIChat      = "openai_chat"
	APIFmtOpenAIResponses = "openai_responses"
	APIFmtGeminiNative    = "gemini_native"
)

func resolveDefaultFormats(provider string) []string {
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case "deepseek", "zhipu", "glm", "kimi", "moonshot",
		"stepfun", "minimax", "doubao", "longcat", "xiaomimimo", "mimo",
		"bailian", "dashscope", "modelscope", "ling", "bailing",
		"siliconflow", "openrouter", "therouter":
		return []string{APIFmtAnthropic, APIFmtOpenAIChat}
	case "gemini", "google":
		return []string{APIFmtGeminiNative}
	case "copilot", "github":
		return []string{APIFmtOpenAIChat}
	case "codex", "openai":
		return []string{APIFmtAnthropic, APIFmtOpenAIResponses}
	default:
		return []string{APIFmtAnthropic}
	}
}

func resolveSupportedFormats(provider string, formatBaseURLs map[string]string) []string {
	formats := supportedFormatsFromBaseURLs(formatBaseURLs)
	if len(formats) > 0 {
		return formats
	}
	return resolveDefaultFormats(provider)
}

func supportedFormatsFromBaseURLs(formatBaseURLs map[string]string) []string {
	if len(formatBaseURLs) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(formatBaseURLs))
	for rawFormat, rawURL := range formatBaseURLs {
		format := strings.TrimSpace(rawFormat)
		if format == "" || strings.TrimSpace(rawURL) == "" {
			continue
		}
		seen[format] = struct{}{}
	}
	if len(seen) == 0 {
		return nil
	}
	ordered := []string{APIFmtOpenAIChat, APIFmtOpenAIResponses, APIFmtAnthropic, APIFmtGeminiNative, "codex"}
	formats := make([]string, 0, len(seen))
	for _, format := range ordered {
		if _, ok := seen[format]; ok {
			formats = append(formats, format)
			delete(seen, format)
		}
	}
	remaining := make([]string, 0, len(seen))
	for format := range seen {
		remaining = append(remaining, format)
	}
	sort.Strings(remaining)
	formats = append(formats, remaining...)
	return formats
}

type AuthFileRecord struct {
	Name          string
	Type          string
	Provider      string
	Priority      int
	Email         string
	PlanType      string
	Size          int64
	AuthIndex     interface{}
	RuntimeOnly   bool
	Disabled      bool
	Unavailable   bool
	Status        string
	StatusMessage string
	LastRefresh   interface{}
	Modified      int64
}

type AccountRecord struct {
	ID                         string                   `json:"id"`
	AccountKind                string                   `json:"accountKind,omitempty"`
	Provider                   string                   `json:"provider"`
	CredentialSource           string                   `json:"credentialSource"`
	DisplayName                string                   `json:"displayName"`
	Status                     string                   `json:"status"`
	StatusMessage              string                   `json:"statusMessage,omitempty"`
	RuntimeStatus              string                   `json:"runtimeStatus,omitempty"`
	RuntimeReason              string                   `json:"runtimeReason,omitempty"`
	RuntimeFailureClass        string                   `json:"runtimeFailureClass,omitempty"`
	Routeable                  bool                     `json:"routeable,omitempty"`
	RegisteredModelCount       int                      `json:"registeredModelCount,omitempty"`
	RuntimeRepairOutcome       string                   `json:"runtimeRepairOutcome,omitempty"`
	RuntimeRepairAction        string                   `json:"runtimeRepairAction,omitempty"`
	RuntimeRepairTriggerStatus string                   `json:"runtimeRepairTriggerStatus,omitempty"`
	RuntimeRepairTriggerClass  string                   `json:"runtimeRepairTriggerClass,omitempty"`
	RuntimeRepairTriggerReason string                   `json:"runtimeRepairTriggerReason,omitempty"`
	LastRuntimeRepairAtUnixMs  int64                    `json:"lastRuntimeRepairAtUnixMs,omitempty"`
	Revision                   int                      `json:"revision,omitempty"`
	CredentialStatus           string                   `json:"credentialStatus,omitempty"`
	CredentialGeneration       int64                    `json:"credentialGeneration,omitempty"`
	DetailLoaded               bool                     `json:"detailLoaded,omitempty"`
	Priority                   int                      `json:"priority,omitempty"`
	Disabled                   bool                     `json:"disabled,omitempty"`
	Email                      string                   `json:"email,omitempty"`
	PlanType                   string                   `json:"planType,omitempty"`
	Name                       string                   `json:"name,omitempty"`
	APIKey                     string                   `json:"apiKey,omitempty"`
	APIKeys                    []string                 `json:"apiKeys,omitempty"`
	Headers                    map[string]string        `json:"headers,omitempty"`
	Models                     []cliproxyapi.CodexModel `json:"models,omitempty"`
	KeyFingerprint             string                   `json:"keyFingerprint,omitempty"`
	KeySuffix                  string                   `json:"keySuffix,omitempty"`
	BaseURL                    string                   `json:"baseUrl,omitempty"`
	Prefix                     string                   `json:"prefix,omitempty"`
	ProxyURL                   string                   `json:"proxyUrl,omitempty"`
	AuthIndex                  interface{}              `json:"authIndex,omitempty"`
	QuotaKey                   string                   `json:"quotaKey,omitempty"`
	QuotaCurl                  string                   `json:"quotaCurl,omitempty"`
	QuotaEnabled               bool                     `json:"quotaEnabled,omitempty"`
	LocalOnly                  bool                     `json:"localOnly,omitempty"`
	SupportedFormats           []string                 `json:"supportedFormats,omitempty"`
	FormatBaseURLs             map[string]string        `json:"formatBaseUrls,omitempty"`
	BillingCurl                string                   `json:"billingCurl,omitempty"`
	BillingEnabled             bool                     `json:"billingEnabled,omitempty"`
	PlatformCookie             string                   `json:"platformCookie,omitempty"`
	CurlVariables              map[string]string        `json:"curlVariables,omitempty"`
	ModelFetchAPIKey           string                   `json:"modelFetchApiKey,omitempty"`
	ModelFetchBaseURL          string                   `json:"modelFetchBaseUrl,omitempty"`
	Requestability             AccountRequestability    `json:"requestability,omitempty"`
}

type AccountRequestability struct {
	Evidence []string `json:"evidence,omitempty"`
	Manual   bool     `json:"manual,omitempty"`
}

func BuildAccountRecords(authFiles []AuthFileRecord, codexKeys []cliproxyapi.CodexAPIKey) []AccountRecord {
	records := make([]AccountRecord, 0, len(authFiles)+len(codexKeys))
	seen := make(map[string]struct{}, len(authFiles)+len(codexKeys))

	for _, file := range authFiles {
		record := BuildAuthFileAccountRecord(file)
		if _, ok := seen[record.ID]; ok {
			continue
		}
		seen[record.ID] = struct{}{}
		records = append(records, record)
	}

	for _, key := range codexKeys {
		record := BuildCodexAPIKeyAccountRecord(key)
		if _, ok := seen[record.ID]; ok {
			continue
		}
		seen[record.ID] = struct{}{}
		records = append(records, record)
	}

	return records
}

func BuildOpenAICompatibleProviderAccountRecord(provider cliproxyapi.OpenAICompatibleProvider) AccountRecord {
	name := strings.TrimSpace(provider.Name)
	baseURL := NormalizeBaseURL(provider.BaseURL)
	prefix := NormalizePrefix(provider.Prefix)

	apiKey := ""
	proxyURL := ""
	apiKeys := make([]string, 0, len(provider.APIKeyEntries))
	for _, entry := range provider.APIKeyEntries {
		trimmed := strings.TrimSpace(entry.APIKey)
		if trimmed != "" {
			apiKeys = append(apiKeys, trimmed)
		}
		if trimmed != "" && apiKey == "" {
			apiKey = trimmed
			proxyURL = strings.TrimSpace(entry.ProxyURL)
		}
	}

	return AccountRecord{
		ID:               OpenAICompatibleProviderAssetID(name),
		AccountKind:      AccountKindOpenAICompatible,
		Provider:         name,
		CredentialSource: CredentialSourceAPIKey,
		DisplayName:      "OPENAI-COMPATIBLE · " + strings.ToUpper(name),
		Status:           providerStatus(provider.Disabled),
		Priority:         provider.Priority,
		Disabled:         provider.Disabled,
		APIKey:           apiKey,
		APIKeys:          apiKeys,
		Headers:          cloneStringMap(provider.Headers),
		QuotaCurl:        strings.TrimSpace(provider.QuotaCurl),
		QuotaEnabled:     provider.QuotaEnabled && strings.TrimSpace(provider.QuotaCurl) != "",
		BillingCurl:      strings.TrimSpace(provider.BillingCurl),
		BillingEnabled:   provider.BillingEnabled && strings.TrimSpace(provider.BillingCurl) != "",
		PlatformCookie:   strings.TrimSpace(provider.PlatformCookie),
		CurlVariables:    cloneStringMap(provider.CurlVariables),
		Models:           openAICompatibleModelsToCodexModels(provider.Models),
		KeyFingerprint:   APIKeyFingerprint(apiKey),
		KeySuffix:        APIKeySuffix(apiKey),
		BaseURL:          baseURL,
		Prefix:           prefix,
		ProxyURL:         proxyURL,
		SupportedFormats: resolveSupportedFormats(name, provider.FormatBaseURLs),
		FormatBaseURLs:   cloneStringMap(provider.FormatBaseURLs),
	}
}

func BuildAuthFileAccountRecord(file AuthFileRecord) AccountRecord {
	provider := strings.TrimSpace(file.Provider)
	if provider == "" {
		provider = strings.TrimSpace(file.Type)
	}
	if provider == "" {
		provider = "unknown"
	}

	displayName := strings.TrimSpace(file.Name)
	if displayName == "" {
		displayName = "UNNAMED AUTH FILE"
	}

	status := strings.TrimSpace(file.Status)
	if status == "" {
		if file.Disabled {
			status = "disabled"
		} else {
			status = "active"
		}
	}

	return AccountRecord{
		ID:               "auth-file:" + strings.TrimSpace(file.Name),
		AccountKind:      AccountKindAuthFile,
		Provider:         provider,
		CredentialSource: CredentialSourceAuthFile,
		DisplayName:      displayName,
		Status:           status,
		StatusMessage:    strings.TrimSpace(file.StatusMessage),
		Priority:         file.Priority,
		Disabled:         file.Disabled,
		Email:            strings.TrimSpace(file.Email),
		PlanType:         strings.TrimSpace(file.PlanType),
		Name:             strings.TrimSpace(file.Name),
		AuthIndex:        file.AuthIndex,
		QuotaKey:         strings.TrimSpace(file.Name),
		LocalOnly:        file.RuntimeOnly,
		SupportedFormats: resolveDefaultFormats(provider),
	}
}

func BuildCodexAPIKeyAccountRecord(key cliproxyapi.CodexAPIKey) AccountRecord {
	baseURL := NormalizeBaseURL(key.BaseURL)
	prefix := NormalizePrefix(key.Prefix)
	fingerprint := APIKeyFingerprint(key.APIKey)
	suffix := APIKeySuffix(key.APIKey)

	status := "active"
	if key.Disabled {
		status = "disabled"
	} else if strings.TrimSpace(key.AuthIndex) == "" {
		status = "configured"
	}

	displayName := "CODEX API KEY"
	if trimmedLabel := strings.TrimSpace(key.Label); trimmedLabel != "" {
		displayName = trimmedLabel
	} else if suffix != "" {
		displayName = "CODEX API KEY · " + suffix
	}

	return AccountRecord{
		ID:               codexAPIKeyRecordID(key),
		AccountKind:      AccountKindCodexAPIKey,
		Provider:         "codex",
		CredentialSource: CredentialSourceAPIKey,
		DisplayName:      displayName,
		Status:           status,
		Priority:         key.Priority,
		Disabled:         key.Disabled,
		APIKey:           strings.TrimSpace(key.APIKey),
		APIKeys:          normalizeStringList([]string{key.APIKey}),
		Headers:          cloneStringMap(key.Headers),
		Models:           cloneCodexModels(key.Models),
		KeyFingerprint:   fingerprint,
		KeySuffix:        suffix,
		BaseURL:          baseURL,
		Prefix:           prefix,
		ProxyURL:         strings.TrimSpace(key.ProxyURL),
		AuthIndex:        strings.TrimSpace(key.AuthIndex),
		QuotaKey:         codexAPIKeyQuotaKey(key),
		QuotaCurl:        strings.TrimSpace(key.QuotaCurl),
		QuotaEnabled:     key.QuotaEnabled,
		SupportedFormats: resolveSupportedFormats("codex", key.FormatBaseURLs),
		FormatBaseURLs:   cloneStringMap(key.FormatBaseURLs),
		BillingCurl:      strings.TrimSpace(key.BillingCurl),
		BillingEnabled:   key.BillingEnabled && strings.TrimSpace(key.BillingCurl) != "",
		PlatformCookie:   strings.TrimSpace(key.PlatformCookie),
		CurlVariables:    cloneStringMap(key.CurlVariables),
	}
}

func BuildUnifiedAccountRecord(account cliproxyapi.UnifiedAccount) AccountRecord {
	var record AccountRecord
	switch account.Kind {
	case cliproxyapi.AccountKindAuthFile:
		record = buildUnifiedAuthFileAccountRecord(account)
	case cliproxyapi.AccountKindCodexAPIKey:
		record = buildUnifiedCodexAPIKeyAccountRecord(account)
	case cliproxyapi.AccountKindOpenAICompatible:
		record = buildUnifiedOpenAICompatibleAccountRecord(account)
	default:
		record = AccountRecord{
			ID:               strings.TrimSpace(account.AccountKey),
			AccountKind:      string(account.Kind),
			Provider:         strings.TrimSpace(account.Provider),
			CredentialSource: CredentialSourceAPIKey,
			DisplayName:      unifiedDisplayName(account, "ACCOUNT"),
			Status:           unifiedStatus(account),
			Priority:         account.Priority,
			Disabled:         account.Disabled,
		}
	}
	record.Revision = account.Revision
	record.CredentialStatus = strings.TrimSpace(account.CredentialStatus)
	record.CredentialGeneration = account.CredentialGeneration
	record.DetailLoaded = true
	return record
}

func BuildUnifiedAccountRecords(accounts []cliproxyapi.UnifiedAccount) []AccountRecord {
	records := make([]AccountRecord, 0, len(accounts))
	seen := make(map[string]struct{}, len(accounts))
	for _, account := range accounts {
		record := BuildUnifiedAccountRecord(account)
		if strings.TrimSpace(record.ID) == "" {
			continue
		}
		if _, ok := seen[record.ID]; ok {
			continue
		}
		seen[record.ID] = struct{}{}
		records = append(records, record)
	}
	return records
}

func buildUnifiedAuthFileAccountRecord(account cliproxyapi.UnifiedAccount) AccountRecord {
	credential := account.AuthFile
	provider := strings.TrimSpace(account.Provider)
	runtimeState := resolveUnifiedRuntimeState(account)
	file := AuthFileRecord{
		Name:     strings.TrimSpace(account.Title),
		Provider: provider,
		Priority: account.Priority,
		Disabled: account.Disabled,
		Status:   unifiedStatus(account),
	}
	if credential != nil {
		if name := strings.TrimSpace(credential.SourceFileName); name != "" {
			file.Name = name
		}
		file.Type = strings.TrimSpace(credential.AuthType)
		if isUnknownUnifiedAuthFileProvider(provider) {
			if inferred := InferAuthFileKind([]byte(strings.TrimSpace(credential.AuthJSON))); inferred != "" {
				file.Provider = inferred
			}
		}
		profile := ExtractAuthFileProfile([]byte(strings.TrimSpace(credential.AuthJSON)))
		file.Email = firstNonEmpty(strings.TrimSpace(credential.Email), profile.Email)
		file.PlanType = inferUnifiedAuthFilePlanType(credential)
		file.Modified = credential.ModifiedUnixMs
		file.Size = credential.SizeBytes
	}
	record := BuildAuthFileAccountRecord(file)
	record.ID = strings.TrimSpace(account.AccountKey)
	record.DisplayName = unifiedDisplayName(account, record.DisplayName)
	record.AuthIndex = strings.TrimSpace(account.AccountKey)
	record.QuotaKey = strings.TrimSpace(account.AccountKey)
	record.LocalOnly = false
	applyUnifiedRuntimeState(&record, runtimeState)
	return record
}

func isUnknownUnifiedAuthFileProvider(value string) bool {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	return trimmed == "" || trimmed == "unknown"
}

func inferUnifiedAuthFilePlanType(credential *cliproxyapi.AuthFileAccountCredential) string {
	if credential == nil {
		return ""
	}
	if planType := strings.TrimSpace(credential.PlanType); planType != "" {
		return planType
	}
	if profile := ExtractAuthFileProfile([]byte(strings.TrimSpace(credential.AuthJSON))); profile.PlanType != "" {
		return profile.PlanType
	}
	name := strings.ToLower(strings.TrimSpace(credential.SourceFileName))
	switch {
	case strings.HasSuffix(name, "-plus.json"):
		return "plus"
	case strings.HasSuffix(name, "-pro.json"):
		return "pro"
	case strings.HasSuffix(name, "-free.json"):
		return "free"
	default:
		return ""
	}
}

func buildUnifiedCodexAPIKeyAccountRecord(account cliproxyapi.UnifiedAccount) AccountRecord {
	credential := account.CodexAPIKey
	runtimeState := resolveUnifiedRuntimeState(account)
	key := cliproxyapi.CodexAPIKey{
		LocalID:  strings.TrimSpace(account.AccountKey),
		Label:    strings.TrimSpace(account.Title),
		Priority: account.Priority,
		Disabled: account.Disabled,
	}
	if credential != nil {
		key.APIKey = strings.TrimSpace(credential.APIKey)
		key.BaseURL = strings.TrimSpace(credential.BaseURL)
		key.Prefix = strings.TrimSpace(credential.Prefix)
		key.ProxyURL = strings.TrimSpace(credential.ProxyURL)
		key.Websockets = credential.Websockets
		key.QuotaCurl = strings.TrimSpace(credential.QuotaCurl)
		key.QuotaEnabled = credential.QuotaEnabled && key.QuotaCurl != ""
		key.BillingCurl = strings.TrimSpace(credential.BillingCurl)
		key.BillingEnabled = credential.BillingEnabled && key.BillingCurl != ""
		key.FormatBaseURLs = parseStringMapJSON(credential.FormatBaseURLsJSON)
		key.Headers = parseStringMapJSON(credential.HeadersJSON)
		key.Models = parseCodexModelsJSON(credential.ModelsJSON)
		key.ExcludedModels = parseStringListJSON(credential.ExcludedModelsJSON)
		key.PlatformCookie = strings.TrimSpace(credential.PlatformCookie)
		key.CurlVariables = parseStringMapJSON(credential.CurlVariablesJSON)
	}
	record := BuildCodexAPIKeyAccountRecord(key)
	record.Status = unifiedStatus(account)
	record.AuthIndex = strings.TrimSpace(account.AccountKey)
	record.QuotaKey = strings.TrimSpace(account.AccountKey)
	record.DisplayName = unifiedDisplayName(account, record.DisplayName)
	applyUnifiedRuntimeState(&record, runtimeState)
	return record
}

func buildUnifiedOpenAICompatibleAccountRecord(account cliproxyapi.UnifiedAccount) AccountRecord {
	credential := account.OpenAICompatible
	runtimeState := resolveUnifiedRuntimeState(account)
	provider := cliproxyapi.OpenAICompatibleProvider{
		Name:     strings.TrimSpace(account.Provider),
		Priority: account.Priority,
		Disabled: account.Disabled,
	}
	if credential != nil {
		if name := strings.TrimSpace(credential.ProviderName); name != "" {
			provider.Name = name
		}
		provider.BaseURL = strings.TrimSpace(credential.BaseURL)
		provider.Prefix = strings.TrimSpace(credential.Prefix)
		provider.APIKeyEntries = parseOpenAICompatibleAPIKeyEntriesJSON(credential.APIKeyEntriesJSON)
		provider.QuotaCurl = strings.TrimSpace(credential.QuotaCurl)
		provider.QuotaEnabled = credential.QuotaEnabled && provider.QuotaCurl != ""
		provider.BillingCurl = strings.TrimSpace(credential.BillingCurl)
		provider.BillingEnabled = credential.BillingEnabled && provider.BillingCurl != ""
		provider.PlatformCookie = strings.TrimSpace(credential.PlatformCookie)
		provider.CurlVariables = parseStringMapJSON(credential.CurlVariablesJSON)
		provider.Headers = parseStringMapJSON(credential.HeadersJSON)
		provider.FormatBaseURLs = parseStringMapJSON(credential.FormatBaseURLsJSON)
		provider.Models = parseOpenAICompatibleModelsJSON(credential.ModelsJSON)
	}
	record := BuildOpenAICompatibleProviderAccountRecord(provider)
	if credential != nil {
		record.ModelFetchAPIKey = strings.TrimSpace(credential.ModelFetchAPIKey)
		record.ModelFetchBaseURL = strings.TrimSpace(credential.ModelFetchBaseURL)
	}
	record.ID = strings.TrimSpace(account.AccountKey)
	record.Status = unifiedStatus(account)
	record.DisplayName = unifiedDisplayName(account, record.DisplayName)
	record.AuthIndex = strings.TrimSpace(account.AccountKey)
	record.QuotaKey = strings.TrimSpace(account.AccountKey)
	applyUnifiedRuntimeState(&record, runtimeState)
	return record
}

func unifiedDisplayName(account cliproxyapi.UnifiedAccount, fallback string) string {
	if title := strings.TrimSpace(account.Title); title != "" {
		return title
	}
	if fallback != "" {
		return fallback
	}
	return strings.TrimSpace(account.AccountKey)
}

func unifiedStatus(account cliproxyapi.UnifiedAccount) string {
	if account.Disabled {
		return "disabled"
	}
	if strings.EqualFold(strings.TrimSpace(account.CredentialStatus), "reauth_required") {
		return "error"
	}
	switch strings.TrimSpace(strings.ToLower(account.RuntimeRouteabilityStatus)) {
	case "registered_routeable":
		return "active"
	case "applied_not_registered":
		return "configured"
	case "degraded":
		return "error"
	case "pending":
		return "configured"
	}
	switch strings.TrimSpace(account.RuntimeApplyStatus) {
	case "failed":
		return "error"
	case "pending":
		return "configured"
	default:
		return "active"
	}
}

type unifiedRuntimeState struct {
	Status               string
	Reason               string
	FailureClass         string
	Routeable            bool
	RegisteredModelCount int
	RepairOutcome        string
	RepairAction         string
	RepairTriggerStatus  string
	RepairTriggerClass   string
	RepairTriggerReason  string
	LastRepairAtUnixMs   int64
}

func resolveUnifiedRuntimeState(account cliproxyapi.UnifiedAccount) unifiedRuntimeState {
	state := unifiedRuntimeState{
		Status:               strings.TrimSpace(strings.ToLower(account.RuntimeRouteabilityStatus)),
		Reason:               strings.TrimSpace(account.RuntimeRouteabilityReason),
		FailureClass:         strings.TrimSpace(account.RuntimeFailureClass),
		RegisteredModelCount: account.RuntimeRegisteredModelsCount,
		RepairOutcome:        strings.TrimSpace(account.RuntimeRepairOutcome),
		RepairAction:         strings.TrimSpace(account.RuntimeRepairAction),
		RepairTriggerStatus:  strings.TrimSpace(account.RuntimeRepairTriggerStatus),
		RepairTriggerClass:   strings.TrimSpace(account.RuntimeRepairTriggerClass),
		RepairTriggerReason:  strings.TrimSpace(account.RuntimeRepairTriggerReason),
		LastRepairAtUnixMs:   account.LastRuntimeRepairAtUnixMs,
	}

	switch state.Status {
	case "registered_routeable":
		state.Routeable = true
	case "applied_not_registered", "degraded", "pending", "reauth_required":
		state.Routeable = false
	default:
		state.Status = ""
	}

	if state.Status == "" {
		switch strings.TrimSpace(strings.ToLower(account.RuntimeApplyStatus)) {
		case "failed":
			state.Status = "degraded"
			state.FailureClass = "runtime_apply_failed"
			if state.Reason == "" {
				state.Reason = strings.TrimSpace(account.RuntimeApplyError)
			}
		case "pending":
			state.Status = "pending"
		case "applied":
			state.Status = "registered_routeable"
			state.Routeable = true
		}
	}

	if state.Status == "registered_routeable" {
		state.Routeable = true
	}
	if state.Status == "degraded" && state.Reason == "" {
		state.Reason = strings.TrimSpace(account.RuntimeApplyError)
	}
	if state.Status == "reauth_required" {
		state.FailureClass = "credential_not_ready"
		if state.Reason == "" {
			state.Reason = "credential requires sign-in"
		}
	}

	return state
}

func applyUnifiedRuntimeState(record *AccountRecord, state unifiedRuntimeState) {
	if record == nil {
		return
	}
	record.RuntimeStatus = state.Status
	record.RuntimeReason = state.Reason
	record.RuntimeFailureClass = state.FailureClass
	record.Routeable = state.Routeable
	record.RegisteredModelCount = state.RegisteredModelCount
	record.RuntimeRepairOutcome = state.RepairOutcome
	record.RuntimeRepairAction = state.RepairAction
	record.RuntimeRepairTriggerStatus = state.RepairTriggerStatus
	record.RuntimeRepairTriggerClass = state.RepairTriggerClass
	record.RuntimeRepairTriggerReason = state.RepairTriggerReason
	record.LastRuntimeRepairAtUnixMs = state.LastRepairAtUnixMs
	if state.Status == "degraded" && strings.TrimSpace(record.StatusMessage) == "" {
		record.StatusMessage = state.Reason
	}
}

func cloneCodexModels(items []cliproxyapi.CodexModel) []cliproxyapi.CodexModel {
	out := make([]cliproxyapi.CodexModel, 0, len(items))
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
		out = append(out, cliproxyapi.CodexModel{Name: name, Alias: alias})
	}
	return out
}

func parseCodexModelsJSON(raw string) []cliproxyapi.CodexModel {
	var items []cliproxyapi.CodexModel
	if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &items); err != nil {
		return nil
	}
	return cloneCodexModels(items)
}

func parseOpenAICompatibleModelsJSON(raw string) []cliproxyapi.OpenAICompatibleModel {
	var items []cliproxyapi.OpenAICompatibleModel
	if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &items); err != nil {
		return nil
	}
	return items
}

func parseOpenAICompatibleAPIKeyEntriesJSON(raw string) []cliproxyapi.OpenAICompatibleAPIKeyEntry {
	var items []cliproxyapi.OpenAICompatibleAPIKeyEntry
	if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &items); err != nil {
		return nil
	}
	return items
}

func parseStringMapJSON(raw string) map[string]string {
	var items map[string]string
	if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &items); err != nil {
		return nil
	}
	return cloneStringMap(items)
}

func parseStringListJSON(raw string) []string {
	var items []string
	if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &items); err != nil {
		return nil
	}
	return normalizeStringList(items)
}

func openAICompatibleModelsToCodexModels(items []cliproxyapi.OpenAICompatibleModel) []cliproxyapi.CodexModel {
	out := make([]cliproxyapi.CodexModel, 0, len(items))
	for _, item := range items {
		out = append(out, cliproxyapi.CodexModel{
			Name:  item.Name,
			Alias: item.Alias,
		})
	}
	return cloneCodexModels(out)
}

func normalizeStringList(items []string) []string {
	out := make([]string, 0, len(items))
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
		out = append(out, trimmed)
	}
	return out
}

func codexAPIKeyQuotaKey(key cliproxyapi.CodexAPIKey) string {
	if !key.QuotaEnabled || strings.TrimSpace(key.QuotaCurl) == "" {
		return ""
	}
	return codexAPIKeyRecordID(key)
}

func codexAPIKeyRecordID(key cliproxyapi.CodexAPIKey) string {
	if trimmed := strings.TrimSpace(key.LocalID); trimmed != "" {
		return trimmed
	}
	return CodexAPIKeyAssetID(key.APIKey, key.BaseURL, key.Prefix)
}

func CodexAPIKeyAssetID(apiKey string, baseURL string, prefix string) string {
	return "codex-api-key:" + APIKeyFingerprint(apiKey) + "@" + NormalizeBaseURL(baseURL) + "#" + NormalizePrefix(prefix)
}

func OpenAICompatibleProviderAssetID(name string) string {
	return "openai-compatible:" + strings.TrimSpace(name)
}

func providerStatus(disabled bool) string {
	if disabled {
		return "disabled"
	}
	return "configured"
}

func APIKeyFingerprint(apiKey string) string {
	trimmed := strings.TrimSpace(apiKey)
	if trimmed == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(trimmed))
	return hex.EncodeToString(sum[:])[:12]
}

func APIKeySuffix(apiKey string) string {
	trimmed := strings.TrimSpace(apiKey)
	if trimmed == "" {
		return ""
	}
	if len(trimmed) <= 4 {
		return trimmed
	}
	return trimmed[len(trimmed)-4:]
}

func NormalizeBaseURL(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}

	parsed, err := url.Parse(trimmed)
	if err != nil {
		return strings.TrimRight(strings.ToLower(trimmed), "/")
	}

	parsed.Scheme = strings.ToLower(parsed.Scheme)
	parsed.Host = strings.ToLower(parsed.Host)
	parsed.RawQuery = ""
	parsed.Fragment = ""
	normalized := strings.TrimRight(parsed.String(), "/")
	if normalized == "" {
		return strings.TrimRight(strings.ToLower(trimmed), "/")
	}
	return normalized
}

func NormalizePrefix(raw string) string {
	return strings.Trim(strings.TrimSpace(raw), "/")
}

func cloneStringMap(source map[string]string) map[string]string {
	if len(source) == 0 {
		return nil
	}
	cloned := make(map[string]string, len(source))
	for k, v := range source {
		cloned[k] = v
	}
	return cloned
}
