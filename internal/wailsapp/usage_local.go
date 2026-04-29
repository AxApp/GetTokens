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
	localProjectedProvider      = "codex"
	localProjectedSourceKind    = "local_projected"
	localUsageIndexDirName      = "codex-local-usage"
	localUsageIndexFileName     = "usage-index-v1.sqlite"
	localUsageSourceCacheHit    = "cacheHit"
	localUsageSourceDeltaAppend = "deltaAppend"
	localUsageSourceFullRebuild = "fullRebuild"
	localUsageSourceFileMissing = "fileMissing"
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
	InputTokens       int64
	CachedInputTokens int64
	OutputTokens      int64
	RequestCount      int64
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
	MinuteBuckets  map[string]codexTokenUsageMinute
	LastModel      string
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
	PreviousInputTokens  int64
	PreviousCachedTokens int64
	PreviousOutputTokens int64
}

func (a *App) emitLocalUsageProgress(progress LocalProjectedUsageProgress) {
	if a.ctx == nil {
		return
	}
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
	if cached := a.readCachedLocalUsageResponse(); cached != nil {
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

func (a *App) readCachedLocalUsageResponse() *LocalProjectedUsageResponse {
	a.localUsageMu.RLock()
	defer a.localUsageMu.RUnlock()
	return cloneLocalProjectedUsageResponse(a.localUsage.cachedResponse)
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
				if !a.shouldRunScheduledLocalUsageRefresh(time.Now()) {
					continue
				}
				if _, err := a.refreshCodexLocalUsage(false, true); err != nil {
					log.Printf("scheduled local usage refresh failed: %v", err)
				}
			}
		}
	}()
}

func (a *App) shouldRunScheduledLocalUsageRefresh(now time.Time) bool {
	a.localUsageMu.RLock()
	cachedResponse := a.localUsage.cachedResponse
	lastRefreshAt := a.localUsage.lastRefreshAt
	refreshRunning := a.localUsage.refreshRunning
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

func collectCodexLocalUsageDetailsFromHome(codexHome string) ([]LocalProjectedUsageDetail, int, error) {
	snapshot, err := (&App{}).collectCodexLocalUsageSnapshotFromHome(codexHome, false)
	if err != nil {
		return nil, 0, err
	}
	return snapshot.Details, snapshot.ScannedFiles, nil
}

func (a *App) collectCodexLocalUsageSnapshotFromHome(codexHome string, forceRebuild bool) (*localUsageSnapshot, error) {
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
			return nil, err
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
			return nil, err
		}
	}
	if !foundAnyRoot {
		return &localUsageSnapshot{}, nil
	}

	sort.Strings(rolloutPaths)

	a.emitLocalUsageProgress(LocalProjectedUsageProgress{
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

		a.emitLocalUsageProgress(LocalProjectedUsageProgress{
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
			return snapshot.Details[i].InputTokens+snapshot.Details[i].OutputTokens < snapshot.Details[j].InputTokens+snapshot.Details[j].OutputTokens
		}
		return snapshot.Details[i].Timestamp < snapshot.Details[j].Timestamp
	})

	a.emitLocalUsageProgress(LocalProjectedUsageProgress{
		Phase:          "finished",
		ProcessedFiles: len(rolloutPaths),
		TotalFiles:     len(rolloutPaths),
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
		return details, localUsageSourceCacheHit, nil
	case cached != nil && canUseLocalUsageDeltaAppend(*cached, absolutePath, modifiedUnixMs, sizeBytes):
		parseResult, err := parseCodexLocalUsageFile(
			absolutePath,
			cached.ParsedBytes,
			cached.LastModel,
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
		parseResult, err := parseCodexLocalUsageFile(absolutePath, 0, "", nil)
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

func parseCodexLocalUsageFile(path string, offset int64, currentModel string, previousTotals *codexTokenUsage) (*localUsageParseResult, error) {
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

	result, err := parseCodexLocalUsageStream(file, currentModel, previousTotals)
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

func parseCodexLocalUsageStream(reader io.Reader, currentModel string, previousTotals *codexTokenUsage) (*localUsageParseResult, error) {
	minuteBuckets := make(map[string]codexTokenUsageMinute)
	activeModel := currentModel
	activeTotals := cloneCodexTokenUsage(previousTotals)

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

			nextModel, nextTotals, minuteKey, delta, parseErr := parseCodexLocalUsageLine(line, activeModel, activeTotals)
			if parseErr != nil {
				return nil, parseErr
			}
			activeModel = nextModel
			activeTotals = nextTotals
			if delta != nil {
				bucket := minuteBuckets[minuteKey]
				bucket.InputTokens += delta.InputTokens
				bucket.CachedInputTokens += delta.CachedInputTokens
				bucket.OutputTokens += delta.OutputTokens
				bucket.RequestCount += 1
				minuteBuckets[minuteKey] = bucket
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
		PreviousTotals: activeTotals,
	}, nil
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
  previous_input_tokens INTEGER NOT NULL DEFAULT 0,
  previous_cached_tokens INTEGER NOT NULL DEFAULT 0,
  previous_output_tokens INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS session_usage_minutes (
  rollout_path TEXT NOT NULL,
  minute_start_timestamp TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  cached_input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  request_count INTEGER NOT NULL,
  PRIMARY KEY (rollout_path, minute_start_timestamp)
);

CREATE INDEX IF NOT EXISTS idx_session_usage_minutes_rollout_timestamp
ON session_usage_minutes (rollout_path, minute_start_timestamp);
`)
	return err
}

func loadLocalUsageIndexEntry(db *sql.DB, rolloutPath string) (*localUsageIndexEntry, error) {
	row := db.QueryRow(`
SELECT rollout_path, absolute_path, modified_unix_ms, size_bytes, parsed_bytes, last_model,
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
SELECT minute_start_timestamp, input_tokens, cached_input_tokens, output_tokens, request_count
FROM session_usage_minutes
WHERE rollout_path = ?
ORDER BY minute_start_timestamp ASC`,
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
			&detail.InputTokens,
			&detail.CachedInputTokens,
			&detail.OutputTokens,
			&detail.RequestCount,
		); err != nil {
			return nil, err
		}
		detail.Provider = localProjectedProvider
		detail.SourceKind = localProjectedSourceKind
		details = append(details, detail)
	}
	return details, rows.Err()
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
  previous_input_tokens, previous_cached_tokens, previous_output_tokens
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(rollout_path) DO UPDATE SET
  absolute_path = excluded.absolute_path,
  modified_unix_ms = excluded.modified_unix_ms,
  size_bytes = excluded.size_bytes,
  parsed_bytes = excluded.parsed_bytes,
  last_model = excluded.last_model,
  previous_input_tokens = excluded.previous_input_tokens,
  previous_cached_tokens = excluded.previous_cached_tokens,
  previous_output_tokens = excluded.previous_output_tokens`,
		rolloutPath,
		absolutePath,
		modifiedUnixMs,
		sizeBytes,
		parseResult.ParsedBytes,
		parseResult.LastModel,
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
SET absolute_path = ?, modified_unix_ms = ?, size_bytes = ?, parsed_bytes = ?, last_model = ?,
    previous_input_tokens = ?, previous_cached_tokens = ?, previous_output_tokens = ?
WHERE rollout_path = ?`,
		absolutePath,
		modifiedUnixMs,
		sizeBytes,
		parseResult.ParsedBytes,
		parseResult.LastModel,
		tokenUsageField(parseResult.PreviousTotals, func(v *codexTokenUsage) int64 { return v.InputTokens }),
		tokenUsageField(parseResult.PreviousTotals, func(v *codexTokenUsage) int64 { return v.CachedInputTokens }),
		tokenUsageField(parseResult.PreviousTotals, func(v *codexTokenUsage) int64 { return v.OutputTokens }),
		rolloutPath,
	); err != nil {
		return err
	}

	return tx.Commit()
}

func replaceLocalUsageMinutes(tx *sql.Tx, rolloutPath string, minuteBuckets map[string]codexTokenUsageMinute) error {
	if _, err := tx.Exec(`DELETE FROM session_usage_minutes WHERE rollout_path = ?`, rolloutPath); err != nil {
		return err
	}
	return appendLocalUsageMinutes(tx, rolloutPath, minuteBuckets)
}

func appendLocalUsageMinutes(tx *sql.Tx, rolloutPath string, minuteBuckets map[string]codexTokenUsageMinute) error {
	stmt, err := tx.Prepare(`
INSERT INTO session_usage_minutes (
  rollout_path, minute_start_timestamp, input_tokens, cached_input_tokens, output_tokens, request_count
) VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(rollout_path, minute_start_timestamp) DO UPDATE SET
  input_tokens = session_usage_minutes.input_tokens + excluded.input_tokens,
  cached_input_tokens = session_usage_minutes.cached_input_tokens + excluded.cached_input_tokens,
  output_tokens = session_usage_minutes.output_tokens + excluded.output_tokens,
  request_count = session_usage_minutes.request_count + excluded.request_count`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	minuteKeys := make([]string, 0, len(minuteBuckets))
	for minuteKey := range minuteBuckets {
		minuteKeys = append(minuteKeys, minuteKey)
	}
	sort.Strings(minuteKeys)

	for _, minuteKey := range minuteKeys {
		bucket := minuteBuckets[minuteKey]
		if _, err := stmt.Exec(
			rolloutPath,
			minuteKey,
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

	if _, err := tx.Exec(`DELETE FROM session_usage_minutes WHERE rollout_path = ?`, rolloutPath); err != nil {
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

	if _, err := tx.Exec(`DELETE FROM session_usage_minutes`); err != nil {
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
