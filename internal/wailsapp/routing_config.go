package wailsapp

import (
	"encoding/json"
	"errors"
	"strings"
)

type RelayRoutingConfig struct {
	Strategy            string `json:"strategy"`
	SessionAffinity     bool   `json:"sessionAffinity"`
	SessionAffinityTTL  string `json:"sessionAffinityTTL"`
	RequestRetry        int    `json:"requestRetry"`
	MaxRetryCredentials int    `json:"maxRetryCredentials"`
	MaxRetryInterval    int    `json:"maxRetryInterval"`
	SwitchProject       bool   `json:"switchProject"`
	SwitchPreviewModel  bool   `json:"switchPreviewModel"`
	AntigravityCredits  bool   `json:"antigravityCredits"`
}

func (a *App) GetRelayRoutingConfig() (*RelayRoutingConfig, error) {
	body, _, err := a.SidecarRequest("GET", ManagementAPIPrefix+"/config", nil, nil, "")
	if err != nil {
		return nil, err
	}
	return parseRelayRoutingConfig(body)
}

func parseRelayRoutingConfig(body []byte) (*RelayRoutingConfig, error) {
	var payload struct {
		RequestRetry        int `json:"request-retry"`
		MaxRetryCredentials int `json:"max-retry-credentials"`
		MaxRetryInterval    int `json:"max-retry-interval"`
		Routing             struct {
			Strategy           string `json:"strategy"`
			SessionAffinity    bool   `json:"session-affinity"`
			SessionAffinityTTL string `json:"session-affinity-ttl"`
		} `json:"routing"`
		QuotaExceeded struct {
			SwitchProject      bool `json:"switch-project"`
			SwitchPreviewModel bool `json:"switch-preview-model"`
			AntigravityCredits bool `json:"antigravity-credits"`
		} `json:"quota-exceeded"`
	}

	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}

	strategy := strings.TrimSpace(payload.Routing.Strategy)
	if strategy == "" {
		strategy = "round-robin"
	}

	ttl := strings.TrimSpace(payload.Routing.SessionAffinityTTL)
	if ttl == "" {
		ttl = "1h"
	}

	if strategy == "" {
		return nil, errors.New("轮动策略为空")
	}

	return &RelayRoutingConfig{
		Strategy:            strategy,
		SessionAffinity:     payload.Routing.SessionAffinity,
		SessionAffinityTTL:  ttl,
		RequestRetry:        payload.RequestRetry,
		MaxRetryCredentials: payload.MaxRetryCredentials,
		MaxRetryInterval:    payload.MaxRetryInterval,
		SwitchProject:       payload.QuotaExceeded.SwitchProject,
		SwitchPreviewModel:  payload.QuotaExceeded.SwitchPreviewModel,
		AntigravityCredits:  payload.QuotaExceeded.AntigravityCredits,
	}, nil
}
