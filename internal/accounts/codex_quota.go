package accounts

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const (
	codexUsageURL                    = "https://chatgpt.com/backend-api/wham/usage"
	codexFiveHourWindowSeconds int64 = 18000
	codexWeeklyWindowSeconds   int64 = 604800
)

type CodexQuotaWindow struct {
	ID               string
	Label            string
	RemainingPercent *int
	ResetLabel       string
}

type CodexQuotaResponse struct {
	PlanType string
	Windows  []CodexQuotaWindow
}

type codexUsagePayload struct {
	PlanType             string                 `json:"plan_type"`
	PlanTypeCamel        string                 `json:"planType"`
	RateLimit            *codexRateLimitInfo    `json:"rate_limit"`
	RateLimitCamel       *codexRateLimitInfo    `json:"rateLimit"`
	CodeReviewRateLimit  *codexRateLimitInfo    `json:"code_review_rate_limit"`
	CodeReviewRateCamel  *codexRateLimitInfo    `json:"codeReviewRateLimit"`
	AdditionalRateLimits []codexAdditionalLimit `json:"additional_rate_limits"`
	AdditionalRateCamel  []codexAdditionalLimit `json:"additionalRateLimits"`
}

type codexAdditionalLimit struct {
	LimitName         string              `json:"limit_name"`
	LimitNameCamel    string              `json:"limitName"`
	MeteredFeature    string              `json:"metered_feature"`
	MeteredFeatureCam string              `json:"meteredFeature"`
	RateLimit         *codexRateLimitInfo `json:"rate_limit"`
	RateLimitCamel    *codexRateLimitInfo `json:"rateLimit"`
}

type codexRateLimitInfo struct {
	Allowed            *bool             `json:"allowed"`
	LimitReached       *bool             `json:"limit_reached"`
	LimitReachedCamel  *bool             `json:"limitReached"`
	PrimaryWindow      *codexUsageWindow `json:"primary_window"`
	PrimaryWindowCamel *codexUsageWindow `json:"primaryWindow"`
	SecondWindow       *codexUsageWindow `json:"secondary_window"`
	SecondWindowCamel  *codexUsageWindow `json:"secondaryWindow"`
}

type codexUsageWindow struct {
	UsedPercent          interface{} `json:"used_percent"`
	UsedPercentCamel     interface{} `json:"usedPercent"`
	LimitWindowSeconds   interface{} `json:"limit_window_seconds"`
	LimitWindowCamel     interface{} `json:"limitWindowSeconds"`
	ResetAfterSeconds    interface{} `json:"reset_after_seconds"`
	ResetAfterSecondsCam interface{} `json:"resetAfterSeconds"`
	ResetAt              interface{} `json:"reset_at"`
	ResetAtCamel         interface{} `json:"resetAt"`
}

type codexAuthInfo struct {
	AccessToken      string
	ChatGPTAccountID string
	PlanType         string
}

func GetCodexQuota(ctx context.Context, authFileBody []byte, timeout time.Duration) (*CodexQuotaResponse, error) {
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

	payload, err := fetchCodexQuotaPayload(ctx, authFile.AccessToken, authFile.ChatGPTAccountID, timeout)
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

func parseCodexAuthFile(body []byte) (*codexAuthInfo, error) {
	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("codex 凭证解析失败: %w", err)
	}

	metadata := nestedMap(payload, "metadata")
	attributes := nestedMap(payload, "attributes")
	rootToken := nestedMap(payload, "token")
	tokens := nestedMap(payload, "tokens")
	metadataToken := nestedMap(metadata, "token")
	attributesToken := nestedMap(attributes, "token")

	accessToken := firstNonEmpty(
		stringValue(payload, "access_token"),
		stringValue(metadata, "access_token"),
		stringValue(attributes, "access_token"),
		stringValue(rootToken, "access_token"),
		stringValue(tokens, "access_token"),
		stringValue(metadataToken, "access_token"),
		stringValue(attributesToken, "access_token"),
	)

	idTokenRaw := firstNonEmpty(
		stringValue(payload, "id_token"),
		stringValue(metadata, "id_token"),
		stringValue(attributes, "id_token"),
		stringValue(tokens, "id_token"),
	)

	idClaims := parseJWTClaims(idTokenRaw)
	openAIAuthClaims := nestedMap(idClaims, "https://api.openai.com/auth")
	chatgptAccountID := firstNonEmpty(
		stringValue(tokens, "account_id"),
		stringValue(idClaims, "chatgpt_account_id"),
		stringValue(idClaims, "chatgptAccountId"),
		stringValue(openAIAuthClaims, "chatgpt_account_id"),
		stringValue(openAIAuthClaims, "chatgptAccountId"),
	)

	planType := normalizePlanType(firstNonEmpty(
		stringValue(payload, "plan_type"),
		stringValue(payload, "planType"),
		stringValue(metadata, "plan_type"),
		stringValue(metadata, "planType"),
		stringValue(attributes, "plan_type"),
		stringValue(attributes, "planType"),
		stringValue(idClaims, "plan_type"),
		stringValue(idClaims, "planType"),
		stringValue(openAIAuthClaims, "chatgpt_plan_type"),
		stringValue(openAIAuthClaims, "chatgptPlanType"),
	))

	return &codexAuthInfo{
		AccessToken:      strings.TrimSpace(accessToken),
		ChatGPTAccountID: strings.TrimSpace(chatgptAccountID),
		PlanType:         planType,
	}, nil
}

func fetchCodexQuotaPayload(ctx context.Context, accessToken string, accountID string, timeout time.Duration) (*codexUsagePayload, error) {
	req, err := http.NewRequestWithContext(ctxOrBackground(ctx), http.MethodGet, codexUsageURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "codex_cli_rs/0.76.0 (Debian 13.0.0; x86_64) WindowsTerminal")
	req.Header.Set("Chatgpt-Account-Id", accountID)

	client := &http.Client{Timeout: timeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var payload codexUsagePayload
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("codex 额度响应解析失败: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("codex 额度请求失败 (%d)", resp.StatusCode)
	}

	return &payload, nil
}

func buildCodexQuotaWindows(payload *codexUsagePayload) []CodexQuotaWindow {
	if payload == nil {
		return []CodexQuotaWindow{}
	}

	windows := make([]CodexQuotaWindow, 0, 6)

	addPair := func(prefix string, labelFive string, labelWeekly string, info *codexRateLimitInfo) {
		fiveHourWindow, weeklyWindow := classifyCodexWindows(info)
		limitReached := boolPtrValue(infoLimitReached(info))
		allowed := infoAllowedValue(info)

		if window := newCodexQuotaWindow(prefix+"-five-hour", labelFive, fiveHourWindow, limitReached, allowed); window != nil {
			windows = append(windows, *window)
		}
		if window := newCodexQuotaWindow(prefix+"-weekly", labelWeekly, weeklyWindow, limitReached, allowed); window != nil {
			windows = append(windows, *window)
		}
	}

	addPair("", "5H", "7D", firstRateLimit(payload.RateLimit, payload.RateLimitCamel))
	addPair("code-review", "CR 5H", "CR 7D", firstRateLimit(payload.CodeReviewRateLimit, payload.CodeReviewRateCamel))

	for index, limit := range firstAdditionalRateLimits(payload.AdditionalRateLimits, payload.AdditionalRateCamel) {
		name := firstNonEmpty(limit.LimitName, limit.LimitNameCamel, limit.MeteredFeature, limit.MeteredFeatureCam)
		if strings.TrimSpace(name) == "" {
			name = fmt.Sprintf("LIMIT %d", index+1)
		}
		addPair(
			fmt.Sprintf("additional-%d", index+1),
			fmt.Sprintf("%s 5H", name),
			fmt.Sprintf("%s 7D", name),
			firstRateLimit(limit.RateLimit, limit.RateLimitCamel),
		)
	}

	return windows
}

func newCodexQuotaWindow(id string, label string, window *codexUsageWindow, limitReached bool, allowed *bool) *CodexQuotaWindow {
	if window == nil {
		return nil
	}

	resetLabel := formatCodexResetLabel(window)
	usedPercent := numberValue(firstNonNil(window.UsedPercent, window.UsedPercentCamel))
	remainingPercent := remainingPercentFromUsed(usedPercent, limitReached, allowed, resetLabel)

	return &CodexQuotaWindow{
		ID:               id,
		Label:            label,
		RemainingPercent: remainingPercent,
		ResetLabel:       resetLabel,
	}
}

func classifyCodexWindows(info *codexRateLimitInfo) (*codexUsageWindow, *codexUsageWindow) {
	if info == nil {
		return nil, nil
	}

	primary := firstWindow(info.PrimaryWindow, info.PrimaryWindowCamel)
	secondary := firstWindow(info.SecondWindow, info.SecondWindowCamel)
	raw := []*codexUsageWindow{primary, secondary}

	var fiveHourWindow *codexUsageWindow
	var weeklyWindow *codexUsageWindow

	for _, window := range raw {
		seconds := windowSeconds(window)
		switch seconds {
		case codexFiveHourWindowSeconds:
			if fiveHourWindow == nil {
				fiveHourWindow = window
			}
		case codexWeeklyWindowSeconds:
			if weeklyWindow == nil {
				weeklyWindow = window
			}
		}
	}

	if fiveHourWindow == nil && primary != nil && primary != weeklyWindow {
		fiveHourWindow = primary
	}
	if weeklyWindow == nil && secondary != nil && secondary != fiveHourWindow {
		weeklyWindow = secondary
	}

	return fiveHourWindow, weeklyWindow
}

func infoLimitReached(info *codexRateLimitInfo) *bool {
	if info == nil {
		return nil
	}
	if info.LimitReached != nil {
		return info.LimitReached
	}
	return info.LimitReachedCamel
}

func infoAllowedValue(info *codexRateLimitInfo) *bool {
	if info == nil {
		return nil
	}
	return info.Allowed
}

func firstRateLimit(primary *codexRateLimitInfo, secondary *codexRateLimitInfo) *codexRateLimitInfo {
	if primary != nil {
		return primary
	}
	return secondary
}

func firstWindow(primary *codexUsageWindow, secondary *codexUsageWindow) *codexUsageWindow {
	if primary != nil {
		return primary
	}
	return secondary
}

func firstAdditionalRateLimits(primary []codexAdditionalLimit, secondary []codexAdditionalLimit) []codexAdditionalLimit {
	if len(primary) > 0 {
		return primary
	}
	return secondary
}

func formatCodexResetLabel(window *codexUsageWindow) string {
	if window == nil {
		return "-"
	}

	if resetAt := numberValue(firstNonNil(window.ResetAt, window.ResetAtCamel)); resetAt != nil && *resetAt > 0 {
		return formatUnixSeconds(int64(*resetAt))
	}
	if resetAfter := numberValue(firstNonNil(window.ResetAfterSeconds, window.ResetAfterSecondsCam)); resetAfter != nil && *resetAfter > 0 {
		return formatUnixSeconds(time.Now().Unix() + int64(*resetAfter))
	}
	return "-"
}

func windowSeconds(window *codexUsageWindow) int64 {
	if window == nil {
		return 0
	}
	value := numberValue(firstNonNil(window.LimitWindowSeconds, window.LimitWindowCamel))
	if value == nil {
		return 0
	}
	return int64(*value)
}

func remainingPercentFromUsed(usedPercent *float64, limitReached bool, allowed *bool, resetLabel string) *int {
	if usedPercent != nil {
		remaining := int(roundNumber(clampNumber(100-*usedPercent, 0, 100)))
		return &remaining
	}
	if limitReached || (allowed != nil && !*allowed) {
		if resetLabel == "-" {
			return nil
		}
		remaining := 0
		return &remaining
	}
	return nil
}

func parseJWTClaims(raw string) map[string]interface{} {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return map[string]interface{}{}
	}

	parts := strings.Split(raw, ".")
	if len(parts) < 2 {
		return map[string]interface{}{}
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return map[string]interface{}{}
	}

	var claims map[string]interface{}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return map[string]interface{}{}
	}

	return claims
}

func nestedMap(root map[string]interface{}, key string) map[string]interface{} {
	if root == nil {
		return map[string]interface{}{}
	}
	value, ok := root[key]
	if !ok {
		return map[string]interface{}{}
	}
	typed, ok := value.(map[string]interface{})
	if !ok {
		return map[string]interface{}{}
	}
	return typed
}

func stringValue(root map[string]interface{}, key string) string {
	if root == nil {
		return ""
	}
	value, ok := root[key]
	if !ok {
		return ""
	}
	typed, ok := value.(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(typed)
}

func numberValue(value interface{}) *float64 {
	switch typed := value.(type) {
	case float64:
		return &typed
	case float32:
		converted := float64(typed)
		return &converted
	case int:
		converted := float64(typed)
		return &converted
	case int32:
		converted := float64(typed)
		return &converted
	case int64:
		converted := float64(typed)
		return &converted
	case json.Number:
		converted, err := typed.Float64()
		if err == nil {
			return &converted
		}
	case string:
		trimmed := strings.TrimSpace(typed)
		if trimmed == "" {
			return nil
		}
		converted, err := json.Number(trimmed).Float64()
		if err == nil {
			return &converted
		}
	}
	return nil
}

func firstNonNil(values ...interface{}) interface{} {
	for _, value := range values {
		if value != nil {
			return value
		}
	}
	return nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func normalizePlanType(value string) string {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	if trimmed == "" {
		return ""
	}
	replacer := strings.NewReplacer(" ", "", "-", "", "_", "")
	switch replacer.Replace(trimmed) {
	case "pro":
		return "pro"
	case "prolite":
		return "prolite"
	case "plus":
		return "plus"
	case "team":
		return "team"
	case "free":
		return "free"
	default:
		return trimmed
	}
}

func formatUnixSeconds(value int64) string {
	if value <= 0 {
		return "-"
	}
	return time.Unix(value, 0).Format("01/02 15:04")
}

func clampNumber(value float64, min float64, max float64) float64 {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

func roundNumber(value float64) float64 {
	if value >= 0 {
		return float64(int(value + 0.5))
	}
	return float64(int(value - 0.5))
}

func boolPtrValue(value *bool) bool {
	return value != nil && *value
}

func ctxOrBackground(ctx context.Context) context.Context {
	if ctx != nil {
		return ctx
	}
	return context.Background()
}

func parseCachedCodexQuota(body []byte) *CodexQuotaResponse {
	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil
	}

	usage := nestedMap(nestedMap(nestedMap(payload, "nolon"), "usage_cache"), "usage")
	if len(usage) == 0 {
		return nil
	}

	identity := nestedMap(usage, "identity")
	planType := normalizePlanType(firstNonEmpty(
		stringValue(payload, "plan_type"),
		stringValue(payload, "planType"),
		stringValue(payload, "plan"),
		stringValue(identity, "plan"),
	))

	windows := make([]CodexQuotaWindow, 0, 2)
	for _, spec := range []struct {
		key   string
		id    string
		label string
	}{
		{key: "primary", id: "five-hour", label: "5H"},
		{key: "secondary", id: "weekly", label: "7D"},
	} {
		window := nestedMap(usage, spec.key)
		if len(window) == 0 {
			continue
		}

		usedPercent := numberValue(firstNonNil(window["usedPercent"], window["used_percent"]))
		var remainingPercent *int
		if usedPercent != nil {
			remaining := int(roundNumber(clampNumber(100-*usedPercent, 0, 100)))
			remainingPercent = &remaining
		}

		resetLabel := firstNonEmpty(
			stringValue(window, "resetDescription"),
			stringValue(window, "reset_description"),
		)
		if resetLabel == "" {
			if resetsAt := numberValue(firstNonNil(window["resetsAt"], window["resets_at"])); resetsAt != nil {
				resetLabel = formatUnixSeconds(int64(*resetsAt))
			}
		}
		if resetLabel == "" {
			resetLabel = "-"
		}

		windows = append(windows, CodexQuotaWindow{
			ID:               spec.id,
			Label:            spec.label,
			RemainingPercent: remainingPercent,
			ResetLabel:       resetLabel,
		})
	}

	if planType == "" && len(windows) == 0 {
		return nil
	}

	return &CodexQuotaResponse{
		PlanType: planType,
		Windows:  windows,
	}
}
