package main

import (
	"encoding/json"
	"strings"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
	"github.com/linhay/gettokens/internal/cliproxyapi"
	"github.com/linhay/gettokens/internal/gettokensextensions"
	wailsapp "github.com/linhay/gettokens/internal/wailsapp"
)

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

func mapAccountRecord(record accountsdomain.AccountRecord) AccountRecord {
	formats := record.SupportedFormats
	if len(formats) == 0 {
		formats = nil
	}
	return AccountRecord{
		ID:                         record.ID,
		AccountKind:                record.AccountKind,
		Provider:                   record.Provider,
		CredentialSource:           record.CredentialSource,
		DisplayName:                record.DisplayName,
		Status:                     record.Status,
		StatusMessage:              record.StatusMessage,
		RuntimeStatus:              record.RuntimeStatus,
		RuntimeReason:              record.RuntimeReason,
		RuntimeFailureClass:        record.RuntimeFailureClass,
		Routeable:                  record.Routeable,
		RegisteredModelCount:       record.RegisteredModelCount,
		RuntimeRepairOutcome:       record.RuntimeRepairOutcome,
		RuntimeRepairAction:        record.RuntimeRepairAction,
		RuntimeRepairTriggerStatus: record.RuntimeRepairTriggerStatus,
		RuntimeRepairTriggerClass:  record.RuntimeRepairTriggerClass,
		RuntimeRepairTriggerReason: record.RuntimeRepairTriggerReason,
		LastRuntimeRepairAtUnixMs:  record.LastRuntimeRepairAtUnixMs,
		Priority:                   record.Priority,
		Disabled:                   record.Disabled,
		Email:                      record.Email,
		PlanType:                   record.PlanType,
		Name:                       record.Name,
		APIKey:                     record.APIKey,
		APIKeys:                    append([]string(nil), record.APIKeys...),
		Headers:                    cloneStringMap(record.Headers),
		Models:                     mapAccountRecordModels(record.Models),
		KeyFingerprint:             record.KeyFingerprint,
		KeySuffix:                  record.KeySuffix,
		BaseURL:                    record.BaseURL,
		Prefix:                     record.Prefix,
		ProxyURL:                   record.ProxyURL,
		AuthIndex:                  record.AuthIndex,
		QuotaKey:                   record.QuotaKey,
		QuotaCurl:                  record.QuotaCurl,
		QuotaEnabled:               record.QuotaEnabled,
		LocalOnly:                  record.LocalOnly,
		SupportedFormats:           formats,
		FormatBaseURLs:             record.FormatBaseURLs,
		BillingCurl:                record.BillingCurl,
		BillingEnabled:             record.BillingEnabled,
		PlatformCookie:             record.PlatformCookie,
		ModelFetchAPIKey:           record.ModelFetchAPIKey,
		ModelFetchBaseURL:          record.ModelFetchBaseURL,
		Requestability: AccountRequestability{
			Evidence: append([]string(nil), record.Requestability.Evidence...),
			Manual:   record.Requestability.Manual,
		},
	}
}

func mapAccountMigrationPreview(result *wailsapp.AccountMigrationPreview) *AccountMigrationPreview {
	if result == nil {
		return nil
	}
	return &AccountMigrationPreview{
		Status:            result.Status,
		AccountCount:      result.AccountCount,
		CandidateCount:    result.CandidateCount,
		KindSummary:       mapAccountMigrationKindSummary(result.KindSummary),
		Warnings:          append([]string(nil), result.Warnings...),
		GeneratedAtUnixMs: result.GeneratedAtUnixMs,
		BackupHint:        result.BackupHint,
	}
}

func mapAccountMigrationKindSummary(items []wailsapp.AccountMigrationKindSummary) []AccountMigrationKindSummary {
	if len(items) == 0 {
		return nil
	}
	result := make([]AccountMigrationKindSummary, 0, len(items))
	for _, item := range items {
		result = append(result, AccountMigrationKindSummary{
			Kind:  item.Kind,
			Count: item.Count,
		})
	}
	return result
}

func mapAccountMigrationCommitResult(result *wailsapp.AccountMigrationCommitResult) *AccountMigrationCommitResult {
	if result == nil {
		return nil
	}
	return &AccountMigrationCommitResult{
		Imported: result.Imported,
		Skipped:  result.Skipped,
		Errors:   append([]string(nil), result.Errors...),
		Preview:  mapAccountMigrationPreview(result.Preview),
	}
}

func mapAccountMigrationDeleteResult(result *wailsapp.AccountMigrationDeleteResult) *AccountMigrationDeleteResult {
	if result == nil {
		return nil
	}
	return &AccountMigrationDeleteResult{
		Deleted:   result.Deleted,
		BackupDir: result.BackupDir,
		Preview:   mapAccountMigrationPreview(result.Preview),
	}
}

func mapAccountRecordModels(items []cliproxyapi.CodexModel) []OpenAICompatibleModel {
	out := make([]OpenAICompatibleModel, 0, len(items))
	for _, item := range items {
		out = append(out, OpenAICompatibleModel{
			Name:  item.Name,
			Alias: item.Alias,
		})
	}
	return out
}

func mapDeepLinkImportRequest(result wailsapp.DeepLinkImportRequest) DeepLinkImportRequest {
	return DeepLinkImportRequest{
		RawURL:      result.RawURL,
		RedactedURL: result.RedactedURL,
		Protocol:    result.Protocol,
		Schema:      result.Schema,
		Source:      mapDeepLinkImportSource(result.Source),
		Options:     mapDeepLinkImportOptions(result.Options),
		Accounts:    mapDeepLinkImportAccounts(result.Accounts),
	}
}

func mapDeepLinkImportPreview(result *wailsapp.DeepLinkImportPreview) *DeepLinkImportPreview {
	if result == nil {
		return nil
	}
	return &DeepLinkImportPreview{
		Protocol:    result.Protocol,
		RedactedURL: result.RedactedURL,
		Source:      mapDeepLinkImportSource(result.Source),
		Accounts:    mapDeepLinkPreviewAccounts(result.Accounts),
		Warnings:    append([]string(nil), result.Warnings...),
		Blocking:    append([]string(nil), result.Blocking...),
	}
}

func mapDeepLinkApplyResult(result *wailsapp.DeepLinkApplyResult) *DeepLinkApplyResult {
	if result == nil {
		return nil
	}
	return &DeepLinkApplyResult{
		Status:   result.Status,
		Total:    result.Total,
		Created:  result.Created,
		Failed:   result.Failed,
		Accounts: mapDeepLinkApplyAccounts(result.Accounts),
	}
}

func mapDeepLinkImportSource(result wailsapp.DeepLinkImportSource) DeepLinkImportSource {
	return DeepLinkImportSource{
		Name: result.Name,
		URL:  result.URL,
	}
}

func mapDeepLinkImportOptions(result wailsapp.DeepLinkImportOptions) DeepLinkImportOptions {
	return DeepLinkImportOptions{
		ContinueOnError: result.ContinueOnError,
	}
}

func mapDeepLinkImportAccounts(items []wailsapp.DeepLinkAccountImportItem) []DeepLinkAccountPreviewItem {
	if len(items) == 0 {
		return nil
	}
	out := make([]DeepLinkAccountPreviewItem, 0, len(items))
	for _, item := range items {
		out = append(out, mapDeepLinkWritePreview(item.Index, item.Ref, item.Write))
	}
	return out
}

func mapDeepLinkPreviewAccounts(items []wailsapp.DeepLinkAccountPreviewItem) []DeepLinkAccountPreviewItem {
	if len(items) == 0 {
		return nil
	}
	out := make([]DeepLinkAccountPreviewItem, 0, len(items))
	for _, item := range items {
		out = append(out, DeepLinkAccountPreviewItem{
			Index:         item.Index,
			Ref:           item.Ref,
			Kind:          item.Kind,
			Title:         item.Title,
			Provider:      item.Provider,
			BaseURL:       item.BaseURL,
			APIKeyPreview: item.APIKeyPreview,
			KeyCount:      item.KeyCount,
			ModelCount:    item.ModelCount,
			Disabled:      item.Disabled,
			Warnings:      append([]string(nil), item.Warnings...),
			Blocking:      append([]string(nil), item.Blocking...),
		})
	}
	return out
}

func mapDeepLinkWritePreview(index int, ref string, write cliproxyapi.AccountWriteRequest) DeepLinkAccountPreviewItem {
	item := DeepLinkAccountPreviewItem{
		Index:    index,
		Ref:      ref,
		Kind:     string(write.Kind),
		Title:    write.Title,
		Provider: write.Provider,
		Disabled: write.Disabled,
	}
	if write.CodexAPIKey != nil {
		item.BaseURL = write.CodexAPIKey.BaseURL
		item.APIKeyPreview = redactMappedSecret(write.CodexAPIKey.APIKey)
		item.KeyCount = boolToMappedCount(write.CodexAPIKey.APIKey != "")
		item.ModelCount = countMappedJSONArray(write.CodexAPIKey.ModelsJSON)
	}
	if write.OpenAICompatible != nil {
		item.BaseURL = write.OpenAICompatible.BaseURL
		item.KeyCount = countMappedJSONArray(write.OpenAICompatible.APIKeyEntriesJSON)
		item.ModelCount = countMappedJSONArray(write.OpenAICompatible.ModelsJSON)
	}
	if write.AuthFile != nil {
		item.KeyCount = boolToMappedCount(write.AuthFile.AuthJSON != "")
	}
	return item
}

func mapDeepLinkApplyAccounts(items []wailsapp.DeepLinkAccountApplyResultItem) []DeepLinkAccountApplyResultItem {
	if len(items) == 0 {
		return nil
	}
	out := make([]DeepLinkAccountApplyResultItem, 0, len(items))
	for _, item := range items {
		out = append(out, DeepLinkAccountApplyResultItem{
			Index:      item.Index,
			Ref:        item.Ref,
			Kind:       item.Kind,
			Title:      item.Title,
			AccountKey: item.AccountKey,
			Status:     item.Status,
			Error:      item.Error,
		})
	}
	return out
}

func redactMappedSecret(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	if len(trimmed) <= 8 {
		return "[REDACTED]"
	}
	return trimmed[:4] + strings.Repeat("*", 4) + trimmed[len(trimmed)-4:]
}

func countMappedJSONArray(rawJSON string) int {
	trimmed := strings.TrimSpace(rawJSON)
	if trimmed == "" {
		return 0
	}
	var items []any
	if err := json.Unmarshal([]byte(trimmed), &items); err != nil {
		return 0
	}
	return len(items)
}

func boolToMappedCount(value bool) int {
	if value {
		return 1
	}
	return 0
}

func mapWailsOpenAICompatibleModels(items []wailsapp.OpenAICompatibleModel) []OpenAICompatibleModel {
	if len(items) == 0 {
		return nil
	}
	out := make([]OpenAICompatibleModel, 0, len(items))
	for _, item := range items {
		out = append(out, OpenAICompatibleModel{
			Name:                      item.Name,
			Alias:                     item.Alias,
			SupportedReasoningEfforts: append([]string(nil), item.SupportedReasoningEfforts...),
			DefaultReasoningEffort:    item.DefaultReasoningEffort,
		})
	}
	return out
}

func mapRelayLocalApplyInput(result *wailsapp.RelayLocalApplyInput) *RelayLocalApplyInput {
	if result == nil {
		return nil
	}
	return &RelayLocalApplyInput{
		PreserveUnspecifiedFields:    result.PreserveUnspecifiedFields,
		APIKey:                       result.APIKey,
		APIKeySet:                    result.APIKeySet,
		AuthFileContentBase64:        result.AuthFileContentBase64,
		AuthFileContentSet:           result.AuthFileContentSet,
		BaseURL:                      result.BaseURL,
		BaseURLSet:                   result.BaseURLSet,
		Model:                        result.Model,
		ModelSet:                     result.ModelSet,
		ReasoningEffort:              result.ReasoningEffort,
		ReasoningEffortSet:           result.ReasoningEffortSet,
		ProviderID:                   result.ProviderID,
		ProviderIDSet:                result.ProviderIDSet,
		ProviderName:                 result.ProviderName,
		ProviderNameSet:              result.ProviderNameSet,
		RequiresOpenAIAuth:           result.RequiresOpenAIAuth,
		RequiresOpenAIAuthSet:        result.RequiresOpenAIAuthSet,
		WireAPI:                      result.WireAPI,
		WireAPISet:                   result.WireAPISet,
		SupportsWebsockets:           result.SupportsWebsockets,
		SupportsWebsocketsSet:        result.SupportsWebsocketsSet,
		AuthStrategy:                 result.AuthStrategy,
		SkipRelayKeyMetadata:         result.SkipRelayKeyMetadata,
		ModelCatalogProjectionMode:   result.ModelCatalogProjectionMode,
		ModelCatalogOverrideExternal: result.ModelCatalogOverrideExternal,
		ModelCatalogModels:           mapOpenAICompatibleModels(result.ModelCatalogModels),
	}
}

func mapRelayLocalApplyResult(result *wailsapp.RelayLocalApplyResult) *RelayLocalApplyResult {
	if result == nil {
		return nil
	}
	return &RelayLocalApplyResult{
		CodexHomePath:                    result.CodexHomePath,
		AuthFilePath:                     result.AuthFilePath,
		ConfigPath:                       result.ConfigPath,
		ModelCatalogPath:                 result.ModelCatalogPath,
		ModelCatalogRequiresRestart:      result.ModelCatalogRequiresRestart,
		ExistingExternalModelCatalogPath: result.ExistingExternalModelCatalogPath,
		Warnings:                         append([]string(nil), result.Warnings...),
	}
}

func cloneStringMap(items map[string]string) map[string]string {
	if len(items) == 0 {
		return nil
	}
	out := make(map[string]string, len(items))
	for key, value := range items {
		out[key] = value
	}
	return out
}

func cloneAnyMap(items map[string]any) map[string]any {
	if len(items) == 0 {
		return nil
	}
	out := make(map[string]any, len(items))
	for key, value := range items {
		out[key] = value
	}
	return out
}

func mapCodexQuotaResponse(result *wailsapp.CodexQuotaResponse) *CodexQuotaResponse {
	if result == nil {
		return &CodexQuotaResponse{}
	}

	windows := make([]CodexQuotaWindow, 0, len(result.Windows))
	for _, window := range result.Windows {
		windows = append(windows, CodexQuotaWindow{
			ID:               window.ID,
			Label:            window.Label,
			RemainingPercent: window.RemainingPercent,
			UsedTokens:       window.UsedTokens,
			LimitTokens:      window.LimitTokens,
			RemainingTokens:  window.RemainingTokens,
			ResetLabel:       window.ResetLabel,
			ResetAtUnix:      window.ResetAtUnix,
		})
	}
	sources := make([]CodexQuotaSourceState, 0, len(result.Sources))
	for _, source := range result.Sources {
		sources = append(sources, CodexQuotaSourceState{
			Source:    source.Source,
			Reason:    source.Reason,
			ExpiresAt: source.ExpiresAt,
			NextReset: source.NextReset,
		})
	}

	return &CodexQuotaResponse{
		AccountKey:      result.AccountKey,
		Source:          result.Source,
		Status:          result.Status,
		PlanType:        result.PlanType,
		Windows:         windows,
		Billing:         mapCodexQuotaBillingInfo(result.Billing),
		UpdatedAt:       result.UpdatedAt,
		LastEvaluatedAt: result.LastEvaluatedAt,
		Stale:           result.Stale,
		DegradedReason:  result.DegradedReason,
		Blocked:         result.Blocked,
		BlockReason:     result.BlockReason,
		Sources:         sources,
		QuotaFact:       mapWailsCodexQuotaFact(result.QuotaFact),
	}
}

func mapCodexQuotaBatchRefreshJob(result *wailsapp.CodexQuotaBatchRefreshJob) *CodexQuotaBatchRefreshJob {
	if result == nil {
		return &CodexQuotaBatchRefreshJob{
			Items:  []CodexQuotaResponse{},
			Errors: []CodexQuotaBatchRefreshError{},
		}
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
	return &CodexQuotaBatchRefreshJob{
		JobID:       result.JobID,
		Status:      result.Status,
		Total:       result.Total,
		Pending:     result.Pending,
		Running:     result.Running,
		Succeeded:   result.Succeeded,
		Failed:      result.Failed,
		Items:       items,
		Errors:      errors,
		CreatedAt:   result.CreatedAt,
		UpdatedAt:   result.UpdatedAt,
		CompletedAt: result.CompletedAt,
	}
}

func mapQuotaRuntimeStates(items []cliproxyapi.QuotaRuntimeState) []CodexQuotaResponse {
	out := make([]CodexQuotaResponse, 0, len(items))
	for index := range items {
		if mapped := mapQuotaRuntimeState(&items[index]); mapped != nil {
			out = append(out, *mapped)
		}
	}
	return out
}

func mapQuotaRuntimeState(result *cliproxyapi.QuotaRuntimeState) *CodexQuotaResponse {
	if result == nil {
		return &CodexQuotaResponse{Windows: []CodexQuotaWindow{}}
	}

	windows := make([]CodexQuotaWindow, 0, len(result.Windows))
	for _, window := range result.Windows {
		windows = append(windows, CodexQuotaWindow{
			ID:               window.ID,
			Label:            window.Label,
			RemainingPercent: window.RemainingPercent,
			UsedTokens:       window.UsedTokens,
			LimitTokens:      window.LimitTokens,
			RemainingTokens:  window.RemainingTokens,
			ResetLabel:       window.ResetLabel,
			ResetAtUnix:      window.ResetAtUnix,
		})
	}
	sources := make([]CodexQuotaSourceState, 0, len(result.Sources))
	for _, source := range result.Sources {
		sources = append(sources, CodexQuotaSourceState{
			Source:    source.Source,
			Reason:    source.Reason,
			ExpiresAt: source.ExpiresAt,
			NextReset: source.NextReset,
		})
	}

	return &CodexQuotaResponse{
		AccountKey:      result.AccountKey,
		Source:          result.Source,
		Status:          result.Status,
		PlanType:        result.PlanType,
		Windows:         windows,
		Billing:         mapQuotaRuntimeBilling(result.Billing),
		UpdatedAt:       result.UpdatedAt,
		LastEvaluatedAt: result.LastEvaluatedAt,
		Stale:           result.Stale,
		DegradedReason:  result.DegradedReason,
		Blocked:         result.Blocked,
		BlockReason:     result.BlockReason,
		Sources:         sources,
		QuotaFact:       mapCliproxyQuotaRuntimeFact(result.Fact),
	}
}

func mapQuotaRuntimeBilling(result *cliproxyapi.QuotaRuntimeBilling) *CodexQuotaBillingInfo {
	if result == nil {
		return nil
	}
	infos := make([]CodexQuotaBillingBalanceInfo, 0, len(result.BalanceInfos))
	for _, info := range result.BalanceInfos {
		infos = append(infos, CodexQuotaBillingBalanceInfo{
			Currency:        info.Currency,
			TotalBalance:    info.TotalBalance,
			GrantedBalance:  info.GrantedBalance,
			ToppedUpBalance: info.ToppedUpBalance,
		})
	}
	return &CodexQuotaBillingInfo{
		IsAvailable:  result.IsAvailable,
		BalanceInfos: infos,
	}
}

func mapCodexQuotaBillingInfo(result *wailsapp.CodexQuotaBillingInfo) *CodexQuotaBillingInfo {
	if result == nil {
		return nil
	}

	infos := make([]CodexQuotaBillingBalanceInfo, 0, len(result.BalanceInfos))
	for _, info := range result.BalanceInfos {
		infos = append(infos, CodexQuotaBillingBalanceInfo{
			Currency:        info.Currency,
			TotalBalance:    info.TotalBalance,
			GrantedBalance:  info.GrantedBalance,
			ToppedUpBalance: info.ToppedUpBalance,
		})
	}

	return &CodexQuotaBillingInfo{
		IsAvailable:  result.IsAvailable,
		BalanceInfos: infos,
	}
}

func mapDoctorSnapshot(result *wailsapp.DoctorSnapshot) *DoctorSnapshot {
	if result == nil {
		return nil
	}
	return &DoctorSnapshot{
		GeneratedAtUnixMs: result.GeneratedAtUnixMs,
		Source:            result.Source,
		SidecarReady:      result.SidecarReady,
		Status:            result.Status,
		Checks:            mapDoctorChecks(result.Checks),
		Summary: DoctorSummary{
			Total:    result.Summary.Total,
			Critical: result.Summary.Critical,
			Warning:  result.Summary.Warning,
			NotReady: result.Summary.NotReady,
			OK:       result.Summary.OK,
			Skipped:  result.Summary.Skipped,
			Degraded: result.Summary.Degraded,
		},
	}
}

func mapRouteResilienceActionResult(result *wailsapp.RouteResilienceActionResult) *RouteResilienceActionResult {
	if result == nil {
		return nil
	}
	return &RouteResilienceActionResult{
		OK:                   result.OK,
		Authority:            result.Authority,
		Action:               result.Action,
		Status:               result.Status,
		AccountKey:           result.AccountKey,
		AuthID:               result.AuthID,
		Model:                result.Model,
		Before:               cloneRouteResilienceActionMap(result.Before),
		After:                cloneRouteResilienceActionMap(result.After),
		AuditID:              result.AuditID,
		DroppedSources:       append([]string(nil), result.DroppedSources...),
		DroppedReasons:       mapRouteResilienceDroppedReasons(result.DroppedReasons),
		Error:                result.Error,
		NotImplementedReason: result.NotImplementedReason,
		HTTPStatus:           result.HTTPStatus,
	}
}

func mapRouteResilienceDroppedReasons(items []wailsapp.ChannelRouteDroppedReason) []ChannelRouteDroppedReason {
	if len(items) == 0 {
		return nil
	}
	out := make([]ChannelRouteDroppedReason, 0, len(items))
	for _, item := range items {
		out = append(out, ChannelRouteDroppedReason{
			AccountID:     item.AccountID,
			AuthID:        item.AuthID,
			Source:        item.Source,
			Scope:         item.Scope,
			Reason:        item.Reason,
			Model:         item.Model,
			ExpiresAt:     item.ExpiresAt,
			UpdatedAt:     item.UpdatedAt,
			RouteBlocking: item.RouteBlocking,
		})
	}
	return out
}

func cloneRouteResilienceActionMap(input map[string]any) map[string]any {
	if input == nil {
		return nil
	}
	out := make(map[string]any, len(input))
	for key, value := range input {
		out[key] = value
	}
	return out
}

func mapGetTokensExtensionRegistryInput(input GetTokensExtensionRegistrySnapshotInput) wailsapp.GetTokensExtensionRegistrySnapshotInput {
	roots := make([]wailsapp.GetTokensExtensionRootDTO, 0, len(input.Roots))
	for _, root := range input.Roots {
		roots = append(roots, wailsapp.GetTokensExtensionRootDTO{
			ID:       root.ID,
			Path:     root.Path,
			ReadOnly: true,
		})
	}
	return wailsapp.GetTokensExtensionRegistrySnapshotInput{
		ManifestPaths: append([]string(nil), input.ManifestPaths...),
		Roots:         roots,
		StatePath:     input.StatePath,
	}
}

func mapSetGetTokensExtensionEnabledInput(input SetGetTokensExtensionEnabledInput) wailsapp.SetGetTokensExtensionEnabledInput {
	return wailsapp.SetGetTokensExtensionEnabledInput{
		ExtensionID: input.ExtensionID,
		Enabled:     input.Enabled,
		StatePath:   input.StatePath,
	}
}

func mapPreviewGetTokensExtensionCodexConfigDryRunInput(input PreviewGetTokensExtensionCodexConfigDryRunInput) wailsapp.PreviewGetTokensExtensionCodexConfigDryRunInput {
	roots := make([]wailsapp.GetTokensExtensionRootDTO, 0, len(input.Roots))
	for _, root := range input.Roots {
		roots = append(roots, wailsapp.GetTokensExtensionRootDTO{
			ID:       root.ID,
			Path:     root.Path,
			ReadOnly: true,
		})
	}
	return wailsapp.PreviewGetTokensExtensionCodexConfigDryRunInput{
		ManifestPaths: append([]string(nil), input.ManifestPaths...),
		Roots:         roots,
		StatePath:     input.StatePath,
		TargetPath:    input.TargetPath,
		ConfigText:    input.ConfigText,
	}
}

func mapPrepareGetTokensExtensionCodexConfigApplyInput(input PrepareGetTokensExtensionCodexConfigApplyInput) wailsapp.PrepareGetTokensExtensionCodexConfigApplyInput {
	roots := make([]wailsapp.GetTokensExtensionRootDTO, 0, len(input.Roots))
	for _, root := range input.Roots {
		roots = append(roots, wailsapp.GetTokensExtensionRootDTO{
			ID:       root.ID,
			Path:     root.Path,
			ReadOnly: true,
		})
	}
	return wailsapp.PrepareGetTokensExtensionCodexConfigApplyInput{
		ManifestPaths: append([]string(nil), input.ManifestPaths...),
		Roots:         roots,
		StatePath:     input.StatePath,
		TargetPath:    input.TargetPath,
		ConfigText:    input.ConfigText,
	}
}

func mapApplyGetTokensExtensionCodexConfigTransactionInput(input ApplyGetTokensExtensionCodexConfigTransactionInput) wailsapp.ApplyGetTokensExtensionCodexConfigTransactionInput {
	roots := make([]wailsapp.GetTokensExtensionRootDTO, 0, len(input.Roots))
	for _, root := range input.Roots {
		roots = append(roots, wailsapp.GetTokensExtensionRootDTO{
			ID:       root.ID,
			Path:     root.Path,
			ReadOnly: true,
		})
	}
	return wailsapp.ApplyGetTokensExtensionCodexConfigTransactionInput{
		ManifestPaths:      append([]string(nil), input.ManifestPaths...),
		Roots:              roots,
		StatePath:          input.StatePath,
		TargetPath:         input.TargetPath,
		TempDir:            input.TempDir,
		ConfigText:         input.ConfigText,
		ConfirmationToken:  input.ConfirmationToken,
		SkipVerifyReadback: input.SkipVerifyReadback,
	}
}

func mapGetTokensExtensionEnableStateFile(result *gettokensextensions.ExtensionEnableStateFile) *GetTokensExtensionEnableStateFile {
	if result == nil {
		return nil
	}
	return &GetTokensExtensionEnableStateFile{
		ContractVersion: result.ContractVersion,
		UpdatedAt:       result.UpdatedAt,
		Extensions:      mapGetTokensExtensionEnableStates(result.Extensions),
	}
}

func mapGetTokensExtensionEnableStates(items []gettokensextensions.ExtensionEnableStateEntry) []GetTokensExtensionEnableState {
	if len(items) == 0 {
		return nil
	}
	out := make([]GetTokensExtensionEnableState, 0, len(items))
	for _, item := range items {
		out = append(out, GetTokensExtensionEnableState{
			ID:        item.ID,
			State:     string(item.State),
			UpdatedAt: item.UpdatedAt,
			Reason:    item.Reason,
		})
	}
	return out
}

func mapGetTokensExtensionCodexConfigStagedApplyPlan(result *gettokensextensions.CodexConfigStagedApplyPlan) *GetTokensExtensionCodexConfigStagedApplyPlan {
	if result == nil {
		return nil
	}
	return &GetTokensExtensionCodexConfigStagedApplyPlan{
		ContractVersion:   result.ContractVersion,
		TargetPath:        result.TargetPath,
		ConfirmationToken: result.ConfirmationToken,
		DiffPreview:       append([]string(nil), result.DiffPreview...),
		AppliedText:       result.AppliedText,
		AppliedOperations: append([]string(nil), result.AppliedOperations...),
	}
}

func mapGetTokensExtensionCodexConfigStagedApplyResult(result *gettokensextensions.CodexConfigStagedApplyResult) *GetTokensExtensionCodexConfigStagedApplyResult {
	if result == nil {
		return nil
	}
	return &GetTokensExtensionCodexConfigStagedApplyResult{
		Status:            result.Status,
		TargetPath:        result.TargetPath,
		BackupPath:        result.BackupPath,
		TempPath:          result.TempPath,
		ConfirmationToken: result.ConfirmationToken,
		AppliedOperations: append([]string(nil), result.AppliedOperations...),
		RolledBack:        result.RolledBack,
		ErrorStage:        result.ErrorStage,
	}
}

func mapGetTokensExtensionCodexConfigDryRunPreview(result *gettokensextensions.CodexConfigDryRunPreview) *GetTokensExtensionCodexConfigDryRunPreview {
	if result == nil {
		return nil
	}
	return &GetTokensExtensionCodexConfigDryRunPreview{
		ContractVersion: result.ContractVersion,
		DryRun:          result.DryRun,
		GeneratedAt:     result.GeneratedAt,
		Target:          result.Target,
		TargetPath:      result.TargetPath,
		Summary: GetTokensExtensionCodexConfigDryRunSummary{
			EnabledExtensionCount: result.Summary.EnabledExtensionCount,
			SkippedExtensionCount: result.Summary.SkippedExtensionCount,
			OperationCount:        result.Summary.OperationCount,
			ValidationErrorCount:  result.Summary.ValidationErrorCount,
		},
		Sections:   mapGetTokensExtensionCodexConfigDryRunSections(result.Sections),
		Operations: mapGetTokensExtensionCodexConfigDryRunOperations(result.Operations),
		Validation: mapGetTokensExtensionCodexConfigDryRunValidation(result.Validation),
	}
}

func mapGetTokensExtensionCodexConfigDryRunSections(items []gettokensextensions.CodexConfigDryRunSection) []GetTokensExtensionCodexConfigDryRunSection {
	if len(items) == 0 {
		return nil
	}
	out := make([]GetTokensExtensionCodexConfigDryRunSection, 0, len(items))
	for _, item := range items {
		out = append(out, GetTokensExtensionCodexConfigDryRunSection{
			ID:          item.ID,
			Label:       item.Label,
			Status:      item.Status,
			DiffPreview: append([]string(nil), item.DiffPreview...),
		})
	}
	return out
}

func mapGetTokensExtensionCodexConfigDryRunOperations(items []gettokensextensions.CodexConfigDryRunOperation) []GetTokensExtensionCodexConfigDryRunOperation {
	if len(items) == 0 {
		return nil
	}
	out := make([]GetTokensExtensionCodexConfigDryRunOperation, 0, len(items))
	for _, item := range items {
		out = append(out, GetTokensExtensionCodexConfigDryRunOperation{
			ID:           item.ID,
			Target:       item.Target,
			Action:       item.Action,
			ExtensionID:  item.ExtensionID,
			CapabilityID: item.CapabilityID,
			Preview:      item.Preview,
			PatchPlan:    mapGetTokensExtensionCodexConfigTomlPatchPlan(item.PatchPlan),
		})
	}
	return out
}

func mapGetTokensExtensionCodexConfigTomlPatchPlan(item gettokensextensions.CodexConfigTomlPatchPlan) GetTokensExtensionCodexConfigTomlPatchPlan {
	return GetTokensExtensionCodexConfigTomlPatchPlan{
		TargetSection: item.TargetSection,
		Operation:     item.Operation,
		BeforeSnippet: item.BeforeSnippet,
		AfterSnippet:  item.AfterSnippet,
		Validation:    append([]string(nil), item.Validation...),
	}
}

func mapGetTokensExtensionCodexConfigDryRunValidation(items []gettokensextensions.CodexConfigDryRunValidation) []GetTokensExtensionCodexConfigDryRunValidation {
	if len(items) == 0 {
		return nil
	}
	out := make([]GetTokensExtensionCodexConfigDryRunValidation, 0, len(items))
	for _, item := range items {
		out = append(out, GetTokensExtensionCodexConfigDryRunValidation{
			Code:         item.Code,
			Severity:     item.Severity,
			ExtensionID:  item.ExtensionID,
			CapabilityID: item.CapabilityID,
			Target:       item.Target,
			Message:      item.Message,
		})
	}
	return out
}

func mapGetTokensExtensionRegistrySnapshot(result *gettokensextensions.RegistrySnapshot) *GetTokensExtensionRegistrySnapshot {
	if result == nil {
		return nil
	}
	return &GetTokensExtensionRegistrySnapshot{
		ContractVersion: result.ContractVersion,
		RegistryMode:    result.RegistryMode,
		GeneratedAt:     result.GeneratedAt,
		ReadOnly:        result.ReadOnly,
		Roots:           mapGetTokensExtensionRoots(result.Roots),
		Extensions:      mapGetTokensExtensionSnapshots(result.Extensions),
		Diagnostics:     mapGetTokensExtensionDiagnostics(result.Diagnostics),
	}
}

func mapGetTokensExtensionRoots(items []gettokensextensions.Root) []GetTokensExtensionRoot {
	if len(items) == 0 {
		return nil
	}
	out := make([]GetTokensExtensionRoot, 0, len(items))
	for _, item := range items {
		out = append(out, GetTokensExtensionRoot{
			ID:       item.ID,
			Path:     item.Path,
			ReadOnly: item.ReadOnly,
		})
	}
	return out
}

func mapGetTokensExtensionSnapshots(items []gettokensextensions.ExtensionSnapshot) []GetTokensExtensionSnapshot {
	if len(items) == 0 {
		return nil
	}
	out := make([]GetTokensExtensionSnapshot, 0, len(items))
	for _, item := range items {
		out = append(out, GetTokensExtensionSnapshot{
			ID:            item.ID,
			Name:          item.Name,
			Version:       item.Version,
			Publisher:     GetTokensExtensionPublisher{Name: item.Publisher.Name, URL: item.Publisher.URL},
			Source:        GetTokensExtensionSource{Type: item.Source.Type, URI: item.Source.URI, Revision: item.Source.Revision, ManifestPath: item.Source.ManifestPath},
			State:         string(item.State),
			ReadOnly:      item.ReadOnly,
			Compatibility: GetTokensExtensionCompatibility{ManifestContract: item.Compatibility.ManifestContract, SidecarContract: item.Compatibility.SidecarContract, CapabilityContract: item.Compatibility.CapabilityContract, Status: item.Compatibility.Status},
			Permissions:   append([]string(nil), item.Permissions...),
			Capabilities:  mapGetTokensExtensionCapabilities(item.Capabilities),
			Diagnostics:   mapGetTokensExtensionDiagnostics(item.Diagnostics),
		})
	}
	return out
}

func mapGetTokensExtensionCapabilities(items []gettokensextensions.CapabilitySnapshot) []GetTokensExtensionCapability {
	if len(items) == 0 {
		return nil
	}
	out := make([]GetTokensExtensionCapability, 0, len(items))
	for _, item := range items {
		out = append(out, GetTokensExtensionCapability{
			ID:                    item.ID,
			Kind:                  item.Kind,
			State:                 string(item.State),
			RequiredPermissions:   append([]string(nil), item.RequiredPermissions...),
			DeclaredContributions: append([]string(nil), item.DeclaredContributions...),
			Diagnostics:           mapGetTokensExtensionDiagnostics(item.Diagnostics),
		})
	}
	return out
}

func mapGetTokensExtensionDiagnostics(items []gettokensextensions.Diagnostic) []GetTokensExtensionDiagnostic {
	if len(items) == 0 {
		return nil
	}
	out := make([]GetTokensExtensionDiagnostic, 0, len(items))
	for _, item := range items {
		out = append(out, GetTokensExtensionDiagnostic{
			Code:     item.Code,
			Severity: string(item.Severity),
			Path:     item.Path,
			Message:  item.Message,
			Source:   item.Source,
		})
	}
	return out
}

func mapDoctorChecks(items []wailsapp.DoctorCheck) []DoctorCheck {
	if len(items) == 0 {
		return nil
	}
	out := make([]DoctorCheck, 0, len(items))
	for _, item := range items {
		out = append(out, DoctorCheck{
			ID:                  item.ID,
			Kind:                item.Kind,
			Title:               item.Title,
			Status:              item.Status,
			Reason:              item.Reason,
			Repairability:       item.Repairability,
			Authority:           item.Authority,
			Confidence:          item.Confidence,
			LastCheckedAtUnixMs: item.LastCheckedAtUnixMs,
			Evidence:            mapDoctorEvidenceRefs(item.Evidence),
			Navigation:          mapDoctorNavigationTargets(item.Navigation),
		})
	}
	return out
}

func mapDoctorEvidenceRefs(items []wailsapp.DoctorEvidenceRef) []DoctorEvidenceRef {
	if len(items) == 0 {
		return nil
	}
	out := make([]DoctorEvidenceRef, 0, len(items))
	for _, item := range items {
		out = append(out, DoctorEvidenceRef{
			Kind:          item.Kind,
			Label:         item.Label,
			Summary:       item.Summary,
			RefID:         item.RefID,
			Source:        item.Source,
			AccountKey:    item.AccountKey,
			AccountID:     item.AccountID,
			AuthID:        item.AuthID,
			Model:         item.Model,
			Scope:         item.Scope,
			Reason:        item.Reason,
			RouteBlocking: cloneBoolPtr(item.RouteBlocking),
			RouteEvidence: mapDoctorRouteEvidencePayload(item.RouteEvidence),
			DroppedReason: mapDoctorRouteEvidencePayload(item.DroppedReason),
			QuotaFact:     mapWailsCodexQuotaFact(item.QuotaFact),
		})
	}
	return out
}

func mapDoctorRouteEvidencePayload(item *wailsapp.DoctorRouteEvidencePayload) *DoctorRouteEvidencePayload {
	if item == nil {
		return nil
	}
	return &DoctorRouteEvidencePayload{
		AccountKey:    item.AccountKey,
		AccountID:     item.AccountID,
		AuthID:        item.AuthID,
		Model:         item.Model,
		Source:        item.Source,
		Scope:         item.Scope,
		Reason:        item.Reason,
		RouteBlocking: cloneBoolPtr(item.RouteBlocking),
	}
}

func cloneBoolPtr(value *bool) *bool {
	if value == nil {
		return nil
	}
	next := *value
	return &next
}

func mapDoctorNavigationTargets(items []wailsapp.DoctorNavigationTarget) []DoctorNavigationTarget {
	if len(items) == 0 {
		return nil
	}
	out := make([]DoctorNavigationTarget, 0, len(items))
	for _, item := range items {
		out = append(out, DoctorNavigationTarget{
			Kind:  item.Kind,
			Label: item.Label,
			Hash:  item.Hash,
		})
	}
	return out
}

func mapWailsCodexQuotaFact(result *wailsapp.CodexQuotaFact) *CodexQuotaFact {
	if result == nil {
		return nil
	}
	return &CodexQuotaFact{
		State:        result.State,
		Source:       result.Source,
		Freshness:    result.Freshness,
		Confidence:   result.Confidence,
		Risk:         result.Risk,
		Explanation:  result.Explanation,
		ObservedAt:   result.ObservedAt,
		ExpiresAt:    result.ExpiresAt,
		EvidenceRefs: append([]string(nil), result.EvidenceRefs...),
	}
}

func mapCliproxyQuotaRuntimeFact(result *cliproxyapi.QuotaRuntimeFact) *CodexQuotaFact {
	if result == nil {
		return nil
	}
	return &CodexQuotaFact{
		State:        result.State,
		Source:       result.Source,
		Freshness:    result.Freshness,
		Confidence:   result.Confidence,
		Risk:         result.Risk,
		Explanation:  result.Explanation,
		ObservedAt:   result.ObservedAt,
		ExpiresAt:    result.ExpiresAt,
		EvidenceRefs: append([]string(nil), result.EvidenceRefs...),
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
			SessionID:         detail.SessionID,
			ProjectName:       detail.ProjectName,
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

func mapSidecarUsageAttributionInput(input SidecarUsageAttributionInput) wailsapp.SidecarUsageAttributionInput {
	return wailsapp.SidecarUsageAttributionInput{
		Window:             input.Window,
		Bucket:             input.Bucket,
		IncludeUnresolved:  input.IncludeUnresolved,
		ResolveAccountKeys: input.ResolveAccountKeys,
	}
}

func mapSidecarUsageAttributionResponse(result *wailsapp.SidecarUsageAttributionResponse) *SidecarUsageAttributionResponse {
	if result == nil {
		return &SidecarUsageAttributionResponse{
			Items: []SidecarUsageAttributionItem{},
		}
	}
	return &SidecarUsageAttributionResponse{
		Window:      result.Window,
		Bucket:      result.Bucket,
		GeneratedAt: result.GeneratedAt,
		Items:       mapSidecarUsageAttributionItems(result.Items),
		Unresolved:  mapSidecarUsageAttributionItems(result.Unresolved),
	}
}

func mapSidecarUsageAttributionItems(items []wailsapp.SidecarUsageAttributionItem) []SidecarUsageAttributionItem {
	if len(items) == 0 {
		return []SidecarUsageAttributionItem{}
	}
	out := make([]SidecarUsageAttributionItem, 0, len(items))
	for _, item := range items {
		out = append(out, SidecarUsageAttributionItem{
			AttributionKey:    item.AttributionKey,
			AttributionKind:   item.AttributionKind,
			AccountKey:        item.AccountKey,
			CredentialKey:     item.CredentialKey,
			Provider:          item.Provider,
			RequestedModels:   append([]string(nil), item.RequestedModels...),
			RequestCount:      item.RequestCount,
			FailedCount:       item.FailedCount,
			LatencyAverageMs:  item.LatencyAverageMs,
			InputTokens:       item.InputTokens,
			CachedInputTokens: item.CachedInputTokens,
			OutputTokens:      item.OutputTokens,
			TotalTokens:       item.TotalTokens,
			LastActivityAt:    item.LastActivityAt,
			Buckets:           mapSidecarUsageAttributionBuckets(item.Buckets),
		})
	}
	return out
}

func mapSidecarUsageAttributionBuckets(items []wailsapp.SidecarUsageAttributionBucket) []SidecarUsageAttributionBucket {
	if len(items) == 0 {
		return []SidecarUsageAttributionBucket{}
	}
	out := make([]SidecarUsageAttributionBucket, 0, len(items))
	for _, item := range items {
		out = append(out, SidecarUsageAttributionBucket{
			Start:             item.Start,
			RequestCount:      item.RequestCount,
			FailedCount:       item.FailedCount,
			InputTokens:       item.InputTokens,
			CachedInputTokens: item.CachedInputTokens,
			OutputTokens:      item.OutputTokens,
			TotalTokens:       item.TotalTokens,
		})
	}
	return out
}

func mapAccountStoreDiagnostics(input *wailsapp.AccountStoreDiagnostics) *AccountStoreDiagnostics {
	if input == nil {
		return &AccountStoreDiagnostics{}
	}
	return &AccountStoreDiagnostics{
		PathBasename: input.PathBasename,
		Configured:   input.Configured,
		Open:         input.Open,
		ReadRecovery: AccountStoreReadRecoveryDiagnostics{
			Count:             input.ReadRecovery.Count,
			LastEndpoint:      input.ReadRecovery.LastEndpoint,
			LastRecovered:     input.ReadRecovery.LastRecovered,
			LastError:         input.ReadRecovery.LastError,
			LastRecoveredUnix: input.ReadRecovery.LastRecoveredUnix,
		},
	}
}

func mapRateLimitStrategies(items []wailsapp.RateLimitStrategyMeta) []RateLimitStrategyMeta {
	if len(items) == 0 {
		return []RateLimitStrategyMeta{}
	}
	out := make([]RateLimitStrategyMeta, 0, len(items))
	for _, item := range items {
		out = append(out, RateLimitStrategyMeta{
			ID:               item.ID,
			Name:             item.Name,
			SupportedWindows: append([]string(nil), item.SupportedWindows...),
		})
	}
	return out
}

func mapRateLimitRuleToCore(input RateLimitRule) wailsapp.RateLimitRule {
	return wailsapp.RateLimitRule{
		ID:         input.ID,
		AccountKey: input.AccountKey,
		Strategy:   input.Strategy,
		Window:     input.Window,
		LimitValue: input.LimitValue,
		Action:     input.Action,
		Enabled:    input.Enabled,
		Label:      input.Label,
		CreatedAt:  input.CreatedAt,
		UpdatedAt:  input.UpdatedAt,
	}
}

func mapRateLimitRules(items []wailsapp.RateLimitRule) []RateLimitRule {
	if len(items) == 0 {
		return []RateLimitRule{}
	}
	out := make([]RateLimitRule, 0, len(items))
	for _, item := range items {
		out = append(out, mapRateLimitRule(item))
	}
	return out
}

func mapRateLimitRule(item wailsapp.RateLimitRule) RateLimitRule {
	return RateLimitRule{
		ID:         item.ID,
		AccountKey: item.AccountKey,
		Strategy:   item.Strategy,
		Window:     item.Window,
		LimitValue: item.LimitValue,
		Action:     item.Action,
		Enabled:    item.Enabled,
		Label:      item.Label,
		CreatedAt:  item.CreatedAt,
		UpdatedAt:  item.UpdatedAt,
	}
}

func mapProjectCandidatePoolRuleToCore(input ProjectCandidatePoolRule) wailsapp.ProjectCandidatePoolRule {
	return wailsapp.ProjectCandidatePoolRule{
		ID:                   input.ID,
		Channel:              input.Channel,
		ProjectKey:           input.ProjectKey,
		ProjectName:          input.ProjectName,
		ProjectKeySource:     input.ProjectKeySource,
		ProjectKeyConfidence: input.ProjectKeyConfidence,
		Enabled:              input.Enabled,
		AllowAccountIDs:      append([]string(nil), input.AllowAccountIDs...),
		CreatedAt:            input.CreatedAt,
		UpdatedAt:            input.UpdatedAt,
	}
}

func mapProjectCandidatePoolRules(items []wailsapp.ProjectCandidatePoolRule) []ProjectCandidatePoolRule {
	if len(items) == 0 {
		return []ProjectCandidatePoolRule{}
	}
	out := make([]ProjectCandidatePoolRule, 0, len(items))
	for _, item := range items {
		out = append(out, mapProjectCandidatePoolRule(item))
	}
	return out
}

func mapProjectCandidatePoolRule(item wailsapp.ProjectCandidatePoolRule) ProjectCandidatePoolRule {
	return ProjectCandidatePoolRule{
		ID:                   item.ID,
		Channel:              item.Channel,
		ProjectKey:           item.ProjectKey,
		ProjectName:          item.ProjectName,
		ProjectKeySource:     item.ProjectKeySource,
		ProjectKeyConfidence: item.ProjectKeyConfidence,
		Enabled:              item.Enabled,
		AllowAccountIDs:      append([]string(nil), item.AllowAccountIDs...),
		CreatedAt:            item.CreatedAt,
		UpdatedAt:            item.UpdatedAt,
	}
}

func mapRateLimitState(input *wailsapp.RateLimitState) *RateLimitState {
	if input == nil {
		return &RateLimitState{Sources: []RateLimitSourceState{}, Rules: []RateLimitRuleState{}}
	}
	return &RateLimitState{
		AccountKey:      input.AccountKey,
		Blocked:         input.Blocked,
		BlockReason:     input.BlockReason,
		Sources:         mapRateLimitSourceStates(input.Sources),
		Rules:           mapRateLimitRuleStates(input.Rules),
		UpdatedAt:       input.UpdatedAt,
		LastEvaluatedAt: input.LastEvaluatedAt,
		NextReset:       input.NextReset,
		Stale:           input.Stale,
		DegradedReason:  input.DegradedReason,
	}
}

func mapRateLimitStates(items []wailsapp.RateLimitState) []RateLimitState {
	if len(items) == 0 {
		return []RateLimitState{}
	}
	out := make([]RateLimitState, 0, len(items))
	for _, item := range items {
		mapped := mapRateLimitState(&item)
		out = append(out, *mapped)
	}
	return out
}

func mapRateLimitRuleStates(items []wailsapp.RateLimitRuleState) []RateLimitRuleState {
	if len(items) == 0 {
		return []RateLimitRuleState{}
	}
	out := make([]RateLimitRuleState, 0, len(items))
	for _, item := range items {
		out = append(out, RateLimitRuleState{
			Rule:         mapRateLimitRule(item.Rule),
			Exceeded:     item.Exceeded,
			Reason:       item.Reason,
			UsagePct:     item.UsagePct,
			CurrentUsage: item.CurrentUsage,
			LimitValue:   item.LimitValue,
			WindowStart:  item.WindowStart,
			WindowEnd:    item.WindowEnd,
			NextReset:    item.NextReset,
		})
	}
	return out
}

func mapRateLimitSourceStates(items []wailsapp.RateLimitSourceState) []RateLimitSourceState {
	if len(items) == 0 {
		return []RateLimitSourceState{}
	}
	out := make([]RateLimitSourceState, 0, len(items))
	for _, item := range items {
		out = append(out, RateLimitSourceState{
			Source:      item.Source,
			Reason:      item.Reason,
			RuleID:      item.RuleID,
			Strategy:    item.Strategy,
			Window:      item.Window,
			UsageValue:  item.UsageValue,
			LimitValue:  item.LimitValue,
			WindowStart: item.WindowStart,
			WindowEnd:   item.WindowEnd,
			NextReset:   item.NextReset,
		})
	}
	return out
}

func mapRateLimitEvents(items []wailsapp.RateLimitEvent) []RateLimitEvent {
	if len(items) == 0 {
		return []RateLimitEvent{}
	}
	out := make([]RateLimitEvent, 0, len(items))
	for _, item := range items {
		out = append(out, RateLimitEvent{
			ID:          item.ID,
			AccountKey:  item.AccountKey,
			RuleID:      item.RuleID,
			Strategy:    item.Strategy,
			Window:      item.Window,
			Action:      item.Action,
			UsageValue:  item.UsageValue,
			LimitValue:  item.LimitValue,
			Blocked:     item.Blocked,
			Reason:      item.Reason,
			TriggeredAt: item.TriggeredAt,
		})
	}
	return out
}

func mapCodexFeatureConfigSnapshot(result *wailsapp.CodexFeatureConfigSnapshot) *CodexFeatureConfigSnapshot {
	if result == nil {
		return &CodexFeatureConfigSnapshot{
			Definitions:     []CodexFeatureDefinition{},
			Values:          map[string]bool{},
			TypedValues:     map[string]any{},
			RawValues:       map[string]string{},
			UnknownValues:   map[string]bool{},
			UnknownSections: map[string]string{},
			Warnings:        []string{},
		}
	}

	definitions := make([]CodexFeatureDefinition, 0, len(result.Definitions))
	for _, definition := range result.Definitions {
		definitions = append(definitions, CodexFeatureDefinition{
			Section:        definition.Section,
			Key:            definition.Key,
			ID:             definition.ID,
			Path:           append([]string(nil), definition.Path...),
			Description:    definition.Description,
			Stage:          definition.Stage,
			ValueType:      definition.ValueType,
			Options:        append([]string(nil), definition.Options...),
			DefaultValue:   definition.DefaultValue,
			DefaultEnabled: definition.DefaultEnabled,
			CanonicalKey:   definition.CanonicalKey,
			LegacyAlias:    definition.LegacyAlias,
			ReadOnly:       definition.ReadOnly,
			Unsupported:    definition.Unsupported,
		})
	}

	return &CodexFeatureConfigSnapshot{
		CodexHomePath:   result.CodexHomePath,
		ConfigPath:      result.ConfigPath,
		Exists:          result.Exists,
		Definitions:     definitions,
		Values:          cloneBoolMap(result.Values),
		TypedValues:     cloneAnyMap(result.TypedValues),
		RawValues:       cloneStringMap(result.RawValues),
		UnknownValues:   cloneBoolMap(result.UnknownValues),
		UnknownSections: cloneStringMap(result.UnknownSections),
		Raw:             result.Raw,
		Warnings:        append([]string(nil), result.Warnings...),
	}
}

func mapCodexFeatureConfigPreview(result *wailsapp.CodexFeatureConfigPreview) *CodexFeatureConfigPreview {
	if result == nil {
		return &CodexFeatureConfigPreview{
			Changes:  []CodexFeatureConfigChange{},
			Warnings: []string{},
		}
	}

	changes := make([]CodexFeatureConfigChange, 0, len(result.Changes))
	for _, change := range result.Changes {
		changes = append(changes, CodexFeatureConfigChange{
			ID:              change.ID,
			Section:         change.Section,
			Key:             change.Key,
			Path:            append([]string(nil), change.Path...),
			ValueType:       change.ValueType,
			Type:            change.Type,
			PreviousEnabled: change.PreviousEnabled,
			NextEnabled:     change.NextEnabled,
			PreviousValue:   change.PreviousValue,
			NextValue:       change.NextValue,
		})
	}

	return &CodexFeatureConfigPreview{
		ConfigPath: result.ConfigPath,
		WillCreate: result.WillCreate,
		Changes:    changes,
		Preview:    result.Preview,
		Warnings:   append([]string(nil), result.Warnings...),
	}
}

func mapCodexSkillsSnapshot(result *wailsapp.CodexSkillsSnapshot) *CodexSkillsSnapshot {
	if result == nil {
		return &CodexSkillsSnapshot{Roots: []CodexSkillRoot{}, Skills: []CodexSkillRecord{}, Warnings: []string{}}
	}
	roots := make([]CodexSkillRoot, 0, len(result.Roots))
	for _, root := range result.Roots {
		roots = append(roots, CodexSkillRoot{
			Label:      root.Label,
			Path:       root.Path,
			SourceKind: root.SourceKind,
			Exists:     root.Exists,
		})
	}
	skills := make([]CodexSkillRecord, 0, len(result.Skills))
	for _, skill := range result.Skills {
		files := make([]CodexSkillFile, 0, len(skill.Files))
		for _, file := range skill.Files {
			files = append(files, CodexSkillFile{
				Path:        file.Path,
				Kind:        file.Kind,
				Content:     file.Content,
				Previewable: file.Previewable,
			})
		}
		skills = append(skills, CodexSkillRecord{
			ID:              skill.ID,
			Name:            skill.Name,
			Description:     skill.Description,
			Enabled:         skill.Enabled,
			RootLabel:       skill.RootLabel,
			RootPath:        skill.RootPath,
			SourceKind:      skill.SourceKind,
			Origin:          skill.Origin,
			VersionLabel:    skill.VersionLabel,
			Files:           files,
			SkillMarkdown:   skill.SkillMarkdown,
			PreviewMarkdown: skill.PreviewMarkdown,
			Warnings:        append([]string(nil), skill.Warnings...),
		})
	}
	return &CodexSkillsSnapshot{
		CodexHomePath: result.CodexHomePath,
		ConfigPath:    result.ConfigPath,
		Roots:         roots,
		Skills:        skills,
		Warnings:      append([]string(nil), result.Warnings...),
	}
}

func mapClaudeCodeExtensionsSnapshot(result *wailsapp.ClaudeCodeExtensionsSnapshot) *ClaudeCodeExtensionsSnapshot {
	if result == nil {
		return &ClaudeCodeExtensionsSnapshot{Skills: []ClaudeCodeSkillAsset{}, McpServers: []ClaudeCodeMcpAsset{}, Warnings: []string{}}
	}
	skills := make([]ClaudeCodeSkillAsset, 0, len(result.Skills))
	for _, skill := range result.Skills {
		skills = append(skills, ClaudeCodeSkillAsset{
			ID:                  skill.ID,
			Name:                skill.Name,
			Description:         skill.Description,
			Scope:               skill.Scope,
			Path:                skill.Path,
			FrontmatterStatus:   skill.FrontmatterStatus,
			Invocation:          skill.Invocation,
			ModelInvocation:     skill.ModelInvocation,
			Removable:           skill.Removable,
			FileCount:           skill.FileCount,
			Risk:                skill.Risk,
			PreviewMarkdown:     skill.PreviewMarkdown,
			FrontmatterError:    skill.FrontmatterError,
			LegacyCommandSource: skill.LegacyCommandSource,
		})
	}
	servers := make([]ClaudeCodeMcpAsset, 0, len(result.McpServers))
	for _, server := range result.McpServers {
		servers = append(servers, ClaudeCodeMcpAsset{
			ID:          server.ID,
			Label:       server.Label,
			Transport:   server.Transport,
			Scope:       server.Scope,
			SourcePath:  server.SourcePath,
			Endpoint:    server.Endpoint,
			Active:      server.Active,
			SecretState: server.SecretState,
			Dirty:       server.Dirty,
			ShadowedBy:  server.ShadowedBy,
		})
	}
	return &ClaudeCodeExtensionsSnapshot{
		ClaudeConfigDirPath: result.ClaudeConfigDirPath,
		ClaudeJSONPath:      result.ClaudeJSONPath,
		ProjectPath:         result.ProjectPath,
		Skills:              skills,
		McpServers:          servers,
		Warnings:            append([]string(nil), result.Warnings...),
	}
}

func mapWailsClaudeCodeMcpAsset(server ClaudeCodeMcpAsset) wailsapp.ClaudeCodeMcpAsset {
	return wailsapp.ClaudeCodeMcpAsset{
		ID:          server.ID,
		Label:       server.Label,
		Transport:   server.Transport,
		Scope:       server.Scope,
		SourcePath:  server.SourcePath,
		Endpoint:    server.Endpoint,
		Active:      server.Active,
		SecretState: server.SecretState,
		Dirty:       server.Dirty,
		ShadowedBy:  server.ShadowedBy,
	}
}

func mapClaudeCodeMcpAsset(server wailsapp.ClaudeCodeMcpAsset) ClaudeCodeMcpAsset {
	return ClaudeCodeMcpAsset{
		ID:          server.ID,
		Label:       server.Label,
		Transport:   server.Transport,
		Scope:       server.Scope,
		SourcePath:  server.SourcePath,
		Endpoint:    server.Endpoint,
		Active:      server.Active,
		SecretState: server.SecretState,
		Dirty:       server.Dirty,
		ShadowedBy:  server.ShadowedBy,
	}
}

func mapClaudeCodeMcpSaveResult(result *wailsapp.SaveClaudeCodeMcpServerResult) *SaveClaudeCodeMcpServerResult {
	if result == nil {
		return &SaveClaudeCodeMcpServerResult{Changes: []ClaudeCodeMcpChange{}}
	}
	changes := make([]ClaudeCodeMcpChange, 0, len(result.Changes))
	for _, change := range result.Changes {
		changes = append(changes, ClaudeCodeMcpChange{Key: change.Key, Before: change.Before, After: change.After})
	}
	return &SaveClaudeCodeMcpServerResult{
		ConfigPath: result.ConfigPath,
		Server:     mapClaudeCodeMcpAsset(result.Server),
		Preview:    result.Preview,
		Changes:    changes,
	}
}

func mapClaudeCodeSettingsSnapshot(result *wailsapp.ClaudeCodeSettingsSnapshot) *ClaudeCodeSettingsSnapshotDTO {
	if result == nil {
		return &ClaudeCodeSettingsSnapshotDTO{Layers: []ClaudeCodeSettingsLayer{}, Warnings: []string{}}
	}
	layers := make([]ClaudeCodeSettingsLayer, 0, len(result.Layers))
	for _, layer := range result.Layers {
		mapped := ClaudeCodeSettingsLayer{
			Scope:      string(layer.Scope),
			Path:       layer.Path,
			Exists:     layer.Exists,
			ParseError: layer.ParseError,
		}
		if layer.KnownFields != nil {
			mapped.KnownFields = &ClaudeCodeSettingsFieldsDTO{
				Env:             layer.KnownFields.Env,
				Permissions:     layer.KnownFields.Permissions,
				DisableAllHooks: layer.KnownFields.DisableAllHooks,
				OutputStyle:     layer.KnownFields.OutputStyle,
			}
		}
		layers = append(layers, mapped)
	}
	return &ClaudeCodeSettingsSnapshotDTO{
		ProjectPath: result.ProjectPath,
		Layers:      layers,
		Warnings:    result.Warnings,
	}
}

func mapClaudeCodeSettingsPatchResult(result *wailsapp.PatchClaudeCodeSettingsResult) *PatchClaudeCodeSettingsResultDTO {
	if result == nil {
		return &PatchClaudeCodeSettingsResultDTO{Changes: []ClaudeCodeSettingsChangeDTO{}}
	}
	changes := make([]ClaudeCodeSettingsChangeDTO, 0, len(result.Changes))
	for _, change := range result.Changes {
		changes = append(changes, ClaudeCodeSettingsChangeDTO{Key: change.Key, Before: change.Before, After: change.After})
	}
	return &PatchClaudeCodeSettingsResultDTO{
		ConfigPath: result.ConfigPath,
		Preview:    result.Preview,
		Changes:    changes,
	}
}

func mapCodexMcpServersSnapshot(result *wailsapp.CodexMcpServersSnapshot) *CodexMcpServersSnapshot {
	if result == nil {
		return &CodexMcpServersSnapshot{Servers: []CodexMcpServer{}, Warnings: []string{}}
	}
	servers := make([]CodexMcpServer, 0, len(result.Servers))
	for _, server := range result.Servers {
		servers = append(servers, mapCodexMcpServer(server))
	}
	return &CodexMcpServersSnapshot{
		CodexHomePath: result.CodexHomePath,
		ConfigPath:    result.ConfigPath,
		Exists:        result.Exists,
		Servers:       servers,
		Warnings:      append([]string(nil), result.Warnings...),
	}
}

func mapCodexMcpServer(server wailsapp.CodexMcpServer) CodexMcpServer {
	return CodexMcpServer{
		ID:                        server.ID,
		Label:                     server.Label,
		Enabled:                   server.Enabled,
		Transport:                 server.Transport,
		Command:                   server.Command,
		Args:                      append([]string(nil), server.Args...),
		Env:                       mapCodexMcpEnvRows(server.Env),
		EnvVarsRaw:                server.EnvVarsRaw,
		Cwd:                       server.Cwd,
		URL:                       server.URL,
		BearerTokenEnvVar:         server.BearerTokenEnvVar,
		HTTPHeaders:               mapCodexMcpEnvRows(server.HTTPHeaders),
		EnvHTTPHeaders:            mapCodexMcpEnvRows(server.EnvHTTPHeaders),
		EnvironmentID:             server.EnvironmentID,
		ExperimentalEnvironment:   server.ExperimentalEnvironment,
		Required:                  server.Required,
		SupportsParallelToolCalls: server.SupportsParallelToolCalls,
		StartupTimeoutSec:         server.StartupTimeoutSec,
		ToolTimeoutSec:            server.ToolTimeoutSec,
		DefaultToolsApprovalMode:  server.DefaultToolsApprovalMode,
		EnabledTools:              append([]string(nil), server.EnabledTools...),
		DisabledTools:             append([]string(nil), server.DisabledTools...),
		Scopes:                    append([]string(nil), server.Scopes...),
		OAuthClientID:             server.OAuthClientID,
		OAuthResource:             server.OAuthResource,
		Tools:                     mapCodexMcpToolRows(server.Tools),
		RawConfig:                 server.RawConfig,
		SourcePath:                server.SourcePath,
		Status:                    server.Status,
		Warnings:                  append([]string(nil), server.Warnings...),
	}
}

func mapWailsCodexMcpServer(server CodexMcpServer) wailsapp.CodexMcpServer {
	return wailsapp.CodexMcpServer{
		ID:                        server.ID,
		Label:                     server.Label,
		Enabled:                   server.Enabled,
		Transport:                 server.Transport,
		Command:                   server.Command,
		Args:                      append([]string(nil), server.Args...),
		Env:                       mapWailsCodexMcpEnvRows(server.Env),
		EnvVarsRaw:                server.EnvVarsRaw,
		Cwd:                       server.Cwd,
		URL:                       server.URL,
		BearerTokenEnvVar:         server.BearerTokenEnvVar,
		HTTPHeaders:               mapWailsCodexMcpEnvRows(server.HTTPHeaders),
		EnvHTTPHeaders:            mapWailsCodexMcpEnvRows(server.EnvHTTPHeaders),
		EnvironmentID:             server.EnvironmentID,
		ExperimentalEnvironment:   server.ExperimentalEnvironment,
		Required:                  server.Required,
		SupportsParallelToolCalls: server.SupportsParallelToolCalls,
		StartupTimeoutSec:         server.StartupTimeoutSec,
		ToolTimeoutSec:            server.ToolTimeoutSec,
		DefaultToolsApprovalMode:  server.DefaultToolsApprovalMode,
		EnabledTools:              append([]string(nil), server.EnabledTools...),
		DisabledTools:             append([]string(nil), server.DisabledTools...),
		Scopes:                    append([]string(nil), server.Scopes...),
		OAuthClientID:             server.OAuthClientID,
		OAuthResource:             server.OAuthResource,
		Tools:                     mapWailsCodexMcpToolRows(server.Tools),
		RawConfig:                 server.RawConfig,
		SourcePath:                server.SourcePath,
		Status:                    server.Status,
		Warnings:                  append([]string(nil), server.Warnings...),
	}
}

func mapCodexMcpEnvRows(rows []wailsapp.CodexMcpEnvRow) []CodexMcpEnvRow {
	result := make([]CodexMcpEnvRow, 0, len(rows))
	for _, row := range rows {
		result = append(result, CodexMcpEnvRow{Key: row.Key, Value: row.Value})
	}
	return result
}

func mapWailsCodexMcpEnvRows(rows []CodexMcpEnvRow) []wailsapp.CodexMcpEnvRow {
	result := make([]wailsapp.CodexMcpEnvRow, 0, len(rows))
	for _, row := range rows {
		result = append(result, wailsapp.CodexMcpEnvRow{Key: row.Key, Value: row.Value})
	}
	return result
}

func mapCodexMcpToolRows(rows []wailsapp.CodexMcpToolRow) []CodexMcpToolRow {
	result := make([]CodexMcpToolRow, 0, len(rows))
	for _, row := range rows {
		result = append(result, CodexMcpToolRow{Name: row.Name, ApprovalMode: row.ApprovalMode})
	}
	return result
}

func mapWailsCodexMcpToolRows(rows []CodexMcpToolRow) []wailsapp.CodexMcpToolRow {
	result := make([]wailsapp.CodexMcpToolRow, 0, len(rows))
	for _, row := range rows {
		result = append(result, wailsapp.CodexMcpToolRow{Name: row.Name, ApprovalMode: row.ApprovalMode})
	}
	return result
}

func mapCodexMcpPreflightResult(result *wailsapp.CodexMcpPreflightResult) *CodexMcpPreflightResult {
	if result == nil {
		return &CodexMcpPreflightResult{Checks: []CodexMcpPreflightCheck{}}
	}
	checks := make([]CodexMcpPreflightCheck, 0, len(result.Checks))
	for _, check := range result.Checks {
		checks = append(checks, CodexMcpPreflightCheck{
			ID:     check.ID,
			Label:  check.Label,
			Status: check.Status,
			Detail: check.Detail,
		})
	}
	return &CodexMcpPreflightResult{
		ServerID: result.ServerID,
		Status:   result.Status,
		Checks:   checks,
	}
}

func mapCodexMcpSaveResult(result *wailsapp.SaveCodexMcpServerResult) *SaveCodexMcpServerResult {
	if result == nil {
		return &SaveCodexMcpServerResult{Changes: []CodexMcpChange{}}
	}
	changes := make([]CodexMcpChange, 0, len(result.Changes))
	for _, change := range result.Changes {
		changes = append(changes, CodexMcpChange{Key: change.Key, Before: change.Before, After: change.After})
	}
	return &SaveCodexMcpServerResult{
		ConfigPath: result.ConfigPath,
		Server:     mapCodexMcpServer(result.Server),
		Preview:    result.Preview,
		Changes:    changes,
	}
}

func cloneBoolMap(source map[string]bool) map[string]bool {
	if len(source) == 0 {
		return map[string]bool{}
	}
	cloned := make(map[string]bool, len(source))
	for key, value := range source {
		cloned[key] = value
	}
	return cloned
}

func mapSessionManagementSnapshot(result *wailsapp.SessionManagementSnapshot) *SessionManagementSnapshot {
	if result == nil {
		return &SessionManagementSnapshot{
			ProviderCounts: map[string]int{},
			Projects:       []SessionManagementProjectRecord{},
		}
	}

	projects := make([]SessionManagementProjectRecord, 0, len(result.Projects))
	for _, project := range result.Projects {
		sessions := make([]SessionManagementSessionRecord, 0, len(project.Sessions))
		for _, session := range project.Sessions {
			sessions = append(sessions, SessionManagementSessionRecord{
				ID:                     session.ID,
				SessionID:              session.SessionID,
				ProjectID:              session.ProjectID,
				ProjectName:            session.ProjectName,
				ProjectKey:             session.ProjectKey,
				ProjectKeySource:       session.ProjectKeySource,
				ProjectKeyConfidence:   session.ProjectKeyConfidence,
				Title:                  session.Title,
				DisplayTitle:           session.DisplayTitle,
				TitleSource:            session.TitleSource,
				TitleConfidence:        session.TitleConfidence,
				Status:                 session.Status,
				Archived:               session.Archived,
				MessageCount:           session.MessageCount,
				RoleSummary:            session.RoleSummary,
				StartedAt:              session.StartedAt,
				UpdatedAt:              session.UpdatedAt,
				FileLabel:              session.FileLabel,
				Summary:                session.Summary,
				Preview:                session.Preview,
				Topic:                  session.Topic,
				PrimaryIntent:          session.PrimaryIntent,
				LastOutcome:            session.LastOutcome,
				HasInstructionPreamble: session.HasInstructionPreamble,
				CurrentMessageLabel:    session.CurrentMessageLabel,
				Provider:               session.Provider,
				Model:                  session.Model,
			})
		}
		projects = append(projects, SessionManagementProjectRecord{
			ID:                   project.ID,
			Name:                 project.Name,
			ProjectKey:           project.ProjectKey,
			ProjectKeySource:     project.ProjectKeySource,
			ProjectKeyConfidence: project.ProjectKeyConfidence,
			ProviderCounts:       cloneProviderCountMap(project.ProviderCounts),
			SessionCount:         project.SessionCount,
			ActiveSessionCount:   project.ActiveSessionCount,
			ArchivedSessionCount: project.ArchivedSessionCount,
			LastActiveAt:         project.LastActiveAt,
			ProviderSummary:      project.ProviderSummary,
			Sessions:             sessions,
		})
	}

	return &SessionManagementSnapshot{
		ProjectCount:         result.ProjectCount,
		SessionCount:         result.SessionCount,
		ActiveSessionCount:   result.ActiveSessionCount,
		ArchivedSessionCount: result.ArchivedSessionCount,
		LastScanAt:           result.LastScanAt,
		ProviderCounts:       cloneProviderCountMap(result.ProviderCounts),
		Projects:             projects,
	}
}

func mapSessionManagementSnapshotToCore(input *SessionManagementSnapshot) *wailsapp.SessionManagementSnapshot {
	if input == nil {
		return nil
	}

	projects := make([]wailsapp.SessionManagementProjectRecord, 0, len(input.Projects))
	for _, project := range input.Projects {
		sessions := make([]wailsapp.SessionManagementSessionRecord, 0, len(project.Sessions))
		for _, session := range project.Sessions {
			sessions = append(sessions, wailsapp.SessionManagementSessionRecord{
				ID:                     session.ID,
				SessionID:              session.SessionID,
				ProjectID:              session.ProjectID,
				ProjectName:            session.ProjectName,
				ProjectKey:             session.ProjectKey,
				ProjectKeySource:       session.ProjectKeySource,
				ProjectKeyConfidence:   session.ProjectKeyConfidence,
				Title:                  session.Title,
				DisplayTitle:           session.DisplayTitle,
				TitleSource:            session.TitleSource,
				TitleConfidence:        session.TitleConfidence,
				Status:                 session.Status,
				Archived:               session.Archived,
				MessageCount:           session.MessageCount,
				RoleSummary:            session.RoleSummary,
				StartedAt:              session.StartedAt,
				UpdatedAt:              session.UpdatedAt,
				FileLabel:              session.FileLabel,
				Summary:                session.Summary,
				Preview:                session.Preview,
				Topic:                  session.Topic,
				PrimaryIntent:          session.PrimaryIntent,
				LastOutcome:            session.LastOutcome,
				HasInstructionPreamble: session.HasInstructionPreamble,
				CurrentMessageLabel:    session.CurrentMessageLabel,
				Provider:               session.Provider,
				Model:                  session.Model,
			})
		}
		projects = append(projects, wailsapp.SessionManagementProjectRecord{
			ID:                   project.ID,
			Name:                 project.Name,
			ProjectKey:           project.ProjectKey,
			ProjectKeySource:     project.ProjectKeySource,
			ProjectKeyConfidence: project.ProjectKeyConfidence,
			ProviderCounts:       cloneProviderCountMap(project.ProviderCounts),
			SessionCount:         project.SessionCount,
			ActiveSessionCount:   project.ActiveSessionCount,
			ArchivedSessionCount: project.ArchivedSessionCount,
			LastActiveAt:         project.LastActiveAt,
			ProviderSummary:      project.ProviderSummary,
			Sessions:             sessions,
		})
	}

	return &wailsapp.SessionManagementSnapshot{
		ProjectCount:         input.ProjectCount,
		SessionCount:         input.SessionCount,
		ActiveSessionCount:   input.ActiveSessionCount,
		ArchivedSessionCount: input.ArchivedSessionCount,
		LastScanAt:           input.LastScanAt,
		ProviderCounts:       cloneProviderCountMap(input.ProviderCounts),
		Projects:             projects,
	}
}

func mapSessionManagementSessionDetail(result *wailsapp.SessionManagementSessionDetail) *SessionManagementSessionDetail {
	if result == nil {
		return &SessionManagementSessionDetail{
			Messages: []SessionManagementMessageRecord{},
		}
	}

	messages := make([]SessionManagementMessageRecord, 0, len(result.Messages))
	for _, message := range result.Messages {
		messages = append(messages, SessionManagementMessageRecord{
			ID:         message.ID,
			LineNumber: message.LineNumber,
			Role:       message.Role,
			TimeLabel:  message.TimeLabel,
			Timestamp:  message.Timestamp,
			Title:      message.Title,
			Summary:    message.Summary,
			Content:    message.Content,
			Truncated:  message.Truncated,
		})
	}

	return &SessionManagementSessionDetail{
		SessionID:              result.SessionID,
		ProjectID:              result.ProjectID,
		ProjectName:            result.ProjectName,
		ProjectKey:             result.ProjectKey,
		ProjectKeySource:       result.ProjectKeySource,
		ProjectKeyConfidence:   result.ProjectKeyConfidence,
		Title:                  result.Title,
		DisplayTitle:           result.DisplayTitle,
		TitleSource:            result.TitleSource,
		TitleConfidence:        result.TitleConfidence,
		Status:                 result.Status,
		Archived:               result.Archived,
		FileLabel:              result.FileLabel,
		MessageCount:           result.MessageCount,
		Masked:                 result.Masked,
		CurrentMessageLabel:    result.CurrentMessageLabel,
		RoleSummary:            result.RoleSummary,
		Topic:                  result.Topic,
		Preview:                result.Preview,
		PrimaryIntent:          result.PrimaryIntent,
		LastOutcome:            result.LastOutcome,
		HasInstructionPreamble: result.HasInstructionPreamble,
		Provider:               result.Provider,
		Model:                  result.Model,
		StartedAt:              result.StartedAt,
		UpdatedAt:              result.UpdatedAt,
		Messages:               messages,
	}
}

func mapSessionManagementMessagePage(result *wailsapp.SessionManagementMessagePage) *SessionManagementMessagePage {
	if result == nil {
		return &SessionManagementMessagePage{
			Messages: []SessionManagementMessageRecord{},
		}
	}
	messages := make([]SessionManagementMessageRecord, 0, len(result.Messages))
	for _, message := range result.Messages {
		messages = append(messages, SessionManagementMessageRecord{
			ID:         message.ID,
			LineNumber: message.LineNumber,
			Role:       message.Role,
			TimeLabel:  message.TimeLabel,
			Timestamp:  message.Timestamp,
			Title:      message.Title,
			Summary:    message.Summary,
			Content:    message.Content,
			Truncated:  message.Truncated,
		})
	}
	return &SessionManagementMessagePage{
		SessionID:    result.SessionID,
		Offset:       result.Offset,
		Limit:        result.Limit,
		MessageCount: result.MessageCount,
		NextOffset:   result.NextOffset,
		HasMore:      result.HasMore,
		Messages:     messages,
	}
}

func mapSessionManagementMessageRawJSON(result *wailsapp.SessionManagementMessageRawJSON) *SessionManagementMessageRawJSON {
	if result == nil {
		return &SessionManagementMessageRawJSON{}
	}
	return &SessionManagementMessageRawJSON{
		SessionID:  result.SessionID,
		LineNumber: result.LineNumber,
		RawJSON:    result.RawJSON,
	}
}

func mapSessionAnalysisResult(result *wailsapp.SessionAnalysisResult) *SessionAnalysisResult {
	if result == nil {
		return &SessionAnalysisResult{
			Keywords:          []SessionAnalysisKeyword{},
			WordCloud:         []SessionAnalysisWordCloudItem{},
			CommonPhrases:     []SessionAnalysisCommonPhrase{},
			RoleContributions: []SessionAnalysisRoleContribution{},
			Projects:          []SessionAnalysisProjectSummary{},
			Sessions:          []SessionAnalysisSessionSummary{},
		}
	}

	projects := make([]SessionAnalysisProjectSummary, 0, len(result.Projects))
	for _, project := range result.Projects {
		projects = append(projects, SessionAnalysisProjectSummary{
			ProjectID:    project.ProjectID,
			ProjectName:  project.ProjectName,
			SessionCount: project.SessionCount,
			MessageCount: project.MessageCount,
			TermCount:    project.TermCount,
			Keywords:     mapSessionAnalysisKeywords(project.Keywords),
		})
	}

	sessions := make([]SessionAnalysisSessionSummary, 0, len(result.Sessions))
	for _, session := range result.Sessions {
		sessions = append(sessions, SessionAnalysisSessionSummary{
			SessionID:         session.SessionID,
			ProjectID:         session.ProjectID,
			ProjectName:       session.ProjectName,
			Title:             session.Title,
			Status:            session.Status,
			Provider:          session.Provider,
			Model:             session.Model,
			MessageCount:      session.MessageCount,
			TermCount:         session.TermCount,
			TopicLine:         session.TopicLine,
			Keywords:          mapSessionAnalysisKeywords(session.Keywords),
			CommonPhrases:     mapSessionAnalysisCommonPhrases(session.CommonPhrases),
			RoleContributions: mapSessionAnalysisRoleContributions(session.RoleContributions),
		})
	}

	return &SessionAnalysisResult{
		Scope:                 result.Scope,
		GeneratedAt:           result.GeneratedAt,
		RequestedSessionCount: result.RequestedSessionCount,
		AnalyzedSessionCount:  result.AnalyzedSessionCount,
		SkippedSessionCount:   result.SkippedSessionCount,
		TotalMessages:         result.TotalMessages,
		TotalTerms:            result.TotalTerms,
		Keywords:              mapSessionAnalysisKeywords(result.Keywords),
		WordCloud:             mapSessionAnalysisWordCloud(result.WordCloud),
		CommonPhrases:         mapSessionAnalysisCommonPhrases(result.CommonPhrases),
		RoleContributions:     mapSessionAnalysisRoleContributions(result.RoleContributions),
		Projects:              projects,
		Sessions:              sessions,
	}
}

func mapSessionAnalysisKeywords(items []wailsapp.SessionAnalysisKeyword) []SessionAnalysisKeyword {
	if len(items) == 0 {
		return []SessionAnalysisKeyword{}
	}
	out := make([]SessionAnalysisKeyword, 0, len(items))
	for _, item := range items {
		out = append(out, SessionAnalysisKeyword{
			Term:         item.Term,
			Count:        item.Count,
			SessionCount: item.SessionCount,
			Score:        item.Score,
		})
	}
	return out
}

func mapSessionAnalysisWordCloud(items []wailsapp.SessionAnalysisWordCloudItem) []SessionAnalysisWordCloudItem {
	if len(items) == 0 {
		return []SessionAnalysisWordCloudItem{}
	}
	out := make([]SessionAnalysisWordCloudItem, 0, len(items))
	for _, item := range items {
		out = append(out, SessionAnalysisWordCloudItem{
			Term:         item.Term,
			Count:        item.Count,
			SessionCount: item.SessionCount,
			Weight:       item.Weight,
		})
	}
	return out
}

func mapSessionAnalysisCommonPhrases(items []wailsapp.SessionAnalysisCommonPhrase) []SessionAnalysisCommonPhrase {
	if len(items) == 0 {
		return []SessionAnalysisCommonPhrase{}
	}
	out := make([]SessionAnalysisCommonPhrase, 0, len(items))
	for _, item := range items {
		out = append(out, SessionAnalysisCommonPhrase{
			Text:         item.Text,
			Count:        item.Count,
			SessionCount: item.SessionCount,
			Score:        item.Score,
		})
	}
	return out
}

func mapSessionAnalysisRoleContributions(items []wailsapp.SessionAnalysisRoleContribution) []SessionAnalysisRoleContribution {
	if len(items) == 0 {
		return []SessionAnalysisRoleContribution{}
	}
	out := make([]SessionAnalysisRoleContribution, 0, len(items))
	for _, item := range items {
		out = append(out, SessionAnalysisRoleContribution{
			Role:         item.Role,
			MessageCount: item.MessageCount,
			TermCount:    item.TermCount,
			Share:        item.Share,
		})
	}
	return out
}

func cloneProviderCountMap(source map[string]int) map[string]int {
	if len(source) == 0 {
		return map[string]int{}
	}
	cloned := make(map[string]int, len(source))
	for provider, count := range source {
		cloned[provider] = count
	}
	return cloned
}

func mapOpenAICompatibleModels(items []wailsapp.OpenAICompatibleModel) []OpenAICompatibleModel {
	models := make([]OpenAICompatibleModel, 0, len(items))
	for _, item := range items {
		models = append(models, OpenAICompatibleModel{
			Name:                      item.Name,
			Alias:                     item.Alias,
			SupportedReasoningEfforts: append([]string(nil), item.SupportedReasoningEfforts...),
			DefaultReasoningEffort:    item.DefaultReasoningEffort,
		})
	}
	return models
}

func mapOpenAICompatibleModelsToWails(items []OpenAICompatibleModel) []wailsapp.OpenAICompatibleModel {
	models := make([]wailsapp.OpenAICompatibleModel, 0, len(items))
	for _, item := range items {
		models = append(models, wailsapp.OpenAICompatibleModel{
			Name:                      item.Name,
			Alias:                     item.Alias,
			SupportedReasoningEfforts: append([]string(nil), item.SupportedReasoningEfforts...),
			DefaultReasoningEffort:    item.DefaultReasoningEffort,
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

func mapClaudeCodeMemoryFilesSnapshot(result *wailsapp.ClaudeCodeMemoryFilesSnapshot) *ClaudeCodeMemoryFilesSnapshotDTO {
	if result == nil {
		return &ClaudeCodeMemoryFilesSnapshotDTO{Files: []ClaudeCodeMemoryFileRecordDTO{}, Warnings: []string{}}
	}
	files := make([]ClaudeCodeMemoryFileRecordDTO, 0, len(result.Files))
	for _, f := range result.Files {
		imports := make([]ClaudeCodeMemoryFileImportDTO, 0, len(f.Imports))
		for _, imp := range f.Imports {
			imports = append(imports, ClaudeCodeMemoryFileImportDTO{Raw: imp.Raw, Resolved: imp.Resolved, Exists: imp.Exists, Depth: imp.Depth})
		}
		files = append(files, ClaudeCodeMemoryFileRecordDTO{
			Scope: string(f.Scope), Path: f.Path, Exists: f.Exists, GitIgnored: f.GitIgnored,
			Imports: imports, Content: f.Content, ContentTruncated: f.ContentTruncated, Size: f.Size,
		})
	}
	return &ClaudeCodeMemoryFilesSnapshotDTO{ProjectPath: result.ProjectPath, Files: files, Warnings: result.Warnings}
}

func mapClaudeCodeMemoryFileSaveResult(result *wailsapp.SaveClaudeCodeMemoryFileResult) *SaveClaudeCodeMemoryFileResultDTO {
	if result == nil {
		return &SaveClaudeCodeMemoryFileResultDTO{}
	}
	return &SaveClaudeCodeMemoryFileResultDTO{Path: result.Path, Size: result.Size, Warning: result.Warning}
}

func mapClaudeCodeSubagentsSnapshot(result *wailsapp.ClaudeCodeSubagentsSnapshot) *ClaudeCodeSubagentsSnapshotDTO {
	if result == nil {
		return &ClaudeCodeSubagentsSnapshotDTO{Agents: []ClaudeCodeSubagentRecordDTO{}, Warnings: []string{}}
	}
	agents := make([]ClaudeCodeSubagentRecordDTO, 0, len(result.Agents))
	for _, a := range result.Agents {
		agents = append(agents, ClaudeCodeSubagentRecordDTO{
			Name: a.Name, Description: a.Description, Path: a.Path, Scope: a.Scope,
			FrontmatterValid: a.FrontmatterValid, FrontmatterError: a.FrontmatterError,
			ValidationErrors: a.ValidationErrors, KnownFields: a.KnownFields,
			UnknownFields: a.UnknownFields, Body: a.Body, BodyPreview: a.BodyPreview,
			IsPlugin: a.IsPlugin, IgnoredFields: a.IgnoredFields,
		})
	}
	return &ClaudeCodeSubagentsSnapshotDTO{UserPath: result.UserPath, ProjectPath: result.ProjectPath, Agents: agents, Warnings: result.Warnings}
}

func mapClaudeCodeSubagentSaveResult(result *wailsapp.SaveClaudeCodeSubagentResult) *SaveClaudeCodeSubagentResultDTO {
	if result == nil {
		return &SaveClaudeCodeSubagentResultDTO{}
	}
	return &SaveClaudeCodeSubagentResultDTO{Path: result.Path, Preview: result.Preview}
}
