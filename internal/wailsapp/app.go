package wailsapp

import (
	"bytes"
	"context"
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

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
	"github.com/linhay/gettokens/internal/sidecar"
	"github.com/linhay/gettokens/internal/updater"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const SidecarRequestTimeout = 30 * time.Second

const ManagementAPIPrefix = "/v0/management"

type AuthFileItem struct {
	Name          string      `json:"name"`
	Type          string      `json:"type,omitempty"`
	Provider      string      `json:"provider,omitempty"`
	Email         string      `json:"email,omitempty"`
	PlanType      string      `json:"planType,omitempty"`
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

type CodexQuotaWindow struct {
	ID               string
	Label            string
	RemainingPercent *int
	ResetLabel       string
}

type CodexQuotaResponse struct {
	PlanType string
	Windows  []CodexQuotaWindow
}

type App struct {
	ctx     context.Context
	sidecar *sidecar.Manager
	updater *updater.Updater
	version string
}

func New(version string, repo string) *App {
	return &App{
		sidecar: sidecar.NewManager(),
		updater: updater.New(repo, version),
		version: version,
	}
}

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx

	go func() {
		a.sidecar.Start(ctx, func(status sidecar.Status) {
			wailsRuntime.EventsEmit(ctx, "sidecar:status", status)
		})
	}()

	go func() {
		release, ok, err := a.updater.Check(ctx)
		if err != nil || !ok {
			return
		}
		wailsRuntime.EventsEmit(ctx, "updater:available", release)
	}()
}

func (a *App) Shutdown() {
	a.sidecar.Stop()
}

func (a *App) GetSidecarStatus() sidecar.Status {
	return a.sidecar.CurrentStatus()
}

func (a *App) GetVersion() string {
	return a.version
}

func (a *App) CheckUpdate() (*updater.ReleaseInfo, error) {
	release, ok, err := a.updater.Check(a.ctx)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, nil
	}
	return release, nil
}

func (a *App) ApplyUpdate() error {
	return a.updater.Apply(a.ctx)
}

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
	body, _, err := a.SidecarRequest(http.MethodGet, ManagementAPIPrefix+"/auth-files", nil, nil, "")
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

	for index := range result.Files {
		file := &result.Files[index]
		if !needsAuthFileMetadataInference(*file) {
			continue
		}

		body, inferErr := a.downloadAuthFileBody(file.Name)
		if inferErr != nil {
			continue
		}

		if needsAuthFileKindInference(*file) {
			inferredKind := accountsdomain.InferAuthFileKind(body)
			if inferredKind != "" {
				file.Provider = inferredKind
				file.Type = inferredKind
			}
		}

		profile := accountsdomain.ExtractAuthFileProfile(body)
		if strings.TrimSpace(file.Email) == "" {
			file.Email = profile.Email
		}
		if strings.TrimSpace(file.PlanType) == "" {
			file.PlanType = profile.PlanType
		}
	}

	return &result, nil
}

func needsAuthFileMetadataInference(file AuthFileItem) bool {
	return needsAuthFileKindInference(file) || strings.TrimSpace(file.Email) == "" || strings.TrimSpace(file.PlanType) == ""
}

func needsAuthFileKindInference(file AuthFileItem) bool {
	return isUnknownKind(file.Provider) || isUnknownKind(file.Type)
}

func isUnknownKind(value string) bool {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	return trimmed == "" || trimmed == "unknown"
}

func (a *App) downloadAuthFileBody(name string) ([]byte, error) {
	query := url.Values{}
	query.Set("name", strings.TrimSpace(name))
	body, _, err := a.SidecarRequest(http.MethodGet, ManagementAPIPrefix+"/auth-files/download", query, nil, "")
	if err != nil {
		return nil, err
	}
	return body, nil
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
	_, _, err = a.SidecarRequest(http.MethodPatch, ManagementAPIPrefix+"/auth-files/status", nil, bytes.NewReader(b), "application/json")
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
	_, _, err = a.SidecarRequest(http.MethodDelete, ManagementAPIPrefix+"/auth-files", nil, bytes.NewReader(b), "application/json")
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

	_, _, err := a.SidecarRequest(http.MethodPost, ManagementAPIPrefix+"/auth-files", nil, &buf, w.FormDataContentType())
	return err
}

func (a *App) GetAuthFileModels(name string) ([]map[string]interface{}, error) {
	query := url.Values{}
	query.Set("name", name)
	body, _, err := a.SidecarRequest(http.MethodGet, ManagementAPIPrefix+"/auth-files/models", query, nil, "")
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
	body, _, err := a.SidecarRequest(http.MethodGet, ManagementAPIPrefix+"/auth-files/download", query, nil, "")
	if err != nil {
		return nil, err
	}

	return &DownloadFileResponse{
		Name:          name,
		ContentBase64: base64.StdEncoding.EncodeToString(body),
	}, nil
}

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
