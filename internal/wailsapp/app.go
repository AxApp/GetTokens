package wailsapp

import (
	"context"
	"io"
	"net/url"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/linhay/gettokens/internal/cliproxyapi"
	"github.com/linhay/gettokens/internal/codexbinary"
	"github.com/linhay/gettokens/internal/menubar"
	"github.com/linhay/gettokens/internal/sidecar"
	"github.com/linhay/gettokens/internal/sparkle"
	"github.com/linhay/gettokens/internal/updater"
)

const nativeUpdaterDisabledDarwinMajor = 26

var usesNativeUpdaterUIFunc = defaultUsesNativeUpdaterUI
var supportsInPlaceApplyFunc = updater.SupportsInPlaceApply

type App struct {
	ctx                              context.Context
	sidecar                          *sidecar.Manager
	updater                          *updater.Updater
	version                          string
	releaseLabel                     string
	sidecarRequest                   sidecarRequestFunc
	relayRequest                     sidecarRelayRequestFunc
	managementAPI                    func() *cliproxyapi.Client
	sidecarProxyMu                   sync.Mutex
	sidecarProxyPendingApply         bool
	authFileCacheMu                  sync.RWMutex
	authFileMetadataCache            map[string]authFileMetadataCacheEntry
	localUsageMu                     sync.RWMutex
	localUsage                       localUsageRuntimeState
	claudeLocalUsage                 localUsageRuntimeState
	sessionMgmtMu                    sync.RWMutex
	sessionMgmt                      sessionManagementRuntimeState
	codexModelCatalogRefreshMu       sync.Mutex
	codexModelCatalogRefreshTimer    *time.Timer
	codexModelCatalogRefreshRunning  bool
	codexModelCatalogRefreshPending  bool
	codexModelCatalogRefreshDebounce time.Duration
	codexModelCatalogRefreshFunc     func() error
	codexBinary                      *codexbinary.Service
	menuBar                          *menubar.Controller
}

type localUsageRuntimeState struct {
	cachedResponse *LocalProjectedUsageResponse
	cachedAt       time.Time
	lastRefreshAt  time.Time
	refreshRunning bool
}

type sessionManagementRuntimeState struct {
	cachedSnapshot    *SessionManagementSnapshot
	cachedAt          time.Time
	refreshRunning    bool
	cachedDetails     map[string]*sessionManagementDetailCacheEntry
	cachedDetailOrder []string
	cachedDetailBytes int
}

type sidecarRequestFunc func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error)
type sidecarRelayRequestFunc func(method string, path string, body io.Reader, contentType string, apiKey string, headers map[string]string) ([]byte, int, map[string][]string, error)

func New(version string, releaseLabel string, repo string) *App {
	return &App{
		sidecar:               sidecar.NewManager(),
		updater:               updater.New(repo, version),
		version:               version,
		releaseLabel:          releaseLabel,
		codexBinary:           codexbinary.NewService(codexbinary.ServiceOptions{}),
		menuBar:               menubar.NewController(),
		authFileMetadataCache: map[string]authFileMetadataCacheEntry{},
	}
}

func usesNativeUpdaterUI() bool {
	return usesNativeUpdaterUIFunc()
}

func defaultUsesNativeUpdaterUI() bool {
	return shouldUseNativeUpdaterUI(runtime.GOOS, sparkle.Available(), currentDarwinProductVersion())
}

func shouldUseNativeUpdaterUI(goos string, sparkleAvailable bool, darwinProductVersion string) bool {
	if !sparkleAvailable || goos != "darwin" {
		return false
	}

	major, err := parseDarwinProductMajorVersion(darwinProductVersion)
	if err != nil {
		return false
	}

	return major < nativeUpdaterDisabledDarwinMajor
}

func currentDarwinProductVersion() string {
	if runtime.GOOS != "darwin" {
		return ""
	}

	output, err := exec.Command("sw_vers", "-productVersion").Output()
	if err != nil {
		return ""
	}

	return strings.TrimSpace(string(output))
}

func parseDarwinProductMajorVersion(version string) (int, error) {
	majorText, _, _ := strings.Cut(strings.TrimSpace(version), ".")
	return strconv.Atoi(majorText)
}
