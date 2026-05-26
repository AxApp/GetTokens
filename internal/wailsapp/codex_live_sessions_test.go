package wailsapp

import (
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

func TestGetCodexLiveSessionsSnapshotReadsSidecarManagementAPI(t *testing.T) {
	app := New("", "", "")
	app.sidecarRequest = func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		if method != http.MethodGet {
			t.Fatalf("method = %s, want GET", method)
		}
		if path != ManagementAPIPrefix+"/gettokens/live-sessions" {
			t.Fatalf("path = %s", path)
		}
		return []byte(`{
			"generatedAt":"2026-05-21T08:00:00Z",
			"sidecarReady":true,
			"source":"live",
			"retentionLabel":"30m / 200",
			"summary":{"activeSessions":1,"activeRequests":1,"websocketSessions":1,"httpSessions":0,"degradedSessions":0,"errorSessions":0},
			"sessions":[{
				"sessionID":"ws-session-1",
				"projectName":"GetTokens",
				"status":"streaming",
				"startedAt":"2026-05-21T08:00:00Z",
				"lastEventAt":"2026-05-21T08:00:02Z",
				"durationMs":2000,
				"requestCount":1,
				"activeRequestID":"req-1",
				"model":"gpt-5.5",
				"authID":"auth-file:team",
				"downstreamTransport":"websocket",
				"upstreamTransport":"websocket",
				"recentEvents":[]
			}]
		}`), http.StatusOK, nil
	}

	snapshot, err := app.GetCodexLiveSessionsSnapshot()
	if err != nil {
		t.Fatalf("GetCodexLiveSessionsSnapshot returned error: %v", err)
	}
	if !snapshot.SidecarReady || snapshot.Source != "live" {
		t.Fatalf("unexpected snapshot metadata: %#v", snapshot)
	}
	if len(snapshot.Sessions) != 1 {
		t.Fatalf("sessions = %d, want 1", len(snapshot.Sessions))
	}
	session := snapshot.Sessions[0]
	if session.SessionID != "ws-session-1" || session.ProjectName != "GetTokens" || len(session.Requests) != 0 {
		t.Fatalf("unexpected session payload: %#v", session)
	}
}

func TestGetCodexLiveSessionsSnapshotPropagatesInvalidJSON(t *testing.T) {
	app := New("", "", "")
	app.sidecarRequest = func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		return []byte(`not json`), http.StatusOK, nil
	}

	_, err := app.GetCodexLiveSessionsSnapshot()
	if err == nil || !strings.Contains(err.Error(), "invalid character") {
		t.Fatalf("expected json error, got %v", err)
	}
}

func TestGetCodexLiveSessionHistoryReadsSidecarManagementAPI(t *testing.T) {
	app := New("", "", "")
	app.sidecarRequest = func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		if method != http.MethodGet {
			t.Fatalf("method = %s, want GET", method)
		}
		if path != ManagementAPIPrefix+"/gettokens/live-sessions/history" {
			t.Fatalf("path = %s", path)
		}
		if got := query.Get("session_id"); got != "ws-session-1" {
			t.Fatalf("session_id = %q, want ws-session-1", got)
		}
		if got := query.Get("window"); got != "all" {
			t.Fatalf("window = %q, want all", got)
		}
		if got := query.Get("limit"); got != "20" {
			t.Fatalf("limit = %q, want 20", got)
		}
		if got := query.Get("offset"); got != "5" {
			t.Fatalf("offset = %q, want 5", got)
		}
		return []byte(`{
			"window":"all",
			"generatedAt":"2026-05-21T08:00:00Z",
			"limit":20,
			"offset":5,
			"items":[{
				"requestID":"req-1",
				"sessionID":"ws-session-1",
				"sequence":1,
				"model":"gpt-5.5",
				"status":"completed",
				"startedAt":"2026-05-21T08:00:00Z",
				"completedAt":"2026-05-21T08:00:02Z",
				"downstreamTransport":"websocket",
				"upstreamTransport":"websocket",
				"timing":{"firstTokenMs":800,"outputTokensPerSecond":42},
				"timeline":[]
			}]
		}`), http.StatusOK, nil
	}

	history, err := app.GetCodexLiveSessionHistory(CodexLiveSessionHistoryInput{
		SessionID: "ws-session-1",
		Window:    "all",
		Limit:     20,
		Offset:    5,
	})
	if err != nil {
		t.Fatalf("GetCodexLiveSessionHistory returned error: %v", err)
	}
	if history.Window != "all" || history.Limit != 20 || history.Offset != 5 {
		t.Fatalf("unexpected history metadata: %#v", history)
	}
	if len(history.Items) != 1 || history.Items[0].Timing.OutputTokensPerSecond != 42 {
		t.Fatalf("unexpected history payload: %#v", history)
	}
}
