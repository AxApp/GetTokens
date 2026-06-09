package cliproxyapi

import (
	"bytes"
	"encoding/json"
	"io"
	"net/url"
	"strconv"
	"strings"
)

type OAuthStartResponse struct {
	Status string `json:"status,omitempty"`
	URL    string `json:"url"`
	State  string `json:"state,omitempty"`
}

type OAuthStatusResponse struct {
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
}

type RequestFunc func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error)

type Client struct {
	request RequestFunc
}

func New(request RequestFunc) *Client {
	return &Client{request: request}
}

func (c *Client) ListAPIKeys() ([]string, error) {
	body, _, err := c.request("GET", "/v0/management/api-keys", nil, nil, "")
	if err != nil {
		return nil, err
	}

	var response struct {
		Items []string `json:"api-keys"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Items == nil {
		return []string{}, nil
	}
	return response.Items, nil
}

func (c *Client) PutAPIKeys(items []string) error {
	if items == nil {
		items = []string{}
	}

	payload, err := json.Marshal(items)
	if err != nil {
		return err
	}

	_, _, err = c.request("PUT", "/v0/management/api-keys", nil, bytes.NewReader(payload), "application/json")
	return err
}

func (c *Client) ListOAuthModelAliases() (map[string][]OAuthModelAlias, error) {
	body, _, err := c.request("GET", "/v0/management/oauth-model-alias", nil, nil, "")
	if err != nil {
		return nil, err
	}

	var response OAuthModelAliasesResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Items == nil {
		return map[string][]OAuthModelAlias{}, nil
	}
	return response.Items, nil
}

func (c *Client) PutOAuthModelAliases(items map[string][]OAuthModelAlias) error {
	if items == nil {
		items = map[string][]OAuthModelAlias{}
	}

	payload, err := json.Marshal(items)
	if err != nil {
		return err
	}

	_, _, err = c.request("PUT", "/v0/management/oauth-model-alias", nil, bytes.NewReader(payload), "application/json")
	return err
}

func (c *Client) ListAccounts() ([]UnifiedAccount, error) {
	body, _, err := c.request("GET", "/v0/management/accounts", nil, nil, "")
	if err != nil {
		return nil, err
	}

	var response UnifiedAccountsResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Items == nil {
		return []UnifiedAccount{}, nil
	}
	return response.Items, nil
}

func (c *Client) GetAccount(accountKey string) (*UnifiedAccount, error) {
	body, _, err := c.request("GET", "/v0/management/accounts/"+url.PathEscape(accountKey), nil, nil, "")
	if err != nil {
		return nil, err
	}

	var account UnifiedAccount
	if err := json.Unmarshal(body, &account); err != nil {
		return nil, err
	}
	return &account, nil
}

func (c *Client) CreateAccount(input AccountWriteRequest) (*UnifiedAccount, error) {
	payload, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	body, _, err := c.request("POST", "/v0/management/accounts", nil, bytes.NewReader(payload), "application/json")
	if err != nil {
		return nil, err
	}

	var account UnifiedAccount
	if err := json.Unmarshal(body, &account); err != nil {
		return nil, err
	}
	return &account, nil
}

func (c *Client) PatchAccount(accountKey string, input AccountWriteRequest) (*UnifiedAccount, error) {
	payload, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	body, _, err := c.request("PATCH", "/v0/management/accounts/"+url.PathEscape(accountKey), nil, bytes.NewReader(payload), "application/json")
	if err != nil {
		return nil, err
	}

	var account UnifiedAccount
	if err := json.Unmarshal(body, &account); err != nil {
		return nil, err
	}
	return &account, nil
}

func (c *Client) DeleteAccount(accountKey string) error {
	_, _, err := c.request("DELETE", "/v0/management/accounts/"+url.PathEscape(accountKey), nil, nil, "")
	return err
}

func (c *Client) DeleteAccountsBatch(input AccountBatchDeleteInput) (*AccountBatchDeleteResult, error) {
	if input.AccountKeys == nil {
		input.AccountKeys = []string{}
	}
	payload, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	body, _, err := c.request("POST", "/v0/management/accounts/batch-delete", nil, bytes.NewReader(payload), "application/json")
	if err != nil {
		return nil, err
	}
	var response AccountBatchDeleteResult
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.DeletedAccountKeys == nil {
		response.DeletedAccountKeys = []string{}
	}
	if response.Errors == nil {
		response.Errors = []AccountBatchDeleteError{}
	}
	return &response, nil
}

func (c *Client) GetAccountModels(accountKey string) ([]map[string]interface{}, error) {
	body, _, err := c.request("GET", "/v0/management/accounts/"+url.PathEscape(accountKey)+"/models", nil, nil, "")
	if err != nil {
		return nil, err
	}
	var response struct {
		Models []map[string]interface{} `json:"models"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Models == nil {
		return []map[string]interface{}{}, nil
	}
	return response.Models, nil
}

func (c *Client) DryRunAccountMigration() (*AccountMigrationReport, error) {
	var report AccountMigrationReport
	if err := c.postAccountMigration("/v0/management/account-migration/dry-run", nil, &report); err != nil {
		return nil, err
	}
	if report.Candidates == nil {
		report.Candidates = []AccountMigrationCandidate{}
	}
	return &report, nil
}

func (c *Client) CommitAccountMigration() (*AccountMigrationCommitReport, error) {
	var report AccountMigrationCommitReport
	if err := c.postAccountMigration("/v0/management/account-migration/commit", nil, &report); err != nil {
		return nil, err
	}
	return &report, nil
}

func (c *Client) DeleteLegacyAccountSources() (*AccountMigrationDeleteResult, error) {
	var result AccountMigrationDeleteResult
	if err := c.postAccountMigration("/v0/management/account-migration/delete-legacy-sources", nil, &result); err != nil {
		return nil, err
	}
	if result.Items == nil {
		result.Items = []AccountMigrationDeleteResultItem{}
	}
	return &result, nil
}

func (c *Client) postAccountMigration(path string, payload any, result any) error {
	var body io.Reader
	if payload != nil {
		data, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		body = bytes.NewReader(data)
	}
	response, _, err := c.request("POST", path, nil, body, "application/json")
	if err != nil {
		return err
	}
	if result == nil || len(response) == 0 {
		return nil
	}
	return json.Unmarshal(response, result)
}

func (c *Client) PatchAccountStatus(accountKey string, disabled bool) (*UnifiedAccount, error) {
	payload, err := json.Marshal(struct {
		Disabled bool `json:"disabled"`
	}{Disabled: disabled})
	if err != nil {
		return nil, err
	}
	body, _, err := c.request("PATCH", "/v0/management/accounts/"+url.PathEscape(accountKey)+"/status", nil, bytes.NewReader(payload), "application/json")
	if err != nil {
		return nil, err
	}

	var account UnifiedAccount
	if err := json.Unmarshal(body, &account); err != nil {
		return nil, err
	}
	return &account, nil
}

func (c *Client) PatchAccountPriority(accountKey string, priority int) (*UnifiedAccount, error) {
	payload, err := json.Marshal(struct {
		Priority int `json:"priority"`
	}{Priority: priority})
	if err != nil {
		return nil, err
	}
	body, _, err := c.request("PATCH", "/v0/management/accounts/"+url.PathEscape(accountKey)+"/priority", nil, bytes.NewReader(payload), "application/json")
	if err != nil {
		return nil, err
	}

	var account UnifiedAccount
	if err := json.Unmarshal(body, &account); err != nil {
		return nil, err
	}
	return &account, nil
}

func (c *Client) RequestCodexAuthURL(isWebUI bool) (*OAuthStartResponse, error) {
	query := url.Values{}
	if isWebUI {
		query.Set("is_webui", "true")
	}

	body, _, err := c.request("GET", "/v0/management/codex-auth-url", query, nil, "")
	if err != nil {
		return nil, err
	}

	var response OAuthStartResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	return &response, nil
}

func (c *Client) GetAuthStatus(state string) (*OAuthStatusResponse, error) {
	query := url.Values{}
	query.Set("state", state)

	body, _, err := c.request("GET", "/v0/management/get-auth-status", query, nil, "")
	if err != nil {
		return nil, err
	}

	var response OAuthStatusResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	return &response, nil
}

func (c *Client) ListRateLimitStrategies() ([]RateLimitStrategyMeta, error) {
	body, _, err := c.request("GET", "/v0/management/gettokens/rate-limit-strategies", nil, nil, "")
	if err != nil {
		return nil, err
	}
	var response struct {
		Items []RateLimitStrategyMeta `json:"items"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Items == nil {
		return []RateLimitStrategyMeta{}, nil
	}
	return response.Items, nil
}

func (c *Client) ListRateLimitRules(accountKey string) ([]RateLimitRule, error) {
	query := url.Values{}
	if accountKey != "" {
		query.Set("account_key", accountKey)
	}
	body, _, err := c.request("GET", "/v0/management/gettokens/rate-limit-rules", query, nil, "")
	if err != nil {
		return nil, err
	}
	return decodeRateLimitRules(body)
}

func (c *Client) CreateRateLimitRule(rule RateLimitRule) ([]RateLimitRule, error) {
	payload, err := json.Marshal(rule)
	if err != nil {
		return nil, err
	}
	body, _, err := c.request("POST", "/v0/management/gettokens/rate-limit-rules", nil, bytes.NewReader(payload), "application/json")
	if err != nil {
		return nil, err
	}
	return decodeRateLimitRules(body)
}

func (c *Client) UpdateRateLimitRule(rule RateLimitRule) ([]RateLimitRule, error) {
	payload, err := json.Marshal(rule)
	if err != nil {
		return nil, err
	}
	body, _, err := c.request("PUT", "/v0/management/gettokens/rate-limit-rules/"+url.PathEscape(rule.ID), nil, bytes.NewReader(payload), "application/json")
	if err != nil {
		return nil, err
	}
	return decodeRateLimitRules(body)
}

func (c *Client) DeleteRateLimitRule(id string) error {
	_, _, err := c.request("DELETE", "/v0/management/gettokens/rate-limit-rules/"+url.PathEscape(id), nil, nil, "")
	return err
}

func (c *Client) ListProjectCandidatePoolRules(channel string) ([]ProjectCandidatePoolRule, error) {
	query := url.Values{}
	if channel != "" {
		query.Set("channel", channel)
	}
	body, _, err := c.request("GET", "/v0/management/gettokens/project-candidate-pool-rules", query, nil, "")
	if err != nil {
		return nil, err
	}
	return decodeProjectCandidatePoolRules(body)
}

func (c *Client) CreateProjectCandidatePoolRule(rule ProjectCandidatePoolRule) ([]ProjectCandidatePoolRule, error) {
	payload, err := json.Marshal(rule)
	if err != nil {
		return nil, err
	}
	body, _, err := c.request("POST", "/v0/management/gettokens/project-candidate-pool-rules", nil, bytes.NewReader(payload), "application/json")
	if err != nil {
		return nil, err
	}
	return decodeProjectCandidatePoolRules(body)
}

func (c *Client) UpdateProjectCandidatePoolRule(rule ProjectCandidatePoolRule) ([]ProjectCandidatePoolRule, error) {
	payload, err := json.Marshal(rule)
	if err != nil {
		return nil, err
	}
	body, _, err := c.request("PUT", "/v0/management/gettokens/project-candidate-pool-rules/"+url.PathEscape(rule.ID), nil, bytes.NewReader(payload), "application/json")
	if err != nil {
		return nil, err
	}
	return decodeProjectCandidatePoolRules(body)
}

func (c *Client) DeleteProjectCandidatePoolRule(id string) error {
	_, _, err := c.request("DELETE", "/v0/management/gettokens/project-candidate-pool-rules/"+url.PathEscape(id), nil, nil, "")
	return err
}

func (c *Client) GetAccountStoreDiagnostics() (*AccountStoreDiagnostics, error) {
	body, _, err := c.request("GET", "/v0/management/gettokens/account-store-diagnostics", nil, nil, "")
	if err != nil {
		return nil, err
	}
	var response AccountStoreDiagnostics
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	return &response, nil
}

func (c *Client) GetAllRateLimitStatuses() ([]RateLimitState, error) {
	body, _, err := c.request("GET", "/v0/management/gettokens/rate-limit-status", nil, nil, "")
	if err != nil {
		return nil, err
	}
	var response struct {
		Items []RateLimitState `json:"items"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Items == nil {
		return []RateLimitState{}, nil
	}
	return response.Items, nil
}

func (c *Client) GetRateLimitStatus(accountKey string) (*RateLimitState, error) {
	query := url.Values{}
	query.Set("account_key", accountKey)
	body, _, err := c.request("GET", "/v0/management/gettokens/rate-limit-status", query, nil, "")
	if err != nil {
		return nil, err
	}
	var response RateLimitState
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Rules == nil {
		response.Rules = []RateLimitRuleState{}
	}
	if response.Sources == nil {
		response.Sources = []RateLimitSourceState{}
	}
	return &response, nil
}

func (c *Client) ListRateLimitEvents(accountKey string, limit int) ([]RateLimitEvent, error) {
	query := url.Values{}
	if accountKey != "" {
		query.Set("account_key", accountKey)
	}
	if limit > 0 {
		query.Set("limit", strconv.Itoa(limit))
	}
	body, _, err := c.request("GET", "/v0/management/gettokens/rate-limit-events", query, nil, "")
	if err != nil {
		return nil, err
	}
	var response struct {
		Items []RateLimitEvent `json:"items"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Items == nil {
		return []RateLimitEvent{}, nil
	}
	return response.Items, nil
}

func (c *Client) GetAllQuotaStatuses() ([]QuotaRuntimeState, error) {
	body, _, err := c.request("GET", "/v0/management/gettokens/quota-status", nil, nil, "")
	if err != nil {
		return nil, err
	}
	var response struct {
		Items []QuotaRuntimeState `json:"items"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Items == nil {
		return []QuotaRuntimeState{}, nil
	}
	for index := range response.Items {
		normalizeQuotaRuntimeStateSlices(&response.Items[index])
	}
	return response.Items, nil
}

func (c *Client) GetQuotaStatuses(accountKeys []string) ([]QuotaRuntimeState, error) {
	keys := make([]string, 0, len(accountKeys))
	for _, accountKey := range accountKeys {
		accountKey = strings.TrimSpace(accountKey)
		if accountKey == "" {
			continue
		}
		keys = append(keys, accountKey)
	}
	if len(keys) == 0 {
		return []QuotaRuntimeState{}, nil
	}
	query := url.Values{}
	query.Set("account_keys", strings.Join(keys, ","))
	body, _, err := c.request("GET", "/v0/management/gettokens/quota-status", query, nil, "")
	if err != nil {
		return nil, err
	}
	var response struct {
		Items []QuotaRuntimeState `json:"items"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Items == nil {
		return []QuotaRuntimeState{}, nil
	}
	for index := range response.Items {
		normalizeQuotaRuntimeStateSlices(&response.Items[index])
	}
	return response.Items, nil
}

func (c *Client) GetQuotaStatus(accountKey string) (*QuotaRuntimeState, error) {
	query := url.Values{}
	query.Set("account_key", accountKey)
	body, _, err := c.request("GET", "/v0/management/gettokens/quota-status", query, nil, "")
	if err != nil {
		return nil, err
	}
	var response QuotaRuntimeState
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	normalizeQuotaRuntimeStateSlices(&response)
	return &response, nil
}

func (c *Client) UpsertQuotaStatus(accountKey string, state QuotaRuntimeState) (*QuotaRuntimeState, error) {
	state.AccountKey = accountKey
	if state.Windows == nil {
		state.Windows = []QuotaRuntimeWindow{}
	}
	if state.Sources == nil {
		state.Sources = []QuotaRuntimeSourceState{}
	}
	if state.Billing != nil && state.Billing.BalanceInfos == nil {
		state.Billing.BalanceInfos = []QuotaRuntimeBalanceInfo{}
	}
	payload, err := json.Marshal(state)
	if err != nil {
		return nil, err
	}
	body, _, err := c.request("PUT", "/v0/management/gettokens/quota-status/"+url.PathEscape(accountKey), nil, bytes.NewReader(payload), "application/json")
	if err != nil {
		return nil, err
	}
	var response QuotaRuntimeState
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	normalizeQuotaRuntimeStateSlices(&response)
	return &response, nil
}

func (c *Client) RefreshQuota(accountKey string, includeBilling bool, force bool) (*QuotaRuntimeState, error) {
	payload, err := json.Marshal(struct {
		IncludeBilling bool `json:"include_billing"`
		Force          bool `json:"force"`
	}{
		IncludeBilling: includeBilling,
		Force:          force,
	})
	if err != nil {
		return nil, err
	}
	body, _, err := c.request("POST", "/v0/management/gettokens/quota-refresh/"+url.PathEscape(accountKey), nil, bytes.NewReader(payload), "application/json")
	if err != nil {
		return nil, err
	}
	var response QuotaRuntimeState
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	normalizeQuotaRuntimeStateSlices(&response)
	return &response, nil
}

func (c *Client) RefreshQuotaBatch(input QuotaRefreshBatchInput) (*QuotaRefreshBatchResult, error) {
	if input.AccountKeys == nil {
		input.AccountKeys = []string{}
	}
	payload, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	body, _, err := c.request("POST", "/v0/management/gettokens/quota-refresh-batch", nil, bytes.NewReader(payload), "application/json")
	if err != nil {
		return nil, err
	}
	var response QuotaRefreshBatchResult
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Items == nil {
		response.Items = []QuotaRuntimeState{}
	}
	if response.Errors == nil {
		response.Errors = []QuotaRefreshBatchError{}
	}
	for index := range response.Items {
		normalizeQuotaRuntimeStateSlices(&response.Items[index])
	}
	return &response, nil
}

func (c *Client) StartQuotaRefreshBatchJob(input QuotaRefreshBatchInput) (*QuotaRefreshBatchJob, error) {
	if input.AccountKeys == nil {
		input.AccountKeys = []string{}
	}
	payload, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	body, _, err := c.request("POST", "/v0/management/gettokens/quota-refresh-batch/jobs", nil, bytes.NewReader(payload), "application/json")
	if err != nil {
		return nil, err
	}
	var response QuotaRefreshBatchJob
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	normalizeQuotaRefreshBatchJob(&response)
	return &response, nil
}

func (c *Client) GetQuotaRefreshBatchJob(jobID string) (*QuotaRefreshBatchJob, error) {
	body, _, err := c.request("GET", "/v0/management/gettokens/quota-refresh-batch/jobs/"+url.PathEscape(strings.TrimSpace(jobID)), nil, nil, "")
	if err != nil {
		return nil, err
	}
	var response QuotaRefreshBatchJob
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	normalizeQuotaRefreshBatchJob(&response)
	return &response, nil
}

func (c *Client) TestQuotaCurl(input QuotaCurlTestInput) (*QuotaRuntimeState, error) {
	return c.postQuotaCurlTest("/v0/management/gettokens/quota-test", input)
}

func (c *Client) TestBillingCurl(input QuotaCurlTestInput) (*QuotaRuntimeState, error) {
	return c.postQuotaCurlTest("/v0/management/gettokens/billing-test", input)
}

func (c *Client) postQuotaCurlTest(path string, input QuotaCurlTestInput) (*QuotaRuntimeState, error) {
	payload, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	body, _, err := c.request("POST", path, nil, bytes.NewReader(payload), "application/json")
	if err != nil {
		return nil, err
	}
	var response QuotaRuntimeState
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	normalizeQuotaRuntimeStateSlices(&response)
	return &response, nil
}

func decodeRateLimitRules(body []byte) ([]RateLimitRule, error) {
	var response struct {
		Items []RateLimitRule `json:"items"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Items == nil {
		return []RateLimitRule{}, nil
	}
	return response.Items, nil
}

func decodeProjectCandidatePoolRules(body []byte) ([]ProjectCandidatePoolRule, error) {
	var response struct {
		Items []ProjectCandidatePoolRule `json:"items"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Items == nil {
		return []ProjectCandidatePoolRule{}, nil
	}
	return response.Items, nil
}

func normalizeQuotaRuntimeStateSlices(state *QuotaRuntimeState) {
	if state == nil {
		return
	}
	if state.Windows == nil {
		state.Windows = []QuotaRuntimeWindow{}
	}
	if state.Sources == nil {
		state.Sources = []QuotaRuntimeSourceState{}
	}
	if state.Billing != nil && state.Billing.BalanceInfos == nil {
		state.Billing.BalanceInfos = []QuotaRuntimeBalanceInfo{}
	}
}

func normalizeQuotaRefreshBatchJob(job *QuotaRefreshBatchJob) {
	if job == nil {
		return
	}
	if job.Items == nil {
		job.Items = []QuotaRuntimeState{}
	}
	if job.Errors == nil {
		job.Errors = []QuotaRefreshBatchError{}
	}
	for index := range job.Items {
		normalizeQuotaRuntimeStateSlices(&job.Items[index])
	}
}
