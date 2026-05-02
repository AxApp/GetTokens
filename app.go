package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

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

func (a *App) FetchVendorStatusRSS(url string) (string, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("Accept", "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5")
	req.Header.Set("User-Agent", "GetTokens Vendor Status/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return "", fmt.Errorf("vendor status rss returned %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	return string(body), nil
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

func (a *App) GetCodexSessionManagementSnapshot() (*SessionManagementSnapshot, error) {
	result, err := a.core.GetCodexSessionManagementSnapshot()
	if err != nil {
		return nil, err
	}
	return mapSessionManagementSnapshot(result), nil
}

func (a *App) RefreshCodexSessionManagementSnapshot() (*SessionManagementSnapshot, error) {
	result, err := a.core.RefreshCodexSessionManagementSnapshot()
	if err != nil {
		return nil, err
	}
	return mapSessionManagementSnapshot(result), nil
}

func (a *App) GetCodexSessionDetail(sessionID string) (*SessionManagementSessionDetail, error) {
	result, err := a.core.GetCodexSessionDetail(sessionID)
	if err != nil {
		return nil, err
	}
	return mapSessionManagementSessionDetail(result), nil
}

func (a *App) UpdateCodexSessionProviders(input UpdateSessionProvidersInput) (*SessionManagementSnapshot, error) {
	result, err := a.core.UpdateCodexSessionProviders(wailsapp.UpdateSessionProvidersInput{
		ProjectID: input.ProjectID,
		Mappings: func() []wailsapp.UpdateSessionProviderMapping {
			items := make([]wailsapp.UpdateSessionProviderMapping, 0, len(input.Mappings))
			for _, item := range input.Mappings {
				items = append(items, wailsapp.UpdateSessionProviderMapping{
					SourceProvider: item.SourceProvider,
					TargetProvider: item.TargetProvider,
				})
			}
			return items
		}(),
	})
	if err != nil {
		return nil, err
	}
	return mapSessionManagementSnapshot(result), nil
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

func (a *App) GetCodexFeatureConfig() (*CodexFeatureConfigSnapshot, error) {
	result, err := a.core.GetCodexFeatureConfig()
	if err != nil {
		return nil, err
	}
	return mapCodexFeatureConfigSnapshot(result), nil
}

func (a *App) PreviewCodexFeatureConfig(input SaveCodexFeatureConfigInput) (*CodexFeatureConfigPreview, error) {
	result, err := a.core.PreviewCodexFeatureConfig(wailsapp.SaveCodexFeatureConfigInput{
		Values: input.Values,
	})
	if err != nil {
		return nil, err
	}
	return mapCodexFeatureConfigPreview(result), nil
}

func (a *App) SaveCodexFeatureConfig(input SaveCodexFeatureConfigInput) (*CodexFeatureConfigPreview, error) {
	result, err := a.core.SaveCodexFeatureConfig(wailsapp.SaveCodexFeatureConfigInput{
		Values: input.Values,
	})
	if err != nil {
		return nil, err
	}
	return mapCodexFeatureConfigPreview(result), nil
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

func (a *App) ListRelaySupportedModels() (*RelaySupportedModelsResult, error) {
	result, err := a.core.ListRelaySupportedModels()
	if err != nil {
		return nil, err
	}

	return &RelaySupportedModelsResult{
		Models: mapOpenAICompatibleModels(result),
	}, nil
}

func (a *App) ListLocalCodexProviderViews() ([]LocalCodexModelProviderView, error) {
	result, err := a.core.ListLocalCodexModelProviders()
	if err != nil {
		return nil, err
	}

	providers := make([]LocalCodexModelProviderView, 0, len(result))
	for _, item := range result {
		providers = append(providers, LocalCodexModelProviderView{
			ProviderID:   item.ProviderID,
			ProviderName: item.ProviderName,
		})
	}
	return providers, nil
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

func (a *App) ApplyRelayServiceConfigToLocal(apiKey string, baseURL string, model string, reasoningEffort string, providerID string, providerName string) (*RelayLocalApplyResult, error) {
	result, err := a.core.ApplyRelayServiceConfigToLocal(apiKey, baseURL, model, reasoningEffort, providerID, providerName)
	if err != nil {
		return nil, err
	}

	return &RelayLocalApplyResult{
		CodexHomePath: result.CodexHomePath,
		AuthFilePath:  result.AuthFilePath,
		ConfigPath:    result.ConfigPath,
	}, nil
}

func (a *App) ApplyClaudeCodeAPIKeyConfigToLocal(apiKey string, baseURL string, model string) (*ClaudeCodeLocalApplyResult, error) {
	result, err := a.core.ApplyClaudeCodeAPIKeyConfigToLocal(apiKey, baseURL, model)
	if err != nil {
		return nil, err
	}

	return &ClaudeCodeLocalApplyResult{
		ClaudeConfigDirPath: result.ClaudeConfigDirPath,
		SettingsPath:        result.SettingsPath,
		Warnings:            append([]string(nil), result.Warnings...),
		Conflicts:           append([]string(nil), result.Conflicts...),
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
