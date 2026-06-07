package wailsapp

import (
	"log"
	"strconv"

	"github.com/linhay/gettokens/internal/menubar"
	"github.com/linhay/gettokens/internal/sidecar"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) applyMenuBarSettings(settings AppRuntimeSettings) {
	if a == nil || a.menuBar == nil {
		return
	}
	if !normalizeAppRuntimeSettings(&settings).ShowMenuBarIcon {
		a.menuBar.Stop()
		return
	}
	if a.ctx == nil {
		return
	}
	if err := a.menuBar.Start(menubar.Callbacks{
		DisplayName: a.menuBarDisplayName(),
		OpenWindow: func() {
			wailsRuntime.Show(a.ctx)
			wailsRuntime.WindowShow(a.ctx)
			wailsRuntime.EventsEmit(a.ctx, "menubar:navigate", map[string]string{"page": "accounts"})
		},
		RefreshSnapshot: func() {
			go a.refreshMenuBarQuotaSnapshotActive()
		},
		Quit: func() {
			wailsRuntime.Quit(a.ctx)
		},
	}); err != nil {
		log.Printf("start menu bar resident failed: %v", err)
	}
	a.updateMenuBarStatus(a.sidecar.CurrentStatus())
	go a.refreshMenuBarQuotaSnapshot()
}

func (a *App) updateMenuBarStatus(status sidecar.Status) {
	if a == nil || a.menuBar == nil {
		return
	}
	label := a.menuBarDisplayName()
	switch status.Code {
	case sidecar.StatusReady:
		if status.Port > 0 {
			label = a.menuBarDisplayName() + ": 服务已就绪 :" + strconv.Itoa(status.Port)
		} else {
			label = a.menuBarDisplayName() + ": 服务已就绪"
		}
	case sidecar.StatusStarting:
		label = a.menuBarDisplayName() + ": 服务启动中"
	case sidecar.StatusError:
		label = a.menuBarDisplayName() + ": 服务异常"
	case sidecar.StatusStopped:
		label = a.menuBarDisplayName() + ": 服务已停止"
	}
	a.menuBar.SetStatus(label)
	if status.Code == sidecar.StatusReady {
		go a.refreshMenuBarQuotaSnapshot()
	}
}

func (a *App) menuBarDisplayName() string {
	if a != nil && a.sidecar != nil && a.sidecar.Profile() == "dev" {
		return "GetTokens Dev"
	}
	return "GetTokens"
}
