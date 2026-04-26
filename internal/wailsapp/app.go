package wailsapp

import (
	"context"
	"io"
	"net/url"

	"github.com/linhay/gettokens/internal/sidecar"
	"github.com/linhay/gettokens/internal/updater"
)

type App struct {
	ctx            context.Context
	sidecar        *sidecar.Manager
	updater        *updater.Updater
	version        string
	releaseLabel   string
	sidecarRequest sidecarRequestFunc
}

type sidecarRequestFunc func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error)

func New(version string, releaseLabel string, repo string) *App {
	return &App{
		sidecar:      sidecar.NewManager(),
		updater:      updater.New(repo, version),
		version:      version,
		releaseLabel: releaseLabel,
	}
}
