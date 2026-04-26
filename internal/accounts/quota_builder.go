package accounts

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

func buildCodexQuotaWindows(payload *codexUsagePayload) []CodexQuotaWindow {
	if payload == nil {
		return []CodexQuotaWindow{}
	}

	windows := make([]CodexQuotaWindow, 0, 6)

	addPair := func(prefix string, labelFive string, labelWeekly string, info *codexRateLimitInfo) {
		fiveHourWindow, weeklyWindow := classifyCodexWindows(info)
		limitReached := boolPtrValue(infoLimitReached(info))
		allowed := infoAllowedValue(info)

		if window := newCodexQuotaWindow(quotaWindowID(prefix, "five-hour"), labelFive, fiveHourWindow, limitReached, allowed); window != nil {
			windows = append(windows, *window)
		}
		if window := newCodexQuotaWindow(quotaWindowID(prefix, "weekly"), labelWeekly, weeklyWindow, limitReached, allowed); window != nil {
			windows = append(windows, *window)
		}
	}

	addPair("", "5H", "7D", firstRateLimit(payload.RateLimit, payload.RateLimitCamel))
	addPair("code-review", "CR 5H", "CR 7D", firstRateLimit(payload.CodeReviewRateLimit, payload.CodeReviewRateCamel))

	for index, limit := range firstAdditionalRateLimits(payload.AdditionalRateLimits, payload.AdditionalRateCamel) {
		name := firstNonEmpty(limit.LimitName, limit.LimitNameCamel, limit.MeteredFeature, limit.MeteredFeatureCam)
		if strings.TrimSpace(name) == "" {
			name = fmt.Sprintf("LIMIT %d", index+1)
		}
		addPair(
			fmt.Sprintf("additional-%d", index+1),
			fmt.Sprintf("%s 5H", name),
			fmt.Sprintf("%s 7D", name),
			firstRateLimit(limit.RateLimit, limit.RateLimitCamel),
		)
	}

	return windows
}

func quotaWindowID(prefix string, suffix string) string {
	if strings.TrimSpace(prefix) == "" {
		return suffix
	}
	return prefix + "-" + suffix
}

func newCodexQuotaWindow(id string, label string, window *codexUsageWindow, limitReached bool, allowed *bool) *CodexQuotaWindow {
	if window == nil {
		return nil
	}

	resetAtUnix := codexResetUnixSeconds(window)
	resetLabel := formatCodexResetLabel(window)
	usedPercent := numberValue(firstNonNil(window.UsedPercent, window.UsedPercentCamel))
	remainingPercent := remainingPercentFromUsed(usedPercent, limitReached, allowed, resetLabel)

	return &CodexQuotaWindow{
		ID:               id,
		Label:            label,
		RemainingPercent: remainingPercent,
		ResetLabel:       resetLabel,
		ResetAtUnix:      resetAtUnix,
	}
}

func classifyCodexWindows(info *codexRateLimitInfo) (*codexUsageWindow, *codexUsageWindow) {
	if info == nil {
		return nil, nil
	}

	primary := firstWindow(info.PrimaryWindow, info.PrimaryWindowCamel)
	secondary := firstWindow(info.SecondWindow, info.SecondWindowCamel)
	raw := []*codexUsageWindow{primary, secondary}

	var fiveHourWindow *codexUsageWindow
	var weeklyWindow *codexUsageWindow

	for _, window := range raw {
		seconds := windowSeconds(window)
		switch seconds {
		case codexFiveHourWindowSeconds:
			if fiveHourWindow == nil {
				fiveHourWindow = window
			}
		case codexWeeklyWindowSeconds:
			if weeklyWindow == nil {
				weeklyWindow = window
			}
		}
	}

	if fiveHourWindow == nil && primary != nil && primary != weeklyWindow {
		fiveHourWindow = primary
	}
	if weeklyWindow == nil && secondary != nil && secondary != fiveHourWindow {
		weeklyWindow = secondary
	}

	return fiveHourWindow, weeklyWindow
}

func infoLimitReached(info *codexRateLimitInfo) *bool {
	if info == nil {
		return nil
	}
	if info.LimitReached != nil {
		return info.LimitReached
	}
	return info.LimitReachedCamel
}

func infoAllowedValue(info *codexRateLimitInfo) *bool {
	if info == nil {
		return nil
	}
	return info.Allowed
}

func firstRateLimit(primary *codexRateLimitInfo, secondary *codexRateLimitInfo) *codexRateLimitInfo {
	if primary != nil {
		return primary
	}
	return secondary
}

func firstWindow(primary *codexUsageWindow, secondary *codexUsageWindow) *codexUsageWindow {
	if primary != nil {
		return primary
	}
	return secondary
}

func firstAdditionalRateLimits(primary []codexAdditionalLimit, secondary []codexAdditionalLimit) []codexAdditionalLimit {
	if len(primary) > 0 {
		return primary
	}
	return secondary
}

func formatCodexResetLabel(window *codexUsageWindow) string {
	resetAtUnix := codexResetUnixSeconds(window)
	if resetAtUnix > 0 {
		return formatUnixSeconds(resetAtUnix)
	}
	return "-"
}

func codexResetUnixSeconds(window *codexUsageWindow) int64 {
	if window == nil {
		return 0
	}

	if resetAt := numberValue(firstNonNil(window.ResetAt, window.ResetAtCamel)); resetAt != nil && *resetAt > 0 {
		return int64(*resetAt)
	}
	if resetAfter := numberValue(firstNonNil(window.ResetAfterSeconds, window.ResetAfterSecondsCam)); resetAfter != nil && *resetAfter > 0 {
		return time.Now().Unix() + int64(*resetAfter)
	}
	return 0
}

func windowSeconds(window *codexUsageWindow) int64 {
	if window == nil {
		return 0
	}
	value := numberValue(firstNonNil(window.LimitWindowSeconds, window.LimitWindowCamel))
	if value == nil {
		return 0
	}
	return int64(*value)
}

func remainingPercentFromUsed(usedPercent *float64, limitReached bool, allowed *bool, resetLabel string) *int {
	if usedPercent != nil {
		remaining := int(roundNumber(clampNumber(100-*usedPercent, 0, 100)))
		return &remaining
	}
	if limitReached || (allowed != nil && !*allowed) {
		if resetLabel == "-" {
			return nil
		}
		remaining := 0
		return &remaining
	}
	return nil
}

func formatUnixSeconds(value int64) string {
	if value <= 0 {
		return "-"
	}
	return time.Unix(value, 0).Format("01/02 15:04")
}

func clampNumber(value float64, min float64, max float64) float64 {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

func roundNumber(value float64) float64 {
	if value >= 0 {
		return float64(int(value + 0.5))
	}
	return float64(int(value - 0.5))
}

func boolPtrValue(value *bool) bool {
	return value != nil && *value
}

func parseCachedCodexQuota(body []byte) *CodexQuotaResponse {
	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil
	}

	usage := nestedMap(nestedMap(nestedMap(payload, "nolon"), "usage_cache"), "usage")
	if len(usage) == 0 {
		return nil
	}

	identity := nestedMap(usage, "identity")
	planType := normalizePlanType(firstNonEmpty(
		stringValue(payload, "plan_type"),
		stringValue(payload, "planType"),
		stringValue(payload, "plan"),
		stringValue(identity, "plan"),
	))

	windows := make([]CodexQuotaWindow, 0, 2)
	for _, spec := range []struct {
		key   string
		id    string
		label string
	}{
		{key: "primary", id: "five-hour", label: "5H"},
		{key: "secondary", id: "weekly", label: "7D"},
	} {
		window := nestedMap(usage, spec.key)
		if len(window) == 0 {
			continue
		}

		usedPercent := numberValue(firstNonNil(window["usedPercent"], window["used_percent"]))
		var remainingPercent *int
		if usedPercent != nil {
			remaining := int(roundNumber(clampNumber(100-*usedPercent, 0, 100)))
			remainingPercent = &remaining
		}

		resetLabel := firstNonEmpty(
			stringValue(window, "resetDescription"),
			stringValue(window, "reset_description"),
		)
		var resetAtUnix int64
		if resetsAt := numberValue(firstNonNil(window["resetsAt"], window["resets_at"])); resetsAt != nil {
			resetAtUnix = int64(*resetsAt)
		}
		if resetLabel == "" && resetAtUnix > 0 {
			resetLabel = formatUnixSeconds(resetAtUnix)
		}
		if resetLabel == "" {
			resetLabel = "-"
		}

		windows = append(windows, CodexQuotaWindow{
			ID:               spec.id,
			Label:            spec.label,
			RemainingPercent: remainingPercent,
			ResetLabel:       resetLabel,
			ResetAtUnix:      resetAtUnix,
		})
	}

	if planType == "" && len(windows) == 0 {
		return nil
	}

	return &CodexQuotaResponse{
		PlanType: planType,
		Windows:  windows,
	}
}
