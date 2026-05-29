package wailsapp

import (
	"encoding/json"
	"errors"
	"strings"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
	"github.com/linhay/gettokens/internal/cliproxyapi"
)

func (a *App) managementClient() *cliproxyapi.Client {
	if a.managementAPI != nil {
		return a.managementAPI()
	}
	return cliproxyapi.New(a.SidecarRequest)
}

func (a *App) ListAccounts() ([]accountsdomain.AccountRecord, error) {
	accounts, err := a.managementClient().ListAccounts()
	if err == nil {
		return accountsdomain.BuildUnifiedAccountRecords(accounts), nil
	}
	return a.listLegacyAccounts()
}

func (a *App) listLegacyAccounts() ([]accountsdomain.AccountRecord, error) {
	var records []accountsdomain.AuthFileRecord

	authFiles, err := a.ListAuthFiles()
	if err != nil {
		records = []accountsdomain.AuthFileRecord{}
	} else {
		records = make([]accountsdomain.AuthFileRecord, 0, len(authFiles.Files))
		for _, file := range authFiles.Files {
			if isReservedCodexAPIKeyAuthArtifact(file.Name) {
				continue
			}
			records = append(records, accountsdomain.AuthFileRecord{
				Name:          file.Name,
				Type:          file.Type,
				Provider:      file.Provider,
				Priority:      file.Priority,
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
	}

	codexKeys, err := a.loadCodexAPIKeys()
	if err != nil {
		codexKeys = []cliproxyapi.CodexAPIKey{}
	}

	accountRecords := accountsdomain.BuildAccountRecords(records, codexKeys)

	openaiProviders, err := a.managementClient().ListOpenAICompatibleProviders()
	if err == nil {
		for _, provider := range openaiProviders {
			accountRecords = append(accountRecords, accountsdomain.BuildOpenAICompatibleProviderAccountRecord(provider))
		}
	}

	return accountRecords, nil
}

type CreateCodexAPIKeyInput struct {
	APIKey         string                  `json:"apiKey"`
	Label          string                  `json:"label,omitempty"`
	BaseURL        string                  `json:"baseUrl"`
	FormatBaseURLs map[string]string       `json:"formatBaseUrls,omitempty"`
	Priority       int                     `json:"priority,omitempty"`
	Prefix         string                  `json:"prefix,omitempty"`
	ProxyURL       string                  `json:"proxyUrl,omitempty"`
	Headers        map[string]string       `json:"headers,omitempty"`
	Models         []OpenAICompatibleModel `json:"models,omitempty"`
	ExcludedModels []string                `json:"excludedModels,omitempty"`
	QuotaCurl      string                  `json:"quotaCurl,omitempty"`
	QuotaEnabled   bool                    `json:"quotaEnabled,omitempty"`
	BillingCurl    string                  `json:"billingCurl,omitempty"`
	BillingEnabled bool                    `json:"billingEnabled,omitempty"`
}

type UpdateAccountPriorityInput struct {
	ID       string `json:"id"`
	Priority int    `json:"priority,omitempty"`
}

func (a *App) SetAccountDisabled(id string, disabled bool) error {
	targetID := strings.TrimSpace(id)
	if isUnifiedAccountID(targetID) {
		_, err := a.managementClient().PatchAccountStatus(targetID, disabled)
		return err
	}
	switch {
	case strings.HasPrefix(targetID, "auth-file:"):
		return a.SetAuthFileStatus(strings.TrimPrefix(targetID, "auth-file:"), disabled)
	case strings.HasPrefix(targetID, "codex-api-key:"):
		return a.SetCodexAPIKeyStatus(targetID, disabled)
	case strings.HasPrefix(targetID, "openai-compatible:"):
		return a.SetOpenAICompatibleProviderStatus(strings.TrimPrefix(targetID, "openai-compatible:"), disabled)
	default:
		return errors.New("不支持的账号类型")
	}
}

type UpdateCodexAPIKeyLabelInput struct {
	ID    string `json:"id"`
	Label string `json:"label,omitempty"`
}

type UpdateCodexAPIKeyConfigInput struct {
	ID             string                  `json:"id"`
	APIKey         string                  `json:"apiKey"`
	BaseURL        string                  `json:"baseUrl"`
	Prefix         string                  `json:"prefix,omitempty"`
	ProxyURL       string                  `json:"proxyUrl,omitempty"`
	Models         []OpenAICompatibleModel `json:"models,omitempty"`
	QuotaCurl      string                  `json:"quotaCurl,omitempty"`
	QuotaEnabled   bool                    `json:"quotaEnabled,omitempty"`
	BillingCurl    string                  `json:"billingCurl,omitempty"`
	BillingEnabled bool                    `json:"billingEnabled,omitempty"`
}

func (a *App) CreateCodexAPIKey(input CreateCodexAPIKeyInput) error {
	if strings.TrimSpace(input.APIKey) == "" {
		return errors.New("api key 不能为空")
	}
	if strings.TrimSpace(input.BaseURL) == "" {
		return errors.New("base url 不能为空")
	}
	if _, err := a.managementClient().CreateAccount(codexAPIKeyCreateAccountWrite(input)); err == nil {
		return nil
	}

	return a.createLegacyCodexAPIKey(input)
}

func (a *App) UpdateCodexAPIKeyLabel(input UpdateCodexAPIKeyLabelInput) error {
	targetID := strings.TrimSpace(input.ID)
	if !isUnifiedAccountID(targetID) {
		return a.updateLegacyCodexAPIKeyLabel(input)
	}
	account, err := a.managementClient().GetAccount(targetID)
	if err != nil {
		return err
	}
	if account == nil || account.Kind != cliproxyapi.AccountKindCodexAPIKey || account.CodexAPIKey == nil {
		return errors.New("账号不存在")
	}
	write := accountWriteFromUnified(*account)
	write.Title = strings.TrimSpace(input.Label)
	_, err = a.managementClient().PatchAccount(targetID, write)
	return err
}

func (a *App) UpdateCodexAPIKeyConfig(input UpdateCodexAPIKeyConfigInput) error {
	targetID := strings.TrimSpace(input.ID)
	nextAPIKey := strings.TrimSpace(input.APIKey)
	nextBaseURL := accountsdomain.NormalizeBaseURL(input.BaseURL)
	nextPrefix := accountsdomain.NormalizePrefix(input.Prefix)
	if nextAPIKey == "" {
		return errors.New("api key 不能为空")
	}
	if nextBaseURL == "" {
		return errors.New("base url 不能为空")
	}
	if !isUnifiedAccountID(targetID) {
		return a.updateLegacyCodexAPIKeyConfig(input)
	}
	account, err := a.managementClient().GetAccount(targetID)
	if err != nil {
		return err
	}
	if account == nil || account.Kind != cliproxyapi.AccountKindCodexAPIKey || account.CodexAPIKey == nil {
		return errors.New("账号不存在")
	}

	write := accountWriteFromUnified(*account)
	write.CodexAPIKey.APIKey = nextAPIKey
	write.CodexAPIKey.BaseURL = nextBaseURL
	write.CodexAPIKey.Prefix = nextPrefix
	write.CodexAPIKey.ProxyURL = strings.TrimSpace(input.ProxyURL)
	write.CodexAPIKey.ModelsJSON = mustJSONString(codexModelsFromOpenAICompatibleModels(input.Models))
	write.CodexAPIKey.QuotaCurl = strings.TrimSpace(input.QuotaCurl)
	write.CodexAPIKey.QuotaEnabled = input.QuotaEnabled && write.CodexAPIKey.QuotaCurl != ""
	write.CodexAPIKey.BillingCurl = strings.TrimSpace(input.BillingCurl)
	write.CodexAPIKey.BillingEnabled = input.BillingEnabled && write.CodexAPIKey.BillingCurl != ""
	_, err = a.managementClient().PatchAccount(targetID, write)
	return err
}

func (a *App) DeleteCodexAPIKey(id string) error {
	targetID := strings.TrimSpace(id)
	if !isUnifiedAccountID(targetID) {
		return a.deleteLegacyCodexAPIKey(id)
	}
	return a.managementClient().DeleteAccount(targetID)
}

func (a *App) UpdateCodexAPIKeyPriority(id string, priority int) error {
	targetID := strings.TrimSpace(id)
	if !isUnifiedAccountID(targetID) {
		return a.updateLegacyCodexAPIKeyPriority(id, priority)
	}
	_, err := a.managementClient().PatchAccountPriority(targetID, priority)
	return err
}

func (a *App) SetCodexAPIKeyStatus(id string, disabled bool) error {
	targetID := strings.TrimSpace(id)
	if !isUnifiedAccountID(targetID) {
		return a.setLegacyCodexAPIKeyStatus(id, disabled)
	}
	_, err := a.managementClient().PatchAccountStatus(targetID, disabled)
	return err
}

func (a *App) UpdateAccountPriority(input UpdateAccountPriorityInput) error {
	targetID := strings.TrimSpace(input.ID)
	if isUnifiedAccountID(targetID) {
		_, err := a.managementClient().PatchAccountPriority(targetID, input.Priority)
		return err
	}
	switch {
	case strings.HasPrefix(targetID, "auth-file:"):
		return a.updateAuthFilePriority(strings.TrimPrefix(targetID, "auth-file:"), input.Priority)
	case strings.HasPrefix(targetID, "codex-api-key:"):
		return a.UpdateCodexAPIKeyPriority(targetID, input.Priority)
	case strings.HasPrefix(targetID, "openai-compatible:"):
		return a.UpdateOpenAICompatibleProviderPriority(strings.TrimPrefix(targetID, "openai-compatible:"), input.Priority)
	default:
		return errors.New("不支持的账号类型")
	}
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
	return a.managementClient().PutCodexAPIKeys(sidecarCodexAPIKeyInputs(items))
}

func codexAPIKeysFromInputs(items []cliproxyapi.CodexAPIKeyInput) []cliproxyapi.CodexAPIKey {
	keys := make([]cliproxyapi.CodexAPIKey, 0, len(items))
	for _, item := range items {
		keys = append(keys, cliproxyapi.CodexAPIKey{
			LocalID:        item.LocalID,
			APIKey:         item.APIKey,
			Label:          item.Label,
			Priority:       item.Priority,
			Disabled:       item.Disabled,
			Prefix:         item.Prefix,
			BaseURL:        item.BaseURL,
			FormatBaseURLs: item.FormatBaseURLs,
			Websockets:     item.Websockets,
			ProxyURL:       item.ProxyURL,
			Models:         item.Models,
			Headers:        item.Headers,
			ExcludedModels: item.ExcludedModels,
			QuotaCurl:      item.QuotaCurl,
			QuotaEnabled:   item.QuotaEnabled,
			BillingCurl:    item.BillingCurl,
			BillingEnabled: item.BillingEnabled,
		})
	}
	return keys
}

func sidecarCodexAPIKeyInputs(items []cliproxyapi.CodexAPIKeyInput) []cliproxyapi.CodexAPIKeyInput {
	out := make([]cliproxyapi.CodexAPIKeyInput, 0, len(items))
	for _, item := range items {
		item.QuotaCurl = ""
		item.QuotaEnabled = false
		item.BillingCurl = ""
		item.BillingEnabled = false
		item.Websockets = true
		out = append(out, item)
	}
	return out
}

func (a *App) createLegacyCodexAPIKey(input CreateCodexAPIKeyInput) error {
	current, err := loadStoredCodexAPIKeys()
	if err != nil {
		return err
	}

	items := make([]cliproxyapi.CodexAPIKeyInput, 0, len(current)+1)
	for _, existing := range current {
		items = append(items, existing)
	}

	items = append(items, cliproxyapi.CodexAPIKeyInput{
		APIKey:         strings.TrimSpace(input.APIKey),
		Label:          strings.TrimSpace(input.Label),
		BaseURL:        strings.TrimSpace(input.BaseURL),
		FormatBaseURLs: input.FormatBaseURLs,
		Priority:       input.Priority,
		Prefix:         strings.TrimSpace(input.Prefix),
		ProxyURL:       strings.TrimSpace(input.ProxyURL),
		Headers:        input.Headers,
		Models:         codexModelsFromOpenAICompatibleModels(input.Models),
		ExcludedModels: input.ExcludedModels,
		QuotaCurl:      strings.TrimSpace(input.QuotaCurl),
		QuotaEnabled:   input.QuotaEnabled && strings.TrimSpace(input.QuotaCurl) != "",
		BillingCurl:    strings.TrimSpace(input.BillingCurl),
		BillingEnabled: input.BillingEnabled && strings.TrimSpace(input.BillingCurl) != "",
	})

	if err := persistCodexAPIKeySet(items); err != nil {
		return err
	}
	_ = a.syncStoredCodexAPIKeysToSidecar()
	return nil
}

func (a *App) updateLegacyCodexAPIKeyLabel(input UpdateCodexAPIKeyLabelInput) error {
	current, err := loadStoredCodexAPIKeys()
	if err != nil {
		return err
	}
	if err := rememberCodexAPIKeyAttributionIdentities(current); err != nil {
		return err
	}

	targetID := strings.TrimSpace(input.ID)
	found := false
	next := make([]cliproxyapi.CodexAPIKeyInput, 0, len(current))
	for _, existing := range current {
		if codexAPIKeyInputMatchesID(existing, targetID) {
			existing.Label = strings.TrimSpace(input.Label)
			found = true
		}
		next = append(next, existing)
	}

	if !found {
		return errors.New("账号不存在")
	}

	return persistCodexAPIKeySet(next)
}

func (a *App) updateLegacyCodexAPIKeyConfig(input UpdateCodexAPIKeyConfigInput) error {
	current, err := loadStoredCodexAPIKeys()
	if err != nil {
		return err
	}
	if err := rememberCodexAPIKeyAttributionIdentities(current); err != nil {
		return err
	}

	targetID := strings.TrimSpace(input.ID)
	nextAPIKey := strings.TrimSpace(input.APIKey)
	nextBaseURL := accountsdomain.NormalizeBaseURL(input.BaseURL)
	nextPrefix := accountsdomain.NormalizePrefix(input.Prefix)
	if nextAPIKey == "" {
		return errors.New("api key 不能为空")
	}
	if nextBaseURL == "" {
		return errors.New("base url 不能为空")
	}

	found := false
	next := make([]cliproxyapi.CodexAPIKeyInput, 0, len(current))
	for _, existing := range current {
		if codexAPIKeyInputMatchesID(existing, targetID) {
			existing.APIKey = nextAPIKey
			existing.BaseURL = nextBaseURL
			existing.Prefix = nextPrefix
			existing.ProxyURL = strings.TrimSpace(input.ProxyURL)
			existing.Models = codexModelsFromOpenAICompatibleModels(input.Models)
			existing.QuotaCurl = strings.TrimSpace(input.QuotaCurl)
			existing.QuotaEnabled = input.QuotaEnabled && existing.QuotaCurl != ""
			existing.BillingCurl = strings.TrimSpace(input.BillingCurl)
			existing.BillingEnabled = input.BillingEnabled && existing.BillingCurl != ""
			found = true
		}
		next = append(next, existing)
	}

	if !found {
		return errors.New("账号不存在")
	}

	if err := persistCodexAPIKeySet(next); err != nil {
		return err
	}
	return a.syncStoredCodexAPIKeysToSidecar()
}

func (a *App) deleteLegacyCodexAPIKey(id string) error {
	current, err := loadStoredCodexAPIKeys()
	if err != nil {
		return err
	}

	next := make([]cliproxyapi.CodexAPIKeyInput, 0, len(current))
	for _, existing := range current {
		if codexAPIKeyInputMatchesID(existing, id) {
			continue
		}
		next = append(next, existing)
	}

	if err := persistCodexAPIKeySet(next); err != nil {
		return err
	}
	return a.syncStoredCodexAPIKeysToSidecar()
}

func (a *App) updateLegacyCodexAPIKeyPriority(id string, priority int) error {
	current, err := loadStoredCodexAPIKeys()
	if err != nil {
		return err
	}

	targetID := strings.TrimSpace(id)
	found := false
	next := make([]cliproxyapi.CodexAPIKeyInput, 0, len(current))
	for _, existing := range current {
		if codexAPIKeyInputMatchesID(existing, targetID) {
			existing.Priority = priority
			found = true
		}
		next = append(next, existing)
	}

	if !found {
		return errors.New("账号不存在")
	}

	if err := persistCodexAPIKeySet(next); err != nil {
		return err
	}
	return a.syncStoredCodexAPIKeysToSidecar()
}

func (a *App) setLegacyCodexAPIKeyStatus(id string, disabled bool) error {
	current, err := loadStoredCodexAPIKeys()
	if err != nil {
		return err
	}

	targetID := strings.TrimSpace(id)
	found := false
	next := make([]cliproxyapi.CodexAPIKeyInput, 0, len(current))
	for _, existing := range current {
		if codexAPIKeyInputMatchesID(existing, targetID) {
			existing.Disabled = disabled
			found = true
		}
		next = append(next, existing)
	}

	if !found {
		return errors.New("账号不存在")
	}

	if err := persistCodexAPIKeySet(next); err != nil {
		return err
	}
	return a.syncStoredCodexAPIKeysToSidecar()
}

func isUnifiedAccountID(id string) bool {
	return strings.HasPrefix(strings.TrimSpace(id), "acct_")
}

func codexAPIKeyCreateAccountWrite(input CreateCodexAPIKeyInput) cliproxyapi.AccountWriteRequest {
	return cliproxyapi.AccountWriteRequest{
		Kind:     cliproxyapi.AccountKindCodexAPIKey,
		Title:    strings.TrimSpace(input.Label),
		Provider: "codex",
		Priority: input.Priority,
		CodexAPIKey: &cliproxyapi.CodexAPIKeyAccountCredential{
			APIKey:             strings.TrimSpace(input.APIKey),
			BaseURL:            accountsdomain.NormalizeBaseURL(input.BaseURL),
			Prefix:             accountsdomain.NormalizePrefix(input.Prefix),
			ProxyURL:           strings.TrimSpace(input.ProxyURL),
			Websockets:         true,
			QuotaCurl:          strings.TrimSpace(input.QuotaCurl),
			QuotaEnabled:       input.QuotaEnabled && strings.TrimSpace(input.QuotaCurl) != "",
			BillingCurl:        strings.TrimSpace(input.BillingCurl),
			BillingEnabled:     input.BillingEnabled && strings.TrimSpace(input.BillingCurl) != "",
			FormatBaseURLsJSON: mustJSONString(input.FormatBaseURLs),
			HeadersJSON:        mustJSONString(input.Headers),
			ModelsJSON:         mustJSONString(codexModelsFromOpenAICompatibleModels(input.Models)),
			ExcludedModelsJSON: mustJSONString(input.ExcludedModels),
		},
	}
}

func accountWriteFromUnified(account cliproxyapi.UnifiedAccount) cliproxyapi.AccountWriteRequest {
	return cliproxyapi.AccountWriteRequest{
		Kind:             account.Kind,
		Title:            strings.TrimSpace(account.Title),
		Provider:         strings.TrimSpace(account.Provider),
		Priority:         account.Priority,
		Disabled:         account.Disabled,
		AuthFile:         cloneAuthFileAccountCredential(account.AuthFile),
		CodexAPIKey:      cloneCodexAPIKeyAccountCredential(account.CodexAPIKey),
		OpenAICompatible: cloneOpenAICompatibleAccountCredential(account.OpenAICompatible),
	}
}

func cloneAuthFileAccountCredential(source *cliproxyapi.AuthFileAccountCredential) *cliproxyapi.AuthFileAccountCredential {
	if source == nil {
		return nil
	}
	clone := *source
	return &clone
}

func cloneCodexAPIKeyAccountCredential(source *cliproxyapi.CodexAPIKeyAccountCredential) *cliproxyapi.CodexAPIKeyAccountCredential {
	if source == nil {
		return nil
	}
	clone := *source
	return &clone
}

func cloneOpenAICompatibleAccountCredential(source *cliproxyapi.OpenAICompatibleAccountCredential) *cliproxyapi.OpenAICompatibleAccountCredential {
	if source == nil {
		return nil
	}
	clone := *source
	return &clone
}

func mustJSONString(value any) string {
	if value == nil {
		return ""
	}
	payload, err := json.Marshal(value)
	if err != nil {
		return ""
	}
	text := strings.TrimSpace(string(payload))
	if text == "null" {
		return ""
	}
	return text
}

func codexModelsFromOpenAICompatibleModels(items []OpenAICompatibleModel) []cliproxyapi.CodexModel {
	models := normalizeProviderModels(items)
	out := make([]cliproxyapi.CodexModel, 0, len(models))
	for _, model := range models {
		out = append(out, cliproxyapi.CodexModel{
			Name:  model.Name,
			Alias: model.Alias,
		})
	}
	return out
}

func isReservedCodexAPIKeyAuthArtifact(name string) bool {
	normalized := strings.ToLower(strings.TrimSpace(name))
	return strings.Contains(normalized, "codex-api-keys/")
}
