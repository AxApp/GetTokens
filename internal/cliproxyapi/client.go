package cliproxyapi

import (
	"bytes"
	"encoding/json"
	"fmt"
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

type ChannelRoutingExplainInput struct {
	Channel              string   `json:"channel"`
	RequestedModel       string   `json:"requestedModel,omitempty"`
	TriedAccountIDs      []string `json:"triedAccountIDs,omitempty"`
	StickyAccountID      string   `json:"stickyAccountID,omitempty"`
	ProjectKey           string   `json:"projectKey,omitempty"`
	ProjectName          string   `json:"projectName,omitempty"`
	ProjectKeySource     string   `json:"projectKeySource,omitempty"`
	ProjectKeyConfidence string   `json:"projectKeyConfidence,omitempty"`
	ProjectMatchKeys     []string `json:"projectMatchKeys,omitempty"`
}

type ChannelRoutingExplainResult struct {
	Channel              string                             `json:"channel"`
	RouteMode            string                             `json:"routeMode"`
	RequestedModel       string                             `json:"requestedModel,omitempty"`
	SelectedAccountID    string                             `json:"selectedAccountID,omitempty"`
	Candidates           []ChannelRoutingExplainCandidate   `json:"candidates"`
	Filtered             []ChannelRoutingExplainFiltered    `json:"filtered"`
	Steps                []string                           `json:"steps"`
	SnapshotVersion      string                             `json:"snapshotVersion,omitempty"`
	PolicyVersion        string                             `json:"policyVersion,omitempty"`
	ProjectCandidatePool *ChannelRoutingExplainProjectPool  `json:"projectCandidatePool,omitempty"`
	Shadow               *ChannelRoutingExplainShadowResult `json:"shadow,omitempty"`
}

type ChannelRoutingExplainCandidate struct {
	ID             string   `json:"id"`
	DisplayName    string   `json:"displayName,omitempty"`
	Provider       string   `json:"provider,omitempty"`
	RouteOrder     int      `json:"routeOrder,omitempty"`
	GroupID        string   `json:"groupID,omitempty"`
	GroupOrder     int      `json:"groupOrder,omitempty"`
	ChannelOrder   int      `json:"channelOrder,omitempty"`
	ActiveSessions int      `json:"activeSessions,omitempty"`
	RouteIDs       []string `json:"routeIDs,omitempty"`
}

type ChannelRoutingExplainFiltered struct {
	ID     string `json:"id"`
	Reason string `json:"reason"`
}

type ChannelRoutingExplainProjectPool struct {
	Evaluated            bool     `json:"evaluated"`
	Activated            bool     `json:"activated"`
	Reason               string   `json:"reason,omitempty"`
	RuleID               string   `json:"ruleID,omitempty"`
	ProjectKey           string   `json:"projectKey,omitempty"`
	ProjectName          string   `json:"projectName,omitempty"`
	ProjectKeySource     string   `json:"projectKeySource,omitempty"`
	ProjectKeyConfidence string   `json:"projectKeyConfidence,omitempty"`
	AllowAccountIDs      []string `json:"allowAccountIDs,omitempty"`
	FilteredAccountIDs   []string `json:"filteredAccountIDs,omitempty"`
	BeforeCandidateCount int      `json:"beforeCandidateCount,omitempty"`
	AfterCandidateCount  int      `json:"afterCandidateCount,omitempty"`
}

type ChannelRoutingExplainShadowResult struct {
	Enabled           bool                             `json:"enabled"`
	RouteMode         string                           `json:"routeMode,omitempty"`
	SelectedAccountID string                           `json:"selectedAccountID,omitempty"`
	Candidates        []ChannelRoutingExplainCandidate `json:"candidates,omitempty"`
	Diff              bool                             `json:"diff"`
	Steps             []string                         `json:"steps,omitempty"`
}

type ChannelRoutingDecisionSnapshot struct {
	ID                   string                            `json:"id"`
	RecordedAt           string                            `json:"recordedAt"`
	Channel              string                            `json:"channel"`
	Providers            []string                          `json:"providers,omitempty"`
	Model                string                            `json:"model,omitempty"`
	ProjectKey           string                            `json:"projectKey,omitempty"`
	ProjectName          string                            `json:"projectName,omitempty"`
	ProjectKeySource     string                            `json:"projectKeySource,omitempty"`
	ProjectKeyConfidence string                            `json:"projectKeyConfidence,omitempty"`
	ProjectMatchKeys     []string                          `json:"projectMatchKeys,omitempty"`
	Source               string                            `json:"source,omitempty"`
	CandidateCount       int                               `json:"candidateCount"`
	Candidates           []ChannelRoutingDecisionCandidate `json:"candidates"`
	SelectedAuthID       string                            `json:"selectedAuthID,omitempty"`
	SelectedAccountID    string                            `json:"selectedAccountID,omitempty"`
	SelectedProvider     string                            `json:"selectedProvider,omitempty"`
	UnavailableCode      string                            `json:"unavailableCode,omitempty"`
	UnavailableMessage   string                            `json:"unavailableMessage,omitempty"`
	DroppedReasons       []ChannelRoutingDroppedReason     `json:"droppedReasons,omitempty"`
	Trace                []ChannelRoutingDecisionStep      `json:"trace"`
}

func (s *ChannelRoutingDecisionSnapshot) UnmarshalJSON(data []byte) error {
	type alias ChannelRoutingDecisionSnapshot
	var base alias
	if err := json.Unmarshal(data, &base); err != nil {
		return err
	}
	var compat struct {
		DroppedReasonsSnake []ChannelRoutingDroppedReason `json:"dropped_reasons"`
	}
	if err := json.Unmarshal(data, &compat); err != nil {
		return err
	}
	*s = ChannelRoutingDecisionSnapshot(base)
	if compat.DroppedReasonsSnake != nil && s.DroppedReasons == nil {
		s.DroppedReasons = compat.DroppedReasonsSnake
	}
	return nil
}

type ChannelRoutingDecisionCandidate struct {
	AuthID    string `json:"authID,omitempty"`
	AccountID string `json:"accountID,omitempty"`
	Provider  string `json:"provider,omitempty"`
}

type ChannelRoutingDroppedReason struct {
	AccountKey    string `json:"accountKey,omitempty"`
	AccountID     string `json:"accountID,omitempty"`
	AuthID        string `json:"authID,omitempty"`
	Source        string `json:"source,omitempty"`
	Scope         string `json:"scope,omitempty"`
	Reason        string `json:"reason,omitempty"`
	Model         string `json:"model,omitempty"`
	ExpiresAt     string `json:"expiresAt,omitempty"`
	UpdatedAt     string `json:"updatedAt,omitempty"`
	RouteBlocking bool   `json:"routeBlocking,omitempty"`
}

func (r *ChannelRoutingDroppedReason) UnmarshalJSON(data []byte) error {
	var aux struct {
		AccountKey         string `json:"accountKey"`
		AccountID          string `json:"accountID"`
		AccountIDCamel     string `json:"accountId"`
		AccountIDSnake     string `json:"account_id"`
		AuthID             string `json:"authID"`
		AuthIDCamel        string `json:"authId"`
		AuthIDSnake        string `json:"auth_id"`
		Source             string `json:"source"`
		Scope              string `json:"scope"`
		Reason             string `json:"reason"`
		Model              string `json:"model"`
		ExpiresAt          string `json:"expiresAt"`
		ExpiresAtSnake     string `json:"expires_at"`
		UpdatedAt          string `json:"updatedAt"`
		UpdatedAtSnake     string `json:"updated_at"`
		RouteBlocking      *bool  `json:"routeBlocking"`
		RouteBlockingSnake *bool  `json:"route_blocking"`
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	r.AccountKey = firstNonEmpty(aux.AccountKey, aux.AccountIDCamel, aux.AccountID, aux.AccountIDSnake)
	r.AccountID = firstNonEmpty(aux.AccountIDCamel, aux.AccountID, aux.AccountKey, aux.AccountIDSnake)
	r.AuthID = firstNonEmpty(aux.AuthIDCamel, aux.AuthID, aux.AuthIDSnake)
	r.Source = aux.Source
	r.Scope = aux.Scope
	r.Reason = aux.Reason
	r.Model = aux.Model
	r.ExpiresAt = firstNonEmpty(aux.ExpiresAt, aux.ExpiresAtSnake)
	r.UpdatedAt = firstNonEmpty(aux.UpdatedAt, aux.UpdatedAtSnake)
	if aux.RouteBlocking != nil {
		r.RouteBlocking = *aux.RouteBlocking
	} else if aux.RouteBlockingSnake != nil {
		r.RouteBlocking = *aux.RouteBlockingSnake
	}
	return nil
}

type RouteResilienceActionRequest struct {
	Action         string   `json:"action"`
	AccountKey     string   `json:"accountKey,omitempty"`
	AuthID         string   `json:"authId,omitempty"`
	Model          string   `json:"model,omitempty"`
	Sources        []string `json:"sources,omitempty"`
	Reason         string   `json:"reason,omitempty"`
	DryRun         bool     `json:"dryRun,omitempty"`
	IdempotencyKey string   `json:"idempotencyKey,omitempty"`
}

type RouteResilienceActionResponse struct {
	OK                   bool                          `json:"ok"`
	Authority            string                        `json:"authority"`
	Action               string                        `json:"action"`
	Status               string                        `json:"status"`
	AccountKey           string                        `json:"accountKey,omitempty"`
	AuthID               string                        `json:"authId,omitempty"`
	Model                string                        `json:"model,omitempty"`
	Before               map[string]any                `json:"before"`
	After                map[string]any                `json:"after"`
	AuditID              string                        `json:"auditId,omitempty"`
	DroppedSources       []string                      `json:"droppedSources,omitempty"`
	DroppedReasons       []ChannelRoutingDroppedReason `json:"droppedReasons,omitempty"`
	Error                string                        `json:"error,omitempty"`
	NotImplementedReason string                        `json:"notImplementedReason,omitempty"`
	HTTPStatus           int                           `json:"httpStatus,omitempty"`
}

type ChannelRoutingDecisionStep struct {
	Stage     string   `json:"stage"`
	Policy    string   `json:"policy,omitempty"`
	Reason    string   `json:"reason,omitempty"`
	Before    int      `json:"before"`
	After     int      `json:"after"`
	AllowIDs  []string `json:"allowIDs,omitempty"`
	DenyIDs   []string `json:"denyIDs,omitempty"`
	OrderIDs  []string `json:"orderIDs,omitempty"`
	Fallback  *bool    `json:"fallback,omitempty"`
	Activated bool     `json:"activated"`
}

func New(request RequestFunc) *Client {
	return &Client{request: request}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
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

func (c *Client) CreateAccountsBatch(input AccountBatchCreateInput) (*AccountBatchCreateResult, bool, error) {
	if input.Accounts == nil {
		input.Accounts = []AccountWriteRequest{}
	}
	payload, err := json.Marshal(input)
	if err != nil {
		return nil, false, err
	}
	body, status, err := c.request("POST", "/v0/management/accounts/batch-create", nil, bytes.NewReader(payload), "application/json")
	if err != nil {
		return nil, false, err
	}
	if status == 404 || status == 501 {
		return nil, false, nil
	}
	var response AccountBatchCreateResult
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, false, err
	}
	if response.Accounts == nil {
		response.Accounts = []UnifiedAccount{}
	}
	if response.Skipped == nil {
		response.Skipped = []AccountBatchCreateSkipped{}
	}
	if response.Errors == nil {
		response.Errors = []AccountBatchCreateError{}
	}
	return &response, true, nil
}

func (c *Client) PreviewCreateAccountsBatch(input AccountBatchCreateInput) (*AccountBatchCreatePreviewResult, bool, error) {
	if input.Accounts == nil {
		input.Accounts = []AccountWriteRequest{}
	}
	payload, err := json.Marshal(input)
	if err != nil {
		return nil, false, err
	}
	body, status, err := c.request("POST", "/v0/management/accounts/batch-preview", nil, bytes.NewReader(payload), "application/json")
	if err != nil {
		return nil, false, err
	}
	if status == 404 || status == 501 {
		return nil, false, nil
	}
	var response AccountBatchCreatePreviewResult
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, false, err
	}
	if response.Items == nil {
		response.Items = []AccountBatchCreatePreviewItem{}
	}
	if response.Skipped == nil {
		response.Skipped = []AccountBatchCreateSkipped{}
	}
	if response.Errors == nil {
		response.Errors = []AccountBatchCreateError{}
	}
	return &response, true, nil
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

func (c *Client) ExplainChannelRouting(input ChannelRoutingExplainInput) (*ChannelRoutingExplainResult, bool, error) {
	payload, err := json.Marshal(input)
	if err != nil {
		return nil, false, err
	}
	body, status, err := c.request("POST", "/v0/management/gettokens/channel-routing/explain", nil, bytes.NewReader(payload), "application/json")
	if err != nil {
		return nil, false, err
	}
	if status == 404 {
		return nil, false, nil
	}
	var response ChannelRoutingExplainResult
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, false, err
	}
	if response.Candidates == nil {
		response.Candidates = []ChannelRoutingExplainCandidate{}
	}
	if response.Filtered == nil {
		response.Filtered = []ChannelRoutingExplainFiltered{}
	}
	if response.Steps == nil {
		response.Steps = []string{}
	}
	return &response, true, nil
}

func (c *Client) ListChannelRoutingDecisions(channel string, limit int) ([]ChannelRoutingDecisionSnapshot, bool, error) {
	query := url.Values{}
	if value := strings.TrimSpace(channel); value != "" {
		query.Set("channel", value)
	}
	if limit > 0 {
		query.Set("limit", strconv.Itoa(limit))
	}
	body, status, err := c.request("GET", "/v0/management/gettokens/channel-routing/decisions", query, nil, "")
	if err != nil {
		return nil, false, err
	}
	if status == 404 {
		return nil, false, nil
	}
	var response struct {
		Items []ChannelRoutingDecisionSnapshot `json:"items"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, false, err
	}
	if response.Items == nil {
		response.Items = []ChannelRoutingDecisionSnapshot{}
	}
	for index := range response.Items {
		if response.Items[index].Providers == nil {
			response.Items[index].Providers = []string{}
		}
		if response.Items[index].ProjectMatchKeys == nil {
			response.Items[index].ProjectMatchKeys = []string{}
		}
		if response.Items[index].Candidates == nil {
			response.Items[index].Candidates = []ChannelRoutingDecisionCandidate{}
		}
		if response.Items[index].Trace == nil {
			response.Items[index].Trace = []ChannelRoutingDecisionStep{}
		}
	}
	return response.Items, true, nil
}

func (c *Client) RunRouteResilienceAction(input RouteResilienceActionRequest) (*RouteResilienceActionResponse, error) {
	payload, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	body, status, err := c.request("POST", "/v0/management/gettokens/route-resilience/actions", nil, bytes.NewReader(payload), "application/json")
	if err != nil {
		return nil, err
	}
	var response RouteResilienceActionResponse
	if len(body) > 0 {
		if err := json.Unmarshal(body, &response); err != nil {
			return nil, err
		}
	}
	response.HTTPStatus = status
	if response.DroppedSources == nil {
		response.DroppedSources = []string{}
	}
	if response.DroppedReasons == nil {
		response.DroppedReasons = []ChannelRoutingDroppedReason{}
	}
	return &response, nil
}

func (c *Client) GetDoctorDiagnostics() (*DoctorDiagnosticsResponse, bool, error) {
	body, status, err := c.request("GET", "/v0/management/gettokens/doctor-diagnostics", nil, nil, "")
	if err != nil {
		return nil, false, err
	}
	if status == 404 || status == 501 {
		return nil, false, nil
	}
	var response DoctorDiagnosticsResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, false, err
	}
	if response.Checks == nil {
		response.Checks = []DoctorDiagnosticCheck{}
	}
	for index := range response.Checks {
		if response.Checks[index].Evidence == nil {
			response.Checks[index].Evidence = []DoctorDiagnosticEvidence{}
		}
		for evidenceIndex := range response.Checks[index].Evidence {
			if response.Checks[index].Evidence[evidenceIndex].EvidenceRefs == nil {
				response.Checks[index].Evidence[evidenceIndex].EvidenceRefs = []string{}
			}
		}
	}
	return &response, true, nil
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

func (c *Client) ListQuotaCalibrations(accountKey string) ([]QuotaUsageCalibration, error) {
	query := url.Values{}
	if trimmed := strings.TrimSpace(accountKey); trimmed != "" {
		query.Set("account_key", trimmed)
	}
	body, _, err := c.request("GET", "/v0/management/gettokens/quota-calibrations", query, nil, "")
	if err != nil {
		return nil, err
	}
	var response struct {
		Items []QuotaUsageCalibration `json:"items"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Items == nil {
		return []QuotaUsageCalibration{}, nil
	}
	return response.Items, nil
}

func (c *Client) AddQuotaCalibration(input QuotaUsageCalibration) (*QuotaUsageCalibration, error) {
	payload, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	body, _, err := c.request("POST", "/v0/management/gettokens/quota-calibrations", nil, bytes.NewReader(payload), "application/json")
	if err != nil {
		return nil, err
	}
	var response QuotaUsageCalibration
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	return &response, nil
}

func (c *Client) RevokeQuotaCalibration(id string) (*QuotaUsageCalibration, error) {
	body, _, err := c.request("POST", "/v0/management/gettokens/quota-calibrations/"+url.PathEscape(strings.TrimSpace(id))+"/revoke", nil, nil, "")
	if err != nil {
		return nil, err
	}
	var response QuotaUsageCalibration
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	return &response, nil
}

func (c *Client) ListBudgetWindowDefinitions() ([]BudgetWindowDefinition, error) {
	body, _, err := c.request("GET", "/v0/management/gettokens/budget-window-definitions", nil, nil, "")
	if err != nil {
		return nil, err
	}
	var response struct {
		Items []BudgetWindowDefinition `json:"items"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Items == nil {
		return []BudgetWindowDefinition{}, nil
	}
	return response.Items, nil
}

func (c *Client) CreateBudgetWindowDefinition(input BudgetWindowDefinition) ([]BudgetWindowDefinition, error) {
	return c.writeBudgetWindowDefinition("POST", "/v0/management/gettokens/budget-window-definitions", input)
}

func (c *Client) UpdateBudgetWindowDefinition(id string, input BudgetWindowDefinition) ([]BudgetWindowDefinition, error) {
	return c.writeBudgetWindowDefinition("PUT", "/v0/management/gettokens/budget-window-definitions/"+url.PathEscape(strings.TrimSpace(id)), input)
}

func (c *Client) DeleteBudgetWindowDefinition(id string) ([]BudgetWindowDefinition, error) {
	body, _, err := c.request("DELETE", "/v0/management/gettokens/budget-window-definitions/"+url.PathEscape(strings.TrimSpace(id)), nil, nil, "")
	if err != nil {
		return nil, err
	}
	var response struct {
		Items []BudgetWindowDefinition `json:"items"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Items == nil {
		return []BudgetWindowDefinition{}, nil
	}
	return response.Items, nil
}

func (c *Client) PreviewBudgetWindowFacts(input BudgetWindowFactsPreviewRequest) ([]QuotaWindowFact, error) {
	payload, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	body, _, err := c.request("POST", "/v0/management/gettokens/budget-window-definitions/preview", nil, bytes.NewReader(payload), "application/json")
	if err != nil {
		return nil, err
	}
	var response struct {
		Items []QuotaWindowFact `json:"items"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Items == nil {
		return []QuotaWindowFact{}, nil
	}
	return response.Items, nil
}

func (c *Client) ListQuotaThresholdRules(accountKey string) ([]QuotaThresholdRule, error) {
	query := url.Values{}
	if trimmed := strings.TrimSpace(accountKey); trimmed != "" {
		query.Set("account_key", trimmed)
	}
	body, _, err := c.request("GET", "/v0/management/gettokens/quota-threshold-rules", query, nil, "")
	if err != nil {
		return nil, err
	}
	var response struct {
		Items []QuotaThresholdRule
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Items == nil {
		return []QuotaThresholdRule{}, nil
	}
	return response.Items, nil
}

func (c *Client) CreateQuotaThresholdRule(input QuotaThresholdRule) ([]QuotaThresholdRule, error) {
	return c.writeQuotaThresholdRule("POST", "/v0/management/gettokens/quota-threshold-rules", input)
}

func (c *Client) UpdateQuotaThresholdRule(id string, input QuotaThresholdRule) ([]QuotaThresholdRule, error) {
	return c.writeQuotaThresholdRule("PUT", "/v0/management/gettokens/quota-threshold-rules/"+url.PathEscape(strings.TrimSpace(id)), input)
}

func (c *Client) DeleteQuotaThresholdRule(id string) error {
	_, _, err := c.request("DELETE", "/v0/management/gettokens/quota-threshold-rules/"+url.PathEscape(strings.TrimSpace(id)), nil, nil, "")
	return err
}

func (c *Client) SimulateRouteGuardRule(input SimulateRouteGuardRuleRequest) (*SimulationResult, error) {
	payload, err := json.Marshal(routeGuardSimulationSidecarRequest(input))
	if err != nil {
		return nil, err
	}
	body, _, err := c.request("POST", "/v0/management/route-guard/rules/simulate", nil, bytes.NewReader(payload), "application/json")
	if err != nil {
		return nil, err
	}
	return decodeRouteGuardSimulationResult(body)
}

func (c *Client) writeQuotaThresholdRule(method string, path string, input QuotaThresholdRule) ([]QuotaThresholdRule, error) {
	payload, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	body, _, err := c.request(method, path, nil, bytes.NewReader(payload), "application/json")
	if err != nil {
		return nil, err
	}
	var response struct {
		Items []QuotaThresholdRule
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Items == nil {
		return []QuotaThresholdRule{}, nil
	}
	return response.Items, nil
}

func (c *Client) writeBudgetWindowDefinition(method string, path string, input BudgetWindowDefinition) ([]BudgetWindowDefinition, error) {
	payload, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	body, _, err := c.request(method, path, nil, bytes.NewReader(payload), "application/json")
	if err != nil {
		return nil, err
	}
	var response struct {
		Items []BudgetWindowDefinition `json:"items"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Items == nil {
		return []BudgetWindowDefinition{}, nil
	}
	return response.Items, nil
}

func routeGuardSimulationSidecarRequest(input SimulateRouteGuardRuleRequest) map[string]any {
	ruleIDs := []string{}
	if input.RuleID != nil {
		if ruleID := strings.TrimSpace(*input.RuleID); ruleID != "" {
			ruleIDs = append(ruleIDs, ruleID)
		}
	}
	request := map[string]any{}
	for _, key := range []string{"channel", "model", "project"} {
		if value, ok := input.Facts.Metadata[key]; ok {
			if text := strings.TrimSpace(toStringValue(value)); text != "" {
				request[key] = text
			}
		}
	}
	account := map[string]any{"accountId": strings.TrimSpace(input.Facts.AccountID)}
	if input.Facts.QuotaWindow != nil {
		account["quotaWindow"] = input.Facts.QuotaWindow
	}
	if len(input.Facts.QuotaWindows) > 0 {
		account["quotaWindows"] = input.Facts.QuotaWindows
	}
	if len(input.Facts.CalibrationEntries) > 0 {
		entries := make([]map[string]any, 0, len(input.Facts.CalibrationEntries))
		for _, entry := range input.Facts.CalibrationEntries {
			entries = append(entries, routeGuardSimulationCalibrationEntry(entry, input.Facts.AccountID))
		}
		account["calibrationLedger"] = entries
	}
	return map[string]any{
		"ruleIds": ruleIDs,
		"rule":    input.Rule,
		"facts": map[string]any{
			"now":      strings.TrimSpace(input.Facts.Now),
			"request":  request,
			"accounts": []map[string]any{account},
		},
	}
}

func routeGuardSimulationCalibrationEntry(input CalibrationFact, defaultAccountID string) map[string]any {
	entry := map[string]any{
		"id":        strings.TrimSpace(input.ID),
		"accountId": strings.TrimSpace(input.AccountID),
		"windowId":  strings.TrimSpace(input.WindowID),
		"metric":    strings.TrimSpace(input.Metric),
		"mode":      strings.TrimSpace(input.Mode),
		"value":     input.Value,
	}
	if entry["accountId"] == "" {
		entry["accountId"] = strings.TrimSpace(defaultAccountID)
	}
	if createdAt := strings.TrimSpace(input.CreatedAt); createdAt != "" {
		entry["createdAt"] = createdAt
	}
	if expiresAt := strings.TrimSpace(input.ExpiresAt); expiresAt != "" {
		entry["expiresAt"] = expiresAt
	}
	if revokedAt := strings.TrimSpace(input.RevokedAt); revokedAt != "" {
		entry["revokedAt"] = revokedAt
	}
	return entry
}

func decodeRouteGuardSimulationResult(body []byte) (*SimulationResult, error) {
	var direct SimulationResult
	if err := json.Unmarshal(body, &direct); err == nil {
		if strings.TrimSpace(direct.Decision) != "" || strings.TrimSpace(direct.AccountTrace.AccountID) != "" {
			return &direct, nil
		}
	}
	var raw map[string]any
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}
	accounts := anySlice(raw["accounts"])
	if len(accounts) == 0 {
		return &SimulationResult{Decision: "allow", AccountTrace: AccountDecisionTrace{Reason: "no account simulation result"}}, nil
	}
	account := anyMap(accounts[0])
	decision := anyMap(account["decision"])
	matched := anyMap(account["matchedRule"])
	reasonTrace := reasonTraceStepsFromAny(account["reasonTrace"])
	source := strings.TrimSpace(stringFromMap(decision, "denySource"))
	if source == "" {
		source = strings.TrimSpace(stringFromMap(matched, "kind"))
	}
	result := &SimulationResult{
		Decision: strings.TrimSpace(stringFromMap(decision, "action")),
		AccountTrace: AccountDecisionTrace{
			AccountID:   stringFromMap(account, "accountId"),
			Source:      source,
			Reason:      stringFromMap(decision, "reason"),
			ReasonTrace: reasonTrace,
		},
		RecoveryAt: optionalStringFromMap(account, "recoveryAt"),
		ExpiresAt:  optionalStringFromMap(account, "expiresAt"),
	}
	if result.Decision == "" {
		result.Decision = "allow"
	}
	if len(matched) > 0 {
		result.MatchedRule = &MatchedRuleSummary{ID: stringFromMap(matched, "ruleId"), Name: stringFromMap(matched, "ruleName"), Source: stringFromMap(matched, "kind")}
	}
	for _, step := range reasonTrace {
		if strings.Contains(step.Code, "diagnostic") || strings.Contains(step.Code, "missing") || strings.Contains(step.Code, "ignored") {
			result.Diagnostics = append(result.Diagnostics, step)
		}
	}
	return result, nil
}

func reasonTraceStepsFromAny(value any) []ReasonTraceStep {
	items := anySlice(value)
	out := make([]ReasonTraceStep, 0, len(items))
	for _, item := range items {
		entry := anyMap(item)
		step := ReasonTraceStep{Code: stringFromMap(entry, "code"), Message: stringFromMap(entry, "message")}
		if data := anyMap(entry["data"]); len(data) > 0 {
			step.Data = data
		}
		if step.Code != "" {
			out = append(out, step)
		}
	}
	return out
}

func anySlice(value any) []any {
	if typed, ok := value.([]any); ok {
		return typed
	}
	return nil
}

func anyMap(value any) map[string]any {
	if typed, ok := value.(map[string]any); ok {
		return typed
	}
	return nil
}

func stringFromMap(input map[string]any, key string) string {
	if len(input) == 0 {
		return ""
	}
	return strings.TrimSpace(toStringValue(input[key]))
}

func optionalStringFromMap(input map[string]any, key string) *string {
	value := stringFromMap(input, key)
	if value == "" {
		return nil
	}
	return &value
}

func toStringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case fmt.Stringer:
		return typed.String()
	default:
		return ""
	}
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

func (c *Client) GetOpenAIQuotaResetCredit(accountKey string) (*OpenAIQuotaResetCreditInfo, error) {
	body, _, err := c.request("GET", "/v0/management/gettokens/openai-quota-reset/"+url.PathEscape(strings.TrimSpace(accountKey)), nil, nil, "")
	if err != nil {
		return nil, err
	}
	var response OpenAIQuotaResetCreditInfo
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	normalizeOpenAIQuotaResetCreditInfo(&response)
	return &response, nil
}

func (c *Client) ConsumeOpenAIQuotaResetCredit(accountKey string) (*OpenAIQuotaResetConsumeResult, error) {
	body, _, err := c.request("POST", "/v0/management/gettokens/openai-quota-reset/"+url.PathEscape(strings.TrimSpace(accountKey))+"/consume", nil, bytes.NewReader([]byte("{}")), "application/json")
	if err != nil {
		return nil, err
	}
	var response OpenAIQuotaResetConsumeResult
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	normalizeOpenAIQuotaResetConsumeResult(&response)
	return &response, nil
}

func normalizeOpenAIQuotaResetCreditInfo(response *OpenAIQuotaResetCreditInfo) {
	if response == nil || response.QuotaState == nil {
		return
	}
	normalizeQuotaRuntimeStateSlices(response.QuotaState)
}

func normalizeOpenAIQuotaResetConsumeResult(response *OpenAIQuotaResetConsumeResult) {
	if response == nil || response.QuotaState == nil {
		return
	}
	normalizeQuotaRuntimeStateSlices(response.QuotaState)
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
