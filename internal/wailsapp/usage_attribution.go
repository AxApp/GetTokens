package wailsapp

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/linhay/gettokens/internal/cliproxyapi"
)

type SidecarUsageAttributionInput struct {
	Window             string `json:"window,omitempty"`
	Bucket             string `json:"bucket,omitempty"`
	IncludeUnresolved  bool   `json:"includeUnresolved,omitempty"`
	ResolveAccountKeys *bool  `json:"resolveAccountKeys,omitempty"`
}

type SidecarUsageAttributionResponse struct {
	Window      string                        `json:"window"`
	Bucket      string                        `json:"bucket"`
	GeneratedAt string                        `json:"generatedAt"`
	Items       []SidecarUsageAttributionItem `json:"items"`
	Unresolved  []SidecarUsageAttributionItem `json:"unresolved,omitempty"`
}

type SidecarUsageAttributionItem struct {
	AttributionKey    string                          `json:"attributionKey"`
	AttributionKind   string                          `json:"attributionKind"`
	AccountKey        string                          `json:"accountKey"`
	CredentialKey     string                          `json:"credentialKey,omitempty"`
	Provider          string                          `json:"provider"`
	RequestedModels   []string                        `json:"requestedModels"`
	RequestCount      int64                           `json:"requestCount"`
	FailedCount       int64                           `json:"failedCount"`
	LatencyAverageMs  int64                           `json:"latencyAverageMs,omitempty"`
	InputTokens       int64                           `json:"inputTokens"`
	CachedInputTokens int64                           `json:"cachedInputTokens"`
	OutputTokens      int64                           `json:"outputTokens"`
	TotalTokens       int64                           `json:"totalTokens"`
	LastActivityAt    string                          `json:"lastActivityAt,omitempty"`
	Buckets           []SidecarUsageAttributionBucket `json:"buckets"`
}

type SidecarUsageAttributionBucket struct {
	Start             string `json:"start"`
	RequestCount      int64  `json:"requestCount"`
	FailedCount       int64  `json:"failedCount"`
	InputTokens       int64  `json:"inputTokens"`
	CachedInputTokens int64  `json:"cachedInputTokens"`
	OutputTokens      int64  `json:"outputTokens"`
	TotalTokens       int64  `json:"totalTokens"`
}

type codexAttributionIdentityEntry struct {
	AuthIDs      []string `json:"authIDs,omitempty"`
	SourceHashes []string `json:"sourceHashes,omitempty"`
	APIKeyHashes []string `json:"apiKeyHashes,omitempty"`
	UpdatedAt    string   `json:"updatedAt,omitempty"`
}

type codexAttributionIdentityStore map[string]codexAttributionIdentityEntry

func (a *App) GetSidecarUsageAttribution(input SidecarUsageAttributionInput) (*SidecarUsageAttributionResponse, error) {
	startedAt := time.Now()
	resolveAccountKeys := input.ResolveAccountKeys == nil || *input.ResolveAccountKeys
	query := url.Values{}
	if window := strings.TrimSpace(input.Window); window != "" {
		query.Set("window", window)
	}
	if bucket := strings.TrimSpace(input.Bucket); bucket != "" {
		query.Set("bucket", bucket)
	}
	query.Set("include_unresolved", "true")

	sidecarStartedAt := time.Now()
	body, statusCode, err := a.SidecarRequest(http.MethodGet, ManagementAPIPrefix+"/gettokens/usage-attribution", query, nil, "")
	sidecarDurationMs := time.Since(sidecarStartedAt).Milliseconds()
	if err != nil {
		log.Printf(
			"usage attribution bridge failed status=%d resolve_account_keys=%t include_unresolved=%t sidecar_ms=%d total_ms=%d",
			statusCode,
			resolveAccountKeys,
			input.IncludeUnresolved,
			sidecarDurationMs,
			time.Since(startedAt).Milliseconds(),
		)
		return nil, err
	}
	var response SidecarUsageAttributionResponse
	if err := json.Unmarshal(body, &response); err != nil {
		log.Printf(
			"usage attribution bridge decode failed status=%d resolve_account_keys=%t include_unresolved=%t sidecar_ms=%d total_ms=%d",
			statusCode,
			resolveAccountKeys,
			input.IncludeUnresolved,
			sidecarDurationMs,
			time.Since(startedAt).Milliseconds(),
		)
		return nil, err
	}
	if response.Items == nil {
		response.Items = []SidecarUsageAttributionItem{}
	}
	if response.Unresolved == nil {
		response.Unresolved = []SidecarUsageAttributionItem{}
	}
	sidecarItems := len(response.Items)
	sidecarUnresolved := len(response.Unresolved)
	if !resolveAccountKeys {
		if !input.IncludeUnresolved {
			response.Unresolved = []SidecarUsageAttributionItem{}
		}
		log.Printf(
			"usage attribution bridge complete resolve_account_keys=false include_unresolved=%t sidecar_items=%d sidecar_unresolved=%d returned_items=%d returned_unresolved=%d sidecar_ms=%d total_ms=%d",
			input.IncludeUnresolved,
			sidecarItems,
			sidecarUnresolved,
			len(response.Items),
			len(response.Unresolved),
			sidecarDurationMs,
			time.Since(startedAt).Milliseconds(),
		)
		return &response, nil
	}
	resolveStartedAt := time.Now()
	resolved, err := a.resolveSidecarUsageAttributionAccountKeys(&response)
	resolveDurationMs := time.Since(resolveStartedAt).Milliseconds()
	if err != nil {
		log.Printf(
			"usage attribution bridge resolution failed include_unresolved=%t sidecar_items=%d sidecar_unresolved=%d sidecar_ms=%d resolve_ms=%d total_ms=%d",
			input.IncludeUnresolved,
			sidecarItems,
			sidecarUnresolved,
			sidecarDurationMs,
			resolveDurationMs,
			time.Since(startedAt).Milliseconds(),
		)
		return nil, err
	}
	if !input.IncludeUnresolved {
		resolved.Unresolved = []SidecarUsageAttributionItem{}
	}
	log.Printf(
		"usage attribution bridge complete resolve_account_keys=true include_unresolved=%t sidecar_items=%d sidecar_unresolved=%d returned_items=%d returned_unresolved=%d sidecar_ms=%d resolve_ms=%d total_ms=%d",
		input.IncludeUnresolved,
		sidecarItems,
		sidecarUnresolved,
		len(resolved.Items),
		len(resolved.Unresolved),
		sidecarDurationMs,
		resolveDurationMs,
		time.Since(startedAt).Milliseconds(),
	)
	return resolved, nil
}

func (a *App) resolveSidecarUsageAttributionAccountKeys(response *SidecarUsageAttributionResponse) (*SidecarUsageAttributionResponse, error) {
	if response == nil {
		return &SidecarUsageAttributionResponse{Items: []SidecarUsageAttributionItem{}}, nil
	}
	startedAt := time.Now()
	inputItems := len(response.Items)
	inputUnresolved := len(response.Unresolved)
	authIndexStartedAt := time.Now()
	authIndexIndex, err := a.loadAuthIndexAttributionIndex()
	authIndexDurationMs := time.Since(authIndexStartedAt).Milliseconds()
	authIndexFailed := err != nil
	if err != nil {
		authIndexIndex = map[string]string{}
	}
	identityStartedAt := time.Now()
	identityIndex, err := loadCodexAttributionIdentityIndex()
	identityDurationMs := time.Since(identityStartedAt).Milliseconds()
	if err != nil {
		log.Printf(
			"usage attribution account resolution failed stage=identity input_items=%d input_unresolved=%d auth_index_entries=%d auth_index_failed=%t auth_index_ms=%d identity_ms=%d total_ms=%d",
			inputItems,
			inputUnresolved,
			len(authIndexIndex),
			authIndexFailed,
			authIndexDurationMs,
			identityDurationMs,
			time.Since(startedAt).Milliseconds(),
		)
		return nil, err
	}
	providerStartedAt := time.Now()
	providerIndex, err := a.loadOpenAICompatibleAttributionIndex()
	providerDurationMs := time.Since(providerStartedAt).Milliseconds()
	providerFailed := err != nil
	if err != nil {
		providerIndex = map[string]string{}
	}

	items := make([]SidecarUsageAttributionItem, 0, len(response.Items)+len(response.Unresolved))
	unresolved := make([]SidecarUsageAttributionItem, 0, len(response.Unresolved))
	for _, item := range append(response.Items, response.Unresolved...) {
		resolved := resolveAttributionAccountKey(item, authIndexIndex, identityIndex, providerIndex)
		if strings.TrimSpace(resolved.AccountKey) == "" {
			unresolved = append(unresolved, resolved)
			continue
		}
		items = append(items, resolved)
	}
	sort.SliceStable(items, func(i, j int) bool {
		return items[i].AccountKey < items[j].AccountKey
	})
	sort.SliceStable(unresolved, func(i, j int) bool {
		return unresolved[i].AttributionKey < unresolved[j].AttributionKey
	})
	response.Items = items
	response.Unresolved = unresolved
	log.Printf(
		"usage attribution account resolution complete input_items=%d input_unresolved=%d output_items=%d output_unresolved=%d auth_index_entries=%d identity_entries=%d provider_entries=%d auth_index_failed=%t provider_failed=%t auth_index_ms=%d identity_ms=%d provider_ms=%d total_ms=%d",
		inputItems,
		inputUnresolved,
		len(items),
		len(unresolved),
		len(authIndexIndex),
		len(identityIndex),
		len(providerIndex),
		authIndexFailed,
		providerFailed,
		authIndexDurationMs,
		identityDurationMs,
		providerDurationMs,
		time.Since(startedAt).Milliseconds(),
	)
	return response, nil
}

func resolveAttributionAccountKey(
	item SidecarUsageAttributionItem,
	authIndexIndex map[string]string,
	identityIndex map[string]string,
	providerIndex map[string]string,
) SidecarUsageAttributionItem {
	if strings.TrimSpace(item.AccountKey) != "" {
		return item
	}
	if accountKey := authIndexIndex[strings.TrimSpace(item.AttributionKey)]; accountKey != "" {
		item.AccountKey = accountKey
		return item
	}
	if accountKey := identityIndex[strings.TrimSpace(item.AttributionKey)]; accountKey != "" {
		item.AccountKey = accountKey
		return item
	}
	if accountKey := providerIndex[strings.ToLower(strings.TrimSpace(item.Provider))]; accountKey != "" {
		item.AccountKey = accountKey
		return item
	}
	if strings.HasPrefix(item.AttributionKey, "provider:") {
		provider := strings.TrimPrefix(item.AttributionKey, "provider:")
		if accountKey := providerIndex[strings.ToLower(strings.TrimSpace(provider))]; accountKey != "" {
			item.AccountKey = accountKey
			return item
		}
	}
	return item
}

func (a *App) loadAuthIndexAttributionIndex() (map[string]string, error) {
	out := map[string]string{}
	accounts, err := a.managementClient().ListAccounts()
	if err != nil {
		return out, err
	}
	for _, account := range accounts {
		accountKey := strings.TrimSpace(account.AccountKey)
		if accountKey == "" {
			continue
		}
		switch account.Kind {
		case cliproxyapi.AccountKindAuthFile:
			out["auth-index:"+accountKey] = accountKey
		case cliproxyapi.AccountKindOpenAICompatible:
			if account.OpenAICompatible == nil {
				continue
			}
			var entries []cliproxyapi.OpenAICompatibleAPIKeyEntry
			_ = json.Unmarshal([]byte(strings.TrimSpace(account.OpenAICompatible.APIKeyEntriesJSON)), &entries)
			for _, entry := range entries {
				authIndex := strings.TrimSpace(entry.AuthIndex)
				if authIndex == "" {
					continue
				}
				out["auth-index:"+authIndex] = accountKey
			}
		}
	}
	return out, nil
}

func loadCodexAttributionIdentityIndex() (map[string]string, error) {
	store, err := loadCodexAttributionIdentityStore()
	if err != nil {
		return nil, err
	}
	index := map[string]string{}
	for localID, entry := range store {
		for _, authID := range entry.AuthIDs {
			if trimmed := strings.TrimSpace(authID); trimmed != "" {
				index["auth-id:"+trimmed] = localID
			}
		}
		for _, hash := range entry.SourceHashes {
			if trimmed := strings.TrimSpace(hash); trimmed != "" {
				index["source:"+trimmed] = localID
			}
		}
		for _, hash := range entry.APIKeyHashes {
			if trimmed := strings.TrimSpace(hash); trimmed != "" {
				index["api-key-hash:"+trimmed] = localID
			}
		}
	}
	return index, nil
}

func (a *App) loadOpenAICompatibleAttributionIndex() (map[string]string, error) {
	accounts, err := a.managementClient().ListAccounts()
	if err != nil {
		return nil, err
	}
	out := map[string]string{}
	for _, account := range accounts {
		if account.Kind != cliproxyapi.AccountKindOpenAICompatible {
			continue
		}
		provider := openAICompatibleProviderFromUnifiedAccount(account)
		name := strings.TrimSpace(provider.Name)
		accountKey := strings.TrimSpace(provider.AccountKey)
		if name == "" || accountKey == "" {
			continue
		}
		out[strings.ToLower(name)] = accountKey
	}
	return out, nil
}

func rememberCodexAPIKeyAttributionIdentities(items []cliproxyapi.CodexAPIKeyInput) error {
	store, err := loadCodexAttributionIdentityStore()
	if err != nil {
		return err
	}
	changed := false
	for _, item := range items {
		localID := strings.TrimSpace(item.LocalID)
		apiKey := strings.TrimSpace(item.APIKey)
		baseURL := strings.TrimSpace(item.BaseURL)
		if localID == "" || apiKey == "" || baseURL == "" {
			continue
		}
		entry := store[localID]
		entry.AuthIDs = appendUniqueString(entry.AuthIDs, buildStableRouteAuthID("codex:apikey", apiKey, baseURL))
		hash := usageAttributionEvidenceHash(apiKey)
		entry.SourceHashes = appendUniqueString(entry.SourceHashes, hash)
		entry.APIKeyHashes = appendUniqueString(entry.APIKeyHashes, hash)
		entry.UpdatedAt = nowRFC3339()
		store[localID] = entry
		changed = true
	}
	if !changed {
		return nil
	}
	return saveCodexAttributionIdentityStore(store)
}

func codexAttributionIdentityStorePath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".config", "gettokens-data", "codex-api-key-attribution-identities-v1.json"), nil
}

func loadCodexAttributionIdentityStore() (codexAttributionIdentityStore, error) {
	path, err := codexAttributionIdentityStorePath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return codexAttributionIdentityStore{}, nil
		}
		return nil, err
	}
	var store codexAttributionIdentityStore
	if err := json.Unmarshal(data, &store); err != nil {
		return nil, err
	}
	if store == nil {
		store = codexAttributionIdentityStore{}
	}
	return store, nil
}

func saveCodexAttributionIdentityStore(store codexAttributionIdentityStore) error {
	path, err := codexAttributionIdentityStorePath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(store, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}

func usageAttributionEvidenceHash(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])[:16]
}

func appendUniqueString(items []string, value string) []string {
	value = strings.TrimSpace(value)
	if value == "" {
		return items
	}
	for _, item := range items {
		if item == value {
			return items
		}
	}
	return append(items, value)
}

func nowRFC3339() string {
	return time.Now().UTC().Format(time.RFC3339)
}
