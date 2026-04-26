package accounts

import "time"

const (
	codexUsageURL                    = "https://chatgpt.com/backend-api/wham/usage"
	codexFiveHourWindowSeconds int64 = 18000
	codexWeeklyWindowSeconds   int64 = 604800
)

type CodexQuotaWindow struct {
	ID               string
	Label            string
	RemainingPercent *int
	ResetLabel       string
	ResetAtUnix      int64
}

type CodexQuotaResponse struct {
	PlanType string
	Windows  []CodexQuotaWindow
}

type CodexQuotaRequestInfo struct {
	ChatGPTAccountID string
	PlanType         string
}

type CodexQuotaDebugRequest struct {
	Method  string            `json:"method"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers,omitempty"`
}

type CodexQuotaDebugRecord struct {
	Request    CodexQuotaDebugRequest `json:"request"`
	Response   interface{}            `json:"response,omitempty"`
	Error      string                 `json:"error,omitempty"`
	StartedAt  time.Time              `json:"startedAt"`
	EndedAt    time.Time              `json:"endedAt"`
	DurationMs int64                  `json:"durationMs"`
	StatusCode int                    `json:"statusCode,omitempty"`
}

type codexUsagePayload struct {
	PlanType             string                 `json:"plan_type"`
	PlanTypeCamel        string                 `json:"planType"`
	RateLimit            *codexRateLimitInfo    `json:"rate_limit"`
	RateLimitCamel       *codexRateLimitInfo    `json:"rateLimit"`
	CodeReviewRateLimit  *codexRateLimitInfo    `json:"code_review_rate_limit"`
	CodeReviewRateCamel  *codexRateLimitInfo    `json:"codeReviewRateLimit"`
	AdditionalRateLimits []codexAdditionalLimit `json:"additional_rate_limits"`
	AdditionalRateCamel  []codexAdditionalLimit `json:"additionalRateLimits"`
}

type codexAdditionalLimit struct {
	LimitName         string              `json:"limit_name"`
	LimitNameCamel    string              `json:"limitName"`
	MeteredFeature    string              `json:"metered_feature"`
	MeteredFeatureCam string              `json:"meteredFeature"`
	RateLimit         *codexRateLimitInfo `json:"rate_limit"`
	RateLimitCamel    *codexRateLimitInfo `json:"rateLimit"`
}

type codexRateLimitInfo struct {
	Allowed            *bool             `json:"allowed"`
	LimitReached       *bool             `json:"limit_reached"`
	LimitReachedCamel  *bool             `json:"limitReached"`
	PrimaryWindow      *codexUsageWindow `json:"primary_window"`
	PrimaryWindowCamel *codexUsageWindow `json:"primaryWindow"`
	SecondWindow       *codexUsageWindow `json:"secondary_window"`
	SecondWindowCamel  *codexUsageWindow `json:"secondaryWindow"`
}

type codexUsageWindow struct {
	UsedPercent          interface{} `json:"used_percent"`
	UsedPercentCamel     interface{} `json:"usedPercent"`
	LimitWindowSeconds   interface{} `json:"limit_window_seconds"`
	LimitWindowCamel     interface{} `json:"limitWindowSeconds"`
	ResetAfterSeconds    interface{} `json:"reset_after_seconds"`
	ResetAfterSecondsCam interface{} `json:"resetAfterSeconds"`
	ResetAt              interface{} `json:"reset_at"`
	ResetAtCamel         interface{} `json:"resetAt"`
}

type codexAuthInfo struct {
	AccessToken      string
	ChatGPTAccountID string
	PlanType         string
}
