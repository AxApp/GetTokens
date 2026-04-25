package wailsapp

import (
	"context"

	"github.com/linhay/gettokens/internal/sidecar"
	"github.com/linhay/gettokens/internal/updater"
)

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
