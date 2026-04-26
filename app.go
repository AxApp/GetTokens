package main

import (
	"context"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
	"github.com/linhay/gettokens/internal/sidecar"
	"github.com/linhay/gettokens/internal/updater"
	wailsapp "github.com/linhay/gettokens/internal/wailsapp"
)

// Version is injected at build time via -ldflags
var Version = "dev"

// ReleaseLabel is injected at build time for UI display, format: YYYY.MM.DD.HH
var ReleaseLabel = ""

// GitHubRepo is the repository used for auto-update checks
const GitHubRepo = "linhay/GetTokens"

type App struct {
	core *wailsapp.App
}

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
	ID               string `json:"id"`
	Label            string `json:"label"`
	RemainingPercent *int   `json:"remainingPercent,omitempty"`
	ResetLabel       string `json:"resetLabel"`
	ResetAtUnix      int64  `json:"resetAtUnix,omitempty"`
}

type CodexQuotaResponse struct {
	PlanType string             `json:"planType,omitempty"`
	Windows  []CodexQuotaWindow `json:"windows"`
}

type AccountRecord struct {
	ID               string      `json:"id"`
	Provider         string      `json:"provider"`
	CredentialSource string      `json:"credentialSource"`
	DisplayName      string      `json:"displayName"`
	Status           string      `json:"status"`
	Disabled         bool        `json:"disabled,omitempty"`
	Email            string      `json:"email,omitempty"`
	PlanType         string      `json:"planType,omitempty"`
	Name             string      `json:"name,omitempty"`
	APIKey           string      `json:"apiKey,omitempty"`
	KeyFingerprint   string      `json:"keyFingerprint,omitempty"`
	KeySuffix        string      `json:"keySuffix,omitempty"`
	BaseURL          string      `json:"baseUrl,omitempty"`
	Prefix           string      `json:"prefix,omitempty"`
	AuthIndex        interface{} `json:"authIndex,omitempty"`
	QuotaKey         string      `json:"quotaKey,omitempty"`
	LocalOnly        bool        `json:"localOnly,omitempty"`
}

type CreateCodexAPIKeyInput struct {
	APIKey         string            `json:"apiKey"`
	BaseURL        string            `json:"baseUrl"`
	Prefix         string            `json:"prefix,omitempty"`
	ProxyURL       string            `json:"proxyUrl,omitempty"`
	Headers        map[string]string `json:"headers,omitempty"`
	ExcludedModels []string          `json:"excludedModels,omitempty"`
}

type RelayServiceConfig struct {
	APIKeys   []string               `json:"apiKeys"`
	Endpoints []RelayServiceEndpoint `json:"endpoints"`
}

type RelayServiceEndpoint struct {
	ID      string `json:"id"`
	Kind    string `json:"kind"`
	Host    string `json:"host"`
	BaseURL string `json:"baseUrl"`
}

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

type RelayLocalApplyResult struct {
	CodexHomePath string `json:"codexHomePath"`
	AuthFilePath  string `json:"authFilePath"`
	ConfigPath    string `json:"configPath"`
}

func NewApp() *App {
	return &App{
		core: wailsapp.New(Version, ReleaseLabel, GitHubRepo),
	}
}

func (a *App) startup(ctx context.Context) {
	a.core.Startup(ctx)
}

func (a *App) shutdown(ctx context.Context) {
	a.core.Shutdown()
}

func (a *App) GetSidecarStatus() sidecar.Status {
	return a.core.GetSidecarStatus()
}

func (a *App) GetVersion() string {
	return a.core.GetVersion()
}

func (a *App) GetReleaseLabel() string {
	return a.core.GetReleaseLabel()
}

func (a *App) CanApplyUpdate() bool {
	return a.core.CanApplyUpdate()
}

func (a *App) CheckUpdate() (*updater.ReleaseInfo, error) {
	return a.core.CheckUpdate()
}

func (a *App) ApplyUpdate() error {
	return a.core.ApplyUpdate()
}

func (a *App) ListAuthFiles() (*AuthFilesResponse, error) {
	result, err := a.core.ListAuthFiles()
	if err != nil {
		return nil, err
	}

	files := make([]AuthFileItem, 0, len(result.Files))
	for _, file := range result.Files {
		files = append(files, AuthFileItem{
			Name:          file.Name,
			Type:          file.Type,
			Provider:      file.Provider,
			Email:         file.Email,
			PlanType:      file.PlanType,
			Size:          file.Size,
			AuthIndex:     file.AuthIndex,
			RuntimeOnly:   file.RuntimeOnly,
			Disabled:      file.Disabled,
			Unavailable:   file.Unavailable,
			Status:        file.Status,
			StatusMessage: file.StatusMessage,
			LastRefresh:   file.LastRefresh,
			Modified:      file.Modified,
		})
	}

	return &AuthFilesResponse{
		Files: files,
		Total: result.Total,
	}, nil
}

func (a *App) SetAuthFileStatus(name string, disabled bool) error {
	return a.core.SetAuthFileStatus(name, disabled)
}

func (a *App) DeleteAuthFiles(names []string) error {
	return a.core.DeleteAuthFiles(names)
}

func (a *App) UploadAuthFiles(files []UploadFilePayload) error {
	payload := make([]wailsapp.UploadFilePayload, 0, len(files))
	for _, file := range files {
		payload = append(payload, wailsapp.UploadFilePayload{
			Name:          file.Name,
			ContentBase64: file.ContentBase64,
		})
	}
	return a.core.UploadAuthFiles(payload)
}

func (a *App) GetAuthFileModels(name string) ([]map[string]interface{}, error) {
	return a.core.GetAuthFileModels(name)
}

func (a *App) DownloadAuthFile(name string) (*DownloadFileResponse, error) {
	result, err := a.core.DownloadAuthFile(name)
	if err != nil {
		return nil, err
	}
	return &DownloadFileResponse{
		Name:          result.Name,
		ContentBase64: result.ContentBase64,
	}, nil
}

func (a *App) GetCodexQuota(name string) (*CodexQuotaResponse, error) {
	result, err := a.core.GetCodexQuota(name)
	if err != nil {
		return nil, err
	}

	windows := make([]CodexQuotaWindow, 0, len(result.Windows))
	for _, window := range result.Windows {
		windows = append(windows, CodexQuotaWindow{
			ID:               window.ID,
			Label:            window.Label,
			RemainingPercent: window.RemainingPercent,
			ResetLabel:       window.ResetLabel,
			ResetAtUnix:      window.ResetAtUnix,
		})
	}

	return &CodexQuotaResponse{
		PlanType: result.PlanType,
		Windows:  windows,
	}, nil
}

func (a *App) ListAccounts() ([]AccountRecord, error) {
	result, err := a.core.ListAccounts()
	if err != nil {
		return nil, err
	}

	records := make([]AccountRecord, 0, len(result))
	for _, record := range result {
		records = append(records, mapAccountRecord(record))
	}
	return records, nil
}

func (a *App) GetRelayServiceConfig() (*RelayServiceConfig, error) {
	result, err := a.core.GetRelayServiceConfig()
	if err != nil {
		return nil, err
	}

	return &RelayServiceConfig{
		APIKeys:   append([]string(nil), result.APIKeys...),
		Endpoints: mapRelayServiceEndpoints(result.Endpoints),
	}, nil
}

func (a *App) UpdateRelayServiceAPIKey(apiKey string) (*RelayServiceConfig, error) {
	result, err := a.core.UpdateRelayServiceAPIKey(apiKey)
	if err != nil {
		return nil, err
	}

	return &RelayServiceConfig{
		APIKeys:   append([]string(nil), result.APIKeys...),
		Endpoints: mapRelayServiceEndpoints(result.Endpoints),
	}, nil
}

func (a *App) UpdateRelayServiceAPIKeys(apiKeys []string) (*RelayServiceConfig, error) {
	result, err := a.core.UpdateRelayServiceAPIKeys(apiKeys)
	if err != nil {
		return nil, err
	}

	return &RelayServiceConfig{
		APIKeys:   append([]string(nil), result.APIKeys...),
		Endpoints: mapRelayServiceEndpoints(result.Endpoints),
	}, nil
}

func (a *App) GetRelayRoutingConfig() (*RelayRoutingConfig, error) {
	result, err := a.core.GetRelayRoutingConfig()
	if err != nil {
		return nil, err
	}

	return &RelayRoutingConfig{
		Strategy:            result.Strategy,
		SessionAffinity:     result.SessionAffinity,
		SessionAffinityTTL:  result.SessionAffinityTTL,
		RequestRetry:        result.RequestRetry,
		MaxRetryCredentials: result.MaxRetryCredentials,
		MaxRetryInterval:    result.MaxRetryInterval,
		SwitchProject:       result.SwitchProject,
		SwitchPreviewModel:  result.SwitchPreviewModel,
		AntigravityCredits:  result.AntigravityCredits,
	}, nil
}

func (a *App) ApplyRelayServiceConfigToLocal(apiKey string, baseURL string) (*RelayLocalApplyResult, error) {
	result, err := a.core.ApplyRelayServiceConfigToLocal(apiKey, baseURL)
	if err != nil {
		return nil, err
	}

	return &RelayLocalApplyResult{
		CodexHomePath: result.CodexHomePath,
		AuthFilePath:  result.AuthFilePath,
		ConfigPath:    result.ConfigPath,
	}, nil
}

func (a *App) CreateCodexAPIKey(input CreateCodexAPIKeyInput) error {
	return a.core.CreateCodexAPIKey(wailsapp.CreateCodexAPIKeyInput{
		APIKey:         input.APIKey,
		BaseURL:        input.BaseURL,
		Prefix:         input.Prefix,
		ProxyURL:       input.ProxyURL,
		Headers:        input.Headers,
		ExcludedModels: input.ExcludedModels,
	})
}

func (a *App) DeleteCodexAPIKey(id string) error {
	return a.core.DeleteCodexAPIKey(id)
}

func mapAccountRecord(record accountsdomain.AccountRecord) AccountRecord {
	return AccountRecord{
		ID:               record.ID,
		Provider:         record.Provider,
		CredentialSource: record.CredentialSource,
		DisplayName:      record.DisplayName,
		Status:           record.Status,
		Disabled:         record.Disabled,
		Email:            record.Email,
		PlanType:         record.PlanType,
		Name:             record.Name,
		APIKey:           record.APIKey,
		KeyFingerprint:   record.KeyFingerprint,
		KeySuffix:        record.KeySuffix,
		BaseURL:          record.BaseURL,
		Prefix:           record.Prefix,
		AuthIndex:        record.AuthIndex,
		QuotaKey:         record.QuotaKey,
		LocalOnly:        record.LocalOnly,
	}
}

func mapRelayServiceEndpoints(items []wailsapp.RelayServiceEndpoint) []RelayServiceEndpoint {
	endpoints := make([]RelayServiceEndpoint, 0, len(items))
	for _, item := range items {
		endpoints = append(endpoints, RelayServiceEndpoint{
			ID:      item.ID,
			Kind:    item.Kind,
			Host:    item.Host,
			BaseURL: item.BaseURL,
		})
	}
	return endpoints
}
