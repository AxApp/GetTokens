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
	Type      string `json:"type"`
	Role      string `json:"role"`
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
	CallID    string `json:"call_id"`
	Output    string `json:"output"`
	Input     string `json:"input"`
	Status    string `json:"status"`
	Content   []struct {
		Type    string `json:"type"`
		Text    string `json:"text"`
		Content string `json:"content"`
	} `json:"content"`
	Summary []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"summary"`
	Action struct {
		Type    string   `json:"type"`
		Query   string   `json:"query"`
		Queries []string `json:"queries"`
	} `json:"action"`
}

type eventMessageEnvelope struct {
	Type                  string `json:"type"`
	Message               string `json:"message"`
	Text                  string `json:"text"`
	Phase                 string `json:"phase"`
	TurnID                string `json:"turn_id"`
	CollaborationModeKind string `json:"collaboration_mode_kind"`
	ModelContextWindow    int    `json:"model_context_window"`
	LastAgentMessage      string `json:"last_agent_message"`
}

type sessionParseResult struct {
	projectName  string
	provider     string
	session      SessionManagementSessionRecord
	detail       SessionManagementSessionDetail
	startedAtRaw time.Time
	updatedAtRaw time.Time
}

type sessionIndexRecord struct {
	ID         string `json:"id"`
	ThreadName string `json:"thread_name"`
}

type projectAggregate struct {
	ID             string
	Name           string
	LastActiveAt   time.Time
	ProviderCounts map[string]int
	Sessions       []SessionManagementSessionRecord
}

func (a *App) GetCodexSessionManagementSnapshot() (*SessionManagementSnapshot, error) {
	if cached := a.readCachedSessionManagementSnapshot(); cached != nil {
		return cached, nil
	}
	return a.refreshCodexSessionManagementSnapshot()
}

func (a *App) RefreshCodexSessionManagementSnapshot() (*SessionManagementSnapshot, error) {
	return a.refreshCodexSessionManagementSnapshot()
}

func (a *App) GetCodexSessionDetail(sessionID string) (*SessionManagementSessionDetail, error) {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}
	threadNames, err := loadSessionThreadNames(codexHome)
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
	result, err := parseSessionFile(codexHome, absolutePath, filepath.ToSlash(relativePath), threadNames)
	if err != nil {
		return nil, err
	}
	return &result.detail, nil
}

func (a *App) UpdateCodexSessionProviders(input UpdateSessionProvidersInput) (*SessionManagementSnapshot, error) {
	projectID := strings.TrimSpace(input.ProjectID)
	if projectID == "" {
		return nil, errors.New("缺少 project id")
	}
	if len(input.Mappings) == 0 {
		return nil, errors.New("缺少 provider 归并规则")
	}

	mappings := map[string]string{}
	for _, item := range input.Mappings {
		sourceProvider := strings.TrimSpace(item.SourceProvider)
		targetProvider := strings.TrimSpace(item.TargetProvider)
		if sourceProvider == "" || targetProvider == "" {
			continue
		}
		mappings[sourceProvider] = targetProvider
	}
	if len(mappings) == 0 {
		return nil, errors.New("缺少有效的 provider 归并规则")
	}

	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}

	snapshot, err := a.loadCodexSessionManagementSnapshot()
	if err != nil {
		return nil, err
	}

	var project *SessionManagementProjectRecord
	for index := range snapshot.Projects {
		if snapshot.Projects[index].ID == projectID {
			project = &snapshot.Projects[index]
			break
		}
	}
	if project == nil {
		return nil, errors.New("未找到对应项目")
	}

	updatedCount := 0
	for _, session := range project.Sessions {
		targetProvider, ok := mappings[strings.TrimSpace(session.Provider)]
		if !ok || strings.TrimSpace(targetProvider) == strings.TrimSpace(session.Provider) {
			continue
		}

		absolutePath, err := resolveSessionAbsolutePath(codexHome, session.SessionID)
		if err != nil {
			return nil, err
		}
		if err := rewriteSessionMetaProvider(absolutePath, targetProvider); err != nil {
			return nil, err
		}
		updatedCount++
	}

	if updatedCount == 0 {
		return a.GetCodexSessionManagementSnapshot()
	}

	a.sessionMgmtMu.Lock()
	a.sessionMgmt.cachedSnapshot = nil
	a.sessionMgmt.cachedAt = time.Time{}
	a.sessionMgmtMu.Unlock()

	return a.refreshCodexSessionManagementSnapshot()
}

func (a *App) refreshCodexSessionManagementSnapshot() (*SessionManagementSnapshot, error) {
	a.sessionMgmtMu.Lock()
	if a.sessionMgmt.refreshRunning {
		a.sessionMgmtMu.Unlock()
		return a.waitForSessionManagementRefresh()
	}
	a.sessionMgmt.refreshRunning = true
	a.sessionMgmtMu.Unlock()

	snapshot, err := a.loadCodexSessionManagementSnapshot()

	a.sessionMgmtMu.Lock()
	a.sessionMgmt.refreshRunning = false
	if err != nil {
		a.sessionMgmtMu.Unlock()
		return nil, err
	}
	a.sessionMgmt.cachedSnapshot = cloneSessionManagementSnapshot(snapshot)
	a.sessionMgmt.cachedAt = time.Now()
	cached := cloneSessionManagementSnapshot(a.sessionMgmt.cachedSnapshot)
	a.sessionMgmtMu.Unlock()
	return cached, nil
}

func (a *App) waitForSessionManagementRefresh() (*SessionManagementSnapshot, error) {
	for {
		time.Sleep(20 * time.Millisecond)
		a.sessionMgmtMu.RLock()
		refreshRunning := a.sessionMgmt.refreshRunning
		cached := cloneSessionManagementSnapshot(a.sessionMgmt.cachedSnapshot)
		a.sessionMgmtMu.RUnlock()
		if refreshRunning {
			continue
		}
		if cached != nil {
			return cached, nil
		}
		return a.refreshCodexSessionManagementSnapshot()
	}
}

func (a *App) readCachedSessionManagementSnapshot() *SessionManagementSnapshot {
	a.sessionMgmtMu.RLock()
	defer a.sessionMgmtMu.RUnlock()
	return cloneSessionManagementSnapshot(a.sessionMgmt.cachedSnapshot)
}

func cloneSessionManagementSnapshot(snapshot *SessionManagementSnapshot) *SessionManagementSnapshot {
	if snapshot == nil {
		return nil
	}

	providerCounts := make(map[string]int, len(snapshot.ProviderCounts))
	for provider, count := range snapshot.ProviderCounts {
		providerCounts[provider] = count
	}

	projects := make([]SessionManagementProjectRecord, len(snapshot.Projects))
	for index, project := range snapshot.Projects {
		projectProviderCounts := make(map[string]int, len(project.ProviderCounts))
		for provider, count := range project.ProviderCounts {
			projectProviderCounts[provider] = count
		}
		sessions := make([]SessionManagementSessionRecord, len(project.Sessions))
		copy(sessions, project.Sessions)
		project.ProviderCounts = projectProviderCounts
		project.Sessions = sessions
		projects[index] = project
	}

	return &SessionManagementSnapshot{
		ProjectCount:         snapshot.ProjectCount,
		SessionCount:         snapshot.SessionCount,
		ActiveSessionCount:   snapshot.ActiveSessionCount,
		ArchivedSessionCount: snapshot.ArchivedSessionCount,
		LastScanAt:           snapshot.LastScanAt,
		ProviderCounts:       providerCounts,
		Projects:             projects,
	}
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
	threadNames, err := loadSessionThreadNames(codexHome)
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

		result, err := parseSessionFile(codexHome, absolutePath, relativePath, threadNames)
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

func loadSessionThreadNames(codexHome string) (map[string]string, error) {
	indexPath := filepath.Join(codexHome, "session_index.jsonl")
	file, err := os.Open(indexPath)
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]string{}, nil
		}
		return nil, err
	}
	defer file.Close()

	threadNames := map[string]string{}
	scanner := bufio.NewScanner(file)
	buffer := make([]byte, 0, 64*1024)
	scanner.Buffer(buffer, 1024*1024)
	for scanner.Scan() {
		var record sessionIndexRecord
		if err := json.Unmarshal(scanner.Bytes(), &record); err != nil {
			continue
		}
		id := strings.TrimSpace(record.ID)
		name := strings.TrimSpace(record.ThreadName)
		if id == "" || name == "" {
			continue
		}
		threadNames[id] = name
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return threadNames, nil
}

func rewriteSessionMetaProvider(absolutePath string, targetProvider string) error {
	content, err := os.ReadFile(absolutePath)
	if err != nil {
		return err
	}

	lines := strings.Split(string(content), "\n")
	updated := false
	for index, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}

		var envelope struct {
			Type    string                 `json:"type"`
			Payload map[string]interface{} `json:"payload"`
		}
		if err := json.Unmarshal([]byte(line), &envelope); err != nil {
			continue
		}
		if envelope.Type != "session_meta" || envelope.Payload == nil {
			continue
		}

		envelope.Payload["model_provider"] = targetProvider
		rewritten, err := json.Marshal(envelope)
		if err != nil {
			return err
		}

		var generic map[string]interface{}
		if err := json.Unmarshal([]byte(line), &generic); err != nil {
			return err
		}
		generic["payload"] = envelope.Payload
		rewritten, err = json.Marshal(generic)
		if err != nil {
			return err
		}

		lines[index] = string(rewritten)
		updated = true
		break
	}

	if !updated {
		return errors.New("会话文件缺少 session_meta")
	}

	output := strings.Join(lines, "\n")
	if strings.HasSuffix(string(content), "\n") && !strings.HasSuffix(output, "\n") {
		output += "\n"
	}
	return os.WriteFile(absolutePath, []byte(output), 0600)
}

func parseSessionFile(codexHome string, absolutePath string, relativePath string, threadNames map[string]string) (*sessionParseResult, error) {
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
		"user":        0,
		"assistant":   0,
		"system":      0,
		"reasoning":   0,
		"tool_call":   0,
		"tool_result": 0,
		"event":       0,
	}
	firstUserText := ""
	lastSummary := ""
	lastPrimarySummary := ""
	firstTimestamp := time.Time{}
	lastTimestamp := time.Time{}

	appendRecord := func(timestamp time.Time, role string, title string, raw string) {
		title, summary, content, truncated := buildSessionMessageContent(role, title, raw)
		if strings.TrimSpace(title) == "" && strings.TrimSpace(content) == "" {
			return
		}
		record := SessionManagementMessageRecord{
			ID:        fmt.Sprintf("%s:%d", filepath.Base(relativePath), len(messageRecords)+1),
			Role:      role,
			TimeLabel: formatSessionManagementTime(timestamp),
			Timestamp: formatSessionManagementTimestamp(timestamp),
			Title:     title,
			Summary:   summary,
			Content:   content,
			Truncated: truncated,
		}
		messageRecords = append(messageRecords, record)
		roleCounts[role]++
		if role == "user" && firstUserText == "" {
			firstUserText = content
		}
		if role != "event" && role != "system" && strings.TrimSpace(summary) != "" {
			lastPrimarySummary = summary
		}
		if strings.TrimSpace(summary) != "" {
			lastSummary = summary
		}
	}

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
						appendRecord(messageTimestamp, "system", "会话元数据", formatSessionMetaSummary(meta))
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
						appendRecord(messageTimestamp, "system", "上下文更新", formatTurnContextSummary(turnContext))
					}
				case "response_item":
					var item responseItemEnvelope
					if unmarshalErr := json.Unmarshal(envelope.Payload, &item); unmarshalErr == nil {
						role, title, text, ok := extractResponseItemRecord(item)
						if ok {
							appendRecord(messageTimestamp, role, title, text)
						}
					}
				case "event_msg":
					var eventPayload eventMessageEnvelope
					if unmarshalErr := json.Unmarshal(envelope.Payload, &eventPayload); unmarshalErr == nil {
						role, title, text, ok := extractEventRecord(eventPayload)
						if ok {
							appendRecord(messageTimestamp, role, title, text)
						}
					}
				}
			}
		}
		if err != nil {
			break
		}
	}

	fileLabel := filepath.Base(relativePath)
	sessionTitle := strings.TrimSpace(threadNames[meta.ID])
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
	preview := chooseNonEmpty(lastPrimarySummary, lastSummary, fileLabel)

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
		text := strings.TrimSpace(part.Text)
		if text == "" {
			text = strings.TrimSpace(part.Content)
		}
		if text == "" {
			continue
		}
		parts = append(parts, text)
	}
	return strings.Join(parts, "\n")
}

func extractReasoningText(item responseItemEnvelope) string {
	parts := make([]string, 0, len(item.Summary))
	for _, part := range item.Summary {
		text := strings.TrimSpace(part.Text)
		if text == "" {
			continue
		}
		parts = append(parts, text)
	}
	return strings.Join(parts, "\n")
}

func extractResponseItemRecord(item responseItemEnvelope) (string, string, string, bool) {
	switch item.Type {
	case "message":
		return normalizeSessionRole(item.Role), fallbackSessionMessageTitle(normalizeSessionRole(item.Role)), extractMessageText(item), true
	case "reasoning":
		return "reasoning", "推理", extractReasoningText(item), true
	case "function_call", "custom_tool_call":
		return "tool_call", "工具调用", formatToolCallSummary(item), true
	case "function_call_output", "custom_tool_call_output":
		return "tool_result", "工具结果", formatToolResultSummary(item), true
	case "web_search_call":
		return "tool_call", "网络搜索", formatWebSearchSummary(item), true
	default:
		return "event", "响应项", marshalSessionJSON(item), true
	}
}

func extractEventRecord(eventPayload eventMessageEnvelope) (string, string, string, bool) {
	switch eventPayload.Type {
	case "user_message":
		return "user", "用户输入", eventPayload.Message, true
	case "agent_message":
		return "assistant", "助手说明", eventPayload.Message, true
	case "agent_reasoning":
		return "reasoning", "推理", eventPayload.Text, true
	case "task_started":
		return "event", "任务开始", formatTaskStartedSummary(eventPayload), true
	case "task_complete":
		return "event", "任务完成", chooseNonEmpty(eventPayload.LastAgentMessage, "任务已完成"), true
	case "context_compacted":
		return "event", "上下文压缩", "上下文已压缩", true
	case "turn_aborted":
		return "event", "中断", "当前轮次已中断", true
	case "thread_rolled_back":
		return "event", "回滚", "线程已回滚到较早状态", true
	case "entered_review_mode":
		return "event", "进入 Review", "已进入 review 模式", true
	case "exited_review_mode":
		return "event", "退出 Review", "已退出 review 模式", true
	case "item_completed":
		return "event", "步骤完成", "一个处理步骤已完成", true
	default:
		return "event", "事件", marshalSessionJSON(eventPayload), true
	}
}

func normalizeSessionRole(role string) string {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "assistant":
		return "assistant"
	case "user":
		return "user"
	case "system", "developer":
		return "system"
	default:
		return "system"
	}
}

func buildSessionMessageContent(role string, fallbackTitle string, raw string) (string, string, string, bool) {
	sanitized := sanitizeSessionText(raw)
	if role == "system" && looksLikeSensitiveSystemPrompt(raw) {
		content := "系统与环境约束已载入（已脱敏）"
		return "系统上下文", content, content, true
	}
	if sanitized == "" {
		content := "内容已脱敏"
		title := strings.TrimSpace(sanitizeSessionText(fallbackTitle))
		if title == "" {
			title = fallbackSessionMessageTitle(role)
		}
		return title, content, content, true
	}
	limit := 1200
	switch role {
	case "system", "event":
		limit = 240
	case "reasoning", "tool_call":
		limit = 480
	case "tool_result":
		limit = 800
	}
	content, truncated := truncateSessionText(sanitized, limit)
	title := strings.TrimSpace(sanitizeSessionText(fallbackTitle))
	if title == "" {
		title = firstRunes(sanitized, 24)
	}
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
	case "reasoning":
		return "推理"
	case "tool_call":
		return "工具调用"
	case "tool_result":
		return "工具结果"
	case "event":
		return "事件"
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
	parts := make([]string, 0, 7)
	appendPart := func(label string, key string) {
		if count := roleCounts[key]; count > 0 {
			parts = append(parts, fmt.Sprintf("%s %d", label, count))
		}
	}
	appendPart("用户", "user")
	appendPart("助手", "assistant")
	appendPart("系统", "system")
	appendPart("推理", "reasoning")
	appendPart("工具调用", "tool_call")
	appendPart("工具结果", "tool_result")
	appendPart("事件", "event")
	if len(parts) == 0 {
		return "系统 0"
	}
	return strings.Join(parts, " / ")
}

func formatCurrentMessageLabel(messages []SessionManagementMessageRecord) string {
	if len(messages) == 0 {
		return "00 / 系统"
	}
	last := messages[len(messages)-1]
	roleLabel := map[string]string{
		"user":        "用户",
		"assistant":   "助手",
		"system":      "系统",
		"reasoning":   "推理",
		"tool_call":   "工具调用",
		"tool_result": "工具结果",
		"event":       "事件",
	}[last.Role]
	if roleLabel == "" {
		roleLabel = "系统"
	}
	return fmt.Sprintf("%02d / %s", len(messages), roleLabel)
}

func formatSessionMetaSummary(meta sessionMetaEnvelope) string {
	parts := make([]string, 0, 3)
	if repository := repoNameFromURL(meta.Git.RepositoryURL); repository != "" {
		parts = append(parts, fmt.Sprintf("仓库 %s", repository))
	}
	if provider := strings.TrimSpace(meta.ModelProvider); provider != "" {
		parts = append(parts, fmt.Sprintf("Provider %s", provider))
	}
	if cwd := strings.TrimSpace(meta.Cwd); cwd != "" {
		parts = append(parts, fmt.Sprintf("目录 %s", cwd))
	}
	return strings.Join(parts, " / ")
}

func formatTurnContextSummary(turnContext turnContextEnvelope) string {
	parts := make([]string, 0, 2)
	if cwd := strings.TrimSpace(turnContext.Cwd); cwd != "" {
		parts = append(parts, fmt.Sprintf("目录 %s", cwd))
	}
	if model := strings.TrimSpace(turnContext.Model); model != "" {
		parts = append(parts, fmt.Sprintf("模型 %s", model))
	}
	return strings.Join(parts, " / ")
}

func formatToolCallSummary(item responseItemEnvelope) string {
	parts := make([]string, 0, 3)
	if name := strings.TrimSpace(item.Name); name != "" {
		parts = append(parts, name)
	}
	if status := strings.TrimSpace(item.Status); status != "" {
		parts = append(parts, fmt.Sprintf("状态 %s", status))
	}
	input := chooseNonEmpty(item.Input, item.Arguments)
	if strings.TrimSpace(input) != "" {
		parts = append(parts, input)
	}
	return strings.Join(parts, " / ")
}

func formatToolResultSummary(item responseItemEnvelope) string {
	parts := make([]string, 0, 2)
	if callID := strings.TrimSpace(item.CallID); callID != "" {
		parts = append(parts, fmt.Sprintf("调用 %s", callID))
	}
	if output := strings.TrimSpace(item.Output); output != "" {
		parts = append(parts, output)
	}
	return strings.Join(parts, " / ")
}

func formatWebSearchSummary(item responseItemEnvelope) string {
	queries := make([]string, 0, 2)
	if query := strings.TrimSpace(item.Action.Query); query != "" {
		queries = append(queries, query)
	}
	for _, query := range item.Action.Queries {
		trimmed := strings.TrimSpace(query)
		if trimmed == "" {
			continue
		}
		queries = append(queries, trimmed)
		if len(queries) >= 2 {
			break
		}
	}
	if len(queries) == 0 {
		return "网络搜索"
	}
	return strings.Join(queries, " / ")
}

func formatTaskStartedSummary(eventPayload eventMessageEnvelope) string {
	parts := []string{"任务已开始"}
	if mode := strings.TrimSpace(eventPayload.CollaborationModeKind); mode != "" {
		parts = append(parts, fmt.Sprintf("模式 %s", mode))
	}
	if eventPayload.ModelContextWindow > 0 {
		parts = append(parts, fmt.Sprintf("上下文窗口 %d", eventPayload.ModelContextWindow))
	}
	return strings.Join(parts, " / ")
}

func marshalSessionJSON(value any) string {
	data, err := json.Marshal(value)
	if err != nil {
		return ""
	}
	return string(data)
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
