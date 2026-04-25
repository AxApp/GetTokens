package wailsapp

import (
	"context"

	"github.com/linhay/gettokens/internal/sidecar"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

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
