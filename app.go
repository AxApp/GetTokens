package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/linhay/gettokens/internal/codexbinary"
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

func mapCodexConfigChangeInputs(inputs []CodexConfigChangeInput) []wailsapp.CodexConfigChangeInput {
	if len(inputs) == 0 {
		return nil
	}
	changes := make([]wailsapp.CodexConfigChangeInput, 0, len(inputs))
	for _, input := range inputs {
		changes = append(changes, wailsapp.CodexConfigChangeInput{
			ID:        input.ID,
			Section:   input.Section,
			Key:       input.Key,
			Path:      append([]string(nil), input.Path...),
			ValueType: input.ValueType,
			Value:     input.Value,
		})
	}
	return changes
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

func (a *App) beforeClose(ctx context.Context) bool {
	return a.core.BeforeClose(ctx)
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

func (a *App) ProbeCodexAccountRouting(input ProbeCodexAccountRoutingInput) (*CodexAccountRoutingProbeResult, error) {
	result, err := a.core.ProbeCodexAccountRouting(wailsapp.ProbeCodexAccountRoutingInput{
		Model:           input.Model,
		Attempts:        input.Attempts,
		AllowAccountIDs: append([]string(nil), input.AllowAccountIDs...),
		DenyAccountIDs:  append([]string(nil), input.DenyAccountIDs...),
		OrderAccountIDs: append([]string(nil), input.OrderAccountIDs...),
		AllowFallback:   input.AllowFallback,
	})
	if err != nil {
		return nil, err
	}
	attempts := make([]CodexAccountRoutingProbeAttempt, 0, len(result.Attempts))
	for _, attempt := range result.Attempts {
		attempts = append(attempts, CodexAccountRoutingProbeAttempt{
			Index:        attempt.Index,
			Success:      attempt.Success,
			StatusCode:   attempt.StatusCode,
			AccountID:    attempt.AccountID,
			AccountLabel: attempt.AccountLabel,
			Provider:     attempt.Provider,
			Message:      attempt.Message,
			Evidence:     attempt.Evidence,
			ResponseBody: attempt.ResponseBody,
			StartedAt:    attempt.StartedAt,
			FinishedAt:   attempt.FinishedAt,
		})
	}
	return &CodexAccountRoutingProbeResult{
		Model:    result.Model,
		Attempts: attempts,
	}, nil
}

func (a *App) ProbeClaudeCodeAccountRouting(input ProbeClaudeCodeAccountRoutingInput) (*ClaudeCodeAccountRoutingProbeResult, error) {
	result, err := a.core.ProbeClaudeCodeAccountRouting(wailsapp.ProbeClaudeCodeAccountRoutingInput{
		Model:           input.Model,
		Attempts:        input.Attempts,
		AllowAccountIDs: append([]string(nil), input.AllowAccountIDs...),
		DenyAccountIDs:  append([]string(nil), input.DenyAccountIDs...),
		OrderAccountIDs: append([]string(nil), input.OrderAccountIDs...),
		AllowFallback:   input.AllowFallback,
	})
	if err != nil {
		return nil, err
	}
	attempts := make([]ClaudeCodeAccountRoutingProbeAttempt, 0, len(result.Attempts))
	for _, attempt := range result.Attempts {
		attempts = append(attempts, ClaudeCodeAccountRoutingProbeAttempt{
			Index:        attempt.Index,
			Success:      attempt.Success,
			StatusCode:   attempt.StatusCode,
			AccountID:    attempt.AccountID,
			AccountLabel: attempt.AccountLabel,
			Provider:     attempt.Provider,
			Message:      attempt.Message,
			Evidence:     attempt.Evidence,
			ResponseBody: attempt.ResponseBody,
			StartedAt:    attempt.StartedAt,
			FinishedAt:   attempt.FinishedAt,
		})
	}
	return &ClaudeCodeAccountRoutingProbeResult{
		Model:    result.Model,
		Attempts: attempts,
	}, nil
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

func (a *App) ListOAuthModelAliases(channel string) ([]OpenAICompatibleModel, error) {
	items, err := a.core.ListOAuthModelAliases(channel)
	if err != nil {
		return nil, err
	}
	out := make([]OpenAICompatibleModel, 0, len(items))
	for _, item := range items {
		out = append(out, OpenAICompatibleModel{
			Name:  item.Name,
			Alias: item.Alias,
		})
	}
	return out, nil
}

func (a *App) UpdateOAuthModelAliases(input UpdateOAuthModelAliasesInput) error {
	models := make([]wailsapp.OpenAICompatibleModel, 0, len(input.Models))
	for _, model := range input.Models {
		models = append(models, wailsapp.OpenAICompatibleModel{
			Name:  model.Name,
			Alias: model.Alias,
		})
	}
	return a.core.UpdateOAuthModelAliases(wailsapp.UpdateOAuthModelAliasesInput{
		Channel: input.Channel,
		Models:  models,
	})
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

func (a *App) GetSidecarUsageAttribution(input SidecarUsageAttributionInput) (*SidecarUsageAttributionResponse, error) {
	result, err := a.core.GetSidecarUsageAttribution(mapSidecarUsageAttributionInput(input))
	if err != nil {
		return nil, err
	}
	return mapSidecarUsageAttributionResponse(result), nil
}

func (a *App) ListRateLimitStrategies() ([]RateLimitStrategyMeta, error) {
	result, err := a.core.ListRateLimitStrategies()
	if err != nil {
		return nil, err
	}
	return mapRateLimitStrategies(result), nil
}

func (a *App) ListRateLimitRules(input RateLimitRulesInput) ([]RateLimitRule, error) {
	result, err := a.core.ListRateLimitRules(input.AccountKey)
	if err != nil {
		return nil, err
	}
	return mapRateLimitRules(result), nil
}

func (a *App) CreateRateLimitRule(input RateLimitRule) ([]RateLimitRule, error) {
	result, err := a.core.CreateRateLimitRule(mapRateLimitRuleToCore(input))
	if err != nil {
		return nil, err
	}
	return mapRateLimitRules(result), nil
}

func (a *App) UpdateRateLimitRule(input RateLimitRule) ([]RateLimitRule, error) {
	result, err := a.core.UpdateRateLimitRule(mapRateLimitRuleToCore(input))
	if err != nil {
		return nil, err
	}
	return mapRateLimitRules(result), nil
}

func (a *App) DeleteRateLimitRule(input DeleteRateLimitRuleInput) error {
	return a.core.DeleteRateLimitRule(input.ID)
}

func (a *App) GetAllRateLimitStatuses() ([]RateLimitState, error) {
	result, err := a.core.GetAllRateLimitStatuses()
	if err != nil {
		return nil, err
	}
	return mapRateLimitStates(result), nil
}

func (a *App) GetRateLimitStatus(input RateLimitStatusInput) (*RateLimitState, error) {
	result, err := a.core.GetRateLimitStatus(input.AccountKey)
	if err != nil {
		return nil, err
	}
	return mapRateLimitState(result), nil
}

func (a *App) ListRateLimitEvents(input RateLimitEventsInput) ([]RateLimitEvent, error) {
	result, err := a.core.ListRateLimitEvents(input.AccountKey, input.Limit)
	if err != nil {
		return nil, err
	}
	return mapRateLimitEvents(result), nil
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

func (a *App) RebuildCodexLocalUsageDay(dayKey string) (*LocalProjectedUsageResponse, error) {
	result, err := a.core.RebuildCodexLocalUsageDay(dayKey)
	if err != nil {
		return nil, err
	}
	return mapLocalProjectedUsageResponse(result), nil
}

func (a *App) GetClaudeLocalUsage() (*LocalProjectedUsageResponse, error) {
	result, err := a.core.GetClaudeLocalUsage()
	if err != nil {
		return nil, err
	}
	return mapLocalProjectedUsageResponse(result), nil
}

func (a *App) RefreshClaudeLocalUsage() (*LocalProjectedUsageResponse, error) {
	result, err := a.core.RefreshClaudeLocalUsage()
	if err != nil {
		return nil, err
	}
	return mapLocalProjectedUsageResponse(result), nil
}

func (a *App) RebuildClaudeLocalUsage() (*LocalProjectedUsageResponse, error) {
	result, err := a.core.RebuildClaudeLocalUsage()
	if err != nil {
		return nil, err
	}
	return mapLocalProjectedUsageResponse(result), nil
}

func (a *App) RebuildClaudeLocalUsageDay(dayKey string) (*LocalProjectedUsageResponse, error) {
	result, err := a.core.RebuildClaudeLocalUsageDay(dayKey)
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

func (a *App) GetClaudeCodeSessionManagementSnapshot() (*SessionManagementSnapshot, error) {
	result, err := a.core.GetClaudeCodeSessionManagementSnapshot()
	if err != nil {
		return nil, err
	}
	return mapSessionManagementSnapshot(result), nil
}

func (a *App) GetCodexBinarySnapshot() (*codexbinary.Snapshot, error) {
	return a.core.GetCodexBinarySnapshot()
}

func (a *App) RefreshCodexBinaryAvailable() (*codexbinary.Snapshot, error) {
	return a.core.RefreshCodexBinaryAvailable()
}

func (a *App) ImportCodexBinary(input codexbinary.ImportLocalInput) (*codexbinary.InstallResult, error) {
	return a.core.ImportCodexBinary(input)
}

func (a *App) DownloadCodexBinary(input codexbinary.DownloadInput) (*codexbinary.DownloadResult, error) {
	return a.core.DownloadCodexBinary(input)
}

func (a *App) EnableCodexBinaryManagedPath() (*codexbinary.EnableManagedPathResult, error) {
	return a.core.EnableCodexBinaryManagedPath()
}

func (a *App) UseCodexBinary(input codexbinary.UseInput) (*codexbinary.UseResult, error) {
	return a.core.UseCodexBinary(input)
}

func (a *App) RevealCodexBinaryVersion(input codexbinary.VersionActionInput) error {
	return a.core.RevealCodexBinaryVersion(input)
}

func (a *App) DeleteCodexBinaryVersion(input codexbinary.VersionActionInput) (*codexbinary.DeleteVersionResult, error) {
	return a.core.DeleteCodexBinaryVersion(input)
}

func (a *App) GetCodexBinaryVersionNotes(input codexbinary.VersionNotesInput) (*codexbinary.VersionNotesView, error) {
	return a.core.GetCodexBinaryVersionNotes(input)
}

func (a *App) GetCodexBinaryDoctor() (*codexbinary.DoctorSummary, error) {
	return a.core.GetCodexBinaryDoctor()
}

func (a *App) RefreshCodexSessionManagementSnapshot() (*SessionManagementSnapshot, error) {
	result, err := a.core.RefreshCodexSessionManagementSnapshot()
	if err != nil {
		return nil, err
	}
	return mapSessionManagementSnapshot(result), nil
}

func (a *App) RefreshClaudeCodeSessionManagementSnapshot() (*SessionManagementSnapshot, error) {
	result, err := a.core.RefreshClaudeCodeSessionManagementSnapshot()
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

func (a *App) GetClaudeCodeSessionDetail(sessionID string) (*SessionManagementSessionDetail, error) {
	result, err := a.core.GetClaudeCodeSessionDetail(sessionID)
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
		Snapshot: mapSessionManagementSnapshotToCore(input.Snapshot),
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

func (a *App) GetSidecarProxySettings() (*SidecarProxySettings, error) {
	result, err := a.core.GetSidecarProxySettings()
	if err != nil {
		return nil, err
	}
	return &SidecarProxySettings{
		UseSystemProxy:          result.UseSystemProxy,
		ConfigPath:              result.ConfigPath,
		AppliedToRunningSidecar: result.AppliedToRunningSidecar,
	}, nil
}

func (a *App) UpdateSidecarProxySettings(input SidecarProxySettings) (*SidecarProxySettings, error) {
	result, err := a.core.UpdateSidecarProxySettings(wailsapp.SidecarProxySettings{
		UseSystemProxy: input.UseSystemProxy,
		ConfigPath:     input.ConfigPath,
	})
	if err != nil {
		return nil, err
	}
	return &SidecarProxySettings{
		UseSystemProxy:          result.UseSystemProxy,
		ConfigPath:              result.ConfigPath,
		AppliedToRunningSidecar: result.AppliedToRunningSidecar,
	}, nil
}

func (a *App) GetAppRuntimeSettings() (*AppRuntimeSettings, error) {
	result, err := a.core.GetAppRuntimeSettings()
	if err != nil {
		return nil, err
	}
	return &AppRuntimeSettings{
		LaunchAtLogin:          result.LaunchAtLogin,
		LaunchAtLoginSupported: result.LaunchAtLoginSupported,
		LaunchAgentPath:        result.LaunchAgentPath,
		CloseAction:            result.CloseAction,
		MenuBarResident:        result.MenuBarResident,
		ConfigPath:             result.ConfigPath,
	}, nil
}

func (a *App) UpdateAppRuntimeSettings(input AppRuntimeSettings) (*AppRuntimeSettings, error) {
	result, err := a.core.UpdateAppRuntimeSettings(wailsapp.AppRuntimeSettings{
		LaunchAtLogin: input.LaunchAtLogin,
		CloseAction:   input.CloseAction,
	})
	if err != nil {
		return nil, err
	}
	return &AppRuntimeSettings{
		LaunchAtLogin:          result.LaunchAtLogin,
		LaunchAtLoginSupported: result.LaunchAtLoginSupported,
		LaunchAgentPath:        result.LaunchAgentPath,
		CloseAction:            result.CloseAction,
		MenuBarResident:        result.MenuBarResident,
		ConfigPath:             result.ConfigPath,
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
		Values:  input.Values,
		Changes: mapCodexConfigChangeInputs(input.Changes),
	})
	if err != nil {
		return nil, err
	}
	return mapCodexFeatureConfigPreview(result), nil
}

func (a *App) SaveCodexFeatureConfig(input SaveCodexFeatureConfigInput) (*CodexFeatureConfigPreview, error) {
	result, err := a.core.SaveCodexFeatureConfig(wailsapp.SaveCodexFeatureConfigInput{
		Values:  input.Values,
		Changes: mapCodexConfigChangeInputs(input.Changes),
	})
	if err != nil {
		return nil, err
	}
	return mapCodexFeatureConfigPreview(result), nil
}

func (a *App) GetCodexSkillsSnapshot() (*CodexSkillsSnapshot, error) {
	result, err := a.core.GetCodexSkillsSnapshot()
	if err != nil {
		return nil, err
	}
	return mapCodexSkillsSnapshot(result), nil
}

func (a *App) GetClaudeCodeExtensionsSnapshot() (*ClaudeCodeExtensionsSnapshot, error) {
	result, err := a.core.GetClaudeCodeExtensionsSnapshot()
	if err != nil {
		return nil, err
	}
	return mapClaudeCodeExtensionsSnapshot(result), nil
}

func (a *App) SaveClaudeCodeMcpServer(input SaveClaudeCodeMcpServerInput) (*SaveClaudeCodeMcpServerResult, error) {
	result, err := a.core.SaveClaudeCodeMcpServer(wailsapp.SaveClaudeCodeMcpServerInput{
		Server: mapWailsClaudeCodeMcpAsset(input.Server),
	})
	if err != nil {
		return nil, err
	}
	return mapClaudeCodeMcpSaveResult(result), nil
}

func (a *App) GetClaudeCodeSettingsSnapshot() (*ClaudeCodeSettingsSnapshotDTO, error) {
	result, err := a.core.GetClaudeCodeSettingsSnapshot()
	if err != nil {
		return nil, err
	}
	return mapClaudeCodeSettingsSnapshot(result), nil
}

func (a *App) PatchClaudeCodeSettings(input PatchClaudeCodeSettingsInputDTO) (*PatchClaudeCodeSettingsResultDTO, error) {
	result, err := a.core.PatchClaudeCodeSettings(wailsapp.PatchClaudeCodeSettingsInput{
		Scope:   wailsapp.ClaudeCodeSettingsScope(input.Scope),
		Path:    input.Path,
		Patches: input.Patches,
	})
	if err != nil {
		return nil, err
	}
	return mapClaudeCodeSettingsPatchResult(result), nil
}

func (a *App) SaveCodexSkillEnabled(input SaveCodexSkillEnabledInput) (*SaveCodexSkillEnabledResult, error) {
	result, err := a.core.SaveCodexSkillEnabled(wailsapp.SaveCodexSkillEnabledInput{
		Path:    input.Path,
		Name:    input.Name,
		Enabled: input.Enabled,
	})
	if err != nil {
		return nil, err
	}
	return &SaveCodexSkillEnabledResult{
		ConfigPath: result.ConfigPath,
		Preview:    result.Preview,
	}, nil
}

func (a *App) GetCodexSkillFilePreview(input GetCodexSkillFilePreviewInput) (*GetCodexSkillFilePreviewResult, error) {
	result, err := a.core.GetCodexSkillFilePreview(wailsapp.GetCodexSkillFilePreviewInput{
		SkillPath: input.SkillPath,
		FilePath:  input.FilePath,
	})
	if err != nil {
		return nil, err
	}
	return &GetCodexSkillFilePreviewResult{
		Path:        result.Path,
		Content:     result.Content,
		Previewable: result.Previewable,
	}, nil
}

func (a *App) RemoveCodexSkill(input RemoveCodexSkillInput) (*RemoveCodexSkillResult, error) {
	result, err := a.core.RemoveCodexSkill(wailsapp.RemoveCodexSkillInput{
		Path: input.Path,
	})
	if err != nil {
		return nil, err
	}
	return &RemoveCodexSkillResult{
		ConfigPath:  result.ConfigPath,
		RemovedPath: result.RemovedPath,
		Preview:     result.Preview,
	}, nil
}

func (a *App) OpenCodexSkillInFinder(input OpenCodexSkillInFinderInput) (*OpenCodexSkillInFinderResult, error) {
	result, err := a.core.OpenCodexSkillInFinder(wailsapp.OpenCodexSkillInFinderInput{
		Path: input.Path,
	})
	if err != nil {
		return nil, err
	}
	return &OpenCodexSkillInFinderResult{Path: result.Path}, nil
}

func (a *App) GetCodexMcpServers() (*CodexMcpServersSnapshot, error) {
	result, err := a.core.GetCodexMcpServers()
	if err != nil {
		return nil, err
	}
	return mapCodexMcpServersSnapshot(result), nil
}

func (a *App) SaveCodexMcpServer(input SaveCodexMcpServerInput) (*SaveCodexMcpServerResult, error) {
	result, err := a.core.SaveCodexMcpServer(wailsapp.SaveCodexMcpServerInput{
		Server: mapWailsCodexMcpServer(input.Server),
	})
	if err != nil {
		return nil, err
	}
	return mapCodexMcpSaveResult(result), nil
}

func (a *App) OpenCodexConfigToml() (*OpenCodexConfigTomlResult, error) {
	result, err := a.core.OpenCodexConfigToml()
	if err != nil {
		return nil, err
	}
	return &OpenCodexConfigTomlResult{ConfigPath: result.ConfigPath}, nil
}

func (a *App) GetCodexConfigToml() (*CodexConfigTomlDocument, error) {
	result, err := a.core.GetCodexConfigToml()
	if err != nil {
		return nil, err
	}
	return &CodexConfigTomlDocument{
		ConfigPath: result.ConfigPath,
		Content:    result.Content,
		Exists:     result.Exists,
	}, nil
}

func (a *App) SaveCodexConfigToml(input SaveCodexConfigTomlInput) (*SaveCodexConfigTomlResult, error) {
	result, err := a.core.SaveCodexConfigToml(wailsapp.SaveCodexConfigTomlInput{Content: input.Content})
	if err != nil {
		return nil, err
	}
	return &SaveCodexConfigTomlResult{
		ConfigPath: result.ConfigPath,
		Content:    result.Content,
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
	return mapCodexQuotaResponse(result), nil
}

func (a *App) TestCodexAPIKeyQuotaCurl(input TestCodexAPIKeyQuotaCurlInput) (*CodexQuotaResponse, error) {
	result, err := a.core.TestCodexAPIKeyQuotaCurl(wailsapp.TestCodexAPIKeyQuotaCurlInput{
		APIKey:    input.APIKey,
		BaseURL:   input.BaseURL,
		Prefix:    input.Prefix,
		QuotaCurl: input.QuotaCurl,
	})
	if err != nil {
		return nil, err
	}
	return mapCodexQuotaResponse(result), nil
}

func (a *App) TestCodexAPIKeyBillingCurl(input TestCodexAPIKeyQuotaCurlInput) (*CodexQuotaBillingInfo, error) {
	result, err := a.core.TestCodexAPIKeyBillingCurl(wailsapp.TestCodexAPIKeyQuotaCurlInput{
		APIKey:    input.APIKey,
		BaseURL:   input.BaseURL,
		Prefix:    input.Prefix,
		QuotaCurl: input.QuotaCurl,
	})
	if err != nil {
		return nil, err
	}
	return mapCodexQuotaBillingInfo(result), nil
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
			ProxyURL:   item.ProxyURL,
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

	return mapLocalCodexModelProviderViews(result), nil
}

func (a *App) GetLocalCodexModelProviderStateView() (*LocalCodexModelProviderStateView, error) {
	result, err := a.core.GetLocalCodexModelProviderState()
	if err != nil {
		return nil, err
	}

	return &LocalCodexModelProviderStateView{
		CurrentProviderID:        result.CurrentProviderID,
		CurrentProviderName:      result.CurrentProviderName,
		CurrentProviderIsBuiltin: result.CurrentProviderIsBuiltin,
		CurrentProviderExists:    result.CurrentProviderExists,
		Providers:                mapLocalCodexModelProviderViews(result.Providers),
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

func mapLocalCodexModelProviderViews(result []wailsapp.LocalCodexModelProvider) []LocalCodexModelProviderView {
	providers := make([]LocalCodexModelProviderView, 0, len(result))
	for _, item := range result {
		providers = append(providers, LocalCodexModelProviderView{
			ProviderID:   item.ProviderID,
			ProviderName: item.ProviderName,
		})
	}
	return providers
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

func (a *App) ApplyRelayServiceConfigToLocal(apiKey string, baseURL string, model string, reasoningEffort string, providerID string, providerName string, supportsWebsockets bool) (*RelayLocalApplyResult, error) {
	result, err := a.core.ApplyRelayServiceConfigToLocal(apiKey, baseURL, model, reasoningEffort, providerID, providerName, supportsWebsockets)
	if err != nil {
		return nil, err
	}

	return &RelayLocalApplyResult{
		CodexHomePath: result.CodexHomePath,
		AuthFilePath:  result.AuthFilePath,
		ConfigPath:    result.ConfigPath,
	}, nil
}

func (a *App) ApplyRelayServiceConfigToLocalV2(input RelayLocalApplyInput) (*RelayLocalApplyResult, error) {
	result, err := a.core.ApplyRelayServiceConfigToLocalV2(wailsapp.RelayLocalApplyInput{
		APIKey:                input.APIKey,
		AuthFileContentBase64: input.AuthFileContentBase64,
		BaseURL:               input.BaseURL,
		Model:                 input.Model,
		ReasoningEffort:       input.ReasoningEffort,
		ProviderID:            input.ProviderID,
		ProviderName:          input.ProviderName,
		SupportsWebsockets:    input.SupportsWebsockets,
		AuthStrategy:          input.AuthStrategy,
		SkipRelayKeyMetadata:  input.SkipRelayKeyMetadata,
	})
	if err != nil {
		return nil, err
	}

	return &RelayLocalApplyResult{
		CodexHomePath: result.CodexHomePath,
		AuthFilePath:  result.AuthFilePath,
		ConfigPath:    result.ConfigPath,
	}, nil
}

func (a *App) GetLocalCodexAuthState() (*LocalCodexAuthState, error) {
	result, err := a.core.GetLocalCodexAuthState()
	if err != nil {
		return nil, err
	}

	return &LocalCodexAuthState{
		AuthFilePath:           result.AuthFilePath,
		HasAuthFile:            result.HasAuthFile,
		AuthMode:               result.AuthMode,
		HasOpenAIAPIKey:        result.HasOpenAIAPIKey,
		HasTokens:              result.HasTokens,
		AccountEmail:           result.AccountEmail,
		PlanType:               result.PlanType,
		CanPreserveChatGPTAuth: result.CanPreserveChatGPTAuth,
		Warnings:               append([]string(nil), result.Warnings...),
	}, nil
}

func (a *App) ApplyClaudeCodeAPIKeyConfigToLocal(apiKey string, baseURL string, options ClaudeCodeLocalApplyOptions) (*ClaudeCodeLocalApplyResult, error) {
	result, err := a.core.ApplyClaudeCodeAPIKeyConfigToLocal(apiKey, baseURL, wailsapp.ClaudeCodeLocalApplyOptions{
		Model:                       options.Model,
		DefaultHaikuModel:           options.DefaultHaikuModel,
		DefaultSonnetModel:          options.DefaultSonnetModel,
		DefaultOpusModel:            options.DefaultOpusModel,
		SmallFastModel:              options.SmallFastModel,
		MaxOutputTokens:             options.MaxOutputTokens,
		APITimeoutMS:                options.APITimeoutMS,
		DisableNonEssentialTraffic:  options.DisableNonEssentialTraffic,
		ClaudeCodeAttributionHeader: options.ClaudeCodeAttributionHeader,
	})
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
		FormatBaseURLs: input.FormatBaseURLs,
		Priority:       input.Priority,
		Prefix:         input.Prefix,
		ProxyURL:       input.ProxyURL,
		Headers:        input.Headers,
		Models:         mapOpenAICompatibleModelsToWails(input.Models),
		ExcludedModels: input.ExcludedModels,
		QuotaCurl:      input.QuotaCurl,
		QuotaEnabled:   input.QuotaEnabled,
		BillingCurl:    input.BillingCurl,
		BillingEnabled: input.BillingEnabled,
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
		ID:             input.ID,
		APIKey:         input.APIKey,
		BaseURL:        input.BaseURL,
		Prefix:         input.Prefix,
		ProxyURL:       input.ProxyURL,
		Models:         mapOpenAICompatibleModelsToWails(input.Models),
		QuotaCurl:      input.QuotaCurl,
		QuotaEnabled:   input.QuotaEnabled,
		BillingCurl:    input.BillingCurl,
		BillingEnabled: input.BillingEnabled,
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
		ProxyURL:    input.ProxyURL,
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

func (a *App) GetClaudeCodeMemoryFilesSnapshot() (*ClaudeCodeMemoryFilesSnapshotDTO, error) {
	result, err := a.core.GetClaudeCodeMemoryFilesSnapshot()
	if err != nil {
		return nil, err
	}
	return mapClaudeCodeMemoryFilesSnapshot(result), nil
}

func (a *App) SaveClaudeCodeMemoryFile(input SaveClaudeCodeMemoryFileInputDTO) (*SaveClaudeCodeMemoryFileResultDTO, error) {
	result, err := a.core.SaveClaudeCodeMemoryFile(wailsapp.SaveClaudeCodeMemoryFileInput{
		Path:    input.Path,
		Content: input.Content,
	})
	if err != nil {
		return nil, err
	}
	return mapClaudeCodeMemoryFileSaveResult(result), nil
}

func (a *App) GetClaudeCodeSubagentsSnapshot() (*ClaudeCodeSubagentsSnapshotDTO, error) {
	result, err := a.core.GetClaudeCodeSubagentsSnapshot()
	if err != nil {
		return nil, err
	}
	return mapClaudeCodeSubagentsSnapshot(result), nil
}

func (a *App) SaveClaudeCodeSubagent(input SaveClaudeCodeSubagentInputDTO) (*SaveClaudeCodeSubagentResultDTO, error) {
	result, err := a.core.SaveClaudeCodeSubagent(wailsapp.SaveClaudeCodeSubagentInput{
		Scope:         input.Scope,
		Path:          input.Path,
		Name:          input.Name,
		Description:   input.Description,
		KnownFields:   input.KnownFields,
		UnknownFields: input.UnknownFields,
		Body:          input.Body,
	})
	if err != nil {
		return nil, err
	}
	return mapClaudeCodeSubagentSaveResult(result), nil
}

func (a *App) DeleteClaudeCodeSubagent(input DeleteClaudeCodeSubagentInputDTO) error {
	return a.core.DeleteClaudeCodeSubagent(wailsapp.DeleteClaudeCodeSubagentInput{
		Scope: input.Scope,
		Path:  input.Path,
	})
}
func (a *App) DeleteCodexAPIKey(id string) error {
	return a.core.DeleteCodexAPIKey(id)
}
