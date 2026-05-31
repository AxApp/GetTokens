package accounts

import (
	"encoding/json"
	"fmt"
	"strings"
)

func BuildCodexQuotaResponseFromUsagePayload(usagePayloadBody []byte, fallbackPlanType string) (*CodexQuotaResponse, error) {
	if quota := tryBuildXiaomiMiMoQuota(usagePayloadBody, fallbackPlanType); quota != nil {
		return quota, nil
	}

	var payload codexUsagePayload
	if err := json.Unmarshal(usagePayloadBody, &payload); err != nil {
		// Not a Codex usage response — try billing format
		if billing := tryBuildBilling(usagePayloadBody); billing != nil {
			return &CodexQuotaResponse{
				PlanType: fallbackPlanType,
				Windows:  nil,
				Billing:  billing,
			}, nil
		}
		return nil, fmt.Errorf("codex 额度响应解析失败: %w", err)
	}

	quota := &CodexQuotaResponse{
		PlanType: normalizePlanType(firstNonEmpty(payload.PlanType, payload.PlanTypeCamel, fallbackPlanType)),
		Windows:  buildCodexQuotaWindows(&payload),
	}

	if billing := tryBuildBilling(usagePayloadBody); billing != nil {
		quota.Billing = billing
	}

	return quota, nil
}

type xiaomiMiMoTokenPlanUsagePayload struct {
	Data struct {
		MonthUsage xiaomiMiMoUsageGroup `json:"monthUsage"`
		Usage      xiaomiMiMoUsageGroup `json:"usage"`
	} `json:"data"`
}

type xiaomiMiMoUsageGroup struct {
	Percent interface{}           `json:"percent"`
	Items   []xiaomiMiMoUsageItem `json:"items"`
}

type xiaomiMiMoUsageItem struct {
	Name    string      `json:"name"`
	Used    interface{} `json:"used"`
	Limit   interface{} `json:"limit"`
	Percent interface{} `json:"percent"`
}

func tryBuildXiaomiMiMoQuota(body []byte, fallbackPlanType string) *CodexQuotaResponse {
	var payload xiaomiMiMoTokenPlanUsagePayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil
	}

	windows := make([]CodexQuotaWindow, 0, 2)
	if window := xiaomiMiMoQuotaWindow("mimo-plan-total-token", "PLAN", payload.Data.Usage, "plan_total_token"); window != nil {
		windows = append(windows, *window)
	}
	if window := xiaomiMiMoQuotaWindow("mimo-month-total-token", "MONTH", payload.Data.MonthUsage, "month_total_token"); window != nil {
		windows = append(windows, *window)
	}
	if len(windows) == 0 {
		return nil
	}

	return &CodexQuotaResponse{
		PlanType: normalizePlanType(firstNonEmpty(fallbackPlanType, "xiaomimimo")),
		Windows:  windows,
	}
}

func xiaomiMiMoQuotaWindow(id string, label string, group xiaomiMiMoUsageGroup, preferredItemName string) *CodexQuotaWindow {
	item := xiaomiMiMoQuotaItem(group, preferredItemName)
	if item == nil {
		return nil
	}

	usedPercent := xiaomiMiMoUsedPercent(*item, group)
	if usedPercent == nil {
		return nil
	}
	remaining := int(roundNumber(clampNumber(100-*usedPercent, 0, 100)))
	usedTokens, limitTokens, remainingTokens := normalizeQuotaTokenProgress(
		numberValue(item.Used),
		numberValue(item.Limit),
		nil,
	)

	return &CodexQuotaWindow{
		ID:               id,
		Label:            label,
		RemainingPercent: &remaining,
		UsedTokens:       usedTokens,
		LimitTokens:      limitTokens,
		RemainingTokens:  remainingTokens,
		ResetLabel:       "-",
	}
}

func xiaomiMiMoQuotaItem(group xiaomiMiMoUsageGroup, preferredName string) *xiaomiMiMoUsageItem {
	for index := range group.Items {
		if strings.EqualFold(strings.TrimSpace(group.Items[index].Name), preferredName) {
			return &group.Items[index]
		}
	}
	for index := range group.Items {
		if xiaomiMiMoItemHasUsage(group.Items[index]) {
			return &group.Items[index]
		}
	}
	return nil
}

func xiaomiMiMoItemHasUsage(item xiaomiMiMoUsageItem) bool {
	for _, value := range []interface{}{item.Used, item.Limit, item.Percent} {
		if parsed := numberValue(value); parsed != nil && *parsed > 0 {
			return true
		}
	}
	return false
}

func xiaomiMiMoUsedPercent(item xiaomiMiMoUsageItem, group xiaomiMiMoUsageGroup) *float64 {
	if percent := numberValue(item.Percent); percent != nil && *percent > 0 {
		return percent
	}
	if percent := numberValue(group.Percent); percent != nil && *percent > 0 {
		return percent
	}

	used := numberValue(item.Used)
	limit := numberValue(item.Limit)
	if used == nil || limit == nil || *limit <= 0 {
		if percent := numberValue(item.Percent); percent != nil {
			return percent
		}
		if percent := numberValue(group.Percent); percent != nil {
			return percent
		}
		return nil
	}
	calculated := (*used / *limit) * 100
	return &calculated
}

type deepseekBalancePayload struct {
	IsAvailable  bool `json:"is_available"`
	BalanceInfos []struct {
		Currency        string `json:"currency"`
		TotalBalance    string `json:"total_balance"`
		GrantedBalance  string `json:"granted_balance"`
		ToppedUpBalance string `json:"topped_up_balance"`
	} `json:"balance_infos"`
}

func tryBuildBilling(body []byte) *CodexQuotaBilling {
	var ds deepseekBalancePayload
	if err := json.Unmarshal(body, &ds); err != nil || len(ds.BalanceInfos) == 0 {
		return nil
	}
	infos := make([]CodexQuotaBalanceInfo, 0, len(ds.BalanceInfos))
	for _, info := range ds.BalanceInfos {
		infos = append(infos, CodexQuotaBalanceInfo{
			Currency:        info.Currency,
			TotalBalance:    info.TotalBalance,
			GrantedBalance:  info.GrantedBalance,
			ToppedUpBalance: info.ToppedUpBalance,
		})
	}
	return &CodexQuotaBilling{
		IsAvailable:  ds.IsAvailable,
		BalanceInfos: infos,
	}
}
