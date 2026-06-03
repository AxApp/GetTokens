package wailsapp

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
	"github.com/linhay/gettokens/internal/cliproxyapi"
)

func (a *App) GetCodexQuota(name string) (*CodexQuotaResponse, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("name 不能为空")
	}
	if isUnifiedAccountID(name) {
		account, err := a.managementClient().GetAccount(name)
		if err != nil {
			return nil, err
		}
		switch account.Kind {
		case cliproxyapi.AccountKindCodexAPIKey:
			return a.getUnifiedCodexAPIKeyQuota(account)
		case cliproxyapi.AccountKindAuthFile:
			if account.AuthFile == nil {
				return nil, fmt.Errorf("auth file 不存在: %s", name)
			}
			return a.getCodexAuthFileQuota(strings.TrimSpace(account.AccountKey), []byte(account.AuthFile.AuthJSON))
		}
	}

	authFile, err := a.getRawAuthFileByName(name)
	if err != nil {
		return nil, err
	}

	body, err := a.downloadAuthFileBody(name)
	if err != nil {
		return nil, err
	}

	return a.getCodexAuthFileQuota(normalizeAuthIndex(authFile.AuthIndex), body)
}

func (a *App) getCodexAuthFileQuota(authIndex string, body []byte) (*CodexQuotaResponse, error) {
	requestInfo, err := accountsdomain.ResolveCodexQuotaRequestInfo(body)
	if err != nil {
		return nil, err
	}
	if authIndex == "" {
		return nil, errors.New("codex 凭证缺少 auth_index")
	}

	startedAt := time.Now()
	requestHeaders := map[string]string{
		"Authorization":      "Bearer $TOKEN$",
		"chatgpt-account-id": requestInfo.ChatGPTAccountID,
		"Accept":             "application/json",
	}
	requestPayload, err := json.Marshal(managementAPICallRequest{
		AuthIndex: authIndex,
		Method:    http.MethodGet,
		URL:       "https://chatgpt.com/backend-api/wham/usage",
		Header:    requestHeaders,
	})
	if err != nil {
		return nil, err
	}

	apiResponseBody, statusCode, err := a.SidecarRequest(
		http.MethodPost,
		ManagementAPIPrefix+"/api-call",
		nil,
		bytes.NewReader(requestPayload),
		"application/json",
	)
	var apiResponse managementAPICallResponse
	if len(apiResponseBody) > 0 {
		_ = json.Unmarshal(apiResponseBody, &apiResponse)
	}

	debugRecord := accountsdomain.CodexQuotaDebugRecord{
		Request: accountsdomain.CodexQuotaDebugRequest{
			Method: http.MethodGet,
			URL:    "https://chatgpt.com/backend-api/wham/usage",
			Headers: map[string]string{
				"Authorization":      "Bearer <redacted>",
				"chatgpt-account-id": requestInfo.ChatGPTAccountID,
				"Accept":             "application/json",
			},
		},
		StartedAt:  startedAt,
		EndedAt:    time.Now(),
		DurationMs: time.Since(startedAt).Milliseconds(),
		StatusCode: statusCode,
	}
	if len(strings.TrimSpace(apiResponse.Body)) > 0 {
		debugRecord.Response = parseDebugResponse(apiResponse.Body)
	}
	if err != nil {
		debugRecord.Error = err.Error()
		a.emitCodexQuotaDebugRecord(debugRecord)
		if cachedQuota, cacheErr := accountsdomain.BuildCachedCodexQuotaResponse(body); cacheErr == nil {
			quota := mapAccountsdomainCodexQuotaResponse(cachedQuota)
			quota.Status = cliproxyapi.QuotaRuntimeStatusStale
			quota.Stale = true
			quota.DegradedReason = err.Error()
			return a.upsertCodexQuotaRuntimeIfUnified(authIndex, "auth-file-usage-cache", cliproxyapi.QuotaRuntimeStatusStale, quota)
		}
		return nil, err
	}
	debugRecord.StatusCode = apiResponse.statusCode()
	debugRecord.EndedAt = time.Now()
	debugRecord.DurationMs = debugRecord.EndedAt.Sub(startedAt).Milliseconds()
	if len(strings.TrimSpace(apiResponse.Body)) > 0 {
		debugRecord.Response = parseDebugResponse(apiResponse.Body)
	}
	a.emitCodexQuotaDebugRecord(debugRecord)

	quota, err := accountsdomain.BuildCodexQuotaResponse(body, []byte(apiResponse.Body))
	if err != nil {
		return nil, err
	}

	status := cliproxyapi.QuotaRuntimeStatusSuccess
	if upstreamStatus := apiResponse.statusCode(); upstreamStatus > 0 && (upstreamStatus < 200 || upstreamStatus >= 300) {
		status = cliproxyapi.QuotaRuntimeStatusStale
		view := mapAccountsdomainCodexQuotaResponse(quota)
		view.Status = status
		view.Stale = true
		view.DegradedReason = quotaUpstreamFailureReason(upstreamStatus, apiResponse.Body)
		return a.upsertCodexQuotaRuntimeIfUnified(authIndex, "auth-file-usage", status, view)
	}
	return a.upsertAccountsdomainCodexQuotaRuntimeIfUnified(authIndex, "auth-file-usage", status, quota)
}

func (a *App) getUnifiedCodexAPIKeyQuota(account *cliproxyapi.UnifiedAccount) (*CodexQuotaResponse, error) {
	if account == nil || account.Kind != cliproxyapi.AccountKindCodexAPIKey || account.CodexAPIKey == nil {
		return nil, errors.New("账号不存在")
	}
	credential := account.CodexAPIKey
	target := cliproxyAPIKeyQuotaSource{
		APIKey:       strings.TrimSpace(credential.APIKey),
		BaseURL:      strings.TrimSpace(credential.BaseURL),
		Prefix:       strings.TrimSpace(credential.Prefix),
		QuotaCurl:    strings.TrimSpace(credential.QuotaCurl),
		QuotaEnabled: credential.QuotaEnabled,
	}
	if target.APIKey == "" {
		return nil, errors.New("codex api key 为空")
	}
	if !target.QuotaEnabled || target.QuotaCurl == "" {
		return nil, errors.New("codex api key 未配置额度 curl")
	}
	state, err := a.managementClient().RefreshQuota(account.AccountKey, true, false)
	if err != nil {
		if cachedState, cacheErr := a.managementClient().GetQuotaStatus(account.AccountKey); cacheErr == nil && quotaRuntimeStateHasDisplayQuota(cachedState) {
			return mapQuotaRuntimeStateToCodexQuotaResponse(markQuotaRuntimeStateStaleFromError(cachedState, err)), nil
		}
		return nil, err
	}
	return mapQuotaRuntimeStateToCodexQuotaResponse(state), nil
}

func mapAccountsdomainCodexQuotaResponse(quota *accountsdomain.CodexQuotaResponse) *CodexQuotaResponse {
	if quota == nil {
		return &CodexQuotaResponse{}
	}

	windows := make([]CodexQuotaWindow, 0, len(quota.Windows))
	for _, window := range quota.Windows {
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

	return &CodexQuotaResponse{
		Status:   cliproxyapi.QuotaRuntimeStatusSuccess,
		PlanType: quota.PlanType,
		Windows:  windows,
		Billing:  mapAccountsdomainCodexQuotaBilling(quota.Billing),
		Sources:  []CodexQuotaSourceState{},
	}
}

func mapAccountsdomainCodexQuotaBilling(billing *accountsdomain.CodexQuotaBilling) *CodexQuotaBillingInfo {
	if billing == nil {
		return nil
	}
	infos := make([]CodexQuotaBillingBalanceInfo, 0, len(billing.BalanceInfos))
	for _, info := range billing.BalanceInfos {
		infos = append(infos, CodexQuotaBillingBalanceInfo{
			Currency:        info.Currency,
			TotalBalance:    info.TotalBalance,
			GrantedBalance:  info.GrantedBalance,
			ToppedUpBalance: info.ToppedUpBalance,
		})
	}
	return &CodexQuotaBillingInfo{
		IsAvailable:  billing.IsAvailable,
		BalanceInfos: infos,
	}
}

func (a *App) upsertAccountsdomainCodexQuotaRuntimeIfUnified(accountKey string, source string, status string, quota *accountsdomain.CodexQuotaResponse) (*CodexQuotaResponse, error) {
	return a.upsertCodexQuotaRuntimeIfUnified(accountKey, source, status, mapAccountsdomainCodexQuotaResponse(quota))
}

func (a *App) upsertCodexQuotaRuntimeIfUnified(accountKey string, source string, status string, quota *CodexQuotaResponse) (*CodexQuotaResponse, error) {
	if !isUnifiedAccountID(accountKey) {
		return quota, nil
	}
	state, err := a.managementClient().UpsertQuotaStatus(accountKey, quotaRuntimeStateFromCodexQuotaResponse(accountKey, source, status, quota))
	if err != nil {
		return nil, err
	}
	return mapQuotaRuntimeStateToCodexQuotaResponse(state), nil
}

func quotaRuntimeStateFromCodexQuotaResponse(accountKey string, source string, status string, quota *CodexQuotaResponse) cliproxyapi.QuotaRuntimeState {
	if quota == nil {
		quota = &CodexQuotaResponse{Windows: []CodexQuotaWindow{}}
	}
	if strings.TrimSpace(status) == "" {
		status = cliproxyapi.QuotaRuntimeStatusSuccess
	}
	windows := make([]cliproxyapi.QuotaRuntimeWindow, 0, len(quota.Windows))
	for _, window := range quota.Windows {
		windows = append(windows, cliproxyapi.QuotaRuntimeWindow{
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
	return cliproxyapi.QuotaRuntimeState{
		AccountKey:     strings.TrimSpace(accountKey),
		Source:         strings.TrimSpace(source),
		Status:         strings.TrimSpace(status),
		PlanType:       quota.PlanType,
		Windows:        windows,
		Billing:        quotaRuntimeBillingFromCodexQuotaResponse(quota.Billing),
		Stale:          quota.Stale,
		DegradedReason: strings.TrimSpace(quota.DegradedReason),
	}
}

func quotaUpstreamFailureReason(statusCode int, body string) string {
	prefix := fmt.Sprintf("ChatGPT usage request failed (%d)", statusCode)
	message, code := quotaUpstreamErrorMessage(body)
	if message == "" {
		return prefix
	}
	if code != "" {
		return fmt.Sprintf("%s: %s (%s)", prefix, message, code)
	}
	return fmt.Sprintf("%s: %s", prefix, message)
}

func quotaUpstreamErrorMessage(body string) (string, string) {
	var payload struct {
		Message string `json:"message"`
		Code    string `json:"code"`
		Error   struct {
			Message string `json:"message"`
			Code    string `json:"code"`
			Type    string `json:"type"`
		} `json:"error"`
	}
	if err := json.Unmarshal([]byte(strings.TrimSpace(body)), &payload); err != nil {
		return "", ""
	}
	message := strings.TrimSpace(payload.Error.Message)
	if message == "" {
		message = strings.TrimSpace(payload.Message)
	}
	code := strings.TrimSpace(payload.Error.Code)
	if code == "" {
		code = strings.TrimSpace(payload.Code)
	}
	if code == "" {
		code = strings.TrimSpace(payload.Error.Type)
	}
	return message, code
}

func quotaRuntimeBillingFromCodexQuotaResponse(billing *CodexQuotaBillingInfo) *cliproxyapi.QuotaRuntimeBilling {
	if billing == nil {
		return nil
	}
	infos := make([]cliproxyapi.QuotaRuntimeBalanceInfo, 0, len(billing.BalanceInfos))
	for _, info := range billing.BalanceInfos {
		infos = append(infos, cliproxyapi.QuotaRuntimeBalanceInfo{
			Currency:        info.Currency,
			TotalBalance:    info.TotalBalance,
			GrantedBalance:  info.GrantedBalance,
			ToppedUpBalance: info.ToppedUpBalance,
		})
	}
	return &cliproxyapi.QuotaRuntimeBilling{
		IsAvailable:  billing.IsAvailable,
		BalanceInfos: infos,
	}
}

func mapQuotaRuntimeStateToCodexQuotaResponse(state *cliproxyapi.QuotaRuntimeState) *CodexQuotaResponse {
	if state == nil {
		return &CodexQuotaResponse{Windows: []CodexQuotaWindow{}}
	}
	windows := make([]CodexQuotaWindow, 0, len(state.Windows))
	for _, window := range state.Windows {
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
	return &CodexQuotaResponse{
		AccountKey:      state.AccountKey,
		Source:          state.Source,
		Status:          state.Status,
		PlanType:        state.PlanType,
		Windows:         windows,
		Billing:         mapQuotaRuntimeBillingToCodexQuotaResponse(state.Billing),
		UpdatedAt:       state.UpdatedAt,
		LastEvaluatedAt: state.LastEvaluatedAt,
		Stale:           state.Stale,
		DegradedReason:  state.DegradedReason,
		Blocked:         state.Blocked,
		BlockReason:     state.BlockReason,
		Sources:         mapQuotaRuntimeSourcesToCodexQuotaResponse(state.Sources),
	}
}

func mapQuotaRuntimeSourcesToCodexQuotaResponse(sources []cliproxyapi.QuotaRuntimeSourceState) []CodexQuotaSourceState {
	out := make([]CodexQuotaSourceState, 0, len(sources))
	for _, source := range sources {
		out = append(out, CodexQuotaSourceState{
			Source:    source.Source,
			Reason:    source.Reason,
			ExpiresAt: source.ExpiresAt,
			NextReset: source.NextReset,
		})
	}
	return out
}

func mapQuotaRuntimeBillingToCodexQuotaResponse(billing *cliproxyapi.QuotaRuntimeBilling) *CodexQuotaBillingInfo {
	if billing == nil {
		return nil
	}
	infos := make([]CodexQuotaBillingBalanceInfo, 0, len(billing.BalanceInfos))
	for _, info := range billing.BalanceInfos {
		infos = append(infos, CodexQuotaBillingBalanceInfo{
			Currency:        info.Currency,
			TotalBalance:    info.TotalBalance,
			GrantedBalance:  info.GrantedBalance,
			ToppedUpBalance: info.ToppedUpBalance,
		})
	}
	return &CodexQuotaBillingInfo{
		IsAvailable:  billing.IsAvailable,
		BalanceInfos: infos,
	}
}

func quotaRuntimeStateHasDisplayQuota(state *cliproxyapi.QuotaRuntimeState) bool {
	if state == nil {
		return false
	}
	if strings.TrimSpace(state.PlanType) != "" || len(state.Windows) > 0 {
		return true
	}
	return state.Billing != nil && (state.Billing.IsAvailable || len(state.Billing.BalanceInfos) > 0)
}

func markQuotaRuntimeStateStaleFromError(state *cliproxyapi.QuotaRuntimeState, err error) *cliproxyapi.QuotaRuntimeState {
	if state == nil {
		return nil
	}
	next := *state
	next.Windows = append([]cliproxyapi.QuotaRuntimeWindow(nil), state.Windows...)
	next.Sources = append([]cliproxyapi.QuotaRuntimeSourceState(nil), state.Sources...)
	next.Status = cliproxyapi.QuotaRuntimeStatusStale
	next.Stale = true
	if err != nil {
		reason := strings.TrimSpace(err.Error())
		if existing := strings.TrimSpace(next.DegradedReason); existing != "" {
			if reason != "" && !strings.Contains(existing, reason) {
				next.DegradedReason = existing + "; " + reason
			}
		} else if reason != "" {
			next.DegradedReason = reason
		}
	}
	return &next
}

type TestCodexAPIKeyQuotaCurlInput struct {
	APIKey         string            `json:"apiKey"`
	BaseURL        string            `json:"baseUrl"`
	Prefix         string            `json:"prefix,omitempty"`
	QuotaCurl      string            `json:"quotaCurl"`
	PlatformCookie string            `json:"platformCookie,omitempty"`
	CurlVariables  map[string]string `json:"curlVariables,omitempty"`
}

func (a *App) TestCodexAPIKeyQuotaCurl(input TestCodexAPIKeyQuotaCurlInput) (*CodexQuotaResponse, error) {
	source := cliproxyAPIKeyQuotaSource{
		APIKey:         strings.TrimSpace(input.APIKey),
		BaseURL:        strings.TrimSpace(input.BaseURL),
		Prefix:         strings.TrimSpace(input.Prefix),
		QuotaCurl:      strings.TrimSpace(input.QuotaCurl),
		QuotaEnabled:   true,
		PlatformCookie: normalizePlatformCookie(input.PlatformCookie),
		CurlVariables:  normalizeQuotaCurlVariables(input.CurlVariables, input.PlatformCookie),
	}
	if source.APIKey == "" {
		return nil, errors.New("api key 不能为空")
	}
	if source.BaseURL == "" {
		return nil, errors.New("base url 不能为空")
	}
	if source.QuotaCurl == "" {
		return nil, errors.New("quota curl 不能为空")
	}
	return a.executeCodexAPIKeyQuotaRequest(source)
}

func (a *App) executeCodexAPIKeyQuotaRequest(source cliproxyAPIKeyQuotaSource) (*CodexQuotaResponse, error) {
	state, err := a.managementClient().TestQuotaCurl(cliproxyapi.QuotaCurlTestInput{
		APIKey:         strings.TrimSpace(source.APIKey),
		BaseURL:        strings.TrimSpace(source.BaseURL),
		Prefix:         strings.TrimSpace(source.Prefix),
		QuotaCurl:      strings.TrimSpace(source.QuotaCurl),
		PlatformCookie: strings.TrimSpace(source.PlatformCookie),
		CurlVariables:  source.CurlVariables,
	})
	if err != nil {
		return nil, err
	}
	return mapQuotaRuntimeStateToCodexQuotaResponse(state), nil
}

type cliproxyAPIKeyQuotaSource struct {
	APIKey         string
	BaseURL        string
	Prefix         string
	QuotaCurl      string
	QuotaEnabled   bool
	PlatformCookie string
	CurlVariables  map[string]string
}

func normalizeQuotaCurlVariables(values map[string]string, platformCookie string) map[string]string {
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

func parseDebugResponse(body string) interface{} {
	trimmed := strings.TrimSpace(body)
	if trimmed == "" {
		return ""
	}
	var payload interface{}
	if err := json.Unmarshal([]byte(trimmed), &payload); err == nil {
		return payload
	}
	return trimmed
}

func (a *App) TestCodexAPIKeyBillingCurl(input TestCodexAPIKeyQuotaCurlInput) (*CodexQuotaBillingInfo, error) {
	source := cliproxyAPIKeyQuotaSource{
		APIKey:         strings.TrimSpace(input.APIKey),
		BaseURL:        strings.TrimSpace(input.BaseURL),
		Prefix:         strings.TrimSpace(input.Prefix),
		QuotaCurl:      strings.TrimSpace(input.QuotaCurl),
		QuotaEnabled:   true,
		PlatformCookie: normalizePlatformCookie(input.PlatformCookie),
		CurlVariables:  normalizeQuotaCurlVariables(input.CurlVariables, input.PlatformCookie),
	}
	if source.APIKey == "" {
		return nil, errors.New("api key 不能为空")
	}
	if source.QuotaCurl == "" {
		return nil, errors.New("billing curl 不能为空")
	}

	state, err := a.managementClient().TestBillingCurl(cliproxyapi.QuotaCurlTestInput{
		APIKey:         strings.TrimSpace(source.APIKey),
		BaseURL:        strings.TrimSpace(source.BaseURL),
		Prefix:         strings.TrimSpace(source.Prefix),
		BillingCurl:    strings.TrimSpace(source.QuotaCurl),
		PlatformCookie: strings.TrimSpace(source.PlatformCookie),
		CurlVariables:  source.CurlVariables,
	})
	if err != nil {
		return nil, err
	}
	if state == nil || state.Billing == nil {
		return nil, errors.New("无法解析计费信息，响应格式不支持")
	}
	return mapQuotaRuntimeBillingToCodexQuotaResponse(state.Billing), nil
}

func toJSONString(value interface{}) string {
	if value == nil {
		return ""
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return ""
	}
	return string(encoded)
}
