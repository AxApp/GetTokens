package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/linhay/gettokens/internal/sidecar"
)

const sidecarRequestTimeout = 30 * time.Second

const managementAPIPrefix = "/v0/management"

type AuthFileItem struct {
	Name          string      `json:"name"`
	Type          string      `json:"type,omitempty"`
	Provider      string      `json:"provider,omitempty"`
	Size          int64       `json:"size,omitempty"`
	AuthIndex     interface{} `json:"authIndex,omitempty"`
	RuntimeOnly   bool        `json:"runtimeOnly,omitempty"`
	Disabled      bool        `json:"disabled,omitempty"`
	Unavailable   bool        `json:"unavailable,omitempty"`
	Status        string      `json:"status,omitempty"`
	StatusMessage string      `json:"statusMessage,omitempty"`
	LastRefresh   interface{} `json:"lastRefresh,omitempty"`
	Modified      int64       `json:"modified,omitempty"`
}

type AuthFilesResponse struct {
	Files []AuthFileItem `json:"files"`
	Total int            `json:"total,omitempty"`
}

type UploadFilePayload struct {
	Name          string `json:"name"`
	ContentBase64 string `json:"contentBase64"`
}

type DownloadFileResponse struct {
	Name          string `json:"name"`
	ContentBase64 string `json:"contentBase64"`
}

func (a *App) sidecarBaseURL() (string, error) {
	status := a.sidecar.CurrentStatus()
	if status.Code != sidecar.StatusReady || status.Port <= 0 {
		return "", errors.New("后端未就绪")
	}
	return fmt.Sprintf("http://127.0.0.1:%d", status.Port), nil
}

func (a *App) sidecarRequest(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
	baseURL, err := a.sidecarBaseURL()
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

	client := &http.Client{Timeout: sidecarRequestTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, err
	}

	if resp.StatusCode >= 400 {
		msg := strings.TrimSpace(string(respBody))
		if msg == "" {
			msg = resp.Status
		}
		return nil, resp.StatusCode, fmt.Errorf("sidecar 请求失败 (%d): %s", resp.StatusCode, msg)
	}

	return respBody, resp.StatusCode, nil
}

func (a *App) ListAuthFiles() (*AuthFilesResponse, error) {
	body, _, err := a.sidecarRequest(http.MethodGet, managementAPIPrefix+"/auth-files", nil, nil, "")
	if err != nil {
		return nil, err
	}
	var result AuthFilesResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	if result.Files == nil {
		result.Files = []AuthFileItem{}
	}
	return &result, nil
}

func (a *App) SetAuthFileStatus(name string, disabled bool) error {
	payload := map[string]interface{}{
		"name":     name,
		"disabled": disabled,
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, _, err = a.sidecarRequest(http.MethodPatch, managementAPIPrefix+"/auth-files/status", nil, bytes.NewReader(b), "application/json")
	return err
}

func (a *App) DeleteAuthFiles(names []string) error {
	payload := map[string]interface{}{
		"names": names,
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, _, err = a.sidecarRequest(http.MethodDelete, managementAPIPrefix+"/auth-files", nil, bytes.NewReader(b), "application/json")
	return err
}

func (a *App) UploadAuthFiles(files []UploadFilePayload) error {
	if len(files) == 0 {
		return errors.New("未选择文件")
	}

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)

	for _, f := range files {
		if strings.TrimSpace(f.Name) == "" || strings.TrimSpace(f.ContentBase64) == "" {
			continue
		}
		decoded, err := base64.StdEncoding.DecodeString(f.ContentBase64)
		if err != nil {
			return fmt.Errorf("文件 %s base64 解码失败: %w", f.Name, err)
		}
		part, err := w.CreateFormFile("file", f.Name)
		if err != nil {
			return err
		}
		if _, err := part.Write(decoded); err != nil {
			return err
		}
	}

	if err := w.Close(); err != nil {
		return err
	}

	_, _, err := a.sidecarRequest(http.MethodPost, managementAPIPrefix+"/auth-files", nil, &buf, w.FormDataContentType())
	return err
}

func (a *App) GetAuthFileModels(name string) ([]map[string]interface{}, error) {
	query := url.Values{}
	query.Set("name", name)
	body, _, err := a.sidecarRequest(http.MethodGet, managementAPIPrefix+"/auth-files/models", query, nil, "")
	if err != nil {
		return nil, err
	}
	var result struct {
		Models []map[string]interface{} `json:"models"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	if result.Models == nil {
		return []map[string]interface{}{}, nil
	}
	return result.Models, nil
}

func (a *App) DownloadAuthFile(name string) (*DownloadFileResponse, error) {
	if strings.TrimSpace(name) == "" {
		return nil, errors.New("name 不能为空")
	}
	query := url.Values{}
	query.Set("name", name)
	body, _, err := a.sidecarRequest(http.MethodGet, managementAPIPrefix+"/auth-files/download", query, nil, "")
	if err != nil {
		return nil, err
	}

	return &DownloadFileResponse{
		Name:          name,
		ContentBase64: base64.StdEncoding.EncodeToString(body),
	}, nil
}
