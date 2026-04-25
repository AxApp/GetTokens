package wailsapp

import (
	"context"
	"log"

	"github.com/linhay/gettokens/internal/sidecar"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx

	go func() {
		a.sidecar.Start(ctx, func(status sidecar.Status) {
			if status.Code == sidecar.StatusReady {
				go func() {
					if err := a.syncStoredCodexAPIKeysToSidecar(); err != nil {
						log.Printf("sync codex api keys to sidecar failed: %v", err)
					}
				}()
			}
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
