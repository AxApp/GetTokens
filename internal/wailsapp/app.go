package wailsapp

import (
	"context"
	"io"
	"net/url"
	"sync"
	"time"

	"github.com/linhay/gettokens/internal/cliproxyapi"
	"github.com/linhay/gettokens/internal/codexbinary"
	"github.com/linhay/gettokens/internal/menubar"
	"github.com/linhay/gettokens/internal/sidecar"
	"github.com/linhay/gettokens/internal/sparkle"
	"github.com/linhay/gettokens/internal/updater"
)

type App struct {
	ctx                      context.Context
	sidecar                  *sidecar.Manager
	updater                  *updater.Updater
	version                  string
	releaseLabel             string
	sidecarRequest           sidecarRequestFunc
	relayRequest             sidecarRelayRequestFunc
	managementAPI            func() *cliproxyapi.Client
	sidecarProxyMu           sync.Mutex
	sidecarProxyPendingApply bool
	localUsageMu             sync.RWMutex
	localUsage               localUsageRuntimeState
	claudeLocalUsage         localUsageRuntimeState
	sessionMgmtMu            sync.RWMutex
	sessionMgmt              sessionManagementRuntimeState
	codexBinary              *codexbinary.Service
	menuBar                  *menubar.Controller
}

type localUsageRuntimeState struct {
	cachedResponse *LocalProjectedUsageResponse
	cachedAt       time.Time
	lastRefreshAt  time.Time
	refreshRunning bool
}

type sessionManagementRuntimeState struct {
	cachedSnapshot *SessionManagementSnapshot
	cachedAt       time.Time
	refreshRunning bool
}

type sidecarRequestFunc func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error)
type sidecarRelayRequestFunc func(method string, path string, body io.Reader, contentType string, apiKey string, headers map[string]string) ([]byte, int, map[string][]string, error)

func New(version string, releaseLabel string, repo string) *App {
	return &App{
		sidecar:      sidecar.NewManager(),
		updater:      updater.New(repo, version),
		version:      version,
		releaseLabel: releaseLabel,
		codexBinary:  codexbinary.NewService(codexbinary.ServiceOptions{}),
		menuBar:      menubar.NewController(),
	}
}

func usesNativeUpdaterUI() bool {
	return sparkle.Available()
}
