package wailsapp

import (
	"errors"
	"strings"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
	"github.com/linhay/gettokens/internal/cliproxyapi"
)

func (a *App) managementClient() *cliproxyapi.Client {
	return cliproxyapi.New(a.SidecarRequest)
}

func (a *App) ListAccounts() ([]accountsdomain.AccountRecord, error) {
	authFiles, err := a.ListAuthFiles()
	if err != nil {
		return nil, err
	}

	codexKeys, err := a.loadCodexAPIKeys()
	if err != nil {
		return nil, err
	}

	records := make([]accountsdomain.AuthFileRecord, 0, len(authFiles.Files))
	for _, file := range authFiles.Files {
		if isReservedCodexAPIKeyAuthArtifact(file.Name) {
			continue
		}
		records = append(records, accountsdomain.AuthFileRecord{
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

	return accountsdomain.BuildAccountRecords(records, codexKeys), nil
}

type CreateCodexAPIKeyInput struct {
	APIKey         string            `json:"apiKey"`
	BaseURL        string            `json:"baseUrl"`
	Prefix         string            `json:"prefix,omitempty"`
	ProxyURL       string            `json:"proxyUrl,omitempty"`
	Headers        map[string]string `json:"headers,omitempty"`
	ExcludedModels []string          `json:"excludedModels,omitempty"`
}

func (a *App) CreateCodexAPIKey(input CreateCodexAPIKeyInput) error {
	if strings.TrimSpace(input.APIKey) == "" {
		return errors.New("api key 不能为空")
	}
	if strings.TrimSpace(input.BaseURL) == "" {
		return errors.New("base url 不能为空")
	}

	current, err := loadStoredCodexAPIKeys()
	if err != nil {
		return err
	}

	newID := accountsdomain.CodexAPIKeyAssetID(input.APIKey, input.BaseURL, input.Prefix)
	items := make([]cliproxyapi.CodexAPIKeyInput, 0, len(current)+1)
	for _, existing := range current {
		if codexAPIKeyAssetIDFromInput(existing) == newID {
			return errors.New("账号已存在")
		}
		items = append(items, existing)
	}

	items = append(items, cliproxyapi.CodexAPIKeyInput{
		APIKey:         strings.TrimSpace(input.APIKey),
		BaseURL:        strings.TrimSpace(input.BaseURL),
		Prefix:         strings.TrimSpace(input.Prefix),
		ProxyURL:       strings.TrimSpace(input.ProxyURL),
		Headers:        input.Headers,
		ExcludedModels: input.ExcludedModels,
	})

	if err := persistCodexAPIKeySet(items); err != nil {
		return err
	}
	return a.syncStoredCodexAPIKeysToSidecar()
}

func (a *App) DeleteCodexAPIKey(id string) error {
	current, err := loadStoredCodexAPIKeys()
	if err != nil {
		return err
	}

	next := make([]cliproxyapi.CodexAPIKeyInput, 0, len(current))
	for _, existing := range current {
		if codexAPIKeyAssetIDFromInput(existing) == strings.TrimSpace(id) {
			continue
		}
		next = append(next, existing)
	}

	if err := persistCodexAPIKeySet(next); err != nil {
		return err
	}
	return a.syncStoredCodexAPIKeysToSidecar()
}

func (a *App) loadCodexAPIKeys() ([]cliproxyapi.CodexAPIKey, error) {
	stored, err := loadStoredCodexAPIKeys()
	if err != nil {
		return nil, err
	}

	sidecarItems, err := a.managementClient().ListCodexAPIKeys()
	if err != nil {
		if len(stored) == 0 {
			return nil, err
		}
		return codexAPIKeysFromInputs(stored), nil
	}

	merged, migrated := mergeCodexAPIKeyInputs(stored, sidecarItems)
	if migrated {
		if err := persistCodexAPIKeySet(merged); err != nil {
			return nil, err
		}
	}
	return codexAPIKeysFromInputs(merged), nil
}

func (a *App) syncStoredCodexAPIKeysToSidecar() error {
	items, err := loadStoredCodexAPIKeys()
	if err != nil {
		return err
	}
	return a.managementClient().PutCodexAPIKeys(items)
}

func codexAPIKeysFromInputs(items []cliproxyapi.CodexAPIKeyInput) []cliproxyapi.CodexAPIKey {
	keys := make([]cliproxyapi.CodexAPIKey, 0, len(items))
	for _, item := range items {
		keys = append(keys, cliproxyapi.CodexAPIKey{
			APIKey:         item.APIKey,
			Priority:       item.Priority,
			Prefix:         item.Prefix,
			BaseURL:        item.BaseURL,
			ProxyURL:       item.ProxyURL,
			Models:         item.Models,
			Headers:        item.Headers,
			ExcludedModels: item.ExcludedModels,
		})
	}
	return keys
}

func isReservedCodexAPIKeyAuthArtifact(name string) bool {
	normalized := strings.ToLower(strings.TrimSpace(name))
	return strings.Contains(normalized, "codex-api-keys/")
}
