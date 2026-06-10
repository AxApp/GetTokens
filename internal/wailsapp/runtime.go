package wailsapp

import (
	"context"
	"log"
	"time"

	"github.com/linhay/gettokens/internal/sidecar"
	"github.com/linhay/gettokens/internal/sparkle"
	"github.com/linhay/gettokens/internal/updater"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const updateCheckInterval = 6 * time.Hour

type updateAvailabilityCheckFunc func(context.Context) (*updater.ReleaseInfo, bool, error)
type updateAvailabilityEmitFunc func(*updater.ReleaseInfo)

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	a.startLocalUsageRefreshLoop(ctx)
	if settings, err := loadAppRuntimeSettings(); err == nil {
		a.applyMenuBarSettings(settings)
	} else {
		log.Printf("load app runtime settings failed: %v", err)
	}
	go func() {
		if err := applyPersistedCodexModelCatalogCacheSnapshot(); err != nil {
			log.Printf("apply cached Codex model catalog snapshot failed: %v", err)
		}
	}()

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
					if err := a.applyPersistedCodexModelCatalogSyncSetting(); err != nil {
						log.Printf("apply persisted Codex model catalog sync failed: %v", err)
					}
				}()
			}
			wailsRuntime.EventsEmit(ctx, "sidecar:status", status)
		})
	}()

	if !usesNativeUpdaterUI() {
		a.startUpdateAvailabilityLoop(ctx)
	}
}

func (a *App) startUpdateAvailabilityLoop(ctx context.Context) {
	ticker := time.NewTicker(updateCheckInterval)
	go func() {
		defer ticker.Stop()
		runUpdateAvailabilityLoop(ctx, ticker.C, a.updater.Check, func(release *updater.ReleaseInfo) {
			wailsRuntime.EventsEmit(ctx, "updater:available", release)
		})
	}()
}

func runUpdateAvailabilityLoop(
	ctx context.Context,
	ticks <-chan time.Time,
	check updateAvailabilityCheckFunc,
	emit updateAvailabilityEmitFunc,
) {
	checkAndEmitAvailableUpdate(ctx, check, emit)
	for {
		select {
		case <-ctx.Done():
			return
		case _, ok := <-ticks:
			if !ok {
				return
			}
			checkAndEmitAvailableUpdate(ctx, check, emit)
		}
	}
}

func checkAndEmitAvailableUpdate(
	ctx context.Context,
	check updateAvailabilityCheckFunc,
	emit updateAvailabilityEmitFunc,
) {
	if check == nil || emit == nil {
		return
	}

	release, ok, err := check(ctx)
	if err != nil || !ok || release == nil {
		return
	}
	emit(release)
}

func (a *App) Shutdown() {
	a.stopCodexModelCatalogRefreshAfterAccountMutation()
	if err := a.cleanupOwnedCodexModelCatalogProjectionOnShutdown(); err != nil {
		log.Printf("cleanup owned Codex model catalog projection on shutdown failed: %v", err)
	}
	a.menuBar.Stop()
	a.sidecar.Stop()
}

func (a *App) cleanupOwnedCodexModelCatalogProjectionOnShutdown() error {
	_, err := disableGetTokensCodexModelCatalogProjection()
	return err
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
	a.applyMenuBarSettings(settings)
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
	return supportsInPlaceApplyFunc()
}

func (a *App) UsesNativeUpdaterUI() bool {
	return usesNativeUpdaterUI()
}
