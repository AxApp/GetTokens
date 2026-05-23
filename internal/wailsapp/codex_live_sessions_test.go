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
				"recentEvents":[],
				"requests":[{
					"requestID":"req-1",
					"sessionID":"ws-session-1",
					"sequence":1,
					"model":"gpt-5.5",
					"status":"streaming",
					"startedAt":"2026-05-21T08:00:00Z",
					"downstreamTransport":"websocket",
					"upstreamTransport":"websocket",
					"timing":{"firstTokenMs":800,"outputTokensPerSecond":42},
					"timeline":[]
				}]
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
	if session.SessionID != "ws-session-1" || session.ProjectName != "GetTokens" || session.Requests[0].Timing.OutputTokensPerSecond != 42 {
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
