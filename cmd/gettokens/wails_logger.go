package main

import (
	"strings"

	wailslogger "github.com/wailsapp/wails/v2/pkg/logger"
)

type wailsAppLogger struct {
	base                        wailslogger.Logger
	suppressBrowserRuntimeReady bool
}

func newWailsAppLogger(profile string, exePath string) wailslogger.Logger {
	return &wailsAppLogger{
		base:                        wailslogger.NewDefaultLogger(),
		suppressBrowserRuntimeReady: isDevAppProfile(profile, exePath),
	}
}

func (l *wailsAppLogger) Print(message string) {
	l.base.Print(message)
}

func (l *wailsAppLogger) Trace(message string) {
	l.base.Trace(message)
}

func (l *wailsAppLogger) Debug(message string) {
	l.base.Debug(message)
}

func (l *wailsAppLogger) Info(message string) {
	l.base.Info(message)
}

func (l *wailsAppLogger) Warning(message string) {
	l.base.Warning(message)
}

func (l *wailsAppLogger) Error(message string) {
	if l.suppressBrowserRuntimeReady && isBrowserRuntimeReadyNoise(message) {
		return
	}
	l.base.Error(message)
}

func (l *wailsAppLogger) Fatal(message string) {
	l.base.Fatal(message)
}

func isBrowserRuntimeReadyNoise(message string) bool {
	normalized := strings.TrimSpace(message)
	return normalized == "process message error: runtime:ready -> Unknown message from front end: runtime:ready" ||
		normalized == "Unknown message from front end: runtime:ready"
}
