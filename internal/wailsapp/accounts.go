package wailsapp

import (
	"encoding/json"
	"errors"
	"log"
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

func (a *App) hasManagementClient() bool {
	return a != nil && (a.managementAPI != nil || a.sidecar != nil || a.sidecarRequest != nil)
}

func (a *App) ListAccounts() ([]accountsdomain.AccountRecord, error) {
	if !a.hasManagementClient() {
		return nil, errors.New("account-store management client 未就绪")
	}
	accounts, err := a.managementClient().ListAccounts()
	if err != nil {
		return nil, err
	}
	return accountsdomain.BuildUnifiedAccountRecords(accounts), nil
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
	PlatformCookie string                  `json:"platformCookie,omitempty"`
	CurlVariables  map[string]string       `json:"curlVariables,omitempty"`
}

type UpdateAccountPriorityInput struct {
	ID       string `json:"id"`
	Priority int    `json:"priority,omitempty"`
}

func (a *App) SetAccountDisabled(id string, disabled bool) error {
	targetID := strings.TrimSpace(id)
	if isUnifiedAccountID(targetID) {
		_, err := a.managementClient().PatchAccountStatus(targetID, disabled)
		if err == nil {
			if disabled {
				if pruneErr := pruneRelayModelAccountCacheEntries(targetID); pruneErr != nil {
					log.Printf("prune relay model account cache for %s failed: %v", targetID, pruneErr)
				}
			}
			a.scheduleCodexModelCatalogRefreshAfterAccountMutation()
		}
		return err
	}
	return errors.New("不支持的账号类型")
}

type UpdateCodexAPIKeyLabelInput struct {
	ID    string `json:"id"`
	Label string `json:"label,omitempty"`
}

type UpdateCodexAPIKeyConfigInput struct {
	ID             string                  `json:"id"`
	APIKey         string                  `json:"apiKey"`
	BaseURL        string                  `json:"baseUrl"`
	FormatBaseURLs map[string]string       `json:"formatBaseUrls,omitempty"`
	Prefix         string                  `json:"prefix,omitempty"`
	ProxyURL       string                  `json:"proxyUrl,omitempty"`
	Models         []OpenAICompatibleModel `json:"models,omitempty"`
	QuotaCurl      string                  `json:"quotaCurl,omitempty"`
	QuotaEnabled   bool                    `json:"quotaEnabled,omitempty"`
	BillingCurl    string                  `json:"billingCurl,omitempty"`
	BillingEnabled bool                    `json:"billingEnabled,omitempty"`
	PlatformCookie string                  `json:"platformCookie,omitempty"`
	CurlVariables  map[string]string       `json:"curlVariables,omitempty"`
}

func (a *App) CreateCodexAPIKey(input CreateCodexAPIKeyInput) error {
	if strings.TrimSpace(input.APIKey) == "" {
		return errors.New("api key 不能为空")
	}
	if strings.TrimSpace(input.BaseURL) == "" {
		return errors.New("base url 不能为空")
	}
	if !a.hasManagementClient() {
		return errors.New("account-store management client 未就绪")
	}
	_, err := a.managementClient().CreateAccount(codexAPIKeyCreateAccountWrite(input))
	if err == nil {
		a.scheduleCodexModelCatalogRefreshAfterAccountMutation()
	}
	return err
}

func (a *App) UpdateCodexAPIKeyLabel(input UpdateCodexAPIKeyLabelInput) error {
	targetID := strings.TrimSpace(input.ID)
	if !isUnifiedAccountID(targetID) {
		return errors.New("不支持的账号类型")
	}
	if !a.hasManagementClient() {
		return errors.New("account-store management client 未就绪")
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
	if err == nil {
		a.scheduleCodexModelCatalogRefreshAfterAccountMutation()
	}
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
		return errors.New("不支持的账号类型")
	}
	if !a.hasManagementClient() {
		return errors.New("account-store management client 未就绪")
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
	if input.FormatBaseURLs != nil {
		write.CodexAPIKey.FormatBaseURLsJSON = mustJSONString(normalizeFormatBaseURLs(input.FormatBaseURLs))
	}
	write.CodexAPIKey.Prefix = nextPrefix
	write.CodexAPIKey.ProxyURL = strings.TrimSpace(input.ProxyURL)
	write.CodexAPIKey.ModelsJSON = mustJSONString(codexModelsFromOpenAICompatibleModels(input.Models))
	write.CodexAPIKey.QuotaCurl = strings.TrimSpace(input.QuotaCurl)
	write.CodexAPIKey.QuotaEnabled = input.QuotaEnabled && write.CodexAPIKey.QuotaCurl != ""
	write.CodexAPIKey.BillingCurl = strings.TrimSpace(input.BillingCurl)
	write.CodexAPIKey.BillingEnabled = input.BillingEnabled && write.CodexAPIKey.BillingCurl != ""
	write.CodexAPIKey.PlatformCookie = normalizePlatformCookie(input.PlatformCookie)
	write.CodexAPIKey.CurlVariablesJSON = mustJSONString(normalizeCurlVariables(input.CurlVariables, input.PlatformCookie))
	_, err = a.managementClient().PatchAccount(targetID, write)
	if err == nil {
		a.scheduleCodexModelCatalogRefreshAfterAccountMutation()
	}
	return err
}

func (a *App) DeleteCodexAPIKey(id string) error {
	targetID := strings.TrimSpace(id)
	if !isUnifiedAccountID(targetID) {
		return errors.New("不支持的账号类型")
	}
	if !a.hasManagementClient() {
		return errors.New("account-store management client 未就绪")
	}
	err := a.managementClient().DeleteAccount(targetID)
	if err == nil {
		if pruneErr := pruneRelayModelAccountCacheEntries(targetID); pruneErr != nil {
			log.Printf("prune relay model account cache for %s failed: %v", targetID, pruneErr)
		}
		a.scheduleCodexModelCatalogRefreshAfterAccountMutation()
	}
	return err
}

func (a *App) DeleteAccountsBatch(input DeleteAccountsBatchInput) (*DeleteAccountsBatchResult, error) {
	if !a.hasManagementClient() {
		return nil, errors.New("account-store management client 未就绪")
	}
	accountIDs := normalizeBatchDeleteAccountIDs(input.AccountIDs)
	if len(accountIDs) == 0 {
		return nil, errors.New("未选择账号")
	}
	result, err := a.managementClient().DeleteAccountsBatch(cliproxyapi.AccountBatchDeleteInput{AccountKeys: accountIDs})
	if err != nil {
		if !isSidecarNotFoundError(err) {
			return nil, err
		}
		result = deleteAccountsBatchWithSingleDeleteFallback(a.managementClient(), accountIDs)
	}
	for _, accountID := range result.DeletedAccountKeys {
		if pruneErr := pruneRelayModelAccountCacheEntries(accountID); pruneErr != nil {
			log.Printf("prune relay model account cache for %s failed: %v", accountID, pruneErr)
		}
	}
	if len(result.DeletedAccountKeys) > 0 {
		a.invalidateAuthFileMetadataCache()
		a.scheduleCodexModelCatalogRefreshAfterAccountMutation()
	}
	errors := make([]DeleteAccountsBatchError, 0, len(result.Errors))
	for _, item := range result.Errors {
		errors = append(errors, DeleteAccountsBatchError{
			AccountID: item.AccountKey,
			Error:     item.Error,
		})
	}
	return &DeleteAccountsBatchResult{
		DeletedAccountIDs: result.DeletedAccountKeys,
		Errors:            errors,
		Succeeded:         result.Succeeded,
		Failed:            result.Failed,
	}, nil
}

func deleteAccountsBatchWithSingleDeleteFallback(client *cliproxyapi.Client, accountIDs []string) *cliproxyapi.AccountBatchDeleteResult {
	result := &cliproxyapi.AccountBatchDeleteResult{
		DeletedAccountKeys: make([]string, 0, len(accountIDs)),
		Errors:             make([]cliproxyapi.AccountBatchDeleteError, 0),
	}
	for _, accountID := range accountIDs {
		if err := client.DeleteAccount(accountID); err != nil {
			result.Errors = append(result.Errors, cliproxyapi.AccountBatchDeleteError{
				AccountKey: accountID,
				Error:      err.Error(),
			})
			result.Failed++
			continue
		}
		result.DeletedAccountKeys = append(result.DeletedAccountKeys, accountID)
		result.Succeeded++
	}
	return result
}

func isSidecarNotFoundError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToUpper(strings.TrimSpace(err.Error()))
	return strings.Contains(message, "请求失败 (404)") || strings.Contains(message, "404 NOT FOUND")
}

func normalizeBatchDeleteAccountIDs(values []string) []string {
	ids := make([]string, 0, len(values))
	seen := map[string]struct{}{}
	for _, value := range values {
		id := strings.TrimSpace(value)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	return ids
}

func (a *App) UpdateCodexAPIKeyPriority(id string, priority int) error {
	targetID := strings.TrimSpace(id)
	if !isUnifiedAccountID(targetID) {
		return errors.New("不支持的账号类型")
	}
	if !a.hasManagementClient() {
		return errors.New("account-store management client 未就绪")
	}
	_, err := a.managementClient().PatchAccountPriority(targetID, priority)
	if err == nil {
		a.scheduleCodexModelCatalogRefreshAfterAccountMutation()
	}
	return err
}

func (a *App) SetCodexAPIKeyStatus(id string, disabled bool) error {
	targetID := strings.TrimSpace(id)
	if !isUnifiedAccountID(targetID) {
		return errors.New("不支持的账号类型")
	}
	if !a.hasManagementClient() {
		return errors.New("account-store management client 未就绪")
	}
	_, err := a.managementClient().PatchAccountStatus(targetID, disabled)
	if err == nil {
		if disabled {
			if pruneErr := pruneRelayModelAccountCacheEntries(targetID); pruneErr != nil {
				log.Printf("prune relay model account cache for %s failed: %v", targetID, pruneErr)
			}
		}
		a.scheduleCodexModelCatalogRefreshAfterAccountMutation()
	}
	return err
}

func (a *App) UpdateAccountPriority(input UpdateAccountPriorityInput) error {
	targetID := strings.TrimSpace(input.ID)
	if isUnifiedAccountID(targetID) {
		_, err := a.managementClient().PatchAccountPriority(targetID, input.Priority)
		if err == nil {
			a.scheduleCodexModelCatalogRefreshAfterAccountMutation()
		}
		return err
	}
	return errors.New("不支持的账号类型")
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
			PlatformCookie:     normalizePlatformCookie(input.PlatformCookie),
			CurlVariablesJSON:  mustJSONString(normalizeCurlVariables(input.CurlVariables, input.PlatformCookie)),
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

func normalizeCurlVariables(values map[string]string, platformCookie string) map[string]string {
	out := make(map[string]string, len(values)+1)
	for key, value := range values {
		trimmedKey := strings.TrimSpace(key)
		if trimmedKey == "" {
			continue
		}
		out[trimmedKey] = strings.TrimSpace(value)
	}
	if cookie := normalizePlatformCookie(platformCookie); cookie != "" {
		out["platformCookie"] = cookie
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func normalizePlatformCookie(value string) string {
	return strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(value), "Cookie:"))
}
