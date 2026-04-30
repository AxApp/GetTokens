package main

import (
	"context"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
	"github.com/linhay/gettokens/internal/sidecar"
	"github.com/linhay/gettokens/internal/updater"
	wailsapp "github.com/linhay/gettokens/internal/wailsapp"
)

// Version is injected at build time via -ldflags
var Version = "dev"

// ReleaseLabel is injected at build time for UI display, format: YYYY.MM.DD.HH
var ReleaseLabel = ""

// GitHubRepo is the repository used for auto-update checks
const GitHubRepo = "AxApp/GetTokens"

type App struct {
	core *wailsapp.App
}

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
	ID      string `json:"id"`
	APIKey  string `json:"apiKey"`
	BaseURL string `json:"baseUrl"`
	Prefix  string `json:"prefix,omitempty"`
}

type UpdateAccountPriorityInput struct {
	ID       string `json:"id"`
	Priority int    `json:"priority,omitempty"`
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
	Name  string `json:"name"`
	Alias string `json:"alias,omitempty"`
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

func NewApp() *App {
	return &App{
		core: wailsapp.New(Version, ReleaseLabel, GitHubRepo),
	}
}

func (a *App) startup(ctx context.Context) {
	a.core.Startup(ctx)
}

func (a *App) shutdown(ctx context.Context) {
	a.core.Shutdown()
}

func (a *App) GetSidecarStatus() sidecar.Status {
	return a.core.GetSidecarStatus()
}

func (a *App) GetVersion() string {
	return a.core.GetVersion()
}

func (a *App) GetReleaseLabel() string {
	return a.core.GetReleaseLabel()
}

func (a *App) CanApplyUpdate() bool {
	return a.core.CanApplyUpdate()
}

func (a *App) UsesNativeUpdaterUI() bool {
	return a.core.UsesNativeUpdaterUI()
}

func (a *App) CheckUpdate() (*updater.ReleaseInfo, error) {
	return a.core.CheckUpdate()
}

func (a *App) ApplyUpdate() error {
	return a.core.ApplyUpdate()
}

func (a *App) ListAuthFiles() (*AuthFilesResponse, error) {
	result, err := a.core.ListAuthFiles()
	if err != nil {
		return nil, err
	}

	files := make([]AuthFileItem, 0, len(result.Files))
	for _, file := range result.Files {
		files = append(files, AuthFileItem{
			Name:          file.Name,
			Type:          file.Type,
			Provider:      file.Provider,
			Email:         file.Email,
			PlanType:      file.PlanType,
			Size:          file.Size,
			AuthIndex:     file.AuthIndex,
			RuntimeOnly:   file.RuntimeOnly,
			Disabled:      file.Disabled,
			Unavailable:   file.Unavailable,
			Status:        file.Status,
			StatusMessage: file.StatusMessage,
			LastRefresh:   file.LastRefresh,
			Modified:      file.Modified,
		})
	}

	return &AuthFilesResponse{
		Files: files,
		Total: result.Total,
	}, nil
}

func (a *App) SetAuthFileStatus(name string, disabled bool) error {
	return a.core.SetAuthFileStatus(name, disabled)
}

func (a *App) SetAccountDisabled(id string, disabled bool) error {
	return a.core.SetAccountDisabled(id, disabled)
}

func (a *App) DeleteAuthFiles(names []string) error {
	return a.core.DeleteAuthFiles(names)
}

func (a *App) UpdateCodexAPIKeyPriority(input UpdateCodexAPIKeyPriorityInput) error {
	return a.core.UpdateCodexAPIKeyPriority(input.ID, input.Priority)
}

func (a *App) UpdateAccountPriority(input UpdateAccountPriorityInput) error {
	return a.core.UpdateAccountPriority(wailsapp.UpdateAccountPriorityInput{
		ID:       input.ID,
		Priority: input.Priority,
	})
}

func (a *App) UploadAuthFiles(files []UploadFilePayload) error {
	payload := make([]wailsapp.UploadFilePayload, 0, len(files))
	for _, file := range files {
		payload = append(payload, wailsapp.UploadFilePayload{
			Name:          file.Name,
			ContentBase64: file.ContentBase64,
		})
	}
	return a.core.UploadAuthFiles(payload)
}

func (a *App) GetAuthFileModels(name string) ([]map[string]interface{}, error) {
	return a.core.GetAuthFileModels(name)
}

func (a *App) DownloadAuthFile(name string) (*DownloadFileResponse, error) {
	result, err := a.core.DownloadAuthFile(name)
	if err != nil {
		return nil, err
	}
	return &DownloadFileResponse{
		Name:          result.Name,
		ContentBase64: result.ContentBase64,
	}, nil
}

func (a *App) GetUsageStatistics() (*UsageStatisticsResponse, error) {
	result, err := a.core.GetUsageStatistics()
	if err != nil {
		return nil, err
	}

	return &UsageStatisticsResponse{
		Usage:          result.Usage,
		FailedRequests: result.FailedRequests,
	}, nil
}

func (a *App) GetCodexLocalUsage() (*LocalProjectedUsageResponse, error) {
	result, err := a.core.GetCodexLocalUsage()
	if err != nil {
		return nil, err
	}
	return mapLocalProjectedUsageResponse(result), nil
}

func (a *App) RefreshCodexLocalUsage() (*LocalProjectedUsageResponse, error) {
	result, err := a.core.RefreshCodexLocalUsage()
	if err != nil {
		return nil, err
	}
	return mapLocalProjectedUsageResponse(result), nil
}

func (a *App) RebuildCodexLocalUsage() (*LocalProjectedUsageResponse, error) {
	result, err := a.core.RebuildCodexLocalUsage()
	if err != nil {
		return nil, err
	}
	return mapLocalProjectedUsageResponse(result), nil
}

func (a *App) GetLocalProjectedUsageSettings() (*LocalProjectedUsageSettings, error) {
	result, err := a.core.GetLocalProjectedUsageSettings()
	if err != nil {
		return nil, err
	}
	return &LocalProjectedUsageSettings{
		RefreshIntervalMinutes: result.RefreshIntervalMinutes,
	}, nil
}

func (a *App) UpdateLocalProjectedUsageSettings(input LocalProjectedUsageSettings) (*LocalProjectedUsageSettings, error) {
	result, err := a.core.UpdateLocalProjectedUsageSettings(wailsapp.LocalProjectedUsageSettings{
		RefreshIntervalMinutes: input.RefreshIntervalMinutes,
	})
	if err != nil {
		return nil, err
	}
	return &LocalProjectedUsageSettings{
		RefreshIntervalMinutes: result.RefreshIntervalMinutes,
	}, nil
}

func (a *App) StartCodexOAuth() (*OAuthStartResult, error) {
	result, err := a.core.StartCodexOAuth()
	if err != nil {
		return nil, err
	}
	return &OAuthStartResult{
		URL:   result.URL,
		State: result.State,
	}, nil
}

func (a *App) GetOAuthStatus(state string) (*OAuthStatusResult, error) {
	result, err := a.core.GetOAuthStatus(state)
	if err != nil {
		return nil, err
	}
	return &OAuthStatusResult{
		Status: result.Status,
		Error:  result.Error,
	}, nil
}

func (a *App) FinalizeCodexOAuth(input CompleteCodexOAuthInput) error {
	return a.core.FinalizeCodexOAuth(wailsapp.CompleteCodexOAuthInput{
		ExistingName:  input.ExistingName,
		PreviousNames: input.PreviousNames,
	})
}

func (a *App) GetCodexQuota(name string) (*CodexQuotaResponse, error) {
	result, err := a.core.GetCodexQuota(name)
	if err != nil {
		return nil, err
	}

	windows := make([]CodexQuotaWindow, 0, len(result.Windows))
	for _, window := range result.Windows {
		windows = append(windows, CodexQuotaWindow{
			ID:               window.ID,
			Label:            window.Label,
			RemainingPercent: window.RemainingPercent,
			ResetLabel:       window.ResetLabel,
			ResetAtUnix:      window.ResetAtUnix,
		})
	}

	return &CodexQuotaResponse{
		PlanType: result.PlanType,
		Windows:  windows,
	}, nil
}

func (a *App) ListAccounts() ([]AccountRecord, error) {
	result, err := a.core.ListAccounts()
	if err != nil {
		return nil, err
	}

	records := make([]AccountRecord, 0, len(result))
	for _, record := range result {
		records = append(records, mapAccountRecord(record))
	}
	return records, nil
}

func (a *App) ListOpenAICompatibleProviders() ([]OpenAICompatibleProvider, error) {
	result, err := a.core.ListOpenAICompatibleProviders()
	if err != nil {
		return nil, err
	}

	providers := make([]OpenAICompatibleProvider, 0, len(result))
	for _, item := range result {
		providers = append(providers, OpenAICompatibleProvider{
			Name:       item.Name,
			Priority:   item.Priority,
			Disabled:   item.Disabled,
			BaseURL:    item.BaseURL,
			Prefix:     item.Prefix,
			APIKey:     item.APIKey,
			APIKeys:    append([]string(nil), item.APIKeys...),
			Models:     mapOpenAICompatibleModels(item.Models),
			Headers:    item.Headers,
			KeyCount:   item.KeyCount,
			ModelCount: item.ModelCount,
			HasHeaders: item.HasHeaders,
		})
	}
	return providers, nil
}

func (a *App) GetRelayServiceConfig() (*RelayServiceConfig, error) {
	result, err := a.core.GetRelayServiceConfig()
	if err != nil {
		return nil, err
	}

	return &RelayServiceConfig{
		APIKeys:     append([]string(nil), result.APIKeys...),
		APIKeyItems: mapRelayServiceAPIKeyItems(result.APIKeyItems),
		Endpoints:   mapRelayServiceEndpoints(result.Endpoints),
	}, nil
}

func (a *App) UpdateRelayServiceAPIKey(apiKey string) (*RelayServiceConfig, error) {
	result, err := a.core.UpdateRelayServiceAPIKey(apiKey)
	if err != nil {
		return nil, err
	}

	return &RelayServiceConfig{
		APIKeys:     append([]string(nil), result.APIKeys...),
		APIKeyItems: mapRelayServiceAPIKeyItems(result.APIKeyItems),
		Endpoints:   mapRelayServiceEndpoints(result.Endpoints),
	}, nil
}

func (a *App) UpdateRelayServiceAPIKeys(apiKeys []string) (*RelayServiceConfig, error) {
	result, err := a.core.UpdateRelayServiceAPIKeys(apiKeys)
	if err != nil {
		return nil, err
	}

	return &RelayServiceConfig{
		APIKeys:     append([]string(nil), result.APIKeys...),
		APIKeyItems: mapRelayServiceAPIKeyItems(result.APIKeyItems),
		Endpoints:   mapRelayServiceEndpoints(result.Endpoints),
	}, nil
}

func mapRelayServiceAPIKeyItems(items []wailsapp.RelayServiceAPIKeyItem) []RelayServiceAPIKeyItem {
	if len(items) == 0 {
		return nil
	}

	result := make([]RelayServiceAPIKeyItem, 0, len(items))
	for _, item := range items {
		result = append(result, RelayServiceAPIKeyItem{
			Value:      item.Value,
			CreatedAt:  item.CreatedAt,
			LastUsedAt: item.LastUsedAt,
		})
	}
	return result
}

func (a *App) GetRelayRoutingConfig() (*RelayRoutingConfig, error) {
	result, err := a.core.GetRelayRoutingConfig()
	if err != nil {
		return nil, err
	}

	return &RelayRoutingConfig{
		Strategy:            result.Strategy,
		SessionAffinity:     result.SessionAffinity,
		SessionAffinityTTL:  result.SessionAffinityTTL,
		RequestRetry:        result.RequestRetry,
		MaxRetryCredentials: result.MaxRetryCredentials,
		MaxRetryInterval:    result.MaxRetryInterval,
		SwitchProject:       result.SwitchProject,
		SwitchPreviewModel:  result.SwitchPreviewModel,
		AntigravityCredits:  result.AntigravityCredits,
	}, nil
}

func (a *App) UpdateRelayRoutingConfig(config RelayRoutingConfig) (*RelayRoutingConfig, error) {
	result, err := a.core.UpdateRelayRoutingConfig(wailsapp.RelayRoutingConfig(config))
	if err != nil {
		return nil, err
	}

	return &RelayRoutingConfig{
		Strategy:            result.Strategy,
		SessionAffinity:     result.SessionAffinity,
		SessionAffinityTTL:  result.SessionAffinityTTL,
		RequestRetry:        result.RequestRetry,
		MaxRetryCredentials: result.MaxRetryCredentials,
		MaxRetryInterval:    result.MaxRetryInterval,
		SwitchProject:       result.SwitchProject,
		SwitchPreviewModel:  result.SwitchPreviewModel,
		AntigravityCredits:  result.AntigravityCredits,
	}, nil
}

func (a *App) ApplyRelayServiceConfigToLocal(apiKey string, baseURL string) (*RelayLocalApplyResult, error) {
	result, err := a.core.ApplyRelayServiceConfigToLocal(apiKey, baseURL)
	if err != nil {
		return nil, err
	}

	return &RelayLocalApplyResult{
		CodexHomePath: result.CodexHomePath,
		AuthFilePath:  result.AuthFilePath,
		ConfigPath:    result.ConfigPath,
	}, nil
}

func (a *App) CreateCodexAPIKey(input CreateCodexAPIKeyInput) error {
	return a.core.CreateCodexAPIKey(wailsapp.CreateCodexAPIKeyInput{
		APIKey:         input.APIKey,
		Label:          input.Label,
		BaseURL:        input.BaseURL,
		Priority:       input.Priority,
		Prefix:         input.Prefix,
		ProxyURL:       input.ProxyURL,
		Headers:        input.Headers,
		ExcludedModels: input.ExcludedModels,
	})
}

func (a *App) UpdateCodexAPIKeyLabel(input UpdateCodexAPIKeyLabelInput) error {
	return a.core.UpdateCodexAPIKeyLabel(wailsapp.UpdateCodexAPIKeyLabelInput{
		ID:    input.ID,
		Label: input.Label,
	})
}

func (a *App) UpdateCodexAPIKeyConfig(input UpdateCodexAPIKeyConfigInput) error {
	return a.core.UpdateCodexAPIKeyConfig(wailsapp.UpdateCodexAPIKeyConfigInput{
		ID:      input.ID,
		APIKey:  input.APIKey,
		BaseURL: input.BaseURL,
		Prefix:  input.Prefix,
	})
}

func (a *App) CreateOpenAICompatibleProvider(input CreateOpenAICompatibleProviderInput) error {
	return a.core.CreateOpenAICompatibleProvider(wailsapp.CreateOpenAICompatibleProviderInput{
		Name:    input.Name,
		BaseURL: input.BaseURL,
		Prefix:  input.Prefix,
		APIKey:  input.APIKey,
	})
}

func (a *App) DeleteOpenAICompatibleProvider(name string) error {
	return a.core.DeleteOpenAICompatibleProvider(name)
}

func (a *App) UpdateOpenAICompatibleProvider(input UpdateOpenAICompatibleProviderInput) error {
	return a.core.UpdateOpenAICompatibleProvider(wailsapp.UpdateOpenAICompatibleProviderInput{
		CurrentName: input.CurrentName,
		Name:        input.Name,
		BaseURL:     input.BaseURL,
		Prefix:      input.Prefix,
		APIKey:      input.APIKey,
		APIKeys:     append([]string(nil), input.APIKeys...),
		Headers:     input.Headers,
		Models:      mapOpenAICompatibleModelsToWails(input.Models),
	})
}

func (a *App) VerifyOpenAICompatibleProvider(input VerifyOpenAICompatibleProviderInput) (*VerifyOpenAICompatibleProviderResult, error) {
	result, err := a.core.VerifyOpenAICompatibleProvider(wailsapp.VerifyOpenAICompatibleProviderInput{
		BaseURL: input.BaseURL,
		APIKey:  input.APIKey,
		Model:   input.Model,
		Headers: input.Headers,
	})
	if err != nil {
		return nil, err
	}
	return &VerifyOpenAICompatibleProviderResult{
		Success:      result.Success,
		StatusCode:   result.StatusCode,
		Message:      result.Message,
		ResponseBody: result.ResponseBody,
	}, nil
}

func (a *App) FetchOpenAICompatibleProviderModels(input FetchOpenAICompatibleProviderModelsInput) (*FetchOpenAICompatibleProviderModelsResult, error) {
	result, err := a.core.FetchOpenAICompatibleProviderModels(wailsapp.FetchOpenAICompatibleProviderModelsInput{
		BaseURL: input.BaseURL,
		APIKey:  input.APIKey,
		Headers: input.Headers,
	})
	if err != nil {
		return nil, err
	}
	return &FetchOpenAICompatibleProviderModelsResult{
		Models:       mapOpenAICompatibleModels(result.Models),
		StatusCode:   result.StatusCode,
		Message:      result.Message,
		ResponseBody: result.ResponseBody,
	}, nil
}

func (a *App) DeleteCodexAPIKey(id string) error {
	return a.core.DeleteCodexAPIKey(id)
}

func mapAccountRecord(record accountsdomain.AccountRecord) AccountRecord {
	return AccountRecord{
		ID:               record.ID,
		Provider:         record.Provider,
		CredentialSource: record.CredentialSource,
		DisplayName:      record.DisplayName,
		Status:           record.Status,
		Priority:         record.Priority,
		Disabled:         record.Disabled,
		Email:            record.Email,
		PlanType:         record.PlanType,
		Name:             record.Name,
		APIKey:           record.APIKey,
		KeyFingerprint:   record.KeyFingerprint,
		KeySuffix:        record.KeySuffix,
		BaseURL:          record.BaseURL,
		Prefix:           record.Prefix,
		AuthIndex:        record.AuthIndex,
		QuotaKey:         record.QuotaKey,
		LocalOnly:        record.LocalOnly,
	}
}

func mapLocalProjectedUsageResponse(result *wailsapp.LocalProjectedUsageResponse) *LocalProjectedUsageResponse {
	if result == nil {
		return &LocalProjectedUsageResponse{}
	}

	details := make([]LocalProjectedUsageDetail, 0, len(result.Details))
	for _, detail := range result.Details {
		details = append(details, LocalProjectedUsageDetail{
			Timestamp:         detail.Timestamp,
			Provider:          detail.Provider,
			SourceKind:        detail.SourceKind,
			Model:             detail.Model,
			InputTokens:       detail.InputTokens,
			CachedInputTokens: detail.CachedInputTokens,
			OutputTokens:      detail.OutputTokens,
			RequestCount:      detail.RequestCount,
		})
	}

	return &LocalProjectedUsageResponse{
		Provider:         result.Provider,
		SourceKind:       result.SourceKind,
		ScannedFiles:     result.ScannedFiles,
		CacheHitFiles:    result.CacheHitFiles,
		DeltaAppendFiles: result.DeltaAppendFiles,
		FullRebuildFiles: result.FullRebuildFiles,
		FileMissingFiles: result.FileMissingFiles,
		Details:          details,
	}
}

func mapOpenAICompatibleModels(items []wailsapp.OpenAICompatibleModel) []OpenAICompatibleModel {
	models := make([]OpenAICompatibleModel, 0, len(items))
	for _, item := range items {
		models = append(models, OpenAICompatibleModel{
			Name:  item.Name,
			Alias: item.Alias,
		})
	}
	return models
}

func mapOpenAICompatibleModelsToWails(items []OpenAICompatibleModel) []wailsapp.OpenAICompatibleModel {
	models := make([]wailsapp.OpenAICompatibleModel, 0, len(items))
	for _, item := range items {
		models = append(models, wailsapp.OpenAICompatibleModel{
			Name:  item.Name,
			Alias: item.Alias,
		})
	}
	return models
}

func mapRelayServiceEndpoints(items []wailsapp.RelayServiceEndpoint) []RelayServiceEndpoint {
	endpoints := make([]RelayServiceEndpoint, 0, len(items))
	for _, item := range items {
		endpoints = append(endpoints, RelayServiceEndpoint{
			ID:      item.ID,
			Kind:    item.Kind,
			Host:    item.Host,
			BaseURL: item.BaseURL,
		})
	}
	return endpoints
}
