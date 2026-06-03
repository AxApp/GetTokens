package wailsapp

import "github.com/linhay/gettokens/internal/cliproxyapi"

type RateLimitStrategyMeta = cliproxyapi.RateLimitStrategyMeta
type RateLimitRule = cliproxyapi.RateLimitRule
type RateLimitRuleState = cliproxyapi.RateLimitRuleState
type RateLimitSourceState = cliproxyapi.RateLimitSourceState
type RateLimitState = cliproxyapi.RateLimitState
type RateLimitEvent = cliproxyapi.RateLimitEvent
type AccountStoreDiagnostics = cliproxyapi.AccountStoreDiagnostics
type AccountStoreReadRecoveryDiagnostics = cliproxyapi.AccountStoreReadRecoveryDiagnostics

func (a *App) GetAccountStoreDiagnostics() (*AccountStoreDiagnostics, error) {
	return a.managementClient().GetAccountStoreDiagnostics()
}

func (a *App) ListRateLimitStrategies() ([]RateLimitStrategyMeta, error) {
	return a.managementClient().ListRateLimitStrategies()
}

func (a *App) ListRateLimitRules(accountKey string) ([]RateLimitRule, error) {
	return a.managementClient().ListRateLimitRules(accountKey)
}

func (a *App) CreateRateLimitRule(rule RateLimitRule) ([]RateLimitRule, error) {
	return a.managementClient().CreateRateLimitRule(rule)
}

func (a *App) UpdateRateLimitRule(rule RateLimitRule) ([]RateLimitRule, error) {
	return a.managementClient().UpdateRateLimitRule(rule)
}

func (a *App) DeleteRateLimitRule(id string) error {
	return a.managementClient().DeleteRateLimitRule(id)
}

func (a *App) GetAllRateLimitStatuses() ([]RateLimitState, error) {
	return a.managementClient().GetAllRateLimitStatuses()
}

func (a *App) GetRateLimitStatus(accountKey string) (*RateLimitState, error) {
	return a.managementClient().GetRateLimitStatus(accountKey)
}

func (a *App) ListRateLimitEvents(accountKey string, limit int) ([]RateLimitEvent, error) {
	return a.managementClient().ListRateLimitEvents(accountKey, limit)
}
