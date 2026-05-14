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
	ID               string `json:"id"`
	Label            string `json:"label"`
	RemainingPercent *int   `json:"remainingPercent,omitempty"`
	ResetLabel       string `json:"resetLabel"`
	ResetAtUnix      int64  `json:"resetAtUnix,omitempty"`
}

type CodexQuotaResponse struct {
	PlanType string             `json:"planType,omitempty"`
	Windows  []CodexQuotaWindow `json:"windows"`
}

type AccountRecord struct {
	ID               string      `json:"id"`
	Provider         string      `json:"provider"`
	CredentialSource string      `json:"credentialSource"`
	DisplayName      string      `json:"displayName"`
	Status           string      `json:"status"`
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
	AuthIndex        interface{} `json:"authIndex,omitempty"`
	QuotaKey         string      `json:"quotaKey,omitempty"`
	QuotaCurl        string      `json:"quotaCurl,omitempty"`
	QuotaEnabled     bool        `json:"quotaEnabled,omitempty"`
	LocalOnly        bool        `json:"localOnly,omitempty"`
}

type CreateCodexAPIKeyInput struct {
	APIKey         string            `json:"apiKey"`
	Label          string            `json:"label,omitempty"`
	BaseURL        string            `json:"baseUrl"`
	Priority       int               `json:"priority,omitempty"`
	Prefix         string            `json:"prefix,omitempty"`
	ProxyURL       string            `json:"proxyUrl,omitempty"`
	Headers        map[string]string `json:"headers,omitempty"`
	ExcludedModels []string          `json:"excludedModels,omitempty"`
	QuotaCurl      string            `json:"quotaCurl,omitempty"`
	QuotaEnabled   bool              `json:"quotaEnabled,omitempty"`
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
	ID           string `json:"id"`
	APIKey       string `json:"apiKey"`
	BaseURL      string `json:"baseUrl"`
	Prefix       string `json:"prefix,omitempty"`
	QuotaCurl    string `json:"quotaCurl,omitempty"`
	QuotaEnabled bool   `json:"quotaEnabled,omitempty"`
}

type TestCodexAPIKeyQuotaCurlInput struct {
	APIKey    string `json:"apiKey"`
	BaseURL   string `json:"baseUrl"`
	Prefix    string `json:"prefix,omitempty"`
	QuotaCurl string `json:"quotaCurl"`
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

type OpenAICompatibleProvider struct {
	Name       string                  `json:"name"`
	Priority   int                     `json:"priority,omitempty"`
	Disabled   bool                    `json:"disabled,omitempty"`
	BaseURL    string                  `json:"baseUrl"`
	Prefix     string                  `json:"prefix,omitempty"`
	APIKey     string                  `json:"apiKey"`
	APIKeys    []string                `json:"apiKeys,omitempty"`
	Models     []OpenAICompatibleModel `json:"models,omitempty"`
	Headers    map[string]string       `json:"headers,omitempty"`
	KeyCount   int                     `json:"keyCount,omitempty"`
	ModelCount int                     `json:"modelCount,omitempty"`
	HasHeaders bool                    `json:"hasHeaders,omitempty"`
}

type OpenAICompatibleModel struct {
	Name                      string   `json:"name"`
	Alias                     string   `json:"alias,omitempty"`
	SupportedReasoningEfforts []string `json:"supportedReasoningEfforts,omitempty"`
	DefaultReasoningEffort    string   `json:"defaultReasoningEffort,omitempty"`
}

type CreateOpenAICompatibleProviderInput struct {
	Name    string `json:"name"`
	BaseURL string `json:"baseUrl"`
	Prefix  string `json:"prefix,omitempty"`
	APIKey  string `json:"apiKey"`
}

type UpdateOpenAICompatibleProviderInput struct {
	CurrentName string                  `json:"currentName"`
	Name        string                  `json:"name"`
	BaseURL     string                  `json:"baseUrl"`
	Prefix      string                  `json:"prefix,omitempty"`
	APIKey      string                  `json:"apiKey"`
	APIKeys     []string                `json:"apiKeys,omitempty"`
	Headers     map[string]string       `json:"headers,omitempty"`
	Models      []OpenAICompatibleModel `json:"models,omitempty"`
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

type LocalCodexModelProviderView struct {
	ProviderID   string `json:"providerID"`
	ProviderName string `json:"providerName"`
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
	CodexHomePath string `json:"codexHomePath"`
	AuthFilePath  string `json:"authFilePath"`
	ConfigPath    string `json:"configPath"`
}

type ClaudeCodeLocalApplyResult struct {
	ClaudeConfigDirPath string   `json:"claudeConfigDirPath"`
	SettingsPath        string   `json:"settingsPath"`
	Warnings            []string `json:"warnings,omitempty"`
	Conflicts           []string `json:"conflicts,omitempty"`
}

type UsageStatisticsResponse struct {
	Usage          map[string]interface{} `json:"usage"`
	FailedRequests int64                  `json:"failedRequests,omitempty"`
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

type LocalProjectedUsageSettings struct {
	RefreshIntervalMinutes int `json:"refreshIntervalMinutes"`
}

type CodexFeatureDefinition struct {
	Key            string `json:"key"`
	Description    string `json:"description,omitempty"`
	Stage          string `json:"stage"`
	DefaultEnabled bool   `json:"defaultEnabled"`
	CanonicalKey   string `json:"canonicalKey,omitempty"`
	LegacyAlias    bool   `json:"legacyAlias,omitempty"`
}

type CodexFeatureConfigSnapshot struct {
	CodexHomePath string                   `json:"codexHomePath"`
	ConfigPath    string                   `json:"configPath"`
	Exists        bool                     `json:"exists"`
	Definitions   []CodexFeatureDefinition `json:"definitions"`
	Values        map[string]bool          `json:"values"`
	UnknownValues map[string]bool          `json:"unknownValues,omitempty"`
	Raw           string                   `json:"raw"`
	Warnings      []string                 `json:"warnings"`
}

type SaveCodexFeatureConfigInput struct {
	Values map[string]bool `json:"values"`
}

type CodexFeatureConfigChange struct {
	Key             string `json:"key"`
	Type            string `json:"type"`
	PreviousEnabled *bool  `json:"previousEnabled,omitempty"`
	NextEnabled     bool   `json:"nextEnabled"`
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

type SaveCodexSkillEnabledInput struct {
	Path    string `json:"path"`
	Name    string `json:"name,omitempty"`
	Enabled bool   `json:"enabled"`
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
	ExperimentalEnvironment   string            `json:"experimentalEnvironment,omitempty"`
	Required                  bool              `json:"required,omitempty"`
	SupportsParallelToolCalls bool              `json:"supportsParallelToolCalls,omitempty"`
	StartupTimeoutSec         string            `json:"startupTimeoutSec,omitempty"`
	ToolTimeoutSec            string            `json:"toolTimeoutSec,omitempty"`
	DefaultToolsApprovalMode  string            `json:"defaultToolsApprovalMode,omitempty"`
	EnabledTools              []string          `json:"enabledTools,omitempty"`
	DisabledTools             []string          `json:"disabledTools,omitempty"`
	Scopes                    []string          `json:"scopes,omitempty"`
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
	ProviderCounts       map[string]int                   `json:"providerCounts,omitempty"`
	SessionCount         int                              `json:"sessionCount"`
	ActiveSessionCount   int                              `json:"activeSessionCount"`
	ArchivedSessionCount int                              `json:"archivedSessionCount"`
	LastActiveAt         string                           `json:"lastActiveAt"`
	ProviderSummary      string                           `json:"providerSummary"`
	Sessions             []SessionManagementSessionRecord `json:"sessions"`
}

type SessionManagementSessionRecord struct {
	ID                  string `json:"id"`
	SessionID           string `json:"sessionID"`
	ProjectID           string `json:"projectID"`
	ProjectName         string `json:"projectName"`
	Title               string `json:"title"`
	Status              string `json:"status"`
	Archived            bool   `json:"archived"`
	MessageCount        int    `json:"messageCount"`
	RoleSummary         string `json:"roleSummary"`
	StartedAt           string `json:"startedAt"`
	UpdatedAt           string `json:"updatedAt"`
	FileLabel           string `json:"fileLabel"`
	Summary             string `json:"summary"`
	Preview             string `json:"preview"`
	Topic               string `json:"topic"`
	CurrentMessageLabel string `json:"currentMessageLabel"`
	Provider            string `json:"provider"`
	Model               string `json:"model,omitempty"`
}

type SessionManagementSessionDetail struct {
	SessionID           string                           `json:"sessionID"`
	ProjectID           string                           `json:"projectID"`
	ProjectName         string                           `json:"projectName"`
	Title               string                           `json:"title"`
	Status              string                           `json:"status"`
	Archived            bool                             `json:"archived"`
	FileLabel           string                           `json:"fileLabel"`
	MessageCount        int                              `json:"messageCount"`
	Masked              bool                             `json:"masked"`
	CurrentMessageLabel string                           `json:"currentMessageLabel"`
	RoleSummary         string                           `json:"roleSummary"`
	Topic               string                           `json:"topic"`
	Preview             string                           `json:"preview"`
	Provider            string                           `json:"provider"`
	Model               string                           `json:"model,omitempty"`
	StartedAt           string                           `json:"startedAt"`
	UpdatedAt           string                           `json:"updatedAt"`
	Messages            []SessionManagementMessageRecord `json:"messages"`
}

type SessionManagementMessageRecord struct {
	ID        string `json:"id"`
	Role      string `json:"role"`
	TimeLabel string `json:"timeLabel"`
	Timestamp string `json:"timestamp,omitempty"`
	Title     string `json:"title"`
	Summary   string `json:"summary"`
	Content   string `json:"content"`
	Truncated bool   `json:"truncated,omitempty"`
}
