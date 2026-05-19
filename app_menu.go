package main

import (
	"log"

	"github.com/wailsapp/wails/v2/pkg/menu"
)

const macOSCheckForUpdatesMenuLabel = "Check for Updates..."

func buildApplicationMenu(app *App) *menu.Menu {
	return buildApplicationMenuWithUpdateAction(func() {
		go app.checkForUpdatesFromMenu()
	})
}

func buildApplicationMenuWithUpdateAction(checkForUpdates func()) *menu.Menu {
	helpMenu := menu.NewMenuFromItems(
		menu.Text(macOSCheckForUpdatesMenuLabel, nil, func(_ *menu.CallbackData) {
			checkForUpdates()
		}),
	)

	return menu.NewMenuFromItems(
		menu.AppMenu(),
		menu.EditMenu(),
		menu.WindowMenu(),
		menu.SubMenu("Help", helpMenu),
	)
}

func (a *App) checkForUpdatesFromMenu() {
	if _, err := a.CheckUpdate(); err != nil {
		log.Printf("check for updates from macOS menu failed: %v", err)
	}
}
