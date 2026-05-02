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
