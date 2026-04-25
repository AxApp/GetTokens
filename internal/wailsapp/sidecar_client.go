package wailsapp

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/linhay/gettokens/internal/sidecar"
)

const SidecarRequestTimeout = 30 * time.Second

const ManagementAPIPrefix = "/v0/management"

func (a *App) SidecarBaseURL() (string, error) {
	status := a.sidecar.CurrentStatus()
	if status.Code != sidecar.StatusReady || status.Port <= 0 {
		return "", errors.New("后端未就绪")
	}
	return fmt.Sprintf("http://127.0.0.1:%d", status.Port), nil
}

func (a *App) SidecarRequest(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
	baseURL, err := a.SidecarBaseURL()
	if err != nil {
		return nil, 0, err
	}
	urlStr := baseURL + path
	if query != nil {
		encoded := query.Encode()
		if encoded != "" {
			urlStr += "?" + encoded
		}
	}

	req, err := http.NewRequest(method, urlStr, body)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Authorization", "Bearer "+sidecar.ManagementKey)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}

	client := &http.Client{Timeout: SidecarRequestTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, err
	}

	if resp.StatusCode >= http.StatusBadRequest {
		msg := strings.TrimSpace(string(respBody))
		if msg == "" {
			msg = resp.Status
		}
		return nil, resp.StatusCode, fmt.Errorf("sidecar 请求失败 (%d): %s", resp.StatusCode, msg)
	}

	return respBody, resp.StatusCode, nil
}
