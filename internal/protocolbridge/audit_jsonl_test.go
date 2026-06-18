package protocolbridge

import (
	"bufio"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestJSONLAuditSinkPersistsRedactedEvents(t *testing.T) {
	path := filepath.Join(t.TempDir(), "bridge-audit.jsonl")
	sink, err := NewJSONLAuditSink(path)
	if err != nil {
		t.Fatalf("new JSONL audit sink: %v", err)
	}

	event := AuditEvent{
		AuditID:               "bra_jsonl_001",
		TimestampUnixMs:       1781587320000,
		RequestID:             "req_jsonl_001",
		Transport:             TransportMCP,
		ClientID:              "mcp-audit-agent",
		AuthSubjectHashPrefix: "abcdef12",
		Scopes:                []Scope{ScopeAccountsRead},
		Operation:             OperationAccountsSummary,
		TargetRefs: []string{
			"acct_codex_001",
			"gettokens://bridge/manifest?query=raw-query&authorization=Bearer should-not-leak",
		},
		Authority: Authority{
			Owner:             AuthorityOwnerSidecar,
			Endpoint:          "/v0/management/gettokens/accounts/summary",
			GeneratedAtUnixMs: 1781587320000,
			SourceNotes: []SourceNote{{
				Field:  "headers.Authorization",
				Source: "Cookie: secret-cookie",
				Note:   "query raw-query Authorization: Bearer should-not-leak api_key=raw-api-key",
			}},
		},
		ResultStatus:     StatusOK,
		SidecarRequestID: "scr_jsonl_001",
		DurationMs:       12,
		RedactionVersion: "bridge-redaction-v1",
	}

	if err := sink.Persist(context.Background(), event); err != nil {
		t.Fatalf("persist audit event: %v", err)
	}

	raw := readAuditJSONL(t, path)
	assertAuditJSONLDoesNotLeak(t, raw)
	if !strings.Contains(raw, `"audit_id":"bra_jsonl_001"`) {
		t.Fatalf("expected audit id to be persisted, got %s", raw)
	}
	if !strings.Contains(raw, `"redaction_version":"bridge-redaction-v1"`) {
		t.Fatalf("expected redaction version to be persisted, got %s", raw)
	}

	var persisted AuditEvent
	if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &persisted); err != nil {
		t.Fatalf("audit JSONL line should decode as AuditEvent: %v", err)
	}
	if len(persisted.TargetRefs) != 2 || persisted.TargetRefs[0] != "acct_codex_001" || persisted.TargetRefs[1] != "redacted-target-ref" {
		t.Fatalf("unexpected sanitized target refs: %#v", persisted.TargetRefs)
	}
	if persisted.Authority.SourceNotes[0].Field != "redacted" || persisted.Authority.SourceNotes[0].Source != "redacted" || persisted.Authority.SourceNotes[0].Note != "redacted" {
		t.Fatalf("unexpected sanitized source notes: %#v", persisted.Authority.SourceNotes)
	}
}

func TestJSONLAuditSinkAppendsMultipleEvents(t *testing.T) {
	path := filepath.Join(t.TempDir(), "bridge-audit.jsonl")
	sink, err := NewJSONLAuditSink(path)
	if err != nil {
		t.Fatalf("new JSONL audit sink: %v", err)
	}

	for _, id := range []string{"bra_jsonl_append_001", "bra_jsonl_append_002"} {
		if err := sink.Persist(context.Background(), AuditEvent{
			AuditID:          id,
			RequestID:        "req_" + id,
			Transport:        TransportMCP,
			Operation:        OperationQuotaSummary,
			ResultStatus:     StatusRejected,
			ErrorCode:        ErrorInvalidRequest,
			RedactionVersion: "bridge-redaction-v1",
		}); err != nil {
			t.Fatalf("persist %s: %v", id, err)
		}
	}

	file, err := os.Open(path)
	if err != nil {
		t.Fatalf("open audit JSONL: %v", err)
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	var count int
	for scanner.Scan() {
		count++
		var event AuditEvent
		if err := json.Unmarshal(scanner.Bytes(), &event); err != nil {
			t.Fatalf("line %d should decode: %v", count, err)
		}
	}
	if err := scanner.Err(); err != nil {
		t.Fatalf("scan audit JSONL: %v", err)
	}
	if count != 2 {
		t.Fatalf("expected 2 JSONL audit lines, got %d", count)
	}
}

func TestJSONLAuditReaderQueriesByStatusKindAndLimit(t *testing.T) {
	path := filepath.Join(t.TempDir(), "bridge-audit.jsonl")
	sink, err := NewJSONLAuditSink(path)
	if err != nil {
		t.Fatalf("new JSONL audit sink: %v", err)
	}
	events := []AuditEvent{
		{
			AuditID:          "bra_query_old_rejected_read",
			RequestID:        "req_query_001",
			Transport:        TransportMCP,
			Operation:        OperationAccountsSummary,
			ResultStatus:     StatusRejected,
			ErrorCode:        ErrorInvalidRequest,
			TargetRefs:       []string{"acct_codex_001"},
			RedactionVersion: "bridge-redaction-v1",
		},
		{
			AuditID:          "bra_query_accepted_action",
			RequestID:        "req_query_002",
			Transport:        TransportMCP,
			Operation:        OperationActionRouteabilityRecheck,
			ResultStatus:     StatusAccepted,
			TargetRefs:       []string{"routeability-recheck"},
			RedactionVersion: "bridge-redaction-v1",
		},
		{
			AuditID:          "bra_query_latest_rejected_read",
			RequestID:        "req_query_003",
			Transport:        TransportMCP,
			Operation:        OperationQuotaSummary,
			ResultStatus:     StatusRejected,
			ErrorCode:        ErrorSidecarUnavailable,
			TargetRefs:       []string{"gettokens://bridge/manifest?query=raw-query&authorization=Bearer should-not-leak"},
			RedactionVersion: "bridge-redaction-v1",
		},
	}
	for _, event := range events {
		if err := sink.Persist(context.Background(), event); err != nil {
			t.Fatalf("persist %s: %v", event.AuditID, err)
		}
	}

	reader, err := NewJSONLAuditReader(path)
	if err != nil {
		t.Fatalf("new JSONL audit reader: %v", err)
	}
	result, err := reader.Query(context.Background(), JSONLAuditQuery{
		Limit:  1,
		Kind:   AuditKindRead,
		Status: StatusRejected,
	})
	if err != nil {
		t.Fatalf("query audit JSONL: %v", err)
	}
	if result.SkippedLines != 0 {
		t.Fatalf("unexpected skipped lines: %d", result.SkippedLines)
	}
	if len(result.Events) != 1 {
		t.Fatalf("expected one filtered event, got %#v", result.Events)
	}
	if result.Events[0].AuditID != "bra_query_latest_rejected_read" {
		t.Fatalf("expected latest matching event first, got %#v", result.Events[0])
	}
	raw, err := json.Marshal(result.Events)
	if err != nil {
		t.Fatalf("marshal query events: %v", err)
	}
	assertAuditJSONLDoesNotLeak(t, string(raw))
}

func TestJSONLAuditReaderPaginatesByOffsetAndCursor(t *testing.T) {
	path := filepath.Join(t.TempDir(), "bridge-audit.jsonl")
	sink, err := NewJSONLAuditSink(path)
	if err != nil {
		t.Fatalf("new JSONL audit sink: %v", err)
	}
	for _, id := range []string{
		"bra_page_oldest",
		"bra_page_middle_old",
		"bra_page_middle_new",
		"bra_page_latest",
	} {
		if err := sink.Persist(context.Background(), AuditEvent{
			AuditID:          id,
			RequestID:        "req_" + id,
			Transport:        TransportMCP,
			Operation:        OperationAccountsSummary,
			ResultStatus:     StatusOK,
			RedactionVersion: "bridge-redaction-v1",
		}); err != nil {
			t.Fatalf("persist %s: %v", id, err)
		}
	}

	reader, err := NewJSONLAuditReader(path)
	if err != nil {
		t.Fatalf("new JSONL audit reader: %v", err)
	}
	firstPage, err := reader.Query(context.Background(), JSONLAuditQuery{
		Limit:  2,
		Kind:   AuditKindRead,
		Status: StatusOK,
	})
	if err != nil {
		t.Fatalf("query first audit page: %v", err)
	}
	if firstPage.Offset != 0 || !firstPage.HasMore || firstPage.NextCursor != "pb-audit-v1:2" {
		t.Fatalf("unexpected first page metadata: %#v", firstPage)
	}
	if got := auditIDs(firstPage.Events); strings.Join(got, ",") != "bra_page_latest,bra_page_middle_new" {
		t.Fatalf("unexpected first page events: %#v", got)
	}

	offsetPage, err := reader.Query(context.Background(), JSONLAuditQuery{
		Limit:  2,
		Offset: 2,
		Kind:   AuditKindRead,
		Status: StatusOK,
	})
	if err != nil {
		t.Fatalf("query offset audit page: %v", err)
	}
	if offsetPage.Offset != 2 || offsetPage.HasMore || offsetPage.NextCursor != "" {
		t.Fatalf("unexpected offset page metadata: %#v", offsetPage)
	}
	if got := auditIDs(offsetPage.Events); strings.Join(got, ",") != "bra_page_middle_old,bra_page_oldest" {
		t.Fatalf("unexpected offset page events: %#v", got)
	}

	cursorPage, err := reader.Query(context.Background(), JSONLAuditQuery{
		Limit:  2,
		Cursor: firstPage.NextCursor,
		Kind:   AuditKindRead,
		Status: StatusOK,
	})
	if err != nil {
		t.Fatalf("query cursor audit page: %v", err)
	}
	if strings.Join(auditIDs(cursorPage.Events), ",") != strings.Join(auditIDs(offsetPage.Events), ",") {
		t.Fatalf("cursor page does not match offset page: cursor=%#v offset=%#v", cursorPage.Events, offsetPage.Events)
	}
}

func TestJSONLAuditReaderRejectsInvalidPagination(t *testing.T) {
	reader, err := NewJSONLAuditReader(filepath.Join(t.TempDir(), "bridge-audit.jsonl"))
	if err != nil {
		t.Fatalf("new JSONL audit reader: %v", err)
	}
	for _, query := range []JSONLAuditQuery{
		{Offset: -1},
		{Cursor: "2"},
		{Cursor: "pb-audit-v1:-1"},
		{Cursor: "pb-audit-v2:1"},
		{Cursor: "pb-list-v1:tools:1"},
		{Cursor: "not-a-cursor"},
		{Offset: 1, Cursor: "pb-audit-v1:1"},
	} {
		if _, err := reader.Query(context.Background(), query); err == nil {
			t.Fatalf("expected invalid pagination query to fail: %#v", query)
		}
	}
}

func TestJSONLAuditReaderSkipsMalformedLines(t *testing.T) {
	path := filepath.Join(t.TempDir(), "bridge-audit.jsonl")
	if err := os.WriteFile(path, []byte("{malformed Authorization: Bearer should-not-leak}\n"), 0o600); err != nil {
		t.Fatalf("write malformed JSONL line: %v", err)
	}
	sink, err := NewJSONLAuditSink(path)
	if err != nil {
		t.Fatalf("new JSONL audit sink: %v", err)
	}
	if err := sink.Persist(context.Background(), AuditEvent{
		AuditID:          "bra_query_after_malformed",
		RequestID:        "req_query_after_malformed",
		Transport:        TransportMCP,
		Operation:        OperationModelsSupported,
		ResultStatus:     StatusOK,
		RedactionVersion: "bridge-redaction-v1",
	}); err != nil {
		t.Fatalf("persist event after malformed line: %v", err)
	}

	reader, err := NewJSONLAuditReader(path)
	if err != nil {
		t.Fatalf("new JSONL audit reader: %v", err)
	}
	result, err := reader.Query(context.Background(), JSONLAuditQuery{Status: StatusOK})
	if err != nil {
		t.Fatalf("query audit JSONL: %v", err)
	}
	if result.SkippedLines != 1 {
		t.Fatalf("skipped lines=%d, want 1", result.SkippedLines)
	}
	if len(result.Events) != 1 || result.Events[0].AuditID != "bra_query_after_malformed" {
		t.Fatalf("unexpected query result: %#v", result.Events)
	}
}

func auditIDs(events []AuditEvent) []string {
	ids := make([]string, 0, len(events))
	for _, event := range events {
		ids = append(ids, event.AuditID)
	}
	return ids
}

func readAuditJSONL(t *testing.T, path string) string {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read audit JSONL: %v", err)
	}
	return string(raw)
}

func assertAuditJSONLDoesNotLeak(t *testing.T, raw string) {
	t.Helper()
	for _, forbidden := range []string{
		"should-not-leak",
		"secret-cookie",
		"raw-api-key",
		"raw-query",
		"authorization",
		"cookie",
		"api_key",
		"bearer ",
		"gettokens://bridge",
		"?query=",
	} {
		if strings.Contains(strings.ToLower(raw), strings.ToLower(forbidden)) {
			t.Fatalf("audit JSONL leaked forbidden material %q: %s", forbidden, raw)
		}
	}
}
