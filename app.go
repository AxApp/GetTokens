package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/linhay/gettokens/internal/codexbinary"
	"github.com/linhay/gettokens/internal/sidecar"
	"github.com/linhay/gettokens/internal/updater"
	wailsapp "github.com/linhay/gettokens/internal/wailsapp"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// Version is injected at build time via -ldflags
var Version = "dev"

// ReleaseLabel is injected at build time for UI display, format: YYYY.MM.DD.HH
var ReleaseLabel = ""

// GitHubRepo is the repository used for auto-update checks
const GitHubRepo = "AxApp/GetTokens"

type App struct {
	core               *wailsapp.App
	ctx                context.Context
	pendingDeepLinkMu  sync.Mutex
	pendingDeepLinkURL []string
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
			Remove:    input.Remove,
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
	a.ctx = ctx
	a.core.Startup(ctx)
	installNativeApplicationMenuUpdateItem(a)
	a.emitQueuedDeepLinks()
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

func (a *App) queueDeepLinks(urls []string) {
	links := filterDeepLinkURLs(urls)
	if len(links) == 0 {
		return
	}
	a.pendingDeepLinkMu.Lock()
	a.pendingDeepLinkURL = append(a.pendingDeepLinkURL, links...)
	a.pendingDeepLinkMu.Unlock()
	a.emitQueuedDeepLinks()
}

func (a *App) ConsumePendingDeepLinks() []string {
	a.pendingDeepLinkMu.Lock()
	defer a.pendingDeepLinkMu.Unlock()
	links := append([]string(nil), a.pendingDeepLinkURL...)
	a.pendingDeepLinkURL = nil
	return links
}

func (a *App) emitQueuedDeepLinks() {
	if a.ctx == nil {
		return
	}
	a.pendingDeepLinkMu.Lock()
	links := append([]string(nil), a.pendingDeepLinkURL...)
	a.pendingDeepLinkMu.Unlock()
	for _, link := range links {
		wailsruntime.EventsEmit(a.ctx, "deeplink:import", link)
	}
}

func filterDeepLinkURLs(values []string) []string {
	links := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		normalized := strings.ToLower(trimmed)
		if strings.HasPrefix(normalized, "gt://") || strings.HasPrefix(normalized, "gt-dev://") {
			links = append(links, trimmed)
		}
	}
	return links
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

func (a *App) GetChannelRoutingConfig(channel string) (*ChannelRoutingConfig, error) {
	result, err := a.core.GetChannelRoutingConfig(channel)
	if err != nil {
		return nil, err
	}
	return mapChannelRoutingConfig(result), nil
}

func (a *App) SaveChannelRoutingConfig(input ChannelRoutingConfig) (*ChannelRoutingConfig, error) {
	result, err := a.core.SaveChannelRoutingConfig(mapWailsChannelRoutingConfig(input))
	if err != nil {
		return nil, err
	}
	return mapChannelRoutingConfig(result), nil
}

func (a *App) ExplainChannelRouting(input ChannelRoutingExplainInput) (*ChannelRoutingExplainResult, error) {
	result, err := a.core.ExplainChannelRouting(mapChannelRoutingExplainInputToCore(input))
	if err != nil {
		return nil, err
	}
	return mapChannelRoutingExplainResult(result), nil
}

func mapChannelRoutingExplainInputToCore(input ChannelRoutingExplainInput) wailsapp.ChannelRoutingExplainInput {
	return wailsapp.ChannelRoutingExplainInput{
		Channel:              input.Channel,
		TriedAccountIDs:      append([]string(nil), input.TriedAccountIDs...),
		ActiveSessions:       cloneIntMap(input.ActiveSessions),
		StickyAccountID:      input.StickyAccountID,
		ProjectKey:           input.ProjectKey,
		ProjectName:          input.ProjectName,
		ProjectKeySource:     input.ProjectKeySource,
		ProjectKeyConfidence: input.ProjectKeyConfidence,
		ProjectMatchKeys:     append([]string(nil), input.ProjectMatchKeys...),
	}
}

func (a *App) MarkChannelRouteAccountResult(input ChannelRouteAccountResultInput) (*ChannelAccountRuntimeState, error) {
	result, err := a.core.MarkChannelRouteAccountResult(wailsapp.ChannelRouteAccountResultInput{
		AccountID:       input.AccountID,
		StatusCode:      input.StatusCode,
		ErrorType:       input.ErrorType,
		Reason:          input.Reason,
		CooldownSeconds: input.CooldownSeconds,
		Model:           input.Model,
	})
	if err != nil {
		return nil, err
	}
	return mapChannelAccountRuntimeState(result), nil
}

func (a *App) ListChannelRouteEvents(input ChannelRouteEventsInput) ([]ChannelRouteEvent, error) {
	result, err := a.core.ListChannelRouteEvents(wailsapp.ChannelRouteEventsInput{
		Channel: input.Channel,
		Limit:   input.Limit,
	})
	if err != nil {
		return nil, err
	}
	out := make([]ChannelRouteEvent, 0, len(result))
	for _, event := range result {
		out = append(out, ChannelRouteEvent{
			ID:                      event.ID,
			RecordedAt:              event.RecordedAt,
			Channel:                 event.Channel,
			ProjectKey:              event.ProjectKey,
			ProjectName:             event.ProjectName,
			ProjectKeySource:        event.ProjectKeySource,
			ProjectKeyConfidence:    event.ProjectKeyConfidence,
			RouteMode:               string(event.RouteMode),
			SelectedAccountID:       event.SelectedAccountID,
			CandidateCount:          event.CandidateCount,
			FilteredCount:           event.FilteredCount,
			SnapshotVersion:         event.SnapshotVersion,
			PolicyVersion:           event.PolicyVersion,
			ShadowEnabled:           event.ShadowEnabled,
			ShadowRouteMode:         string(event.ShadowRouteMode),
			ShadowSelectedAccountID: event.ShadowSelectedAccountID,
			ShadowDiff:              event.ShadowDiff,
			Redacted:                event.Redacted,
		})
	}
	return out, nil
}

func (a *App) ListChannelRouteDecisions(input ChannelRouteDecisionsInput) ([]ChannelRouteDecision, error) {
	result, err := a.core.ListChannelRouteDecisions(wailsapp.ChannelRouteDecisionsInput{
		Channel: input.Channel,
		Limit:   input.Limit,
	})
	if err != nil {
		return nil, err
	}
	out := make([]ChannelRouteDecision, 0, len(result))
	for _, item := range result {
		decision := ChannelRouteDecision{
			ID:                   item.ID,
			RecordedAt:           item.RecordedAt,
			Channel:              item.Channel,
			Providers:            append([]string(nil), item.Providers...),
			Model:                item.Model,
			ProjectKey:           item.ProjectKey,
			ProjectName:          item.ProjectName,
			ProjectKeySource:     item.ProjectKeySource,
			ProjectKeyConfidence: item.ProjectKeyConfidence,
			ProjectMatchKeys:     append([]string(nil), item.ProjectMatchKeys...),
			Source:               item.Source,
			CandidateCount:       item.CandidateCount,
			SelectedAuthID:       item.SelectedAuthID,
			SelectedAccountID:    item.SelectedAccountID,
			SelectedProvider:     item.SelectedProvider,
			UnavailableCode:      item.UnavailableCode,
			UnavailableMessage:   item.UnavailableMessage,
			Candidates:           make([]ChannelRouteDecisionAuth, 0, len(item.Candidates)),
			DroppedReasons:       make([]ChannelRouteDroppedReason, 0, len(item.DroppedReasons)),
			Trace:                make([]ChannelRouteDecisionStep, 0, len(item.Trace)),
		}
		for _, candidate := range item.Candidates {
			decision.Candidates = append(decision.Candidates, ChannelRouteDecisionAuth{
				AuthID:    candidate.AuthID,
				AccountID: candidate.AccountID,
				Provider:  candidate.Provider,
			})
		}
		for _, dropped := range item.DroppedReasons {
			decision.DroppedReasons = append(decision.DroppedReasons, ChannelRouteDroppedReason{
				AccountID:     dropped.AccountID,
				AuthID:        dropped.AuthID,
				Source:        dropped.Source,
				Scope:         dropped.Scope,
				Reason:        dropped.Reason,
				Model:         dropped.Model,
				ExpiresAt:     dropped.ExpiresAt,
				UpdatedAt:     dropped.UpdatedAt,
				RouteBlocking: dropped.RouteBlocking,
			})
		}
		for _, step := range item.Trace {
			var fallback *bool
			if step.Fallback != nil {
				value := *step.Fallback
				fallback = &value
			}
			decision.Trace = append(decision.Trace, ChannelRouteDecisionStep{
				Stage:     step.Stage,
				Policy:    step.Policy,
				Reason:    step.Reason,
				Before:    step.Before,
				After:     step.After,
				AllowIDs:  append([]string(nil), step.AllowIDs...),
				DenyIDs:   append([]string(nil), step.DenyIDs...),
				OrderIDs:  append([]string(nil), step.OrderIDs...),
				Fallback:  fallback,
				Activated: step.Activated,
			})
		}
		out = append(out, decision)
	}
	return out, nil
}

func (a *App) RunRouteResilienceAction(input RouteResilienceActionInput) (*RouteResilienceActionResult, error) {
	result, err := a.core.RunRouteResilienceAction(wailsapp.RouteResilienceActionInput{
		Action:         input.Action,
		AccountKey:     input.AccountKey,
		AuthID:         input.AuthID,
		Model:          input.Model,
		Sources:        append([]string(nil), input.Sources...),
		Reason:         input.Reason,
		DryRun:         input.DryRun,
		IdempotencyKey: input.IdempotencyKey,
	})
	if err != nil {
		return nil, err
	}
	return mapRouteResilienceActionResult(result), nil
}

func mapChannelAccountRuntimeState(input *wailsapp.ChannelAccountRuntimeState) *ChannelAccountRuntimeState {
	if input == nil {
		return nil
	}
	sources := make(map[string]ChannelRuntimeStateSource, len(input.Sources))
	for key, source := range input.Sources {
		sources[key] = ChannelRuntimeStateSource{
			Source:    source.Source,
			Reason:    source.Reason,
			Model:     source.Model,
			ExpiresAt: source.ExpiresAt,
			UpdatedAt: source.UpdatedAt,
		}
	}
	return &ChannelAccountRuntimeState{
		AccountID: input.AccountID,
		Sources:   sources,
		UpdatedAt: input.UpdatedAt,
	}
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

func (a *App) GetAccountStoreDiagnostics() (*AccountStoreDiagnostics, error) {
	result, err := a.core.GetAccountStoreDiagnostics()
	if err != nil {
		return nil, err
	}
	return mapAccountStoreDiagnostics(result), nil
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

func (a *App) ListProjectCandidatePoolRules(input ProjectCandidatePoolRulesInput) ([]ProjectCandidatePoolRule, error) {
	result, err := a.core.ListProjectCandidatePoolRules(input.Channel)
	if err != nil {
		return nil, err
	}
	return mapProjectCandidatePoolRules(result), nil
}

func (a *App) CreateProjectCandidatePoolRule(input ProjectCandidatePoolRule) ([]ProjectCandidatePoolRule, error) {
	result, err := a.core.CreateProjectCandidatePoolRule(mapProjectCandidatePoolRuleToCore(input))
	if err != nil {
		return nil, err
	}
	return mapProjectCandidatePoolRules(result), nil
}

func (a *App) UpdateProjectCandidatePoolRule(input ProjectCandidatePoolRule) ([]ProjectCandidatePoolRule, error) {
	result, err := a.core.UpdateProjectCandidatePoolRule(mapProjectCandidatePoolRuleToCore(input))
	if err != nil {
		return nil, err
	}
	return mapProjectCandidatePoolRules(result), nil
}

func (a *App) DeleteProjectCandidatePoolRule(input DeleteProjectCandidatePoolRuleInput) error {
	return a.core.DeleteProjectCandidatePoolRule(input.ID)
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

func (a *App) GetCodexSessionMessagePage(sessionID string, input SessionManagementMessagePageInput) (*SessionManagementMessagePage, error) {
	result, err := a.core.GetCodexSessionMessagePage(sessionID, wailsapp.SessionManagementMessagePageInput{
		Offset: input.Offset,
		Limit:  input.Limit,
	})
	if err != nil {
		return nil, err
	}
	return mapSessionManagementMessagePage(result), nil
}

func (a *App) GetCodexSessionMessageRawJSON(sessionID string, input SessionManagementMessageRawJSONInput) (*SessionManagementMessageRawJSON, error) {
	result, err := a.core.GetCodexSessionMessageRawJSON(sessionID, wailsapp.SessionManagementMessageRawJSONInput{
		LineNumber: input.LineNumber,
	})
	if err != nil {
		return nil, err
	}
	return mapSessionManagementMessageRawJSON(result), nil
}

func (a *App) AnalyzeCodexSessions(input AnalyzeCodexSessionsInput) (*SessionAnalysisResult, error) {
	result, err := a.core.AnalyzeCodexSessions(wailsapp.AnalyzeCodexSessionsInput{
		Scope:      input.Scope,
		ProjectID:  input.ProjectID,
		SessionIDs: append([]string(nil), input.SessionIDs...),
		Limit:      input.Limit,
	})
	if err != nil {
		return nil, err
	}
	return mapSessionAnalysisResult(result), nil
}

func (a *App) GetClaudeCodeSessionDetail(sessionID string) (*SessionManagementSessionDetail, error) {
	result, err := a.core.GetClaudeCodeSessionDetail(sessionID)
	if err != nil {
		return nil, err
	}
	return mapSessionManagementSessionDetail(result), nil
}

func (a *App) GetClaudeCodeSessionMessagePage(sessionID string, input SessionManagementMessagePageInput) (*SessionManagementMessagePage, error) {
	result, err := a.core.GetClaudeCodeSessionMessagePage(sessionID, wailsapp.SessionManagementMessagePageInput{
		Offset: input.Offset,
		Limit:  input.Limit,
	})
	if err != nil {
		return nil, err
	}
	return mapSessionManagementMessagePage(result), nil
}

func (a *App) GetClaudeCodeSessionMessageRawJSON(sessionID string, input SessionManagementMessageRawJSONInput) (*SessionManagementMessageRawJSON, error) {
	result, err := a.core.GetClaudeCodeSessionMessageRawJSON(sessionID, wailsapp.SessionManagementMessageRawJSONInput{
		LineNumber: input.LineNumber,
	})
	if err != nil {
		return nil, err
	}
	return mapSessionManagementMessageRawJSON(result), nil
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
		CodexModelCatalogSyncEnabled: result.CodexModelCatalogSyncEnabled,
		LaunchAtLogin:                result.LaunchAtLogin,
		LaunchAtLoginSupported:       result.LaunchAtLoginSupported,
		LaunchAgentPath:              result.LaunchAgentPath,
		CloseAction:                  result.CloseAction,
		MenuBarResident:              result.MenuBarResident,
		ShowMenuBarIcon:              result.ShowMenuBarIcon,
		ConfigPath:                   result.ConfigPath,
	}, nil
}

func (a *App) UpdateAppRuntimeSettings(input AppRuntimeSettings) (*AppRuntimeSettings, error) {
	result, err := a.core.UpdateAppRuntimeSettings(wailsapp.AppRuntimeSettings{
		LaunchAtLogin:      input.LaunchAtLogin,
		CloseAction:        input.CloseAction,
		ShowMenuBarIcon:    input.ShowMenuBarIcon,
		ShowMenuBarIconSet: true,
	})
	if err != nil {
		return nil, err
	}
	return &AppRuntimeSettings{
		CodexModelCatalogSyncEnabled: result.CodexModelCatalogSyncEnabled,
		LaunchAtLogin:                result.LaunchAtLogin,
		LaunchAtLoginSupported:       result.LaunchAtLoginSupported,
		LaunchAgentPath:              result.LaunchAgentPath,
		CloseAction:                  result.CloseAction,
		MenuBarResident:              result.MenuBarResident,
		ShowMenuBarIcon:              result.ShowMenuBarIcon,
		ConfigPath:                   result.ConfigPath,
	}, nil
}

func (a *App) SetCodexModelCatalogSyncEnabled(enabled bool) (*AppRuntimeSettings, error) {
	result, err := a.core.SetCodexModelCatalogSyncEnabled(enabled)
	if err != nil {
		return nil, err
	}
	return &AppRuntimeSettings{
		CodexModelCatalogSyncEnabled: result.CodexModelCatalogSyncEnabled,
		LaunchAtLogin:                result.LaunchAtLogin,
		LaunchAtLoginSupported:       result.LaunchAtLoginSupported,
		LaunchAgentPath:              result.LaunchAgentPath,
		CloseAction:                  result.CloseAction,
		MenuBarResident:              result.MenuBarResident,
		ShowMenuBarIcon:              result.ShowMenuBarIcon,
		ConfigPath:                   result.ConfigPath,
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

func (a *App) PreflightCodexMcpServer(input PreflightCodexMcpServerInput) (*CodexMcpPreflightResult, error) {
	result, err := a.core.PreflightCodexMcpServer(wailsapp.PreflightCodexMcpServerInput{
		Server: mapWailsCodexMcpServer(input.Server),
	})
	if err != nil {
		return nil, err
	}
	return mapCodexMcpPreflightResult(result), nil
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

func (a *App) GetDoctorSnapshot(input DoctorSnapshotInput) (*DoctorSnapshot, error) {
	result, err := a.core.GetDoctorSnapshot(wailsapp.DoctorSnapshotInput{
		Scope:               input.Scope,
		IncludeEvidence:     input.IncludeEvidence,
		MaxEvidencePerCheck: input.MaxEvidencePerCheck,
	})
	if err != nil {
		return nil, err
	}
	return mapDoctorSnapshot(result), nil
}

func (a *App) GetGetTokensExtensionRegistrySnapshot(input GetTokensExtensionRegistrySnapshotInput) (*GetTokensExtensionRegistrySnapshot, error) {
	result, err := a.core.GetGetTokensExtensionRegistrySnapshot(mapGetTokensExtensionRegistryInput(input))
	if err != nil {
		return nil, err
	}
	return mapGetTokensExtensionRegistrySnapshot(result), nil
}

func (a *App) SetGetTokensExtensionEnabled(input SetGetTokensExtensionEnabledInput) (*GetTokensExtensionEnableStateFile, error) {
	result, err := a.core.SetGetTokensExtensionEnabled(mapSetGetTokensExtensionEnabledInput(input))
	if err != nil {
		return nil, err
	}
	return mapGetTokensExtensionEnableStateFile(result), nil
}

func (a *App) PreviewGetTokensExtensionCodexConfigDryRun(input PreviewGetTokensExtensionCodexConfigDryRunInput) (*GetTokensExtensionCodexConfigDryRunPreview, error) {
	result, err := a.core.PreviewGetTokensExtensionCodexConfigDryRun(mapPreviewGetTokensExtensionCodexConfigDryRunInput(input))
	if err != nil {
		return nil, err
	}
	return mapGetTokensExtensionCodexConfigDryRunPreview(result), nil
}

func (a *App) PrepareGetTokensExtensionCodexConfigApply(input PrepareGetTokensExtensionCodexConfigApplyInput) (*GetTokensExtensionCodexConfigStagedApplyPlan, error) {
	result, err := a.core.PrepareGetTokensExtensionCodexConfigApply(mapPrepareGetTokensExtensionCodexConfigApplyInput(input))
	if err != nil {
		return nil, err
	}
	return mapGetTokensExtensionCodexConfigStagedApplyPlan(result), nil
}

func (a *App) ApplyGetTokensExtensionCodexConfigTransaction(input ApplyGetTokensExtensionCodexConfigTransactionInput) (*GetTokensExtensionCodexConfigStagedApplyResult, error) {
	result, err := a.core.ApplyGetTokensExtensionCodexConfigTransaction(mapApplyGetTokensExtensionCodexConfigTransactionInput(input))
	if err != nil {
		return mapGetTokensExtensionCodexConfigStagedApplyResult(result), err
	}
	return mapGetTokensExtensionCodexConfigStagedApplyResult(result), nil
}

func (a *App) GetAllQuotaStatuses() ([]CodexQuotaResponse, error) {
	result, err := a.core.GetAllQuotaStatuses()
	if err != nil {
		return nil, err
	}
	return mapQuotaRuntimeStates(result), nil
}

func (a *App) GetQuotaStatuses(accountKeys []string) ([]CodexQuotaResponse, error) {
	result, err := a.core.GetQuotaStatuses(accountKeys)
	if err != nil {
		return nil, err
	}
	return mapQuotaRuntimeStates(result), nil
}

func (a *App) GetQuotaStatus(accountKey string) (*CodexQuotaResponse, error) {
	result, err := a.core.GetQuotaStatus(accountKey)
	if err != nil {
		return nil, err
	}
	return mapQuotaRuntimeState(result), nil
}

func (a *App) ListQuotaCalibrations(accountKey string) ([]QuotaUsageCalibration, error) {
	result, err := a.core.ListQuotaCalibrations(accountKey)
	if err != nil {
		return nil, err
	}
	return mapQuotaUsageCalibrations(result), nil
}

func (a *App) AddQuotaCalibration(input QuotaUsageCalibrationInput) (*QuotaUsageCalibration, error) {
	result, err := a.core.AddQuotaCalibration(mapQuotaUsageCalibrationInput(input))
	if err != nil {
		return nil, err
	}
	return mapQuotaUsageCalibration(result), nil
}

func (a *App) RevokeQuotaCalibration(id string) (*QuotaUsageCalibration, error) {
	result, err := a.core.RevokeQuotaCalibration(id)
	if err != nil {
		return nil, err
	}
	return mapQuotaUsageCalibration(result), nil
}

func (a *App) ListBudgetWindowDefinitions() ([]BudgetWindowDefinition, error) {
	result, err := a.core.ListBudgetWindowDefinitions()
	if err != nil {
		return nil, err
	}
	return mapBudgetWindowDefinitions(result), nil
}

func (a *App) CreateBudgetWindowDefinition(input BudgetWindowDefinition) ([]BudgetWindowDefinition, error) {
	result, err := a.core.CreateBudgetWindowDefinition(mapBudgetWindowDefinition(input))
	if err != nil {
		return nil, err
	}
	return mapBudgetWindowDefinitions(result), nil
}

func (a *App) UpdateBudgetWindowDefinition(id string, input BudgetWindowDefinition) ([]BudgetWindowDefinition, error) {
	result, err := a.core.UpdateBudgetWindowDefinition(id, mapBudgetWindowDefinition(input))
	if err != nil {
		return nil, err
	}
	return mapBudgetWindowDefinitions(result), nil
}

func (a *App) DeleteBudgetWindowDefinition(id string) ([]BudgetWindowDefinition, error) {
	result, err := a.core.DeleteBudgetWindowDefinition(id)
	if err != nil {
		return nil, err
	}
	return mapBudgetWindowDefinitions(result), nil
}

func (a *App) PreviewBudgetWindowFacts(input BudgetWindowFactsPreviewRequest) ([]QuotaWindowFact, error) {
	result, err := a.core.PreviewBudgetWindowFacts(mapBudgetWindowFactsPreviewRequest(input))
	if err != nil {
		return nil, err
	}
	return mapQuotaWindowFactsFromProxy(result), nil
}

func (a *App) ListQuotaThresholdRules(accountKey string) ([]QuotaThresholdRule, error) {
	result, err := a.core.ListQuotaThresholdRules(accountKey)
	if err != nil {
		return nil, err
	}
	return mapQuotaThresholdRules(result), nil
}

func (a *App) CreateQuotaThresholdRule(input QuotaThresholdRule) ([]QuotaThresholdRule, error) {
	result, err := a.core.CreateQuotaThresholdRule(mapQuotaThresholdRule(input))
	if err != nil {
		return nil, err
	}
	return mapQuotaThresholdRules(result), nil
}

func (a *App) UpdateQuotaThresholdRule(id string, input QuotaThresholdRule) ([]QuotaThresholdRule, error) {
	result, err := a.core.UpdateQuotaThresholdRule(id, mapQuotaThresholdRule(input))
	if err != nil {
		return nil, err
	}
	return mapQuotaThresholdRules(result), nil
}

func (a *App) DeleteQuotaThresholdRule(id string) error {
	return a.core.DeleteQuotaThresholdRule(id)
}

func (a *App) SimulateRouteGuardRule(input SimulateRouteGuardRuleRequest) (*SimulationResult, error) {
	result, err := a.core.SimulateRouteGuardRule(mapSimulateRouteGuardRuleRequest(input))
	if err != nil {
		return nil, err
	}
	return mapSimulationResult(result), nil
}

func (a *App) GetOpenAIQuotaResetCredit(accountKey string) (*OpenAIQuotaResetCreditInfo, error) {
	result, err := a.core.GetOpenAIQuotaResetCredit(accountKey)
	if err != nil {
		return nil, err
	}
	return mapOpenAIQuotaResetCreditInfo(result), nil
}

func (a *App) ConsumeOpenAIQuotaResetCredit(accountKey string) (*OpenAIQuotaResetConsumeResult, error) {
	result, err := a.core.ConsumeOpenAIQuotaResetCredit(accountKey)
	if err != nil {
		return nil, err
	}
	return mapOpenAIQuotaResetConsumeResult(result), nil
}

func (a *App) RefreshCodexQuotasBatch(input CodexQuotaBatchRefreshInput) (*CodexQuotaBatchRefreshResult, error) {
	result, err := a.core.RefreshCodexQuotasBatch(wailsapp.CodexQuotaBatchRefreshInput{
		AccountKeys:    input.AccountKeys,
		IncludeBilling: input.IncludeBilling,
		Force:          input.Force,
		Concurrency:    input.Concurrency,
	})
	if err != nil {
		return nil, err
	}
	items := make([]CodexQuotaResponse, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, *mapCodexQuotaResponse(&item))
	}
	errors := make([]CodexQuotaBatchRefreshError, 0, len(result.Errors))
	for _, item := range result.Errors {
		errors = append(errors, CodexQuotaBatchRefreshError{
			AccountKey: item.AccountKey,
			Error:      item.Error,
		})
	}
	return &CodexQuotaBatchRefreshResult{
		Items:     items,
		Errors:    errors,
		Succeeded: result.Succeeded,
		Failed:    result.Failed,
	}, nil
}

func (a *App) StartCodexQuotasBatchRefreshJob(input CodexQuotaBatchRefreshInput) (*CodexQuotaBatchRefreshJob, error) {
	result, err := a.core.StartCodexQuotasBatchRefreshJob(wailsapp.CodexQuotaBatchRefreshInput{
		AccountKeys:    input.AccountKeys,
		IncludeBilling: input.IncludeBilling,
		Force:          input.Force,
		Concurrency:    input.Concurrency,
	})
	if err != nil {
		return nil, err
	}
	return mapCodexQuotaBatchRefreshJob(result), nil
}

func (a *App) GetCodexQuotaBatchRefreshJob(jobID string) (*CodexQuotaBatchRefreshJob, error) {
	result, err := a.core.GetCodexQuotaBatchRefreshJob(jobID)
	if err != nil {
		return nil, err
	}
	return mapCodexQuotaBatchRefreshJob(result), nil
}

func (a *App) TestCodexAPIKeyQuotaCurl(input TestCodexAPIKeyQuotaCurlInput) (*CodexQuotaResponse, error) {
	result, err := a.core.TestCodexAPIKeyQuotaCurl(mapTestCodexAPIKeyQuotaCurlInputToWails(input))
	if err != nil {
		return nil, err
	}
	return mapCodexQuotaResponse(result), nil
}

func (a *App) TestCodexAPIKeyBillingCurl(input TestCodexAPIKeyQuotaCurlInput) (*CodexQuotaBillingInfo, error) {
	result, err := a.core.TestCodexAPIKeyBillingCurl(mapTestCodexAPIKeyQuotaCurlInputToWails(input))
	if err != nil {
		return nil, err
	}
	return mapCodexQuotaBillingInfo(result), nil
}

func mapTestCodexAPIKeyQuotaCurlInputToWails(input TestCodexAPIKeyQuotaCurlInput) wailsapp.TestCodexAPIKeyQuotaCurlInput {
	return wailsapp.TestCodexAPIKeyQuotaCurlInput{
		APIKey:         input.APIKey,
		BaseURL:        input.BaseURL,
		Prefix:         input.Prefix,
		QuotaCurl:      input.QuotaCurl,
		PlatformCookie: input.PlatformCookie,
		CurlVariables:  input.CurlVariables,
	}
}

func mapOpenAIQuotaResetCreditInfo(info *wailsapp.OpenAIQuotaResetCreditInfo) *OpenAIQuotaResetCreditInfo {
	if info == nil {
		return nil
	}
	return &OpenAIQuotaResetCreditInfo{
		AccountKey:     info.AccountKey,
		Status:         info.Status,
		AvailableCount: info.AvailableCount,
		PlanType:       info.PlanType,
		FetchedAt:      info.FetchedAt,
		QuotaState:     mapCodexQuotaResponse(info.QuotaState),
	}
}

func mapOpenAIQuotaResetConsumeResult(result *wailsapp.OpenAIQuotaResetConsumeResult) *OpenAIQuotaResetConsumeResult {
	if result == nil {
		return nil
	}
	return &OpenAIQuotaResetConsumeResult{
		AccountKey:             result.AccountKey,
		Status:                 result.Status,
		Code:                   result.Code,
		Credit:                 mapOpenAIQuotaResetCredit(result.Credit),
		WindowsReset:           result.WindowsReset,
		AvailableCount:         result.AvailableCount,
		PlanType:               result.PlanType,
		FetchedAt:              result.FetchedAt,
		QuotaState:             mapCodexQuotaResponse(result.QuotaState),
		PostResetRefreshStatus: result.PostResetRefreshStatus,
		PostResetRefreshError:  result.PostResetRefreshError,
	}
}

func mapOpenAIQuotaResetCredit(credit *wailsapp.OpenAIQuotaResetCredit) *OpenAIQuotaResetCredit {
	if credit == nil {
		return nil
	}
	return &OpenAIQuotaResetCredit{
		ID:              credit.ID,
		ResetType:       credit.ResetType,
		Status:          credit.Status,
		GrantedAt:       credit.GrantedAt,
		ExpiresAt:       credit.ExpiresAt,
		RedeemStartedAt: credit.RedeemStartedAt,
		RedeemedAt:      credit.RedeemedAt,
	}
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

func (a *App) ListCodexAccountInventory() ([]AccountRecord, error) {
	result, err := a.core.ListCodexAccountInventory()
	if err != nil {
		return nil, err
	}

	records := make([]AccountRecord, 0, len(result))
	for _, record := range result {
		records = append(records, mapAccountRecord(record))
	}
	return records, nil
}

func (a *App) ListCachedAccounts() ([]AccountRecord, error) {
	result, err := a.core.ListCachedAccounts()
	if err != nil {
		return nil, err
	}

	records := make([]AccountRecord, 0, len(result))
	for _, record := range result {
		records = append(records, mapAccountRecord(record))
	}
	return records, nil
}

func (a *App) GetAccountMigrationPreview() (*AccountMigrationPreview, error) {
	result, err := a.core.GetAccountMigrationPreview()
	if err != nil {
		return nil, err
	}
	return mapAccountMigrationPreview(result), nil
}

func (a *App) CommitAccountMigration() (*AccountMigrationCommitResult, error) {
	result, err := a.core.CommitAccountMigration()
	if err != nil {
		return nil, err
	}
	return mapAccountMigrationCommitResult(result), nil
}

func (a *App) DeleteLegacyAccountSources() (*AccountMigrationDeleteResult, error) {
	result, err := a.core.DeleteLegacyAccountSources()
	if err != nil {
		return nil, err
	}
	return mapAccountMigrationDeleteResult(result), nil
}

func (a *App) ListOpenAICompatibleProviders() ([]OpenAICompatibleProvider, error) {
	result, err := a.core.ListOpenAICompatibleProviders()
	if err != nil {
		return nil, err
	}

	providers := make([]OpenAICompatibleProvider, 0, len(result))
	for _, item := range result {
		providers = append(providers, OpenAICompatibleProvider{
			AccountKey:        item.AccountKey,
			Name:              item.Name,
			Priority:          item.Priority,
			Disabled:          item.Disabled,
			BaseURL:           item.BaseURL,
			Prefix:            item.Prefix,
			ProxyURL:          item.ProxyURL,
			APIKey:            item.APIKey,
			APIKeys:           append([]string(nil), item.APIKeys...),
			QuotaCurl:         item.QuotaCurl,
			QuotaEnabled:      item.QuotaEnabled,
			BillingCurl:       item.BillingCurl,
			BillingEnabled:    item.BillingEnabled,
			PlatformCookie:    item.PlatformCookie,
			CurlVariables:     item.CurlVariables,
			Models:            mapOpenAICompatibleModels(item.Models),
			Headers:           item.Headers,
			FormatBaseURLs:    item.FormatBaseURLs,
			ModelFetchAPIKey:  item.ModelFetchAPIKey,
			ModelFetchBaseURL: item.ModelFetchBaseURL,
			KeyCount:          item.KeyCount,
			ModelCount:        item.ModelCount,
			HasHeaders:        item.HasHeaders,
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

func (a *App) GetCodexModelCatalogDiagnostics() (*CodexModelCatalogDiagnostics, error) {
	result, err := a.core.GetCodexModelCatalogDiagnostics()
	if err != nil {
		return nil, err
	}
	return mapCodexModelCatalogDiagnostics(result), nil
}

func mapCodexModelCatalogDiagnostics(result *wailsapp.CodexModelCatalogDiagnostics) *CodexModelCatalogDiagnostics {
	if result == nil {
		return nil
	}
	models := make([]CodexModelCatalogDiagnosticModel, 0, len(result.Models))
	for _, model := range result.Models {
		models = append(models, CodexModelCatalogDiagnosticModel{
			Slug:           model.Slug,
			DisplayName:    model.DisplayName,
			SourceAccounts: append([]string(nil), model.SourceAccounts...),
			SourceKinds:    append([]string(nil), model.SourceKinds...),
			ProviderNames:  append([]string(nil), model.ProviderNames...),
		})
	}
	return &CodexModelCatalogDiagnostics{
		SyncEnabled:                result.SyncEnabled,
		CodexHomePath:              result.CodexHomePath,
		ConfigPath:                 result.ConfigPath,
		CatalogPath:                result.CatalogPath,
		ConfiguredCatalogPath:      result.ConfiguredCatalogPath,
		HasModelCatalogPointer:     result.HasModelCatalogPointer,
		HasGetTokensCatalogPointer: result.HasGetTokensCatalogPointer,
		CatalogExists:              result.CatalogExists,
		CatalogUpdatedAtUnixMs:     result.CatalogUpdatedAtUnixMs,
		CatalogModelCount:          result.CatalogModelCount,
		CachePath:                  result.CachePath,
		CacheExists:                result.CacheExists,
		CacheUpdatedAtUnixMs:       result.CacheUpdatedAtUnixMs,
		CachedAccountCount:         result.CachedAccountCount,
		CachedModelCount:           result.CachedModelCount,
		TracePath:                  result.TracePath,
		TraceExists:                result.TraceExists,
		TraceUpdatedAtUnixMs:       result.TraceUpdatedAtUnixMs,
		CurrentModel:               result.CurrentModel,
		CurrentProviderID:          result.CurrentProviderID,
		CurrentProviderName:        result.CurrentProviderName,
		HasExplicitCurrentModel:    result.HasExplicitCurrentModel,
		HasExplicitCurrentProvider: result.HasExplicitCurrentProvider,
		Models:                     models,
		Warnings:                   append([]string(nil), result.Warnings...),
	}
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
		CurrentModel:                         result.CurrentModel,
		HasExplicitCurrentModel:              result.HasExplicitCurrentModel,
		CurrentProviderID:                    result.CurrentProviderID,
		CurrentProviderName:                  result.CurrentProviderName,
		CurrentProviderBaseURL:               result.CurrentProviderBaseURL,
		CurrentProviderIsBuiltin:             result.CurrentProviderIsBuiltin,
		CurrentProviderExists:                result.CurrentProviderExists,
		CurrentProviderSupportsWebsockets:    result.CurrentProviderSupportsWebsockets,
		CurrentProviderSupportsWebsocketsSet: result.CurrentProviderSupportsWebsocketsSet,
		HasExplicitCurrentProvider:           result.HasExplicitCurrentProvider,
		Providers:                            mapLocalCodexModelProviderViews(result.Providers),
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
			BaseURL:      item.BaseURL,
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
		CodexHomePath:                    result.CodexHomePath,
		AuthFilePath:                     result.AuthFilePath,
		ConfigPath:                       result.ConfigPath,
		ModelCatalogPath:                 result.ModelCatalogPath,
		ModelCatalogRequiresRestart:      result.ModelCatalogRequiresRestart,
		ExistingExternalModelCatalogPath: result.ExistingExternalModelCatalogPath,
		Warnings:                         append([]string(nil), result.Warnings...),
	}, nil
}

func (a *App) ApplyRelayServiceConfigToLocalV2(input RelayLocalApplyInput) (*RelayLocalApplyResult, error) {
	result, err := a.core.ApplyRelayServiceConfigToLocalV2(wailsapp.RelayLocalApplyInput{
		PreserveUnspecifiedFields:    input.PreserveUnspecifiedFields,
		APIKey:                       input.APIKey,
		APIKeySet:                    input.APIKeySet,
		AuthFileContentBase64:        input.AuthFileContentBase64,
		AuthFileContentSet:           input.AuthFileContentSet,
		BaseURL:                      input.BaseURL,
		BaseURLSet:                   input.BaseURLSet,
		Model:                        input.Model,
		ModelSet:                     input.ModelSet,
		ReasoningEffort:              input.ReasoningEffort,
		ReasoningEffortSet:           input.ReasoningEffortSet,
		ProviderID:                   input.ProviderID,
		ProviderIDSet:                input.ProviderIDSet,
		ProviderName:                 input.ProviderName,
		ProviderNameSet:              input.ProviderNameSet,
		RequiresOpenAIAuth:           input.RequiresOpenAIAuth,
		RequiresOpenAIAuthSet:        input.RequiresOpenAIAuthSet,
		WireAPI:                      input.WireAPI,
		WireAPISet:                   input.WireAPISet,
		SupportsWebsockets:           input.SupportsWebsockets,
		SupportsWebsocketsSet:        input.SupportsWebsocketsSet,
		AuthStrategy:                 input.AuthStrategy,
		SkipRelayKeyMetadata:         input.SkipRelayKeyMetadata,
		ModelCatalogProjectionMode:   input.ModelCatalogProjectionMode,
		ModelCatalogOverrideExternal: input.ModelCatalogOverrideExternal,
		ModelCatalogModels:           mapOpenAICompatibleModelsToWails(input.ModelCatalogModels),
	})
	if err != nil {
		return nil, err
	}

	return &RelayLocalApplyResult{
		CodexHomePath:                    result.CodexHomePath,
		AuthFilePath:                     result.AuthFilePath,
		ConfigPath:                       result.ConfigPath,
		ModelCatalogPath:                 result.ModelCatalogPath,
		ModelCatalogRequiresRestart:      result.ModelCatalogRequiresRestart,
		ExistingExternalModelCatalogPath: result.ExistingExternalModelCatalogPath,
		Warnings:                         append([]string(nil), result.Warnings...),
	}, nil
}

func (a *App) DisableGetTokensCodexModelCatalogProjection() (*RelayLocalApplyResult, error) {
	result, err := a.core.DisableGetTokensCodexModelCatalogProjection()
	if err != nil {
		return nil, err
	}
	return mapRelayLocalApplyResult(result), nil
}

func (a *App) EnableGetTokensCodexModelCatalogProjection(models []OpenAICompatibleModel) (*RelayLocalApplyResult, error) {
	result, err := a.core.EnableGetTokensCodexModelCatalogProjection(mapOpenAICompatibleModelsToWails(models))
	if err != nil {
		return nil, err
	}
	return mapRelayLocalApplyResult(result), nil
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

func (a *App) ParseDeepLink(rawURL string) (*DeepLinkImportRequest, error) {
	result, err := a.core.ParseDeepLink(rawURL)
	if err != nil {
		return nil, err
	}
	mapped := mapDeepLinkImportRequest(*result)
	return &mapped, nil
}

func (a *App) PreviewDeepLinkImport(rawURL string) (*DeepLinkImportPreview, error) {
	result, err := a.core.PreviewDeepLinkImport(rawURL)
	if err != nil {
		return nil, err
	}
	return mapDeepLinkImportPreview(result), nil
}

func (a *App) ApplyDeepLinkImport(rawURL string) (*DeepLinkApplyResult, error) {
	result, err := a.core.ApplyDeepLinkImportURL(rawURL)
	if err != nil {
		return nil, err
	}
	return mapDeepLinkApplyResult(result), nil
}

func (a *App) ApplyClaudeCodeAPIKeyConfigToLocal(apiKey string, baseURL string, options ClaudeCodeLocalApplyOptions) (*ClaudeCodeLocalApplyResult, error) {
	result, err := a.core.ApplyClaudeCodeAPIKeyConfigToLocal(apiKey, baseURL, wailsapp.ClaudeCodeLocalApplyOptions{
		AuthField:                   options.AuthField,
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
	return a.core.CreateCodexAPIKey(mapCreateCodexAPIKeyInputToWails(input))
}

func mapCreateCodexAPIKeyInputToWails(input CreateCodexAPIKeyInput) wailsapp.CreateCodexAPIKeyInput {
	return wailsapp.CreateCodexAPIKeyInput{
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
		PlatformCookie: input.PlatformCookie,
		CurlVariables:  input.CurlVariables,
	}
}

func (a *App) UpdateCodexAPIKeyLabel(input UpdateCodexAPIKeyLabelInput) error {
	return a.core.UpdateCodexAPIKeyLabel(wailsapp.UpdateCodexAPIKeyLabelInput{
		ID:    input.ID,
		Label: input.Label,
	})
}

func (a *App) UpdateCodexAPIKeyConfig(input UpdateCodexAPIKeyConfigInput) error {
	return a.core.UpdateCodexAPIKeyConfig(mapUpdateCodexAPIKeyConfigInputToWails(input))
}

func mapUpdateCodexAPIKeyConfigInputToWails(input UpdateCodexAPIKeyConfigInput) wailsapp.UpdateCodexAPIKeyConfigInput {
	return wailsapp.UpdateCodexAPIKeyConfigInput{
		ID:             input.ID,
		APIKey:         input.APIKey,
		BaseURL:        input.BaseURL,
		FormatBaseURLs: input.FormatBaseURLs,
		Prefix:         input.Prefix,
		ProxyURL:       input.ProxyURL,
		Models:         mapOpenAICompatibleModelsToWails(input.Models),
		QuotaCurl:      input.QuotaCurl,
		QuotaEnabled:   input.QuotaEnabled,
		BillingCurl:    input.BillingCurl,
		BillingEnabled: input.BillingEnabled,
		PlatformCookie: input.PlatformCookie,
		CurlVariables:  input.CurlVariables,
	}
}

func (a *App) CreateOpenAICompatibleProvider(input CreateOpenAICompatibleProviderInput) error {
	return a.core.CreateOpenAICompatibleProvider(wailsapp.CreateOpenAICompatibleProviderInput{
		Name:              input.Name,
		BaseURL:           input.BaseURL,
		Prefix:            input.Prefix,
		APIKey:            input.APIKey,
		QuotaCurl:         input.QuotaCurl,
		QuotaEnabled:      input.QuotaEnabled,
		BillingCurl:       input.BillingCurl,
		BillingEnabled:    input.BillingEnabled,
		PlatformCookie:    input.PlatformCookie,
		CurlVariables:     input.CurlVariables,
		FormatBaseURLs:    input.FormatBaseURLs,
		Models:            mapOpenAICompatibleModelsToWails(input.Models),
		ModelFetchAPIKey:  input.ModelFetchAPIKey,
		ModelFetchBaseURL: input.ModelFetchBaseURL,
	})
}

func (a *App) DeleteOpenAICompatibleProvider(name string) error {
	return a.core.DeleteOpenAICompatibleProvider(name)
}

func (a *App) UpdateOpenAICompatibleProvider(input UpdateOpenAICompatibleProviderInput) error {
	return a.core.UpdateOpenAICompatibleProvider(wailsapp.UpdateOpenAICompatibleProviderInput{
		CurrentName:       input.CurrentName,
		Name:              input.Name,
		BaseURL:           input.BaseURL,
		FormatBaseURLs:    input.FormatBaseURLs,
		Prefix:            input.Prefix,
		ProxyURL:          input.ProxyURL,
		APIKey:            input.APIKey,
		APIKeys:           append([]string(nil), input.APIKeys...),
		QuotaCurl:         input.QuotaCurl,
		QuotaEnabled:      input.QuotaEnabled,
		BillingCurl:       input.BillingCurl,
		BillingEnabled:    input.BillingEnabled,
		PlatformCookie:    input.PlatformCookie,
		CurlVariables:     input.CurlVariables,
		Headers:           input.Headers,
		Models:            mapOpenAICompatibleModelsToWails(input.Models),
		ModelFetchAPIKey:  input.ModelFetchAPIKey,
		ModelFetchBaseURL: input.ModelFetchBaseURL,
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

func mapWailsChannelRoutingConfig(input ChannelRoutingConfig) wailsapp.ChannelRoutingConfig {
	return wailsapp.ChannelRoutingConfig{
		Channel:                     input.Channel,
		RouteMode:                   wailsapp.ChannelRouteMode(input.RouteMode),
		OrderedAccountIDs:           append([]string(nil), input.OrderedAccountIDs...),
		ManualRequestableAccountIDs: append([]string(nil), input.ManualRequestableAccountIDs...),
		AccountGroups:               mapWailsChannelAccountGroups(input.AccountGroups),
		ChannelGroupStates:          mapWailsChannelGroupStates(input.ChannelGroupStates),
		ShadowEnabled:               input.ShadowEnabled,
		ShadowRouteMode:             wailsapp.ChannelRouteMode(input.ShadowRouteMode),
	}
}

func mapChannelRoutingConfig(input *wailsapp.ChannelRoutingConfig) *ChannelRoutingConfig {
	if input == nil {
		return nil
	}
	return &ChannelRoutingConfig{
		Channel:                     input.Channel,
		RouteMode:                   string(input.RouteMode),
		OrderedAccountIDs:           append([]string(nil), input.OrderedAccountIDs...),
		ManualRequestableAccountIDs: append([]string(nil), input.ManualRequestableAccountIDs...),
		AccountGroups:               mapChannelAccountGroups(input.AccountGroups),
		ChannelGroupStates:          mapChannelGroupStates(input.ChannelGroupStates),
		ShadowEnabled:               input.ShadowEnabled,
		ShadowRouteMode:             string(input.ShadowRouteMode),
	}
}

func mapWailsChannelAccountGroups(inputs []ChannelAccountGroup) []wailsapp.ChannelAccountGroup {
	out := make([]wailsapp.ChannelAccountGroup, 0, len(inputs))
	for _, input := range inputs {
		out = append(out, wailsapp.ChannelAccountGroup{
			ID:         input.ID,
			Name:       input.Name,
			Enabled:    input.Enabled,
			RouteOrder: input.RouteOrder,
			AccountIDs: append([]string(nil), input.AccountIDs...),
		})
	}
	return out
}

func mapChannelAccountGroups(inputs []wailsapp.ChannelAccountGroup) []ChannelAccountGroup {
	out := make([]ChannelAccountGroup, 0, len(inputs))
	for _, input := range inputs {
		out = append(out, ChannelAccountGroup{
			ID:         input.ID,
			Name:       input.Name,
			Enabled:    input.Enabled,
			RouteOrder: input.RouteOrder,
			AccountIDs: append([]string(nil), input.AccountIDs...),
		})
	}
	return out
}

func mapWailsChannelGroupStates(inputs map[string]ChannelGroupState) map[string]wailsapp.ChannelGroupState {
	out := make(map[string]wailsapp.ChannelGroupState, len(inputs))
	for id, input := range inputs {
		out[id] = wailsapp.ChannelGroupState{
			Enabled:    input.Enabled,
			RouteOrder: cloneIntPtrMain(input.RouteOrder),
		}
	}
	return out
}

func mapChannelGroupStates(inputs map[string]wailsapp.ChannelGroupState) map[string]ChannelGroupState {
	out := make(map[string]ChannelGroupState, len(inputs))
	for id, input := range inputs {
		out[id] = ChannelGroupState{
			Enabled:    input.Enabled,
			RouteOrder: cloneIntPtrMain(input.RouteOrder),
		}
	}
	return out
}

func mapChannelRoutingExplainResult(input *wailsapp.ChannelRoutingExplainResult) *ChannelRoutingExplainResult {
	if input == nil {
		return nil
	}
	candidates := make([]ChannelRoutingCandidate, 0, len(input.Candidates))
	for _, item := range input.Candidates {
		candidates = append(candidates, ChannelRoutingCandidate{
			ID:             item.ID,
			DisplayName:    item.DisplayName,
			Provider:       item.Provider,
			RouteOrder:     item.RouteOrder,
			GroupID:        item.GroupID,
			GroupOrder:     item.GroupOrder,
			ChannelOrder:   item.ChannelOrder,
			ActiveSessions: item.ActiveSessions,
		})
	}
	filtered := make([]ChannelRoutingFilteredAccount, 0, len(input.Filtered))
	for _, item := range input.Filtered {
		filtered = append(filtered, ChannelRoutingFilteredAccount{ID: item.ID, Reason: item.Reason})
	}
	return &ChannelRoutingExplainResult{
		Channel:           input.Channel,
		RouteMode:         string(input.RouteMode),
		SelectedAccountID: input.SelectedAccountID,
		Candidates:        candidates,
		Filtered:          filtered,
		Steps:             append([]string(nil), input.Steps...),
		Meta: ChannelRoutingConfigMeta{
			InvalidModes: append([]string(nil), input.Meta.InvalidModes...),
		},
		SnapshotVersion:      input.SnapshotVersion,
		PolicyVersion:        input.PolicyVersion,
		ProjectCandidatePool: mapChannelRoutingProjectCandidatePool(input.ProjectCandidatePool),
		Shadow:               mapChannelRoutingShadow(input.Shadow),
	}
}

func mapChannelRoutingProjectCandidatePool(input *wailsapp.ChannelRoutingProjectCandidatePoolInfo) *ChannelRoutingProjectCandidatePoolInfo {
	if input == nil {
		return nil
	}
	return &ChannelRoutingProjectCandidatePoolInfo{
		Evaluated:            input.Evaluated,
		Activated:            input.Activated,
		Reason:               input.Reason,
		RuleID:               input.RuleID,
		ProjectKey:           input.ProjectKey,
		ProjectName:          input.ProjectName,
		ProjectKeySource:     input.ProjectKeySource,
		ProjectKeyConfidence: input.ProjectKeyConfidence,
		AllowAccountIDs:      append([]string(nil), input.AllowAccountIDs...),
		FilteredAccountIDs:   append([]string(nil), input.FilteredAccountIDs...),
		BeforeCandidateCount: input.BeforeCandidateCount,
		AfterCandidateCount:  input.AfterCandidateCount,
	}
}

func mapChannelRoutingShadow(input *wailsapp.ChannelRoutingShadowDecision) *ChannelRoutingShadowDecision {
	if input == nil {
		return nil
	}
	return &ChannelRoutingShadowDecision{
		Enabled:           input.Enabled,
		RouteMode:         string(input.RouteMode),
		SelectedAccountID: input.SelectedAccountID,
		Diff:              input.Diff,
		Steps:             append([]string(nil), input.Steps...),
	}
}

func cloneIntMap(input map[string]int) map[string]int {
	if input == nil {
		return nil
	}
	out := make(map[string]int, len(input))
	for key, value := range input {
		out[key] = value
	}
	return out
}

func cloneIntPtrMain(input *int) *int {
	if input == nil {
		return nil
	}
	value := *input
	return &value
}

func (a *App) DeleteCodexAPIKey(id string) error {
	return a.core.DeleteCodexAPIKey(id)
}

func (a *App) DeleteAccountsBatch(input DeleteAccountsBatchInput) (*DeleteAccountsBatchResult, error) {
	result, err := a.core.DeleteAccountsBatch(wailsapp.DeleteAccountsBatchInput{AccountIDs: input.AccountIDs})
	if err != nil {
		return nil, err
	}
	errors := make([]DeleteAccountsBatchError, 0, len(result.Errors))
	for _, item := range result.Errors {
		errors = append(errors, DeleteAccountsBatchError{
			AccountID: item.AccountID,
			Error:     item.Error,
		})
	}
	return &DeleteAccountsBatchResult{
		DeletedAccountIDs: result.DeletedAccountIDs,
		Errors:            errors,
		Succeeded:         result.Succeeded,
		Failed:            result.Failed,
	}, nil
}
