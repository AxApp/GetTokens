package protocolbridge

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
)

type JSONLAuditSink struct {
	path string
	mu   sync.Mutex
}

func NewJSONLAuditSink(path string) (*JSONLAuditSink, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, fmt.Errorf("audit JSONL path is required")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, fmt.Errorf("create audit JSONL directory: %w", err)
	}
	return &JSONLAuditSink{path: path}, nil
}

type AuditKind string

const (
	AuditKindRead       AuditKind = "read"
	AuditKindSafeAction AuditKind = "safe_action"
)

type JSONLAuditQuery struct {
	Limit  int
	Offset int
	Cursor string
	Kind   AuditKind
	Status Status
}

type JSONLAuditQueryResult struct {
	Events       []AuditEvent
	SkippedLines int
	Offset       int
	NextCursor   string
	HasMore      bool
}

type JSONLAuditReader struct {
	path string
}

func NewJSONLAuditReader(path string) (*JSONLAuditReader, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, fmt.Errorf("audit JSONL path is required")
	}
	return &JSONLAuditReader{path: path}, nil
}

func (s *JSONLAuditSink) Persist(ctx context.Context, event AuditEvent) error {
	if s == nil {
		return nil
	}
	if ctx == nil {
		ctx = context.Background()
	}
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	event = sanitizeAuditEventForPersistence(event)
	raw, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal audit event: %w", err)
	}
	raw = append(raw, '\n')

	s.mu.Lock()
	defer s.mu.Unlock()
	file, err := os.OpenFile(s.path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return fmt.Errorf("open audit JSONL: %w", err)
	}
	defer file.Close()
	if _, err := file.Write(raw); err != nil {
		return fmt.Errorf("write audit JSONL: %w", err)
	}
	return nil
}

func (r *JSONLAuditReader) Query(ctx context.Context, query JSONLAuditQuery) (JSONLAuditQueryResult, error) {
	if r == nil {
		return JSONLAuditQueryResult{}, fmt.Errorf("audit JSONL reader is not configured")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	if query.Limit < 0 {
		return JSONLAuditQueryResult{}, fmt.Errorf("audit JSONL query limit must be non-negative")
	}
	offset, err := auditQueryOffset(query)
	if err != nil {
		return JSONLAuditQueryResult{}, err
	}
	if err := validateAuditQuery(query); err != nil {
		return JSONLAuditQueryResult{}, err
	}

	file, err := os.Open(r.path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return JSONLAuditQueryResult{Events: []AuditEvent{}, Offset: offset}, nil
		}
		return JSONLAuditQueryResult{}, fmt.Errorf("open audit JSONL: %w", err)
	}
	defer file.Close()

	var result JSONLAuditQueryResult
	result.Offset = offset
	var matched []AuditEvent
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return JSONLAuditQueryResult{}, ctx.Err()
		default:
		}
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var event AuditEvent
		if err := json.Unmarshal([]byte(line), &event); err != nil {
			result.SkippedLines++
			continue
		}
		event = sanitizeAuditEventForPersistence(event)
		if auditEventMatchesQuery(event, query) {
			matched = append(matched, event)
		}
	}
	if err := scanner.Err(); err != nil {
		return JSONLAuditQueryResult{}, fmt.Errorf("scan audit JSONL: %w", err)
	}

	latestFirst := make([]AuditEvent, 0, len(matched))
	for i := len(matched) - 1; i >= 0; i-- {
		latestFirst = append(latestFirst, matched[i])
	}
	if offset < len(latestFirst) {
		end := len(latestFirst)
		if query.Limit > 0 && offset+query.Limit < end {
			end = offset + query.Limit
		}
		result.Events = append(result.Events, latestFirst[offset:end]...)
		if query.Limit > 0 && end < len(latestFirst) {
			result.HasMore = true
			result.NextCursor = auditCursor(end)
		}
	}
	if result.Events == nil {
		result.Events = []AuditEvent{}
	}
	return result, nil
}

const auditCursorPrefix = "pb-audit-v1:"

func auditCursor(offset int) string {
	return auditCursorPrefix + strconv.Itoa(offset)
}

func auditQueryOffset(query JSONLAuditQuery) (int, error) {
	if query.Offset < 0 {
		return 0, fmt.Errorf("audit JSONL query offset must be non-negative")
	}
	cursor := strings.TrimSpace(query.Cursor)
	if cursor == "" {
		return query.Offset, nil
	}
	if query.Offset != 0 {
		return 0, fmt.Errorf("audit JSONL query must not set both cursor and offset")
	}
	if !strings.HasPrefix(cursor, auditCursorPrefix) {
		return 0, fmt.Errorf("audit JSONL query cursor is invalid")
	}
	rawOffset := strings.TrimPrefix(cursor, auditCursorPrefix)
	if rawOffset == "" {
		return 0, fmt.Errorf("audit JSONL query cursor is invalid")
	}
	offset, err := strconv.Atoi(rawOffset)
	if err != nil || offset < 0 {
		return 0, fmt.Errorf("audit JSONL query cursor is invalid")
	}
	return offset, nil
}

func sanitizeAuditEventForPersistence(event AuditEvent) AuditEvent {
	event.TargetRefs = sanitizeAuditTargetRefs(event.TargetRefs)
	event.Authority.Endpoint = sanitizeAuditText(event.Authority.Endpoint)
	for i := range event.Authority.SourceNotes {
		event.Authority.SourceNotes[i].Field = sanitizeAuditText(event.Authority.SourceNotes[i].Field)
		event.Authority.SourceNotes[i].Source = sanitizeAuditText(event.Authority.SourceNotes[i].Source)
		event.Authority.SourceNotes[i].Note = sanitizeAuditText(event.Authority.SourceNotes[i].Note)
	}
	return event
}

func validateAuditQuery(query JSONLAuditQuery) error {
	switch query.Kind {
	case "", AuditKindRead, AuditKindSafeAction:
	default:
		return fmt.Errorf("unsupported audit JSONL kind filter %q", query.Kind)
	}
	switch query.Status {
	case "", StatusOK, StatusAccepted, StatusRejected:
	default:
		return fmt.Errorf("unsupported audit JSONL status filter %q", query.Status)
	}
	return nil
}

func auditEventMatchesQuery(event AuditEvent, query JSONLAuditQuery) bool {
	if query.Status != "" && event.ResultStatus != query.Status {
		return false
	}
	if query.Kind != "" && auditEventKind(event) != query.Kind {
		return false
	}
	return true
}

func auditEventKind(event AuditEvent) AuditKind {
	spec, ok := operationSpecs[event.Operation]
	if !ok {
		return ""
	}
	switch spec.Type {
	case "read":
		return AuditKindRead
	case "safe_action":
		return AuditKindSafeAction
	default:
		return ""
	}
}

func sanitizeAuditTargetRefs(refs []string) []string {
	if len(refs) == 0 {
		return nil
	}
	sanitized := make([]string, 0, len(refs))
	for _, ref := range refs {
		ref = strings.TrimSpace(ref)
		if ref == "" {
			continue
		}
		if auditTextLooksUnsafe(ref) || strings.Contains(ref, "://") || strings.Contains(ref, "?") {
			sanitized = append(sanitized, "redacted-target-ref")
			continue
		}
		sanitized = append(sanitized, ref)
	}
	return sanitized
}

func sanitizeAuditText(text string) string {
	text = strings.TrimSpace(text)
	if text == "" {
		return ""
	}
	if auditTextLooksUnsafe(text) {
		return "redacted"
	}
	redacted := redactSidecarText(text)
	if redacted == "" || auditTextLooksUnsafe(redacted) {
		return "redacted"
	}
	return redacted
}

func auditTextLooksUnsafe(text string) bool {
	lower := strings.ToLower(text)
	if containsCredentialBearingText(text) {
		return true
	}
	for _, fragment := range []string{
		"authorization",
		"cookie",
		"api_key",
		"access_token",
		"refresh_token",
		"id_token",
		"bearer ",
		"query=",
	} {
		if strings.Contains(lower, fragment) {
			return true
		}
	}
	return false
}
