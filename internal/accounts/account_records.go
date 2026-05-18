package accounts

import (
	"crypto/sha256"
	"encoding/hex"
	"net/url"
	"strings"

	"github.com/linhay/gettokens/internal/cliproxyapi"
)

const (
	CredentialSourceAuthFile = "auth-file"
	CredentialSourceAPIKey   = "api-key"
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
	ID               string      `json:"id"`
	Provider         string      `json:"provider"`
	CredentialSource string      `json:"credentialSource"`
	DisplayName      string      `json:"displayName"`
	Status           string      `json:"status"`
	StatusMessage    string      `json:"statusMessage,omitempty"`
	Priority         int         `json:"priority,omitempty"`
	Disabled         bool        `json:"disabled,omitempty"`
	Email            string      `json:"email,omitempty"`
	PlanType         string      `json:"planType,omitempty"`
	Name             string      `json:"name,omitempty"`
	APIKey           string      `json:"apiKey,omitempty"`
	KeyFingerprint   string      `json:"keyFingerprint,omitempty"`
	KeySuffix        string      `json:"keySuffix,omitempty"`
	BaseURL          string      `json:"baseUrl,omitempty"`
	Prefix           string      `json:"prefix,omitempty"`
	ProxyURL         string      `json:"proxyUrl,omitempty"`
	AuthIndex        interface{} `json:"authIndex,omitempty"`
	QuotaKey         string      `json:"quotaKey,omitempty"`
	QuotaCurl        string      `json:"quotaCurl,omitempty"`
	QuotaEnabled     bool        `json:"quotaEnabled,omitempty"`
	LocalOnly        bool        `json:"localOnly,omitempty"`
	SupportedFormats []string          `json:"supportedFormats,omitempty"`
	FormatBaseURLs   map[string]string `json:"formatBaseUrls,omitempty"`
	BillingCurl      string            `json:"billingCurl,omitempty"`
	BillingEnabled   bool              `json:"billingEnabled,omitempty"`
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
	for _, entry := range provider.APIKeyEntries {
		trimmed := strings.TrimSpace(entry.APIKey)
		if trimmed != "" {
			apiKey = trimmed
			proxyURL = strings.TrimSpace(entry.ProxyURL)
			break
		}
	}

	return AccountRecord{
		ID:               OpenAICompatibleProviderAssetID(name),
		Provider:         name,
		CredentialSource: CredentialSourceAPIKey,
		DisplayName:      "OPENAI-COMPATIBLE · " + strings.ToUpper(name),
		Status:           providerStatus(provider.Disabled),
		Priority:         provider.Priority,
		Disabled:         provider.Disabled,
		APIKey:           apiKey,
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
		Provider:         "codex",
		CredentialSource: CredentialSourceAPIKey,
		DisplayName:      displayName,
		Status:           status,
		Priority:         key.Priority,
		Disabled:         key.Disabled,
		APIKey:           strings.TrimSpace(key.APIKey),
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
