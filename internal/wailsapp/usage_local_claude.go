package wailsapp

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type claudeLocalUsageUsage struct {
	InputTokens              int64 `json:"input_tokens"`
	OutputTokens             int64 `json:"output_tokens"`
	CacheReadInputTokens     int64 `json:"cache_read_input_tokens"`
	CacheCreationInputTokens int64 `json:"cache_creation_input_tokens"`
	CachedInputTokens        int64 `json:"cached_input_tokens"`
}

type claudeLocalUsageMessage struct {
	ID         string                 `json:"id"`
	Model      string                 `json:"model"`
	Usage      *claudeLocalUsageUsage `json:"usage"`
	StopReason string                 `json:"stop_reason"`
}

type claudeLocalUsageLine struct {
	Type      string                  `json:"type"`
	Timestamp string                  `json:"timestamp"`
	Cwd       string                  `json:"cwd"`
	SessionID string                  `json:"sessionId"`
	Message   claudeLocalUsageMessage `json:"message"`
}

type claudeLocalUsageParsedMessage struct {
	detail       LocalProjectedUsageDetail
	stopReason   string
	outputTokens int64
}

func (a *App) GetClaudeLocalUsage() (*LocalProjectedUsageResponse, error) {
	if cached := a.readCachedLocalUsageResponse(localProjectedProviderClaude); cached != nil {
		return cached, nil
	}
	return a.refreshClaudeLocalUsage(false)
}

func (a *App) RefreshClaudeLocalUsage() (*LocalProjectedUsageResponse, error) {
	return a.refreshClaudeLocalUsage(true)
}

func (a *App) RebuildClaudeLocalUsage() (*LocalProjectedUsageResponse, error) {
	return a.refreshClaudeLocalUsage(true)
}

func (a *App) RebuildClaudeLocalUsageDay(_ string) (*LocalProjectedUsageResponse, error) {
	return a.refreshClaudeLocalUsage(true)
}

func (a *App) refreshClaudeLocalUsage(emitUpdated bool) (*LocalProjectedUsageResponse, error) {
	a.localUsageMu.Lock()
	if a.claudeLocalUsage.refreshRunning {
		a.localUsageMu.Unlock()
		return a.waitForClaudeLocalUsageRefresh(emitUpdated)
	}
	a.claudeLocalUsage.refreshRunning = true
	a.localUsageMu.Unlock()

	response, err := a.loadClaudeLocalUsage()

	a.localUsageMu.Lock()
	a.claudeLocalUsage.refreshRunning = false
	if err != nil {
		a.localUsageMu.Unlock()
		return nil, err
	}
	a.claudeLocalUsage.cachedResponse = cloneLocalProjectedUsageResponse(response)
	a.claudeLocalUsage.cachedAt = time.Now()
	a.claudeLocalUsage.lastRefreshAt = a.claudeLocalUsage.cachedAt
	cached := cloneLocalProjectedUsageResponse(a.claudeLocalUsage.cachedResponse)
	a.localUsageMu.Unlock()
	if emitUpdated {
		a.emitLocalUsageUpdated(cached)
	}
	return cached, nil
}

func (a *App) waitForClaudeLocalUsageRefresh(emitUpdated bool) (*LocalProjectedUsageResponse, error) {
	for {
		time.Sleep(20 * time.Millisecond)
		a.localUsageMu.RLock()
		refreshRunning := a.claudeLocalUsage.refreshRunning
		cached := cloneLocalProjectedUsageResponse(a.claudeLocalUsage.cachedResponse)
		a.localUsageMu.RUnlock()
		if refreshRunning {
			continue
		}
		if cached != nil {
			return cached, nil
		}
		return a.refreshClaudeLocalUsage(emitUpdated)
	}
}

func (a *App) loadClaudeLocalUsage() (*LocalProjectedUsageResponse, error) {
	claudeConfigDir, err := resolveClaudeConfigDirPath()
	if err != nil {
		return nil, err
	}
	snapshot, err := a.collectClaudeLocalUsageSnapshotFromConfigDir(claudeConfigDir)
	if err != nil {
		return nil, err
	}
	return &LocalProjectedUsageResponse{
		Provider:         localProjectedProviderClaude,
		SourceKind:       localProjectedSourceKind,
		ScannedFiles:     snapshot.ScannedFiles,
		FullRebuildFiles: snapshot.FullRebuildFiles,
		Details:          snapshot.Details,
	}, nil
}

func (a *App) collectClaudeLocalUsageSnapshotFromConfigDir(claudeConfigDir string) (*localUsageSnapshot, error) {
	sessionPaths, err := listClaudeCodeSessionPaths(claudeConfigDir)
	if err != nil {
		return nil, err
	}
	snapshot := &localUsageSnapshot{
		Details:      make([]LocalProjectedUsageDetail, 0, len(sessionPaths)*2),
		ScannedFiles: len(sessionPaths),
	}
	if len(sessionPaths) == 0 {
		return snapshot, nil
	}

	a.emitLocalUsageProgress(localProjectedProviderClaude, LocalProjectedUsageProgress{
		Phase:          "scan_inventory",
		ProcessedFiles: 0,
		TotalFiles:     len(sessionPaths),
	})
	for index, absolutePath := range sessionPaths {
		relativePath, err := filepath.Rel(claudeConfigDir, absolutePath)
		if err != nil {
			return nil, err
		}
		relativePath = filepath.ToSlash(relativePath)
		details, err := parseClaudeLocalUsageFile(absolutePath, relativePath)
		if err != nil {
			return nil, err
		}
		snapshot.Details = append(snapshot.Details, details...)
		snapshot.FullRebuildFiles++
		a.emitLocalUsageProgress(localProjectedProviderClaude, LocalProjectedUsageProgress{
			Phase:          "reconcile_rollouts",
			CurrentFile:    relativeLocalUsageProgressPath(claudeConfigDir, absolutePath),
			ProcessedFiles: index + 1,
			TotalFiles:     len(sessionPaths),
			Source:         localUsageSourceFullRebuild,
		})
	}
	sort.Slice(snapshot.Details, func(i, j int) bool {
		if snapshot.Details[i].Timestamp == snapshot.Details[j].Timestamp {
			return snapshot.Details[i].SessionID < snapshot.Details[j].SessionID
		}
		return snapshot.Details[i].Timestamp < snapshot.Details[j].Timestamp
	})
	a.emitLocalUsageProgress(localProjectedProviderClaude, LocalProjectedUsageProgress{
		Phase:          "finished",
		ProcessedFiles: len(sessionPaths),
		TotalFiles:     len(sessionPaths),
	})
	return snapshot, nil
}

func parseClaudeLocalUsageFile(absolutePath string, relativePath string) ([]LocalProjectedUsageDetail, error) {
	file, err := os.Open(absolutePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	fallbackTimestamp := time.Now()
	if info, statErr := os.Stat(absolutePath); statErr == nil {
		fallbackTimestamp = info.ModTime()
	}

	projectName := fallbackClaudeCodeProjectName(relativePath)
	messages := make(map[string]claudeLocalUsageParsedMessage)
	reader := bufio.NewReaderSize(file, 1024*128)
	lineNumber := 0
	for {
		line, readErr := reader.ReadBytes('\n')
		if len(line) > 0 {
			lineNumber++
			var envelope claudeLocalUsageLine
			if unmarshalErr := json.Unmarshal(line, &envelope); unmarshalErr == nil {
				if cwdProject := pathBaseFromCWD(envelope.Cwd); cwdProject != "" {
					projectName = cwdProject
				}
				if envelope.Type == "assistant" && envelope.Message.Usage != nil {
					messageID := strings.TrimSpace(envelope.Message.ID)
					if messageID == "" {
						messageID = fmt.Sprintf("%s:%d", relativePath, lineNumber)
					}
					usage := envelope.Message.Usage
					cachedInputTokens := usage.CacheReadInputTokens
					if cachedInputTokens == 0 {
						cachedInputTokens = usage.CachedInputTokens
					}
					detail := LocalProjectedUsageDetail{
						Timestamp:         normalizeClaudeLocalUsageTimestamp(envelope.Timestamp, fallbackTimestamp),
						Provider:          localProjectedProviderClaude,
						SourceKind:        localProjectedSourceKind,
						SessionID:         filepath.ToSlash(relativePath),
						ProjectName:       projectName,
						Model:             normalizeClaudeLocalUsageModel(envelope.Message.Model),
						InputTokens:       usage.InputTokens + usage.CacheCreationInputTokens,
						CachedInputTokens: cachedInputTokens,
						OutputTokens:      usage.OutputTokens,
						RequestCount:      1,
					}
					parsed := claudeLocalUsageParsedMessage{
						detail:       detail,
						stopReason:   strings.TrimSpace(envelope.Message.StopReason),
						outputTokens: usage.OutputTokens,
					}
					existing, exists := messages[messageID]
					if shouldReplaceClaudeLocalUsageMessage(existing, parsed, exists) {
						messages[messageID] = parsed
					}
				}
			}
		}
		if readErr != nil {
			break
		}
	}

	details := make([]LocalProjectedUsageDetail, 0, len(messages))
	for _, message := range messages {
		if message.stopReason == "" || message.outputTokens == 0 {
			continue
		}
		details = append(details, message.detail)
	}
	sort.Slice(details, func(i, j int) bool {
		if details[i].Timestamp == details[j].Timestamp {
			return details[i].Model < details[j].Model
		}
		return details[i].Timestamp < details[j].Timestamp
	})
	return details, nil
}

func shouldReplaceClaudeLocalUsageMessage(existing claudeLocalUsageParsedMessage, next claudeLocalUsageParsedMessage, exists bool) bool {
	if !exists {
		return true
	}
	existingFinal := existing.stopReason != ""
	nextFinal := next.stopReason != ""
	if nextFinal && !existingFinal {
		return true
	}
	if nextFinal == existingFinal {
		return next.outputTokens > existing.outputTokens
	}
	return false
}

func normalizeClaudeLocalUsageTimestamp(value string, fallback time.Time) string {
	if parsed, err := time.Parse(time.RFC3339Nano, strings.TrimSpace(value)); err == nil {
		return parsed.UTC().Format(time.RFC3339)
	}
	if fallback.IsZero() {
		return time.Now().UTC().Format(time.RFC3339)
	}
	return fallback.UTC().Format(time.RFC3339)
}

func normalizeClaudeLocalUsageModel(raw string) string {
	name := strings.TrimSpace(raw)
	if name == "" {
		return "unknown"
	}
	if index := strings.LastIndex(name, "/"); index >= 0 {
		name = name[index+1:]
	}
	if len(name) > 11 {
		suffix := name[len(name)-11:]
		if suffix[0] == '-' &&
			isASCIIDigitString(suffix[1:5]) &&
			suffix[5] == '-' &&
			isASCIIDigitString(suffix[6:8]) &&
			suffix[8] == '-' &&
			isASCIIDigitString(suffix[9:11]) {
			name = name[:len(name)-11]
		}
	}
	if len(name) > 9 {
		parts := strings.Split(name, "-")
		suffix := parts[len(parts)-1]
		if len(suffix) == 8 && isASCIIDigitString(suffix) {
			name = strings.TrimSuffix(name, "-"+suffix)
		}
	}
	return name
}

func isASCIIDigitString(value string) bool {
	if value == "" {
		return false
	}
	for _, char := range value {
		if char < '0' || char > '9' {
			return false
		}
	}
	return true
}
