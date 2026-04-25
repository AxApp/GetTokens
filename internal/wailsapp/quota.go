package wailsapp

import (
	"errors"
	"net/http"
	"net/url"
	"strings"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
)

func (a *App) GetCodexQuota(name string) (*CodexQuotaResponse, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("name 不能为空")
	}

	query := url.Values{}
	query.Set("name", name)
	body, _, err := a.SidecarRequest(http.MethodGet, ManagementAPIPrefix+"/auth-files/download", query, nil, "")
	if err != nil {
		return nil, err
	}
	quota, err := accountsdomain.GetCodexQuota(a.ctx, body, SidecarRequestTimeout)
	if err != nil {
		return nil, err
	}

	windows := make([]CodexQuotaWindow, 0, len(quota.Windows))
	for _, window := range quota.Windows {
		windows = append(windows, CodexQuotaWindow{
			ID:               window.ID,
			Label:            window.Label,
			RemainingPercent: window.RemainingPercent,
			ResetLabel:       window.ResetLabel,
		})
	}

	return &CodexQuotaResponse{
		PlanType: quota.PlanType,
		Windows:  windows,
	}, nil
}
