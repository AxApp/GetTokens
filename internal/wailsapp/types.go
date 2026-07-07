package wailsapp

import "encoding/json"

type AuthFileItem struct {
	Name          string      `json:"name"`
	Type          string      `json:"type,omitempty"`
	Provider      string      `json:"provider,omitempty"`
	Priority      int         `json:"priority,omitempty"`
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

type AuthFileUploadResult struct {
	Succeeded       int  `json:"succeeded"`
	Skipped         int  `json:"skipped"`
	SkippedExisting int  `json:"skippedExisting"`
	SkippedInBatch  int  `json:"skippedInBatch"`
	Failed          int  `json:"failed"`
	FallbackUsed    bool `json:"fallbackUsed,omitempty"`
}

type AuthFileUploadPreviewResult struct {
	Supported       bool `json:"supported"`
	WouldCreate     int  `json:"wouldCreate"`
	Skipped         int  `json:"skipped"`
	SkippedExisting int  `json:"skippedExisting"`
	SkippedInBatch  int  `json:"skippedInBatch"`
	Failed          int  `json:"failed"`
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
	QuotaFact       *CodexQuotaFact         `json:"quotaFact,omitempty"`
}

type CodexQuotaBatchRefreshInput struct {
	AccountKeys    []string `json:"accountKeys"`
	IncludeBilling bool     `json:"includeBilling"`
	Force          bool     `json:"force"`
	Concurrency    int      `json:"concurrency,omitempty"`
}

type CodexQuotaBatchRefreshError struct {
	AccountKey string `json:"accountKey"`
	Error      string `json:"error"`
}

type CodexQuotaBatchRefreshResult struct {
	Items     []CodexQuotaResponse          `json:"items"`
	Errors    []CodexQuotaBatchRefreshError `json:"errors"`
	Succeeded int                           `json:"succeeded"`
	Failed    int                           `json:"failed"`
}

type CodexQuotaBatchRefreshJob struct {
	JobID       string                        `json:"jobID"`
	Status      string                        `json:"status"`
	Total       int                           `json:"total"`
	Pending     int                           `json:"pending"`
	Running     int                           `json:"running"`
	Succeeded   int                           `json:"succeeded"`
	Failed      int                           `json:"failed"`
	Items       []CodexQuotaResponse          `json:"items"`
	Errors      []CodexQuotaBatchRefreshError `json:"errors"`
	CreatedAt   string                        `json:"createdAt"`
	UpdatedAt   string                        `json:"updatedAt"`
	CompletedAt string                        `json:"completedAt,omitempty"`
}

type OpenAIQuotaResetCreditInfo struct {
	AccountKey     string              `json:"accountKey"`
	Status         string              `json:"status"`
	AvailableCount int                 `json:"availableCount"`
	PlanType       string              `json:"planType,omitempty"`
	FetchedAt      int64               `json:"fetchedAt"`
	QuotaState     *CodexQuotaResponse `json:"quotaState,omitempty"`
}

type OpenAIQuotaResetCredit struct {
	ID              string `json:"id,omitempty"`
	ResetType       string `json:"resetType,omitempty"`
	Status          string `json:"status,omitempty"`
	GrantedAt       string `json:"grantedAt,omitempty"`
	ExpiresAt       string `json:"expiresAt,omitempty"`
	RedeemStartedAt string `json:"redeemStartedAt,omitempty"`
	RedeemedAt      string `json:"redeemedAt,omitempty"`
}

type OpenAIQuotaResetConsumeResult struct {
	AccountKey             string                  `json:"accountKey"`
	Status                 string                  `json:"status"`
	Code                   string                  `json:"code,omitempty"`
	Credit                 *OpenAIQuotaResetCredit `json:"credit,omitempty"`
	WindowsReset           int                     `json:"windowsReset"`
	AvailableCount         int                     `json:"availableCount"`
	PlanType               string                  `json:"planType,omitempty"`
	FetchedAt              int64                   `json:"fetchedAt"`
	QuotaState             *CodexQuotaResponse     `json:"quotaState,omitempty"`
	PostResetRefreshStatus string                  `json:"postResetRefreshStatus,omitempty"`
	PostResetRefreshError  string                  `json:"postResetRefreshError,omitempty"`
}

type DeleteAccountsBatchInput struct {
	AccountIDs []string `json:"accountIDs"`
}

type DeleteAccountsBatchError struct {
	AccountID string `json:"accountID"`
	Error     string `json:"error"`
}

type DeleteAccountsBatchResult struct {
	DeletedAccountIDs []string                   `json:"deletedAccountIDs"`
	Errors            []DeleteAccountsBatchError `json:"errors"`
	Succeeded         int                        `json:"succeeded"`
	Failed            int                        `json:"failed"`
}

type SetAccountsDisabledBatchInput struct {
	AccountIDs []string `json:"accountIDs"`
	Disabled   bool     `json:"disabled"`
}

type SetAccountsDisabledBatchError struct {
	AccountID string `json:"accountID"`
	Error     string `json:"error"`
}

type SetAccountsDisabledBatchResult struct {
	UpdatedAccountIDs []string                        `json:"updatedAccountIDs"`
	Errors            []SetAccountsDisabledBatchError `json:"errors"`
	Succeeded         int                             `json:"succeeded"`
	Failed            int                             `json:"failed"`
}

type CodexQuotaSourceState struct {
	Source    string `json:"source"`
	Reason    string `json:"reason,omitempty"`
	ExpiresAt string `json:"expiresAt,omitempty"`
	NextReset string `json:"nextReset,omitempty"`
}

type CodexQuotaFact struct {
	State        string   `json:"state,omitempty"`
	Source       string   `json:"source,omitempty"`
	Freshness    string   `json:"freshness,omitempty"`
	Confidence   string   `json:"confidence,omitempty"`
	Risk         string   `json:"risk,omitempty"`
	Explanation  string   `json:"explanation,omitempty"`
	ObservedAt   string   `json:"observedAt,omitempty"`
	ExpiresAt    string   `json:"expiresAt,omitempty"`
	EvidenceRefs []string `json:"evidenceRefs,omitempty"`
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

type DoctorSnapshotInput struct {
	Scope               string `json:"scope,omitempty"`
	IncludeEvidence     bool   `json:"includeEvidence,omitempty"`
	MaxEvidencePerCheck int    `json:"maxEvidencePerCheck,omitempty"`
}

type DoctorSnapshot struct {
	GeneratedAtUnixMs int64         `json:"generatedAtUnixMs"`
	Source            string        `json:"source"`
	SidecarReady      bool          `json:"sidecarReady"`
	Status            string        `json:"status"`
	Checks            []DoctorCheck `json:"checks"`
	Summary           DoctorSummary `json:"summary"`
}

type DoctorSummary struct {
	Total    int `json:"total"`
	Critical int `json:"critical"`
	Warning  int `json:"warning"`
	NotReady int `json:"notReady"`
	OK       int `json:"ok"`
	Skipped  int `json:"skipped"`
	Degraded int `json:"degraded"`
}

type DoctorCheck struct {
	ID                  string                   `json:"id"`
	Kind                string                   `json:"kind"`
	Title               string                   `json:"title"`
	Status              string                   `json:"status"`
	Reason              string                   `json:"reason"`
	Repairability       string                   `json:"repairability"`
	Authority           string                   `json:"authority"`
	Confidence          string                   `json:"confidence"`
	LastCheckedAtUnixMs int64                    `json:"lastCheckedAtUnixMs"`
	Evidence            []DoctorEvidenceRef      `json:"evidence"`
	Navigation          []DoctorNavigationTarget `json:"navigation"`
}

type DoctorEvidenceRef struct {
	Kind          string                      `json:"kind"`
	Label         string                      `json:"label"`
	Summary       string                      `json:"summary"`
	RefID         string                      `json:"refID"`
	Source        string                      `json:"source"`
	AccountKey    string                      `json:"accountKey,omitempty"`
	AccountID     string                      `json:"accountID,omitempty"`
	AuthID        string                      `json:"authId,omitempty"`
	Model         string                      `json:"model,omitempty"`
	Scope         string                      `json:"scope,omitempty"`
	Reason        string                      `json:"reason,omitempty"`
	RouteBlocking *bool                       `json:"routeBlocking,omitempty"`
	RouteEvidence *DoctorRouteEvidencePayload `json:"routeEvidence,omitempty"`
	DroppedReason *DoctorRouteEvidencePayload `json:"droppedReason,omitempty"`
	QuotaFact     *CodexQuotaFact             `json:"quotaFact,omitempty"`
}

type DoctorRouteEvidencePayload struct {
	AccountKey    string `json:"accountKey,omitempty"`
	AccountID     string `json:"accountID,omitempty"`
	AuthID        string `json:"authId,omitempty"`
	Model         string `json:"model,omitempty"`
	Source        string `json:"source,omitempty"`
	Scope         string `json:"scope,omitempty"`
	Reason        string `json:"reason,omitempty"`
	RouteBlocking *bool  `json:"routeBlocking,omitempty"`
}

type DoctorNavigationTarget struct {
	Kind  string `json:"kind"`
	Label string `json:"label"`
	Hash  string `json:"hash"`
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

type LocalProjectedUsageProgress struct {
	Provider       string `json:"provider,omitempty"`
	Phase          string `json:"phase"`
	CurrentFile    string `json:"currentFile,omitempty"`
	ProcessedFiles int    `json:"processedFiles"`
	TotalFiles     int    `json:"totalFiles"`
	Source         string `json:"source,omitempty"`
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
	ShowMenuBarIconSet           bool   `json:"-"`
	ConfigPath                   string `json:"configPath,omitempty"`
}

func (s *AppRuntimeSettings) UnmarshalJSON(data []byte) error {
	type appRuntimeSettingsAlias AppRuntimeSettings
	var raw struct {
		appRuntimeSettingsAlias
		ShowMenuBarIcon *bool `json:"showMenuBarIcon"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	*s = AppRuntimeSettings(raw.appRuntimeSettingsAlias)
	if raw.ShowMenuBarIcon != nil {
		s.ShowMenuBarIcon = *raw.ShowMenuBarIcon
		s.ShowMenuBarIconSet = true
	}
	return nil
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
