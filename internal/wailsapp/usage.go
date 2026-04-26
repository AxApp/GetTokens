package wailsapp

import (
	"encoding/json"
	"net/http"
)

type UsageStatisticsResponse struct {
	Usage          map[string]interface{} `json:"usage"`
	FailedRequests int64                  `json:"failedRequests,omitempty"`
}

func (a *App) GetUsageStatistics() (*UsageStatisticsResponse, error) {
	body, _, err := a.SidecarRequest(http.MethodGet, ManagementAPIPrefix+"/usage", nil, nil, "")
	if err != nil {
		return nil, err
	}

	var payload struct {
		Usage          map[string]interface{} `json:"usage"`
		FailedRequests int64                  `json:"failed_requests"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	if payload.Usage == nil {
		payload.Usage = map[string]interface{}{}
	}

	return &UsageStatisticsResponse{
		Usage:          payload.Usage,
		FailedRequests: payload.FailedRequests,
	}, nil
}
