package wailsapp

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
)

func (a *App) GetCodexQuota(name string) (*CodexQuotaResponse, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("name 不能为空")
	}
	if strings.HasPrefix(name, "codex-api-key:") {
		return a.getCodexAPIKeyQuota(name)
	}

	authFile, err := a.getRawAuthFileByName(name)
	if err != nil {
		return nil, err
	}

	body, err := a.downloadAuthFileBody(name)
	if err != nil {
		return nil, err
	}

	requestInfo, err := accountsdomain.ResolveCodexQuotaRequestInfo(body)
	if err != nil {
		return nil, err
	}
	authIndex := normalizeAuthIndex(authFile.AuthIndex)
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
		PlanType: quota.PlanType,
		Windows:  windows,
	}, nil
}

func (a *App) getCodexAPIKeyQuota(id string) (*CodexQuotaResponse, error) {
	items, err := loadStoredCodexAPIKeys()
	if err != nil {
		return nil, err
	}

	var target *cliproxyAPIKeyQuotaSource
	for _, item := range items {
		if !codexAPIKeyInputMatchesID(item, id) {
			continue
		}
		target = &cliproxyAPIKeyQuotaSource{
			APIKey:       item.APIKey,
			BaseURL:      item.BaseURL,
			Prefix:       item.Prefix,
			QuotaCurl:    item.QuotaCurl,
			QuotaEnabled: item.QuotaEnabled,
		}
		break
	}
	if target == nil {
		return nil, errors.New("账号不存在")
	}
	if !target.QuotaEnabled || strings.TrimSpace(target.QuotaCurl) == "" {
		return nil, errors.New("codex api key 未配置额度 curl")
	}

	return a.executeCodexAPIKeyQuotaRequest(*target)
}

type TestCodexAPIKeyQuotaCurlInput struct {
	APIKey    string `json:"apiKey"`
	BaseURL   string `json:"baseUrl"`
	Prefix    string `json:"prefix,omitempty"`
	QuotaCurl string `json:"quotaCurl"`
}

func (a *App) TestCodexAPIKeyQuotaCurl(input TestCodexAPIKeyQuotaCurlInput) (*CodexQuotaResponse, error) {
	source := cliproxyAPIKeyQuotaSource{
		APIKey:       strings.TrimSpace(input.APIKey),
		BaseURL:      strings.TrimSpace(input.BaseURL),
		Prefix:       strings.TrimSpace(input.Prefix),
		QuotaCurl:    strings.TrimSpace(input.QuotaCurl),
		QuotaEnabled: true,
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
	curlRequest, err := accountsdomain.BuildCodexQuotaCurlRequest(accountsdomain.CodexQuotaCurlInput{
		Curl:    source.QuotaCurl,
		APIKey:  source.APIKey,
		BaseURL: source.BaseURL,
		Prefix:  source.Prefix,
	})
	if err != nil {
		return nil, err
	}

	startedAt := time.Now()
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	var body io.Reader
	if strings.TrimSpace(curlRequest.Body) != "" {
		body = strings.NewReader(curlRequest.Body)
	}
	debugURL := accountsdomain.RedactCodexQuotaCurlURL(curlRequest.URL, source.APIKey)
	debugHeaders := accountsdomain.RedactCodexQuotaCurlHeaders(curlRequest.Headers)
	req, err := http.NewRequestWithContext(ctx, curlRequest.Method, curlRequest.URL, body)
	if err != nil {
		return nil, err
	}
	for key, value := range curlRequest.Headers {
		req.Header.Set(key, value)
	}

	resp, err := (&http.Client{Timeout: 20 * time.Second}).Do(req)
	if err != nil {
		a.emitCodexQuotaDebugRecord(accountsdomain.CodexQuotaDebugRecord{
			Request: accountsdomain.CodexQuotaDebugRequest{
				Method:  curlRequest.Method,
				URL:     debugURL,
				Headers: debugHeaders,
			},
			Error:      err.Error(),
			StartedAt:  startedAt,
			EndedAt:    time.Now(),
			DurationMs: time.Since(startedAt).Milliseconds(),
		})
		return nil, codexQuotaCurlErrorWithIgnoredOptions(err, curlRequest.IgnoredOptions)
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		a.emitCodexQuotaDebugRecord(accountsdomain.CodexQuotaDebugRecord{
			Request: accountsdomain.CodexQuotaDebugRequest{
				Method:  curlRequest.Method,
				URL:     debugURL,
				Headers: debugHeaders,
			},
			Error:      err.Error(),
			StartedAt:  startedAt,
			EndedAt:    time.Now(),
			DurationMs: time.Since(startedAt).Milliseconds(),
			StatusCode: resp.StatusCode,
		})
		return nil, err
	}

	debugRecord := accountsdomain.CodexQuotaDebugRecord{
		Request: accountsdomain.CodexQuotaDebugRequest{
			Method:  curlRequest.Method,
			URL:     debugURL,
			Headers: debugHeaders,
		},
		Response:   parseDebugResponse(string(responseBody)),
		StartedAt:  startedAt,
		EndedAt:    time.Now(),
		DurationMs: time.Since(startedAt).Milliseconds(),
		StatusCode: resp.StatusCode,
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		debugRecord.Error = "codex api key 额度请求失败"
		a.emitCodexQuotaDebugRecord(debugRecord)
		return nil, codexQuotaCurlErrorWithIgnoredOptions(errors.New("codex api key 额度请求失败"), curlRequest.IgnoredOptions)
	}

	quota, err := accountsdomain.BuildCodexQuotaResponseFromUsagePayload(responseBody, "")
	if err != nil {
		debugRecord.Error = err.Error()
		a.emitCodexQuotaDebugRecord(debugRecord)
		return nil, codexQuotaCurlErrorWithIgnoredOptions(err, curlRequest.IgnoredOptions)
	}
	a.emitCodexQuotaDebugRecord(debugRecord)

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
	var billing *CodexQuotaBillingInfo
	if quota.Billing != nil {
		infos := make([]CodexQuotaBillingBalanceInfo, 0, len(quota.Billing.BalanceInfos))
		for _, info := range quota.Billing.BalanceInfos {
			infos = append(infos, CodexQuotaBillingBalanceInfo{
				Currency:        info.Currency,
				TotalBalance:    info.TotalBalance,
				GrantedBalance:  info.GrantedBalance,
				ToppedUpBalance: info.ToppedUpBalance,
			})
		}
		billing = &CodexQuotaBillingInfo{
			IsAvailable:  quota.Billing.IsAvailable,
			BalanceInfos: infos,
		}
	}
	return &CodexQuotaResponse{
		PlanType: quota.PlanType,
		Windows:  windows,
		Billing:  billing,
	}, nil
}

func codexQuotaCurlErrorWithIgnoredOptions(err error, ignoredOptions []string) error {
	if err == nil {
		return nil
	}
	if hint := accountsdomain.CodexQuotaCurlIgnoredOptionsHint(ignoredOptions); hint != "" {
		return fmt.Errorf("%w。%s", err, hint)
	}
	return err
}

type cliproxyAPIKeyQuotaSource struct {
	APIKey       string
	BaseURL      string
	Prefix       string
	QuotaCurl    string
	QuotaEnabled bool
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
		APIKey:       strings.TrimSpace(input.APIKey),
		BaseURL:      strings.TrimSpace(input.BaseURL),
		Prefix:       strings.TrimSpace(input.Prefix),
		QuotaCurl:    strings.TrimSpace(input.QuotaCurl),
		QuotaEnabled: true,
	}
	if source.APIKey == "" {
		return nil, errors.New("api key 不能为空")
	}
	if source.QuotaCurl == "" {
		return nil, errors.New("billing curl 不能为空")
	}

	curlRequest, err := accountsdomain.BuildCodexQuotaCurlRequest(accountsdomain.CodexQuotaCurlInput{
		Curl:    source.QuotaCurl,
		APIKey:  source.APIKey,
		BaseURL: source.BaseURL,
		Prefix:  source.Prefix,
	})
	if err != nil {
		return nil, err
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	var body io.Reader
	if strings.TrimSpace(curlRequest.Body) != "" {
		body = strings.NewReader(curlRequest.Body)
	}
	req, err := http.NewRequestWithContext(ctx, curlRequest.Method, curlRequest.URL, body)
	if err != nil {
		return nil, err
	}
	for key, value := range curlRequest.Headers {
		req.Header.Set(key, value)
	}

	resp, err := (&http.Client{Timeout: 20 * time.Second}).Do(req)
	if err != nil {
		return nil, codexQuotaCurlErrorWithIgnoredOptions(err, curlRequest.IgnoredOptions)
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	billing := accountsdomain.TryParseBillingResponse(responseBody)
	if billing == nil {
		return nil, codexQuotaCurlErrorWithIgnoredOptions(errors.New("无法解析计费信息，响应格式不支持"), curlRequest.IgnoredOptions)
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
	}, nil
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
