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

type AccountInventory struct {
	Accounts          []accountsdomain.AccountRecord `json:"accounts"`
	InventoryRevision string                         `json:"inventoryRevision"`
}

func (a *App) ListAccountInventory() (*AccountInventory, error) {
	if !a.hasManagementClient() {
		return nil, errors.New("account-store management client 未就绪")
	}
	inventory, err := a.managementClient().ListAccountsInventory()
	if err != nil {
		return nil, err
	}
	return &AccountInventory{
		Accounts:          sanitizeLocalAccountSnapshotRecords(accountsdomain.BuildUnifiedAccountRecords(inventory.Accounts)),
		InventoryRevision: inventory.InventoryRevision,
	}, nil
}

func (a *App) GetAccountDetail(id string) (*accountsdomain.AccountRecord, error) {
	targetID := strings.TrimSpace(id)
	if !isUnifiedAccountID(targetID) {
		return nil, errors.New("不支持的账号类型")
	}
	if !a.hasManagementClient() {
		return nil, errors.New("account-store management client 未就绪")
	}
	account, err := a.managementClient().GetAccount(targetID)
	if err != nil {
		return nil, err
	}
	record := accountsdomain.BuildUnifiedAccountRecord(*account)
	return &record, nil
}

func (a *App) ListCodexAccountInventory() ([]accountsdomain.AccountRecord, error) {
	accounts, err := a.ListAccounts()
	if err != nil {
		return nil, err
	}
	inventory := make([]accountsdomain.AccountRecord, 0, len(accounts))
	for _, account := range accounts {
		if isCodexAccountInventoryRecord(account) {
			inventory = append(inventory, account)
		}
	}
	return inventory, nil
}

func isCodexAccountInventoryRecord(account accountsdomain.AccountRecord) bool {
	switch account.AccountKind {
	case accountsdomain.AccountKindCodexAPIKey, accountsdomain.AccountKindOpenAICompatible:
		return true
	case accountsdomain.AccountKindAuthFile:
		return strings.EqualFold(strings.TrimSpace(account.Provider), "codex")
	default:
		return false
	}
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
	ID               string `json:"id"`
	Priority         int    `json:"priority,omitempty"`
	ExpectedRevision *int   `json:"expectedRevision,omitempty"`
}

func (a *App) SetAccountDisabled(id string, disabled bool) (*accountsdomain.AccountRecord, error) {
	targetID := strings.TrimSpace(id)
	if isUnifiedAccountID(targetID) {
		account, err := a.managementClient().PatchAccountStatus(targetID, disabled)
		if err == nil {
			if syncErr := clearManualDisabledRuntimeState(targetID); syncErr != nil {
				return nil, syncErr
			}
			if disabled {
				if pruneErr := pruneRelayModelAccountCacheEntries(targetID); pruneErr != nil {
					log.Printf("prune relay model account cache for %s failed: %v", targetID, pruneErr)
				}
			}
			a.scheduleCodexModelCatalogRefreshAfterAccountMutation()
		}
		return accountRecordFromUnifiedMutation(account, err)
	}
	return nil, errors.New("不支持的账号类型")
}

type UpdateCodexAPIKeyLabelInput struct {
	ID               string `json:"id"`
	Label            string `json:"label,omitempty"`
	ExpectedRevision *int   `json:"expectedRevision,omitempty"`
}

type UpdateCodexAPIKeyConfigInput struct {
	ID               string                  `json:"id"`
	ExpectedRevision *int                    `json:"expectedRevision,omitempty"`
	Label            *string                 `json:"label,omitempty"`
	APIKey           string                  `json:"apiKey"`
	BaseURL          string                  `json:"baseUrl"`
	FormatBaseURLs   map[string]string       `json:"formatBaseUrls,omitempty"`
	Prefix           string                  `json:"prefix,omitempty"`
	ProxyURL         string                  `json:"proxyUrl,omitempty"`
	Models           []OpenAICompatibleModel `json:"models,omitempty"`
	QuotaCurl        string                  `json:"quotaCurl,omitempty"`
	QuotaEnabled     bool                    `json:"quotaEnabled,omitempty"`
	BillingCurl      string                  `json:"billingCurl,omitempty"`
	BillingEnabled   bool                    `json:"billingEnabled,omitempty"`
	PlatformCookie   string                  `json:"platformCookie,omitempty"`
	CurlVariables    map[string]string       `json:"curlVariables,omitempty"`
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

func (a *App) UpdateCodexAPIKeyLabel(input UpdateCodexAPIKeyLabelInput) (*accountsdomain.AccountRecord, error) {
	targetID := strings.TrimSpace(input.ID)
	if !isUnifiedAccountID(targetID) {
		return nil, errors.New("不支持的账号类型")
	}
	if !a.hasManagementClient() {
		return nil, errors.New("account-store management client 未就绪")
	}
	account, err := a.managementClient().GetAccount(targetID)
	if err != nil {
		return nil, err
	}
	if account == nil || account.Kind != cliproxyapi.AccountKindCodexAPIKey || account.CodexAPIKey == nil {
		return nil, errors.New("账号不存在")
	}
	write := accountWriteFromUnified(*account)
	write.ExpectedRevision = input.ExpectedRevision
	write.Title = strings.TrimSpace(input.Label)
	updated, err := a.managementClient().PatchAccount(targetID, write)
	if err == nil {
		a.scheduleCodexModelCatalogRefreshAfterAccountMutation()
	}
	return accountRecordFromUnifiedMutation(updated, err)
}

func (a *App) UpdateCodexAPIKeyConfig(input UpdateCodexAPIKeyConfigInput) (*accountsdomain.AccountRecord, error) {
	targetID := strings.TrimSpace(input.ID)
	nextAPIKey := strings.TrimSpace(input.APIKey)
	nextBaseURL := accountsdomain.NormalizeBaseURL(input.BaseURL)
	nextPrefix := accountsdomain.NormalizePrefix(input.Prefix)
	if nextAPIKey == "" {
		return nil, errors.New("api key 不能为空")
	}
	if nextBaseURL == "" {
		return nil, errors.New("base url 不能为空")
	}
	if !isUnifiedAccountID(targetID) {
		return nil, errors.New("不支持的账号类型")
	}
	if !a.hasManagementClient() {
		return nil, errors.New("account-store management client 未就绪")
	}
	account, err := a.managementClient().GetAccount(targetID)
	if err != nil {
		return nil, err
	}
	if account == nil || account.Kind != cliproxyapi.AccountKindCodexAPIKey || account.CodexAPIKey == nil {
		return nil, errors.New("账号不存在")
	}

	write := accountWriteFromUnified(*account)
	write.ExpectedRevision = input.ExpectedRevision
	if input.Label != nil {
		write.Title = strings.TrimSpace(*input.Label)
	}
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
	updated, err := a.managementClient().PatchAccount(targetID, write)
	if err == nil {
		a.scheduleCodexModelCatalogRefreshAfterAccountMutation()
	}
	return accountRecordFromUnifiedMutation(updated, err)
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

func (a *App) SetAccountsDisabledBatch(input SetAccountsDisabledBatchInput) (*SetAccountsDisabledBatchResult, error) {
	if !a.hasManagementClient() {
		return nil, errors.New("account-store management client 未就绪")
	}
	accountIDs := normalizeBatchDeleteAccountIDs(input.AccountIDs)
	if len(accountIDs) == 0 {
		return nil, errors.New("未选择账号")
	}

	result, err := a.managementClient().PatchAccountsStatusBatch(cliproxyapi.AccountBatchStatusInput{
		AccountKeys: accountIDs,
		Disabled:    input.Disabled,
	})
	if err != nil {
		if !isSidecarNotFoundError(err) {
			return nil, err
		}
		result = setAccountsDisabledBatchWithSingleStatusFallback(a.managementClient(), accountIDs, input.Disabled)
	}

	for _, accountID := range result.UpdatedAccountKeys {
		if syncErr := clearManualDisabledRuntimeState(accountID); syncErr != nil {
			return nil, syncErr
		}
		if input.Disabled {
			if pruneErr := pruneRelayModelAccountCacheEntries(accountID); pruneErr != nil {
				log.Printf("prune relay model account cache for %s failed: %v", accountID, pruneErr)
			}
		}
	}
	if len(result.UpdatedAccountKeys) > 0 {
		a.scheduleCodexModelCatalogRefreshAfterAccountMutation()
	}

	errors := make([]SetAccountsDisabledBatchError, 0, len(result.Errors))
	for _, item := range result.Errors {
		errors = append(errors, SetAccountsDisabledBatchError{
			AccountID: item.AccountKey,
			Error:     item.Error,
		})
	}
	return &SetAccountsDisabledBatchResult{
		UpdatedAccountIDs: result.UpdatedAccountKeys,
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

func setAccountsDisabledBatchWithSingleStatusFallback(client *cliproxyapi.Client, accountIDs []string, disabled bool) *cliproxyapi.AccountBatchStatusResult {
	result := &cliproxyapi.AccountBatchStatusResult{
		UpdatedAccountKeys: make([]string, 0, len(accountIDs)),
		Errors:             make([]cliproxyapi.AccountBatchStatusError, 0),
	}
	for _, accountID := range accountIDs {
		if _, err := client.PatchAccountStatus(accountID, disabled); err != nil {
			result.Errors = append(result.Errors, cliproxyapi.AccountBatchStatusError{
				AccountKey: accountID,
				Error:      err.Error(),
			})
			result.Failed++
			continue
		}
		result.UpdatedAccountKeys = append(result.UpdatedAccountKeys, accountID)
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

func (a *App) UpdateCodexAPIKeyPriority(id string, priority int, expectedRevision *int) (*accountsdomain.AccountRecord, error) {
	targetID := strings.TrimSpace(id)
	if !isUnifiedAccountID(targetID) {
		return nil, errors.New("不支持的账号类型")
	}
	if !a.hasManagementClient() {
		return nil, errors.New("account-store management client 未就绪")
	}
	account, err := a.managementClient().PatchAccountPriorityIfRevision(targetID, priority, expectedRevision)
	if err == nil {
		a.scheduleCodexModelCatalogRefreshAfterAccountMutation()
	}
	return accountRecordFromUnifiedMutation(account, err)
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
		if syncErr := clearManualDisabledRuntimeState(targetID); syncErr != nil {
			return syncErr
		}
		if disabled {
			if pruneErr := pruneRelayModelAccountCacheEntries(targetID); pruneErr != nil {
				log.Printf("prune relay model account cache for %s failed: %v", targetID, pruneErr)
			}
		}
		a.scheduleCodexModelCatalogRefreshAfterAccountMutation()
	}
	return err
}

func (a *App) UpdateAccountPriority(input UpdateAccountPriorityInput) (*accountsdomain.AccountRecord, error) {
	targetID := strings.TrimSpace(input.ID)
	if isUnifiedAccountID(targetID) {
		account, err := a.managementClient().PatchAccountPriorityIfRevision(targetID, input.Priority, input.ExpectedRevision)
		if err == nil {
			a.scheduleCodexModelCatalogRefreshAfterAccountMutation()
		}
		return accountRecordFromUnifiedMutation(account, err)
	}
	return nil, errors.New("不支持的账号类型")
}

func accountRecordFromUnifiedMutation(account *cliproxyapi.UnifiedAccount, err error) (*accountsdomain.AccountRecord, error) {
	if err != nil {
		return nil, err
	}
	if account == nil {
		return nil, errors.New("账号 mutation 未返回账号")
	}
	record := accountsdomain.BuildUnifiedAccountRecord(*account)
	return &record, nil
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
