package wailsapp

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	relayCodexOpenAIProviderID                  = "openai"
	relayCodexProviderID                        = "gettokens"
	relayCodexProviderName                      = "GetTokens"
	relayCodexDefaultModel                      = "gpt-5.4"
	relayCodexDefaultReasoning                  = "high"
	relayCodexChatGPTBackendBaseURL             = "https://chatgpt.com/backend-api/codex"
	relayLocalAuthStrategyReplaceAuthWithAPIKey = "replace_auth_with_apikey"
	relayLocalAuthStrategyPreserveChatGPTAuth   = "preserve_chatgpt_auth"
	relayLocalAuthStrategyReplaceAuthWithOAuth  = "replace_auth_with_oauth"
)

func (a *App) ApplyRelayServiceConfigToLocal(apiKey string, baseURL string, model string, reasoningEffort string, providerID string, providerName string, supportsWebsockets bool) (*RelayLocalApplyResult, error) {
	return a.ApplyRelayServiceConfigToLocalV2(RelayLocalApplyInput{
		APIKey:             apiKey,
		BaseURL:            baseURL,
		Model:              model,
		ReasoningEffort:    reasoningEffort,
		ProviderID:         providerID,
		ProviderName:       providerName,
		SupportsWebsockets: supportsWebsockets,
		AuthStrategy:       relayLocalAuthStrategyReplaceAuthWithAPIKey,
	})
}

func (a *App) ApplyRelayServiceConfigToLocalV2(input RelayLocalApplyInput) (*RelayLocalApplyResult, error) {
	normalized, err := normalizeRelayLocalApplyInput(input)
	if err != nil {
		return nil, err
	}

	result, err := applyRelayServiceConfigToLocalV2(normalized)
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(normalized.APIKey) != "" && !normalized.SkipRelayKeyMetadata {
		metadata, err := loadRelayServiceAPIKeyMetadata()
		if err != nil {
			return nil, err
		}
		metadata, changed := markRelayServiceAPIKeyLastUsed(metadata, normalized.APIKey, time.Now())
		if changed {
			if err := saveRelayServiceAPIKeyMetadata(metadata); err != nil {
				return nil, err
			}
		}
	}

	return result, nil
}

func (a *App) GetLocalCodexAuthState() (*LocalCodexAuthState, error) {
	return getLocalCodexAuthState()
}

func applyRelayServiceConfigToLocal(apiKey string, baseURL string, model string, reasoningEffort string, providerID string, providerName string, supportsWebsockets bool) (*RelayLocalApplyResult, error) {
	return applyRelayServiceConfigToLocalV2(RelayLocalApplyInput{
		APIKey:             apiKey,
		BaseURL:            baseURL,
		Model:              model,
		ReasoningEffort:    reasoningEffort,
		ProviderID:         providerID,
		ProviderName:       providerName,
		SupportsWebsockets: supportsWebsockets,
		AuthStrategy:       relayLocalAuthStrategyReplaceAuthWithAPIKey,
	})
}

func applyRelayServiceConfigToLocalV2(input RelayLocalApplyInput) (*RelayLocalApplyResult, error) {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		return nil, err
	}

	authPath := filepath.Join(codexHome, "auth.json")
	configPath := filepath.Join(codexHome, "config.toml")

	if input.AuthStrategy == relayLocalAuthStrategyReplaceAuthWithAPIKey {
		authPayload, err := buildRelayCodexAuthJSON(input.APIKey)
		if err != nil {
			return nil, err
		}
		if err := writeFileAtomically(authPath, authPayload, 0600); err != nil {
			return nil, err
		}
	} else if input.AuthStrategy == relayLocalAuthStrategyReplaceAuthWithOAuth {
		authPayload, err := buildRelayCodexOAuthAuthJSON(input.AuthFileContentBase64)
		if err != nil {
			return nil, err
		}
		if err := writeFileAtomically(authPath, authPayload, 0600); err != nil {
			return nil, err
		}
	} else {
		if input.ProviderID == relayCodexOpenAIProviderID {
			return nil, errors.New("preserve_chatgpt_auth 模式不支持内置 openai provider，请改用自定义 provider id")
		}
		authState, err := getLocalCodexAuthState()
		if err != nil {
			return nil, err
		}
		if !authState.CanPreserveChatGPTAuth {
			return nil, errors.New("当前本地 auth.json 不是可保留的 ChatGPT 登录态，请先完成 ChatGPT 登录")
		}
	}

	existingConfig, err := readOptionalTextFile(configPath)
	if err != nil {
		return nil, err
	}
	configPayload := mergeRelayCodexConfigToml(existingConfig, input)
	if err := writeFileAtomically(configPath, []byte(configPayload), 0600); err != nil {
		return nil, err
	}

	return &RelayLocalApplyResult{
		CodexHomePath: codexHome,
		AuthFilePath:  authPath,
		ConfigPath:    configPath,
	}, nil
}

func normalizeRelayLocalApplyInput(input RelayLocalApplyInput) (RelayLocalApplyInput, error) {
	authStrategy := normalizeRelayLocalAuthStrategy(input.AuthStrategy)
	if authStrategy == "" {
		return RelayLocalApplyInput{}, errors.New("缺少 authStrategy")
	}

	normalizedAPIKey := strings.TrimSpace(input.APIKey)
	if normalizedAPIKey == "" && authStrategy != relayLocalAuthStrategyReplaceAuthWithOAuth {
		return RelayLocalApplyInput{}, errors.New("缺少 API KEY")
	}

	normalizedBaseURL := normalizeRelayLocalBaseURL(input.BaseURL)
	if normalizedBaseURL == "" {
		return RelayLocalApplyInput{}, errors.New("缺少 BASE URL")
	}

	normalizedProviderID, normalizedProviderName := normalizeRelayLocalProvider(input.ProviderID, input.ProviderName)
	return RelayLocalApplyInput{
		APIKey:                normalizedAPIKey,
		AuthFileContentBase64: strings.TrimSpace(input.AuthFileContentBase64),
		BaseURL:               normalizedBaseURL,
		Model:                 normalizeRelayLocalModel(input.Model),
		ReasoningEffort:       normalizeRelayLocalReasoningEffort(input.ReasoningEffort),
		ProviderID:            normalizedProviderID,
		ProviderName:          normalizedProviderName,
		SupportsWebsockets:    input.SupportsWebsockets,
		AuthStrategy:          authStrategy,
		SkipRelayKeyMetadata:  input.SkipRelayKeyMetadata,
	}, nil
}

func resolveCodexHomePath() (string, error) {
	if override := strings.TrimSpace(os.Getenv("CODEX_HOME")); override != "" {
		return override, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".codex"), nil
}

func normalizeRelayLocalBaseURL(value string) string {
	trimmed := strings.TrimSpace(value)
	return strings.TrimRight(trimmed, "/")
}

func normalizeRelayLocalModel(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return relayCodexDefaultModel
	}
	return trimmed
}

func normalizeRelayLocalReasoningEffort(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "none", "minimal", "low", "medium", "high", "xhigh":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return relayCodexDefaultReasoning
	}
}

func normalizeRelayLocalAuthStrategy(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", relayLocalAuthStrategyReplaceAuthWithAPIKey:
		return relayLocalAuthStrategyReplaceAuthWithAPIKey
	case relayLocalAuthStrategyPreserveChatGPTAuth:
		return relayLocalAuthStrategyPreserveChatGPTAuth
	case relayLocalAuthStrategyReplaceAuthWithOAuth:
		return relayLocalAuthStrategyReplaceAuthWithOAuth
	default:
		return ""
	}
}

func normalizeRelayLocalProvider(providerID string, providerName string) (string, string) {
	normalizedID := normalizeRelayLocalProviderID(providerID)
	if normalizedID == "" {
		normalizedID = relayCodexOpenAIProviderID
	}

	trimmedName := strings.TrimSpace(providerName)
	if trimmedName == "" {
		if normalizedID == relayCodexOpenAIProviderID {
			trimmedName = "OpenAI"
		} else {
			trimmedName = normalizedID
		}
	}

	return normalizedID, trimmedName
}

func normalizeRelayLocalProviderID(value string) string {
	trimmed := strings.ToLower(strings.TrimSpace(value))
	if trimmed == "" {
		return ""
	}

	var builder strings.Builder
	lastDash := false
	for _, ch := range trimmed {
		switch {
		case ch >= 'a' && ch <= 'z', ch >= '0' && ch <= '9', ch == '_':
			builder.WriteRune(ch)
			lastDash = false
		case ch == '-':
			if !lastDash && builder.Len() > 0 {
				builder.WriteRune(ch)
				lastDash = true
			}
		default:
			if !lastDash && builder.Len() > 0 {
				builder.WriteRune('-')
				lastDash = true
			}
		}
	}

	return strings.Trim(builder.String(), "-")
}

func buildRelayCodexAuthJSON(apiKey string) ([]byte, error) {
	payload := map[string]any{
		"auth_mode":      "apikey",
		"OPENAI_API_KEY": strings.TrimSpace(apiKey),
	}
	body, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("序列化 auth.json 失败: %w", err)
	}
	return append(body, '\n'), nil
}

func buildRelayCodexOAuthAuthJSON(contentBase64 string) ([]byte, error) {
	trimmed := strings.TrimSpace(contentBase64)
	if trimmed == "" {
		return nil, errors.New("缺少 Codex OAuth auth.json 内容")
	}

	body, err := base64.StdEncoding.DecodeString(trimmed)
	if err != nil {
		return nil, fmt.Errorf("Codex OAuth auth.json base64 解码失败: %w", err)
	}

	payload := map[string]any{}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("Codex OAuth auth.json 不是有效 JSON: %w", err)
	}
	nextPayload, err := normalizeRelayCodexOAuthAuthPayload(payload)
	if err != nil {
		return nil, err
	}

	nextBody, err := json.MarshalIndent(nextPayload, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("序列化 Codex OAuth auth.json 失败: %w", err)
	}
	return append(nextBody, '\n'), nil
}

func normalizeRelayCodexOAuthAuthPayload(payload map[string]any) (map[string]any, error) {
	tokensPayload := map[string]any{}
	if tokens, ok := payload["tokens"].(map[string]any); ok {
		for key, value := range tokens {
			tokensPayload[key] = value
		}
	}

	accessToken := firstAuthString(
		tokensPayload["access_token"],
		tokensPayload["accessToken"],
		payload["access_token"],
		payload["accessToken"],
	)
	idToken := firstAuthString(
		tokensPayload["id_token"],
		tokensPayload["idToken"],
		payload["id_token"],
		payload["idToken"],
	)
	refreshToken := firstAuthString(
		tokensPayload["refresh_token"],
		tokensPayload["refreshToken"],
		payload["refresh_token"],
		payload["refreshToken"],
	)
	accountID := firstAuthString(
		tokensPayload["account_id"],
		tokensPayload["accountId"],
		payload["account_id"],
		payload["accountId"],
	)

	if accessToken == "" {
		return nil, errors.New("Codex OAuth auth.json 缺少 access_token，不能写入 OAuth 模式")
	}
	if idToken == "" {
		return nil, errors.New("Codex OAuth auth.json 缺少 id_token，不能写入 OAuth 模式")
	}

	tokens := map[string]any{
		"id_token":      idToken,
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	}
	if accountID != "" {
		tokens["account_id"] = accountID
	} else if _, ok := tokensPayload["account_id"]; ok {
		tokens["account_id"] = tokensPayload["account_id"]
	}

	nextPayload := map[string]any{
		"auth_mode": "chatgpt",
		"tokens":    tokens,
	}
	if lastRefresh := firstAuthString(payload["last_refresh"], payload["lastRefresh"]); lastRefresh != "" {
		nextPayload["last_refresh"] = lastRefresh
	}
	if email := firstAuthString(payload["email"], readNestedAuthAny(payload, "user", "email")); email != "" {
		nextPayload["user"] = map[string]any{
			"email": email,
		}
		if planType := firstAuthString(payload["plan_type"], payload["planType"], readNestedAuthAny(payload, "user", "plan_type")); planType != "" {
			nextPayload["user"].(map[string]any)["plan_type"] = planType
		}
	}

	return nextPayload, nil
}

func readOptionalTextFile(path string) (string, error) {
	body, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func writeFileAtomically(path string, body []byte, mode os.FileMode) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}

	file, err := os.CreateTemp(dir, filepath.Base(path)+".tmp-*")
	if err != nil {
		return err
	}
	tempPath := file.Name()
	cleanup := true
	defer func() {
		_ = file.Close()
		if cleanup {
			_ = os.Remove(tempPath)
		}
	}()

	if _, err := file.Write(body); err != nil {
		return err
	}
	if err := file.Chmod(mode); err != nil {
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	if err := os.Rename(tempPath, path); err != nil {
		return err
	}
	cleanup = false
	return nil
}

func buildRelayCodexConfigToml(baseURL string, model string, reasoningEffort string, providerID string, providerName string, supportsWebsockets bool) string {
	if providerID == relayCodexOpenAIProviderID {
		return fmt.Sprintf(
			"model = %q\nmodel_reasoning_effort = %q\nopenai_base_url = %q\n",
			strings.TrimSpace(model),
			reasoningEffort,
			strings.TrimSpace(baseURL),
		)
	}

	wsLine := ""
	if supportsWebsockets {
		wsLine = "\nsupports_websockets = true"
	}
	return fmt.Sprintf(
		"model = %q\nmodel_reasoning_effort = %q\nmodel_provider = %q\n\n[model_providers.%s]\nname = %q\nbase_url = %q\nrequires_openai_auth = true\nwire_api = \"responses\"%s\n",
		strings.TrimSpace(model),
		reasoningEffort,
		providerID,
		providerID,
		providerName,
		strings.TrimSpace(baseURL),
		wsLine,
	)
}

func mergeRelayCodexConfigToml(existing string, input RelayLocalApplyInput) string {
	lines, newline := splitTomlDocument(existing)

	hasModelProvider := rootTomlKeyExists(lines, "model_provider")
	lines = upsertRootTomlKey(lines, "model", quoteTomlString(strings.TrimSpace(input.Model)), true)
	lines = upsertRootTomlKey(lines, "model_reasoning_effort", quoteTomlString(input.ReasoningEffort), true)

	if input.ProviderID == relayCodexOpenAIProviderID {
		if input.AuthStrategy == relayLocalAuthStrategyReplaceAuthWithOAuth {
			lines = deleteTomlRootKey(lines, "openai_base_url")
		} else {
			lines = upsertRootTomlKey(lines, "openai_base_url", quoteTomlString(strings.TrimSpace(input.BaseURL)), true)
		}
		if hasModelProvider {
			lines = upsertRootTomlKey(lines, "model_provider", quoteTomlString(relayCodexOpenAIProviderID), false)
		}
	} else {
		lines = upsertRootTomlKey(lines, "model_provider", quoteTomlString(input.ProviderID), true)
		sectionName := fmt.Sprintf("model_providers.%s", input.ProviderID)
		providerBaseURL := strings.TrimSpace(input.BaseURL)
		if input.AuthStrategy == relayLocalAuthStrategyReplaceAuthWithOAuth {
			providerBaseURL = relayCodexChatGPTBackendBaseURL
		}
		lines = upsertTomlSectionKey(lines, sectionName, "name", quoteTomlString(input.ProviderName), true)
		lines = upsertTomlSectionKey(lines, sectionName, "base_url", quoteTomlString(providerBaseURL), true)
		lines = upsertTomlSectionKey(lines, sectionName, "requires_openai_auth", "true", true)
		lines = upsertTomlSectionKey(lines, sectionName, "wire_api", quoteTomlString("responses"), true)
		if input.AuthStrategy == relayLocalAuthStrategyPreserveChatGPTAuth {
			lines = deleteTomlSectionKey(lines, sectionName, "env_key")
			lines = upsertTomlSectionKey(lines, sectionName, "experimental_bearer_token", quoteTomlString(input.APIKey), true)
		} else if input.AuthStrategy == relayLocalAuthStrategyReplaceAuthWithOAuth {
			lines = deleteTomlSectionKey(lines, sectionName, "env_key")
			lines = deleteTomlSectionKey(lines, sectionName, "experimental_bearer_token")
		} else {
			lines = deleteTomlSectionKey(lines, sectionName, "experimental_bearer_token")
		}
		if input.SupportsWebsockets {
			lines = upsertTomlSectionKey(lines, sectionName, "supports_websockets", "true", true)
		}
	}

	if len(lines) == 0 {
		return ""
	}
	return strings.Join(lines, newline) + newline
}

func getLocalCodexAuthState() (*LocalCodexAuthState, error) {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}
	authPath := filepath.Join(codexHome, "auth.json")

	body, err := readOptionalTextFile(authPath)
	if err != nil {
		return nil, err
	}

	state := &LocalCodexAuthState{
		AuthFilePath: authPath,
		AuthMode:     "none",
	}
	if strings.TrimSpace(body) == "" {
		return state, nil
	}

	state.HasAuthFile = true

	payload := map[string]any{}
	if err := json.Unmarshal([]byte(body), &payload); err != nil {
		return nil, fmt.Errorf("现有 auth.json 不是有效 JSON，无法判断 ChatGPT 登录态: %w", err)
	}

	authMode := strings.ToLower(strings.TrimSpace(readAuthString(payload["auth_mode"])))
	openAIAPIKey := strings.TrimSpace(readAuthString(payload["OPENAI_API_KEY"]))
	hasTokens := hasAuthTokens(payload["tokens"])

	state.HasOpenAIAPIKey = openAIAPIKey != ""
	state.HasTokens = hasTokens
	state.AccountEmail = readNestedAuthString(payload, "user", "email")
	state.PlanType = readNestedAuthString(payload, "user", "plan_type")

	switch {
	case authMode == "apikey":
		state.AuthMode = "apikey"
	case authMode == "chatgpt":
		state.AuthMode = "chatgpt"
		state.CanPreserveChatGPTAuth = hasTokens
	case state.HasOpenAIAPIKey:
		state.AuthMode = "apikey"
	case hasTokens:
		state.AuthMode = "chatgpt_auth_tokens"
		state.CanPreserveChatGPTAuth = true
	default:
		state.AuthMode = "unknown"
	}

	if authMode == "chatgpt" && !hasTokens {
		state.Warnings = append(state.Warnings, "auth_mode=chatgpt 但未发现 tokens 字段")
	}
	if authMode == "chatgpt" && state.HasOpenAIAPIKey {
		state.Warnings = append(state.Warnings, "auth_mode=chatgpt 优先生效，auth.json 中残留的 OPENAI_API_KEY 将被 Codex 主认证忽略")
	}

	return state, nil
}

func splitTomlDocument(input string) ([]string, string) {
	newline := "\n"
	if strings.Contains(input, "\r\n") {
		newline = "\r\n"
	}

	normalized := strings.ReplaceAll(input, "\r\n", "\n")
	normalized = strings.TrimRight(normalized, "\n")
	if normalized == "" {
		return nil, newline
	}
	return strings.Split(normalized, "\n"), newline
}

func quoteTomlString(value string) string {
	return fmt.Sprintf("%q", value)
}

func rootTomlKeyExists(lines []string, key string) bool {
	rootEnd := firstTomlSectionIndex(lines)
	for index := 0; index < rootEnd; index++ {
		if tomlLineDefinesKey(lines[index], key) {
			return true
		}
	}
	return false
}

func upsertRootTomlKey(lines []string, key string, value string, insertIfMissing bool) []string {
	rootEnd := firstTomlSectionIndex(lines)
	for index := 0; index < rootEnd; index++ {
		if tomlLineDefinesKey(lines[index], key) {
			lines[index] = rewriteTomlKeyLine(lines[index], key, value)
			return lines
		}
	}
	if !insertIfMissing {
		return lines
	}

	insertAt := rootEnd
	lines = append(lines, "")
	copy(lines[insertAt+1:], lines[insertAt:])
	lines[insertAt] = fmt.Sprintf("%s = %s", key, value)
	return lines
}

func upsertTomlSectionKey(lines []string, sectionName string, key string, value string, createIfMissing bool) []string {
	header := "[" + sectionName + "]"
	start, end, found := findTomlSection(lines, header)
	if !found {
		if !createIfMissing {
			return lines
		}
		if len(lines) > 0 && strings.TrimSpace(lines[len(lines)-1]) != "" {
			lines = append(lines, "")
		}
		lines = append(lines, header)
		lines = append(lines, fmt.Sprintf("%s = %s", key, value))
		return lines
	}

	for index := start + 1; index < end; index++ {
		if tomlLineDefinesKey(lines[index], key) {
			lines[index] = rewriteTomlKeyLine(lines[index], key, value)
			return lines
		}
	}
	if !createIfMissing {
		return lines
	}

	insertAt := end
	lines = append(lines, "")
	copy(lines[insertAt+1:], lines[insertAt:])
	lines[insertAt] = fmt.Sprintf("%s = %s", key, value)
	return lines
}

func deleteTomlSectionKey(lines []string, sectionName string, key string) []string {
	start, end, found := findTomlSection(lines, "["+sectionName+"]")
	if !found {
		return lines
	}
	for index := start + 1; index < end; index++ {
		if !tomlLineDefinesKey(lines[index], key) {
			continue
		}
		return append(lines[:index], lines[index+1:]...)
	}
	return lines
}

func deleteTomlRootKey(lines []string, key string) []string {
	rootEnd := firstTomlSectionIndex(lines)
	for index := 0; index < rootEnd; index++ {
		if !tomlLineDefinesKey(lines[index], key) {
			continue
		}
		return append(lines[:index], lines[index+1:]...)
	}
	return lines
}

func firstTomlSectionIndex(lines []string) int {
	for index, line := range lines {
		if isTomlSectionHeader(line) {
			return index
		}
	}
	return len(lines)
}

func findTomlSection(lines []string, header string) (int, int, bool) {
	for index, line := range lines {
		if strings.TrimSpace(stripTomlLineComment(line)) != header {
			continue
		}
		end := len(lines)
		for next := index + 1; next < len(lines); next++ {
			if isTomlSectionHeader(lines[next]) {
				end = next
				break
			}
		}
		return index, end, true
	}
	return 0, 0, false
}

func isTomlSectionHeader(line string) bool {
	trimmed := strings.TrimSpace(stripTomlLineComment(line))
	return strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]")
}

func tomlLineDefinesKey(line string, key string) bool {
	content := strings.TrimSpace(stripTomlLineComment(line))
	if !strings.HasPrefix(content, key) {
		return false
	}
	if len(content) == len(key) {
		return false
	}
	next := content[len(key)]
	if next != ' ' && next != '\t' && next != '=' {
		return false
	}
	return strings.Contains(content, "=")
}

func rewriteTomlKeyLine(line string, key string, value string) string {
	comment := extractTomlLineComment(line)
	indentLength := len(line) - len(strings.TrimLeft(line, " \t"))
	indent := line[:indentLength]
	return fmt.Sprintf("%s%s = %s%s", indent, key, value, comment)
}

func stripTomlLineComment(line string) string {
	content, _ := splitTomlLineComment(line)
	return content
}

func extractTomlLineComment(line string) string {
	_, comment := splitTomlLineComment(line)
	return comment
}

func splitTomlLineComment(line string) (string, string) {
	inSingle := false
	inDouble := false
	escaped := false
	for index, ch := range line {
		switch ch {
		case '\\':
			if inDouble {
				escaped = !escaped
			}
		case '"':
			if !inSingle && !escaped {
				inDouble = !inDouble
			}
			escaped = false
		case '\'':
			if !inDouble {
				inSingle = !inSingle
			}
			escaped = false
		case '#':
			if !inSingle && !inDouble {
				commentStart := index
				for commentStart > 0 && (line[commentStart-1] == ' ' || line[commentStart-1] == '\t') {
					commentStart--
				}
				return line[:commentStart], line[commentStart:]
			}
			escaped = false
		default:
			escaped = false
		}
	}
	return line, ""
}

func readAuthString(value any) string {
	if text, ok := value.(string); ok {
		return text
	}
	return ""
}

func firstAuthString(values ...any) string {
	for _, value := range values {
		if text := strings.TrimSpace(readAuthString(value)); text != "" {
			return text
		}
	}
	return ""
}

func readNestedAuthAny(payload map[string]any, parentKey string, childKey string) any {
	parent, ok := payload[parentKey].(map[string]any)
	if !ok {
		return nil
	}
	return parent[childKey]
}

func readNestedAuthString(payload map[string]any, parentKey string, childKey string) string {
	parent, ok := payload[parentKey].(map[string]any)
	if !ok {
		return ""
	}
	return readAuthString(parent[childKey])
}

func hasAuthTokens(value any) bool {
	switch tokens := value.(type) {
	case map[string]any:
		return len(tokens) > 0
	case []any:
		return len(tokens) > 0
	default:
		return value != nil
	}
}
