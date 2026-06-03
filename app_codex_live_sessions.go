package main

import wailsapp "github.com/linhay/gettokens/internal/wailsapp"

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
	result, err := a.core.GetCodexLiveSessionsSnapshot()
	if err != nil {
		return nil, err
	}
	return mapCodexLiveSessionsSnapshot(result), nil
}

func (a *App) GetCodexLiveSessionHistory(input CodexLiveSessionHistoryInput) (*CodexLiveSessionHistoryResponse, error) {
	result, err := a.core.GetCodexLiveSessionHistory(wailsapp.CodexLiveSessionHistoryInput{
		SessionID: input.SessionID,
		Window:    input.Window,
		Limit:     input.Limit,
		Offset:    input.Offset,
	})
	if err != nil {
		return nil, err
	}
	return mapCodexLiveSessionHistoryResponse(result), nil
}

func mapCodexLiveSessionsSnapshot(result *wailsapp.CodexLiveSessionsSnapshot) *CodexLiveSessionsSnapshot {
	if result == nil {
		return &CodexLiveSessionsSnapshot{Sessions: []CodexLiveSession{}}
	}
	return &CodexLiveSessionsSnapshot{
		GeneratedAt:  result.GeneratedAt,
		SidecarReady: result.SidecarReady,
		Source:       result.Source,
		Retention:    result.Retention,
		Summary: CodexLiveSessionSummary{
			ActiveSessions:    result.Summary.ActiveSessions,
			ActiveRequests:    result.Summary.ActiveRequests,
			WebsocketSessions: result.Summary.WebsocketSessions,
			HTTPSessions:      result.Summary.HTTPSessions,
			DegradedSessions:  result.Summary.DegradedSessions,
			ErrorSessions:     result.Summary.ErrorSessions,
		},
		Sessions: mapCodexLiveSessions(result.Sessions),
	}
}

func mapCodexLiveSessions(items []wailsapp.CodexLiveSession) []CodexLiveSession {
	if len(items) == 0 {
		return []CodexLiveSession{}
	}
	out := make([]CodexLiveSession, 0, len(items))
	for _, item := range items {
		out = append(out, CodexLiveSession{
			SessionID:           item.SessionID,
			ProjectName:         item.ProjectName,
			ExecutionSessionID:  item.ExecutionSessionID,
			DownstreamSessionID: item.DownstreamSessionID,
			CodexWindowID:       item.CodexWindowID,
			Status:              item.Status,
			StartedAt:           item.StartedAt,
			LastEventAt:         item.LastEventAt,
			DurationMs:          item.DurationMs,
			RequestCount:        item.RequestCount,
			ActiveRequestID:     item.ActiveRequestID,
			LastRequestID:       item.LastRequestID,
			Model:               item.Model,
			AuthID:              item.AuthID,
			AuthLabel:           item.AuthLabel,
			Provider:            item.Provider,
			DownstreamTransport: item.DownstreamTransport,
			UpstreamTransport:   item.UpstreamTransport,
			FallbackInferred:    item.FallbackInferred,
			FallbackConfidence:  item.FallbackConfidence,
			FallbackReason:      item.FallbackReason,
			TimingSummary:       mapCodexLiveTimingSummary(item.TimingSummary),
			RecentEvents:        mapCodexLiveTimelineEvents(item.RecentEvents),
			Requests:            mapCodexLiveRequests(item.Requests),
		})
	}
	return out
}

func mapCodexLiveSessionHistoryResponse(result *wailsapp.CodexLiveSessionHistoryResponse) *CodexLiveSessionHistoryResponse {
	if result == nil {
		return &CodexLiveSessionHistoryResponse{Items: []CodexLiveRequest{}}
	}
	return &CodexLiveSessionHistoryResponse{
		Window:      result.Window,
		GeneratedAt: result.GeneratedAt,
		Limit:       result.Limit,
		Offset:      result.Offset,
		Items:       mapCodexLiveRequests(result.Items),
	}
}

func mapCodexLiveRequests(items []wailsapp.CodexLiveRequest) []CodexLiveRequest {
	if len(items) == 0 {
		return []CodexLiveRequest{}
	}
	out := make([]CodexLiveRequest, 0, len(items))
	for _, item := range items {
		out = append(out, CodexLiveRequest{
			RequestID:           item.RequestID,
			ClientRequestID:     item.ClientRequestID,
			UpstreamRequestID:   item.UpstreamRequestID,
			SessionID:           item.SessionID,
			Sequence:            item.Sequence,
			Model:               item.Model,
			Status:              item.Status,
			StartedAt:           item.StartedAt,
			CompletedAt:         item.CompletedAt,
			DownstreamTransport: item.DownstreamTransport,
			UpstreamTransport:   item.UpstreamTransport,
			ConnectionReused:    item.ConnectionReused,
			AuthID:              item.AuthID,
			AuthLabel:           item.AuthLabel,
			Provider:            item.Provider,
			ProxyRoute:          item.ProxyRoute,
			Usage:               mapCodexLiveTokenUsage(item.Usage),
			Timing:              mapCodexLiveTiming(item.Timing),
			Error:               mapCodexLiveError(item.Error),
			Timeline:            mapCodexLiveTimelineEvents(item.Timeline),
		})
	}
	return out
}

func mapCodexLiveTokenUsage(item *wailsapp.CodexLiveTokenUsage) *CodexLiveTokenUsage {
	if item == nil {
		return nil
	}
	return &CodexLiveTokenUsage{
		InputTokens:       item.InputTokens,
		CachedInputTokens: item.CachedInputTokens,
		OutputTokens:      item.OutputTokens,
		TotalTokens:       item.TotalTokens,
	}
}

func mapCodexLiveTiming(item wailsapp.CodexLiveTimingMetrics) CodexLiveTimingMetrics {
	return CodexLiveTimingMetrics{
		QueueWaitMs:           item.QueueWaitMs,
		AuthSelectMs:          item.AuthSelectMs,
		UpstreamConnectMs:     item.UpstreamConnectMs,
		FirstEventMs:          item.FirstEventMs,
		FirstTokenMs:          item.FirstTokenMs,
		AverageEventGapMs:     item.AverageEventGapMs,
		LongestEventGapMs:     item.LongestEventGapMs,
		StreamDurationMs:      item.StreamDurationMs,
		TotalDurationMs:       item.TotalDurationMs,
		ReconnectCount:        item.ReconnectCount,
		OutputTokensPerSecond: item.OutputTokensPerSecond,
		TotalTokensPerSecond:  item.TotalTokensPerSecond,
	}
}

func mapCodexLiveTimingSummary(item *wailsapp.CodexLiveTimingSummary) *CodexLiveTimingSummary {
	if item == nil {
		return nil
	}
	return &CodexLiveTimingSummary{
		Window:         item.Window,
		SampleCount:    item.SampleCount,
		SequenceFrom:   item.SequenceFrom,
		SequenceTo:     item.SequenceTo,
		ActiveIncluded: item.ActiveIncluded,
		GeneratedAt:    item.GeneratedAt,
		Averages: CodexLiveTimingSummaryAverages{
			QueueWaitMs:           item.Averages.QueueWaitMs,
			AuthSelectMs:          item.Averages.AuthSelectMs,
			UpstreamConnectMs:     item.Averages.UpstreamConnectMs,
			FirstEventMs:          item.Averages.FirstEventMs,
			FirstTokenMs:          item.Averages.FirstTokenMs,
			AverageEventGapMs:     item.Averages.AverageEventGapMs,
			LongestEventGapMs:     item.Averages.LongestEventGapMs,
			StreamDurationMs:      item.Averages.StreamDurationMs,
			TotalDurationMs:       item.Averages.TotalDurationMs,
			ReconnectCount:        item.Averages.ReconnectCount,
			OutputTokensPerSecond: item.Averages.OutputTokensPerSecond,
			TotalTokensPerSecond:  item.Averages.TotalTokensPerSecond,
		},
	}
}

func mapCodexLiveError(item *wailsapp.CodexLiveErrorSummary) *CodexLiveErrorSummary {
	if item == nil {
		return nil
	}
	return &CodexLiveErrorSummary{
		StatusCode: item.StatusCode,
		Code:       item.Code,
		Message:    item.Message,
		Retryable:  item.Retryable,
	}
}

func mapCodexLiveTimelineEvents(items []wailsapp.CodexLiveTimelineEvent) []CodexLiveTimelineEvent {
	if len(items) == 0 {
		return []CodexLiveTimelineEvent{}
	}
	out := make([]CodexLiveTimelineEvent, 0, len(items))
	for _, item := range items {
		out = append(out, CodexLiveTimelineEvent{
			ID:       item.ID,
			At:       item.At,
			Lane:     item.Lane,
			Kind:     item.Kind,
			Label:    item.Label,
			Severity: item.Severity,
			Detail:   item.Detail,
		})
	}
	return out
}
