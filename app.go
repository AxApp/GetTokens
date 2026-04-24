package main

import (
	"context"

	"github.com/linhay/gettokens/internal/sidecar"
	"github.com/linhay/gettokens/internal/updater"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// Version is injected at build time via -ldflags
var Version = "dev"

// GitHubRepo is the repository used for auto-update checks
const GitHubRepo = "linhay/GetTokens"

// App is the main application struct bound to the Wails frontend.
type App struct {
	ctx     context.Context
	sidecar *sidecar.Manager
	updater *updater.Updater
}

// NewApp creates and returns a new App instance.
func NewApp() *App {
	return &App{
		sidecar: sidecar.NewManager(),
		updater: updater.New(GitHubRepo, Version),
	}
}

// startup is called by Wails when the application starts.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Start backend sidecar; notify frontend of status changes.
	go func() {
		a.sidecar.Start(ctx, func(status sidecar.Status) {
			wailsRuntime.EventsEmit(ctx, "sidecar:status", status)
		})
	}()

	// Check for app updates in background.
	go func() {
		release, ok, err := a.updater.Check(ctx)
		if err != nil || !ok {
			return
		}
		wailsRuntime.EventsEmit(ctx, "updater:available", release)
	}()
}

// shutdown is called by Wails when the application is closing.
func (a *App) shutdown(ctx context.Context) {
	a.sidecar.Stop()
}

// --- Wails-bound methods (callable from JS) ---

// GetSidecarStatus returns the current backend status.
func (a *App) GetSidecarStatus() sidecar.Status {
	return a.sidecar.CurrentStatus()
}

// GetVersion returns the client version string.
func (a *App) GetVersion() string {
	return Version
}

// CheckUpdate manually triggers an update check and returns update info.
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

// ApplyUpdate downloads and applies the cached update, then prompts restart.
func (a *App) ApplyUpdate() error {
	return a.updater.Apply(a.ctx)
}
