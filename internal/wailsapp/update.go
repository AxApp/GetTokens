package wailsapp

import (
	"github.com/linhay/gettokens/internal/sparkle"
	"github.com/linhay/gettokens/internal/updater"
)

func (a *App) CheckUpdate() (*updater.ReleaseInfo, error) {
	if usesNativeUpdaterUI() {
		return nil, sparkle.CheckForUpdates()
	}
	release, ok, err := a.updater.Check(a.ctx)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, nil
	}
	return release, nil
}

func (a *App) ApplyUpdate() error {
	if usesNativeUpdaterUI() {
		return sparkle.CheckForUpdates()
	}
	return a.updater.Apply(a.ctx)
}
