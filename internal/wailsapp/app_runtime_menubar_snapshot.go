package wailsapp

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
	"github.com/linhay/gettokens/internal/cliproxyapi"
)

type menuBarQuotaSnapshot struct {
	Summary   menuBarQuotaSummary    `json:"summary"`
	Resources []menuBarQuotaResource `json:"resources"`
	Balances  []menuBarQuotaBalance  `json:"balances"`
}

type menuBarQuotaSummary struct {
	LowestQuota   string `json:"lowestQuota"`
	RiskAccounts  string `json:"riskAccounts"`
	RiskSummary   string `json:"riskSummary"`
	MoreRiskLabel string `json:"moreRiskLabel"`
	TotalBalance  string `json:"totalBalance"`
	RefreshLabel  string `json:"refreshLabel"`
}

type menuBarQuotaResource struct {
	Name        string  `json:"name"`
	Detail      string  `json:"detail"`
	PercentText string  `json:"percentText"`
	Percent     float64 `json:"percent"`
	Window      string  `json:"window"`
	Balance     string  `json:"balance"`
	State       string  `json:"state"`
	Tone        string  `json:"tone"`
}

type menuBarQuotaBalance struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

type menuBarQuotaCandidate struct {
	resource     menuBarQuotaResource
	accountKey   string
	remaining    int
	updatedLabel string
	risky        bool
}

func (a *App) refreshMenuBarQuotaSnapshot() {
	if a == nil || a.menuBar == nil || !a.hasManagementClient() {
		return
	}
	statuses, err := a.GetAllQuotaStatuses()
	if err != nil {
		log.Printf("menu bar quota snapshot read failed: %v", err)
		a.setMenuBarQuotaSnapshot(menuBarEmptyQuotaSnapshot())
		return
	}
	accounts, err := a.ListAccounts()
	if err != nil {
		log.Printf("menu bar account snapshot read failed: %v", err)
		accounts = []accountsdomain.AccountRecord{}
	}
	snapshot := buildMenuBarQuotaSnapshot(statuses, accounts)
	a.setMenuBarQuotaSnapshot(snapshot)
}

func (a *App) refreshMenuBarQuotaSnapshotActive() {
	if a == nil || a.menuBar == nil || !a.hasManagementClient() {
		return
	}
	client := a.managementClient()
	accounts, err := client.ListAccounts()
	if err != nil {
		log.Printf("menu bar active quota refresh list accounts failed: %v", err)
		a.refreshMenuBarQuotaSnapshot()
		return
	}
	for _, account := range accounts {
		if !menuBarAccountCanRefreshQuota(account) {
			continue
		}
		if _, err := client.RefreshQuota(account.AccountKey, true, false); err != nil {
			log.Printf("menu bar active quota refresh failed for %s: %v", account.AccountKey, err)
		}
	}
	a.refreshMenuBarQuotaSnapshot()
}

func (a *App) setMenuBarQuotaSnapshot(snapshot menuBarQuotaSnapshot) {
	body, err := json.Marshal(snapshot)
	if err != nil {
		log.Printf("menu bar quota snapshot marshal failed: %v", err)
		return
	}
	a.menuBar.SetQuotaSnapshot(string(body))
}

func menuBarEmptyQuotaSnapshot() menuBarQuotaSnapshot {
	return menuBarQuotaSnapshot{
		Summary: menuBarQuotaSummary{
			LowestQuota:   "--%",
			RiskAccounts:  "--",
			RiskSummary:   "暂无风险账号",
			MoreRiskLabel: "",
			TotalBalance:  "--",
			RefreshLabel:  "--:--",
		},
		Resources: []menuBarQuotaResource{},
		Balances:  []menuBarQuotaBalance{},
	}
}

func menuBarAccountCanRefreshQuota(account cliproxyapi.UnifiedAccount) bool {
	if account.Disabled || strings.TrimSpace(account.AccountKey) == "" {
		return false
	}
	switch account.Kind {
	case cliproxyapi.AccountKindCodexAPIKey:
		return account.CodexAPIKey != nil &&
			((account.CodexAPIKey.QuotaEnabled && strings.TrimSpace(account.CodexAPIKey.QuotaCurl) != "") ||
				(account.CodexAPIKey.BillingEnabled && strings.TrimSpace(account.CodexAPIKey.BillingCurl) != ""))
	case cliproxyapi.AccountKindOpenAICompatible:
		return account.OpenAICompatible != nil &&
			((account.OpenAICompatible.QuotaEnabled && strings.TrimSpace(account.OpenAICompatible.QuotaCurl) != "") ||
				(account.OpenAICompatible.BillingEnabled && strings.TrimSpace(account.OpenAICompatible.BillingCurl) != ""))
	default:
		return false
	}
}

func buildMenuBarQuotaSnapshot(statuses []cliproxyapi.QuotaRuntimeState, accounts []accountsdomain.AccountRecord) menuBarQuotaSnapshot {
	snapshot := menuBarEmptyQuotaSnapshot()
	accountNames := menuBarAccountNames(accounts)
	candidates := make([]menuBarQuotaCandidate, 0)
	balances := make([]menuBarQuotaBalance, 0)
	balanceSummary := menuBarBalanceAccumulator{}
	lowest := math.MaxInt
	latestRefresh := ""
	riskAccounts := map[string]struct{}{}

	for _, status := range statuses {
		accountKey := strings.TrimSpace(status.AccountKey)
		displayName := accountNames[accountKey]
		if displayName == "" {
			displayName = accountKey
		}
		if displayName == "" {
			displayName = "quota account"
		}
		if label := menuBarLatestLabel(status.UpdatedAt, status.LastEvaluatedAt); label != "--:--" {
			latestRefresh = label
		}
		balanceText := menuBarFirstBalanceText(status.Billing)
		if balanceText != "" {
			balances = append(balances, menuBarQuotaBalance{
				Label: displayName,
				Value: balanceText,
			})
			balanceSummary.add(status.Billing)
		}
		for _, window := range status.Windows {
			if window.RemainingPercent == nil {
				continue
			}
			remaining := clampPercent(*window.RemainingPercent)
			if remaining < lowest {
				lowest = remaining
			}
			tone, state, risky := menuBarQuotaToneState(status, remaining)
			if risky && accountKey != "" {
				riskAccounts[accountKey] = struct{}{}
			}
			candidates = append(candidates, menuBarQuotaCandidate{
				accountKey:   accountKey,
				remaining:    remaining,
				risky:        risky,
				updatedLabel: latestRefresh,
				resource: menuBarQuotaResource{
					Name:        displayName,
					Detail:      menuBarQuotaDetail(window, status),
					PercentText: fmt.Sprintf("%02d%%", remaining),
					Percent:     float64(remaining) / 100,
					Window:      menuBarQuotaWindowLabel(window),
					Balance:     menuBarBalanceLabel(balanceText),
					State:       state,
					Tone:        tone,
				},
			})
		}
	}

	sort.SliceStable(candidates, func(i, j int) bool {
		if candidates[i].remaining == candidates[j].remaining {
			return candidates[i].resource.Name < candidates[j].resource.Name
		}
		return candidates[i].remaining < candidates[j].remaining
	})
	if len(candidates) > 3 {
		candidates = candidates[:3]
	}
	snapshot.Resources = make([]menuBarQuotaResource, 0, len(candidates))
	for _, candidate := range candidates {
		snapshot.Resources = append(snapshot.Resources, candidate.resource)
	}
	if len(balances) > 4 {
		balances = balances[:4]
	}
	snapshot.Balances = balances
	if lowest != math.MaxInt {
		snapshot.Summary.LowestQuota = fmt.Sprintf("%02d%%", lowest)
	}
	if len(riskAccounts) > 0 {
		riskCount := len(riskAccounts)
		snapshot.Summary.RiskAccounts = strconv.Itoa(riskCount)
		snapshot.Summary.RiskSummary = fmt.Sprintf("%d 个风险账号", riskCount)
		if hiddenRiskCount := riskCount - len(candidates); hiddenRiskCount > 0 {
			snapshot.Summary.MoreRiskLabel = fmt.Sprintf("还有 %d 个风险账号", hiddenRiskCount)
		}
	} else if len(statuses) > 0 {
		snapshot.Summary.RiskAccounts = "0"
		snapshot.Summary.RiskSummary = "0 个风险账号"
	}
	if summary := balanceSummary.summary(); summary != "" {
		snapshot.Summary.TotalBalance = summary
	}
	if latestRefresh != "" {
		snapshot.Summary.RefreshLabel = latestRefresh
	}
	return snapshot
}

func menuBarAccountNames(accounts []accountsdomain.AccountRecord) map[string]string {
	names := make(map[string]string, len(accounts)*2)
	for _, account := range accounts {
		name := strings.TrimSpace(account.DisplayName)
		if name == "" {
			name = strings.TrimSpace(account.Name)
		}
		if name == "" {
			name = strings.TrimSpace(account.ID)
		}
		for _, key := range []string{account.ID, account.QuotaKey, account.Name} {
			if trimmed := strings.TrimSpace(key); trimmed != "" && name != "" {
				names[trimmed] = name
			}
		}
	}
	return names
}

func menuBarQuotaToneState(status cliproxyapi.QuotaRuntimeState, remaining int) (string, string, bool) {
	switch {
	case status.Blocked:
		return "bad", "已阻断", true
	case status.Stale || status.Status == cliproxyapi.QuotaRuntimeStatusStale:
		return "warn", "过期", true
	case status.Status == cliproxyapi.QuotaRuntimeStatusError:
		return "bad", "异常", true
	case status.Status == cliproxyapi.QuotaRuntimeStatusDegraded:
		return "warn", "降级", true
	case remaining <= 10:
		return "bad", "需处理", true
	case remaining <= 25:
		return "warn", "偏低", true
	default:
		return "good", "充足", false
	}
}

func menuBarQuotaDetail(window cliproxyapi.QuotaRuntimeWindow, status cliproxyapi.QuotaRuntimeState) string {
	parts := []string{}
	if label := menuBarQuotaWindowLabel(window); label != "--" && label != "" {
		parts = append(parts, label)
	}
	if reset := strings.TrimSpace(window.ResetLabel); reset != "" {
		parts = append(parts, reset)
	} else if latest := menuBarLatestLabel(status.UpdatedAt, status.LastEvaluatedAt); latest != "--:--" {
		parts = append(parts, "updated "+latest)
	}
	if len(parts) == 0 {
		return "quota window"
	}
	return strings.Join(parts, " · ")
}

func menuBarQuotaWindowLabel(window cliproxyapi.QuotaRuntimeWindow) string {
	if label := strings.TrimSpace(window.Label); label != "" {
		return label
	}
	if id := strings.TrimSpace(window.ID); id != "" {
		return strings.ToUpper(strings.ReplaceAll(id, "-", " "))
	}
	return "--"
}

func menuBarLatestLabel(values ...string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if parsed, err := time.Parse(time.RFC3339, trimmed); err == nil {
			return parsed.Local().Format("15:04")
		}
		if parsed, err := time.Parse("2006-01-02T15:04:05.000Z", trimmed); err == nil {
			return parsed.Local().Format("15:04")
		}
		if len(trimmed) >= 16 && strings.Contains(trimmed, "T") {
			return strings.ReplaceAll(trimmed[11:16], ":", ":")
		}
	}
	return "--:--"
}

func menuBarFirstBalanceText(billing *cliproxyapi.QuotaRuntimeBilling) string {
	if billing == nil || len(billing.BalanceInfos) == 0 {
		return ""
	}
	for _, info := range billing.BalanceInfos {
		if text := menuBarFormatBalance(info.Currency, info.TotalBalance); text != "" {
			return text
		}
		if text := menuBarFormatBalance(info.Currency, info.GrantedBalance); text != "" {
			return text
		}
		if text := menuBarFormatBalance(info.Currency, info.ToppedUpBalance); text != "" {
			return text
		}
	}
	return ""
}

func menuBarBalanceLabel(balance string) string {
	if strings.TrimSpace(balance) == "" {
		return "-- 余额"
	}
	return strings.TrimSpace(balance) + " 余额"
}

func menuBarFormatBalance(currency string, amount string) string {
	amount = strings.TrimSpace(amount)
	if amount == "" {
		return ""
	}
	currency = strings.ToUpper(strings.TrimSpace(currency))
	switch currency {
	case "USD", "$":
		return "$" + amount
	case "CNY", "RMB", "¥":
		return "¥" + amount
	case "":
		return amount
	default:
		return currency + " " + amount
	}
}

type menuBarBalanceAccumulator struct {
	byCurrency map[string]float64
	order      []string
}

func (a *menuBarBalanceAccumulator) add(billing *cliproxyapi.QuotaRuntimeBilling) {
	if billing == nil {
		return
	}
	if a.byCurrency == nil {
		a.byCurrency = map[string]float64{}
	}
	for _, info := range billing.BalanceInfos {
		amount, ok := parseMenuBarBalanceAmount(info.TotalBalance)
		if !ok {
			continue
		}
		currency := strings.ToUpper(strings.TrimSpace(info.Currency))
		if currency == "" {
			currency = "BAL"
		}
		if _, exists := a.byCurrency[currency]; !exists {
			a.order = append(a.order, currency)
		}
		a.byCurrency[currency] += amount
	}
}

func (a menuBarBalanceAccumulator) summary() string {
	if len(a.order) == 0 {
		return ""
	}
	parts := make([]string, 0, len(a.order))
	for _, currency := range a.order {
		parts = append(parts, menuBarFormatBalance(currency, trimBalanceNumber(a.byCurrency[currency])))
		if len(parts) == 2 {
			break
		}
	}
	return strings.Join(parts, " + ")
}

func parseMenuBarBalanceAmount(value string) (float64, bool) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return 0, false
	}
	parsed, err := strconv.ParseFloat(strings.ReplaceAll(trimmed, ",", ""), 64)
	if err != nil {
		return 0, false
	}
	return parsed, true
}

func trimBalanceNumber(value float64) string {
	if math.Abs(value-math.Round(value)) < 0.005 {
		return strconv.FormatInt(int64(math.Round(value)), 10)
	}
	return strings.TrimRight(strings.TrimRight(fmt.Sprintf("%.2f", value), "0"), ".")
}

func clampPercent(value int) int {
	if value < 0 {
		return 0
	}
	if value > 100 {
		return 100
	}
	return value
}
