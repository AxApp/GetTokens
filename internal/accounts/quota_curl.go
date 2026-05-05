package accounts

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
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
	var payload codexUsagePayload
	if err := json.Unmarshal(usagePayloadBody, &payload); err != nil {
		return nil, fmt.Errorf("codex 额度响应解析失败: %w", err)
	}
	return &CodexQuotaResponse{
		PlanType: normalizePlanType(firstNonEmpty(payload.PlanType, payload.PlanTypeCamel, fallbackPlanType)),
		Windows:  buildCodexQuotaWindows(&payload),
	}, nil
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
