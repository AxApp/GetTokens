package wailsapp

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
)

type ProbeCodexAccountRoutingInput struct {
	Model           string   `json:"model"`
	Attempts        int      `json:"attempts,omitempty"`
	AllowAccountIDs []string `json:"allowAccountIDs,omitempty"`
	DenyAccountIDs  []string `json:"denyAccountIDs,omitempty"`
	OrderAccountIDs []string `json:"orderAccountIDs,omitempty"`
	AllowFallback   bool     `json:"allowFallback,omitempty"`
}

type CodexAccountRoutingProbeResult struct {
	Model    string                            `json:"model"`
	Attempts []CodexAccountRoutingProbeAttempt `json:"attempts"`
}

type CodexAccountRoutingProbeAttempt struct {
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

type codexRoutingProbeCandidate struct {
	ID        string
	Label     string
	Provider  string
	Priority  int
	UsageKeys []string
	RouteIDs  []string
}

type codexRoutingUsageSnapshot map[string]int64

type codexRoutingRecentBucket struct {
	Success int64 `json:"success"`
	Failed  int64 `json:"failed"`
}

const (
	codexRouteAllowHeader    = "X-GetTokens-Route-Allow"
	codexRouteDenyHeader     = "X-GetTokens-Route-Deny"
	codexRouteOrderHeader    = "X-GetTokens-Route-Order"
	codexRouteFallbackHeader = "X-GetTokens-Route-Fallback"
)

func (a *App) ProbeCodexAccountRouting(input ProbeCodexAccountRoutingInput) (*CodexAccountRoutingProbeResult, error) {
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

	candidates, err := a.loadCodexRoutingProbeCandidates()
	if err != nil {
		return nil, err
	}
	if len(candidates) == 0 {
		return nil, errors.New("没有可用于探测的账号")
	}

	result := &CodexAccountRoutingProbeResult{
		Model:    model,
		Attempts: make([]CodexAccountRoutingProbeAttempt, 0, attempts),
	}
	routeHeaders := buildCodexRoutingRouteHeaders(input, candidates)
	for index := 0; index < attempts; index++ {
		result.Attempts = append(result.Attempts, a.runCodexRoutingProbeAttempt(index+1, model, relayKey, candidates, routeHeaders))
	}
	return result, nil
}

func (a *App) firstRelayAPIKey() (string, error) {
	if items, err := a.managementClient().ListAPIKeys(); err == nil {
		for _, item := range normalizeRelayAPIKeys(items) {
			if item != "" {
				return item, nil
			}
		}
	}
	if key := strings.TrimSpace(a.sidecar.CurrentServiceAPIKey()); key != "" {
		return key, nil
	}
	return "", errors.New("中转服务 API KEY 未配置")
}

func (a *App) loadCodexRoutingProbeCandidates() ([]codexRoutingProbeCandidate, error) {
	accounts, err := a.ListAccounts()
	if err != nil {
		return nil, err
	}
	providers, err := a.managementClient().ListOpenAICompatibleProviders()
	if err != nil {
		return nil, err
	}
	codexRouteIDs := a.loadCodexAPIKeyRouteIDs()

	candidates := make([]codexRoutingProbeCandidate, 0, len(accounts)+len(providers))
	for _, account := range accounts {
		if account.Disabled || !codexRoutingRecordRequestable(account.Status) {
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
				ID:       account.ID,
				Label:    firstNonEmptyString(account.DisplayName, account.Email, name),
				Provider: strings.TrimSpace(account.Provider),
				Priority: account.Priority,
				UsageKeys: []string{
					"auth-file:" + name,
				},
				RouteIDs: []string{name},
			})
			continue
		}
		apiKey := strings.TrimSpace(account.APIKey)
		if apiKey == "" {
			continue
		}
		provider := strings.ToLower(strings.TrimSpace(account.Provider))
		if provider == "" {
			provider = "codex"
		}
		candidates = append(candidates, codexRoutingProbeCandidate{
			ID:       account.ID,
			Label:    firstNonEmptyString(account.DisplayName, account.KeySuffix, account.ID),
			Provider: provider,
			Priority: account.Priority,
			UsageKeys: []string{
				buildCodexRoutingAPIUsageKey(provider, account.BaseURL, apiKey),
			},
			RouteIDs: codexRouteIDs[account.ID],
		})
	}

	for _, provider := range providers {
		if provider.Disabled {
			continue
		}
		name := strings.TrimSpace(provider.Name)
		if name == "" {
			continue
		}
		providerKey := strings.ToLower(name)
		usageKeys := make([]string, 0, len(provider.APIKeyEntries)+1)
		routeIDs := make([]string, 0, len(provider.APIKeyEntries)+1)
		apiKeys := provider.APIKeyEntries
		for _, apiKey := range apiKeys {
			if trimmed := strings.TrimSpace(apiKey.APIKey); trimmed != "" {
				usageKeys = append(usageKeys, buildCodexRoutingAPIUsageKey(providerKey, provider.BaseURL, trimmed))
				routeIDs = append(routeIDs, buildStableRouteAuthID("openai-compatibility:"+providerKey, trimmed, provider.BaseURL, apiKey.ProxyURL))
			}
		}
		if len(usageKeys) == 0 {
			continue
		}
		candidates = append(candidates, codexRoutingProbeCandidate{
			ID:        "openai-compatible:" + name,
			Label:     name,
			Provider:  providerKey,
			Priority:  provider.Priority,
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

func (a *App) loadCodexAPIKeyRouteIDs() map[string][]string {
	codexKeys, err := a.loadCodexAPIKeys()
	if err != nil {
		return map[string][]string{}
	}
	out := make(map[string][]string, len(codexKeys))
	for _, key := range codexKeys {
		record := accountsdomain.BuildCodexAPIKeyAccountRecord(key)
		id := strings.TrimSpace(record.ID)
		apiKey := strings.TrimSpace(key.APIKey)
		if id == "" || apiKey == "" {
			continue
		}
		out[id] = []string{buildStableRouteAuthID("codex:apikey", apiKey, key.BaseURL)}
	}
	return out
}

func buildCodexRoutingRouteHeaders(input ProbeCodexAccountRoutingInput, candidates []codexRoutingProbeCandidate) map[string]string {
	routeIDByAccountID := make(map[string][]string, len(candidates))
	for _, candidate := range candidates {
		accountID := strings.TrimSpace(candidate.ID)
		if accountID == "" {
			continue
		}
		routeIDs := normalizeCodexRouteIDList(candidate.RouteIDs)
		if len(routeIDs) == 0 {
			routeIDs = []string{accountID}
		}
		routeIDByAccountID[accountID] = routeIDs
	}

	allowIDs := resolveCodexRoutingRouteIDs(input.AllowAccountIDs, routeIDByAccountID)
	denyIDs := resolveCodexRoutingRouteIDs(input.DenyAccountIDs, routeIDByAccountID)
	orderIDs := resolveCodexRoutingRouteIDs(input.OrderAccountIDs, routeIDByAccountID)
	if len(allowIDs) == 0 && len(denyIDs) == 0 && len(orderIDs) == 0 {
		return nil
	}

	headers := map[string]string{}
	if len(allowIDs) > 0 {
		headers[codexRouteAllowHeader] = strings.Join(allowIDs, ",")
	}
	if len(denyIDs) > 0 {
		headers[codexRouteDenyHeader] = strings.Join(denyIDs, ",")
	}
	if len(orderIDs) > 0 {
		headers[codexRouteOrderHeader] = strings.Join(orderIDs, ",")
	}
	if input.AllowFallback {
		headers[codexRouteFallbackHeader] = "true"
	} else {
		headers[codexRouteFallbackHeader] = "false"
	}
	return headers
}

func resolveCodexRoutingRouteIDs(accountIDs []string, routeIDByAccountID map[string][]string) []string {
	out := make([]string, 0, len(accountIDs))
	seen := make(map[string]struct{}, len(accountIDs))
	for _, raw := range accountIDs {
		accountID := strings.TrimSpace(raw)
		if accountID == "" {
			continue
		}
		routeIDs := routeIDByAccountID[accountID]
		if len(routeIDs) == 0 {
			routeIDs = []string{accountID}
		}
		for _, routeID := range routeIDs {
			trimmed := strings.TrimSpace(routeID)
			if trimmed == "" {
				continue
			}
			if _, exists := seen[trimmed]; exists {
				continue
			}
			seen[trimmed] = struct{}{}
			out = append(out, trimmed)
		}
	}
	return out
}

func normalizeCodexRouteIDList(ids []string) []string {
	out := make([]string, 0, len(ids))
	seen := make(map[string]struct{}, len(ids))
	for _, raw := range ids {
		id := strings.TrimSpace(raw)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}

func buildStableRouteAuthID(kind string, parts ...string) string {
	hasher := sha256.New()
	hasher.Write([]byte(strings.TrimSpace(kind)))
	for _, part := range parts {
		hasher.Write([]byte{0})
		hasher.Write([]byte(strings.TrimSpace(part)))
	}
	digest := hex.EncodeToString(hasher.Sum(nil))
	if len(digest) < 12 {
		return strings.TrimSpace(kind) + ":000000000000"
	}
	return strings.TrimSpace(kind) + ":" + digest[:12]
}

func (a *App) runCodexRoutingProbeAttempt(index int, model string, relayKey string, candidates []codexRoutingProbeCandidate, routeHeaders map[string]string) CodexAccountRoutingProbeAttempt {
	startedAt := time.Now()
	attempt := CodexAccountRoutingProbeAttempt{
		Index:     index,
		StartedAt: startedAt.Format(time.RFC3339),
	}

	before := a.captureCodexRoutingUsage(candidates)
	payloadBody, err := json.Marshal(map[string]any{
		"model":      model,
		"messages":   []map[string]string{{"role": "user", "content": "Reply OK."}},
		"stream":     false,
		"max_tokens": 1,
	})
	if err != nil {
		attempt.Message = err.Error()
		attempt.FinishedAt = time.Now().Format(time.RFC3339)
		return attempt
	}

	responseBody, statusCode, _, err := a.SidecarRelayRequestWithHeaders(
		http.MethodPost,
		"/v1/chat/completions",
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
		attempt.Message = "测试请求完成"
	} else {
		attempt.Message = fmt.Sprintf("测试请求返回 HTTP %d", statusCode)
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

func detectCodexRoutingProbeHit(before codexRoutingUsageSnapshot, after codexRoutingUsageSnapshot, candidates []codexRoutingProbeCandidate) (codexRoutingProbeCandidate, int64, bool) {
	var selected codexRoutingProbeCandidate
	var selectedDelta int64
	for _, candidate := range candidates {
		delta := after[candidate.ID] - before[candidate.ID]
		if delta <= 0 {
			continue
		}
		if selectedDelta == 0 || delta > selectedDelta {
			selected = candidate
			selectedDelta = delta
		}
	}
	return selected, selectedDelta, selectedDelta > 0
}

func (a *App) captureCodexRoutingUsage(candidates []codexRoutingProbeCandidate) codexRoutingUsageSnapshot {
	snapshot := make(codexRoutingUsageSnapshot, len(candidates))
	authFileUsage := a.captureCodexRoutingAuthFileUsage()
	apiKeyUsage := a.captureCodexRoutingAPIKeyUsage()
	for _, candidate := range candidates {
		var total int64
		for _, key := range candidate.UsageKeys {
			if strings.HasPrefix(key, "auth-file:") {
				total += authFileUsage[key]
				continue
			}
			total += apiKeyUsage[key]
		}
		snapshot[candidate.ID] = total
	}
	return snapshot
}

func (a *App) captureCodexRoutingAuthFileUsage() map[string]int64 {
	body, _, err := a.SidecarRequest(http.MethodGet, ManagementAPIPrefix+"/auth-files", nil, nil, "")
	if err != nil {
		return map[string]int64{}
	}
	var payload struct {
		Files []struct {
			Name           string                     `json:"name"`
			RecentRequests []codexRoutingRecentBucket `json:"recent_requests"`
		} `json:"files"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return map[string]int64{}
	}
	out := make(map[string]int64, len(payload.Files))
	for _, file := range payload.Files {
		key := "auth-file:" + strings.TrimSpace(file.Name)
		if key == "auth-file:" {
			continue
		}
		out[key] = sumCodexRoutingRecentBuckets(file.RecentRequests)
	}
	return out
}

func (a *App) captureCodexRoutingAPIKeyUsage() map[string]int64 {
	body, _, err := a.SidecarRequest(http.MethodGet, ManagementAPIPrefix+"/api-key-usage", nil, nil, "")
	if err != nil {
		return map[string]int64{}
	}
	var payload map[string]map[string]struct {
		Success        int64                      `json:"success"`
		Failed         int64                      `json:"failed"`
		RecentRequests []codexRoutingRecentBucket `json:"recent_requests"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return map[string]int64{}
	}
	out := make(map[string]int64)
	for provider, items := range payload {
		providerKey := strings.ToLower(strings.TrimSpace(provider))
		for composite, entry := range items {
			total := entry.Success + entry.Failed
			if total == 0 {
				total = sumCodexRoutingRecentBuckets(entry.RecentRequests)
			}
			out[providerKey+"|"+normalizeCodexRoutingAPIUsageComposite(composite)] = total
		}
	}
	return out
}

func sumCodexRoutingRecentBuckets(items []codexRoutingRecentBucket) int64 {
	var total int64
	for _, item := range items {
		total += item.Success + item.Failed
	}
	return total
}

func buildCodexRoutingAPIUsageKey(provider string, baseURL string, apiKey string) string {
	return strings.ToLower(strings.TrimSpace(provider)) + "|" + normalizeCodexRoutingAPIUsageComposite(
		strings.TrimSpace(baseURL)+"|"+strings.TrimSpace(apiKey),
	)
}

func normalizeCodexRoutingAPIUsageComposite(value string) string {
	parts := strings.SplitN(value, "|", 2)
	if len(parts) != 2 {
		return strings.TrimSpace(value)
	}
	baseURL := strings.TrimRight(strings.TrimSpace(parts[0]), "/")
	apiKey := strings.TrimSpace(parts[1])
	return baseURL + "|" + apiKey
}

func codexRoutingRecordRequestable(status string) bool {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "ACTIVE", "CONFIGURED", "LOCAL":
		return true
	default:
		return false
	}
}

func trimRoutingProbeResponseBody(body []byte) string {
	trimmed := strings.TrimSpace(string(body))
	if len(trimmed) <= 500 {
		return trimmed
	}
	return trimmed[:500] + "..."
}
