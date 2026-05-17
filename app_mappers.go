package main

import (
	accountsdomain "github.com/linhay/gettokens/internal/accounts"
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
		QuotaCurl:        record.QuotaCurl,
		QuotaEnabled:     record.QuotaEnabled,
		LocalOnly:        record.LocalOnly,
		SupportedFormats: formats,
		FormatBaseURLs:   record.FormatBaseURLs,
		BillingCurl:      record.BillingCurl,
		BillingEnabled:   record.BillingEnabled,
	}
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
			ResetLabel:       window.ResetLabel,
			ResetAtUnix:      window.ResetAtUnix,
		})
	}

	return &CodexQuotaResponse{
		PlanType: result.PlanType,
		Windows:  windows,
		Billing:  mapCodexQuotaBillingInfo(result.Billing),
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

func mapSidecarUsageAttributionInput(input SidecarUsageAttributionInput) wailsapp.SidecarUsageAttributionInput {
	return wailsapp.SidecarUsageAttributionInput{
		Window:            input.Window,
		Bucket:            input.Bucket,
		IncludeUnresolved: input.IncludeUnresolved,
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
		MatchKey:   input.MatchKey,
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
		MatchKey:   item.MatchKey,
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

func mapRateLimitState(input *wailsapp.RateLimitState) *RateLimitState {
	if input == nil {
		return &RateLimitState{Rules: []RateLimitRuleState{}}
	}
	return &RateLimitState{
		AccountKey:  input.AccountKey,
		MatchKey:    input.MatchKey,
		Blocked:     input.Blocked,
		BlockReason: input.BlockReason,
		Rules:       mapRateLimitRuleStates(input.Rules),
		UpdatedAt:   input.UpdatedAt,
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
			MatchKey:    item.MatchKey,
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
			Definitions:   []CodexFeatureDefinition{},
			Values:        map[string]bool{},
			UnknownValues: map[string]bool{},
			Warnings:      []string{},
		}
	}

	definitions := make([]CodexFeatureDefinition, 0, len(result.Definitions))
	for _, definition := range result.Definitions {
		definitions = append(definitions, CodexFeatureDefinition{
			Key:            definition.Key,
			Description:    definition.Description,
			Stage:          definition.Stage,
			DefaultEnabled: definition.DefaultEnabled,
			CanonicalKey:   definition.CanonicalKey,
			LegacyAlias:    definition.LegacyAlias,
		})
	}

	return &CodexFeatureConfigSnapshot{
		CodexHomePath: result.CodexHomePath,
		ConfigPath:    result.ConfigPath,
		Exists:        result.Exists,
		Definitions:   definitions,
		Values:        cloneBoolMap(result.Values),
		UnknownValues: cloneBoolMap(result.UnknownValues),
		Raw:           result.Raw,
		Warnings:      append([]string(nil), result.Warnings...),
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
			Key:             change.Key,
			Type:            change.Type,
			PreviousEnabled: change.PreviousEnabled,
			NextEnabled:     change.NextEnabled,
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
		ExperimentalEnvironment:   server.ExperimentalEnvironment,
		Required:                  server.Required,
		SupportsParallelToolCalls: server.SupportsParallelToolCalls,
		StartupTimeoutSec:         server.StartupTimeoutSec,
		ToolTimeoutSec:            server.ToolTimeoutSec,
		DefaultToolsApprovalMode:  server.DefaultToolsApprovalMode,
		EnabledTools:              append([]string(nil), server.EnabledTools...),
		DisabledTools:             append([]string(nil), server.DisabledTools...),
		Scopes:                    append([]string(nil), server.Scopes...),
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
		ExperimentalEnvironment:   server.ExperimentalEnvironment,
		Required:                  server.Required,
		SupportsParallelToolCalls: server.SupportsParallelToolCalls,
		StartupTimeoutSec:         server.StartupTimeoutSec,
		ToolTimeoutSec:            server.ToolTimeoutSec,
		DefaultToolsApprovalMode:  server.DefaultToolsApprovalMode,
		EnabledTools:              append([]string(nil), server.EnabledTools...),
		DisabledTools:             append([]string(nil), server.DisabledTools...),
		Scopes:                    append([]string(nil), server.Scopes...),
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
				ID:                  session.ID,
				SessionID:           session.SessionID,
				ProjectID:           session.ProjectID,
				ProjectName:         session.ProjectName,
				Title:               session.Title,
				Status:              session.Status,
				Archived:            session.Archived,
				MessageCount:        session.MessageCount,
				RoleSummary:         session.RoleSummary,
				StartedAt:           session.StartedAt,
				UpdatedAt:           session.UpdatedAt,
				FileLabel:           session.FileLabel,
				Summary:             session.Summary,
				Preview:             session.Preview,
				Topic:               session.Topic,
				CurrentMessageLabel: session.CurrentMessageLabel,
				Provider:            session.Provider,
				Model:               session.Model,
			})
		}
		projects = append(projects, SessionManagementProjectRecord{
			ID:                   project.ID,
			Name:                 project.Name,
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
				ID:                  session.ID,
				SessionID:           session.SessionID,
				ProjectID:           session.ProjectID,
				ProjectName:         session.ProjectName,
				Title:               session.Title,
				Status:              session.Status,
				Archived:            session.Archived,
				MessageCount:        session.MessageCount,
				RoleSummary:         session.RoleSummary,
				StartedAt:           session.StartedAt,
				UpdatedAt:           session.UpdatedAt,
				FileLabel:           session.FileLabel,
				Summary:             session.Summary,
				Preview:             session.Preview,
				Topic:               session.Topic,
				CurrentMessageLabel: session.CurrentMessageLabel,
				Provider:            session.Provider,
				Model:               session.Model,
			})
		}
		projects = append(projects, wailsapp.SessionManagementProjectRecord{
			ID:                   project.ID,
			Name:                 project.Name,
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
			ID:        message.ID,
			Role:      message.Role,
			TimeLabel: message.TimeLabel,
			Timestamp: message.Timestamp,
			Title:     message.Title,
			Summary:   message.Summary,
			Content:   message.Content,
			Truncated: message.Truncated,
		})
	}

	return &SessionManagementSessionDetail{
		SessionID:           result.SessionID,
		ProjectID:           result.ProjectID,
		ProjectName:         result.ProjectName,
		Title:               result.Title,
		Status:              result.Status,
		Archived:            result.Archived,
		FileLabel:           result.FileLabel,
		MessageCount:        result.MessageCount,
		Masked:              result.Masked,
		CurrentMessageLabel: result.CurrentMessageLabel,
		RoleSummary:         result.RoleSummary,
		Topic:               result.Topic,
		Preview:             result.Preview,
		Provider:            result.Provider,
		Model:               result.Model,
		StartedAt:           result.StartedAt,
		UpdatedAt:           result.UpdatedAt,
		Messages:            messages,
	}
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
