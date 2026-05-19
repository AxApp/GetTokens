package accounts

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

type CodexQuotaCurlInput struct {
	Curl    string
	APIKey  string
	BaseURL string
	Prefix  string
}

type CodexQuotaCurlRequest struct {
	Method  string
	URL     string
	Headers map[string]string
	Body    string
}

func BuildCodexQuotaCurlRequest(input CodexQuotaCurlInput) (*CodexQuotaCurlRequest, error) {
	raw := strings.TrimSpace(input.Curl)
	if raw == "" {
		return nil, errors.New("quota curl 不能为空")
	}
	if containsUnsupportedShellOperator(raw) {
		return nil, errors.New("quota curl 不支持管道、重定向或多命令 shell 语法")
	}

	tokens, err := splitCurlCommand(raw)
	if err != nil {
		return nil, err
	}
	if len(tokens) == 0 {
		return nil, errors.New("quota curl 不能为空")
	}
	if tokens[0] == "curl" {
		tokens = tokens[1:]
	}

	request := &CodexQuotaCurlRequest{
		Method:  http.MethodGet,
		Headers: map[string]string{},
	}

	for index := 0; index < len(tokens); index++ {
		token := tokens[index]
		switch token {
		case "-s", "-S", "-sS", "--silent", "--show-error", "-L", "--location", "--compressed", "-i", "--include":
			continue
		case "-X", "--request":
			value, next, err := nextCurlValue(tokens, index)
			if err != nil {
				return nil, err
			}
			request.Method = strings.ToUpper(applyCodexQuotaCurlPlaceholders(value, input))
			index = next
		case "-H", "--header":
			value, next, err := nextCurlValue(tokens, index)
			if err != nil {
				return nil, err
			}
			key, headerValue, ok := strings.Cut(applyCodexQuotaCurlPlaceholders(value, input), ":")
			if !ok || strings.TrimSpace(key) == "" {
				return nil, fmt.Errorf("quota curl header 格式无效: %s", value)
			}
			request.Headers[strings.TrimSpace(key)] = strings.TrimSpace(headerValue)
			index = next
		case "-b", "--cookie":
			value, next, err := nextCurlValue(tokens, index)
			if err != nil {
				return nil, err
			}
			applyCodexQuotaCurlCookieHeader(request, applyCodexQuotaCurlPlaceholders(value, input))
			index = next
		case "-d", "--data", "--data-raw", "--data-binary", "--data-ascii":
			value, next, err := nextCurlValue(tokens, index)
			if err != nil {
				return nil, err
			}
			if request.Method == http.MethodGet {
				request.Method = http.MethodPost
			}
			request.Body = applyCodexQuotaCurlPlaceholders(value, input)
			index = next
		case "--url":
			value, next, err := nextCurlValue(tokens, index)
			if err != nil {
				return nil, err
			}
			request.URL = applyCodexQuotaCurlPlaceholders(value, input)
			index = next
		default:
			if strings.HasPrefix(token, "-") {
				return nil, fmt.Errorf("quota curl 暂不支持参数: %s", token)
			}
			if request.URL == "" {
				request.URL = applyCodexQuotaCurlPlaceholders(token, input)
			}
		}
	}

	request.URL = strings.TrimSpace(request.URL)
	if request.URL == "" {
		return nil, errors.New("quota curl 缺少 URL")
	}
	if !strings.HasPrefix(request.URL, "http://") && !strings.HasPrefix(request.URL, "https://") {
		return nil, errors.New("quota curl URL 必须是 http 或 https")
	}
	if request.Method == "" {
		request.Method = http.MethodGet
	}
	return request, nil
}

func BuildCodexQuotaResponseFromUsagePayload(usagePayloadBody []byte, fallbackPlanType string) (*CodexQuotaResponse, error) {
	if quota := tryBuildXiaomiMiMoQuota(usagePayloadBody, fallbackPlanType); quota != nil {
		return quota, nil
	}

	var payload codexUsagePayload
	if err := json.Unmarshal(usagePayloadBody, &payload); err != nil {
		// Not a Codex usage response — try billing format
		if billing := tryBuildBilling(usagePayloadBody); billing != nil {
			return &CodexQuotaResponse{
				PlanType: fallbackPlanType,
				Windows:  nil,
				Billing:  billing,
			}, nil
		}
		return nil, fmt.Errorf("codex 额度响应解析失败: %w", err)
	}

	quota := &CodexQuotaResponse{
		PlanType: normalizePlanType(firstNonEmpty(payload.PlanType, payload.PlanTypeCamel, fallbackPlanType)),
		Windows:  buildCodexQuotaWindows(&payload),
	}

	if billing := tryBuildBilling(usagePayloadBody); billing != nil {
		quota.Billing = billing
	}

	return quota, nil
}

type xiaomiMiMoTokenPlanUsagePayload struct {
	Data struct {
		MonthUsage xiaomiMiMoUsageGroup `json:"monthUsage"`
		Usage      xiaomiMiMoUsageGroup `json:"usage"`
	} `json:"data"`
}

type xiaomiMiMoUsageGroup struct {
	Percent interface{}           `json:"percent"`
	Items   []xiaomiMiMoUsageItem `json:"items"`
}

type xiaomiMiMoUsageItem struct {
	Name    string      `json:"name"`
	Used    interface{} `json:"used"`
	Limit   interface{} `json:"limit"`
	Percent interface{} `json:"percent"`
}

func tryBuildXiaomiMiMoQuota(body []byte, fallbackPlanType string) *CodexQuotaResponse {
	var payload xiaomiMiMoTokenPlanUsagePayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil
	}

	windows := make([]CodexQuotaWindow, 0, 2)
	if window := xiaomiMiMoQuotaWindow("mimo-plan-total-token", "PLAN", payload.Data.Usage, "plan_total_token"); window != nil {
		windows = append(windows, *window)
	}
	if window := xiaomiMiMoQuotaWindow("mimo-month-total-token", "MONTH", payload.Data.MonthUsage, "month_total_token"); window != nil {
		windows = append(windows, *window)
	}
	if len(windows) == 0 {
		return nil
	}

	return &CodexQuotaResponse{
		PlanType: normalizePlanType(firstNonEmpty(fallbackPlanType, "xiaomimimo")),
		Windows:  windows,
	}
}

func xiaomiMiMoQuotaWindow(id string, label string, group xiaomiMiMoUsageGroup, preferredItemName string) *CodexQuotaWindow {
	item := xiaomiMiMoQuotaItem(group, preferredItemName)
	if item == nil {
		return nil
	}

	usedPercent := xiaomiMiMoUsedPercent(*item, group)
	if usedPercent == nil {
		return nil
	}
	remaining := int(roundNumber(clampNumber(100-*usedPercent, 0, 100)))

	return &CodexQuotaWindow{
		ID:               id,
		Label:            label,
		RemainingPercent: &remaining,
		ResetLabel:       "-",
	}
}

func xiaomiMiMoQuotaItem(group xiaomiMiMoUsageGroup, preferredName string) *xiaomiMiMoUsageItem {
	for index := range group.Items {
		if strings.EqualFold(strings.TrimSpace(group.Items[index].Name), preferredName) {
			return &group.Items[index]
		}
	}
	for index := range group.Items {
		if xiaomiMiMoItemHasUsage(group.Items[index]) {
			return &group.Items[index]
		}
	}
	return nil
}

func xiaomiMiMoItemHasUsage(item xiaomiMiMoUsageItem) bool {
	for _, value := range []interface{}{item.Used, item.Limit, item.Percent} {
		if parsed := numberValue(value); parsed != nil && *parsed > 0 {
			return true
		}
	}
	return false
}

func xiaomiMiMoUsedPercent(item xiaomiMiMoUsageItem, group xiaomiMiMoUsageGroup) *float64 {
	if percent := numberValue(item.Percent); percent != nil && *percent > 0 {
		return percent
	}
	if percent := numberValue(group.Percent); percent != nil && *percent > 0 {
		return percent
	}

	used := numberValue(item.Used)
	limit := numberValue(item.Limit)
	if used == nil || limit == nil || *limit <= 0 {
		if percent := numberValue(item.Percent); percent != nil {
			return percent
		}
		if percent := numberValue(group.Percent); percent != nil {
			return percent
		}
		return nil
	}
	calculated := (*used / *limit) * 100
	return &calculated
}

type deepseekBalancePayload struct {
	IsAvailable  bool `json:"is_available"`
	BalanceInfos []struct {
		Currency        string `json:"currency"`
		TotalBalance    string `json:"total_balance"`
		GrantedBalance  string `json:"granted_balance"`
		ToppedUpBalance string `json:"topped_up_balance"`
	} `json:"balance_infos"`
}

func tryBuildBilling(body []byte) *CodexQuotaBilling {
	var ds deepseekBalancePayload
	if err := json.Unmarshal(body, &ds); err != nil || len(ds.BalanceInfos) == 0 {
		return nil
	}
	infos := make([]CodexQuotaBalanceInfo, 0, len(ds.BalanceInfos))
	for _, info := range ds.BalanceInfos {
		infos = append(infos, CodexQuotaBalanceInfo{
			Currency:        info.Currency,
			TotalBalance:    info.TotalBalance,
			GrantedBalance:  info.GrantedBalance,
			ToppedUpBalance: info.ToppedUpBalance,
		})
	}
	return &CodexQuotaBilling{
		IsAvailable:  ds.IsAvailable,
		BalanceInfos: infos,
	}
}

func RedactCodexQuotaCurlHeaders(headers map[string]string) map[string]string {
	redacted := make(map[string]string, len(headers))
	for key, value := range headers {
		normalized := strings.ToLower(strings.TrimSpace(key))
		switch {
		case normalized == "authorization":
			if strings.HasPrefix(strings.ToLower(strings.TrimSpace(value)), "bearer ") {
				redacted[key] = "Bearer <redacted>"
			} else {
				redacted[key] = "<redacted>"
			}
		case normalized == "cookie" || strings.Contains(normalized, "api-key") || strings.Contains(normalized, "token"):
			redacted[key] = "<redacted>"
		default:
			redacted[key] = value
		}
	}
	return redacted
}

func RedactCodexQuotaCurlURL(value string, apiKey string) string {
	return redactCodexQuotaCurlValue(value, apiKey)
}

func redactCodexQuotaCurlValue(value string, apiKey string) string {
	redacted := value
	if trimmed := strings.TrimSpace(apiKey); trimmed != "" {
		redacted = strings.ReplaceAll(redacted, trimmed, "<redacted>")
	}
	return redacted
}

func applyCodexQuotaCurlCookieHeader(request *CodexQuotaCurlRequest, value string) {
	cookie := strings.TrimSpace(value)
	if cookie == "" {
		return
	}
	key := findCodexQuotaCurlHeaderKey(request.Headers, "Cookie")
	if key == "" {
		key = "Cookie"
	}
	if existing := strings.TrimSpace(request.Headers[key]); existing != "" {
		request.Headers[key] = existing + "; " + cookie
		return
	}
	request.Headers[key] = cookie
}

func findCodexQuotaCurlHeaderKey(headers map[string]string, target string) string {
	for key := range headers {
		if strings.EqualFold(strings.TrimSpace(key), target) {
			return key
		}
	}
	return ""
}

func nextCurlValue(tokens []string, index int) (string, int, error) {
	next := index + 1
	if next >= len(tokens) {
		return "", index, fmt.Errorf("quota curl 参数缺少值: %s", tokens[index])
	}
	return tokens[next], next, nil
}

func applyCodexQuotaCurlPlaceholders(value string, input CodexQuotaCurlInput) string {
	replacer := strings.NewReplacer(
		"{{apiKey}}", strings.TrimSpace(input.APIKey),
		"{{baseUrl}}", NormalizeBaseURL(input.BaseURL),
		"{{prefix}}", NormalizePrefix(input.Prefix),
	)
	return replacer.Replace(value)
}

func containsUnsupportedShellOperator(value string) bool {
	inSingle := false
	inDouble := false
	escaped := false
	previous := rune(0)
	for _, r := range value {
		if escaped {
			escaped = false
			previous = r
			continue
		}
		if r == '\\' {
			escaped = true
			previous = r
			continue
		}
		switch r {
		case '\'':
			if !inDouble {
				inSingle = !inSingle
			}
		case '"':
			if !inSingle {
				inDouble = !inDouble
			}
		case '|', '>', '<', ';', '&', '`':
			if !inSingle && !inDouble {
				return true
			}
		case '(':
			if !inSingle && !inDouble && previous == '$' {
				return true
			}
		}
		previous = r
	}
	return false
}

func splitCurlCommand(value string) ([]string, error) {
	tokens := []string{}
	var builder strings.Builder
	inSingle := false
	inDouble := false
	escaped := false

	flush := func() {
		if builder.Len() == 0 {
			return
		}
		tokens = append(tokens, builder.String())
		builder.Reset()
	}

	for _, r := range value {
		if escaped {
			if r == '\n' || r == '\r' {
				escaped = false
				flush()
				continue
			}
			builder.WriteRune(r)
			escaped = false
			continue
		}
		if r == '\\' {
			escaped = true
			continue
		}
		switch r {
		case '\'':
			if !inDouble {
				inSingle = !inSingle
				continue
			}
		case '"':
			if !inSingle {
				inDouble = !inDouble
				continue
			}
		case ' ', '\n', '\t', '\r':
			if !inSingle && !inDouble {
				flush()
				continue
			}
		}
		builder.WriteRune(r)
	}
	if escaped {
		builder.WriteRune('\\')
	}
	if inSingle || inDouble {
		return nil, errors.New("quota curl 引号未闭合")
	}
	flush()
	return tokens, nil
}

// TryParseBillingResponse attempts to parse a billing/balance API response.
// Supports DeepSeek, OpenRouter, OpenAI, SiliconFlow, and generic {total, balance} formats.
func TryParseBillingResponse(body []byte) *CodexQuotaBilling {
	// Format 1: DeepSeek — {"is_available": true, "balance_infos": [...]}
	if billing := tryBuildBilling(body); billing != nil {
		return billing
	}

	// Format 2: OpenRouter / SiliconFlow — {"data": {"total_credits": ..., "total_usage": ...}}
	var or struct {
		Data struct {
			TotalCredits float64 `json:"total_credits"`
			TotalUsage   float64 `json:"total_usage"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &or); err == nil && or.Data.TotalCredits > 0 {
		remaining := or.Data.TotalCredits - or.Data.TotalUsage
		return &CodexQuotaBilling{
			IsAvailable: true,
			BalanceInfos: []CodexQuotaBalanceInfo{{
				Currency:        "USD",
				TotalBalance:    fmt.Sprintf("%.2f", or.Data.TotalCredits),
				GrantedBalance:  fmt.Sprintf("%.2f", remaining),
				ToppedUpBalance: fmt.Sprintf("%.2f", or.Data.TotalCredits),
			}},
		}
	}

	// Format 3: OpenAI — {"total_granted": ..., "total_used": ..., "total_available": ...}
	var oai struct {
		TotalGranted   float64 `json:"total_granted"`
		TotalUsed      float64 `json:"total_used"`
		TotalAvailable float64 `json:"total_available"`
		HardLimitUSD   float64 `json:"hard_limit_usd"`
		SoftLimitUSD   float64 `json:"soft_limit_usd"`
	}
	if err := json.Unmarshal(body, &oai); err == nil && (oai.TotalGranted > 0 || oai.HardLimitUSD > 0) {
		granted := oai.HardLimitUSD
		if granted == 0 {
			granted = oai.SoftLimitUSD
		}
		if granted == 0 {
			granted = oai.TotalGranted
		}
		used := oai.TotalUsed
		if used == 0 {
			used = granted - oai.TotalAvailable
		}
		return &CodexQuotaBilling{
			IsAvailable: true,
			BalanceInfos: []CodexQuotaBalanceInfo{{
				Currency:        "USD",
				TotalBalance:    fmt.Sprintf("%.2f", granted),
				GrantedBalance:  fmt.Sprintf("%.2f", oai.TotalAvailable),
				ToppedUpBalance: fmt.Sprintf("%.2f", granted),
			}},
		}
	}

	// Format 4: Generic — {"total_balance": ..., "balance": ...} or {"balance": ...}
	var generic struct {
		TotalBalance     interface{} `json:"total_balance"`
		Balance          interface{} `json:"balance"`
		RemainingCredits interface{} `json:"remaining_credits"`
		Currency         string      `json:"currency"`
	}
	if err := json.Unmarshal(body, &generic); err == nil {
		balance := firstFloatFromInterface(generic.TotalBalance, generic.Balance, generic.RemainingCredits)
		if balance > 0 {
			currency := generic.Currency
			if currency == "" {
				currency = "USD"
			}
			return &CodexQuotaBilling{
				IsAvailable: true,
				BalanceInfos: []CodexQuotaBalanceInfo{{
					Currency:        currency,
					TotalBalance:    fmt.Sprintf("%.2f", balance),
					GrantedBalance:  fmt.Sprintf("%.2f", balance),
					ToppedUpBalance: fmt.Sprintf("%.2f", balance),
				}},
			}
		}
	}

	return nil
}

func firstFloatFromInterface(values ...interface{}) float64 {
	for _, v := range values {
		switch val := v.(type) {
		case float64:
			if val > 0 {
				return val
			}
		case string:
			if f, err := strconv.ParseFloat(val, 64); err == nil && f > 0 {
				return f
			}
		case json.Number:
			if f, err := val.Float64(); err == nil && f > 0 {
				return f
			}
		}
	}
	return 0
}
