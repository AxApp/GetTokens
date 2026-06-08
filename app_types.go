package main

type AuthFileItem struct {
	Name          string      `json:"name"`
	Type          string      `json:"type,omitempty"`
	Provider      string      `json:"provider,omitempty"`
	Email         string      `json:"email,omitempty"`
	PlanType      string      `json:"planType,omitempty"`
	Size          int64       `json:"size,omitempty"`
	AuthIndex     interface{} `json:"authIndex,omitempty"`
	RuntimeOnly   bool        `json:"runtimeOnly,omitempty"`
	Disabled      bool        `json:"disabled,omitempty"`
	Unavailable   bool        `json:"unavailable,omitempty"`
	Status        string      `json:"status,omitempty"`
	StatusMessage string      `json:"statusMessage,omitempty"`
	LastRefresh   interface{} `json:"lastRefresh,omitempty"`
	Modified      int64       `json:"modified,omitempty"`
}

type AuthFilesResponse struct {
	Files []AuthFileItem `json:"files"`
	Total int            `json:"total,omitempty"`
}

type UploadFilePayload struct {
	Name          string `json:"name"`
	ContentBase64 string `json:"contentBase64"`
}

type DownloadFileResponse struct {
	Name          string `json:"name"`
	ContentBase64 string `json:"contentBase64"`
}

type OAuthStartResult struct {
	URL   string `json:"url"`
	State string `json:"state,omitempty"`
}

type OAuthStatusResult struct {
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
}

type CompleteCodexOAuthInput struct {
	ExistingName  string   `json:"existingName"`
	PreviousNames []string `json:"previousNames"`
}

type CodexQuotaWindow struct {
	ID               string   `json:"id"`
	Label            string   `json:"label"`
	RemainingPercent *int     `json:"remainingPercent,omitempty"`
	UsedTokens       *float64 `json:"usedTokens,omitempty"`
	LimitTokens      *float64 `json:"limitTokens,omitempty"`
	RemainingTokens  *float64 `json:"remainingTokens,omitempty"`
	ResetLabel       string   `json:"resetLabel"`
	ResetAtUnix      int64    `json:"resetAtUnix,omitempty"`
}

type CodexQuotaResponse struct {
	AccountKey      string                  `json:"accountKey,omitempty"`
	Source          string                  `json:"source,omitempty"`
	Status          string                  `json:"status,omitempty"`
	PlanType        string                  `json:"planType,omitempty"`
	Windows         []CodexQuotaWindow      `json:"windows"`
	Billing         *CodexQuotaBillingInfo  `json:"billing,omitempty"`
	UpdatedAt       string                  `json:"updatedAt,omitempty"`
	LastEvaluatedAt string                  `json:"lastEvaluatedAt,omitempty"`
	Stale           bool                    `json:"stale,omitempty"`
	DegradedReason  string                  `json:"degradedReason,omitempty"`
	Blocked         bool                    `json:"blocked"`
	BlockReason     string                  `json:"blockReason,omitempty"`
	Sources         []CodexQuotaSourceState `json:"sources"`
}

type CodexQuotaSourceState struct {
	Source    string `json:"source"`
	Reason    string `json:"reason,omitempty"`
	ExpiresAt string `json:"expiresAt,omitempty"`
	NextReset string `json:"nextReset,omitempty"`
}

type CodexQuotaBillingInfo struct {
	IsAvailable  bool                           `json:"isAvailable"`
	BalanceInfos []CodexQuotaBillingBalanceInfo `json:"balanceInfos"`
}

type CodexQuotaBillingBalanceInfo struct {
	Currency        string `json:"currency"`
	TotalBalance    string `json:"totalBalance"`
	GrantedBalance  string `json:"grantedBalance"`
	ToppedUpBalance string `json:"toppedUpBalance"`
}

type AccountRecord struct {
	ID                string                  `json:"id"`
	AccountKind       string                  `json:"accountKind,omitempty"`
	Provider          string                  `json:"provider"`
	CredentialSource  string                  `json:"credentialSource"`
	DisplayName       string                  `json:"displayName"`
	Status            string                  `json:"status"`
	StatusMessage     string                  `json:"statusMessage,omitempty"`
	Priority          int                     `json:"priority,omitempty"`
	Disabled          bool                    `json:"disabled,omitempty"`
	Email             string                  `json:"email,omitempty"`
	PlanType          string                  `json:"planType,omitempty"`
	Name              string                  `json:"name,omitempty"`
	APIKey            string                  `json:"apiKey,omitempty"`
	APIKeys           []string                `json:"apiKeys,omitempty"`
	Headers           map[string]string       `json:"headers,omitempty"`
	Models            []OpenAICompatibleModel `json:"models,omitempty"`
	KeyFingerprint    string                  `json:"keyFingerprint,omitempty"`
	KeySuffix         string                  `json:"keySuffix,omitempty"`
	BaseURL           string                  `json:"baseUrl,omitempty"`
	Prefix            string                  `json:"prefix,omitempty"`
	ProxyURL          string                  `json:"proxyUrl,omitempty"`
	AuthIndex         interface{}             `json:"authIndex,omitempty"`
	QuotaKey          string                  `json:"quotaKey,omitempty"`
	QuotaCurl         string                  `json:"quotaCurl,omitempty"`
	QuotaEnabled      bool                    `json:"quotaEnabled,omitempty"`
	LocalOnly         bool                    `json:"localOnly,omitempty"`
	SupportedFormats  []string                `json:"supportedFormats,omitempty"`
	FormatBaseURLs    map[string]string       `json:"formatBaseUrls,omitempty"`
	BillingCurl       string                  `json:"billingCurl,omitempty"`
	BillingEnabled    bool                    `json:"billingEnabled,omitempty"`
	PlatformCookie    string                  `json:"platformCookie,omitempty"`
	CurlVariables     map[string]string       `json:"curlVariables,omitempty"`
	ModelFetchAPIKey  string                  `json:"modelFetchApiKey,omitempty"`
	ModelFetchBaseURL string                  `json:"modelFetchBaseUrl,omitempty"`
	Requestability    AccountRequestability   `json:"requestability,omitempty"`
}

type AccountRequestability struct {
	Evidence []string `json:"evidence,omitempty"`
	Manual   bool     `json:"manual,omitempty"`
}

type AccountMigrationPreview struct {
	Status            string                        `json:"status"`
	AccountCount      int                           `json:"accountCount"`
	CandidateCount    int                           `json:"candidateCount"`
	KindSummary       []AccountMigrationKindSummary `json:"kindSummary"`
	Warnings          []string                      `json:"warnings,omitempty"`
	GeneratedAtUnixMs int64                         `json:"generatedAtUnixMs,omitempty"`
	BackupHint        string                        `json:"backupHint"`
}

type AccountMigrationKindSummary struct {
	Kind  string `json:"kind"`
	Count int    `json:"count"`
}

type AccountMigrationCommitResult struct {
	Imported int                      `json:"imported"`
	Skipped  int                      `json:"skipped"`
	Errors   []string                 `json:"errors,omitempty"`
	Preview  *AccountMigrationPreview `json:"preview,omitempty"`
}

type AccountMigrationDeleteResult struct {
	Deleted   int                      `json:"deleted"`
	BackupDir string                   `json:"backupDir,omitempty"`
	Preview   *AccountMigrationPreview `json:"preview,omitempty"`
}

type CreateCodexAPIKeyInput struct {
	APIKey         string                  `json:"apiKey"`
	Label          string                  `json:"label,omitempty"`
	BaseURL        string                  `json:"baseUrl"`
	FormatBaseURLs map[string]string       `json:"formatBaseUrls,omitempty"`
	Priority       int                     `json:"priority,omitempty"`
	Prefix         string                  `json:"prefix,omitempty"`
	ProxyURL       string                  `json:"proxyUrl,omitempty"`
	Headers        map[string]string       `json:"headers,omitempty"`
	Models         []OpenAICompatibleModel `json:"models,omitempty"`
	ExcludedModels []string                `json:"excludedModels,omitempty"`
	QuotaCurl      string                  `json:"quotaCurl,omitempty"`
	QuotaEnabled   bool                    `json:"quotaEnabled,omitempty"`
	BillingCurl    string                  `json:"billingCurl,omitempty"`
	BillingEnabled bool                    `json:"billingEnabled,omitempty"`
	PlatformCookie string                  `json:"platformCookie,omitempty"`
	CurlVariables  map[string]string       `json:"curlVariables,omitempty"`
}

type UpdateCodexAPIKeyPriorityInput struct {
	ID       string `json:"id"`
	Priority int    `json:"priority,omitempty"`
}

type UpdateCodexAPIKeyLabelInput struct {
	ID    string `json:"id"`
	Label string `json:"label,omitempty"`
}

type UpdateCodexAPIKeyConfigInput struct {
	ID             string                  `json:"id"`
	APIKey         string                  `json:"apiKey"`
	BaseURL        string                  `json:"baseUrl"`
	FormatBaseURLs map[string]string       `json:"formatBaseUrls,omitempty"`
	Prefix         string                  `json:"prefix,omitempty"`
	ProxyURL       string                  `json:"proxyUrl,omitempty"`
	Models         []OpenAICompatibleModel `json:"models,omitempty"`
	QuotaCurl      string                  `json:"quotaCurl,omitempty"`
	QuotaEnabled   bool                    `json:"quotaEnabled,omitempty"`
	BillingCurl    string                  `json:"billingCurl,omitempty"`
	BillingEnabled bool                    `json:"billingEnabled,omitempty"`
	PlatformCookie string                  `json:"platformCookie,omitempty"`
	CurlVariables  map[string]string       `json:"curlVariables,omitempty"`
}

type TestCodexAPIKeyQuotaCurlInput struct {
	APIKey         string            `json:"apiKey"`
	BaseURL        string            `json:"baseUrl"`
	Prefix         string            `json:"prefix,omitempty"`
	QuotaCurl      string            `json:"quotaCurl"`
	PlatformCookie string            `json:"platformCookie,omitempty"`
	CurlVariables  map[string]string `json:"curlVariables,omitempty"`
}

type UpdateAccountPriorityInput struct {
	ID       string `json:"id"`
	Priority int    `json:"priority,omitempty"`
}

type ProbeCodexAccountRoutingInput struct {
	Model           string   `json:"model"`
	Attempts        int      `json:"attempts,omitempty"`
	AllowAccountIDs []string `json:"allowAccountIDs,omitempty"`
	DenyAccountIDs  []string `json:"denyAccountIDs,omitempty"`
	OrderAccountIDs []string `json:"orderAccountIDs,omitempty"`
	AllowFallback   bool     `json:"allowFallback,omitempty"`
}

type ProbeClaudeCodeAccountRoutingInput struct {
	Model           string   `json:"model"`
	Attempts        int      `json:"attempts,omitempty"`
	AllowAccountIDs []string `json:"allowAccountIDs,omitempty"`
	DenyAccountIDs  []string `json:"denyAccountIDs,omitempty"`
	OrderAccountIDs []string `json:"orderAccountIDs,omitempty"`
	AllowFallback   bool     `json:"allowFallback,omitempty"`
}

type ChannelGroupState struct {
	Enabled    bool `json:"enabled"`
	RouteOrder *int `json:"routeOrder,omitempty"`
}

type ChannelAccountGroup struct {
	ID         string   `json:"id"`
	Name       string   `json:"name,omitempty"`
	Enabled    bool     `json:"enabled"`
	RouteOrder int      `json:"routeOrder,omitempty"`
	AccountIDs []string `json:"accountIDs"`
}

type ChannelRoutingConfig struct {
	Channel                     string                       `json:"channel"`
	RouteMode                   string                       `json:"routeMode"`
	OrderedAccountIDs           []string                     `json:"orderedAccountIDs"`
	ManualRequestableAccountIDs []string                     `json:"manualRequestableAccountIDs,omitempty"`
	AccountGroups               []ChannelAccountGroup        `json:"accountGroups,omitempty"`
	ChannelGroupStates          map[string]ChannelGroupState `json:"channelGroupStates"`
	ShadowEnabled               bool                         `json:"shadowEnabled,omitempty"`
	ShadowRouteMode             string                       `json:"shadowRouteMode,omitempty"`
}

type ChannelRoutingConfigMeta struct {
	InvalidModes []string `json:"invalidModes,omitempty"`
}

type ChannelRoutingExplainInput struct {
	Channel              string         `json:"channel,omitempty"`
	TriedAccountIDs      []string       `json:"triedAccountIDs,omitempty"`
	ActiveSessions       map[string]int `json:"activeSessions,omitempty"`
	StickyAccountID      string         `json:"stickyAccountID,omitempty"`
	ProjectKey           string         `json:"projectKey,omitempty"`
	ProjectName          string         `json:"projectName,omitempty"`
	ProjectKeySource     string         `json:"projectKeySource,omitempty"`
	ProjectKeyConfidence string         `json:"projectKeyConfidence,omitempty"`
	ProjectMatchKeys     []string       `json:"projectMatchKeys,omitempty"`
}

type ChannelRoutingExplainResult struct {
	Channel              string                                  `json:"channel"`
	RouteMode            string                                  `json:"routeMode"`
	SelectedAccountID    string                                  `json:"selectedAccountID,omitempty"`
	Candidates           []ChannelRoutingCandidate               `json:"candidates"`
	Filtered             []ChannelRoutingFilteredAccount         `json:"filtered"`
	Steps                []string                                `json:"steps"`
	Meta                 ChannelRoutingConfigMeta                `json:"meta"`
	SnapshotVersion      string                                  `json:"snapshotVersion,omitempty"`
	PolicyVersion        string                                  `json:"policyVersion,omitempty"`
	ProjectCandidatePool *ChannelRoutingProjectCandidatePoolInfo `json:"projectCandidatePool,omitempty"`
	Shadow               *ChannelRoutingShadowDecision           `json:"shadow,omitempty"`
}

type ChannelRoutingProjectCandidatePoolInfo struct {
	Evaluated            bool     `json:"evaluated"`
	Activated            bool     `json:"activated"`
	Reason               string   `json:"reason,omitempty"`
	RuleID               string   `json:"ruleID,omitempty"`
	ProjectKey           string   `json:"projectKey,omitempty"`
	ProjectName          string   `json:"projectName,omitempty"`
	ProjectKeySource     string   `json:"projectKeySource,omitempty"`
	ProjectKeyConfidence string   `json:"projectKeyConfidence,omitempty"`
	AllowAccountIDs      []string `json:"allowAccountIDs,omitempty"`
	FilteredAccountIDs   []string `json:"filteredAccountIDs,omitempty"`
	BeforeCandidateCount int      `json:"beforeCandidateCount,omitempty"`
	AfterCandidateCount  int      `json:"afterCandidateCount,omitempty"`
}

type ChannelRoutingShadowDecision struct {
	Enabled           bool     `json:"enabled"`
	RouteMode         string   `json:"routeMode,omitempty"`
	SelectedAccountID string   `json:"selectedAccountID,omitempty"`
	Diff              bool     `json:"diff"`
	Steps             []string `json:"steps,omitempty"`
}

type ChannelRoutingCandidate struct {
	ID             string `json:"id"`
	DisplayName    string `json:"displayName,omitempty"`
	Provider       string `json:"provider,omitempty"`
	RouteOrder     int    `json:"routeOrder,omitempty"`
	GroupID        string `json:"groupID,omitempty"`
	GroupOrder     int    `json:"groupOrder,omitempty"`
	ChannelOrder   int    `json:"channelOrder,omitempty"`
	ActiveSessions int    `json:"activeSessions,omitempty"`
}

type ChannelRoutingFilteredAccount struct {
	ID     string `json:"id"`
	Reason string `json:"reason"`
}

type ChannelRouteEventsInput struct {
	Channel string `json:"channel,omitempty"`
	Limit   int    `json:"limit,omitempty"`
}

type ChannelRouteEvent struct {
	ID                      string `json:"id"`
	RecordedAt              string `json:"recordedAt"`
	Channel                 string `json:"channel"`
	ProjectKey              string `json:"projectKey,omitempty"`
	ProjectName             string `json:"projectName,omitempty"`
	ProjectKeySource        string `json:"projectKeySource,omitempty"`
	ProjectKeyConfidence    string `json:"projectKeyConfidence,omitempty"`
	RouteMode               string `json:"routeMode"`
	SelectedAccountID       string `json:"selectedAccountID,omitempty"`
	CandidateCount          int    `json:"candidateCount"`
	FilteredCount           int    `json:"filteredCount"`
	SnapshotVersion         string `json:"snapshotVersion"`
	PolicyVersion           string `json:"policyVersion"`
	ShadowEnabled           bool   `json:"shadowEnabled,omitempty"`
	ShadowRouteMode         string `json:"shadowRouteMode,omitempty"`
	ShadowSelectedAccountID string `json:"shadowSelectedAccountID,omitempty"`
	ShadowDiff              bool   `json:"shadowDiff,omitempty"`
	Redacted                bool   `json:"redacted"`
}

type ChannelRouteAccountResultInput struct {
	AccountID       string `json:"accountID"`
	StatusCode      int    `json:"statusCode,omitempty"`
	ErrorType       string `json:"errorType,omitempty"`
	Reason          string `json:"reason,omitempty"`
	CooldownSeconds int    `json:"cooldownSeconds,omitempty"`
	Model           string `json:"model,omitempty"`
}

type ChannelAccountRuntimeState struct {
	AccountID string                               `json:"accountID"`
	Sources   map[string]ChannelRuntimeStateSource `json:"sources,omitempty"`
	UpdatedAt string                               `json:"updatedAt,omitempty"`
}

type ChannelRuntimeStateSource struct {
	Source    string `json:"source"`
	Reason    string `json:"reason,omitempty"`
	Model     string `json:"model,omitempty"`
	ExpiresAt string `json:"expiresAt,omitempty"`
	UpdatedAt string `json:"updatedAt,omitempty"`
}

type UpdateOAuthModelAliasesInput struct {
	Channel string                  `json:"channel"`
	Models  []OpenAICompatibleModel `json:"models,omitempty"`
}

type CodexAccountRoutingProbeResult struct {
	Model    string                            `json:"model"`
	Attempts []CodexAccountRoutingProbeAttempt `json:"attempts"`
}

type CodexAccountRoutingProbeAttempt struct {
	Index        int    `json:"index"`
	Success      bool   `json:"success"`
	StatusCode   int    `json:"statusCode,omitempty"`
	AccountID    string `json:"accountID,omitempty"`
	AccountLabel string `json:"accountLabel,omitempty"`
	Provider     string `json:"provider,omitempty"`
	Message      string `json:"message,omitempty"`
	Evidence     string `json:"evidence,omitempty"`
	ResponseBody string `json:"responseBody,omitempty"`
	StartedAt    string `json:"startedAt,omitempty"`
	FinishedAt   string `json:"finishedAt,omitempty"`
}

type ClaudeCodeAccountRoutingProbeResult struct {
	Model    string                                 `json:"model"`
	Attempts []ClaudeCodeAccountRoutingProbeAttempt `json:"attempts"`
}

type ClaudeCodeAccountRoutingProbeAttempt struct {
	Index        int    `json:"index"`
	Success      bool   `json:"success"`
	StatusCode   int    `json:"statusCode,omitempty"`
	AccountID    string `json:"accountID,omitempty"`
	AccountLabel string `json:"accountLabel,omitempty"`
	Provider     string `json:"provider,omitempty"`
	Message      string `json:"message,omitempty"`
	Evidence     string `json:"evidence,omitempty"`
	ResponseBody string `json:"responseBody,omitempty"`
	StartedAt    string `json:"startedAt,omitempty"`
	FinishedAt   string `json:"finishedAt,omitempty"`
}

type OpenAICompatibleProvider struct {
	AccountKey        string                  `json:"accountKey,omitempty"`
	Name              string                  `json:"name"`
	Priority          int                     `json:"priority,omitempty"`
	Disabled          bool                    `json:"disabled,omitempty"`
	BaseURL           string                  `json:"baseUrl"`
	Prefix            string                  `json:"prefix,omitempty"`
	ProxyURL          string                  `json:"proxyUrl,omitempty"`
	APIKey            string                  `json:"apiKey"`
	APIKeys           []string                `json:"apiKeys,omitempty"`
	QuotaCurl         string                  `json:"quotaCurl,omitempty"`
	QuotaEnabled      bool                    `json:"quotaEnabled,omitempty"`
	BillingCurl       string                  `json:"billingCurl,omitempty"`
	BillingEnabled    bool                    `json:"billingEnabled,omitempty"`
	PlatformCookie    string                  `json:"platformCookie,omitempty"`
	CurlVariables     map[string]string       `json:"curlVariables,omitempty"`
	Models            []OpenAICompatibleModel `json:"models,omitempty"`
	Headers           map[string]string       `json:"headers,omitempty"`
	FormatBaseURLs    map[string]string       `json:"formatBaseUrls,omitempty"`
	KeyCount          int                     `json:"keyCount,omitempty"`
	ModelCount        int                     `json:"modelCount,omitempty"`
	HasHeaders        bool                    `json:"hasHeaders,omitempty"`
	ModelFetchAPIKey  string                  `json:"modelFetchApiKey,omitempty"`
	ModelFetchBaseURL string                  `json:"modelFetchBaseUrl,omitempty"`
}

type OpenAICompatibleModel struct {
	Name                      string   `json:"name"`
	Alias                     string   `json:"alias,omitempty"`
	SupportedReasoningEfforts []string `json:"supportedReasoningEfforts,omitempty"`
	DefaultReasoningEffort    string   `json:"defaultReasoningEffort,omitempty"`
}

type CreateOpenAICompatibleProviderInput struct {
	Name              string                  `json:"name"`
	BaseURL           string                  `json:"baseUrl"`
	Prefix            string                  `json:"prefix,omitempty"`
	APIKey            string                  `json:"apiKey"`
	QuotaCurl         string                  `json:"quotaCurl,omitempty"`
	QuotaEnabled      bool                    `json:"quotaEnabled,omitempty"`
	BillingCurl       string                  `json:"billingCurl,omitempty"`
	BillingEnabled    bool                    `json:"billingEnabled,omitempty"`
	PlatformCookie    string                  `json:"platformCookie,omitempty"`
	CurlVariables     map[string]string       `json:"curlVariables,omitempty"`
	FormatBaseURLs    map[string]string       `json:"formatBaseUrls,omitempty"`
	Models            []OpenAICompatibleModel `json:"models,omitempty"`
	ModelFetchAPIKey  string                  `json:"modelFetchApiKey,omitempty"`
	ModelFetchBaseURL string                  `json:"modelFetchBaseUrl,omitempty"`
}

type UpdateOpenAICompatibleProviderInput struct {
	CurrentName       string                  `json:"currentName"`
	Name              string                  `json:"name"`
	BaseURL           string                  `json:"baseUrl"`
	FormatBaseURLs    map[string]string       `json:"formatBaseUrls,omitempty"`
	Prefix            string                  `json:"prefix,omitempty"`
	ProxyURL          *string                 `json:"proxyUrl,omitempty"`
	APIKey            string                  `json:"apiKey"`
	APIKeys           []string                `json:"apiKeys,omitempty"`
	QuotaCurl         string                  `json:"quotaCurl,omitempty"`
	QuotaEnabled      bool                    `json:"quotaEnabled,omitempty"`
	BillingCurl       string                  `json:"billingCurl,omitempty"`
	BillingEnabled    bool                    `json:"billingEnabled,omitempty"`
	PlatformCookie    string                  `json:"platformCookie,omitempty"`
	CurlVariables     map[string]string       `json:"curlVariables,omitempty"`
	Headers           map[string]string       `json:"headers,omitempty"`
	Models            []OpenAICompatibleModel `json:"models,omitempty"`
	ModelFetchAPIKey  string                  `json:"modelFetchApiKey,omitempty"`
	ModelFetchBaseURL string                  `json:"modelFetchBaseUrl,omitempty"`
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

type RelayServiceConfig struct {
	APIKeys     []string                 `json:"apiKeys"`
	APIKeyItems []RelayServiceAPIKeyItem `json:"apiKeyItems"`
	Endpoints   []RelayServiceEndpoint   `json:"endpoints"`
}

type RelaySupportedModelsResult struct {
	Models []OpenAICompatibleModel `json:"models"`
}

type CodexModelCatalogDiagnosticModel struct {
	Slug           string   `json:"slug"`
	DisplayName    string   `json:"displayName,omitempty"`
	SourceAccounts []string `json:"sourceAccounts,omitempty"`
	SourceKinds    []string `json:"sourceKinds,omitempty"`
	ProviderNames  []string `json:"providerNames,omitempty"`
}

type CodexModelCatalogDiagnostics struct {
	SyncEnabled                bool                               `json:"syncEnabled"`
	CodexHomePath              string                             `json:"codexHomePath"`
	ConfigPath                 string                             `json:"configPath"`
	CatalogPath                string                             `json:"catalogPath"`
	ConfiguredCatalogPath      string                             `json:"configuredCatalogPath,omitempty"`
	HasModelCatalogPointer     bool                               `json:"hasModelCatalogPointer"`
	HasGetTokensCatalogPointer bool                               `json:"hasGetTokensCatalogPointer"`
	CatalogExists              bool                               `json:"catalogExists"`
	CatalogUpdatedAtUnixMs     int64                              `json:"catalogUpdatedAtUnixMs,omitempty"`
	CatalogModelCount          int                                `json:"catalogModelCount"`
	CachePath                  string                             `json:"cachePath"`
	CacheExists                bool                               `json:"cacheExists"`
	CacheUpdatedAtUnixMs       int64                              `json:"cacheUpdatedAtUnixMs,omitempty"`
	CachedAccountCount         int                                `json:"cachedAccountCount"`
	CachedModelCount           int                                `json:"cachedModelCount"`
	TracePath                  string                             `json:"tracePath"`
	TraceExists                bool                               `json:"traceExists"`
	TraceUpdatedAtUnixMs       int64                              `json:"traceUpdatedAtUnixMs,omitempty"`
	CurrentModel               string                             `json:"currentModel"`
	CurrentProviderID          string                             `json:"currentProviderID"`
	CurrentProviderName        string                             `json:"currentProviderName"`
	HasExplicitCurrentModel    bool                               `json:"hasExplicitCurrentModel"`
	HasExplicitCurrentProvider bool                               `json:"hasExplicitCurrentProvider"`
	Models                     []CodexModelCatalogDiagnosticModel `json:"models,omitempty"`
	Warnings                   []string                           `json:"warnings,omitempty"`
}

type LocalCodexModelProviderView struct {
	ProviderID   string `json:"providerID"`
	ProviderName string `json:"providerName"`
	BaseURL      string `json:"baseUrl,omitempty"`
}

type LocalCodexModelProviderStateView struct {
	CurrentModel                         string                        `json:"currentModel"`
	HasExplicitCurrentModel              bool                          `json:"hasExplicitCurrentModel"`
	CurrentProviderID                    string                        `json:"currentProviderID"`
	CurrentProviderName                  string                        `json:"currentProviderName"`
	CurrentProviderBaseURL               string                        `json:"currentProviderBaseUrl,omitempty"`
	CurrentProviderIsBuiltin             bool                          `json:"currentProviderIsBuiltin"`
	CurrentProviderExists                bool                          `json:"currentProviderExists"`
	CurrentProviderSupportsWebsockets    bool                          `json:"currentProviderSupportsWebsockets"`
	CurrentProviderSupportsWebsocketsSet bool                          `json:"currentProviderSupportsWebsocketsSet"`
	HasExplicitCurrentProvider           bool                          `json:"hasExplicitCurrentProvider"`
	Providers                            []LocalCodexModelProviderView `json:"providers"`
}

type RelayServiceEndpoint struct {
	ID      string `json:"id"`
	Kind    string `json:"kind"`
	Host    string `json:"host"`
	BaseURL string `json:"baseUrl"`
}

type RelayServiceAPIKeyItem struct {
	Value      string `json:"value"`
	CreatedAt  string `json:"createdAt,omitempty"`
	LastUsedAt string `json:"lastUsedAt,omitempty"`
}

type RelayRoutingConfig struct {
	Strategy            string `json:"strategy"`
	SessionAffinity     bool   `json:"sessionAffinity"`
	SessionAffinityTTL  string `json:"sessionAffinityTTL"`
	RequestRetry        int    `json:"requestRetry"`
	MaxRetryCredentials int    `json:"maxRetryCredentials"`
	MaxRetryInterval    int    `json:"maxRetryInterval"`
	SwitchProject       bool   `json:"switchProject"`
	SwitchPreviewModel  bool   `json:"switchPreviewModel"`
	AntigravityCredits  bool   `json:"antigravityCredits"`
}

type RelayLocalApplyResult struct {
	CodexHomePath                    string   `json:"codexHomePath"`
	AuthFilePath                     string   `json:"authFilePath"`
	ConfigPath                       string   `json:"configPath"`
	ModelCatalogPath                 string   `json:"modelCatalogPath,omitempty"`
	ModelCatalogRequiresRestart      bool     `json:"modelCatalogRequiresRestart,omitempty"`
	ExistingExternalModelCatalogPath string   `json:"existingExternalModelCatalogPath,omitempty"`
	Warnings                         []string `json:"warnings,omitempty"`
}

type RelayLocalApplyInput struct {
	PreserveUnspecifiedFields    bool                    `json:"preserveUnspecifiedFields,omitempty"`
	APIKey                       string                  `json:"apiKey"`
	APIKeySet                    bool                    `json:"apiKeySet,omitempty"`
	AuthFileContentBase64        string                  `json:"authFileContentBase64,omitempty"`
	AuthFileContentSet           bool                    `json:"authFileContentSet,omitempty"`
	BaseURL                      string                  `json:"baseURL"`
	BaseURLSet                   bool                    `json:"baseURLSet,omitempty"`
	Model                        string                  `json:"model"`
	ModelSet                     bool                    `json:"modelSet,omitempty"`
	ReasoningEffort              string                  `json:"reasoningEffort"`
	ReasoningEffortSet           bool                    `json:"reasoningEffortSet,omitempty"`
	ProviderID                   string                  `json:"providerID"`
	ProviderIDSet                bool                    `json:"providerIDSet,omitempty"`
	ProviderName                 string                  `json:"providerName"`
	ProviderNameSet              bool                    `json:"providerNameSet,omitempty"`
	RequiresOpenAIAuth           bool                    `json:"requiresOpenAIAuth,omitempty"`
	RequiresOpenAIAuthSet        bool                    `json:"requiresOpenAIAuthSet,omitempty"`
	WireAPI                      string                  `json:"wireAPI,omitempty"`
	WireAPISet                   bool                    `json:"wireAPISet,omitempty"`
	SupportsWebsockets           bool                    `json:"supportsWebsockets"`
	SupportsWebsocketsSet        bool                    `json:"supportsWebsocketsSet,omitempty"`
	AuthStrategy                 string                  `json:"authStrategy"`
	SkipRelayKeyMetadata         bool                    `json:"skipRelayKeyMetadata,omitempty"`
	ModelCatalogProjectionMode   string                  `json:"modelCatalogProjectionMode,omitempty"`
	ModelCatalogOverrideExternal bool                    `json:"modelCatalogOverrideExternal,omitempty"`
	ModelCatalogModels           []OpenAICompatibleModel `json:"modelCatalogModels,omitempty"`
}

type LocalCodexAuthState struct {
	AuthFilePath           string   `json:"authFilePath"`
	HasAuthFile            bool     `json:"hasAuthFile"`
	AuthMode               string   `json:"authMode"`
	HasOpenAIAPIKey        bool     `json:"hasOpenAIAPIKey"`
	HasTokens              bool     `json:"hasTokens"`
	AccountEmail           string   `json:"accountEmail,omitempty"`
	PlanType               string   `json:"planType,omitempty"`
	CanPreserveChatGPTAuth bool     `json:"canPreserveChatGPTAuth"`
	Warnings               []string `json:"warnings,omitempty"`
}

type DeepLinkImportRequest struct {
	RawURL      string                       `json:"rawURL,omitempty"`
	RedactedURL string                       `json:"redactedURL,omitempty"`
	Protocol    string                       `json:"protocol"`
	Schema      string                       `json:"schema"`
	Source      DeepLinkImportSource         `json:"source"`
	Options     DeepLinkImportOptions        `json:"options"`
	Accounts    []DeepLinkAccountPreviewItem `json:"accounts"`
}

type DeepLinkImportSource struct {
	Name string `json:"name,omitempty"`
	URL  string `json:"url,omitempty"`
}

type DeepLinkImportOptions struct {
	ContinueOnError bool `json:"continueOnError"`
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

type ClaudeCodeLocalApplyResult struct {
	ClaudeConfigDirPath string   `json:"claudeConfigDirPath"`
	SettingsPath        string   `json:"settingsPath"`
	Warnings            []string `json:"warnings,omitempty"`
	Conflicts           []string `json:"conflicts,omitempty"`
}

type ClaudeCodeLocalApplyOptions struct {
	AuthField                   string `json:"authField,omitempty"`
	Model                       string `json:"model,omitempty"`
	DefaultHaikuModel           string `json:"defaultHaikuModel,omitempty"`
	DefaultSonnetModel          string `json:"defaultSonnetModel,omitempty"`
	DefaultOpusModel            string `json:"defaultOpusModel,omitempty"`
	SmallFastModel              string `json:"smallFastModel,omitempty"`
	MaxOutputTokens             string `json:"maxOutputTokens,omitempty"`
	APITimeoutMS                string `json:"apiTimeoutMs,omitempty"`
	DisableNonEssentialTraffic  bool   `json:"disableNonEssentialTraffic,omitempty"`
	ClaudeCodeAttributionHeader bool   `json:"claudeCodeAttributionHeader,omitempty"`
}

type UsageStatisticsResponse struct {
	Usage          map[string]interface{} `json:"usage"`
	FailedRequests int64                  `json:"failedRequests,omitempty"`
}

type SidecarUsageAttributionInput struct {
	Window             string `json:"window,omitempty"`
	Bucket             string `json:"bucket,omitempty"`
	IncludeUnresolved  bool   `json:"includeUnresolved,omitempty"`
	ResolveAccountKeys *bool  `json:"resolveAccountKeys,omitempty"`
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

type SidecarUsageAttributionResponse struct {
	Window      string                        `json:"window"`
	Bucket      string                        `json:"bucket"`
	GeneratedAt string                        `json:"generatedAt"`
	Items       []SidecarUsageAttributionItem `json:"items"`
	Unresolved  []SidecarUsageAttributionItem `json:"unresolved,omitempty"`
}

type AccountStoreDiagnostics struct {
	PathBasename string                              `json:"pathBasename"`
	Configured   bool                                `json:"configured"`
	Open         bool                                `json:"open"`
	ReadRecovery AccountStoreReadRecoveryDiagnostics `json:"readRecovery"`
}

type AccountStoreReadRecoveryDiagnostics struct {
	Count             int    `json:"count"`
	LastEndpoint      string `json:"lastEndpoint"`
	LastRecovered     bool   `json:"lastRecovered"`
	LastError         string `json:"lastError"`
	LastRecoveredUnix int64  `json:"lastRecoveredAtUnixMs"`
}

type RateLimitRulesInput struct {
	AccountKey string `json:"accountKey,omitempty"`
}

type RateLimitStatusInput struct {
	AccountKey string `json:"accountKey"`
}

type DeleteRateLimitRuleInput struct {
	ID string `json:"id"`
}

type RateLimitEventsInput struct {
	AccountKey string `json:"accountKey,omitempty"`
	Limit      int    `json:"limit,omitempty"`
}

type ProjectCandidatePoolRulesInput struct {
	Channel string `json:"channel,omitempty"`
}

type DeleteProjectCandidatePoolRuleInput struct {
	ID string `json:"id"`
}

type RateLimitStrategyMeta struct {
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	SupportedWindows []string `json:"supportedWindows"`
}

type RateLimitRule struct {
	ID         string `json:"id,omitempty"`
	AccountKey string `json:"accountKey"`
	Strategy   string `json:"strategy"`
	Window     string `json:"window"`
	LimitValue int64  `json:"limitValue"`
	Action     string `json:"action"`
	Enabled    bool   `json:"enabled"`
	Label      string `json:"label,omitempty"`
	CreatedAt  int64  `json:"createdAt,omitempty"`
	UpdatedAt  int64  `json:"updatedAt,omitempty"`
}

type RateLimitRuleState struct {
	Rule         RateLimitRule `json:"rule"`
	Exceeded     bool          `json:"exceeded"`
	Reason       string        `json:"reason,omitempty"`
	UsagePct     float64       `json:"usagePct"`
	CurrentUsage int64         `json:"currentUsage"`
	LimitValue   int64         `json:"limitValue"`
	WindowStart  string        `json:"windowStart,omitempty"`
	WindowEnd    string        `json:"windowEnd,omitempty"`
	NextReset    string        `json:"nextReset,omitempty"`
}

type RateLimitSourceState struct {
	Source      string `json:"source"`
	Reason      string `json:"reason,omitempty"`
	RuleID      string `json:"ruleID,omitempty"`
	Strategy    string `json:"strategy,omitempty"`
	Window      string `json:"window,omitempty"`
	UsageValue  int64  `json:"usageValue,omitempty"`
	LimitValue  int64  `json:"limitValue,omitempty"`
	WindowStart string `json:"windowStart,omitempty"`
	WindowEnd   string `json:"windowEnd,omitempty"`
	NextReset   string `json:"nextReset,omitempty"`
}

type RateLimitState struct {
	AccountKey      string                 `json:"accountKey"`
	Blocked         bool                   `json:"blocked"`
	BlockReason     string                 `json:"blockReason,omitempty"`
	Sources         []RateLimitSourceState `json:"sources"`
	Rules           []RateLimitRuleState   `json:"rules"`
	UpdatedAt       string                 `json:"updatedAt,omitempty"`
	LastEvaluatedAt string                 `json:"lastEvaluatedAt,omitempty"`
	NextReset       string                 `json:"nextReset,omitempty"`
	Stale           bool                   `json:"stale,omitempty"`
	DegradedReason  string                 `json:"degradedReason,omitempty"`
}

type RateLimitEvent struct {
	ID          string `json:"id"`
	AccountKey  string `json:"accountKey"`
	RuleID      string `json:"ruleID"`
	Strategy    string `json:"strategy"`
	Window      string `json:"window"`
	Action      string `json:"action"`
	UsageValue  int64  `json:"usageValue"`
	LimitValue  int64  `json:"limitValue"`
	Blocked     bool   `json:"blocked"`
	Reason      string `json:"reason,omitempty"`
	TriggeredAt int64  `json:"triggeredAt"`
}

type ProjectCandidatePoolRule struct {
	ID                   string   `json:"id,omitempty"`
	Channel              string   `json:"channel"`
	ProjectKey           string   `json:"projectKey"`
	ProjectName          string   `json:"projectName,omitempty"`
	ProjectKeySource     string   `json:"projectKeySource,omitempty"`
	ProjectKeyConfidence string   `json:"projectKeyConfidence,omitempty"`
	Enabled              bool     `json:"enabled"`
	AllowAccountIDs      []string `json:"allowAccountIDs"`
	CreatedAt            string   `json:"createdAt,omitempty"`
	UpdatedAt            string   `json:"updatedAt,omitempty"`
}

type LocalProjectedUsageDetail struct {
	Timestamp         string `json:"timestamp"`
	Provider          string `json:"provider"`
	SourceKind        string `json:"sourceKind"`
	SessionID         string `json:"sessionID,omitempty"`
	ProjectName       string `json:"projectName,omitempty"`
	Model             string `json:"model,omitempty"`
	InputTokens       int64  `json:"inputTokens"`
	CachedInputTokens int64  `json:"cachedInputTokens"`
	OutputTokens      int64  `json:"outputTokens"`
	RequestCount      int64  `json:"requestCount"`
}

type LocalProjectedUsageResponse struct {
	Provider         string                      `json:"provider"`
	SourceKind       string                      `json:"sourceKind"`
	ScannedFiles     int                         `json:"scannedFiles"`
	CacheHitFiles    int                         `json:"cacheHitFiles,omitempty"`
	DeltaAppendFiles int                         `json:"deltaAppendFiles,omitempty"`
	FullRebuildFiles int                         `json:"fullRebuildFiles,omitempty"`
	FileMissingFiles int                         `json:"fileMissingFiles,omitempty"`
	Details          []LocalProjectedUsageDetail `json:"details"`
}

type LocalProjectedUsageSettings struct {
	RefreshIntervalMinutes int `json:"refreshIntervalMinutes"`
}

type SidecarProxySettings struct {
	UseSystemProxy          bool   `json:"useSystemProxy"`
	ConfigPath              string `json:"configPath"`
	AppliedToRunningSidecar bool   `json:"appliedToRunningSidecar"`
}

type AppRuntimeSettings struct {
	CodexModelCatalogSyncEnabled bool   `json:"codexModelCatalogSyncEnabled"`
	LaunchAtLogin                bool   `json:"launchAtLogin"`
	LaunchAtLoginSupported       bool   `json:"launchAtLoginSupported"`
	LaunchAgentPath              string `json:"launchAgentPath,omitempty"`
	CloseAction                  string `json:"closeAction"`
	MenuBarResident              bool   `json:"menuBarResident"`
	ShowMenuBarIcon              bool   `json:"showMenuBarIcon"`
	ConfigPath                   string `json:"configPath,omitempty"`
}

type CodexFeatureDefinition struct {
	Section        string   `json:"section"`
	Key            string   `json:"key"`
	ID             string   `json:"id,omitempty"`
	Path           []string `json:"path,omitempty"`
	Description    string   `json:"description,omitempty"`
	Stage          string   `json:"stage"`
	ValueType      string   `json:"valueType,omitempty"`
	Options        []string `json:"options,omitempty"`
	DefaultValue   any      `json:"defaultValue,omitempty"`
	DefaultEnabled bool     `json:"defaultEnabled"`
	CanonicalKey   string   `json:"canonicalKey,omitempty"`
	LegacyAlias    bool     `json:"legacyAlias,omitempty"`
	ReadOnly       bool     `json:"readOnly,omitempty"`
	Unsupported    bool     `json:"unsupported,omitempty"`
}

type CodexFeatureConfigSnapshot struct {
	CodexHomePath   string                   `json:"codexHomePath"`
	ConfigPath      string                   `json:"configPath"`
	Exists          bool                     `json:"exists"`
	Definitions     []CodexFeatureDefinition `json:"definitions"`
	Values          map[string]bool          `json:"values"`
	TypedValues     map[string]any           `json:"typedValues,omitempty"`
	RawValues       map[string]string        `json:"rawValues,omitempty"`
	UnknownValues   map[string]bool          `json:"unknownValues,omitempty"`
	UnknownSections map[string]string        `json:"unknownSections,omitempty"`
	Raw             string                   `json:"raw"`
	Warnings        []string                 `json:"warnings"`
}

type SaveCodexFeatureConfigInput struct {
	Values  map[string]bool          `json:"values,omitempty"`
	Changes []CodexConfigChangeInput `json:"changes,omitempty"`
}

type CodexConfigChangeInput struct {
	ID        string   `json:"id,omitempty"`
	Section   string   `json:"section,omitempty"`
	Key       string   `json:"key,omitempty"`
	Path      []string `json:"path,omitempty"`
	ValueType string   `json:"valueType,omitempty"`
	Value     any      `json:"value,omitempty"`
}

type CodexFeatureConfigChange struct {
	ID              string   `json:"id,omitempty"`
	Section         string   `json:"section,omitempty"`
	Key             string   `json:"key"`
	Path            []string `json:"path,omitempty"`
	ValueType       string   `json:"valueType,omitempty"`
	Type            string   `json:"type"`
	PreviousEnabled *bool    `json:"previousEnabled,omitempty"`
	NextEnabled     bool     `json:"nextEnabled,omitempty"`
	PreviousValue   any      `json:"previousValue,omitempty"`
	NextValue       any      `json:"nextValue,omitempty"`
}

type CodexFeatureConfigPreview struct {
	ConfigPath string                     `json:"configPath"`
	WillCreate bool                       `json:"willCreate"`
	Changes    []CodexFeatureConfigChange `json:"changes"`
	Preview    string                     `json:"preview"`
	Warnings   []string                   `json:"warnings"`
}

type CodexSkillFile struct {
	Path        string `json:"path"`
	Kind        string `json:"kind"`
	Content     string `json:"content,omitempty"`
	Previewable bool   `json:"previewable"`
}

type GetCodexSkillFilePreviewInput struct {
	SkillPath string `json:"skillPath"`
	FilePath  string `json:"filePath"`
}

type GetCodexSkillFilePreviewResult struct {
	Path        string `json:"path"`
	Content     string `json:"content,omitempty"`
	Previewable bool   `json:"previewable"`
}

type CodexSkillRecord struct {
	ID              string           `json:"id"`
	Name            string           `json:"name"`
	Description     string           `json:"description,omitempty"`
	Enabled         bool             `json:"enabled"`
	RootLabel       string           `json:"rootLabel"`
	RootPath        string           `json:"rootPath"`
	SourceKind      string           `json:"sourceKind"`
	Origin          string           `json:"origin"`
	VersionLabel    string           `json:"versionLabel,omitempty"`
	Files           []CodexSkillFile `json:"files"`
	SkillMarkdown   string           `json:"skillMarkdown"`
	PreviewMarkdown string           `json:"previewMarkdown"`
	Warnings        []string         `json:"warnings,omitempty"`
}

type CodexSkillRoot struct {
	Label      string `json:"label"`
	Path       string `json:"path"`
	SourceKind string `json:"sourceKind"`
	Exists     bool   `json:"exists"`
}

type CodexSkillsSnapshot struct {
	CodexHomePath string             `json:"codexHomePath"`
	ConfigPath    string             `json:"configPath"`
	Roots         []CodexSkillRoot   `json:"roots"`
	Skills        []CodexSkillRecord `json:"skills"`
	Warnings      []string           `json:"warnings,omitempty"`
}

type ClaudeCodeExtensionsSnapshot struct {
	ClaudeConfigDirPath string                 `json:"claudeConfigDirPath"`
	ClaudeJSONPath      string                 `json:"claudeJsonPath"`
	ProjectPath         string                 `json:"projectPath"`
	Skills              []ClaudeCodeSkillAsset `json:"skills"`
	McpServers          []ClaudeCodeMcpAsset   `json:"mcpServers"`
	Warnings            []string               `json:"warnings,omitempty"`
}

type ClaudeCodeSkillAsset struct {
	ID                  string `json:"id"`
	Name                string `json:"name"`
	Description         string `json:"description"`
	Scope               string `json:"scope"`
	Path                string `json:"path"`
	FrontmatterStatus   string `json:"frontmatterStatus"`
	Invocation          string `json:"invocation"`
	ModelInvocation     string `json:"modelInvocation"`
	Removable           bool   `json:"removable"`
	FileCount           int    `json:"fileCount"`
	Risk                string `json:"risk,omitempty"`
	PreviewMarkdown     string `json:"previewMarkdown,omitempty"`
	FrontmatterError    string `json:"frontmatterError,omitempty"`
	LegacyCommandSource string `json:"legacyCommandSource,omitempty"`
}

type ClaudeCodeMcpAsset struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Transport   string `json:"transport"`
	Scope       string `json:"scope"`
	SourcePath  string `json:"sourcePath"`
	Endpoint    string `json:"endpoint"`
	Active      bool   `json:"active"`
	SecretState string `json:"secretState"`
	Dirty       bool   `json:"dirty,omitempty"`
	ShadowedBy  string `json:"shadowedBy,omitempty"`
}

type SaveClaudeCodeMcpServerInput struct {
	Server ClaudeCodeMcpAsset `json:"server"`
}

type ClaudeCodeMcpChange struct {
	Key    string `json:"key"`
	Before string `json:"before"`
	After  string `json:"after"`
}

type SaveClaudeCodeMcpServerResult struct {
	ConfigPath string                `json:"configPath"`
	Server     ClaudeCodeMcpAsset    `json:"server"`
	Preview    string                `json:"preview"`
	Changes    []ClaudeCodeMcpChange `json:"changes"`
}

type SaveCodexSkillEnabledInput struct {
	Path    string `json:"path"`
	Name    string `json:"name,omitempty"`
	Enabled bool   `json:"enabled"`
}

type ClaudeCodeSettingsSnapshotDTO struct {
	ProjectPath string                    `json:"projectPath"`
	Layers      []ClaudeCodeSettingsLayer `json:"layers"`
	Warnings    []string                  `json:"warnings,omitempty"`
}

type ClaudeCodeSettingsLayer struct {
	Scope       string                       `json:"scope"`
	Path        string                       `json:"path"`
	Exists      bool                         `json:"exists"`
	ParseError  string                       `json:"parseError,omitempty"`
	KnownFields *ClaudeCodeSettingsFieldsDTO `json:"knownFields,omitempty"`
}

type ClaudeCodeSettingsFieldsDTO struct {
	Env             map[string]string `json:"env,omitempty"`
	Permissions     map[string]any    `json:"permissions,omitempty"`
	DisableAllHooks *bool             `json:"disableAllHooks,omitempty"`
	OutputStyle     string            `json:"outputStyle,omitempty"`
}

type PatchClaudeCodeSettingsInputDTO struct {
	Scope   string         `json:"scope"`
	Path    string         `json:"path"`
	Patches map[string]any `json:"patches"`
}

type ClaudeCodeSettingsChangeDTO struct {
	Key    string `json:"key"`
	Before any    `json:"before"`
	After  any    `json:"after"`
}

type PatchClaudeCodeSettingsResultDTO struct {
	ConfigPath string                        `json:"configPath"`
	Preview    string                        `json:"preview"`
	Changes    []ClaudeCodeSettingsChangeDTO `json:"changes"`
}

type SaveCodexSkillEnabledResult struct {
	ConfigPath string `json:"configPath"`
	Preview    string `json:"preview"`
}

type RemoveCodexSkillInput struct {
	Path string `json:"path"`
}

type RemoveCodexSkillResult struct {
	ConfigPath  string `json:"configPath"`
	RemovedPath string `json:"removedPath"`
	Preview     string `json:"preview"`
}

type OpenCodexSkillInFinderInput struct {
	Path string `json:"path"`
}

type OpenCodexSkillInFinderResult struct {
	Path string `json:"path"`
}

type CodexMcpEnvRow struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type CodexMcpToolRow struct {
	Name         string `json:"name"`
	ApprovalMode string `json:"approvalMode,omitempty"`
}

type CodexMcpServer struct {
	ID                        string            `json:"id"`
	Label                     string            `json:"label"`
	Enabled                   bool              `json:"enabled"`
	Transport                 string            `json:"transport"`
	Command                   string            `json:"command,omitempty"`
	Args                      []string          `json:"args,omitempty"`
	Env                       []CodexMcpEnvRow  `json:"env,omitempty"`
	EnvVarsRaw                string            `json:"envVarsRaw,omitempty"`
	Cwd                       string            `json:"cwd,omitempty"`
	URL                       string            `json:"url,omitempty"`
	BearerTokenEnvVar         string            `json:"bearerTokenEnvVar,omitempty"`
	HTTPHeaders               []CodexMcpEnvRow  `json:"httpHeaders,omitempty"`
	EnvHTTPHeaders            []CodexMcpEnvRow  `json:"envHttpHeaders,omitempty"`
	EnvironmentID             string            `json:"environmentId,omitempty"`
	ExperimentalEnvironment   string            `json:"experimentalEnvironment,omitempty"`
	Required                  bool              `json:"required,omitempty"`
	SupportsParallelToolCalls bool              `json:"supportsParallelToolCalls,omitempty"`
	StartupTimeoutSec         string            `json:"startupTimeoutSec,omitempty"`
	ToolTimeoutSec            string            `json:"toolTimeoutSec,omitempty"`
	DefaultToolsApprovalMode  string            `json:"defaultToolsApprovalMode,omitempty"`
	EnabledTools              []string          `json:"enabledTools,omitempty"`
	DisabledTools             []string          `json:"disabledTools,omitempty"`
	Scopes                    []string          `json:"scopes,omitempty"`
	OAuthClientID             string            `json:"oauthClientId,omitempty"`
	OAuthResource             string            `json:"oauthResource,omitempty"`
	Tools                     []CodexMcpToolRow `json:"tools,omitempty"`
	RawConfig                 string            `json:"rawConfig,omitempty"`
	SourcePath                string            `json:"sourcePath"`
	Status                    string            `json:"status"`
	Warnings                  []string          `json:"warnings,omitempty"`
}

type CodexMcpServersSnapshot struct {
	CodexHomePath string           `json:"codexHomePath"`
	ConfigPath    string           `json:"configPath"`
	Exists        bool             `json:"exists"`
	Servers       []CodexMcpServer `json:"servers"`
	Warnings      []string         `json:"warnings,omitempty"`
}

type SaveCodexMcpServerInput struct {
	Server CodexMcpServer `json:"server"`
}

type CodexMcpChange struct {
	Key    string `json:"key"`
	Before string `json:"before"`
	After  string `json:"after"`
}

type SaveCodexMcpServerResult struct {
	ConfigPath string           `json:"configPath"`
	Server     CodexMcpServer   `json:"server"`
	Preview    string           `json:"preview"`
	Changes    []CodexMcpChange `json:"changes"`
}

type PreflightCodexMcpServerInput struct {
	Server CodexMcpServer `json:"server"`
}

type CodexMcpPreflightResult struct {
	ServerID string                   `json:"serverID"`
	Status   string                   `json:"status"`
	Checks   []CodexMcpPreflightCheck `json:"checks"`
}

type CodexMcpPreflightCheck struct {
	ID     string `json:"id"`
	Label  string `json:"label"`
	Status string `json:"status"`
	Detail string `json:"detail,omitempty"`
}

type OpenCodexConfigTomlResult struct {
	ConfigPath string `json:"configPath"`
}

type CodexConfigTomlDocument struct {
	ConfigPath string `json:"configPath"`
	Content    string `json:"content"`
	Exists     bool   `json:"exists"`
}

type SaveCodexConfigTomlInput struct {
	Content string `json:"content"`
}

type SaveCodexConfigTomlResult struct {
	ConfigPath string `json:"configPath"`
	Content    string `json:"content"`
}

type UpdateSessionProviderMapping struct {
	SourceProvider string `json:"sourceProvider"`
	TargetProvider string `json:"targetProvider"`
}

type UpdateSessionProvidersInput struct {
	ProjectID string                         `json:"projectID"`
	Mappings  []UpdateSessionProviderMapping `json:"mappings"`
	Snapshot  *SessionManagementSnapshot     `json:"snapshot,omitempty"`
}

type AnalyzeCodexSessionsInput struct {
	Scope      string   `json:"scope"`
	ProjectID  string   `json:"projectID,omitempty"`
	SessionIDs []string `json:"sessionIDs,omitempty"`
	Limit      int      `json:"limit,omitempty"`
}

type SessionAnalysisResult struct {
	Scope                 string                            `json:"scope"`
	GeneratedAt           string                            `json:"generatedAt"`
	RequestedSessionCount int                               `json:"requestedSessionCount"`
	AnalyzedSessionCount  int                               `json:"analyzedSessionCount"`
	SkippedSessionCount   int                               `json:"skippedSessionCount"`
	TotalMessages         int                               `json:"totalMessages"`
	TotalTerms            int                               `json:"totalTerms"`
	Keywords              []SessionAnalysisKeyword          `json:"keywords"`
	WordCloud             []SessionAnalysisWordCloudItem    `json:"wordCloud"`
	CommonPhrases         []SessionAnalysisCommonPhrase     `json:"commonPhrases"`
	RoleContributions     []SessionAnalysisRoleContribution `json:"roleContributions"`
	Projects              []SessionAnalysisProjectSummary   `json:"projects"`
	Sessions              []SessionAnalysisSessionSummary   `json:"sessions"`
}

type SessionAnalysisKeyword struct {
	Term         string  `json:"term"`
	Count        int     `json:"count"`
	SessionCount int     `json:"sessionCount"`
	Score        float64 `json:"score"`
}

type SessionAnalysisWordCloudItem struct {
	Term         string  `json:"term"`
	Count        int     `json:"count"`
	SessionCount int     `json:"sessionCount"`
	Weight       float64 `json:"weight"`
}

type SessionAnalysisCommonPhrase struct {
	Text         string  `json:"text"`
	Count        int     `json:"count"`
	SessionCount int     `json:"sessionCount"`
	Score        float64 `json:"score"`
}

type SessionAnalysisRoleContribution struct {
	Role         string  `json:"role"`
	MessageCount int     `json:"messageCount"`
	TermCount    int     `json:"termCount"`
	Share        float64 `json:"share"`
}

type SessionAnalysisProjectSummary struct {
	ProjectID    string                   `json:"projectID"`
	ProjectName  string                   `json:"projectName"`
	SessionCount int                      `json:"sessionCount"`
	MessageCount int                      `json:"messageCount"`
	TermCount    int                      `json:"termCount"`
	Keywords     []SessionAnalysisKeyword `json:"keywords"`
}

type SessionAnalysisSessionSummary struct {
	SessionID         string                            `json:"sessionID"`
	ProjectID         string                            `json:"projectID"`
	ProjectName       string                            `json:"projectName"`
	Title             string                            `json:"title"`
	Status            string                            `json:"status"`
	Provider          string                            `json:"provider"`
	Model             string                            `json:"model,omitempty"`
	MessageCount      int                               `json:"messageCount"`
	TermCount         int                               `json:"termCount"`
	TopicLine         string                            `json:"topicLine"`
	Keywords          []SessionAnalysisKeyword          `json:"keywords"`
	CommonPhrases     []SessionAnalysisCommonPhrase     `json:"commonPhrases"`
	RoleContributions []SessionAnalysisRoleContribution `json:"roleContributions"`
}

type SessionManagementSnapshot struct {
	ProjectCount         int                              `json:"projectCount"`
	SessionCount         int                              `json:"sessionCount"`
	ActiveSessionCount   int                              `json:"activeSessionCount"`
	ArchivedSessionCount int                              `json:"archivedSessionCount"`
	LastScanAt           string                           `json:"lastScanAt"`
	ProviderCounts       map[string]int                   `json:"providerCounts"`
	Projects             []SessionManagementProjectRecord `json:"projects"`
}

type SessionManagementProviderCount struct {
	Provider     string `json:"provider"`
	SessionCount int    `json:"sessionCount"`
}

type SessionManagementProjectRecord struct {
	ID                   string                           `json:"id"`
	Name                 string                           `json:"name"`
	ProjectKey           string                           `json:"projectKey,omitempty"`
	ProjectKeySource     string                           `json:"projectKeySource,omitempty"`
	ProjectKeyConfidence string                           `json:"projectKeyConfidence,omitempty"`
	ProviderCounts       map[string]int                   `json:"providerCounts,omitempty"`
	SessionCount         int                              `json:"sessionCount"`
	ActiveSessionCount   int                              `json:"activeSessionCount"`
	ArchivedSessionCount int                              `json:"archivedSessionCount"`
	LastActiveAt         string                           `json:"lastActiveAt"`
	ProviderSummary      string                           `json:"providerSummary"`
	Sessions             []SessionManagementSessionRecord `json:"sessions"`
}

type SessionManagementSessionRecord struct {
	ID                   string `json:"id"`
	SessionID            string `json:"sessionID"`
	ProjectID            string `json:"projectID"`
	ProjectName          string `json:"projectName"`
	ProjectKey           string `json:"projectKey,omitempty"`
	ProjectKeySource     string `json:"projectKeySource,omitempty"`
	ProjectKeyConfidence string `json:"projectKeyConfidence,omitempty"`
	Title                string `json:"title"`
	Status               string `json:"status"`
	Archived             bool   `json:"archived"`
	MessageCount         int    `json:"messageCount"`
	RoleSummary          string `json:"roleSummary"`
	StartedAt            string `json:"startedAt"`
	UpdatedAt            string `json:"updatedAt"`
	FileLabel            string `json:"fileLabel"`
	Summary              string `json:"summary"`
	Preview              string `json:"preview"`
	Topic                string `json:"topic"`
	CurrentMessageLabel  string `json:"currentMessageLabel"`
	Provider             string `json:"provider"`
	Model                string `json:"model,omitempty"`
}

type SessionManagementSessionDetail struct {
	SessionID            string                           `json:"sessionID"`
	ProjectID            string                           `json:"projectID"`
	ProjectName          string                           `json:"projectName"`
	ProjectKey           string                           `json:"projectKey,omitempty"`
	ProjectKeySource     string                           `json:"projectKeySource,omitempty"`
	ProjectKeyConfidence string                           `json:"projectKeyConfidence,omitempty"`
	Title                string                           `json:"title"`
	Status               string                           `json:"status"`
	Archived             bool                             `json:"archived"`
	FileLabel            string                           `json:"fileLabel"`
	MessageCount         int                              `json:"messageCount"`
	Masked               bool                             `json:"masked"`
	CurrentMessageLabel  string                           `json:"currentMessageLabel"`
	RoleSummary          string                           `json:"roleSummary"`
	Topic                string                           `json:"topic"`
	Preview              string                           `json:"preview"`
	Provider             string                           `json:"provider"`
	Model                string                           `json:"model,omitempty"`
	StartedAt            string                           `json:"startedAt"`
	UpdatedAt            string                           `json:"updatedAt"`
	Messages             []SessionManagementMessageRecord `json:"messages"`
}

type SessionManagementMessageRecord struct {
	ID         string `json:"id"`
	LineNumber int    `json:"lineNumber,omitempty"`
	Role       string `json:"role"`
	TimeLabel  string `json:"timeLabel"`
	Timestamp  string `json:"timestamp,omitempty"`
	Title      string `json:"title"`
	Summary    string `json:"summary"`
	Content    string `json:"content"`
	Truncated  bool   `json:"truncated,omitempty"`
}

type SessionManagementMessageRawJSONInput struct {
	LineNumber int `json:"lineNumber"`
}

type SessionManagementMessageRawJSON struct {
	SessionID  string `json:"sessionID"`
	LineNumber int    `json:"lineNumber"`
	RawJSON    string `json:"rawJSON"`
}

type SessionManagementMessagePageInput struct {
	Offset int `json:"offset"`
	Limit  int `json:"limit"`
}

type SessionManagementMessagePage struct {
	SessionID    string                           `json:"sessionID"`
	Offset       int                              `json:"offset"`
	Limit        int                              `json:"limit"`
	MessageCount int                              `json:"messageCount"`
	NextOffset   int                              `json:"nextOffset"`
	HasMore      bool                             `json:"hasMore"`
	Messages     []SessionManagementMessageRecord `json:"messages"`
}

// CLAUDE.md Memory File types
type ClaudeCodeMemoryFilesSnapshotDTO struct {
	ProjectPath string                          `json:"projectPath"`
	Files       []ClaudeCodeMemoryFileRecordDTO `json:"files"`
	Warnings    []string                        `json:"warnings,omitempty"`
}

type ClaudeCodeMemoryFileRecordDTO struct {
	Scope            string                          `json:"scope"`
	Path             string                          `json:"path"`
	Exists           bool                            `json:"exists"`
	GitIgnored       bool                            `json:"gitIgnored,omitempty"`
	Imports          []ClaudeCodeMemoryFileImportDTO `json:"imports,omitempty"`
	Content          string                          `json:"content,omitempty"`
	ContentTruncated bool                            `json:"contentTruncated,omitempty"`
	Size             int64                           `json:"size"`
}

type ClaudeCodeMemoryFileImportDTO struct {
	Raw      string `json:"raw"`
	Resolved string `json:"resolved"`
	Exists   bool   `json:"exists"`
	Depth    int    `json:"depth"`
}

type SaveClaudeCodeMemoryFileInputDTO struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

type SaveClaudeCodeMemoryFileResultDTO struct {
	Path    string `json:"path"`
	Size    int64  `json:"size"`
	Warning string `json:"warning,omitempty"`
}

// Subagents types
type ClaudeCodeSubagentsSnapshotDTO struct {
	UserPath    string                        `json:"userPath"`
	ProjectPath string                        `json:"projectPath"`
	Agents      []ClaudeCodeSubagentRecordDTO `json:"agents"`
	Warnings    []string                      `json:"warnings,omitempty"`
}

type ClaudeCodeSubagentRecordDTO struct {
	Name             string         `json:"name"`
	Description      string         `json:"description"`
	Path             string         `json:"path"`
	Scope            string         `json:"scope"`
	FrontmatterValid bool           `json:"frontmatterValid"`
	FrontmatterError string         `json:"frontmatterError,omitempty"`
	ValidationErrors []string       `json:"validationErrors,omitempty"`
	KnownFields      map[string]any `json:"knownFields,omitempty"`
	UnknownFields    map[string]any `json:"unknownFields,omitempty"`
	Body             string         `json:"body,omitempty"`
	BodyPreview      string         `json:"bodyPreview,omitempty"`
	IsPlugin         bool           `json:"isPlugin,omitempty"`
	IgnoredFields    []string       `json:"ignoredFields,omitempty"`
}

type SaveClaudeCodeSubagentInputDTO struct {
	Scope         string         `json:"scope"`
	Path          string         `json:"path"`
	Name          string         `json:"name"`
	Description   string         `json:"description"`
	KnownFields   map[string]any `json:"knownFields,omitempty"`
	UnknownFields map[string]any `json:"unknownFields,omitempty"`
	Body          string         `json:"body"`
}

type SaveClaudeCodeSubagentResultDTO struct {
	Path    string `json:"path"`
	Preview string `json:"preview"`
}

type DeleteClaudeCodeSubagentInputDTO struct {
	Scope string `json:"scope"`
	Path  string `json:"path"`
}
