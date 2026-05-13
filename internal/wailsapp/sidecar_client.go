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
	if a.sidecarRequest != nil {
		return a.sidecarRequest(method, path, query, body, contentType)
	}

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

func (a *App) SidecarRelayRequest(method string, path string, body io.Reader, contentType string, apiKey string) ([]byte, int, map[string][]string, error) {
	return a.SidecarRelayRequestWithHeaders(method, path, body, contentType, apiKey, nil)
}

func (a *App) SidecarRelayRequestWithHeaders(method string, path string, body io.Reader, contentType string, apiKey string, headers map[string]string) ([]byte, int, map[string][]string, error) {
	if a.relayRequest != nil {
		return a.relayRequest(method, path, body, contentType, apiKey, headers)
	}

	baseURL, err := a.SidecarBaseURL()
	if err != nil {
		return nil, 0, nil, err
	}
	req, err := http.NewRequest(method, baseURL+path, body)
	if err != nil {
		return nil, 0, nil, err
	}
	if trimmedKey := strings.TrimSpace(apiKey); trimmedKey != "" {
		req.Header.Set("Authorization", "Bearer "+trimmedKey)
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	for key, value := range headers {
		trimmedKey := strings.TrimSpace(key)
		trimmedValue := strings.TrimSpace(value)
		if trimmedKey == "" || trimmedValue == "" {
			continue
		}
		req.Header.Set(trimmedKey, trimmedValue)
	}

	client := &http.Client{Timeout: SidecarRequestTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	responseHeaders := map[string][]string(resp.Header.Clone())
	if err != nil {
		return nil, resp.StatusCode, responseHeaders, err
	}
	return respBody, resp.StatusCode, responseHeaders, nil
}
