package wailsapp

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
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
	ID          string
	Label       string
	Provider    string
	Priority    int
	UsageSource string
	UsageKeys   []string
	RouteIDs    []string
}

type codexRoutingUsageSnapshot map[string]int64

const (
	codexRoutingUsageSourceAuthFile = "auth-file"
	codexRoutingUsageSourceAPIKey   = "api-key"
)

type codexRoutingRecentBucket struct {
	Success int64 `json:"success"`
	Failed  int64 `json:"failed"`
}

const (
	codexRouteAllowHeader    = "X-GetTokens-Route-Allow"
	codexRouteDenyHeader     = "X-GetTokens-Route-Deny"
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

	candidates := make([]codexRoutingProbeCandidate, 0, len(accounts))
	for _, account := range accounts {
		if account.Disabled || !codexRoutingRecordRequestable(account.Status) {
			continue
		}
		accountID := strings.TrimSpace(account.ID)
		if !isUnifiedAccountID(accountID) {
			continue
		}
		if account.AccountKind == accountsdomain.AccountKindAuthFile {
			name := strings.TrimSpace(account.Name)
			if name == "" {
				continue
			}
			candidates = append(candidates, codexRoutingProbeCandidate{
				ID:          accountID,
				Label:       firstNonEmptyString(account.DisplayName, account.Email, name),
				Provider:    strings.TrimSpace(account.Provider),
				Priority:    account.Priority,
				UsageSource: codexRoutingUsageSourceAuthFile,
				UsageKeys:   []string{accountID},
				RouteIDs:    []string{name},
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
		routeKind := "codex:apikey"
		routeParts := []string{apiKey, account.BaseURL}
		if account.AccountKind == accountsdomain.AccountKindOpenAICompatible {
			routeKind = "openai-compatibility:" + provider
			routeParts = append(routeParts, account.ProxyURL)
		}
		candidates = append(candidates, codexRoutingProbeCandidate{
			ID:          accountID,
			Label:       firstNonEmptyString(account.DisplayName, account.KeySuffix, accountID),
			Provider:    provider,
			Priority:    account.Priority,
			UsageSource: codexRoutingUsageSourceAPIKey,
			UsageKeys: []string{
				buildCodexRoutingAPIUsageKey(provider, account.BaseURL, apiKey),
			},
			RouteIDs: []string{buildStableRouteAuthID(routeKind, routeParts...)},
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
	if len(allowIDs) == 0 && len(denyIDs) == 0 {
		return nil
	}

	headers := map[string]string{}
	if len(allowIDs) > 0 {
		headers[codexRouteAllowHeader] = strings.Join(allowIDs, ",")
	}
	if len(denyIDs) > 0 {
		headers[codexRouteDenyHeader] = strings.Join(denyIDs, ",")
	}
	headers[codexRouteFallbackHeader] = "false"
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
		sourceUsage := apiKeyUsage
		if candidate.UsageSource == codexRoutingUsageSourceAuthFile {
			sourceUsage = authFileUsage
		}
		for _, key := range candidate.UsageKeys {
			total += sourceUsage[key]
		}
		snapshot[candidate.ID] = total
	}
	return snapshot
}

func (a *App) captureCodexRoutingAuthFileUsage() map[string]int64 {
	query := url.Values{}
	query.Set("include_unresolved", "true")
	body, _, err := a.SidecarRequest(http.MethodGet, ManagementAPIPrefix+"/gettokens/usage-attribution", query, nil, "")
	if err != nil {
		return map[string]int64{}
	}
	var payload struct {
		Items []struct {
			AccountKey     string `json:"accountKey"`
			CredentialKey  string `json:"credentialKey"`
			AttributionKey string `json:"attributionKey"`
			RequestCount   int64  `json:"requestCount"`
		} `json:"items"`
		Unresolved []struct {
			AccountKey     string `json:"accountKey"`
			CredentialKey  string `json:"credentialKey"`
			AttributionKey string `json:"attributionKey"`
			RequestCount   int64  `json:"requestCount"`
		} `json:"unresolved"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return map[string]int64{}
	}
	out := make(map[string]int64, len(payload.Items)+len(payload.Unresolved))
	add := func(accountKey, credentialKey, attributionKey string, count int64) {
		for _, key := range []string{accountKey, credentialKey, attributionKey} {
			key = strings.TrimSpace(key)
			if key != "" {
				out[key] += count
			}
		}
	}
	for _, item := range payload.Items {
		add(item.AccountKey, item.CredentialKey, item.AttributionKey, item.RequestCount)
	}
	for _, item := range payload.Unresolved {
		add(item.AccountKey, item.CredentialKey, item.AttributionKey, item.RequestCount)
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
