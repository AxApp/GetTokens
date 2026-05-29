package accounts

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/url"
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
	ID               string                   `json:"id"`
	AccountKind      string                   `json:"accountKind,omitempty"`
	Provider         string                   `json:"provider"`
	CredentialSource string                   `json:"credentialSource"`
	DisplayName      string                   `json:"displayName"`
	Status           string                   `json:"status"`
	StatusMessage    string                   `json:"statusMessage,omitempty"`
	Priority         int                      `json:"priority,omitempty"`
	Disabled         bool                     `json:"disabled,omitempty"`
	Email            string                   `json:"email,omitempty"`
	PlanType         string                   `json:"planType,omitempty"`
	Name             string                   `json:"name,omitempty"`
	APIKey           string                   `json:"apiKey,omitempty"`
	APIKeys          []string                 `json:"apiKeys,omitempty"`
	Headers          map[string]string        `json:"headers,omitempty"`
	Models           []cliproxyapi.CodexModel `json:"models,omitempty"`
	KeyFingerprint   string                   `json:"keyFingerprint,omitempty"`
	KeySuffix        string                   `json:"keySuffix,omitempty"`
	BaseURL          string                   `json:"baseUrl,omitempty"`
	Prefix           string                   `json:"prefix,omitempty"`
	ProxyURL         string                   `json:"proxyUrl,omitempty"`
	AuthIndex        interface{}              `json:"authIndex,omitempty"`
	QuotaKey         string                   `json:"quotaKey,omitempty"`
	QuotaCurl        string                   `json:"quotaCurl,omitempty"`
	QuotaEnabled     bool                     `json:"quotaEnabled,omitempty"`
	LocalOnly        bool                     `json:"localOnly,omitempty"`
	SupportedFormats []string                 `json:"supportedFormats,omitempty"`
	FormatBaseURLs   map[string]string        `json:"formatBaseUrls,omitempty"`
	BillingCurl      string                   `json:"billingCurl,omitempty"`
	BillingEnabled   bool                     `json:"billingEnabled,omitempty"`
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
		Models:           openAICompatibleModelsToCodexModels(provider.Models),
		KeyFingerprint:   APIKeyFingerprint(apiKey),
		KeySuffix:        APIKeySuffix(apiKey),
		BaseURL:          baseURL,
		Prefix:           prefix,
		ProxyURL:         proxyURL,
		SupportedFormats: resolveDefaultFormats(name),
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
		SupportedFormats: resolveDefaultFormats("codex"),
		FormatBaseURLs:   cloneStringMap(key.FormatBaseURLs),
		BillingCurl:      strings.TrimSpace(key.BillingCurl),
		BillingEnabled:   key.BillingEnabled && strings.TrimSpace(key.BillingCurl) != "",
	}
}

func BuildUnifiedAccountRecord(account cliproxyapi.UnifiedAccount) AccountRecord {
	switch account.Kind {
	case cliproxyapi.AccountKindAuthFile:
		return buildUnifiedAuthFileAccountRecord(account)
	case cliproxyapi.AccountKindCodexAPIKey:
		return buildUnifiedCodexAPIKeyAccountRecord(account)
	case cliproxyapi.AccountKindOpenAICompatible:
		return buildUnifiedOpenAICompatibleAccountRecord(account)
	default:
		return AccountRecord{
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
	file := AuthFileRecord{
		Name:     strings.TrimSpace(account.Title),
		Provider: strings.TrimSpace(account.Provider),
		Priority: account.Priority,
		Disabled: account.Disabled,
		Status:   unifiedStatus(account),
	}
	if credential != nil {
		if name := strings.TrimSpace(credential.SourceFileName); name != "" {
			file.Name = name
		}
		file.Type = strings.TrimSpace(credential.AuthType)
		file.Email = strings.TrimSpace(credential.Email)
		file.PlanType = strings.TrimSpace(credential.PlanType)
		file.Modified = credential.ModifiedUnixMs
		file.Size = credential.SizeBytes
	}
	record := BuildAuthFileAccountRecord(file)
	record.ID = strings.TrimSpace(account.AccountKey)
	record.DisplayName = unifiedDisplayName(account, record.DisplayName)
	record.AuthIndex = strings.TrimSpace(account.AccountKey)
	record.QuotaKey = strings.TrimSpace(account.AccountKey)
	record.LocalOnly = false
	return record
}

func buildUnifiedCodexAPIKeyAccountRecord(account cliproxyapi.UnifiedAccount) AccountRecord {
	credential := account.CodexAPIKey
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
	}
	record := BuildCodexAPIKeyAccountRecord(key)
	record.Status = unifiedStatus(account)
	record.AuthIndex = strings.TrimSpace(account.AccountKey)
	record.QuotaKey = strings.TrimSpace(account.AccountKey)
	record.DisplayName = unifiedDisplayName(account, record.DisplayName)
	return record
}

func buildUnifiedOpenAICompatibleAccountRecord(account cliproxyapi.UnifiedAccount) AccountRecord {
	credential := account.OpenAICompatible
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
		provider.Headers = parseStringMapJSON(credential.HeadersJSON)
		provider.Models = parseOpenAICompatibleModelsJSON(credential.ModelsJSON)
	}
	record := BuildOpenAICompatibleProviderAccountRecord(provider)
	record.ID = strings.TrimSpace(account.AccountKey)
	record.Status = unifiedStatus(account)
	record.DisplayName = unifiedDisplayName(account, record.DisplayName)
	record.AuthIndex = strings.TrimSpace(account.AccountKey)
	record.QuotaKey = strings.TrimSpace(account.AccountKey)
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
	switch strings.TrimSpace(account.RuntimeApplyStatus) {
	case "failed":
		return "error"
	case "pending":
		return "configured"
	default:
		return "active"
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
