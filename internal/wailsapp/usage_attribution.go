package wailsapp

import (
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type SidecarUsageAttributionInput struct {
	Window            string `json:"window,omitempty"`
	Bucket            string `json:"bucket,omitempty"`
	IncludeUnresolved bool   `json:"includeUnresolved,omitempty"`
}

type SidecarUsageAttributionResponse struct {
	Window      string                        `json:"window"`
	Bucket      string                        `json:"bucket"`
	GeneratedAt string                        `json:"generatedAt"`
	Items       []SidecarUsageAttributionItem `json:"items"`
	Unresolved  []SidecarUsageAttributionItem `json:"unresolved,omitempty"`
}

type SidecarUsageAttributionItem struct {
	AttributionKey    string                          `json:"attributionKey"`
	AttributionKind   string                          `json:"attributionKind"`
	AccountKey        string                          `json:"accountKey"`
	CredentialKey     string                          `json:"credentialKey,omitempty"`
	Provider          string                          `json:"provider"`
	RequestedModels   []string                        `json:"requestedModels"`
	RequestCount      int64                           `json:"requestCount"`
	FailedCount       int64                           `json:"failedCount"`
	LatencyAverageMs  int64                           `json:"latencyAverageMs,omitempty"`
	InputTokens       int64                           `json:"inputTokens"`
	CachedInputTokens int64                           `json:"cachedInputTokens"`
	OutputTokens      int64                           `json:"outputTokens"`
	TotalTokens       int64                           `json:"totalTokens"`
	LastActivityAt    string                          `json:"lastActivityAt,omitempty"`
	Buckets           []SidecarUsageAttributionBucket `json:"buckets"`
}

type SidecarUsageAttributionBucket struct {
	Start             string `json:"start"`
	RequestCount      int64  `json:"requestCount"`
	FailedCount       int64  `json:"failedCount"`
	InputTokens       int64  `json:"inputTokens"`
	CachedInputTokens int64  `json:"cachedInputTokens"`
	OutputTokens      int64  `json:"outputTokens"`
	TotalTokens       int64  `json:"totalTokens"`
}

func (a *App) GetSidecarUsageAttribution(input SidecarUsageAttributionInput) (*SidecarUsageAttributionResponse, error) {
	startedAt := time.Now()
	query := url.Values{}
	if window := strings.TrimSpace(input.Window); window != "" {
		query.Set("window", window)
	}
	if bucket := strings.TrimSpace(input.Bucket); bucket != "" {
		query.Set("bucket", bucket)
	}
	if input.IncludeUnresolved {
		query.Set("include_unresolved", "true")
	}

	sidecarStartedAt := time.Now()
	body, statusCode, err := a.SidecarRequest(http.MethodGet, ManagementAPIPrefix+"/gettokens/usage-attribution", query, nil, "")
	sidecarDurationMs := time.Since(sidecarStartedAt).Milliseconds()
	if err != nil {
		log.Printf(
			"usage attribution bridge failed status=%d include_unresolved=%t sidecar_ms=%d total_ms=%d",
			statusCode,
			input.IncludeUnresolved,
			sidecarDurationMs,
			time.Since(startedAt).Milliseconds(),
		)
		return nil, err
	}
	var response SidecarUsageAttributionResponse
	if err := json.Unmarshal(body, &response); err != nil {
		log.Printf(
			"usage attribution bridge decode failed status=%d include_unresolved=%t sidecar_ms=%d total_ms=%d",
			statusCode,
			input.IncludeUnresolved,
			sidecarDurationMs,
			time.Since(startedAt).Milliseconds(),
		)
		return nil, err
	}
	if response.Items == nil {
		response.Items = []SidecarUsageAttributionItem{}
	}
	if response.Unresolved == nil {
		response.Unresolved = []SidecarUsageAttributionItem{}
	}
	if !input.IncludeUnresolved {
		response.Unresolved = []SidecarUsageAttributionItem{}
	}
	log.Printf(
		"usage attribution bridge complete authority=sidecar include_unresolved=%t items=%d unresolved=%d sidecar_ms=%d total_ms=%d",
		input.IncludeUnresolved,
		len(response.Items),
		len(response.Unresolved),
		sidecarDurationMs,
		time.Since(startedAt).Milliseconds(),
	)
	return &response, nil
}
