package cliproxyapi

type CodexModel struct {
	Name  string `json:"name"`
	Alias string `json:"alias"`
}

type CodexAPIKey struct {
	LocalID        string            `json:"local-id,omitempty"`
	APIKey         string            `json:"api-key"`
	Label          string            `json:"label,omitempty"`
	Priority       int               `json:"priority,omitempty"`
	Disabled       bool              `json:"disabled,omitempty"`
	Prefix         string            `json:"prefix,omitempty"`
	BaseURL        string            `json:"base-url"`
	FormatBaseURLs map[string]string `json:"format-base-urls,omitempty"`
	Websockets     bool              `json:"websockets,omitempty"`
	ProxyURL       string            `json:"proxy-url,omitempty"`
	Models         []CodexModel      `json:"models,omitempty"`
	Headers        map[string]string `json:"headers,omitempty"`
	ExcludedModels []string          `json:"excluded-models,omitempty"`
	AuthIndex      string            `json:"auth-index,omitempty"`
	QuotaCurl      string            `json:"quota-curl,omitempty"`
	QuotaEnabled   bool              `json:"quota-enabled,omitempty"`
	BillingCurl    string            `json:"billing-curl,omitempty"`
	BillingEnabled bool              `json:"billing-enabled,omitempty"`
	PlatformCookie string            `json:"platform-cookie,omitempty"`
}

type CodexAPIKeysResponse struct {
	Items []CodexAPIKey `json:"codex-api-key"`
}

type CodexAPIKeyInput struct {
	LocalID        string            `json:"local-id,omitempty"`
	APIKey         string            `json:"api-key"`
	Label          string            `json:"label,omitempty"`
	Priority       int               `json:"priority,omitempty"`
	Disabled       bool              `json:"disabled,omitempty"`
	Prefix         string            `json:"prefix,omitempty"`
	BaseURL        string            `json:"base-url"`
	FormatBaseURLs map[string]string `json:"format-base-urls,omitempty"`
	Websockets     bool              `json:"websockets,omitempty"`
	ProxyURL       string            `json:"proxy-url,omitempty"`
	Models         []CodexModel      `json:"models,omitempty"`
	Headers        map[string]string `json:"headers,omitempty"`
	ExcludedModels []string          `json:"excluded-models,omitempty"`
	QuotaCurl      string            `json:"quota-curl,omitempty"`
	QuotaEnabled   bool              `json:"quota-enabled,omitempty"`
	BillingCurl    string            `json:"billing-curl,omitempty"`
	BillingEnabled bool              `json:"billing-enabled,omitempty"`
	PlatformCookie string            `json:"platform-cookie,omitempty"`
}

type CodexAPIKeyPatch struct {
	APIKey         *string            `json:"api-key,omitempty"`
	Disabled       *bool              `json:"disabled,omitempty"`
	Prefix         *string            `json:"prefix,omitempty"`
	BaseURL        *string            `json:"base-url,omitempty"`
	ProxyURL       *string            `json:"proxy-url,omitempty"`
	Models         *[]CodexModel      `json:"models,omitempty"`
	Headers        *map[string]string `json:"headers,omitempty"`
	ExcludedModels *[]string          `json:"excluded-models,omitempty"`
}

type OpenAICompatibleAPIKeyEntry struct {
	APIKey    string `json:"api-key"`
	ProxyURL  string `json:"proxy-url,omitempty"`
	AuthIndex string `json:"auth-index,omitempty"`
}

type OpenAICompatibleModel struct {
	Name  string `json:"name"`
	Alias string `json:"alias"`
}

type OAuthModelAlias struct {
	Name  string `json:"name"`
	Alias string `json:"alias"`
	Fork  bool   `json:"fork,omitempty"`
}

type OAuthModelAliasesResponse struct {
	Items map[string][]OAuthModelAlias `json:"oauth-model-alias"`
}

type OpenAICompatibleProvider struct {
	Name           string                        `json:"name"`
	Priority       int                           `json:"priority,omitempty"`
	Disabled       bool                          `json:"disabled,omitempty"`
	Prefix         string                        `json:"prefix,omitempty"`
	BaseURL        string                        `json:"base-url"`
	APIKeyEntries  []OpenAICompatibleAPIKeyEntry `json:"api-key-entries,omitempty"`
	Models         []OpenAICompatibleModel       `json:"models,omitempty"`
	Headers        map[string]string             `json:"headers,omitempty"`
	FormatBaseURLs map[string]string             `json:"format-base-urls,omitempty"`
}

type OpenAICompatibleProvidersResponse struct {
	Items []OpenAICompatibleProvider `json:"openai-compatibility"`
}

type AccountKind string

const (
	AccountKindAuthFile         AccountKind = "auth-file"
	AccountKindCodexAPIKey      AccountKind = "codex-api-key"
	AccountKindOpenAICompatible AccountKind = "openai-compatible"
)

type AccountCredentialSource string

const (
	AccountCredentialSourceSidecarManagementAPI AccountCredentialSource = "sidecar-management-api"
)

type AuthFileAccountCredential struct {
	SourceFileName string `json:"source_file_name,omitempty"`
	AuthJSON       string `json:"auth_json,omitempty"`
	AuthType       string `json:"auth_type,omitempty"`
	Email          string `json:"email,omitempty"`
	PlanType       string `json:"plan_type,omitempty"`
	ModifiedUnixMs int64  `json:"modified_unix_ms,omitempty"`
	SizeBytes      int64  `json:"size_bytes,omitempty"`
}

type CodexAPIKeyAccountCredential struct {
	APIKey             string `json:"api_key"`
	APIKeyFingerprint  string `json:"api_key_fingerprint,omitempty"`
	BaseURL            string `json:"base_url"`
	Prefix             string `json:"prefix,omitempty"`
	ProxyURL           string `json:"proxy_url,omitempty"`
	Websockets         bool   `json:"websockets"`
	QuotaCurl          string `json:"quota_curl,omitempty"`
	QuotaEnabled       bool   `json:"quota_enabled,omitempty"`
	BillingCurl        string `json:"billing_curl,omitempty"`
	BillingEnabled     bool   `json:"billing_enabled,omitempty"`
	PlatformCookie     string `json:"platform_cookie,omitempty"`
	FormatBaseURLsJSON string `json:"format_base_urls_json,omitempty"`
	HeadersJSON        string `json:"headers_json,omitempty"`
	ModelsJSON         string `json:"models_json,omitempty"`
	ExcludedModelsJSON string `json:"excluded_models_json,omitempty"`
}

type OpenAICompatibleAccountCredential struct {
	ProviderName       string `json:"provider_name"`
	RuntimeProviderKey string `json:"runtime_provider_key,omitempty"`
	BaseURL            string `json:"base_url"`
	Prefix             string `json:"prefix,omitempty"`
	APIKeyEntriesJSON  string `json:"api_key_entries_json"`
	HeadersJSON        string `json:"headers_json,omitempty"`
	FormatBaseURLsJSON string `json:"format_base_urls_json,omitempty"`
	ModelsJSON         string `json:"models_json,omitempty"`
	ModelFetchAPIKey   string `json:"model_fetch_api_key,omitempty"`
	ModelFetchBaseURL  string `json:"model_fetch_base_url,omitempty"`
}

type UnifiedAccount struct {
	AccountKey         string                  `json:"account_key"`
	Kind               AccountKind             `json:"kind"`
	Title              string                  `json:"title"`
	Provider           string                  `json:"provider"`
	CredentialSource   AccountCredentialSource `json:"credential_source"`
	Priority           int                     `json:"priority"`
	Disabled           bool                    `json:"disabled"`
	Revision           int                     `json:"revision"`
	MetadataJSON       string                  `json:"metadata_json,omitempty"`
	CreatedAtUnixMs    int64                   `json:"created_at_unix_ms,omitempty"`
	UpdatedAtUnixMs    int64                   `json:"updated_at_unix_ms,omitempty"`
	DeletedAtUnixMs    int64                   `json:"deleted_at_unix_ms,omitempty"`
	RuntimeApplyStatus string                  `json:"runtime_apply_status,omitempty"`
	RuntimeApplyError  string                  `json:"runtime_apply_error,omitempty"`

	AuthFile         *AuthFileAccountCredential         `json:"auth_file,omitempty"`
	CodexAPIKey      *CodexAPIKeyAccountCredential      `json:"codex_api_key,omitempty"`
	OpenAICompatible *OpenAICompatibleAccountCredential `json:"openai_compatible,omitempty"`
}

type UnifiedAccountsResponse struct {
	Items []UnifiedAccount `json:"accounts"`
}

type AccountMigrationCandidate struct {
	AccountKey        string                  `json:"account_key"`
	Kind              AccountKind             `json:"kind"`
	Title             string                  `json:"title"`
	Provider          string                  `json:"provider"`
	CredentialSource  AccountCredentialSource `json:"credential_source"`
	Priority          int                     `json:"priority"`
	Disabled          bool                    `json:"disabled"`
	LegacyID          string                  `json:"legacy_id"`
	SourcePath        string                  `json:"source_path,omitempty"`
	SourceKey         string                  `json:"source_key,omitempty"`
	SourceFingerprint string                  `json:"source_fingerprint,omitempty"`
}

type AccountMigrationReport struct {
	GeneratedAtUnixMs int64                       `json:"generated_at_unix_ms"`
	Candidates        []AccountMigrationCandidate `json:"candidates"`
	Warnings          []string                    `json:"warnings,omitempty"`
}

type AccountMigrationCommitReport struct {
	Imported int      `json:"imported"`
	Skipped  int      `json:"skipped"`
	Errors   []string `json:"errors,omitempty"`
}

type AccountMigrationDeleteResult struct {
	Deleted   int                                `json:"deleted"`
	BackupDir string                             `json:"backup_dir,omitempty"`
	Items     []AccountMigrationDeleteResultItem `json:"items,omitempty"`
}

type AccountMigrationDeleteResultItem struct {
	ID         string `json:"id"`
	SourceKind string `json:"source_kind"`
	SourcePath string `json:"source_path,omitempty"`
	BackupPath string `json:"backup_path,omitempty"`
	Deleted    bool   `json:"deleted"`
}

type AccountWriteRequest struct {
	Kind             AccountKind                        `json:"kind"`
	Title            string                             `json:"title,omitempty"`
	Provider         string                             `json:"provider,omitempty"`
	Priority         int                                `json:"priority,omitempty"`
	Disabled         bool                               `json:"disabled,omitempty"`
	AuthFile         *AuthFileAccountCredential         `json:"auth_file,omitempty"`
	CodexAPIKey      *CodexAPIKeyAccountCredential      `json:"codex_api_key,omitempty"`
	OpenAICompatible *OpenAICompatibleAccountCredential `json:"openai_compatible,omitempty"`
}

type AccountStoreDiagnostics struct {
	PathBasename string                              `json:"path_basename"`
	Configured   bool                                `json:"configured"`
	Open         bool                                `json:"open"`
	ReadRecovery AccountStoreReadRecoveryDiagnostics `json:"read_recovery"`
}

type AccountStoreReadRecoveryDiagnostics struct {
	Count             int    `json:"count"`
	LastEndpoint      string `json:"last_endpoint"`
	LastRecovered     bool   `json:"last_recovered"`
	LastError         string `json:"last_error"`
	LastRecoveredUnix int64  `json:"last_recovered_at_unix_ms"`
}

type RateLimitStrategyMeta struct {
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	SupportedWindows []string `json:"supported_windows"`
}

type RateLimitRule struct {
	ID         string `json:"id,omitempty"`
	AccountKey string `json:"account_key"`
	Strategy   string `json:"strategy"`
	Window     string `json:"window"`
	LimitValue int64  `json:"limit_value"`
	Action     string `json:"action"`
	Enabled    bool   `json:"enabled"`
	Label      string `json:"label,omitempty"`
	CreatedAt  int64  `json:"created_at,omitempty"`
	UpdatedAt  int64  `json:"updated_at,omitempty"`
}

type RateLimitRuleState struct {
	Rule         RateLimitRule `json:"rule"`
	Exceeded     bool          `json:"exceeded"`
	Reason       string        `json:"reason,omitempty"`
	UsagePct     float64       `json:"usage_pct"`
	CurrentUsage int64         `json:"current_usage"`
	LimitValue   int64         `json:"limit_value"`
	WindowStart  string        `json:"window_start,omitempty"`
	WindowEnd    string        `json:"window_end,omitempty"`
	NextReset    string        `json:"next_reset,omitempty"`
}

type RateLimitSourceState struct {
	Source      string `json:"source"`
	Reason      string `json:"reason,omitempty"`
	RuleID      string `json:"rule_id,omitempty"`
	Strategy    string `json:"strategy,omitempty"`
	Window      string `json:"window,omitempty"`
	UsageValue  int64  `json:"usage_value,omitempty"`
	LimitValue  int64  `json:"limit_value,omitempty"`
	WindowStart string `json:"window_start,omitempty"`
	WindowEnd   string `json:"window_end,omitempty"`
	NextReset   string `json:"next_reset,omitempty"`
}

type RateLimitState struct {
	AccountKey      string                 `json:"account_key"`
	Blocked         bool                   `json:"blocked"`
	BlockReason     string                 `json:"block_reason,omitempty"`
	Sources         []RateLimitSourceState `json:"sources"`
	Rules           []RateLimitRuleState   `json:"rules"`
	UpdatedAt       string                 `json:"updated_at,omitempty"`
	LastEvaluatedAt string                 `json:"last_evaluated_at,omitempty"`
	NextReset       string                 `json:"next_reset,omitempty"`
	Stale           bool                   `json:"stale,omitempty"`
	DegradedReason  string                 `json:"degraded_reason,omitempty"`
}

type RateLimitEvent struct {
	ID          string `json:"id"`
	AccountKey  string `json:"account_key"`
	RuleID      string `json:"rule_id"`
	Strategy    string `json:"strategy"`
	Window      string `json:"window"`
	Action      string `json:"action"`
	UsageValue  int64  `json:"usage_value"`
	LimitValue  int64  `json:"limit_value"`
	Blocked     bool   `json:"blocked"`
	Reason      string `json:"reason,omitempty"`
	TriggeredAt int64  `json:"triggered_at"`
}

const (
	QuotaRuntimeStatusSuccess  = "success"
	QuotaRuntimeStatusError    = "error"
	QuotaRuntimeStatusStale    = "stale"
	QuotaRuntimeStatusDegraded = "degraded"
)

type QuotaRuntimeWindow struct {
	ID               string   `json:"id"`
	Label            string   `json:"label"`
	RemainingPercent *int     `json:"remaining_percent,omitempty"`
	UsedTokens       *float64 `json:"used_tokens,omitempty"`
	LimitTokens      *float64 `json:"limit_tokens,omitempty"`
	RemainingTokens  *float64 `json:"remaining_tokens,omitempty"`
	ResetLabel       string   `json:"reset_label,omitempty"`
	ResetAtUnix      int64    `json:"reset_at_unix,omitempty"`
}

type QuotaRuntimeBilling struct {
	IsAvailable  bool                      `json:"is_available"`
	BalanceInfos []QuotaRuntimeBalanceInfo `json:"balance_infos"`
}

type QuotaRuntimeBalanceInfo struct {
	Currency        string `json:"currency"`
	TotalBalance    string `json:"total_balance"`
	GrantedBalance  string `json:"granted_balance"`
	ToppedUpBalance string `json:"topped_up_balance"`
}

type QuotaRuntimeSourceState struct {
	Source    string `json:"source"`
	Reason    string `json:"reason,omitempty"`
	ExpiresAt string `json:"expires_at,omitempty"`
	NextReset string `json:"next_reset,omitempty"`
}

type QuotaRuntimeState struct {
	AccountKey      string                    `json:"account_key"`
	Source          string                    `json:"source,omitempty"`
	Status          string                    `json:"status"`
	PlanType        string                    `json:"plan_type,omitempty"`
	Windows         []QuotaRuntimeWindow      `json:"windows"`
	Billing         *QuotaRuntimeBilling      `json:"billing,omitempty"`
	UpdatedAt       string                    `json:"updated_at,omitempty"`
	LastEvaluatedAt string                    `json:"last_evaluated_at,omitempty"`
	Stale           bool                      `json:"stale,omitempty"`
	DegradedReason  string                    `json:"degraded_reason,omitempty"`
	Blocked         bool                      `json:"blocked"`
	BlockReason     string                    `json:"block_reason,omitempty"`
	Sources         []QuotaRuntimeSourceState `json:"sources"`
}

type QuotaCurlTestInput struct {
	APIKey         string `json:"api_key"`
	BaseURL        string `json:"base_url"`
	Prefix         string `json:"prefix,omitempty"`
	QuotaCurl      string `json:"quota_curl,omitempty"`
	BillingCurl    string `json:"billing_curl,omitempty"`
	PlatformCookie string `json:"platform_cookie,omitempty"`
	AccountKey     string `json:"account_key,omitempty"`
}
