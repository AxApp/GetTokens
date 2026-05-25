package main

import (
	"log"

	"github.com/linhay/gettokens/internal/appmenu"
	"github.com/wailsapp/wails/v2/pkg/menu"
)

const macOSCheckForUpdatesMenuLabel = "检查更新..."

func buildApplicationMenu(app *App) *menu.Menu {
	return buildApplicationMenuWithUpdateAction(func() {})
}

func buildApplicationMenuWithUpdateAction(checkForUpdates func()) *menu.Menu {
	_ = checkForUpdates

	return menu.NewMenuFromItems(
		menu.AppMenu(),
		menu.EditMenu(),
		menu.WindowMenu(),
	)
}

func installNativeApplicationMenuUpdateItem(app *App) {
	if err := appmenu.InstallCheckForUpdates(macOSCheckForUpdatesMenuLabel, appmenu.Callbacks{
		CheckForUpdates: func() {
			go app.checkForUpdatesFromMenu()
		},
	}); err != nil {
		log.Printf("install macOS check for updates menu item failed: %v", err)
	}
}

func (a *App) checkForUpdatesFromMenu() {
	if _, err := a.CheckUpdate(); err != nil {
		log.Printf("check for updates from macOS menu failed: %v", err)
	}
}
