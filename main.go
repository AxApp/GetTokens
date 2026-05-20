package main

import (
	"embed"
	"log"
	"os"

	wailsapp "github.com/linhay/gettokens/internal/wailsapp"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	var loginItemLaunch bool
	os.Args, loginItemLaunch = consumeLoginItemArg(os.Args)

	app := NewApp()

	err := wails.Run(&options.App{
		Title:            "GetTokens",
		Width:            1200,
		Height:           800,
		MinWidth:         800,
		MinHeight:        600,
		StartHidden:      loginItemLaunch && wailsapp.LoginItemLaunchStartHidden(),
		BackgroundColour: &options.RGBA{R: 18, G: 18, B: 18, A: 1},
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		Menu:          buildApplicationMenu(app),
		OnStartup:     app.startup,
		OnShutdown:    app.shutdown,
		OnBeforeClose: app.beforeClose,
		Bind: []interface{}{
			app,
		},
		Mac: &mac.Options{
			WebviewIsTransparent: true,
			WindowIsTranslucent:  true,
			About: &mac.AboutInfo{
				Title:   "GetTokens",
				Message: "Proxy API management for CLI tools",
			},
		},
	})

	if err != nil {
		log.Fatal("Error:", err)
	}
}

func consumeLoginItemArg(args []string) ([]string, bool) {
	filtered := make([]string, 0, len(args))
	found := false
	for _, arg := range args {
		if arg == wailsapp.GetTokensLoginItemArg {
			found = true
			continue
		}
		filtered = append(filtered, arg)
	}
	return filtered, found
}
