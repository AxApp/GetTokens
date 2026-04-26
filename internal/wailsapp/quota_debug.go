package wailsapp

import (
	"strings"
	"time"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) emitCodexQuotaDebugRecord(record accountsdomain.CodexQuotaDebugRecord) {
	if a.ctx == nil {
		return
	}
	endedAt := record.EndedAt
	if endedAt.IsZero() {
		endedAt = time.Now()
	}
	status := "success"
	if strings.TrimSpace(record.Error) != "" {
		status = "error"
	}
	wailsRuntime.EventsEmit(a.ctx, "debug:entry", map[string]interface{}{
		"name":       "GET https://chatgpt.com/backend-api/wham/usage",
		"transport":  "http",
		"status":     status,
		"request":    record.Request,
		"response":   record.Response,
		"error":      record.Error,
		"startedAt":  record.StartedAt.Format(time.RFC3339Nano),
		"endedAt":    endedAt.Format(time.RFC3339Nano),
		"durationMs": record.DurationMs,
	})
}
