package wailsapp

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

type CodexLiveSessionsSnapshot struct {
	GeneratedAt  string                  `json:"generatedAt"`
	SidecarReady bool                    `json:"sidecarReady"`
	Source       string                  `json:"source"`
	Retention    string                  `json:"retentionLabel"`
	Summary      CodexLiveSessionSummary `json:"summary"`
	Sessions     []CodexLiveSession      `json:"sessions"`
}

type CodexLiveSessionSummary struct {
	ActiveSessions    int `json:"activeSessions"`
	ActiveRequests    int `json:"activeRequests"`
	WebsocketSessions int `json:"websocketSessions"`
	HTTPSessions      int `json:"httpSessions"`
	DegradedSessions  int `json:"degradedSessions"`
	ErrorSessions     int `json:"errorSessions"`
}

type CodexLiveSessionHistoryInput struct {
	SessionID string `json:"sessionID"`
	Window    string `json:"window,omitempty"`
	Limit     int    `json:"limit,omitempty"`
	Offset    int    `json:"offset,omitempty"`
}

type CodexLiveSessionHistoryResponse struct {
	Window      string             `json:"window"`
	GeneratedAt string             `json:"generatedAt"`
	Limit       int                `json:"limit"`
	Offset      int                `json:"offset"`
	Items       []CodexLiveRequest `json:"items"`
}

type CodexLiveSession struct {
	SessionID              string                   `json:"sessionID"`
	ProjectName            string                   `json:"projectName,omitempty"`
	ExecutionSessionID     string                   `json:"executionSessionID,omitempty"`
	DownstreamSessionID    string                   `json:"downstreamSessionID,omitempty"`
	CodexWindowID          string                   `json:"codexWindowID,omitempty"`
	Status                 string                   `json:"status"`
	StartedAt              string                   `json:"startedAt"`
	LastEventAt            string                   `json:"lastEventAt"`
	DurationMs             int64                    `json:"durationMs"`
	RequestCount           int                      `json:"requestCount"`
	ActiveRequestID        string                   `json:"activeRequestID,omitempty"`
	LastRequestID          string                   `json:"lastRequestID,omitempty"`
	Model                  string                   `json:"model"`
	AuthID                 string                   `json:"authID,omitempty"`
	AccountKey             string                   `json:"accountKey,omitempty"`
	AuthLabel              string                   `json:"authLabel,omitempty"`
	AccountPresent         bool                     `json:"accountPresent"`
	AccountCoarseAvailable bool                     `json:"accountCoarseAvailable"`
	AccountFilteredReasons []string                 `json:"accountFilteredReasons,omitempty"`
	Provider               string                   `json:"provider,omitempty"`
	DownstreamTransport    string                   `json:"downstreamTransport"`
	UpstreamTransport      string                   `json:"upstreamTransport"`
	FallbackInferred       bool                     `json:"fallbackInferred,omitempty"`
	FallbackConfidence     string                   `json:"fallbackConfidence,omitempty"`
	FallbackReason         string                   `json:"fallbackReason,omitempty"`
	TimingSummary          *CodexLiveTimingSummary  `json:"timingSummary,omitempty"`
	RecentEvents           []CodexLiveTimelineEvent `json:"recentEvents"`
	Requests               []CodexLiveRequest       `json:"requests"`
}

type CodexLiveRequest struct {
	RequestID              string                   `json:"requestID"`
	ClientRequestID        string                   `json:"clientRequestID,omitempty"`
	UpstreamRequestID      string                   `json:"upstreamRequestID,omitempty"`
	SessionID              string                   `json:"sessionID"`
	Sequence               int                      `json:"sequence"`
	Model                  string                   `json:"model"`
	Status                 string                   `json:"status"`
	StartedAt              string                   `json:"startedAt"`
	CompletedAt            string                   `json:"completedAt,omitempty"`
	DownstreamTransport    string                   `json:"downstreamTransport"`
	UpstreamTransport      string                   `json:"upstreamTransport"`
	ConnectionReused       bool                     `json:"connectionReused,omitempty"`
	AuthID                 string                   `json:"authID,omitempty"`
	AccountKey             string                   `json:"accountKey,omitempty"`
	AuthLabel              string                   `json:"authLabel,omitempty"`
	AccountPresent         bool                     `json:"accountPresent"`
	AccountCoarseAvailable bool                     `json:"accountCoarseAvailable"`
	AccountFilteredReasons []string                 `json:"accountFilteredReasons,omitempty"`
	Provider               string                   `json:"provider,omitempty"`
	ProxyRoute             string                   `json:"proxyRoute,omitempty"`
	Usage                  *CodexLiveTokenUsage     `json:"usage,omitempty"`
	Timing                 CodexLiveTimingMetrics   `json:"timing,omitempty"`
	Error                  *CodexLiveErrorSummary   `json:"error,omitempty"`
	Timeline               []CodexLiveTimelineEvent `json:"timeline"`
}

type CodexLiveTokenUsage struct {
	InputTokens       int64 `json:"inputTokens"`
	CachedInputTokens int64 `json:"cachedInputTokens"`
	OutputTokens      int64 `json:"outputTokens"`
	TotalTokens       int64 `json:"totalTokens"`
}

type CodexLiveTimingMetrics struct {
	QueueWaitMs           int64   `json:"queueWaitMs,omitempty"`
	AuthSelectMs          int64   `json:"authSelectMs,omitempty"`
	UpstreamConnectMs     int64   `json:"upstreamConnectMs,omitempty"`
	FirstEventMs          int64   `json:"firstEventMs,omitempty"`
	FirstTokenMs          int64   `json:"firstTokenMs,omitempty"`
	AverageEventGapMs     int64   `json:"averageEventGapMs,omitempty"`
	LongestEventGapMs     int64   `json:"longestEventGapMs,omitempty"`
	StreamDurationMs      int64   `json:"streamDurationMs,omitempty"`
	TotalDurationMs       int64   `json:"totalDurationMs,omitempty"`
	ReconnectCount        int     `json:"reconnectCount,omitempty"`
	OutputTokensPerSecond float64 `json:"outputTokensPerSecond,omitempty"`
	TotalTokensPerSecond  float64 `json:"totalTokensPerSecond,omitempty"`
}

type CodexLiveTimingSummary struct {
	Window         string                         `json:"window"`
	SampleCount    int                            `json:"sampleCount"`
	SequenceFrom   int                            `json:"sequenceFrom,omitempty"`
	SequenceTo     int                            `json:"sequenceTo,omitempty"`
	ActiveIncluded bool                           `json:"activeIncluded,omitempty"`
	GeneratedAt    string                         `json:"generatedAt"`
	Averages       CodexLiveTimingSummaryAverages `json:"averages"`
}

type CodexLiveTimingSummaryAverages struct {
	QueueWaitMs           *int64   `json:"queueWaitMs,omitempty"`
	AuthSelectMs          *int64   `json:"authSelectMs,omitempty"`
	UpstreamConnectMs     *int64   `json:"upstreamConnectMs,omitempty"`
	FirstEventMs          *int64   `json:"firstEventMs,omitempty"`
	FirstTokenMs          *int64   `json:"firstTokenMs,omitempty"`
	AverageEventGapMs     *int64   `json:"averageEventGapMs,omitempty"`
	LongestEventGapMs     *int64   `json:"longestEventGapMs,omitempty"`
	StreamDurationMs      *int64   `json:"streamDurationMs,omitempty"`
	TotalDurationMs       *int64   `json:"totalDurationMs,omitempty"`
	ReconnectCount        *int     `json:"reconnectCount,omitempty"`
	OutputTokensPerSecond *float64 `json:"outputTokensPerSecond,omitempty"`
	TotalTokensPerSecond  *float64 `json:"totalTokensPerSecond,omitempty"`
}

type CodexLiveErrorSummary struct {
	StatusCode int    `json:"statusCode,omitempty"`
	Code       string `json:"code,omitempty"`
	Message    string `json:"message"`
	Retryable  bool   `json:"retryable,omitempty"`
}

type CodexLiveTimelineEvent struct {
	ID       string `json:"id"`
	At       string `json:"at"`
	Lane     string `json:"lane"`
	Kind     string `json:"kind"`
	Label    string `json:"label"`
	Severity string `json:"severity"`
	Detail   string `json:"detail,omitempty"`
}

func (a *App) GetCodexLiveSessionsSnapshot() (*CodexLiveSessionsSnapshot, error) {
	body, _, err := a.SidecarRequest(http.MethodGet, ManagementAPIPrefix+"/gettokens/live-sessions", nil, nil, "")
	if err != nil {
		return nil, err
	}
	var snapshot CodexLiveSessionsSnapshot
	if err := json.Unmarshal(body, &snapshot); err != nil {
		return nil, err
	}
	if snapshot.Sessions == nil {
		snapshot.Sessions = []CodexLiveSession{}
	}
	return &snapshot, nil
}

func (a *App) ClearCodexLiveSessions() error {
	_, _, err := a.SidecarRequest(http.MethodDelete, ManagementAPIPrefix+"/gettokens/live-sessions", nil, nil, "")
	return err
}

func (a *App) GetCodexLiveSessionHistory(input CodexLiveSessionHistoryInput) (*CodexLiveSessionHistoryResponse, error) {
	query := url.Values{}
	if sessionID := strings.TrimSpace(input.SessionID); sessionID != "" {
		query.Set("session_id", sessionID)
	}
	if window := strings.TrimSpace(input.Window); window != "" {
		query.Set("window", window)
	}
	if input.Limit > 0 {
		query.Set("limit", strconv.Itoa(input.Limit))
	}
	if input.Offset > 0 {
		query.Set("offset", strconv.Itoa(input.Offset))
	}

	body, _, err := a.SidecarRequest(http.MethodGet, ManagementAPIPrefix+"/gettokens/live-sessions/history", query, nil, "")
	if err != nil {
		return nil, err
	}
	var history CodexLiveSessionHistoryResponse
	if err := json.Unmarshal(body, &history); err != nil {
		return nil, err
	}
	if history.Items == nil {
		history.Items = []CodexLiveRequest{}
	}
	return &history, nil
}
