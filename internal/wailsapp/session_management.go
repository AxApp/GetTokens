package wailsapp

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

var (
	sessionWhitespacePattern = regexp.MustCompile(`\s+`)
	sessionPathPattern       = regexp.MustCompile(`/(Users|home|private|tmp|var|Volumes|opt)/[^\s"'<>]+`)
	sessionCallIDPattern     = regexp.MustCompile(`\b(call|turn|session)_[A-Za-z0-9_-]+\b`)
	sessionHexIDPattern      = regexp.MustCompile(`\b[0-9a-f]{8,}-[0-9a-f-]{8,}\b`)
	sessionCodeFencePattern  = regexp.MustCompile("(?s)```.*?```")
)

type SessionManagementSnapshot struct {
	ProjectCount         int                              `json:"projectCount"`
	SessionCount         int                              `json:"sessionCount"`
	ActiveSessionCount   int                              `json:"activeSessionCount"`
	ArchivedSessionCount int                              `json:"archivedSessionCount"`
	LastScanAt           string                           `json:"lastScanAt"`
	ProviderCounts       map[string]int                   `json:"providerCounts"`
	Projects             []SessionManagementProjectRecord `json:"projects"`
}

type SessionManagementProviderCount struct {
	Provider     string `json:"provider"`
	SessionCount int    `json:"sessionCount"`
}

type SessionManagementProjectRecord struct {
	ID                   string                           `json:"id"`
	Name                 string                           `json:"name"`
	ProviderCounts       map[string]int                   `json:"providerCounts,omitempty"`
	SessionCount         int                              `json:"sessionCount"`
	ActiveSessionCount   int                              `json:"activeSessionCount"`
	ArchivedSessionCount int                              `json:"archivedSessionCount"`
	LastActiveAt         string                           `json:"lastActiveAt"`
	ProviderSummary      string                           `json:"providerSummary"`
	Sessions             []SessionManagementSessionRecord `json:"sessions"`
}

type SessionManagementSessionRecord struct {
	ID                  string `json:"id"`
	SessionID           string `json:"sessionID"`
	ProjectID           string `json:"projectID"`
	ProjectName         string `json:"projectName"`
	Title               string `json:"title"`
	Status              string `json:"status"`
	Archived            bool   `json:"archived"`
	MessageCount        int    `json:"messageCount"`
	RoleSummary         string `json:"roleSummary"`
	StartedAt           string `json:"startedAt"`
	UpdatedAt           string `json:"updatedAt"`
	FileLabel           string `json:"fileLabel"`
	Summary             string `json:"summary"`
	Preview             string `json:"preview"`
	Topic               string `json:"topic"`
	CurrentMessageLabel string `json:"currentMessageLabel"`
	Provider            string `json:"provider"`
	Model               string `json:"model,omitempty"`
}

type SessionManagementSessionDetail struct {
	SessionID           string                           `json:"sessionID"`
	ProjectID           string                           `json:"projectID"`
	ProjectName         string                           `json:"projectName"`
	Title               string                           `json:"title"`
	Status              string                           `json:"status"`
	Archived            bool                             `json:"archived"`
	FileLabel           string                           `json:"fileLabel"`
	MessageCount        int                              `json:"messageCount"`
	Masked              bool                             `json:"masked"`
	CurrentMessageLabel string                           `json:"currentMessageLabel"`
	RoleSummary         string                           `json:"roleSummary"`
	Topic               string                           `json:"topic"`
	Preview             string                           `json:"preview"`
	Provider            string                           `json:"provider"`
	Model               string                           `json:"model,omitempty"`
	StartedAt           string                           `json:"startedAt"`
	UpdatedAt           string                           `json:"updatedAt"`
	Messages            []SessionManagementMessageRecord `json:"messages"`
}

type SessionManagementMessageRecord struct {
	ID        string `json:"id"`
	Role      string `json:"role"`
	TimeLabel string `json:"timeLabel"`
	Timestamp string `json:"timestamp,omitempty"`
	Title     string `json:"title"`
	Summary   string `json:"summary"`
	Content   string `json:"content"`
	Truncated bool   `json:"truncated,omitempty"`
}

type sessionMetaEnvelope struct {
	ID            string `json:"id"`
	Cwd           string `json:"cwd"`
	ModelProvider string `json:"model_provider"`
	Git           struct {
		RepositoryURL string `json:"repository_url"`
	} `json:"git"`
}

type turnContextEnvelope struct {
	Cwd   string `json:"cwd"`
	Model string `json:"model"`
}

type responseItemEnvelope struct {
	Type    string `json:"type"`
	Role    string `json:"role"`
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
}

type sessionParseResult struct {
	projectName  string
	provider     string
	session      SessionManagementSessionRecord
	detail       SessionManagementSessionDetail
	startedAtRaw time.Time
	updatedAtRaw time.Time
}

type projectAggregate struct {
	ID             string
	Name           string
	LastActiveAt   time.Time
	ProviderCounts map[string]int
	Sessions       []SessionManagementSessionRecord
}

func (a *App) GetCodexSessionManagementSnapshot() (*SessionManagementSnapshot, error) {
	return a.loadCodexSessionManagementSnapshot()
}

func (a *App) RefreshCodexSessionManagementSnapshot() (*SessionManagementSnapshot, error) {
	return a.loadCodexSessionManagementSnapshot()
}

func (a *App) GetCodexSessionDetail(sessionID string) (*SessionManagementSessionDetail, error) {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}
	absolutePath, err := resolveSessionAbsolutePath(codexHome, sessionID)
	if err != nil {
		return nil, err
	}
	relativePath, err := filepath.Rel(codexHome, absolutePath)
	if err != nil {
		return nil, err
	}
	result, err := parseSessionFile(codexHome, absolutePath, filepath.ToSlash(relativePath))
	if err != nil {
		return nil, err
	}
	return &result.detail, nil
}

func (a *App) loadCodexSessionManagementSnapshot() (*SessionManagementSnapshot, error) {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}

	rolloutPaths, err := listCodexRolloutPaths(codexHome)
	if err != nil {
		return nil, err
	}

	projects := make(map[string]*projectAggregate)
	providerCounts := map[string]int{}
	snapshot := &SessionManagementSnapshot{
		LastScanAt:     formatSessionManagementTimestamp(time.Now()),
		ProviderCounts: map[string]int{},
	}

	for _, absolutePath := range rolloutPaths {
		relativePath, err := filepath.Rel(codexHome, absolutePath)
		if err != nil {
			return nil, err
		}
		relativePath = filepath.ToSlash(relativePath)

		result, err := parseSessionFile(codexHome, absolutePath, relativePath)
		if err != nil {
			return nil, err
		}

		projectID := result.session.ProjectID
		if projectID == "" {
			projectID = "unknown"
			result.session.ProjectID = projectID
			result.detail.ProjectID = projectID
		}

		project := projects[projectID]
		if project == nil {
			project = &projectAggregate{
				ID:             projectID,
				Name:           result.projectName,
				ProviderCounts: map[string]int{},
				Sessions:       make([]SessionManagementSessionRecord, 0, 8),
			}
			projects[projectID] = project
		}
		if project.Name == "" {
			project.Name = result.projectName
		}
		if result.updatedAtRaw.After(project.LastActiveAt) {
			project.LastActiveAt = result.updatedAtRaw
		}
		project.ProviderCounts[result.provider]++
		project.Sessions = append(project.Sessions, result.session)

		snapshot.SessionCount++
		if result.session.Status == "archived" {
			snapshot.ArchivedSessionCount++
		} else {
			snapshot.ActiveSessionCount++
		}
		providerCounts[result.provider]++
	}

	projectRecords := make([]SessionManagementProjectRecord, 0, len(projects))
	for _, project := range projects {
		sort.Slice(project.Sessions, func(i, j int) bool {
			return project.Sessions[i].UpdatedAt > project.Sessions[j].UpdatedAt
		})

		record := SessionManagementProjectRecord{
			ID:             project.ID,
			Name:           project.Name,
			ProviderCounts: cloneSessionProviderCounts(project.ProviderCounts),
			SessionCount:   len(project.Sessions),
			LastActiveAt:   formatSessionManagementTimestamp(project.LastActiveAt),
			Sessions:       project.Sessions,
		}
		for _, session := range project.Sessions {
			if session.Status == "archived" {
				record.ArchivedSessionCount++
			} else {
				record.ActiveSessionCount++
			}
		}
		record.ProviderSummary = formatProviderSummary(project.ProviderCounts)
		projectRecords = append(projectRecords, record)
	}

	sort.Slice(projectRecords, func(i, j int) bool {
		return projectRecords[i].LastActiveAt > projectRecords[j].LastActiveAt
	})

	snapshot.ProjectCount = len(projectRecords)
	snapshot.Projects = projectRecords
	snapshot.ProviderCounts = cloneSessionProviderCounts(providerCounts)
	return snapshot, nil
}

func listCodexRolloutPaths(codexHome string) ([]string, error) {
	roots := []string{
		filepath.Join(codexHome, "sessions"),
		filepath.Join(codexHome, "archived_sessions"),
	}
	paths := make([]string, 0, 128)
	for _, root := range roots {
		if _, err := os.Stat(root); err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return nil, err
		}
		if err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if d.IsDir() {
				return nil
			}
			if strings.HasSuffix(d.Name(), ".jsonl") {
				paths = append(paths, path)
			}
			return nil
		}); err != nil {
			return nil, err
		}
	}
	sort.Strings(paths)
	return paths, nil
}

func resolveSessionAbsolutePath(codexHome string, sessionID string) (string, error) {
	trimmed := strings.TrimSpace(sessionID)
	if trimmed == "" {
		return "", errors.New("缺少 session id")
	}
	cleaned := filepath.Clean(trimmed)
	if filepath.IsAbs(cleaned) {
		return "", errors.New("session id 必须是相对路径")
	}
	absolutePath := filepath.Join(codexHome, cleaned)
	relativePath, err := filepath.Rel(codexHome, absolutePath)
	if err != nil {
		return "", err
	}
	if strings.HasPrefix(relativePath, "..") {
		return "", errors.New("session id 超出 codex home 范围")
	}
	if _, err := os.Stat(absolutePath); err != nil {
		if os.IsNotExist(err) {
			return "", errors.New("会话文件不存在")
		}
		return "", err
	}
	return absolutePath, nil
}

func parseSessionFile(codexHome string, absolutePath string, relativePath string) (*sessionParseResult, error) {
	file, err := os.Open(absolutePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	projectName := fallbackProjectName(relativePath)
	provider := "unknown"
	model := ""
	var meta sessionMetaEnvelope
	currentCWD := ""
	messageRecords := make([]SessionManagementMessageRecord, 0, 32)
	roleCounts := map[string]int{
		"user":      0,
		"assistant": 0,
		"system":    0,
	}
	firstUserText := ""
	lastSummary := ""
	firstTimestamp := time.Time{}
	lastTimestamp := time.Time{}

	reader := bufio.NewReaderSize(file, 1024*128)
	for {
		line, err := reader.ReadBytes('\n')
		if len(line) > 0 {
			var envelope struct {
				Timestamp string          `json:"timestamp"`
				Type      string          `json:"type"`
				Payload   json.RawMessage `json:"payload"`
			}
			if unmarshalErr := json.Unmarshal(line, &envelope); unmarshalErr == nil {
				messageTimestamp := time.Time{}
				if parsed, parseErr := time.Parse(time.RFC3339Nano, envelope.Timestamp); parseErr == nil {
					messageTimestamp = parsed
					if firstTimestamp.IsZero() || parsed.Before(firstTimestamp) {
						firstTimestamp = parsed
					}
					if parsed.After(lastTimestamp) {
						lastTimestamp = parsed
					}
				}

				switch envelope.Type {
				case "session_meta":
					if unmarshalErr := json.Unmarshal(envelope.Payload, &meta); unmarshalErr == nil {
						projectName = deriveProjectName(meta, currentCWD, relativePath)
						provider = normalizeSessionProvider(meta.ModelProvider, model)
					}
				case "turn_context":
					var turnContext turnContextEnvelope
					if unmarshalErr := json.Unmarshal(envelope.Payload, &turnContext); unmarshalErr == nil {
						if strings.TrimSpace(turnContext.Cwd) != "" {
							currentCWD = turnContext.Cwd
							projectName = deriveProjectName(meta, currentCWD, relativePath)
						}
						if strings.TrimSpace(turnContext.Model) != "" {
							model = strings.TrimSpace(turnContext.Model)
							provider = normalizeSessionProvider(meta.ModelProvider, model)
						}
					}
				case "response_item":
					var item responseItemEnvelope
					if unmarshalErr := json.Unmarshal(envelope.Payload, &item); unmarshalErr == nil && item.Type == "message" {
						text := extractMessageText(item)
						if strings.TrimSpace(text) == "" {
							break
						}
						normalizedRole := normalizeSessionRole(item.Role)
						title, summary, content, truncated := buildSessionMessageContent(normalizedRole, text)
						record := SessionManagementMessageRecord{
							ID:        fmt.Sprintf("%s:%d", filepath.Base(relativePath), len(messageRecords)+1),
							Role:      normalizedRole,
							TimeLabel: formatSessionManagementTime(messageTimestamp),
							Timestamp: formatSessionManagementTimestamp(messageTimestamp),
							Title:     title,
							Summary:   summary,
							Content:   content,
							Truncated: truncated,
						}
						messageRecords = append(messageRecords, record)
						roleCounts[normalizedRole]++
						if normalizedRole == "user" && firstUserText == "" {
							firstUserText = content
						}
						lastSummary = summary
					}
				}
			}
		}
		if err != nil {
			break
		}
	}

	fileLabel := filepath.Base(relativePath)
	sessionTitle := deriveSessionTitle(firstUserText, lastSummary, fileLabel)
	roleSummary := formatSessionRoleSummary(roleCounts)
	status := resolveSessionStatus(relativePath)
	archived := status == "archived"
	projectID := slugifySessionProjectName(projectName)
	currentMessageLabel := formatCurrentMessageLabel(messageRecords)
	if firstTimestamp.IsZero() {
		firstTimestamp = lastTimestamp
	}
	if lastTimestamp.IsZero() {
		if info, statErr := os.Stat(absolutePath); statErr == nil {
			lastTimestamp = info.ModTime()
			if firstTimestamp.IsZero() {
				firstTimestamp = info.ModTime()
			}
		}
	}
	preview := chooseNonEmpty(lastSummary, sessionTitle)

	sessionRecord := SessionManagementSessionRecord{
		ID:                  relativePath,
		SessionID:           relativePath,
		ProjectID:           projectID,
		ProjectName:         projectName,
		Title:               sessionTitle,
		Status:              status,
		Archived:            archived,
		MessageCount:        len(messageRecords),
		RoleSummary:         roleSummary,
		StartedAt:           formatSessionManagementTimestamp(firstTimestamp),
		UpdatedAt:           formatSessionManagementTimestamp(lastTimestamp),
		FileLabel:           fileLabel,
		Summary:             preview,
		Preview:             preview,
		Topic:               sessionTitle,
		CurrentMessageLabel: currentMessageLabel,
		Provider:            provider,
		Model:               model,
	}

	detail := SessionManagementSessionDetail{
		SessionID:           relativePath,
		ProjectID:           projectID,
		ProjectName:         projectName,
		Title:               sessionTitle,
		Status:              status,
		Archived:            archived,
		FileLabel:           fileLabel,
		MessageCount:        len(messageRecords),
		Masked:              true,
		CurrentMessageLabel: currentMessageLabel,
		RoleSummary:         roleSummary,
		Topic:               sessionTitle,
		Preview:             preview,
		Provider:            provider,
		Model:               model,
		StartedAt:           formatSessionManagementTimestamp(firstTimestamp),
		UpdatedAt:           formatSessionManagementTimestamp(lastTimestamp),
		Messages:            messageRecords,
	}

	return &sessionParseResult{
		projectName:  projectName,
		provider:     provider,
		session:      sessionRecord,
		detail:       detail,
		startedAtRaw: firstTimestamp,
		updatedAtRaw: lastTimestamp,
	}, nil
}

func extractMessageText(item responseItemEnvelope) string {
	parts := make([]string, 0, len(item.Content))
	for _, part := range item.Content {
		if part.Text == "" {
			continue
		}
		parts = append(parts, part.Text)
	}
	return strings.Join(parts, "\n")
}

func normalizeSessionRole(role string) string {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "assistant":
		return "assistant"
	case "user":
		return "user"
	default:
		return "system"
	}
}

func buildSessionMessageContent(role string, raw string) (string, string, string, bool) {
	sanitized := sanitizeSessionText(raw)
	if role == "system" && looksLikeSensitiveSystemPrompt(raw) {
		content := "系统与环境约束已载入（已脱敏）"
		return "系统上下文", content, content, true
	}
	if sanitized == "" {
		content := "内容已脱敏"
		return fallbackSessionMessageTitle(role), content, content, true
	}
	limit := 1200
	if role == "system" {
		limit = 240
	}
	content, truncated := truncateSessionText(sanitized, limit)
	title := firstRunes(sanitized, 24)
	return title, firstRunes(content, 180), content, truncated
}

func sanitizeSessionText(raw string) string {
	text := strings.TrimSpace(raw)
	if text == "" {
		return ""
	}
	text = sessionCodeFencePattern.ReplaceAllString(text, "[代码片段]")
	text = sessionPathPattern.ReplaceAllString(text, "<redacted-path>")
	text = sessionCallIDPattern.ReplaceAllString(text, "[调用ID]")
	text = sessionHexIDPattern.ReplaceAllString(text, "[会话ID]")
	text = sessionWhitespacePattern.ReplaceAllString(text, " ")
	return strings.TrimSpace(text)
}

func looksLikeSensitiveSystemPrompt(raw string) bool {
	lowered := strings.ToLower(raw)
	return strings.Contains(lowered, "<permissions instructions>") ||
		strings.Contains(lowered, "<skills_instructions>") ||
		strings.Contains(lowered, "approved command prefixes") ||
		len([]rune(raw)) > 500
}

func fallbackSessionMessageTitle(role string) string {
	switch role {
	case "assistant":
		return "助手消息"
	case "user":
		return "用户消息"
	default:
		return "系统上下文"
	}
}

func deriveSessionTitle(firstUser string, lastSummary string, fileLabel string) string {
	if strings.TrimSpace(firstUser) != "" {
		return firstRunes(firstUser, 30)
	}
	if strings.TrimSpace(lastSummary) != "" {
		return firstRunes(lastSummary, 30)
	}
	return strings.TrimSuffix(fileLabel, filepath.Ext(fileLabel))
}

func deriveProjectName(meta sessionMetaEnvelope, cwd string, relativePath string) string {
	if cwdBase := pathBaseFromCWD(cwd); cwdBase != "" {
		return cwdBase
	}
	if cwdBase := pathBaseFromCWD(meta.Cwd); cwdBase != "" {
		return cwdBase
	}
	if repository := repoNameFromURL(meta.Git.RepositoryURL); repository != "" {
		return repository
	}
	return fallbackProjectName(relativePath)
}

func fallbackProjectName(relativePath string) string {
	_ = relativePath
	return "未知项目"
}

func repoNameFromURL(repositoryURL string) string {
	trimmed := strings.TrimSpace(repositoryURL)
	if trimmed == "" {
		return ""
	}
	trimmed = strings.TrimSuffix(trimmed, ".git")
	trimmed = strings.TrimSuffix(trimmed, "/")
	parts := strings.Split(trimmed, "/")
	return strings.TrimSpace(parts[len(parts)-1])
}

func pathBaseFromCWD(cwd string) string {
	trimmed := strings.TrimSpace(cwd)
	if trimmed == "" {
		return ""
	}
	return filepath.Base(trimmed)
}

func normalizeSessionProvider(modelProvider string, model string) string {
	lowered := strings.ToLower(strings.TrimSpace(modelProvider))
	switch {
	case strings.Contains(lowered, "gemini"):
		return "gemini"
	case lowered != "":
		return lowered
	}

	modelLowered := strings.ToLower(strings.TrimSpace(model))
	switch {
	case strings.Contains(modelLowered, "claude"):
		return "anthropic"
	case strings.Contains(modelLowered, "gemini"):
		return "gemini"
	case strings.Contains(modelLowered, "gpt"), strings.Contains(modelLowered, "codex"), strings.Contains(modelLowered, "o1"), strings.Contains(modelLowered, "o3"), strings.Contains(modelLowered, "o4"):
		return "openai"
	default:
		return "unknown"
	}
}

func resolveSessionStatus(relativePath string) string {
	if strings.HasPrefix(relativePath, "archived_sessions/") {
		return "archived"
	}
	return "active"
}

func formatSessionRoleSummary(roleCounts map[string]int) string {
	return fmt.Sprintf("用户 %d / 助手 %d / 系统 %d", roleCounts["user"], roleCounts["assistant"], roleCounts["system"])
}

func formatCurrentMessageLabel(messages []SessionManagementMessageRecord) string {
	if len(messages) == 0 {
		return "00 / 系统"
	}
	last := messages[len(messages)-1]
	roleLabel := map[string]string{
		"user":      "用户",
		"assistant": "助手",
		"system":    "系统",
	}[last.Role]
	return fmt.Sprintf("%02d / %s", len(messages), roleLabel)
}

func mapProviderCounts(counts map[string]int) []SessionManagementProviderCount {
	items := make([]SessionManagementProviderCount, 0, len(counts))
	for provider, sessionCount := range counts {
		items = append(items, SessionManagementProviderCount{
			Provider:     provider,
			SessionCount: sessionCount,
		})
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].SessionCount == items[j].SessionCount {
			return items[i].Provider < items[j].Provider
		}
		return items[i].SessionCount > items[j].SessionCount
	})
	return items
}

func formatProviderSummary(counts map[string]int) string {
	items := mapProviderCountItems(counts)
	parts := make([]string, 0, len(items))
	for _, item := range items {
		parts = append(parts, fmt.Sprintf("%s %d", item.Provider, item.SessionCount))
	}
	if len(parts) == 0 {
		return "codex 0"
	}
	return strings.Join(parts, " / ")
}

func formatSessionManagementTimestamp(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.Local().Format("2006-01-02 15:04")
}

func formatSessionManagementTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.Local().Format("15:04")
}

func chooseNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func cloneSessionProviderCounts(counts map[string]int) map[string]int {
	if len(counts) == 0 {
		return map[string]int{}
	}
	cloned := make(map[string]int, len(counts))
	for provider, sessionCount := range counts {
		cloned[provider] = sessionCount
	}
	return cloned
}

func slugifySessionProjectName(value string) string {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	if trimmed == "" {
		return "unknown"
	}
	trimmed = strings.ReplaceAll(trimmed, " ", "-")
	return trimmed
}

func firstRunes(value string, limit int) string {
	runes := []rune(strings.TrimSpace(value))
	if len(runes) <= limit {
		return string(runes)
	}
	return string(runes[:limit]) + "…"
}

func truncateSessionText(value string, limit int) (string, bool) {
	runes := []rune(strings.TrimSpace(value))
	if len(runes) <= limit {
		return string(runes), false
	}
	return string(runes[:limit]) + "…", true
}

func mapProviderCountItems(counts map[string]int) []SessionManagementProviderCount {
	return mapProviderCounts(counts)
}
