package main

import wailsapp "github.com/linhay/gettokens/internal/wailsapp"

type EnvironmentProxyEntry struct {
	Source   string `json:"source"`
	ProxyURL string `json:"proxyUrl"`
}

type ProbeProxyNodeInput struct {
	ProxyURL  string `json:"proxyUrl"`
	TargetURL string `json:"targetUrl,omitempty"`
}

type ProbeProxyNodeResult struct {
	ProxyURL   string `json:"proxyUrl"`
	TargetURL  string `json:"targetUrl"`
	Success    bool   `json:"success"`
	StatusCode int    `json:"statusCode,omitempty"`
	LatencyMs  int    `json:"latencyMs"`
	CheckedAt  string `json:"checkedAt"`
	Message    string `json:"message"`
}

type FetchProxySubscriptionInput struct {
	URL         string `json:"url"`
	SourceLabel string `json:"sourceLabel,omitempty"`
}

type FetchProxySubscriptionResult struct {
	URL         string `json:"url"`
	SourceLabel string `json:"sourceLabel"`
	Content     string `json:"content"`
}

func (a *App) ListEnvironmentProxyEntries() []EnvironmentProxyEntry {
	items := a.core.ListEnvironmentProxyEntries()
	result := make([]EnvironmentProxyEntry, 0, len(items))
	for _, item := range items {
		if item.Source == "" || item.ProxyURL == "" {
			continue
		}
		result = append(result, EnvironmentProxyEntry{
			Source:   item.Source,
			ProxyURL: item.ProxyURL,
		})
	}
	return result
}

func (a *App) ProbeProxyNode(input ProbeProxyNodeInput) (*ProbeProxyNodeResult, error) {
	result, err := a.core.ProbeProxyNode(wailsapp.ProbeProxyNodeInput{
		ProxyURL:  input.ProxyURL,
		TargetURL: input.TargetURL,
	})
	if err != nil {
		return nil, err
	}

	return &ProbeProxyNodeResult{
		ProxyURL:   result.ProxyURL,
		TargetURL:  result.TargetURL,
		Success:    result.Success,
		StatusCode: result.StatusCode,
		LatencyMs:  result.LatencyMs,
		CheckedAt:  result.CheckedAt,
		Message:    result.Message,
	}, nil
}

func (a *App) FetchProxySubscription(input FetchProxySubscriptionInput) (*FetchProxySubscriptionResult, error) {
	result, err := a.core.FetchProxySubscription(wailsapp.FetchProxySubscriptionInput{
		URL:         input.URL,
		SourceLabel: input.SourceLabel,
	})
	if err != nil {
		return nil, err
	}

	return &FetchProxySubscriptionResult{
		URL:         result.URL,
		SourceLabel: result.SourceLabel,
		Content:     result.Content,
	}, nil
}
