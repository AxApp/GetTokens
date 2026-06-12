package wailsapp

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"
)

var (
	sessionWhitespacePattern = regexp.MustCompile(`\s+`)
	sessionPathPattern       = regexp.MustCompile(`/(Users|home|private|tmp|var|Volumes|opt)/[^\s"'<>]+`)
	sessionCallIDPattern     = regexp.MustCompile(`\b(call|turn|session)_[A-Za-z0-9_-]+\b`)
	sessionHexIDPattern      = regexp.MustCompile(`\b[0-9a-f]{8,}-[0-9a-f-]{8,}\b`)
	sessionSecretPattern     = regexp.MustCompile(`(?i)\b(?:sk-ant|sk-proj|sk|token|api[_-]?key)[A-Za-z0-9._=-]*\b`)
	sessionCodeFencePattern  = regexp.MustCompile("(?s)```.*?```")
)

const sessionManagementSnapshotCacheFileName = ".gettokens-session-management-snapshot-cache.json"
const sessionManagementDetailCacheDirName = ".gettokens-session-management-detail-cache"
const sessionManagementDetailMemoryCacheMaxEntries = 6
const sessionManagementDetailMemoryCacheMaxBytes = 16 * 1024 * 1024
const sessionManagementDetailPayloadMaxMessages = 1000
const sessionManagementMessagePageDefaultLimit = 50
const sessionManagementMessagePageMaxLimit = 100

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
	ProjectKey           string                           `json:"projectKey,omitempty"`
	ProjectKeySource     string                           `json:"projectKeySource,omitempty"`
	ProjectKeyConfidence string                           `json:"projectKeyConfidence,omitempty"`
	ProviderCounts       map[string]int                   `json:"providerCounts,omitempty"`
	SessionCount         int                              `json:"sessionCount"`
	ActiveSessionCount   int                              `json:"activeSessionCount"`
	ArchivedSessionCount int                              `json:"archivedSessionCount"`
	LastActiveAt         string                           `json:"lastActiveAt"`
	ProviderSummary      string                           `json:"providerSummary"`
	Sessions             []SessionManagementSessionRecord `json:"sessions"`
}

type SessionManagementSessionRecord struct {
	ID                     string `json:"id"`
	SessionID              string `json:"sessionID"`
	ProjectID              string `json:"projectID"`
	ProjectName            string `json:"projectName"`
	ProjectKey             string `json:"projectKey,omitempty"`
	ProjectKeySource       string `json:"projectKeySource,omitempty"`
	ProjectKeyConfidence   string `json:"projectKeyConfidence,omitempty"`
	Title                  string `json:"title"`
	DisplayTitle           string `json:"displayTitle,omitempty"`
	TitleSource            string `json:"titleSource,omitempty"`
	TitleConfidence        string `json:"titleConfidence,omitempty"`
	Status                 string `json:"status"`
	Archived               bool   `json:"archived"`
	MessageCount           int    `json:"messageCount"`
	RoleSummary            string `json:"roleSummary"`
	StartedAt              string `json:"startedAt"`
	UpdatedAt              string `json:"updatedAt"`
	FileLabel              string `json:"fileLabel"`
	Summary                string `json:"summary"`
	Preview                string `json:"preview"`
	Topic                  string `json:"topic"`
	PrimaryIntent          string `json:"primaryIntent,omitempty"`
	LastOutcome            string `json:"lastOutcome,omitempty"`
	HasInstructionPreamble bool   `json:"hasInstructionPreamble,omitempty"`
	CurrentMessageLabel    string `json:"currentMessageLabel"`
	Provider               string `json:"provider"`
	Model                  string `json:"model,omitempty"`
}

type SessionManagementSessionDetail struct {
	SessionID              string                           `json:"sessionID"`
	ProjectID              string                           `json:"projectID"`
	ProjectName            string                           `json:"projectName"`
	ProjectKey             string                           `json:"projectKey,omitempty"`
	ProjectKeySource       string                           `json:"projectKeySource,omitempty"`
	ProjectKeyConfidence   string                           `json:"projectKeyConfidence,omitempty"`
	Title                  string                           `json:"title"`
	DisplayTitle           string                           `json:"displayTitle,omitempty"`
	TitleSource            string                           `json:"titleSource,omitempty"`
	TitleConfidence        string                           `json:"titleConfidence,omitempty"`
	Status                 string                           `json:"status"`
	Archived               bool                             `json:"archived"`
	FileLabel              string                           `json:"fileLabel"`
	MessageCount           int                              `json:"messageCount"`
	Masked                 bool                             `json:"masked"`
	CurrentMessageLabel    string                           `json:"currentMessageLabel"`
	RoleSummary            string                           `json:"roleSummary"`
	Topic                  string                           `json:"topic"`
	Preview                string                           `json:"preview"`
	PrimaryIntent          string                           `json:"primaryIntent,omitempty"`
	LastOutcome            string                           `json:"lastOutcome,omitempty"`
	HasInstructionPreamble bool                             `json:"hasInstructionPreamble,omitempty"`
	Provider               string                           `json:"provider"`
	Model                  string                           `json:"model,omitempty"`
	StartedAt              string                           `json:"startedAt"`
	UpdatedAt              string                           `json:"updatedAt"`
	Messages               []SessionManagementMessageRecord `json:"messages"`
}

type SessionManagementMessageRecord struct {
	ID         string `json:"id"`
	LineNumber int    `json:"lineNumber,omitempty"`
	Role       string `json:"role"`
	TimeLabel  string `json:"timeLabel"`
	Timestamp  string `json:"timestamp,omitempty"`
	Title      string `json:"title"`
	Summary    string `json:"summary"`
	Content    string `json:"content"`
	Truncated  bool   `json:"truncated,omitempty"`
}

type sessionTitleSignals struct {
	firstUser              string
	recentUser             string
	lastAssistant          string
	lastOutcome            string
	lastPrimary            string
	lastAny                string
	hasInstructionPreamble bool
}

type sessionDisplayMetadata struct {
	displayTitle           string
	titleSource            string
	titleConfidence        string
	primaryIntent          string
	lastOutcome            string
	hasInstructionPreamble bool
}

type SessionManagementMessageRawJSONInput struct {
	LineNumber int `json:"lineNumber"`
}

type SessionManagementMessageRawJSON struct {
	SessionID  string `json:"sessionID"`
	LineNumber int    `json:"lineNumber"`
	RawJSON    string `json:"rawJSON"`
}

type SessionManagementMessagePageInput struct {
	Offset int `json:"offset"`
	Limit  int `json:"limit"`
}

type SessionManagementMessagePage struct {
	SessionID    string                           `json:"sessionID"`
	Offset       int                              `json:"offset"`
	Limit        int                              `json:"limit"`
	MessageCount int                              `json:"messageCount"`
	NextOffset   int                              `json:"nextOffset"`
	HasMore      bool                             `json:"hasMore"`
	Messages     []SessionManagementMessageRecord `json:"messages"`
}

type sessionMetaEnvelope struct {
	ID            string          `json:"id"`
	ForkedFromID  string          `json:"forked_from_id"`
	Timestamp     string          `json:"timestamp"`
	Cwd           string          `json:"cwd"`
	Source        json.RawMessage `json:"source"`
	ThreadSource  string          `json:"thread_source"`
	ModelProvider string          `json:"model_provider"`
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

type claudeCodeSessionMessageEnvelope struct {
	Role    string          `json:"role"`
	Model   string          `json:"model"`
	Content json.RawMessage `json:"content"`
}

type claudeCodeSessionLineEnvelope struct {
	Type      string                           `json:"type"`
	Timestamp string                           `json:"timestamp"`
	Cwd       string                           `json:"cwd"`
	SessionID string                           `json:"sessionId"`
	IsMeta    bool                             `json:"isMeta"`
	Message   claudeCodeSessionMessageEnvelope `json:"message"`
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
	projectName          string
	projectKey           string
	projectKeySource     string
	projectKeyConfidence string
	provider             string
	session              SessionManagementSessionRecord
	detail               SessionManagementSessionDetail
	startedAtRaw         time.Time
	updatedAtRaw         time.Time
}

type sessionIndexRecord struct {
	ID         string `json:"id"`
	ThreadName string `json:"thread_name"`
}

type projectAggregate struct {
	ID                   string
	Name                 string
	ProjectKey           string
	ProjectKeySource     string
	ProjectKeyConfidence string
	LastActiveAt         time.Time
	ProviderCounts       map[string]int
	Sessions             []SessionManagementSessionRecord
}

type sessionManagementDetailCacheEntry struct {
	FileSize            int64                           `json:"fileSize"`
	FileModTimeUnixNano int64                           `json:"fileModTimeUnixNano"`
	ApproxBytes         int                             `json:"approxBytes"`
	Detail              *SessionManagementSessionDetail `json:"detail"`
}

type sessionManagementDetailDiskCache struct {
	FileSize            int64                           `json:"fileSize"`
	FileModTimeUnixNano int64                           `json:"fileModTimeUnixNano"`
	Detail              *SessionManagementSessionDetail `json:"detail"`
}

type sessionFileParser func(codexHome string, absolutePath string, relativePath string, threadNames map[string]string, collectMessages bool) (*sessionParseResult, error)

func (a *App) GetCodexSessionManagementSnapshot() (*SessionManagementSnapshot, error) {
	if cached := a.readCachedSessionManagementSnapshot(); cached != nil {
		return cached, nil
	}
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}
	if cached, err := readSessionManagementSnapshotDiskCache(codexHome); err == nil && cached != nil {
		a.sessionMgmtMu.Lock()
		a.sessionMgmt.cachedSnapshot = cloneSessionManagementSnapshot(cached)
		a.sessionMgmt.cachedAt = time.Now()
		result := cloneSessionManagementSnapshot(a.sessionMgmt.cachedSnapshot)
		a.sessionMgmtMu.Unlock()
		go func() {
			_, _ = a.refreshCodexSessionManagementSnapshot()
		}()
		return result, nil
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
	absolutePath, err := resolveSessionAbsolutePath(codexHome, sessionID)
	if err != nil {
		return nil, err
	}
	relativePath, err := filepath.Rel(codexHome, absolutePath)
	if err != nil {
		return nil, err
	}
	fileInfo, err := os.Stat(absolutePath)
	if err != nil {
		return nil, err
	}
	relativeSlash := filepath.ToSlash(relativePath)
	cacheKey := sessionManagementDetailCacheKey("codex", relativeSlash)
	if cached := a.readCachedSessionManagementDetail(cacheKey, fileInfo.Size(), fileInfo.ModTime().UnixNano()); cached != nil {
		return compactSessionManagementDetailForUI(cached), nil
	}
	if cached, err := readSessionManagementDetailDiskCache(codexHome, "codex", relativeSlash, fileInfo.Size(), fileInfo.ModTime().UnixNano()); err == nil && cached != nil {
		detail := compactSessionManagementDetailForUI(cached)
		a.storeCachedSessionManagementDetail(cacheKey, fileInfo.Size(), fileInfo.ModTime().UnixNano(), detail)
		return detail, nil
	}
	threadNames, err := loadSessionThreadNames(codexHome)
	if err != nil {
		return nil, err
	}
	result, err := parseSessionFile(codexHome, absolutePath, relativeSlash, threadNames, false)
	if err != nil {
		return nil, err
	}
	detail := compactSessionManagementDetailForUI(&result.detail)
	a.storeCachedSessionManagementDetail(cacheKey, fileInfo.Size(), fileInfo.ModTime().UnixNano(), detail)
	_ = writeSessionManagementDetailDiskCache(codexHome, "codex", relativeSlash, fileInfo.Size(), fileInfo.ModTime().UnixNano(), detail)
	return detail, nil
}

func (a *App) GetCodexSessionMessagePage(sessionID string, input SessionManagementMessagePageInput) (*SessionManagementMessagePage, error) {
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
	return parseSessionMessagePage(codexHome, absolutePath, filepath.ToSlash(relativePath), normalizeSessionManagementMessagePageInput(input))
}

func (a *App) GetCodexSessionMessageRawJSON(sessionID string, input SessionManagementMessageRawJSONInput) (*SessionManagementMessageRawJSON, error) {
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
	return readSessionMessageRawJSONLine(absolutePath, filepath.ToSlash(relativePath), input.LineNumber)
}

func (a *App) GetClaudeCodeSessionManagementSnapshot() (*SessionManagementSnapshot, error) {
	return a.loadClaudeCodeSessionManagementSnapshot()
}

func (a *App) RefreshClaudeCodeSessionManagementSnapshot() (*SessionManagementSnapshot, error) {
	return a.loadClaudeCodeSessionManagementSnapshot()
}

func (a *App) GetClaudeCodeSessionDetail(sessionID string) (*SessionManagementSessionDetail, error) {
	claudeConfigDir, err := resolveClaudeConfigDirPath()
	if err != nil {
		return nil, err
	}
	absolutePath, err := resolveClaudeCodeSessionAbsolutePath(claudeConfigDir, sessionID)
	if err != nil {
		return nil, err
	}
	relativePath, err := filepath.Rel(claudeConfigDir, absolutePath)
	if err != nil {
		return nil, err
	}
	fileInfo, err := os.Stat(absolutePath)
	if err != nil {
		return nil, err
	}
	relativeSlash := filepath.ToSlash(relativePath)
	cacheKey := sessionManagementDetailCacheKey("claude", relativeSlash)
	if cached := a.readCachedSessionManagementDetail(cacheKey, fileInfo.Size(), fileInfo.ModTime().UnixNano()); cached != nil {
		return compactSessionManagementDetailForUI(cached), nil
	}
	if cached, err := readSessionManagementDetailDiskCache(claudeConfigDir, "claude", relativeSlash, fileInfo.Size(), fileInfo.ModTime().UnixNano()); err == nil && cached != nil {
		detail := compactSessionManagementDetailForUI(cached)
		a.storeCachedSessionManagementDetail(cacheKey, fileInfo.Size(), fileInfo.ModTime().UnixNano(), detail)
		return detail, nil
	}
	result, err := parseClaudeCodeSessionFile(claudeConfigDir, absolutePath, relativeSlash, false)
	if err != nil {
		return nil, err
	}
	detail := compactSessionManagementDetailForUI(&result.detail)
	a.storeCachedSessionManagementDetail(cacheKey, fileInfo.Size(), fileInfo.ModTime().UnixNano(), detail)
	_ = writeSessionManagementDetailDiskCache(claudeConfigDir, "claude", relativeSlash, fileInfo.Size(), fileInfo.ModTime().UnixNano(), detail)
	return detail, nil
}

func (a *App) GetClaudeCodeSessionMessagePage(sessionID string, input SessionManagementMessagePageInput) (*SessionManagementMessagePage, error) {
	claudeConfigDir, err := resolveClaudeConfigDirPath()
	if err != nil {
		return nil, err
	}
	absolutePath, err := resolveClaudeCodeSessionAbsolutePath(claudeConfigDir, sessionID)
	if err != nil {
		return nil, err
	}
	relativePath, err := filepath.Rel(claudeConfigDir, absolutePath)
	if err != nil {
		return nil, err
	}
	return parseClaudeCodeSessionMessagePage(claudeConfigDir, absolutePath, filepath.ToSlash(relativePath), normalizeSessionManagementMessagePageInput(input))
}

func (a *App) GetClaudeCodeSessionMessageRawJSON(sessionID string, input SessionManagementMessageRawJSONInput) (*SessionManagementMessageRawJSON, error) {
	claudeConfigDir, err := resolveClaudeConfigDirPath()
	if err != nil {
		return nil, err
	}
	absolutePath, err := resolveClaudeCodeSessionAbsolutePath(claudeConfigDir, sessionID)
	if err != nil {
		return nil, err
	}
	relativePath, err := filepath.Rel(claudeConfigDir, absolutePath)
	if err != nil {
		return nil, err
	}
	return readSessionMessageRawJSONLine(absolutePath, filepath.ToSlash(relativePath), input.LineNumber)
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

	snapshot := cloneSessionManagementSnapshot(input.Snapshot)
	if snapshot == nil {
		var err error
		snapshot, err = a.GetCodexSessionManagementSnapshot()
		if err != nil {
			return nil, err
		}
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
	for index, session := range project.Sessions {
		targetProvider, ok := mappings[strings.TrimSpace(session.Provider)]
		if !ok || strings.TrimSpace(targetProvider) == strings.TrimSpace(session.Provider) {
			continue
		}
		sourceProvider := strings.TrimSpace(session.Provider)
		targetProvider = strings.TrimSpace(targetProvider)

		absolutePath, err := resolveSessionAbsolutePath(codexHome, session.SessionID)
		if err != nil {
			return nil, err
		}
		if err := rewriteSessionMetaProvider(absolutePath, targetProvider); err != nil {
			return nil, err
		}
		project.Sessions[index].Provider = targetProvider
		applySessionProviderCountChange(project.ProviderCounts, sourceProvider, targetProvider)
		applySessionProviderCountChange(snapshot.ProviderCounts, sourceProvider, targetProvider)
		updatedCount++
	}

	if updatedCount == 0 {
		return snapshot, nil
	}
	project.ProviderSummary = formatProviderSummary(project.ProviderCounts)

	a.sessionMgmtMu.Lock()
	a.sessionMgmt.cachedSnapshot = cloneSessionManagementSnapshot(snapshot)
	a.sessionMgmt.cachedAt = time.Now()
	cached := cloneSessionManagementSnapshot(a.sessionMgmt.cachedSnapshot)
	a.sessionMgmtMu.Unlock()
	_ = writeSessionManagementSnapshotDiskCache(codexHome, cached)
	return cached, nil
}

func applySessionProviderCountChange(counts map[string]int, sourceProvider string, targetProvider string) {
	sourceProvider = strings.TrimSpace(sourceProvider)
	targetProvider = strings.TrimSpace(targetProvider)
	if counts == nil || sourceProvider == "" || targetProvider == "" || sourceProvider == targetProvider {
		return
	}
	if counts[sourceProvider] > 1 {
		counts[sourceProvider]--
	} else {
		delete(counts, sourceProvider)
	}
	counts[targetProvider]++
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
	if err == nil {
		if codexHome, resolveErr := resolveCodexHomePath(); resolveErr == nil {
			_ = writeSessionManagementSnapshotDiskCache(codexHome, snapshot)
		}
	}

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

func cloneSessionManagementSessionDetail(detail *SessionManagementSessionDetail) *SessionManagementSessionDetail {
	if detail == nil {
		return nil
	}

	messages := make([]SessionManagementMessageRecord, len(detail.Messages))
	copy(messages, detail.Messages)

	cloned := *detail
	cloned.Messages = messages
	return &cloned
}

func compactSessionManagementDetailForUI(detail *SessionManagementSessionDetail) *SessionManagementSessionDetail {
	cloned := cloneSessionManagementSessionDetail(detail)
	if cloned == nil {
		return nil
	}

	cloned.Messages = []SessionManagementMessageRecord{}
	return cloned
}

func sessionManagementDetailCacheKey(provider string, sessionID string) string {
	return provider + "\x00" + sessionID
}

func (a *App) readCachedSessionManagementDetail(cacheKey string, fileSize int64, fileModTimeUnixNano int64) *SessionManagementSessionDetail {
	a.sessionMgmtMu.RLock()
	defer a.sessionMgmtMu.RUnlock()
	if a.sessionMgmt.cachedDetails == nil {
		return nil
	}
	entry := a.sessionMgmt.cachedDetails[cacheKey]
	if entry == nil {
		return nil
	}
	if entry.FileSize != fileSize || entry.FileModTimeUnixNano != fileModTimeUnixNano || entry.Detail == nil {
		return nil
	}
	return cloneSessionManagementSessionDetail(entry.Detail)
}

func (a *App) storeCachedSessionManagementDetail(cacheKey string, fileSize int64, fileModTimeUnixNano int64, detail *SessionManagementSessionDetail) {
	if detail == nil {
		return
	}
	approxBytes := estimateSessionManagementDetailBytes(detail)
	if approxBytes > sessionManagementDetailMemoryCacheMaxBytes {
		a.sessionMgmtMu.Lock()
		a.evictCachedSessionManagementDetailLocked(cacheKey)
		a.sessionMgmtMu.Unlock()
		return
	}

	a.sessionMgmtMu.Lock()
	if a.sessionMgmt.cachedDetails == nil {
		a.sessionMgmt.cachedDetails = map[string]*sessionManagementDetailCacheEntry{}
	}
	a.evictCachedSessionManagementDetailLocked(cacheKey)
	a.sessionMgmt.cachedDetails[cacheKey] = &sessionManagementDetailCacheEntry{
		FileSize:            fileSize,
		FileModTimeUnixNano: fileModTimeUnixNano,
		ApproxBytes:         approxBytes,
		Detail:              cloneSessionManagementSessionDetail(detail),
	}
	a.sessionMgmt.cachedDetailOrder = append(a.sessionMgmt.cachedDetailOrder, cacheKey)
	a.sessionMgmt.cachedDetailBytes += approxBytes
	a.trimSessionManagementDetailCacheLocked()
	a.sessionMgmtMu.Unlock()
}

func (a *App) evictCachedSessionManagementDetailLocked(cacheKey string) {
	if a.sessionMgmt.cachedDetails == nil {
		return
	}
	if entry := a.sessionMgmt.cachedDetails[cacheKey]; entry != nil {
		a.sessionMgmt.cachedDetailBytes -= entry.ApproxBytes
		delete(a.sessionMgmt.cachedDetails, cacheKey)
	}
	for index := 0; index < len(a.sessionMgmt.cachedDetailOrder); {
		if a.sessionMgmt.cachedDetailOrder[index] == cacheKey {
			a.sessionMgmt.cachedDetailOrder = append(a.sessionMgmt.cachedDetailOrder[:index], a.sessionMgmt.cachedDetailOrder[index+1:]...)
			continue
		}
		index++
	}
	if a.sessionMgmt.cachedDetailBytes < 0 {
		a.sessionMgmt.cachedDetailBytes = 0
	}
}

func (a *App) trimSessionManagementDetailCacheLocked() {
	for len(a.sessionMgmt.cachedDetailOrder) > 0 &&
		(len(a.sessionMgmt.cachedDetailOrder) > sessionManagementDetailMemoryCacheMaxEntries ||
			a.sessionMgmt.cachedDetailBytes > sessionManagementDetailMemoryCacheMaxBytes) {
		oldest := a.sessionMgmt.cachedDetailOrder[0]
		a.evictCachedSessionManagementDetailLocked(oldest)
	}
}

func estimateSessionManagementDetailBytes(detail *SessionManagementSessionDetail) int {
	if detail == nil {
		return 0
	}
	total := len(detail.SessionID) + len(detail.ProjectID) + len(detail.ProjectName) + len(detail.Title) +
		len(detail.Status) + len(detail.FileLabel) + len(detail.CurrentMessageLabel) + len(detail.RoleSummary) +
		len(detail.Topic) + len(detail.Preview) + len(detail.Provider) + len(detail.Model) + len(detail.StartedAt) + len(detail.UpdatedAt)
	for _, message := range detail.Messages {
		total += len(message.ID) + len(message.Role) + len(message.TimeLabel) + len(message.Timestamp) +
			len(message.Title) + len(message.Summary) + len(message.Content)
	}
	return total
}

func sessionManagementSnapshotCachePath(codexHome string) string {
	return filepath.Join(codexHome, sessionManagementSnapshotCacheFileName)
}

func readSessionManagementSnapshotDiskCache(codexHome string) (*SessionManagementSnapshot, error) {
	content, err := os.ReadFile(sessionManagementSnapshotCachePath(codexHome))
	if err != nil {
		return nil, err
	}
	var snapshot SessionManagementSnapshot
	if err := json.Unmarshal(content, &snapshot); err != nil {
		return nil, err
	}
	if snapshot.Projects == nil {
		snapshot.Projects = []SessionManagementProjectRecord{}
	}
	if snapshot.ProviderCounts == nil {
		snapshot.ProviderCounts = map[string]int{}
	}
	normalizeSessionManagementSnapshotDisplayFields(&snapshot)
	return cloneSessionManagementSnapshot(&snapshot), nil
}

func normalizeSessionManagementSnapshotDisplayFields(snapshot *SessionManagementSnapshot) {
	if snapshot == nil {
		return
	}
	for projectIndex := range snapshot.Projects {
		for sessionIndex := range snapshot.Projects[projectIndex].Sessions {
			session := &snapshot.Projects[projectIndex].Sessions[sessionIndex]
			hadInstructionPreamble := looksLikeInstructionPreamble(session.Title) ||
				looksLikeInstructionPreamble(session.Summary) ||
				looksLikeInstructionPreamble(session.Preview)
			displayMetadata := deriveCachedSessionDisplayMetadata(
				session.DisplayTitle,
				session.Title,
				session.Topic,
				session.Summary,
				session.Preview,
				session.FileLabel,
			)
			session.DisplayTitle = displayMetadata.displayTitle
			if isLowSignalTitleCandidate("", session.Title) {
				session.Title = displayMetadata.displayTitle
			}
			if session.TitleSource == "" {
				session.TitleSource = displayMetadata.titleSource
			}
			if session.TitleConfidence == "" {
				session.TitleConfidence = displayMetadata.titleConfidence
			}
			if session.PrimaryIntent == "" && !isLowSignalTitleCandidate("", session.Summary) {
				session.PrimaryIntent = firstRunes(sanitizeSessionText(session.Summary), 180)
			}
			if session.LastOutcome == "" && !isLowSignalTitleCandidate("", session.Preview) {
				session.LastOutcome = firstRunes(sanitizeSessionText(session.Preview), 180)
			}
			if !session.HasInstructionPreamble {
				session.HasInstructionPreamble = hadInstructionPreamble
			}
		}
	}
}

func deriveCachedSessionDisplayMetadata(values ...string) sessionDisplayMetadata {
	sources := []string{"cache_display_title", "cache_title", "cache_topic", "cache_summary", "cache_preview", "file"}
	for index, value := range values {
		if isLowSignalTitleCandidate("", value) {
			continue
		}
		source := "cache"
		if index < len(sources) {
			source = sources[index]
		}
		return sessionDisplayMetadata{
			displayTitle:    firstRunes(sanitizeSessionText(value), 60),
			titleSource:     source,
			titleConfidence: "low",
		}
	}
	return sessionDisplayMetadata{
		displayTitle:    "UNTITLED SESSION",
		titleSource:     "fallback",
		titleConfidence: "low",
	}
}

func writeSessionManagementSnapshotDiskCache(codexHome string, snapshot *SessionManagementSnapshot) error {
	if snapshot == nil {
		return nil
	}
	content, err := json.Marshal(snapshot)
	if err != nil {
		return err
	}
	return os.WriteFile(sessionManagementSnapshotCachePath(codexHome), content, 0600)
}

func sessionManagementDetailDiskCachePath(root string, provider string, sessionID string) string {
	sum := sha256.Sum256([]byte(sessionManagementDetailCacheKey(provider, sessionID)))
	filename := hex.EncodeToString(sum[:]) + ".json"
	return filepath.Join(root, sessionManagementDetailCacheDirName, filename)
}

func readSessionManagementDetailDiskCache(root string, provider string, sessionID string, fileSize int64, fileModTimeUnixNano int64) (*SessionManagementSessionDetail, error) {
	content, err := os.ReadFile(sessionManagementDetailDiskCachePath(root, provider, sessionID))
	if err != nil {
		return nil, err
	}
	var cache sessionManagementDetailDiskCache
	if err := json.Unmarshal(content, &cache); err != nil {
		return nil, err
	}
	if cache.FileSize != fileSize || cache.FileModTimeUnixNano != fileModTimeUnixNano || cache.Detail == nil {
		return nil, errors.New("session detail cache mismatch")
	}
	return cloneSessionManagementSessionDetail(cache.Detail), nil
}

func writeSessionManagementDetailDiskCache(root string, provider string, sessionID string, fileSize int64, fileModTimeUnixNano int64, detail *SessionManagementSessionDetail) error {
	if detail == nil {
		return nil
	}
	cache := sessionManagementDetailDiskCache{
		FileSize:            fileSize,
		FileModTimeUnixNano: fileModTimeUnixNano,
		Detail:              cloneSessionManagementSessionDetail(detail),
	}
	content, err := json.Marshal(cache)
	if err != nil {
		return err
	}
	dir := filepath.Join(root, sessionManagementDetailCacheDirName)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	return os.WriteFile(sessionManagementDetailDiskCachePath(root, provider, sessionID), content, 0600)
}

func normalizeSessionManagementMessagePageInput(input SessionManagementMessagePageInput) SessionManagementMessagePageInput {
	if input.Offset < 0 {
		input.Offset = 0
	}
	if input.Limit <= 0 {
		input.Limit = sessionManagementMessagePageDefaultLimit
	}
	if input.Limit > sessionManagementMessagePageMaxLimit {
		input.Limit = sessionManagementMessagePageMaxLimit
	}
	return input
}

func readSessionMessageRawJSONLine(absolutePath string, relativePath string, lineNumber int) (*SessionManagementMessageRawJSON, error) {
	if lineNumber <= 0 {
		return nil, errors.New("缺少有效的消息行号")
	}
	file, err := os.Open(absolutePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	reader := bufio.NewReaderSize(file, 1024*128)
	currentLine := 0
	for {
		line, err := reader.ReadBytes('\n')
		if len(line) > 0 {
			currentLine++
			if currentLine == lineNumber {
				return &SessionManagementMessageRawJSON{
					SessionID:  relativePath,
					LineNumber: lineNumber,
					RawJSON:    strings.TrimRight(string(line), "\r\n"),
				}, nil
			}
		}
		if err != nil {
			break
		}
	}
	return nil, errors.New("未找到对应的消息 JSON 行")
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

	results, err := loadSessionParseResultsConcurrently(codexHome, rolloutPaths, threadNames, false, parseSessionFile)
	if err != nil {
		return nil, err
	}

	projects := make(map[string]*projectAggregate)
	providerCounts := map[string]int{}
	snapshot := &SessionManagementSnapshot{
		LastScanAt:     formatSessionManagementTimestamp(time.Now()),
		ProviderCounts: map[string]int{},
	}

	for _, result := range results {
		if result == nil {
			continue
		}

		projectID := result.session.ProjectID
		if projectID == "" {
			projectID = "unknown"
			result.session.ProjectID = projectID
		}

		project := projects[projectID]
		if project == nil {
			project = &projectAggregate{
				ID:                   projectID,
				Name:                 result.projectName,
				ProjectKey:           result.projectKey,
				ProjectKeySource:     result.projectKeySource,
				ProjectKeyConfidence: result.projectKeyConfidence,
				ProviderCounts:       map[string]int{},
				Sessions:             make([]SessionManagementSessionRecord, 0, 8),
			}
			projects[projectID] = project
		}
		if project.Name == "" {
			project.Name = result.projectName
		}
		applySessionProjectIdentityToAggregate(project, result)
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
			ID:                   project.ID,
			Name:                 project.Name,
			ProjectKey:           project.ProjectKey,
			ProjectKeySource:     project.ProjectKeySource,
			ProjectKeyConfidence: project.ProjectKeyConfidence,
			ProviderCounts:       cloneSessionProviderCounts(project.ProviderCounts),
			SessionCount:         len(project.Sessions),
			LastActiveAt:         formatSessionManagementTimestamp(project.LastActiveAt),
			Sessions:             project.Sessions,
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

func (a *App) loadClaudeCodeSessionManagementSnapshot() (*SessionManagementSnapshot, error) {
	claudeConfigDir, err := resolveClaudeConfigDirPath()
	if err != nil {
		return nil, err
	}
	sessionPaths, err := listClaudeCodeSessionPaths(claudeConfigDir)
	if err != nil {
		return nil, err
	}

	results, err := loadSessionParseResultsConcurrently(claudeConfigDir, sessionPaths, map[string]string{}, false, func(codexHome string, absolutePath string, relativePath string, _ map[string]string, collectMessages bool) (*sessionParseResult, error) {
		return parseClaudeCodeSessionFile(codexHome, absolutePath, relativePath, collectMessages)
	})
	if err != nil {
		return nil, err
	}

	projects := make(map[string]*projectAggregate)
	providerCounts := map[string]int{}
	snapshot := &SessionManagementSnapshot{
		LastScanAt:     formatSessionManagementTimestamp(time.Now()),
		ProviderCounts: map[string]int{},
	}

	for _, result := range results {
		if result == nil {
			continue
		}
		projectID := result.session.ProjectID
		if projectID == "" {
			projectID = "unknown"
			result.session.ProjectID = projectID
		}
		project := projects[projectID]
		if project == nil {
			project = &projectAggregate{
				ID:                   projectID,
				Name:                 result.projectName,
				ProjectKey:           result.projectKey,
				ProjectKeySource:     result.projectKeySource,
				ProjectKeyConfidence: result.projectKeyConfidence,
				ProviderCounts:       map[string]int{},
				Sessions:             make([]SessionManagementSessionRecord, 0, 8),
			}
			projects[projectID] = project
		}
		if project.Name == "" {
			project.Name = result.projectName
		}
		applySessionProjectIdentityToAggregate(project, result)
		if result.updatedAtRaw.After(project.LastActiveAt) {
			project.LastActiveAt = result.updatedAtRaw
		}
		project.ProviderCounts[result.provider]++
		project.Sessions = append(project.Sessions, result.session)
		snapshot.SessionCount++
		snapshot.ActiveSessionCount++
		providerCounts[result.provider]++
	}

	projectRecords := make([]SessionManagementProjectRecord, 0, len(projects))
	for _, project := range projects {
		sort.Slice(project.Sessions, func(i, j int) bool {
			return project.Sessions[i].UpdatedAt > project.Sessions[j].UpdatedAt
		})
		record := SessionManagementProjectRecord{
			ID:                   project.ID,
			Name:                 project.Name,
			ProjectKey:           project.ProjectKey,
			ProjectKeySource:     project.ProjectKeySource,
			ProjectKeyConfidence: project.ProjectKeyConfidence,
			ProviderCounts:       cloneSessionProviderCounts(project.ProviderCounts),
			SessionCount:         len(project.Sessions),
			ActiveSessionCount:   len(project.Sessions),
			LastActiveAt:         formatSessionManagementTimestamp(project.LastActiveAt),
			ProviderSummary:      formatProviderSummary(project.ProviderCounts),
			Sessions:             project.Sessions,
		}
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

func applySessionProjectIdentityToAggregate(project *projectAggregate, result *sessionParseResult) {
	if project == nil || result == nil || strings.TrimSpace(result.projectKey) == "" {
		return
	}
	if strings.TrimSpace(project.ProjectKey) == "" || result.projectKeyConfidence == "strong" {
		project.ProjectKey = result.projectKey
		project.ProjectKeySource = result.projectKeySource
		project.ProjectKeyConfidence = result.projectKeyConfidence
	}
}

func listClaudeCodeSessionPaths(claudeConfigDir string) ([]string, error) {
	root := filepath.Join(claudeConfigDir, "projects")
	if _, err := os.Stat(root); err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, err
	}
	paths := make([]string, 0, 128)
	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if filepath.Ext(d.Name()) != ".jsonl" || isClaudeCodeSubagentSessionPath(path) {
			return nil
		}
		paths = append(paths, path)
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Strings(paths)
	return paths, nil
}

func isClaudeCodeSubagentSessionPath(path string) bool {
	slashPath := filepath.ToSlash(path)
	return strings.Contains(slashPath, "/subagents/") || strings.HasPrefix(filepath.Base(path), "agent-")
}

func resolveClaudeCodeSessionAbsolutePath(claudeConfigDir string, sessionID string) (string, error) {
	trimmed := strings.TrimSpace(sessionID)
	if trimmed == "" {
		return "", errors.New("缺少 Claude Code session id")
	}
	cleaned := filepath.Clean(trimmed)
	if filepath.IsAbs(cleaned) {
		return "", errors.New("Claude Code session id 必须是相对路径")
	}
	absolutePath := filepath.Join(claudeConfigDir, cleaned)
	relativePath, err := filepath.Rel(claudeConfigDir, absolutePath)
	if err != nil {
		return "", err
	}
	if strings.HasPrefix(relativePath, "..") {
		return "", errors.New("Claude Code session id 超出配置目录范围")
	}
	if isClaudeCodeSubagentSessionPath(absolutePath) {
		return "", errors.New("Claude Code subagent sidecar session 不支持直接打开")
	}
	if _, err := os.Stat(absolutePath); err != nil {
		if os.IsNotExist(err) {
			return "", errors.New("Claude Code 会话文件不存在")
		}
		return "", err
	}
	return absolutePath, nil
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

func parseSessionFile(codexHome string, absolutePath string, relativePath string, threadNames map[string]string, collectMessages bool) (*sessionParseResult, error) {
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
	projectKey := ""
	projectKeySource := ""
	projectKeyConfidence := ""
	var messageRecords []SessionManagementMessageRecord
	if collectMessages {
		messageRecords = make([]SessionManagementMessageRecord, 0, 32)
	}
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
	titleSignals := sessionTitleSignals{}
	lastSummary := ""
	lastPrimarySummary := ""
	lastSnapshotSummaryRaw := ""
	lastSnapshotSummaryRole := ""
	lastSnapshotPrimaryRaw := ""
	lastSnapshotPrimaryRole := ""
	lastRole := "system"
	firstTimestamp := time.Time{}
	lastTimestamp := time.Time{}
	messageCount := 0

	appendRecord := func(timestamp time.Time, role string, title string, raw string) {
		if !collectMessages {
			messageCount++
			lastRole = role
			roleCounts[role]++
			raw = strings.TrimSpace(raw)
			titleSignals.observe(role, raw)
			if role == "user" && firstUserText == "" {
				firstUserText = raw
			}
			if raw != "" {
				lastSnapshotSummaryRaw = raw
				lastSnapshotSummaryRole = role
				if role != "event" && role != "system" {
					lastSnapshotPrimaryRaw = raw
					lastSnapshotPrimaryRole = role
				}
			}
			return
		}

		title, summary, content, truncated := buildSessionMessageContent(role, title, raw)
		if strings.TrimSpace(title) == "" && strings.TrimSpace(content) == "" {
			return
		}
		titleSignals.observe(role, raw)
		messageCount++
		lastRole = role
		if collectMessages {
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
		}
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
						if strings.TrimSpace(meta.Cwd) != "" && projectKey == "" {
							projectKey, projectKeySource, projectKeyConfidence = deriveSessionProjectIdentityFromCWD(meta.Cwd, "codex-session-cwd")
						}
						provider = normalizeSessionProvider(meta.ModelProvider, model)
						appendRecord(messageTimestamp, "system", "会话元数据", formatSessionMetaSummary(meta))
					}
				case "turn_context":
					var turnContext turnContextEnvelope
					if unmarshalErr := json.Unmarshal(envelope.Payload, &turnContext); unmarshalErr == nil {
						if strings.TrimSpace(turnContext.Cwd) != "" {
							currentCWD = turnContext.Cwd
							projectName = deriveProjectName(meta, currentCWD, relativePath)
							projectKey, projectKeySource, projectKeyConfidence = deriveSessionProjectIdentityFromCWD(currentCWD, "codex-turn-workspace")
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
	currentMessageLabel := formatCurrentMessageLabelByCount(messageCount, lastRole)
	if collectMessages {
		currentMessageLabel = formatCurrentMessageLabel(messageRecords)
	}
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
	if !collectMessages {
		firstUserText = buildSessionSnapshotSummary("user", firstUserText)
		lastPrimarySummary = buildSessionSnapshotSummary(lastSnapshotPrimaryRole, lastSnapshotPrimaryRaw)
		lastSummary = buildSessionSnapshotSummary(lastSnapshotSummaryRole, lastSnapshotSummaryRaw)
	}
	if sessionTitle == "" {
		sessionTitle = deriveSessionTitle(firstUserText, lastPrimarySummary, fileLabel)
	}
	displayMetadata := deriveSessionDisplayMetadata(sessionTitle, titleSignals, fileLabel)
	sessionTitle = displayMetadata.displayTitle
	preview := chooseNonEmpty(lastPrimarySummary, lastSummary, fileLabel)

	sessionRecord := SessionManagementSessionRecord{
		ID:                     relativePath,
		SessionID:              relativePath,
		ProjectID:              projectID,
		ProjectName:            projectName,
		ProjectKey:             projectKey,
		ProjectKeySource:       projectKeySource,
		ProjectKeyConfidence:   projectKeyConfidence,
		Title:                  sessionTitle,
		DisplayTitle:           displayMetadata.displayTitle,
		TitleSource:            displayMetadata.titleSource,
		TitleConfidence:        displayMetadata.titleConfidence,
		Status:                 status,
		Archived:               archived,
		MessageCount:           messageCount,
		RoleSummary:            roleSummary,
		StartedAt:              formatSessionManagementTimestamp(firstTimestamp),
		UpdatedAt:              formatSessionManagementTimestamp(lastTimestamp),
		FileLabel:              fileLabel,
		Summary:                preview,
		Preview:                preview,
		Topic:                  sessionTitle,
		PrimaryIntent:          displayMetadata.primaryIntent,
		LastOutcome:            displayMetadata.lastOutcome,
		HasInstructionPreamble: displayMetadata.hasInstructionPreamble,
		CurrentMessageLabel:    currentMessageLabel,
		Provider:               provider,
		Model:                  model,
	}

	detail := SessionManagementSessionDetail{
		SessionID:              relativePath,
		ProjectID:              projectID,
		ProjectName:            projectName,
		ProjectKey:             projectKey,
		ProjectKeySource:       projectKeySource,
		ProjectKeyConfidence:   projectKeyConfidence,
		Title:                  sessionTitle,
		DisplayTitle:           displayMetadata.displayTitle,
		TitleSource:            displayMetadata.titleSource,
		TitleConfidence:        displayMetadata.titleConfidence,
		Status:                 status,
		Archived:               archived,
		FileLabel:              fileLabel,
		MessageCount:           messageCount,
		Masked:                 true,
		CurrentMessageLabel:    currentMessageLabel,
		RoleSummary:            roleSummary,
		Topic:                  sessionTitle,
		Preview:                preview,
		PrimaryIntent:          displayMetadata.primaryIntent,
		LastOutcome:            displayMetadata.lastOutcome,
		HasInstructionPreamble: displayMetadata.hasInstructionPreamble,
		Provider:               provider,
		Model:                  model,
		StartedAt:              formatSessionManagementTimestamp(firstTimestamp),
		UpdatedAt:              formatSessionManagementTimestamp(lastTimestamp),
		Messages:               messageRecords,
	}

	return &sessionParseResult{
		projectName:          projectName,
		projectKey:           projectKey,
		projectKeySource:     projectKeySource,
		projectKeyConfidence: projectKeyConfidence,
		provider:             provider,
		session:              sessionRecord,
		detail:               detail,
		startedAtRaw:         firstTimestamp,
		updatedAtRaw:         lastTimestamp,
	}, nil
}

func parseClaudeCodeSessionFile(claudeConfigDir string, absolutePath string, relativePath string, collectMessages bool) (*sessionParseResult, error) {
	file, err := os.Open(absolutePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	projectName := fallbackClaudeCodeProjectName(relativePath)
	projectCWD := ""
	projectKey := ""
	projectKeySource := ""
	projectKeyConfidence := ""
	sessionID := strings.TrimSuffix(filepath.Base(relativePath), filepath.Ext(relativePath))
	model := ""
	var messageRecords []SessionManagementMessageRecord
	if collectMessages {
		messageRecords = make([]SessionManagementMessageRecord, 0, 32)
	}
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
	titleSignals := sessionTitleSignals{}
	lastSummary := ""
	lastPrimarySummary := ""
	lastSnapshotSummaryRaw := ""
	lastSnapshotSummaryRole := ""
	lastSnapshotPrimaryRaw := ""
	lastSnapshotPrimaryRole := ""
	customTitle := ""
	lastRole := "system"
	firstTimestamp := time.Time{}
	lastTimestamp := time.Time{}
	messageCount := 0

	appendRecord := func(timestamp time.Time, role string, title string, raw string) {
		if !collectMessages {
			messageCount++
			lastRole = role
			roleCounts[role]++
			raw = strings.TrimSpace(raw)
			titleSignals.observe(role, raw)
			if role == "user" && firstUserText == "" {
				firstUserText = raw
			}
			if raw != "" {
				lastSnapshotSummaryRaw = raw
				lastSnapshotSummaryRole = role
				if role != "event" && role != "system" {
					lastSnapshotPrimaryRaw = raw
					lastSnapshotPrimaryRole = role
				}
			}
			return
		}

		title, summary, content, truncated := buildSessionMessageContent(role, title, raw)
		if strings.TrimSpace(title) == "" && strings.TrimSpace(content) == "" {
			return
		}
		titleSignals.observe(role, raw)
		messageCount++
		lastRole = role
		if collectMessages {
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
		}
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
			var envelope claudeCodeSessionLineEnvelope
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
				if strings.TrimSpace(envelope.SessionID) != "" {
					sessionID = strings.TrimSpace(envelope.SessionID)
				}
				if strings.TrimSpace(envelope.Cwd) != "" {
					projectCWD = strings.TrimSpace(envelope.Cwd)
					projectName = pathBaseFromCWD(projectCWD)
					projectKey, projectKeySource, projectKeyConfidence = deriveSessionProjectIdentityFromCWD(projectCWD, "claude-session-cwd")
				}
				switch envelope.Type {
				case "attachment":
					appendRecord(messageTimestamp, "system", "Claude 会话元数据", formatClaudeCodeSessionMetaSummary(projectCWD, sessionID))
				case "custom-title":
					customTitle = extractClaudeCodeCustomTitle(line)
				case "system":
					if !envelope.IsMeta {
						appendRecord(messageTimestamp, "system", "Claude 系统事件", extractClaudeCodeSystemContent(line))
					}
				case "user", "assistant":
					role, title, text, nextModel, ok := extractClaudeCodeMessageRecord(envelope)
					if strings.TrimSpace(nextModel) != "" {
						model = strings.TrimSpace(nextModel)
					}
					if ok {
						appendRecord(messageTimestamp, role, title, text)
					}
				}
			}
		}
		if err != nil {
			break
		}
	}

	if firstTimestamp.IsZero() {
		if info, statErr := os.Stat(absolutePath); statErr == nil {
			firstTimestamp = info.ModTime()
			lastTimestamp = info.ModTime()
		}
	}
	if lastTimestamp.IsZero() {
		lastTimestamp = firstTimestamp
	}
	if projectName == "" {
		projectName = fallbackClaudeCodeProjectName(relativePath)
	}
	fileLabel := formatClaudeCodeSessionFileLabel(relativePath)
	if !collectMessages {
		firstUserText = buildSessionSnapshotSummary("user", firstUserText)
		lastPrimarySummary = buildSessionSnapshotSummary(lastSnapshotPrimaryRole, lastSnapshotPrimaryRaw)
		lastSummary = buildSessionSnapshotSummary(lastSnapshotSummaryRole, lastSnapshotSummaryRaw)
	}
	title := strings.TrimSpace(customTitle)
	if title == "" {
		title = deriveSessionTitle(firstUserText, lastPrimarySummary, fileLabel)
	}
	displayMetadata := deriveSessionDisplayMetadata(title, titleSignals, fileLabel)
	title = displayMetadata.displayTitle
	resumeCommand := "claude --resume " + sessionID
	preview := chooseNonEmpty(lastPrimarySummary, lastSummary, title, fileLabel)
	preview = strings.TrimSpace(preview + " / " + resumeCommand)
	projectID := slugifySessionProjectName(projectName)
	roleSummary := formatSessionRoleSummary(roleCounts)
	currentMessageLabel := formatCurrentMessageLabelByCount(messageCount, lastRole)
	if collectMessages {
		currentMessageLabel = formatCurrentMessageLabel(messageRecords)
	}

	sessionRecord := SessionManagementSessionRecord{
		ID:                     relativePath,
		SessionID:              relativePath,
		ProjectID:              projectID,
		ProjectName:            projectName,
		ProjectKey:             projectKey,
		ProjectKeySource:       projectKeySource,
		ProjectKeyConfidence:   projectKeyConfidence,
		Title:                  title,
		DisplayTitle:           displayMetadata.displayTitle,
		TitleSource:            displayMetadata.titleSource,
		TitleConfidence:        displayMetadata.titleConfidence,
		Status:                 "active",
		Archived:               false,
		MessageCount:           messageCount,
		RoleSummary:            roleSummary,
		StartedAt:              formatSessionManagementTimestamp(firstTimestamp),
		UpdatedAt:              formatSessionManagementTimestamp(lastTimestamp),
		FileLabel:              fileLabel,
		Summary:                preview,
		Preview:                preview,
		Topic:                  title,
		PrimaryIntent:          displayMetadata.primaryIntent,
		LastOutcome:            displayMetadata.lastOutcome,
		HasInstructionPreamble: displayMetadata.hasInstructionPreamble,
		CurrentMessageLabel:    currentMessageLabel,
		Provider:               "claude",
		Model:                  model,
	}
	detail := SessionManagementSessionDetail{
		SessionID:              relativePath,
		ProjectID:              projectID,
		ProjectName:            projectName,
		ProjectKey:             projectKey,
		ProjectKeySource:       projectKeySource,
		ProjectKeyConfidence:   projectKeyConfidence,
		Title:                  title,
		DisplayTitle:           displayMetadata.displayTitle,
		TitleSource:            displayMetadata.titleSource,
		TitleConfidence:        displayMetadata.titleConfidence,
		Status:                 "active",
		Archived:               false,
		FileLabel:              fileLabel,
		MessageCount:           messageCount,
		Masked:                 true,
		CurrentMessageLabel:    currentMessageLabel,
		RoleSummary:            roleSummary,
		Topic:                  title,
		Preview:                preview,
		PrimaryIntent:          displayMetadata.primaryIntent,
		LastOutcome:            displayMetadata.lastOutcome,
		HasInstructionPreamble: displayMetadata.hasInstructionPreamble,
		Provider:               "claude",
		Model:                  model,
		StartedAt:              formatSessionManagementTimestamp(firstTimestamp),
		UpdatedAt:              formatSessionManagementTimestamp(lastTimestamp),
		Messages:               messageRecords,
	}
	return &sessionParseResult{
		projectName:          projectName,
		projectKey:           projectKey,
		projectKeySource:     projectKeySource,
		projectKeyConfidence: projectKeyConfidence,
		provider:             "claude",
		session:              sessionRecord,
		detail:               detail,
		startedAtRaw:         firstTimestamp,
		updatedAtRaw:         lastTimestamp,
	}, nil
}

func parseSessionMessagePage(codexHome string, absolutePath string, relativePath string, input SessionManagementMessagePageInput) (*SessionManagementMessagePage, error) {
	file, err := os.Open(absolutePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	page := &SessionManagementMessagePage{
		SessionID: relativePath,
		Offset:    input.Offset,
		Limit:     input.Limit,
		Messages:  make([]SessionManagementMessageRecord, 0, input.Limit),
	}
	shouldStop := false
	appendRecord := func(lineNumber int, timestamp time.Time, role string, title string, raw string) {
		title, summary, content, truncated := buildSessionMessageContent(role, title, raw)
		if strings.TrimSpace(title) == "" && strings.TrimSpace(content) == "" {
			return
		}
		messageIndex := page.MessageCount
		page.MessageCount++
		if messageIndex < input.Offset || len(page.Messages) >= input.Limit {
			if messageIndex >= input.Offset+input.Limit {
				page.HasMore = true
				shouldStop = true
			}
			return
		}
		page.Messages = append(page.Messages, SessionManagementMessageRecord{
			ID:         fmt.Sprintf("%s:%d", filepath.Base(relativePath), messageIndex+1),
			LineNumber: lineNumber,
			Role:       role,
			TimeLabel:  formatSessionManagementTime(timestamp),
			Timestamp:  formatSessionManagementTimestamp(timestamp),
			Title:      title,
			Summary:    summary,
			Content:    content,
			Truncated:  truncated,
		})
	}

	reader := bufio.NewReaderSize(file, 1024*128)
	lineNumber := 0
	for {
		line, err := reader.ReadBytes('\n')
		if len(line) > 0 {
			lineNumber++
			var envelope struct {
				Timestamp string          `json:"timestamp"`
				Type      string          `json:"type"`
				Payload   json.RawMessage `json:"payload"`
			}
			if unmarshalErr := json.Unmarshal(line, &envelope); unmarshalErr == nil {
				messageTimestamp := time.Time{}
				if parsed, parseErr := time.Parse(time.RFC3339Nano, envelope.Timestamp); parseErr == nil {
					messageTimestamp = parsed
				}
				switch envelope.Type {
				case "session_meta":
					var meta sessionMetaEnvelope
					if unmarshalErr := json.Unmarshal(envelope.Payload, &meta); unmarshalErr == nil {
						appendRecord(lineNumber, messageTimestamp, "system", "会话元数据", formatSessionMetaSummary(meta))
					}
				case "turn_context":
					var turnContext turnContextEnvelope
					if unmarshalErr := json.Unmarshal(envelope.Payload, &turnContext); unmarshalErr == nil {
						appendRecord(lineNumber, messageTimestamp, "system", "上下文更新", formatTurnContextSummary(turnContext))
					}
				case "response_item":
					var item responseItemEnvelope
					if unmarshalErr := json.Unmarshal(envelope.Payload, &item); unmarshalErr == nil {
						role, title, text, ok := extractResponseItemRecord(item)
						if ok {
							appendRecord(lineNumber, messageTimestamp, role, title, text)
						}
					}
				case "event_msg":
					var eventPayload eventMessageEnvelope
					if unmarshalErr := json.Unmarshal(envelope.Payload, &eventPayload); unmarshalErr == nil {
						role, title, text, ok := extractEventRecord(eventPayload)
						if ok {
							appendRecord(lineNumber, messageTimestamp, role, title, text)
						}
					}
				}
			}
		}
		if shouldStop || err != nil {
			break
		}
	}

	page.NextOffset = input.Offset + len(page.Messages)
	if !page.HasMore {
		page.HasMore = page.NextOffset < page.MessageCount
	}
	return page, nil
}

func parseClaudeCodeSessionMessagePage(claudeConfigDir string, absolutePath string, relativePath string, input SessionManagementMessagePageInput) (*SessionManagementMessagePage, error) {
	file, err := os.Open(absolutePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	page := &SessionManagementMessagePage{
		SessionID: relativePath,
		Offset:    input.Offset,
		Limit:     input.Limit,
		Messages:  make([]SessionManagementMessageRecord, 0, input.Limit),
	}
	shouldStop := false
	appendRecord := func(lineNumber int, timestamp time.Time, role string, title string, raw string) {
		title, summary, content, truncated := buildSessionMessageContent(role, title, raw)
		if strings.TrimSpace(title) == "" && strings.TrimSpace(content) == "" {
			return
		}
		messageIndex := page.MessageCount
		page.MessageCount++
		if messageIndex < input.Offset || len(page.Messages) >= input.Limit {
			if messageIndex >= input.Offset+input.Limit {
				page.HasMore = true
				shouldStop = true
			}
			return
		}
		page.Messages = append(page.Messages, SessionManagementMessageRecord{
			ID:         fmt.Sprintf("%s:%d", filepath.Base(relativePath), messageIndex+1),
			LineNumber: lineNumber,
			Role:       role,
			TimeLabel:  formatSessionManagementTime(timestamp),
			Timestamp:  formatSessionManagementTimestamp(timestamp),
			Title:      title,
			Summary:    summary,
			Content:    content,
			Truncated:  truncated,
		})
	}

	reader := bufio.NewReaderSize(file, 1024*128)
	lineNumber := 0
	for {
		line, err := reader.ReadBytes('\n')
		if len(line) > 0 {
			lineNumber++
			var envelope claudeCodeSessionLineEnvelope
			if unmarshalErr := json.Unmarshal(line, &envelope); unmarshalErr == nil {
				messageTimestamp := time.Time{}
				if parsed, parseErr := time.Parse(time.RFC3339Nano, envelope.Timestamp); parseErr == nil {
					messageTimestamp = parsed
				}
				switch envelope.Type {
				case "attachment":
					appendRecord(lineNumber, messageTimestamp, "system", "Claude 会话元数据", formatClaudeCodeSessionMetaSummary(envelope.Cwd, envelope.SessionID))
				case "system":
					if !envelope.IsMeta {
						appendRecord(lineNumber, messageTimestamp, "system", "Claude 系统事件", extractClaudeCodeSystemContent(line))
					}
				case "user", "assistant":
					role, title, text, _, ok := extractClaudeCodeMessageRecord(envelope)
					if ok {
						appendRecord(lineNumber, messageTimestamp, role, title, text)
					}
				}
			}
		}
		if shouldStop || err != nil {
			break
		}
	}

	page.NextOffset = input.Offset + len(page.Messages)
	if !page.HasMore {
		page.HasMore = page.NextOffset < page.MessageCount
	}
	return page, nil
}

func loadSessionParseResultsConcurrently(
	codexHome string,
	paths []string,
	threadNames map[string]string,
	collectMessages bool,
	parser sessionFileParser,
) ([]*sessionParseResult, error) {
	if len(paths) == 0 {
		return []*sessionParseResult{}, nil
	}

	workerCount := runtime.GOMAXPROCS(0)
	if workerCount > 8 {
		workerCount = 8
	}
	if workerCount < 1 {
		workerCount = 1
	}
	if workerCount > len(paths) {
		workerCount = len(paths)
	}

	results := make([]*sessionParseResult, len(paths))
	var firstErr error
	var firstErrMu sync.Mutex
	var wg sync.WaitGroup
	jobs := make(chan int)

	worker := func() {
		defer wg.Done()
		for index := range jobs {
			absolutePath := paths[index]
			relativePath, err := filepath.Rel(codexHome, absolutePath)
			if err != nil {
				firstErrMu.Lock()
				if firstErr == nil {
					firstErr = err
				}
				firstErrMu.Unlock()
				continue
			}
			relativePath = filepath.ToSlash(relativePath)
			result, err := parser(codexHome, absolutePath, relativePath, threadNames, collectMessages)
			if err != nil {
				firstErrMu.Lock()
				if firstErr == nil {
					firstErr = err
				}
				firstErrMu.Unlock()
				continue
			}
			results[index] = result
		}
	}

	wg.Add(workerCount)
	for i := 0; i < workerCount; i++ {
		go worker()
	}

	for index := range paths {
		jobs <- index
	}
	close(jobs)
	wg.Wait()

	if firstErr != nil {
		return nil, firstErr
	}
	return results, nil
}

func extractClaudeCodeMessageRecord(envelope claudeCodeSessionLineEnvelope) (string, string, string, string, bool) {
	role := normalizeSessionRole(envelope.Message.Role)
	if role == "system" {
		role = normalizeSessionRole(envelope.Type)
	}
	text, contentRole := extractClaudeCodeContent(envelope.Message.Content)
	if contentRole != "" {
		role = contentRole
	}
	title := fallbackSessionMessageTitle(role)
	return role, title, text, envelope.Message.Model, strings.TrimSpace(text) != ""
}

func extractClaudeCodeContent(raw json.RawMessage) (string, string) {
	if len(raw) == 0 || string(raw) == "null" {
		return "", ""
	}
	var text string
	if err := json.Unmarshal(raw, &text); err == nil {
		return text, ""
	}
	var items []map[string]any
	if err := json.Unmarshal(raw, &items); err != nil {
		return string(raw), ""
	}
	parts := make([]string, 0, len(items))
	role := ""
	for _, item := range items {
		itemType := strings.TrimSpace(fmt.Sprint(item["type"]))
		switch itemType {
		case "text":
			parts = append(parts, strings.TrimSpace(fmt.Sprint(item["text"])))
		case "thinking":
			role = chooseNonEmpty(role, "reasoning")
			parts = append(parts, strings.TrimSpace(fmt.Sprint(item["thinking"])))
		case "tool_use":
			role = "tool_call"
			parts = append(parts, formatClaudeCodeToolUse(item))
		case "tool_result":
			role = "tool_result"
			parts = append(parts, formatClaudeCodeToolResult(item))
		default:
			if value := strings.TrimSpace(fmt.Sprint(item["content"])); value != "" {
				parts = append(parts, value)
			}
		}
	}
	return strings.Join(filterNonEmptyStrings(parts), "\n"), role
}

func formatClaudeCodeToolUse(item map[string]any) string {
	name := strings.TrimSpace(fmt.Sprint(item["name"]))
	if name == "" {
		name = "tool"
	}
	input := marshalSessionJSON(item["input"])
	return strings.TrimSpace(name + " " + input)
}

func formatClaudeCodeToolResult(item map[string]any) string {
	return strings.TrimSpace(fmt.Sprint(item["content"]))
}

func extractClaudeCodeSystemContent(line []byte) string {
	var payload map[string]any
	if err := json.Unmarshal(line, &payload); err != nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(payload["content"]))
}

func extractClaudeCodeCustomTitle(line []byte) string {
	var payload map[string]any
	if err := json.Unmarshal(line, &payload); err != nil {
		return ""
	}
	return sanitizeSessionText(fmt.Sprint(payload["customTitle"]))
}

func formatClaudeCodeSessionMetaSummary(cwd string, sessionID string) string {
	parts := make([]string, 0, 2)
	if cwd != "" {
		parts = append(parts, "目录 "+cwd)
	}
	if sessionID != "" {
		parts = append(parts, "Session "+sessionID)
	}
	return strings.Join(parts, " / ")
}

func fallbackClaudeCodeProjectName(relativePath string) string {
	parts := strings.Split(filepath.ToSlash(relativePath), "/")
	if len(parts) >= 2 && parts[0] == "projects" {
		encoded := strings.Trim(parts[1], "-")
		if encoded != "" {
			segments := strings.Split(encoded, "-")
			if len(segments) > 0 {
				return segments[len(segments)-1]
			}
		}
	}
	return "未知项目"
}

func formatClaudeCodeSessionFileLabel(relativePath string) string {
	parts := strings.Split(filepath.ToSlash(relativePath), "/")
	if len(parts) >= 3 && parts[0] == "projects" {
		return parts[1] + "/" + parts[len(parts)-1]
	}
	return filepath.Base(relativePath)
}

func filterNonEmptyStrings(values []string) []string {
	filtered := values[:0]
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			filtered = append(filtered, value)
		}
	}
	return filtered
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

func buildSessionSnapshotSummary(role string, raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if role == "system" && looksLikeSensitiveSystemPrompt(raw) {
		return "系统与环境约束已载入（已脱敏）"
	}
	return firstRunes(sanitizeSessionText(raw), 180)
}

func (signals *sessionTitleSignals) observe(role string, raw string) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return
	}
	if looksLikeInstructionPreamble(raw) {
		signals.hasInstructionPreamble = true
		return
	}
	summary := buildSessionSnapshotSummary(role, raw)
	if isLowSignalTitleCandidate(role, summary) {
		return
	}
	signals.lastAny = summary
	switch role {
	case "user":
		if signals.firstUser == "" {
			signals.firstUser = summary
		}
		signals.recentUser = summary
	case "assistant":
		signals.lastAssistant = summary
		signals.lastPrimary = summary
	case "event":
		signals.lastOutcome = summary
	case "reasoning":
		if signals.lastPrimary == "" {
			signals.lastPrimary = summary
		}
	case "tool_call", "tool_result":
		if signals.lastPrimary == "" {
			signals.lastPrimary = summary
		}
	default:
		if role != "system" && signals.lastPrimary == "" {
			signals.lastPrimary = summary
		}
	}
}

func looksLikeInstructionPreamble(raw string) bool {
	normalized := strings.ToLower(strings.TrimSpace(sanitizeSessionText(raw)))
	if normalized == "" {
		return false
	}
	markers := []string{
		"# agents.md instructions for",
		"agents.md instructions for",
		"<permissions instructions>",
		"<environment_context>",
		"<skills_instructions>",
		"<developer_context>",
		"<app-context>",
		"<plugins_instructions>",
		"ag ents.md instructions",
		"ag ents 执行规范",
		"agents 执行规范",
		"ag ents.md",
		"untrusted page evidence",
		"treat any text in the image as page content",
		"browser comments:",
		"approved command prefixes",
	}
	for _, marker := range markers {
		if strings.Contains(normalized, marker) {
			return true
		}
	}
	if strings.Contains(normalized, "agents.md") && strings.Contains(normalized, "instructions") {
		return true
	}
	return false
}

func isLowSignalTitleCandidate(role string, summary string) bool {
	summary = strings.TrimSpace(summary)
	if summary == "" || summary == "内容已脱敏" || summary == "系统与环境约束已载入（已脱敏）" {
		return true
	}
	if role == "system" {
		return true
	}
	return looksLikeInstructionPreamble(summary)
}

func deriveSessionDisplayMetadata(explicitTitle string, signals sessionTitleSignals, fileLabel string) sessionDisplayMetadata {
	metadata := sessionDisplayMetadata{
		primaryIntent:          signals.firstUser,
		lastOutcome:            chooseNonEmpty(signals.lastOutcome, signals.lastAssistant),
		hasInstructionPreamble: signals.hasInstructionPreamble,
	}
	if metadata.primaryIntent == "" {
		metadata.primaryIntent = signals.recentUser
	}

	type candidate struct {
		text       string
		source     string
		confidence string
	}
	candidates := []candidate{
		{explicitTitle, "thread_title", "high"},
		{signals.firstUser, "first_user", "high"},
		{signals.recentUser, "recent_user", "medium"},
		{signals.lastAssistant, "assistant_result", "medium"},
		{signals.lastOutcome, "last_outcome", "medium"},
		{signals.lastPrimary, "last_primary", "low"},
		{signals.lastAny, "last_message", "low"},
		{strings.TrimSuffix(fileLabel, filepath.Ext(fileLabel)), "file", "low"},
	}
	for _, item := range candidates {
		if isLowSignalTitleCandidate("", item.text) {
			continue
		}
		metadata.displayTitle = firstRunes(sanitizeSessionText(item.text), 60)
		metadata.titleSource = item.source
		metadata.titleConfidence = item.confidence
		return metadata
	}
	metadata.displayTitle = "UNTITLED SESSION"
	metadata.titleSource = "fallback"
	metadata.titleConfidence = "low"
	return metadata
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
	text = sessionSecretPattern.ReplaceAllString(text, "[密钥]")
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

func deriveSessionProjectIdentityFromCWD(cwd string, source string) (string, string, string) {
	cleaned := filepath.Clean(strings.TrimSpace(cwd))
	if cleaned == "" || cleaned == "." {
		return "", "", ""
	}
	sum := sha256.Sum256([]byte(cleaned))
	return "workspace:" + hex.EncodeToString(sum[:]), strings.TrimSpace(source), "strong"
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

func formatCurrentMessageLabelByCount(count int, role string) string {
	if count <= 0 {
		return "00 / 系统"
	}

	roleLabel := map[string]string{
		"user":        "用户",
		"assistant":   "助手",
		"system":      "系统",
		"reasoning":   "推理",
		"tool_call":   "工具调用",
		"tool_result": "工具结果",
		"event":       "事件",
	}[role]
	if roleLabel == "" {
		roleLabel = "系统"
	}
	return fmt.Sprintf("%02d / %s", count, roleLabel)
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
