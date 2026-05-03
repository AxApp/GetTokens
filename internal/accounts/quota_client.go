package accounts

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

func GetCodexQuota(ctx context.Context, authFileBody []byte, timeout time.Duration, observer func(CodexQuotaDebugRecord)) (*CodexQuotaResponse, error) {
	authFile, err := parseCodexAuthFile(authFileBody)
	if err != nil {
		return nil, err
	}

	cachedQuota := parseCachedCodexQuota(authFileBody)

	if authFile.AccessToken == "" {
		if cachedQuota != nil {
			return cachedQuota, nil
		}
		return nil, errors.New("codex 凭证缺少 access_token")
	}
	if authFile.ChatGPTAccountID == "" {
		if cachedQuota != nil {
			return cachedQuota, nil
		}
		return nil, errors.New("codex 凭证缺少 chatgpt_account_id")
	}

	payload, err := fetchCodexQuotaPayload(ctx, authFile.AccessToken, authFile.ChatGPTAccountID, timeout, observer)
	if err != nil {
		if cachedQuota != nil {
			return cachedQuota, nil
		}
		return nil, err
	}

	result := &CodexQuotaResponse{
		PlanType: normalizePlanType(firstNonEmpty(payload.PlanType, payload.PlanTypeCamel, authFile.PlanType)),
		Windows:  buildCodexQuotaWindows(payload),
	}
	if cachedQuota != nil {
		if result.PlanType == "" {
			result.PlanType = cachedQuota.PlanType
		}
		if len(result.Windows) == 0 {
			result.Windows = cachedQuota.Windows
		}
	}
	return result, nil
}

func ResolveCodexQuotaRequestInfo(authFileBody []byte) (*CodexQuotaRequestInfo, error) {
	authFile, err := parseCodexAuthFile(authFileBody)
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(authFile.ChatGPTAccountID) == "" {
		return nil, errors.New("codex 凭证缺少 chatgpt_account_id")
	}

	return &CodexQuotaRequestInfo{
		ChatGPTAccountID: authFile.ChatGPTAccountID,
		PlanType:         authFile.PlanType,
	}, nil
}

func BuildCodexQuotaResponse(authFileBody []byte, usagePayloadBody []byte) (*CodexQuotaResponse, error) {
	authFile, err := parseCodexAuthFile(authFileBody)
	if err != nil {
		return nil, err
	}

	var payload codexUsagePayload
	if err := json.Unmarshal(usagePayloadBody, &payload); err != nil {
		return nil, fmt.Errorf("codex 额度响应解析失败: %w", err)
	}

	cachedQuota := parseCachedCodexQuota(authFileBody)
	result := &CodexQuotaResponse{
		PlanType: normalizePlanType(firstNonEmpty(payload.PlanType, payload.PlanTypeCamel, authFile.PlanType)),
		Windows:  buildCodexQuotaWindows(&payload),
	}
	if cachedQuota != nil {
		if result.PlanType == "" {
			result.PlanType = cachedQuota.PlanType
		}
		if len(result.Windows) == 0 {
			result.Windows = cachedQuota.Windows
		}
	}
	return result, nil
}

func fetchCodexQuotaPayload(ctx context.Context, accessToken string, accountID string, timeout time.Duration, observer func(CodexQuotaDebugRecord)) (*codexUsagePayload, error) {
	startedAt := time.Now()
	req, err := http.NewRequestWithContext(ctxOrBackground(ctx), http.MethodGet, codexUsageURL, nil)
	if err != nil {
		return nil, err
	}

	requestHeaders := codexQuotaRequestHeaders(accessToken, accountID)
	for key, value := range requestHeaders {
		req.Header.Set(key, value)
	}

	client := &http.Client{Timeout: timeout}
	resp, err := client.Do(req)
	if err != nil {
		emitCodexQuotaDebugRecord(observer, CodexQuotaDebugRecord{
			Request: CodexQuotaDebugRequest{
				Method:  http.MethodGet,
				URL:     codexUsageURL,
				Headers: redactCodexQuotaHeaders(requestHeaders),
			},
			Error:      err.Error(),
			StartedAt:  startedAt,
			EndedAt:    time.Now(),
			DurationMs: time.Since(startedAt).Milliseconds(),
		})
		return nil, err
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		emitCodexQuotaDebugRecord(observer, CodexQuotaDebugRecord{
			Request: CodexQuotaDebugRequest{
				Method:  http.MethodGet,
				URL:     codexUsageURL,
				Headers: redactCodexQuotaHeaders(requestHeaders),
			},
			Error:      err.Error(),
			StartedAt:  startedAt,
			EndedAt:    time.Now(),
			DurationMs: time.Since(startedAt).Milliseconds(),
			StatusCode: resp.StatusCode,
		})
		return nil, err
	}

	responsePayload := parseCodexQuotaDebugResponse(responseBody)

	var payload codexUsagePayload
	if err := json.Unmarshal(responseBody, &payload); err != nil {
		emitCodexQuotaDebugRecord(observer, CodexQuotaDebugRecord{
			Request: CodexQuotaDebugRequest{
				Method:  http.MethodGet,
				URL:     codexUsageURL,
				Headers: redactCodexQuotaHeaders(requestHeaders),
			},
			Response:   responsePayload,
			Error:      fmt.Sprintf("codex 额度响应解析失败: %v", err),
			StartedAt:  startedAt,
			EndedAt:    time.Now(),
			DurationMs: time.Since(startedAt).Milliseconds(),
			StatusCode: resp.StatusCode,
		})
		return nil, fmt.Errorf("codex 额度响应解析失败: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		emitCodexQuotaDebugRecord(observer, CodexQuotaDebugRecord{
			Request: CodexQuotaDebugRequest{
				Method:  http.MethodGet,
				URL:     codexUsageURL,
				Headers: redactCodexQuotaHeaders(requestHeaders),
			},
			Response:   responsePayload,
			Error:      fmt.Sprintf("codex 额度请求失败 (%d)", resp.StatusCode),
			StartedAt:  startedAt,
			EndedAt:    time.Now(),
			DurationMs: time.Since(startedAt).Milliseconds(),
			StatusCode: resp.StatusCode,
		})
		return nil, fmt.Errorf("codex 额度请求失败 (%d)", resp.StatusCode)
	}

	emitCodexQuotaDebugRecord(observer, CodexQuotaDebugRecord{
		Request: CodexQuotaDebugRequest{
			Method:  http.MethodGet,
			URL:     codexUsageURL,
			Headers: redactCodexQuotaHeaders(requestHeaders),
		},
		Response:   responsePayload,
		StartedAt:  startedAt,
		EndedAt:    time.Now(),
		DurationMs: time.Since(startedAt).Milliseconds(),
		StatusCode: resp.StatusCode,
	})

	return &payload, nil
}

func codexQuotaRequestHeaders(accessToken string, accountID string) map[string]string {
	return map[string]string{
		"Authorization":      "Bearer " + accessToken,
		"chatgpt-account-id": accountID,
		"Accept":             "application/json",
	}
}

func ctxOrBackground(ctx context.Context) context.Context {
	if ctx != nil {
		return ctx
	}
	return context.Background()
}
