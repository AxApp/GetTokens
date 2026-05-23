package wailsapp

import (
	"bufio"
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
	_ "modernc.org/sqlite"
)

const (
	localProjectedProvider       = "codex"
	localProjectedProviderClaude = "claude"
	localProjectedSourceKind     = "local_projected"
	localUsageIndexDirName       = "codex-local-usage"
	localUsageIndexFileName      = "usage-index-v1.sqlite"
	localUsageMinutesTableName   = "session_usage_minutes_v2"
	localUsageSourceCacheHit     = "cacheHit"
	localUsageSourceDeltaAppend  = "deltaAppend"
	localUsageSourceFullRebuild  = "fullRebuild"
	localUsageSourceFileMissing  = "fileMissing"
)

type codexTokenUsage struct {
	InputTokens       int64 `json:"input_tokens"`
	CachedInputTokens int64 `json:"cached_input_tokens"`
	OutputTokens      int64 `json:"output_tokens"`
}

type codexSessionTokenInfo struct {
	TotalTokenUsage *codexTokenUsage `json:"total_token_usage"`
	LastTokenUsage  *codexTokenUsage `json:"last_token_usage"`
}

type codexTokenUsageMinute struct {
	Model             string
	InputTokens       int64
	CachedInputTokens int64
	OutputTokens      int64
	RequestCount      int64
}

type localUsageMinuteBucketKey struct {
	MinuteStartTimestamp string
	Model                string
}

type localUsageSnapshot struct {
	Details          []LocalProjectedUsageDetail
	ScannedFiles     int
	CacheHitFiles    int
	DeltaAppendFiles int
	FullRebuildFiles int
	FileMissingFiles int
}

type localUsageParseResult struct {
	MinuteBuckets  map[localUsageMinuteBucketKey]codexTokenUsageMinute
	LastModel      string
	ProjectName    string
	PreviousTotals *codexTokenUsage
	ParsedBytes    int64
}

type localUsageIndexEntry struct {
	RolloutPath          string
	AbsolutePath         string
	ModifiedUnixMs       int64
	SizeBytes            int64
	ParsedBytes          int64
	LastModel            string
	ProjectName          string
	PreviousInputTokens  int64
	PreviousCachedTokens int64
	PreviousOutputTokens int64
}

func (a *App) emitLocalUsageProgress(provider string, progress LocalProjectedUsageProgress) {
	if a.ctx == nil {
		return
	}
	progress.Provider = provider
	wailsRuntime.EventsEmit(a.ctx, "usage-local:progress", progress)
}

func (a *App) emitLocalUsageUpdated(response *LocalProjectedUsageResponse) {
	if a.ctx == nil || response == nil {
		return
	}
	wailsRuntime.EventsEmit(a.ctx, "usage-local:updated", cloneLocalProjectedUsageResponse(response))
}

func relativeLocalUsageProgressPath(codexHome string, absolutePath string) string {
	if absolutePath == "" {
		return ""
	}
	if relativePath, err := filepath.Rel(codexHome, absolutePath); err == nil {
		return filepath.ToSlash(relativePath)
	}
	return filepath.Base(absolutePath)
}

func (a *App) GetCodexLocalUsage() (*LocalProjectedUsageResponse, error) {
	if cached := a.readCachedLocalUsageResponse(localProjectedProvider); cached != nil {
		return cached, nil
	}
	return a.refreshCodexLocalUsage(false, false)
}

func (a *App) RefreshCodexLocalUsage() (*LocalProjectedUsageResponse, error) {
	return a.refreshCodexLocalUsage(false, true)
}

func (a *App) RebuildCodexLocalUsage() (*LocalProjectedUsageResponse, error) {
	return a.refreshCodexLocalUsage(true, true)
}

func (a *App) RebuildCodexLocalUsageDay(dayKey string) (*LocalProjectedUsageResponse, error) {
	return a.refreshCodexLocalUsageDay(dayKey, true)
}

func (a *App) loadCodexLocalUsage(forceRebuild bool) (*LocalProjectedUsageResponse, error) {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}

	snapshot, err := a.collectCodexLocalUsageSnapshotFromHome(codexHome, forceRebuild)
	if err != nil {
		return nil, err
	}

	return &LocalProjectedUsageResponse{
		Provider:         localProjectedProvider,
		SourceKind:       localProjectedSourceKind,
		ScannedFiles:     snapshot.ScannedFiles,
		CacheHitFiles:    snapshot.CacheHitFiles,
		DeltaAppendFiles: snapshot.DeltaAppendFiles,
		FullRebuildFiles: snapshot.FullRebuildFiles,
		FileMissingFiles: snapshot.FileMissingFiles,
		Details:          snapshot.Details,
	}, nil
}

func (a *App) refreshCodexLocalUsage(forceRebuild bool, emitUpdated bool) (*LocalProjectedUsageResponse, error) {
	a.localUsageMu.Lock()
	if a.localUsage.refreshRunning {
		a.localUsageMu.Unlock()
		return a.waitForLocalUsageRefresh(forceRebuild, emitUpdated)
	}
	a.localUsage.refreshRunning = true
	a.localUsageMu.Unlock()

	response, err := a.loadCodexLocalUsage(forceRebuild)

	a.localUsageMu.Lock()
	a.localUsage.refreshRunning = false
	if err != nil {
		a.localUsageMu.Unlock()
		return nil, err
	}
	a.localUsage.cachedResponse = cloneLocalProjectedUsageResponse(response)
	a.localUsage.cachedAt = time.Now()
	a.localUsage.lastRefreshAt = a.localUsage.cachedAt
	cached := cloneLocalProjectedUsageResponse(a.localUsage.cachedResponse)
	a.localUsageMu.Unlock()
	if emitUpdated {
		a.emitLocalUsageUpdated(cached)
	}
	return cached, nil
}

func (a *App) refreshCodexLocalUsageDay(dayKey string, emitUpdated bool) (*LocalProjectedUsageResponse, error) {
	a.localUsageMu.Lock()
	if a.localUsage.refreshRunning {
		a.localUsageMu.Unlock()
		return a.waitForLocalUsageRefresh(false, emitUpdated)
	}
	a.localUsage.refreshRunning = true
	a.localUsageMu.Unlock()

	codexHome, err := resolveCodexHomePath()
	var response *LocalProjectedUsageResponse
	if err == nil {
		response, err = a.loadCodexLocalUsageDay(codexHome, dayKey)
	}

	a.localUsageMu.Lock()
	a.localUsage.refreshRunning = false
	if err != nil {
		a.localUsageMu.Unlock()
		return nil, err
	}
	a.localUsage.cachedResponse = cloneLocalProjectedUsageResponse(response)
	a.localUsage.cachedAt = time.Now()
	a.localUsage.lastRefreshAt = a.localUsage.cachedAt
	cached := cloneLocalProjectedUsageResponse(a.localUsage.cachedResponse)
	a.localUsageMu.Unlock()
	if emitUpdated {
		a.emitLocalUsageUpdated(cached)
	}
	return cached, nil
}

func (a *App) waitForLocalUsageRefresh(forceRebuild bool, emitUpdated bool) (*LocalProjectedUsageResponse, error) {
	for {
		time.Sleep(20 * time.Millisecond)
		a.localUsageMu.RLock()
		refreshRunning := a.localUsage.refreshRunning
		cached := cloneLocalProjectedUsageResponse(a.localUsage.cachedResponse)
		a.localUsageMu.RUnlock()
		if refreshRunning {
			continue
		}
		if cached != nil {
			return cached, nil
		}
		return a.refreshCodexLocalUsage(forceRebuild, emitUpdated)
	}
}

func (a *App) readCachedLocalUsageResponse(provider string) *LocalProjectedUsageResponse {
	a.localUsageMu.RLock()
	defer a.localUsageMu.RUnlock()
	switch provider {
	case localProjectedProviderClaude:
		return cloneLocalProjectedUsageResponse(a.claudeLocalUsage.cachedResponse)
	default:
		return cloneLocalProjectedUsageResponse(a.localUsage.cachedResponse)
	}
}

func cloneLocalProjectedUsageResponse(response *LocalProjectedUsageResponse) *LocalProjectedUsageResponse {
	if response == nil {
		return nil
	}
	details := make([]LocalProjectedUsageDetail, len(response.Details))
	copy(details, response.Details)
	return &LocalProjectedUsageResponse{
		Provider:         response.Provider,
		SourceKind:       response.SourceKind,
		ScannedFiles:     response.ScannedFiles,
		CacheHitFiles:    response.CacheHitFiles,
		DeltaAppendFiles: response.DeltaAppendFiles,
		FullRebuildFiles: response.FullRebuildFiles,
		FileMissingFiles: response.FileMissingFiles,
		Details:          details,
	}
}

func (a *App) startLocalUsageRefreshLoop(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				now := time.Now()
				if a.shouldRunScheduledLocalUsageRefresh(now) {
					if _, err := a.refreshCodexLocalUsage(false, true); err != nil {
						log.Printf("scheduled codex local usage refresh failed: %v", err)
					}
				}
				if a.shouldRunScheduledLocalUsageRefreshForProvider(localProjectedProviderClaude, now) {
					if _, err := a.refreshClaudeLocalUsage(true); err != nil {
						log.Printf("scheduled claude local usage refresh failed: %v", err)
					}
				}
			}
		}
	}()
}

func (a *App) shouldRunScheduledLocalUsageRefresh(now time.Time) bool {
	return a.shouldRunScheduledLocalUsageRefreshForProvider(localProjectedProvider, now)
}

func (a *App) shouldRunScheduledLocalUsageRefreshForProvider(provider string, now time.Time) bool {
	a.localUsageMu.RLock()
	state := a.localUsageState(provider)
	cachedResponse := state.cachedResponse
	lastRefreshAt := state.lastRefreshAt
	refreshRunning := state.refreshRunning
	a.localUsageMu.RUnlock()

	if refreshRunning || cachedResponse == nil || lastRefreshAt.IsZero() {
		return false
	}
	settings, err := loadLocalProjectedUsageSettings()
	if err != nil {
		log.Printf("load local projected usage settings failed: %v", err)
		settings = defaultLocalProjectedUsageSettings()
	}
	interval := time.Duration(settings.RefreshIntervalMinutes) * time.Minute
	return now.Sub(lastRefreshAt) >= interval
}

func (a *App) localUsageState(provider string) *localUsageRuntimeState {
	if provider == localProjectedProviderClaude {
		return &a.claudeLocalUsage
	}
	return &a.localUsage
}

func collectCodexLocalUsageDetailsFromHome(codexHome string) ([]LocalProjectedUsageDetail, int, error) {
	snapshot, err := (&App{}).collectCodexLocalUsageSnapshotFromHome(codexHome, false)
	if err != nil {
		return nil, 0, err
	}
	return snapshot.Details, snapshot.ScannedFiles, nil
}

func collectLocalUsageRolloutPaths(codexHome string) ([]string, bool, error) {
	rolloutPaths := make([]string, 0, 64)
	rolloutRoots := []string{
		filepath.Join(codexHome, "sessions"),
		filepath.Join(codexHome, "archived_sessions"),
	}
	foundAnyRoot := false
	for _, rolloutRoot := range rolloutRoots {
		if _, err := os.Stat(rolloutRoot); err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return nil, false, err
		}
		foundAnyRoot = true
		if err := filepath.WalkDir(rolloutRoot, func(path string, d os.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if d.IsDir() {
				return nil
			}
			if strings.HasSuffix(d.Name(), ".jsonl") {
				rolloutPaths = append(rolloutPaths, path)
			}
			return nil
		}); err != nil {
			return nil, false, err
		}
	}
	sort.Strings(rolloutPaths)
	return rolloutPaths, foundAnyRoot, nil
}

func (a *App) collectCodexLocalUsageSnapshotFromHome(codexHome string, forceRebuild bool) (*localUsageSnapshot, error) {
	rolloutPaths, foundAnyRoot, err := collectLocalUsageRolloutPaths(codexHome)
	if err != nil {
		return nil, err
	}
	if !foundAnyRoot {
		return &localUsageSnapshot{}, nil
	}

	a.emitLocalUsageProgress(localProjectedProvider, LocalProjectedUsageProgress{
		Phase:          "scan_inventory",
		ProcessedFiles: 0,
		TotalFiles:     len(rolloutPaths),
	})

	db, err := openLocalUsageIndexDB()
	if err != nil {
		return nil, err
	}
	defer db.Close()

	if err := ensureLocalUsageIndexSchema(db); err != nil {
		return nil, err
	}
	if forceRebuild {
		if err := clearLocalUsageIndex(db); err != nil {
			return nil, err
		}
	}

	snapshot := &localUsageSnapshot{
		Details:      make([]LocalProjectedUsageDetail, 0, len(rolloutPaths)*4),
		ScannedFiles: len(rolloutPaths),
	}
	currentRolloutPaths := make(map[string]struct{}, len(rolloutPaths))

	for index, absolutePath := range rolloutPaths {
		relativePath, err := filepath.Rel(codexHome, absolutePath)
		if err != nil {
			return nil, err
		}
		relativePath = filepath.ToSlash(relativePath)
		currentRolloutPaths[relativePath] = struct{}{}

		details, source, err := loadLocalUsageEntry(db, absolutePath, relativePath)
		if err != nil {
			return nil, err
		}
		snapshot.Details = append(snapshot.Details, details...)

		switch source {
		case localUsageSourceCacheHit:
			snapshot.CacheHitFiles++
		case localUsageSourceDeltaAppend:
			snapshot.DeltaAppendFiles++
		case localUsageSourceFullRebuild:
			snapshot.FullRebuildFiles++
		}

		a.emitLocalUsageProgress(localProjectedProvider, LocalProjectedUsageProgress{
			Phase:          "reconcile_rollouts",
			CurrentFile:    relativeLocalUsageProgressPath(codexHome, absolutePath),
			ProcessedFiles: index + 1,
			TotalFiles:     len(rolloutPaths),
			Source:         source,
		})
	}

	missingCount, err := purgeMissingLocalUsageEntries(db, currentRolloutPaths)
	if err != nil {
		return nil, err
	}
	snapshot.FileMissingFiles = missingCount

	sort.Slice(snapshot.Details, func(i, j int) bool {
		if snapshot.Details[i].Timestamp == snapshot.Details[j].Timestamp {
			if snapshot.Details[i].Model == snapshot.Details[j].Model {
				return snapshot.Details[i].InputTokens+snapshot.Details[i].OutputTokens < snapshot.Details[j].InputTokens+snapshot.Details[j].OutputTokens
			}
			return snapshot.Details[i].Model < snapshot.Details[j].Model
		}
		return snapshot.Details[i].Timestamp < snapshot.Details[j].Timestamp
	})

	a.emitLocalUsageProgress(localProjectedProvider, LocalProjectedUsageProgress{
		Phase:          "finished",
		ProcessedFiles: len(rolloutPaths),
		TotalFiles:     len(rolloutPaths),
	})

	return snapshot, nil
}

func (a *App) loadCodexLocalUsageDay(codexHome string, dayKey string) (*LocalProjectedUsageResponse, error) {
	snapshot, err := a.collectCodexLocalUsageSnapshotForDay(codexHome, dayKey)
	if err != nil {
		return nil, err
	}
	return &LocalProjectedUsageResponse{
		Provider:         localProjectedProvider,
		SourceKind:       localProjectedSourceKind,
		ScannedFiles:     snapshot.ScannedFiles,
		CacheHitFiles:    snapshot.CacheHitFiles,
		DeltaAppendFiles: snapshot.DeltaAppendFiles,
		FullRebuildFiles: snapshot.FullRebuildFiles,
		FileMissingFiles: snapshot.FileMissingFiles,
		Details:          snapshot.Details,
	}, nil
}

func (a *App) collectCodexLocalUsageSnapshotForDay(codexHome string, dayKey string) (*localUsageSnapshot, error) {
	dayStart, dayEnd, localDay, err := parseLocalUsageDayWindow(dayKey)
	if err != nil {
		return nil, err
	}
	rolloutPaths, foundAnyRoot, err := collectLocalUsageRolloutPaths(codexHome)
	if err != nil {
		return nil, err
	}
	if !foundAnyRoot {
		return &localUsageSnapshot{}, nil
	}

	db, err := openLocalUsageIndexDB()
	if err != nil {
		return nil, err
	}
	defer db.Close()
	if err := ensureLocalUsageIndexSchema(db); err != nil {
		return nil, err
	}

	absoluteByRelative := make(map[string]string, len(rolloutPaths))
	candidates := make(map[string]string)
	pathDateKeys := map[string]struct{}{
		localDay.Format("2006/01/02"): {},
	}
	for _, absolutePath := range rolloutPaths {
		relativePath, err := filepath.Rel(codexHome, absolutePath)
		if err != nil {
			return nil, err
		}
		relativePath = filepath.ToSlash(relativePath)
		absoluteByRelative[relativePath] = absolutePath
		if localUsageRolloutPathMatchesDates(relativePath, pathDateKeys) {
			candidates[relativePath] = absolutePath
		}
	}

	indexedRollouts, err := loadLocalUsageRolloutPathsForWindow(db, dayStart, dayEnd)
	if err != nil {
		return nil, err
	}
	for _, rolloutPath := range indexedRollouts {
		if absolutePath, ok := absoluteByRelative[rolloutPath]; ok {
			candidates[rolloutPath] = absolutePath
		} else if err := deleteLocalUsageEntry(db, rolloutPath); err != nil {
			return nil, err
		}
	}

	candidatePaths := make([]string, 0, len(candidates))
	for rolloutPath := range candidates {
		candidatePaths = append(candidatePaths, rolloutPath)
	}
	sort.Strings(candidatePaths)

	a.emitLocalUsageProgress(localProjectedProvider, LocalProjectedUsageProgress{
		Phase:          "scan_inventory",
		ProcessedFiles: 0,
		TotalFiles:     len(candidatePaths),
	})

	snapshot := &localUsageSnapshot{
		ScannedFiles: len(candidatePaths),
	}
	for index, rolloutPath := range candidatePaths {
		absolutePath := candidates[rolloutPath]
		parseResult, err := parseCodexLocalUsageFile(absolutePath, rolloutPath, 0, "", "", nil)
		if err != nil {
			return nil, err
		}
		info, err := os.Stat(absolutePath)
		if err != nil {
			if os.IsNotExist(err) {
				if err := deleteLocalUsageEntry(db, rolloutPath); err != nil {
					return nil, err
				}
				snapshot.FileMissingFiles++
				continue
			}
			return nil, err
		}
		if err := replaceLocalUsageEntry(db, rolloutPath, absolutePath, info.ModTime().UnixMilli(), info.Size(), parseResult); err != nil {
			return nil, err
		}
		snapshot.FullRebuildFiles++
		a.emitLocalUsageProgress(localProjectedProvider, LocalProjectedUsageProgress{
			Phase:          "reconcile_rollouts",
			CurrentFile:    relativeLocalUsageProgressPath(codexHome, absolutePath),
			ProcessedFiles: index + 1,
			TotalFiles:     len(candidatePaths),
			Source:         localUsageSourceFullRebuild,
		})
	}

	details, err := loadAllLocalUsageDetails(db)
	if err != nil {
		return nil, err
	}
	snapshot.Details = details
	a.emitLocalUsageProgress(localProjectedProvider, LocalProjectedUsageProgress{
		Phase:          "finished",
		ProcessedFiles: len(candidatePaths),
		TotalFiles:     len(candidatePaths),
	})
	return snapshot, nil
}

func loadLocalUsageEntry(db *sql.DB, absolutePath string, rolloutPath string) ([]LocalProjectedUsageDetail, string, error) {
	info, err := os.Stat(absolutePath)
	if err != nil {
		if os.IsNotExist(err) {
			if err := deleteLocalUsageEntry(db, rolloutPath); err != nil {
				return nil, "", err
			}
			return nil, localUsageSourceFileMissing, nil
		}
		return nil, "", err
	}

	modifiedUnixMs := info.ModTime().UnixMilli()
	sizeBytes := info.Size()
	cached, err := loadLocalUsageIndexEntry(db, rolloutPath)
	if err != nil {
		return nil, "", err
	}

	switch {
	case cached != nil &&
		cached.AbsolutePath == absolutePath &&
		cached.ModifiedUnixMs == modifiedUnixMs &&
		cached.SizeBytes == sizeBytes:
		details, err := loadLocalUsageDetails(db, rolloutPath)
		if err != nil {
			return nil, "", err
		}
		if strings.TrimSpace(cached.ProjectName) == "" {
			projectName, projectErr := parseCodexLocalUsageProjectName(absolutePath, rolloutPath)
			if projectErr == nil && strings.TrimSpace(projectName) != "" {
				_ = updateLocalUsageEntryProjectName(db, rolloutPath, projectName)
				for index := range details {
					details[index].ProjectName = projectName
				}
			}
		}
		return details, localUsageSourceCacheHit, nil
	case cached != nil && canUseLocalUsageDeltaAppend(*cached, absolutePath, modifiedUnixMs, sizeBytes):
		parseResult, err := parseCodexLocalUsageFile(
			absolutePath,
			rolloutPath,
			cached.ParsedBytes,
			cached.LastModel,
			cached.ProjectName,
			&codexTokenUsage{
				InputTokens:       cached.PreviousInputTokens,
				CachedInputTokens: cached.PreviousCachedTokens,
				OutputTokens:      cached.PreviousOutputTokens,
			},
		)
		if err == nil {
			if err := appendLocalUsageEntry(db, rolloutPath, absolutePath, modifiedUnixMs, sizeBytes, parseResult); err != nil {
				return nil, "", err
			}
			details, err := loadLocalUsageDetails(db, rolloutPath)
			if err != nil {
				return nil, "", err
			}
			return details, localUsageSourceDeltaAppend, nil
		}
		fallthrough
	default:
		parseResult, err := parseCodexLocalUsageFile(absolutePath, rolloutPath, 0, "", "", nil)
		if err != nil {
			return nil, "", err
		}
		if err := replaceLocalUsageEntry(db, rolloutPath, absolutePath, modifiedUnixMs, sizeBytes, parseResult); err != nil {
			return nil, "", err
		}
		details, err := loadLocalUsageDetails(db, rolloutPath)
		if err != nil {
			return nil, "", err
		}
		return details, localUsageSourceFullRebuild, nil
	}
}

func canUseLocalUsageDeltaAppend(cached localUsageIndexEntry, absolutePath string, modifiedUnixMs int64, sizeBytes int64) bool {
	return cached.AbsolutePath == absolutePath &&
		cached.ParsedBytes == cached.SizeBytes &&
		sizeBytes > cached.SizeBytes &&
		modifiedUnixMs >= cached.ModifiedUnixMs
}

func parseCodexLocalUsageFile(path string, relativePath string, offset int64, currentModel string, currentProjectName string, previousTotals *codexTokenUsage) (*localUsageParseResult, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	if offset > 0 {
		if _, err := file.Seek(offset, io.SeekStart); err != nil {
			return nil, err
		}
	}

	result, err := parseCodexLocalUsageStream(file, currentModel, currentProjectName, relativePath, previousTotals)
	if err != nil {
		return nil, err
	}

	info, err := file.Stat()
	if err != nil {
		return nil, err
	}
	result.ParsedBytes = info.Size()
	return result, nil
}

func parseCodexLocalUsageStream(reader io.Reader, currentModel string, currentProjectName string, relativePath string, previousTotals *codexTokenUsage) (*localUsageParseResult, error) {
	minuteBuckets := make(map[localUsageMinuteBucketKey]codexTokenUsageMinute)
	activeModel := currentModel
	activeTotals := cloneCodexTokenUsage(previousTotals)
	projectName := strings.TrimSpace(currentProjectName)
	if projectName == "" {
		projectName = fallbackProjectName(relativePath)
	}
	var meta sessionMetaEnvelope
	currentCWD := ""
	replayGuard := localUsageReplayGuard{}

	lineReader := bufio.NewReaderSize(reader, 1024*64)
	for {
		line, err := lineReader.ReadBytes('\n')
		if len(line) > 0 {
			line = bytes.TrimSpace(line)
			if len(line) == 0 {
				if err == io.EOF {
					break
				}
				if err != nil {
					continue
				}
			}

			projectName = updateLocalUsageProjectNameFromLine(line, relativePath, projectName, &meta, &currentCWD)
			replayGuard.observeLine(line)
			nextModel, nextTotals, minuteKey, delta, parseErr := parseCodexLocalUsageLine(line, activeModel, activeTotals)
			if parseErr != nil {
				return nil, parseErr
			}
			activeModel = nextModel
			activeTotals = nextTotals
			if delta != nil && !replayGuard.shouldSuppressTokenCount(line) {
				bucketKey := localUsageMinuteBucketKey{
					MinuteStartTimestamp: minuteKey,
					Model:                activeModel,
				}
				bucket := minuteBuckets[bucketKey]
				bucket.Model = activeModel
				bucket.InputTokens += delta.InputTokens
				bucket.CachedInputTokens += delta.CachedInputTokens
				bucket.OutputTokens += delta.OutputTokens
				bucket.RequestCount += 1
				minuteBuckets[bucketKey] = bucket
			}
		}
		if err != nil {
			if err == io.EOF {
				break
			}
			return nil, err
		}
	}

	return &localUsageParseResult{
		MinuteBuckets:  minuteBuckets,
		LastModel:      activeModel,
		ProjectName:    projectName,
		PreviousTotals: activeTotals,
	}, nil
}

type localUsageReplayGuard struct {
	firstSessionSeen          bool
	firstSessionID            string
	firstSessionSecond        string
	forkedHistory             bool
	sawCopiedSessionMetaStart bool
}

func (guard *localUsageReplayGuard) observeLine(line []byte) {
	var envelope struct {
		Type      string          `json:"type"`
		Timestamp string          `json:"timestamp"`
		Payload   json.RawMessage `json:"payload"`
	}
	if err := json.Unmarshal(line, &envelope); err != nil {
		return
	}
	if envelope.Type != "session_meta" {
		return
	}
	var meta sessionMetaEnvelope
	if err := json.Unmarshal(envelope.Payload, &meta); err != nil {
		return
	}
	second, err := normalizeSecondTimestamp(envelope.Timestamp)
	if err != nil {
		return
	}
	if !guard.firstSessionSeen {
		guard.firstSessionSeen = true
		guard.firstSessionID = strings.TrimSpace(meta.ID)
		guard.firstSessionSecond = second
		guard.forkedHistory = sessionMetaCarriesForkedHistory(meta)
		return
	}
	if !guard.forkedHistory || second != guard.firstSessionSecond {
		return
	}
	nextID := strings.TrimSpace(meta.ID)
	if nextID != "" && nextID != guard.firstSessionID {
		guard.sawCopiedSessionMetaStart = true
	}
}

func (guard localUsageReplayGuard) shouldSuppressTokenCount(line []byte) bool {
	if !guard.forkedHistory || !guard.sawCopiedSessionMetaStart || guard.firstSessionSecond == "" {
		return false
	}
	var envelope struct {
		Type      string `json:"type"`
		Timestamp string `json:"timestamp"`
		Payload   struct {
			Type string `json:"type"`
		} `json:"payload"`
	}
	if err := json.Unmarshal(line, &envelope); err != nil {
		return false
	}
	if envelope.Type != "event_msg" || envelope.Payload.Type != "token_count" {
		return false
	}
	second, err := normalizeSecondTimestamp(envelope.Timestamp)
	if err != nil {
		return false
	}
	return second == guard.firstSessionSecond
}

func sessionMetaCarriesForkedHistory(meta sessionMetaEnvelope) bool {
	if strings.TrimSpace(meta.ForkedFromID) != "" {
		return true
	}
	if strings.EqualFold(strings.TrimSpace(meta.ThreadSource), "subagent") {
		return true
	}
	return bytes.Contains(meta.Source, []byte(`"subagent"`))
}

func parseCodexLocalUsageProjectName(path string, relativePath string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()

	projectName := fallbackProjectName(relativePath)
	var meta sessionMetaEnvelope
	currentCWD := ""
	lineReader := bufio.NewReaderSize(file, 1024*64)
	for {
		line, err := lineReader.ReadBytes('\n')
		if len(line) > 0 {
			line = bytes.TrimSpace(line)
			if len(line) > 0 {
				projectName = updateLocalUsageProjectNameFromLine(line, relativePath, projectName, &meta, &currentCWD)
			}
		}
		if err != nil {
			if err == io.EOF {
				break
			}
			return "", err
		}
	}
	return projectName, nil
}

func updateLocalUsageProjectNameFromLine(line []byte, relativePath string, currentProjectName string, meta *sessionMetaEnvelope, currentCWD *string) string {
	var envelope struct {
		Type    string          `json:"type"`
		Payload json.RawMessage `json:"payload"`
	}
	if err := json.Unmarshal(line, &envelope); err != nil {
		return currentProjectName
	}
	switch envelope.Type {
	case "session_meta":
		var nextMeta sessionMetaEnvelope
		if err := json.Unmarshal(envelope.Payload, &nextMeta); err != nil {
			return currentProjectName
		}
		*meta = nextMeta
		return deriveProjectName(*meta, *currentCWD, relativePath)
	case "turn_context":
		var turnContext turnContextEnvelope
		if err := json.Unmarshal(envelope.Payload, &turnContext); err != nil {
			return currentProjectName
		}
		if strings.TrimSpace(turnContext.Cwd) == "" {
			return currentProjectName
		}
		*currentCWD = turnContext.Cwd
		return deriveProjectName(*meta, *currentCWD, relativePath)
	default:
		return currentProjectName
	}
}

func parseCodexLocalUsageLine(line []byte, currentModel string, previousTotals *codexTokenUsage) (string, *codexTokenUsage, string, *codexTokenUsage, error) {
	var envelope struct {
		Type      string          `json:"type"`
		Timestamp string          `json:"timestamp"`
		Payload   json.RawMessage `json:"payload"`
	}
	if err := json.Unmarshal(line, &envelope); err != nil {
		return currentModel, previousTotals, "", nil, err
	}

	activeModel := currentModel
	activeTotals := cloneCodexTokenUsage(previousTotals)

	switch envelope.Type {
	case "turn_context":
		var payload struct {
			Model string `json:"model"`
		}
		if err := json.Unmarshal(envelope.Payload, &payload); err != nil {
			return currentModel, previousTotals, "", nil, err
		}
		if strings.TrimSpace(payload.Model) != "" {
			activeModel = strings.TrimSpace(payload.Model)
		}
		return activeModel, activeTotals, "", nil, nil
	case "event_msg":
		var payload struct {
			Type string                 `json:"type"`
			Info *codexSessionTokenInfo `json:"info"`
		}
		if err := json.Unmarshal(envelope.Payload, &payload); err != nil {
			return currentModel, previousTotals, "", nil, err
		}
		if payload.Type != "token_count" {
			return activeModel, activeTotals, "", nil, nil
		}
		delta, nextTotals := reduceCodexTokenUsageDelta(payload.Info, activeTotals)
		if nextTotals != nil {
			activeTotals = cloneCodexTokenUsage(nextTotals)
		}
		if delta == nil {
			return activeModel, activeTotals, "", nil, nil
		}

		minuteKey, err := normalizeMinuteTimestamp(envelope.Timestamp)
		if err != nil {
			return currentModel, previousTotals, "", nil, err
		}
		return activeModel, activeTotals, minuteKey, delta, nil
	default:
		return activeModel, activeTotals, "", nil, nil
	}
}

func normalizeMinuteTimestamp(raw string) (string, error) {
	parsed, err := time.Parse(time.RFC3339Nano, raw)
	if err != nil {
		return "", err
	}
	return parsed.UTC().Truncate(time.Minute).Format(time.RFC3339), nil
}

func normalizeSecondTimestamp(raw string) (string, error) {
	parsed, err := time.Parse(time.RFC3339Nano, raw)
	if err != nil {
		return "", err
	}
	return parsed.UTC().Truncate(time.Second).Format(time.RFC3339), nil
}

func parseLocalUsageDayWindow(dayKey string) (string, string, time.Time, error) {
	localDay, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(dayKey), time.Local)
	if err != nil {
		return "", "", time.Time{}, err
	}
	start := localDay.UTC().Format(time.RFC3339)
	end := localDay.AddDate(0, 0, 1).UTC().Format(time.RFC3339)
	return start, end, localDay, nil
}

func localUsageRolloutPathMatchesDates(relativePath string, dateKeys map[string]struct{}) bool {
	normalized := filepath.ToSlash(relativePath)
	for dateKey := range dateKeys {
		if strings.Contains(normalized, "sessions/"+dateKey+"/") {
			return true
		}
	}
	return false
}

func openLocalUsageIndexDB() (*sql.DB, error) {
	path, err := codexLocalUsageIndexPath()
	if err != nil {
		return nil, err
	}
	return sql.Open("sqlite", path)
}

func ensureLocalUsageIndexSchema(db *sql.DB) error {
	_, err := db.Exec(`
DROP TABLE IF EXISTS usage_details;

CREATE TABLE IF NOT EXISTS usage_entries (
  rollout_path TEXT PRIMARY KEY,
  absolute_path TEXT NOT NULL,
  modified_unix_ms INTEGER NOT NULL,
  size_bytes INTEGER NOT NULL,
  parsed_bytes INTEGER NOT NULL,
  last_model TEXT NOT NULL DEFAULT '',
  project_name TEXT NOT NULL DEFAULT '',
  previous_input_tokens INTEGER NOT NULL DEFAULT 0,
  previous_cached_tokens INTEGER NOT NULL DEFAULT 0,
  previous_output_tokens INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ` + localUsageMinutesTableName + ` (
  rollout_path TEXT NOT NULL,
  minute_start_timestamp TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  input_tokens INTEGER NOT NULL,
  cached_input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  request_count INTEGER NOT NULL,
  PRIMARY KEY (rollout_path, minute_start_timestamp, model)
);

CREATE INDEX IF NOT EXISTS idx_session_usage_minutes_rollout_timestamp
ON ` + localUsageMinutesTableName + ` (rollout_path, minute_start_timestamp);
`)
	if err != nil {
		return err
	}
	return ensureLocalUsageIndexColumn(db, "usage_entries", "project_name", "TEXT NOT NULL DEFAULT ''")
}

func ensureLocalUsageIndexColumn(db *sql.DB, table string, column string, definition string) error {
	_, err := db.Exec(`ALTER TABLE ` + table + ` ADD COLUMN ` + column + ` ` + definition)
	if err != nil && !strings.Contains(strings.ToLower(err.Error()), "duplicate column") {
		return err
	}
	return nil
}

func loadLocalUsageIndexEntry(db *sql.DB, rolloutPath string) (*localUsageIndexEntry, error) {
	row := db.QueryRow(`
SELECT rollout_path, absolute_path, modified_unix_ms, size_bytes, parsed_bytes, last_model, project_name,
       previous_input_tokens, previous_cached_tokens, previous_output_tokens
FROM usage_entries
WHERE rollout_path = ?`,
		rolloutPath,
	)

	var entry localUsageIndexEntry
	err := row.Scan(
		&entry.RolloutPath,
		&entry.AbsolutePath,
		&entry.ModifiedUnixMs,
		&entry.SizeBytes,
		&entry.ParsedBytes,
		&entry.LastModel,
		&entry.ProjectName,
		&entry.PreviousInputTokens,
		&entry.PreviousCachedTokens,
		&entry.PreviousOutputTokens,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &entry, nil
}

func loadLocalUsageDetails(db *sql.DB, rolloutPath string) ([]LocalProjectedUsageDetail, error) {
	rows, err := db.Query(`
SELECT minutes.minute_start_timestamp, minutes.model, minutes.input_tokens, minutes.cached_input_tokens,
       minutes.output_tokens, minutes.request_count, entries.project_name
FROM `+localUsageMinutesTableName+` AS minutes
JOIN usage_entries AS entries ON entries.rollout_path = minutes.rollout_path
WHERE minutes.rollout_path = ?
ORDER BY minutes.minute_start_timestamp ASC, minutes.model ASC`,
		rolloutPath,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	details := make([]LocalProjectedUsageDetail, 0, 8)
	for rows.Next() {
		var detail LocalProjectedUsageDetail
		if err := rows.Scan(
			&detail.Timestamp,
			&detail.Model,
			&detail.InputTokens,
			&detail.CachedInputTokens,
			&detail.OutputTokens,
			&detail.RequestCount,
			&detail.ProjectName,
		); err != nil {
			return nil, err
		}
		detail.Provider = localProjectedProvider
		detail.SourceKind = localProjectedSourceKind
		detail.SessionID = rolloutPath
		details = append(details, detail)
	}
	return details, rows.Err()
}

func loadAllLocalUsageDetails(db *sql.DB) ([]LocalProjectedUsageDetail, error) {
	rows, err := db.Query(`
SELECT minutes.rollout_path, minutes.minute_start_timestamp, minutes.model, minutes.input_tokens, minutes.cached_input_tokens,
       minutes.output_tokens, minutes.request_count, entries.project_name
FROM ` + localUsageMinutesTableName + ` AS minutes
JOIN usage_entries AS entries ON entries.rollout_path = minutes.rollout_path
ORDER BY minutes.minute_start_timestamp ASC, minutes.model ASC, minutes.rollout_path ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	details := make([]LocalProjectedUsageDetail, 0, 256)
	for rows.Next() {
		var detail LocalProjectedUsageDetail
		if err := rows.Scan(
			&detail.SessionID,
			&detail.Timestamp,
			&detail.Model,
			&detail.InputTokens,
			&detail.CachedInputTokens,
			&detail.OutputTokens,
			&detail.RequestCount,
			&detail.ProjectName,
		); err != nil {
			return nil, err
		}
		detail.Provider = localProjectedProvider
		detail.SourceKind = localProjectedSourceKind
		details = append(details, detail)
	}
	return details, rows.Err()
}

func loadLocalUsageRolloutPathsForWindow(db *sql.DB, startTimestamp string, endTimestamp string) ([]string, error) {
	rows, err := db.Query(`
SELECT DISTINCT rollout_path
FROM `+localUsageMinutesTableName+`
WHERE minute_start_timestamp >= ? AND minute_start_timestamp < ?
ORDER BY rollout_path ASC`,
		startTimestamp,
		endTimestamp,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rolloutPaths []string
	for rows.Next() {
		var rolloutPath string
		if err := rows.Scan(&rolloutPath); err != nil {
			return nil, err
		}
		rolloutPaths = append(rolloutPaths, rolloutPath)
	}
	return rolloutPaths, rows.Err()
}

func replaceLocalUsageEntry(db *sql.DB, rolloutPath string, absolutePath string, modifiedUnixMs int64, sizeBytes int64, parseResult *localUsageParseResult) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if err := replaceLocalUsageMinutes(tx, rolloutPath, parseResult.MinuteBuckets); err != nil {
		return err
	}
	if _, err := tx.Exec(`
INSERT INTO usage_entries (
  rollout_path, absolute_path, modified_unix_ms, size_bytes, parsed_bytes, last_model,
  project_name, previous_input_tokens, previous_cached_tokens, previous_output_tokens
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(rollout_path) DO UPDATE SET
  absolute_path = excluded.absolute_path,
  modified_unix_ms = excluded.modified_unix_ms,
  size_bytes = excluded.size_bytes,
  parsed_bytes = excluded.parsed_bytes,
  last_model = excluded.last_model,
  project_name = excluded.project_name,
  previous_input_tokens = excluded.previous_input_tokens,
  previous_cached_tokens = excluded.previous_cached_tokens,
  previous_output_tokens = excluded.previous_output_tokens`,
		rolloutPath,
		absolutePath,
		modifiedUnixMs,
		sizeBytes,
		parseResult.ParsedBytes,
		parseResult.LastModel,
		parseResult.ProjectName,
		tokenUsageField(parseResult.PreviousTotals, func(v *codexTokenUsage) int64 { return v.InputTokens }),
		tokenUsageField(parseResult.PreviousTotals, func(v *codexTokenUsage) int64 { return v.CachedInputTokens }),
		tokenUsageField(parseResult.PreviousTotals, func(v *codexTokenUsage) int64 { return v.OutputTokens }),
	); err != nil {
		return err
	}

	return tx.Commit()
}

func appendLocalUsageEntry(db *sql.DB, rolloutPath string, absolutePath string, modifiedUnixMs int64, sizeBytes int64, parseResult *localUsageParseResult) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if err := appendLocalUsageMinutes(tx, rolloutPath, parseResult.MinuteBuckets); err != nil {
		return err
	}
	if _, err := tx.Exec(`
UPDATE usage_entries
SET absolute_path = ?, modified_unix_ms = ?, size_bytes = ?, parsed_bytes = ?, last_model = ?, project_name = ?,
    previous_input_tokens = ?, previous_cached_tokens = ?, previous_output_tokens = ?
WHERE rollout_path = ?`,
		absolutePath,
		modifiedUnixMs,
		sizeBytes,
		parseResult.ParsedBytes,
		parseResult.LastModel,
		parseResult.ProjectName,
		tokenUsageField(parseResult.PreviousTotals, func(v *codexTokenUsage) int64 { return v.InputTokens }),
		tokenUsageField(parseResult.PreviousTotals, func(v *codexTokenUsage) int64 { return v.CachedInputTokens }),
		tokenUsageField(parseResult.PreviousTotals, func(v *codexTokenUsage) int64 { return v.OutputTokens }),
		rolloutPath,
	); err != nil {
		return err
	}

	return tx.Commit()
}

func updateLocalUsageEntryProjectName(db *sql.DB, rolloutPath string, projectName string) error {
	_, err := db.Exec(`UPDATE usage_entries SET project_name = ? WHERE rollout_path = ?`, projectName, rolloutPath)
	return err
}

func replaceLocalUsageMinutes(tx *sql.Tx, rolloutPath string, minuteBuckets map[localUsageMinuteBucketKey]codexTokenUsageMinute) error {
	if _, err := tx.Exec(`DELETE FROM `+localUsageMinutesTableName+` WHERE rollout_path = ?`, rolloutPath); err != nil {
		return err
	}
	return appendLocalUsageMinutes(tx, rolloutPath, minuteBuckets)
}

func appendLocalUsageMinutes(tx *sql.Tx, rolloutPath string, minuteBuckets map[localUsageMinuteBucketKey]codexTokenUsageMinute) error {
	stmt, err := tx.Prepare(`
INSERT INTO ` + localUsageMinutesTableName + ` (
  rollout_path, minute_start_timestamp, model, input_tokens, cached_input_tokens, output_tokens, request_count
) VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(rollout_path, minute_start_timestamp, model) DO UPDATE SET
  input_tokens = ` + localUsageMinutesTableName + `.input_tokens + excluded.input_tokens,
  cached_input_tokens = ` + localUsageMinutesTableName + `.cached_input_tokens + excluded.cached_input_tokens,
  output_tokens = ` + localUsageMinutesTableName + `.output_tokens + excluded.output_tokens,
  request_count = ` + localUsageMinutesTableName + `.request_count + excluded.request_count`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	minuteKeys := make([]localUsageMinuteBucketKey, 0, len(minuteBuckets))
	for minuteKey := range minuteBuckets {
		minuteKeys = append(minuteKeys, minuteKey)
	}
	sort.Slice(minuteKeys, func(i, j int) bool {
		if minuteKeys[i].MinuteStartTimestamp == minuteKeys[j].MinuteStartTimestamp {
			return minuteKeys[i].Model < minuteKeys[j].Model
		}
		return minuteKeys[i].MinuteStartTimestamp < minuteKeys[j].MinuteStartTimestamp
	})

	for _, minuteKey := range minuteKeys {
		bucket := minuteBuckets[minuteKey]
		if _, err := stmt.Exec(
			rolloutPath,
			minuteKey.MinuteStartTimestamp,
			bucket.Model,
			bucket.InputTokens,
			bucket.CachedInputTokens,
			bucket.OutputTokens,
			bucket.RequestCount,
		); err != nil {
			return err
		}
	}
	return nil
}

func deleteLocalUsageEntry(db *sql.DB, rolloutPath string) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.Exec(`DELETE FROM `+localUsageMinutesTableName+` WHERE rollout_path = ?`, rolloutPath); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM usage_entries WHERE rollout_path = ?`, rolloutPath); err != nil {
		return err
	}
	return tx.Commit()
}

func clearLocalUsageIndex(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.Exec(`DELETE FROM ` + localUsageMinutesTableName); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM usage_entries`); err != nil {
		return err
	}
	return tx.Commit()
}

func purgeMissingLocalUsageEntries(db *sql.DB, currentRolloutPaths map[string]struct{}) (int, error) {
	rows, err := db.Query(`SELECT rollout_path FROM usage_entries`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var stale []string
	for rows.Next() {
		var rolloutPath string
		if err := rows.Scan(&rolloutPath); err != nil {
			return 0, err
		}
		if _, ok := currentRolloutPaths[rolloutPath]; !ok {
			stale = append(stale, rolloutPath)
		}
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	for _, rolloutPath := range stale {
		if err := deleteLocalUsageEntry(db, rolloutPath); err != nil {
			return 0, err
		}
	}
	return len(stale), nil
}

func codexLocalUsageIndexPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".config", "gettokens-data", localUsageIndexDirName)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}
	return filepath.Join(dir, localUsageIndexFileName), nil
}

func tokenUsageField(value *codexTokenUsage, read func(*codexTokenUsage) int64) int64 {
	if value == nil {
		return 0
	}
	return read(value)
}

func cloneCodexTokenUsage(value *codexTokenUsage) *codexTokenUsage {
	if value == nil {
		return nil
	}
	cloned := *value
	return &cloned
}

func reduceCodexTokenUsageDelta(info *codexSessionTokenInfo, previousTotals *codexTokenUsage) (*codexTokenUsage, *codexTokenUsage) {
	if info == nil {
		return nil, previousTotals
	}

	if info.TotalTokenUsage != nil {
		current := clampCodexTokenUsage(*info.TotalTokenUsage)
		if previousTotals == nil {
			if isZeroCodexTokenUsage(current) {
				return nil, &current
			}
			return &current, &current
		}

		delta := codexTokenUsage{
			InputTokens:       current.InputTokens - previousTotals.InputTokens,
			CachedInputTokens: current.CachedInputTokens - previousTotals.CachedInputTokens,
			OutputTokens:      current.OutputTokens - previousTotals.OutputTokens,
		}
		if delta.InputTokens < 0 || delta.CachedInputTokens < 0 || delta.OutputTokens < 0 {
			if info.LastTokenUsage != nil {
				last := clampCodexTokenUsage(*info.LastTokenUsage)
				if isZeroCodexTokenUsage(last) {
					return nil, &current
				}
				return &last, &current
			}
			return nil, &current
		}

		delta = clampCodexTokenUsage(delta)
		if isZeroCodexTokenUsage(delta) {
			return nil, &current
		}
		return &delta, &current
	}

	if info.LastTokenUsage != nil {
		last := clampCodexTokenUsage(*info.LastTokenUsage)
		if isZeroCodexTokenUsage(last) {
			return nil, previousTotals
		}
		return &last, previousTotals
	}

	return nil, previousTotals
}

func clampCodexTokenUsage(value codexTokenUsage) codexTokenUsage {
	if value.InputTokens < 0 {
		value.InputTokens = 0
	}
	if value.CachedInputTokens < 0 {
		value.CachedInputTokens = 0
	}
	if value.OutputTokens < 0 {
		value.OutputTokens = 0
	}
	if value.CachedInputTokens > value.InputTokens {
		value.CachedInputTokens = value.InputTokens
	}
	return value
}

func isZeroCodexTokenUsage(value codexTokenUsage) bool {
	return value.InputTokens == 0 && value.CachedInputTokens == 0 && value.OutputTokens == 0
}
