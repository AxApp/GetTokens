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
	"github.com/linhay/gettokens/internal/cliproxyapi"
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

type codexRoutingLiveRequestMarker struct {
	RequestID    string
	AccountID    string
	AccountLabel string
	Provider     string
	Model        string
	StartedAt    string
}

type codexRoutingDecisionMarker struct {
	DecisionID   string
	AccountID    string
	AccountLabel string
	Provider     string
	Model        string
	RecordedAt   string
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

	candidates, err := a.loadCodexRoutingProbeCandidates(model)
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

func (a *App) loadCodexRoutingProbeCandidates(model string) ([]codexRoutingProbeCandidate, error) {
	accounts, err := a.ListAccounts()
	if err != nil {
		return nil, err
	}

	candidates := make([]codexRoutingProbeCandidate, 0, len(accounts))
	for _, account := range accounts {
		if account.Disabled || !codexRoutingRecordRequestable(account) {
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
	if routed, supported, err := a.loadChannelRoutingProbeCandidatesFromManagementExplain("codex", model, candidates); err != nil {
		return nil, err
	} else if supported {
		return routed, nil
	}
	return a.filterCodexRoutingProbeRuntimeBlockedCandidates(candidates), nil
}

func (a *App) filterCodexRoutingProbeRuntimeBlockedCandidates(candidates []codexRoutingProbeCandidate) []codexRoutingProbeCandidate {
	if len(candidates) == 0 {
		return candidates
	}
	blocked := make(map[string]struct{})
	if store, err := loadChannelRoutingStore(); err == nil && len(store.RuntimeStates) > 0 {
		now := time.Now().UTC()
		for _, candidate := range candidates {
			id := strings.TrimSpace(candidate.ID)
			if id == "" {
				continue
			}
			if _, blockedByRuntime := activeRuntimeBlockReason(store.RuntimeStates[id], now); blockedByRuntime {
				blocked[id] = struct{}{}
			}
		}
	}
	accountIDs := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		if id := strings.TrimSpace(candidate.ID); id != "" {
			accountIDs = append(accountIDs, id)
		}
	}
	if len(accountIDs) == 0 {
		return candidates
	}
	if statuses, err := a.managementClient().GetQuotaStatuses(accountIDs); err == nil {
		for _, status := range statuses {
			if !status.Blocked {
				continue
			}
			if id := strings.TrimSpace(status.AccountKey); id != "" {
				blocked[id] = struct{}{}
			}
		}
	}
	if len(blocked) == 0 {
		return candidates
	}
	filtered := candidates[:0]
	for _, candidate := range candidates {
		if _, ok := blocked[strings.TrimSpace(candidate.ID)]; ok {
			continue
		}
		filtered = append(filtered, candidate)
	}
	return filtered
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

func (a *App) loadChannelRoutingProbeCandidatesFromManagementExplain(channel string, model string, localCandidates []codexRoutingProbeCandidate) ([]codexRoutingProbeCandidate, bool, error) {
	response, supported, err := a.managementClient().ExplainChannelRouting(cliproxyapi.ChannelRoutingExplainInput{
		Channel:        channel,
		RequestedModel: strings.TrimSpace(model),
	})
	if err != nil || !supported || response == nil {
		return nil, supported, err
	}
	if len(response.Candidates) == 0 {
		return []codexRoutingProbeCandidate{}, true, nil
	}
	byAccountID := make(map[string]codexRoutingProbeCandidate, len(localCandidates))
	for _, candidate := range localCandidates {
		accountID := strings.TrimSpace(candidate.ID)
		if accountID == "" {
			continue
		}
		byAccountID[accountID] = candidate
	}
	ordered := make([]codexRoutingProbeCandidate, 0, len(response.Candidates))
	for _, candidate := range response.Candidates {
		accountID := strings.TrimSpace(candidate.ID)
		if accountID == "" {
			continue
		}
		localCandidate, ok := byAccountID[accountID]
		if !ok {
			continue
		}
		if label := strings.TrimSpace(candidate.DisplayName); label != "" {
			localCandidate.Label = label
		}
		if provider := strings.TrimSpace(candidate.Provider); provider != "" {
			localCandidate.Provider = provider
		}
		localCandidate.Priority = candidate.RouteOrder
		ordered = append(ordered, localCandidate)
	}
	if len(ordered) == 0 {
		return nil, false, nil
	}
	return ordered, true, nil
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

	beforeDecisions := a.captureCodexRoutingDecisionMarkers("codex", candidates)
	beforeLive := a.captureCodexRoutingLiveRequests(candidates)
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

	afterDecisions := a.captureCodexRoutingDecisionMarkers("codex", candidates)
	afterLive := a.captureCodexRoutingLiveRequests(candidates)
	after := a.captureCodexRoutingUsage(candidates)
	if marker, ok := detectCodexRoutingProbeHitFromRouteDecisions(beforeDecisions, afterDecisions, model, startedAt); ok {
		attempt.AccountID = marker.AccountID
		attempt.AccountLabel = marker.AccountLabel
		attempt.Provider = marker.Provider
		attempt.Evidence = "route-decision snapshot"
	} else if marker, ok := detectCodexRoutingProbeHitFromLiveRequests(beforeLive, afterLive, model, startedAt); ok {
		attempt.AccountID = marker.AccountID
		attempt.AccountLabel = marker.AccountLabel
		attempt.Provider = marker.Provider
		attempt.Evidence = "live-session request"
	} else if candidate, delta, ok := detectCodexRoutingProbeHit(before, after, candidates); ok {
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

func detectCodexRoutingProbeHitFromLiveRequests(before map[string]codexRoutingLiveRequestMarker, after map[string]codexRoutingLiveRequestMarker, model string, startedAt time.Time) (codexRoutingLiveRequestMarker, bool) {
	var selected codexRoutingLiveRequestMarker
	var selectedTime time.Time
	targetModel := strings.TrimSpace(model)
	for requestID, marker := range after {
		if _, ok := before[requestID]; ok {
			continue
		}
		if targetModel != "" && strings.TrimSpace(marker.Model) != "" && !strings.EqualFold(strings.TrimSpace(marker.Model), targetModel) {
			continue
		}
		requestStarted := parseRoutingProbeTime(marker.StartedAt)
		if !requestStarted.IsZero() && requestStarted.Add(-2*time.Second).Before(startedAt) {
			if selected.RequestID == "" || selectedTime.Before(requestStarted) {
				selected = marker
				selectedTime = requestStarted
			}
			continue
		}
		if selected.RequestID == "" {
			selected = marker
		}
	}
	return selected, selected.RequestID != ""
}

func detectCodexRoutingProbeHitFromRouteDecisions(before map[string]codexRoutingDecisionMarker, after map[string]codexRoutingDecisionMarker, model string, startedAt time.Time) (codexRoutingDecisionMarker, bool) {
	var selected codexRoutingDecisionMarker
	var selectedTime time.Time
	targetModel := strings.TrimSpace(model)
	for decisionID, marker := range after {
		if _, ok := before[decisionID]; ok {
			continue
		}
		if targetModel != "" && strings.TrimSpace(marker.Model) != "" && !strings.EqualFold(strings.TrimSpace(marker.Model), targetModel) {
			continue
		}
		recordedAt := parseRoutingProbeTime(marker.RecordedAt)
		if !recordedAt.IsZero() && recordedAt.Add(-2*time.Second).Before(startedAt) {
			if selected.DecisionID == "" || selectedTime.Before(recordedAt) {
				selected = marker
				selectedTime = recordedAt
			}
			continue
		}
		if selected.DecisionID == "" {
			selected = marker
		}
	}
	return selected, selected.DecisionID != ""
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

func (a *App) captureCodexRoutingLiveRequests(candidates []codexRoutingProbeCandidate) map[string]codexRoutingLiveRequestMarker {
	snapshot, err := a.GetCodexLiveSessionsSnapshot()
	if err != nil || snapshot == nil {
		return map[string]codexRoutingLiveRequestMarker{}
	}
	candidateIndex := make(map[string]codexRoutingProbeCandidate, len(candidates))
	for _, candidate := range candidates {
		accountID := strings.TrimSpace(candidate.ID)
		if accountID == "" {
			continue
		}
		candidateIndex[accountID] = candidate
	}
	out := make(map[string]codexRoutingLiveRequestMarker)
	for _, session := range snapshot.Sessions {
		for _, request := range session.Requests {
			accountID := strings.TrimSpace(request.AccountKey)
			if accountID == "" {
				accountID = strings.TrimSpace(session.AccountKey)
			}
			candidate, ok := candidateIndex[accountID]
			if !ok {
				continue
			}
			requestID := strings.TrimSpace(request.RequestID)
			if requestID == "" {
				continue
			}
			out[requestID] = codexRoutingLiveRequestMarker{
				RequestID:    requestID,
				AccountID:    accountID,
				AccountLabel: candidate.Label,
				Provider:     firstNonEmptyString(strings.TrimSpace(request.Provider), candidate.Provider),
				Model:        firstNonEmptyString(strings.TrimSpace(request.Model), strings.TrimSpace(session.Model)),
				StartedAt:    strings.TrimSpace(request.StartedAt),
			}
		}
	}
	return out
}

func (a *App) captureCodexRoutingDecisionMarkers(channel string, candidates []codexRoutingProbeCandidate) map[string]codexRoutingDecisionMarker {
	items, supported, err := a.managementClient().ListChannelRoutingDecisions(channel, 20)
	if err != nil || !supported || len(items) == 0 {
		return map[string]codexRoutingDecisionMarker{}
	}
	candidateIndex := make(map[string]codexRoutingProbeCandidate, len(candidates))
	for _, candidate := range candidates {
		accountID := strings.TrimSpace(candidate.ID)
		if accountID == "" {
			continue
		}
		candidateIndex[accountID] = candidate
	}
	out := make(map[string]codexRoutingDecisionMarker)
	for _, item := range items {
		accountID := strings.TrimSpace(item.SelectedAccountID)
		if accountID == "" {
			continue
		}
		candidate, ok := candidateIndex[accountID]
		if !ok {
			continue
		}
		decisionID := strings.TrimSpace(item.ID)
		if decisionID == "" {
			continue
		}
		out[decisionID] = codexRoutingDecisionMarker{
			DecisionID:   decisionID,
			AccountID:    accountID,
			AccountLabel: candidate.Label,
			Provider:     firstNonEmptyString(strings.TrimSpace(item.SelectedProvider), candidate.Provider),
			Model:        strings.TrimSpace(item.Model),
			RecordedAt:   strings.TrimSpace(item.RecordedAt),
		}
	}
	return out
}

func parseRoutingProbeTime(value string) time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err == nil {
		return parsed
	}
	parsed, err = time.Parse(time.RFC3339Nano, value)
	if err == nil {
		return parsed
	}
	return time.Time{}
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

func codexRoutingRecordRequestable(account accountsdomain.AccountRecord) bool {
	switch strings.ToLower(strings.TrimSpace(account.RuntimeStatus)) {
	case "registered_routeable":
		return true
	case "pending", "applied_not_registered", "degraded":
		return false
	}

	switch strings.ToUpper(strings.TrimSpace(account.Status)) {
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
