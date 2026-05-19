package wailsapp

import (
	"context"
	"log"

	"github.com/linhay/gettokens/internal/sidecar"
	"github.com/linhay/gettokens/internal/sparkle"
	"github.com/linhay/gettokens/internal/updater"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	a.startLocalUsageRefreshLoop(ctx)
	if settings, err := loadAppRuntimeSettings(); err == nil {
		a.applyMenuBarResident(settings)
	} else {
		log.Printf("load app runtime settings failed: %v", err)
	}

	if usesNativeUpdaterUI() {
		if err := sparkle.Start(); err != nil {
			log.Printf("sparkle start failed: %v", err)
		}
	}

	go func() {
		a.sidecar.Start(ctx, func(status sidecar.Status) {
			a.updateMenuBarStatus(status)
			if status.Code == sidecar.StatusReady {
				go func() {
					if err := a.applyPendingSidecarProxySettings(); err != nil {
						log.Printf("apply pending sidecar proxy settings failed: %v", err)
					}
				}()
				go func() {
					if err := a.syncStoredCodexAPIKeysToSidecar(); err != nil {
						log.Printf("sync codex api keys to sidecar failed: %v", err)
					}
				}()
			}
			wailsRuntime.EventsEmit(ctx, "sidecar:status", status)
		})
	}()

	if !usesNativeUpdaterUI() {
		go func() {
			release, ok, err := a.updater.Check(ctx)
			if err != nil || !ok {
				return
			}
			wailsRuntime.EventsEmit(ctx, "updater:available", release)
		}()
	}
}

func (a *App) Shutdown() {
	a.menuBar.Stop()
	a.sidecar.Stop()
}

func (a *App) BeforeClose(ctx context.Context) bool {
	settings, err := loadAppRuntimeSettings()
	if err != nil {
		log.Printf("load app runtime settings before close failed: %v", err)
		return false
	}
	if !a.shouldPreventCloseForRuntimeSettings(settings) {
		return false
	}
	a.applyMenuBarResident(settings)
	wailsRuntime.WindowHide(ctx)
	return true
}

func (a *App) GetSidecarStatus() sidecar.Status {
	return a.sidecar.CurrentStatus()
}

func (a *App) GetVersion() string {
	return a.version
}

func (a *App) GetReleaseLabel() string {
	return a.releaseLabel
}

func (a *App) CanApplyUpdate() bool {
	if usesNativeUpdaterUI() {
		return true
	}
	return updater.SupportsInPlaceApply()
}

func (a *App) UsesNativeUpdaterUI() bool {
	return usesNativeUpdaterUI()
}
