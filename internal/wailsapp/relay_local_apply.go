package wailsapp

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	relayCodexOpenAIProviderID = "openai"
	relayCodexProviderID       = "gettokens"
	relayCodexProviderName     = "GetTokens"
	relayCodexDefaultModel     = "gpt-5.4"
	relayCodexDefaultReasoning = "high"
)

func (a *App) ApplyRelayServiceConfigToLocal(apiKey string, baseURL string, model string, reasoningEffort string, providerID string, providerName string) (*RelayLocalApplyResult, error) {
	normalizedAPIKey := strings.TrimSpace(apiKey)
	if normalizedAPIKey == "" {
		return nil, errors.New("缺少 API KEY")
	}

	normalizedBaseURL := normalizeRelayLocalBaseURL(baseURL)
	if normalizedBaseURL == "" {
		return nil, errors.New("缺少 BASE URL")
	}

	normalizedModel := normalizeRelayLocalModel(model)
	normalizedReasoningEffort := normalizeRelayLocalReasoningEffort(reasoningEffort)
	normalizedProviderID, normalizedProviderName := normalizeRelayLocalProvider(providerID, providerName)

	result, err := applyRelayServiceConfigToLocal(normalizedAPIKey, normalizedBaseURL, normalizedModel, normalizedReasoningEffort, normalizedProviderID, normalizedProviderName)
	if err != nil {
		return nil, err
	}

	metadata, err := loadRelayServiceAPIKeyMetadata()
	if err != nil {
		return nil, err
	}
	metadata, changed := markRelayServiceAPIKeyLastUsed(metadata, normalizedAPIKey, time.Now())
	if changed {
		if err := saveRelayServiceAPIKeyMetadata(metadata); err != nil {
			return nil, err
		}
	}

	return result, nil
}

func applyRelayServiceConfigToLocal(apiKey string, baseURL string, model string, reasoningEffort string, providerID string, providerName string) (*RelayLocalApplyResult, error) {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(codexHome, 0700); err != nil {
		return nil, err
	}

	authPath := filepath.Join(codexHome, "auth.json")
	configPath := filepath.Join(codexHome, "config.toml")

	authPayload, err := buildRelayCodexAuthJSON(apiKey)
	if err != nil {
		return nil, err
	}
	if err := writeFileAtomically(authPath, authPayload, 0600); err != nil {
		return nil, err
	}

	existingConfig, err := readOptionalTextFile(configPath)
	if err != nil {
		return nil, err
	}
	configPayload := mergeRelayCodexConfigToml(existingConfig, baseURL, model, reasoningEffort, providerID, providerName)
	if err := writeFileAtomically(configPath, []byte(configPayload), 0600); err != nil {
		return nil, err
	}

	return &RelayLocalApplyResult{
		CodexHomePath: codexHome,
		AuthFilePath:  authPath,
		ConfigPath:    configPath,
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
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}
	authPath := filepath.Join(codexHome, "auth.json")

	payload := map[string]any{}
	if existing, err := readOptionalTextFile(authPath); err != nil {
		return nil, err
	} else if strings.TrimSpace(existing) != "" {
		if err := json.Unmarshal([]byte(existing), &payload); err != nil {
			return nil, fmt.Errorf("现有 auth.json 不是有效 JSON，已停止写入以避免覆盖: %w", err)
		}
	}

	payload["auth_mode"] = "apikey"
	payload["OPENAI_API_KEY"] = strings.TrimSpace(apiKey)
	body, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("序列化 auth.json 失败: %w", err)
	}
	return append(body, '\n'), nil
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

func buildRelayCodexConfigToml(baseURL string, model string, reasoningEffort string, providerID string, providerName string) string {
	if providerID == relayCodexOpenAIProviderID {
		return fmt.Sprintf(
			"model = %q\nmodel_reasoning_effort = %q\nopenai_base_url = %q\n",
			strings.TrimSpace(model),
			reasoningEffort,
			strings.TrimSpace(baseURL),
		)
	}

	return fmt.Sprintf(
		"model = %q\nmodel_reasoning_effort = %q\nmodel_provider = %q\n\n[model_providers.%s]\nname = %q\nbase_url = %q\nrequires_openai_auth = true\nwire_api = \"responses\"\n",
		strings.TrimSpace(model),
		reasoningEffort,
		providerID,
		providerID,
		providerName,
		strings.TrimSpace(baseURL),
	)
}

func mergeRelayCodexConfigToml(existing string, baseURL string, model string, reasoningEffort string, providerID string, providerName string) string {
	lines, newline := splitTomlDocument(existing)

	hasModelProvider := rootTomlKeyExists(lines, "model_provider")
	lines = upsertRootTomlKey(lines, "model", quoteTomlString(strings.TrimSpace(model)), true)
	lines = upsertRootTomlKey(lines, "model_reasoning_effort", quoteTomlString(reasoningEffort), true)

	if providerID == relayCodexOpenAIProviderID {
		lines = upsertRootTomlKey(lines, "openai_base_url", quoteTomlString(strings.TrimSpace(baseURL)), true)
		if hasModelProvider {
			lines = upsertRootTomlKey(lines, "model_provider", quoteTomlString(relayCodexOpenAIProviderID), false)
		}
	} else {
		lines = upsertRootTomlKey(lines, "model_provider", quoteTomlString(providerID), true)
		sectionName := fmt.Sprintf("model_providers.%s", providerID)
		lines = upsertTomlSectionKey(lines, sectionName, "name", quoteTomlString(providerName), true)
		lines = upsertTomlSectionKey(lines, sectionName, "base_url", quoteTomlString(strings.TrimSpace(baseURL)), true)
		lines = upsertTomlSectionKey(lines, sectionName, "requires_openai_auth", "true", true)
		lines = upsertTomlSectionKey(lines, sectionName, "wire_api", quoteTomlString("responses"), true)
	}

	if len(lines) == 0 {
		return ""
	}
	return strings.Join(lines, newline) + newline
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
