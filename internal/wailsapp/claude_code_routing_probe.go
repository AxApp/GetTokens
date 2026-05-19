package wailsapp

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
)

type ProbeClaudeCodeAccountRoutingInput struct {
	Model           string   `json:"model"`
	Attempts        int      `json:"attempts,omitempty"`
	AllowAccountIDs []string `json:"allowAccountIDs,omitempty"`
	DenyAccountIDs  []string `json:"denyAccountIDs,omitempty"`
	OrderAccountIDs []string `json:"orderAccountIDs,omitempty"`
	AllowFallback   bool     `json:"allowFallback,omitempty"`
}

type ClaudeCodeAccountRoutingProbeResult struct {
	Model    string                                 `json:"model"`
	Attempts []ClaudeCodeAccountRoutingProbeAttempt `json:"attempts"`
}

type ClaudeCodeAccountRoutingProbeAttempt struct {
	Index        int    `json:"index"`
	Success      bool   `json:"success"`
	StatusCode   int    `json:"statusCode,omitempty"`
	AccountID    string `json:"accountID,omitempty"`
	AccountLabel string `json:"accountLabel,omitempty"`
	Provider     string `json:"provider,omitempty"`
	Message      string `json:"message,omitempty"`
	Evidence     string `json:"evidence,omitempty"`
	ResponseBody string `json:"responseBody,omitempty"`
	StartedAt    string `json:"startedAt,omitempty"`
	FinishedAt   string `json:"finishedAt,omitempty"`
}

func (a *App) ProbeClaudeCodeAccountRouting(input ProbeClaudeCodeAccountRoutingInput) (*ClaudeCodeAccountRoutingProbeResult, error) {
	model := strings.TrimSpace(input.Model)
	if model == "" {
		return nil, errors.New("model 不能为空")
	}

	attempts := input.Attempts
	if attempts <= 0 {
		attempts = 1
	}
	if attempts > 5 {
		attempts = 5
	}

	relayKey, err := a.firstRelayAPIKey()
	if err != nil {
		return nil, err
	}

	candidates, err := a.loadClaudeCodeRoutingProbeCandidates()
	if err != nil {
		return nil, err
	}
	if len(candidates) == 0 {
		return nil, errors.New("没有可用于探测的 Claude Code 账号")
	}

	result := &ClaudeCodeAccountRoutingProbeResult{
		Model:    model,
		Attempts: make([]ClaudeCodeAccountRoutingProbeAttempt, 0, attempts),
	}
	routeHeaders := buildClaudeCodeRoutingRouteHeaders(input, candidates)
	for index := 0; index < attempts; index++ {
		result.Attempts = append(result.Attempts, a.runClaudeCodeRoutingProbeAttempt(index+1, model, relayKey, candidates, routeHeaders))
	}
	return result, nil
}

func (a *App) loadClaudeCodeRoutingProbeCandidates() ([]codexRoutingProbeCandidate, error) {
	accounts, err := a.ListAccounts()
	if err != nil {
		return nil, err
	}

	candidates := make([]codexRoutingProbeCandidate, 0, len(accounts))
	for _, account := range accounts {
		if account.Disabled || !codexRoutingRecordRequestable(account.Status) || !supportsAnthropicFormat(account.SupportedFormats) {
			continue
		}
		if account.CredentialSource == accountsdomain.CredentialSourceAuthFile {
			name := strings.TrimSpace(account.Name)
			if name == "" && strings.HasPrefix(account.ID, "auth-file:") {
				name = strings.TrimPrefix(account.ID, "auth-file:")
			}
			if name == "" {
				continue
			}
			candidates = append(candidates, codexRoutingProbeCandidate{
				ID:        account.ID,
				Label:     firstNonEmptyString(account.DisplayName, account.Email, name),
				Provider:  strings.TrimSpace(account.Provider),
				Priority:  account.Priority,
				UsageKeys: []string{"auth-file:" + name},
				RouteIDs:  []string{name},
			})
			continue
		}

		apiKeys := normalizeRoutingAPIKeys(append([]string{account.APIKey}, account.APIKeys...))
		if len(apiKeys) == 0 {
			continue
		}
		provider := strings.ToLower(strings.TrimSpace(account.Provider))
		if provider == "" {
			provider = "codex"
		}
		baseURL := claudeCodeAccountRequestBaseURL(account)
		usageKeys := make([]string, 0, len(apiKeys))
		routeIDs := make([]string, 0, len(apiKeys))
		routeKind := "codex:apikey"
		if strings.HasPrefix(account.ID, "openai-compatible:") {
			routeKind = "openai-compatibility:" + provider
		}
		for _, apiKey := range apiKeys {
			usageKeys = append(usageKeys, buildCodexRoutingAPIUsageKey(provider, baseURL, apiKey))
			if strings.HasPrefix(account.ID, "openai-compatible:") {
				routeIDs = append(routeIDs, buildStableRouteAuthID(routeKind, apiKey, baseURL, account.ProxyURL))
			} else {
				routeIDs = append(routeIDs, buildStableRouteAuthID(routeKind, apiKey, baseURL))
			}
		}
		candidates = append(candidates, codexRoutingProbeCandidate{
			ID:        account.ID,
			Label:     firstNonEmptyString(account.DisplayName, account.KeySuffix, account.ID),
			Provider:  provider,
			Priority:  account.Priority,
			UsageKeys: usageKeys,
			RouteIDs:  normalizeCodexRouteIDList(routeIDs),
		})
	}

	sort.SliceStable(candidates, func(i, j int) bool {
		if candidates[i].Priority != candidates[j].Priority {
			return candidates[i].Priority > candidates[j].Priority
		}
		return candidates[i].ID < candidates[j].ID
	})
	return candidates, nil
}

func normalizeRoutingAPIKeys(items []string) []string {
	out := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		trimmed := strings.TrimSpace(item)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		out = append(out, trimmed)
	}
	return out
}

func buildClaudeCodeRoutingRouteHeaders(input ProbeClaudeCodeAccountRoutingInput, candidates []codexRoutingProbeCandidate) map[string]string {
	return buildCodexRoutingRouteHeaders(ProbeCodexAccountRoutingInput{
		Model:           input.Model,
		Attempts:        input.Attempts,
		AllowAccountIDs: append([]string(nil), input.AllowAccountIDs...),
		DenyAccountIDs:  append([]string(nil), input.DenyAccountIDs...),
		OrderAccountIDs: append([]string(nil), input.OrderAccountIDs...),
		AllowFallback:   input.AllowFallback,
	}, candidates)
}

func (a *App) runClaudeCodeRoutingProbeAttempt(index int, model string, relayKey string, candidates []codexRoutingProbeCandidate, routeHeaders map[string]string) ClaudeCodeAccountRoutingProbeAttempt {
	startedAt := time.Now()
	attempt := ClaudeCodeAccountRoutingProbeAttempt{
		Index:     index,
		StartedAt: startedAt.Format(time.RFC3339),
	}

	before := a.captureCodexRoutingUsage(candidates)
	payloadBody, err := json.Marshal(map[string]any{
		"model":      model,
		"max_tokens": 1,
		"messages":   []map[string]string{{"role": "user", "content": "Reply OK."}},
	})
	if err != nil {
		attempt.Message = err.Error()
		attempt.FinishedAt = time.Now().Format(time.RFC3339)
		return attempt
	}

	responseBody, statusCode, _, err := a.SidecarRelayRequestWithHeaders(
		http.MethodPost,
		"/v1/messages",
		bytes.NewReader(payloadBody),
		"application/json",
		relayKey,
		routeHeaders,
	)
	attempt.StatusCode = statusCode
	attempt.Success = err == nil && statusCode >= 200 && statusCode < 300
	attempt.ResponseBody = trimRoutingProbeResponseBody(responseBody)
	if err != nil {
		attempt.Message = err.Error()
	} else if attempt.Success {
		attempt.Message = "Claude Code 测试请求完成"
	} else {
		attempt.Message = fmt.Sprintf("Claude Code 测试请求返回 HTTP %d", statusCode)
	}

	after := a.captureCodexRoutingUsage(candidates)
	if candidate, delta, ok := detectCodexRoutingProbeHit(before, after, candidates); ok {
		attempt.AccountID = candidate.ID
		attempt.AccountLabel = candidate.Label
		attempt.Provider = candidate.Provider
		attempt.Evidence = fmt.Sprintf("recent requests +%d", delta)
	} else if attempt.Message == "" {
		attempt.Message = "请求完成，但未能从 recent requests 中识别命中账号"
	}
	attempt.FinishedAt = time.Now().Format(time.RFC3339)
	return attempt
}

func supportsAnthropicFormat(formats []string) bool {
	for _, item := range formats {
		if strings.EqualFold(strings.TrimSpace(item), accountsdomain.APIFmtAnthropic) {
			return true
		}
	}
	return false
}

func claudeCodeAccountRequestBaseURL(account accountsdomain.AccountRecord) string {
	if account.FormatBaseURLs != nil {
		if baseURL := strings.TrimSpace(account.FormatBaseURLs[accountsdomain.APIFmtAnthropic]); baseURL != "" {
			return strings.TrimRight(baseURL, "/")
		}
	}
	return strings.TrimRight(strings.TrimSpace(account.BaseURL), "/")
}
