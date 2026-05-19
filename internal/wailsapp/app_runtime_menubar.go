package wailsapp

import (
	"log"
	"strconv"

	"github.com/linhay/gettokens/internal/menubar"
	"github.com/linhay/gettokens/internal/sidecar"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) applyMenuBarResident(settings AppRuntimeSettings) {
	if a == nil || a.menuBar == nil {
		return
	}
	if normalizeAppRuntimeSettings(&settings).CloseAction != AppCloseActionKeepServiceInMenuBar {
		a.menuBar.Stop()
		return
	}
	if a.ctx == nil {
		return
	}
	if err := a.menuBar.Start(menubar.Callbacks{
		OpenWindow: func() {
			wailsRuntime.Show(a.ctx)
			wailsRuntime.WindowShow(a.ctx)
		},
		CheckForUpdates: func() {
			go func() {
				if _, err := a.CheckUpdate(); err != nil {
					log.Printf("menu bar check update failed: %v", err)
				}
			}()
		},
		Quit: func() {
			wailsRuntime.Quit(a.ctx)
		},
	}); err != nil {
		log.Printf("start menu bar resident failed: %v", err)
	}
	a.updateMenuBarStatus(a.sidecar.CurrentStatus())
}

func (a *App) updateMenuBarStatus(status sidecar.Status) {
	if a == nil || a.menuBar == nil {
		return
	}
	label := "GetTokens"
	switch status.Code {
	case sidecar.StatusReady:
		if status.Port > 0 {
			label = "GetTokens: 服务已就绪 :" + strconv.Itoa(status.Port)
		} else {
			label = "GetTokens: 服务已就绪"
		}
	case sidecar.StatusStarting:
		label = "GetTokens: 服务启动中"
	case sidecar.StatusError:
		label = "GetTokens: 服务异常"
	case sidecar.StatusStopped:
		label = "GetTokens: 服务已停止"
	}
	a.menuBar.SetStatus(label)
}
