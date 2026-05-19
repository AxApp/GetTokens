package wailsapp

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
	ID               string
	Label            string
	RemainingPercent *int
	ResetLabel       string
	ResetAtUnix      int64
}

type CodexQuotaResponse struct {
	PlanType string                 `json:"planType,omitempty"`
	Windows  []CodexQuotaWindow     `json:"windows"`
	Billing  *CodexQuotaBillingInfo `json:"billing,omitempty"`
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

type RelayLocalApplyResult struct {
	CodexHomePath string `json:"codexHomePath"`
	AuthFilePath  string `json:"authFilePath"`
	ConfigPath    string `json:"configPath"`
}

type RelayLocalApplyInput struct {
	APIKey             string `json:"apiKey"`
	BaseURL            string `json:"baseURL"`
	Model              string `json:"model"`
	ReasoningEffort    string `json:"reasoningEffort"`
	ProviderID         string `json:"providerID"`
	ProviderName       string `json:"providerName"`
	SupportsWebsockets bool   `json:"supportsWebsockets"`
	AuthStrategy       string `json:"authStrategy"`
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
	Model                      string `json:"model,omitempty"`
	DefaultHaikuModel          string `json:"defaultHaikuModel,omitempty"`
	DefaultSonnetModel         string `json:"defaultSonnetModel,omitempty"`
	DefaultOpusModel           string `json:"defaultOpusModel,omitempty"`
	SmallFastModel             string `json:"smallFastModel,omitempty"`
	MaxOutputTokens            string `json:"maxOutputTokens,omitempty"`
	APITimeoutMS               string `json:"apiTimeoutMs,omitempty"`
	DisableNonEssentialTraffic bool   `json:"disableNonEssentialTraffic,omitempty"`
}

type LocalProjectedUsageDetail struct {
	Timestamp         string `json:"timestamp"`
	Provider          string `json:"provider"`
	SourceKind        string `json:"sourceKind"`
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
	LaunchAtLogin          bool   `json:"launchAtLogin"`
	LaunchAtLoginSupported bool   `json:"launchAtLoginSupported"`
	LaunchAgentPath        string `json:"launchAgentPath,omitempty"`
	CloseAction            string `json:"closeAction"`
	MenuBarResident        bool   `json:"menuBarResident"`
	ConfigPath             string `json:"configPath,omitempty"`
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
