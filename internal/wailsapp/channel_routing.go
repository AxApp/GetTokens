package wailsapp

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
	"github.com/linhay/gettokens/internal/sidecar"
)

const channelRoutingStoreDirName = "channel-routing"

type ChannelRouteMode string

const (
	ChannelRouteModeSequential ChannelRouteMode = "sequential"
	ChannelRouteModeBalanced   ChannelRouteMode = "balanced"
)

type ChannelGroupState struct {
	Enabled    bool `json:"enabled"`
	RouteOrder *int `json:"routeOrder,omitempty"`
}

type ChannelAccountGroup struct {
	ID         string   `json:"id"`
	Name       string   `json:"name,omitempty"`
	Enabled    bool     `json:"enabled"`
	RouteOrder int      `json:"routeOrder,omitempty"`
	AccountIDs []string `json:"accountIDs"`
}

type ChannelRoutingConfig struct {
	Channel                     string                       `json:"channel"`
	RouteMode                   ChannelRouteMode             `json:"routeMode"`
	OrderedAccountIDs           []string                     `json:"orderedAccountIDs"`
	ManualRequestableAccountIDs []string                     `json:"manualRequestableAccountIDs,omitempty"`
	AccountGroups               []ChannelAccountGroup        `json:"accountGroups,omitempty"`
	ChannelGroupStates          map[string]ChannelGroupState `json:"channelGroupStates"`
	ShadowEnabled               bool                         `json:"shadowEnabled,omitempty"`
	ShadowRouteMode             ChannelRouteMode             `json:"shadowRouteMode,omitempty"`
}

type ChannelRoutingConfigMeta struct {
	InvalidModes []string `json:"invalidModes,omitempty"`
}

type ChannelRoutingExplainInput struct {
	Channel              string         `json:"channel,omitempty"`
	RequestedModel       string         `json:"requestedModel,omitempty"`
	TriedAccountIDs      []string       `json:"triedAccountIDs,omitempty"`
	ActiveSessions       map[string]int `json:"activeSessions,omitempty"`
	StickyAccountID      string         `json:"stickyAccountID,omitempty"`
	ProjectKey           string         `json:"projectKey,omitempty"`
	ProjectName          string         `json:"projectName,omitempty"`
	ProjectKeySource     string         `json:"projectKeySource,omitempty"`
	ProjectKeyConfidence string         `json:"projectKeyConfidence,omitempty"`
	ProjectMatchKeys     []string       `json:"projectMatchKeys,omitempty"`
}

type ChannelRoutingExplainResult struct {
	Channel              string                                  `json:"channel"`
	RouteMode            ChannelRouteMode                        `json:"routeMode"`
	RequestedModel       string                                  `json:"requestedModel,omitempty"`
	SelectedAccountID    string                                  `json:"selectedAccountID,omitempty"`
	Candidates           []ChannelRoutingCandidate               `json:"candidates"`
	Filtered             []ChannelRoutingFilteredAccount         `json:"filtered"`
	Steps                []string                                `json:"steps"`
	Meta                 ChannelRoutingConfigMeta                `json:"meta"`
	SnapshotVersion      string                                  `json:"snapshotVersion,omitempty"`
	PolicyVersion        string                                  `json:"policyVersion,omitempty"`
	ProjectCandidatePool *ChannelRoutingProjectCandidatePoolInfo `json:"projectCandidatePool,omitempty"`
	Shadow               *ChannelRoutingShadowDecision           `json:"shadow,omitempty"`
}

type ChannelRoutingProjectCandidatePoolInfo struct {
	Evaluated            bool     `json:"evaluated"`
	Activated            bool     `json:"activated"`
	Reason               string   `json:"reason,omitempty"`
	RuleID               string   `json:"ruleID,omitempty"`
	ProjectKey           string   `json:"projectKey,omitempty"`
	ProjectName          string   `json:"projectName,omitempty"`
	ProjectKeySource     string   `json:"projectKeySource,omitempty"`
	ProjectKeyConfidence string   `json:"projectKeyConfidence,omitempty"`
	AllowAccountIDs      []string `json:"allowAccountIDs,omitempty"`
	FilteredAccountIDs   []string `json:"filteredAccountIDs,omitempty"`
	BeforeCandidateCount int      `json:"beforeCandidateCount,omitempty"`
	AfterCandidateCount  int      `json:"afterCandidateCount,omitempty"`
}

type ChannelRoutingShadowDecision struct {
	Enabled           bool                      `json:"enabled"`
	RouteMode         ChannelRouteMode          `json:"routeMode,omitempty"`
	SelectedAccountID string                    `json:"selectedAccountID,omitempty"`
	Candidates        []ChannelRoutingCandidate `json:"candidates,omitempty"`
	Diff              bool                      `json:"diff"`
	Steps             []string                  `json:"steps,omitempty"`
}

type ChannelRoutingCandidate struct {
	ID             string `json:"id"`
	DisplayName    string `json:"displayName,omitempty"`
	Provider       string `json:"provider,omitempty"`
	RouteOrder     int    `json:"routeOrder,omitempty"`
	GroupID        string `json:"groupID,omitempty"`
	GroupOrder     int    `json:"groupOrder,omitempty"`
	ChannelOrder   int    `json:"channelOrder,omitempty"`
	ActiveSessions int    `json:"activeSessions,omitempty"`
}

type ChannelRoutingFilteredAccount struct {
	ID     string `json:"id"`
	Reason string `json:"reason"`
}

type ChannelRouteEventsInput struct {
	Channel string `json:"channel,omitempty"`
	Limit   int    `json:"limit,omitempty"`
}

type ChannelRouteEvent struct {
	ID                      string           `json:"id"`
	RecordedAt              string           `json:"recordedAt"`
	Channel                 string           `json:"channel"`
	ProjectKey              string           `json:"projectKey,omitempty"`
	ProjectName             string           `json:"projectName,omitempty"`
	ProjectKeySource        string           `json:"projectKeySource,omitempty"`
	ProjectKeyConfidence    string           `json:"projectKeyConfidence,omitempty"`
	RouteMode               ChannelRouteMode `json:"routeMode"`
	SelectedAccountID       string           `json:"selectedAccountID,omitempty"`
	CandidateCount          int              `json:"candidateCount"`
	FilteredCount           int              `json:"filteredCount"`
	SnapshotVersion         string           `json:"snapshotVersion"`
	PolicyVersion           string           `json:"policyVersion"`
	ShadowEnabled           bool             `json:"shadowEnabled,omitempty"`
	ShadowRouteMode         ChannelRouteMode `json:"shadowRouteMode,omitempty"`
	ShadowSelectedAccountID string           `json:"shadowSelectedAccountID,omitempty"`
	ShadowDiff              bool             `json:"shadowDiff,omitempty"`
	Redacted                bool             `json:"redacted"`
}

type ChannelRouteAccountResultInput struct {
	AccountID       string `json:"accountID"`
	StatusCode      int    `json:"statusCode,omitempty"`
	ErrorType       string `json:"errorType,omitempty"`
	Reason          string `json:"reason,omitempty"`
	CooldownSeconds int    `json:"cooldownSeconds,omitempty"`
	Model           string `json:"model,omitempty"`
}

type ChannelAccountRuntimeState struct {
	AccountID string                               `json:"accountID"`
	Sources   map[string]ChannelRuntimeStateSource `json:"sources,omitempty"`
	UpdatedAt string                               `json:"updatedAt,omitempty"`
}

type ChannelRuntimeStateSource struct {
	Source    string `json:"source"`
	Reason    string `json:"reason,omitempty"`
	Model     string `json:"model,omitempty"`
	ExpiresAt string `json:"expiresAt,omitempty"`
	UpdatedAt string `json:"updatedAt,omitempty"`
}

type channelRoutingStore struct {
	Channels      map[string]ChannelRoutingConfig       `json:"channels"`
	Events        []ChannelRouteEvent                   `json:"events,omitempty"`
	NextEventID   int                                   `json:"nextEventID,omitempty"`
	RuntimeStates map[string]ChannelAccountRuntimeState `json:"runtimeStates,omitempty"`
}

type channelRouteSortKey struct {
	GroupOrder   int
	ChannelOrder int
	AccountOrder int
	AccountID    string
}

type channelRouteCandidate struct {
	Account  accountsdomain.AccountRecord
	GroupID  string
	Key      channelRouteSortKey
	Sessions int
}

func (a *App) GetChannelRoutingConfig(channel string) (*ChannelRoutingConfig, error) {
	normalizedChannel, err := normalizeChannelID(channel)
	if err != nil {
		return nil, err
	}
	store, err := loadChannelRoutingStore()
	if err != nil {
		return nil, err
	}
	cfg, ok := store.Channels[normalizedChannel]
	if !ok {
		cfg = defaultChannelRoutingConfig(normalizedChannel)
	}
	normalized, _ := normalizeChannelRoutingConfig(cfg, normalizedChannel)
	return &normalized, nil
}

func (a *App) SaveChannelRoutingConfig(input ChannelRoutingConfig) (*ChannelRoutingConfig, error) {
	channel, err := normalizeChannelID(input.Channel)
	if err != nil {
		return nil, err
	}
	normalized, _ := normalizeChannelRoutingConfig(input, channel)
	store, err := loadChannelRoutingStore()
	if err != nil {
		return nil, err
	}
	store.Channels[channel] = normalized
	if err := saveChannelRoutingStore(store); err != nil {
		return nil, err
	}
	return &normalized, nil
}

func (a *App) ExplainChannelRouting(input ChannelRoutingExplainInput) (*ChannelRoutingExplainResult, error) {
	channel, err := normalizeChannelID(input.Channel)
	if err != nil {
		return nil, err
	}
	cfg, err := a.GetChannelRoutingConfig(channel)
	if err != nil {
		return nil, err
	}
	accounts, err := a.ListAccounts()
	if err != nil {
		return nil, err
	}
	store, err := loadChannelRoutingStore()
	if err != nil {
		return nil, err
	}
	projectRules := []ProjectCandidatePoolRule(nil)
	if channelRoutingExplainShouldLoadProjectRules(input) {
		rules, err := a.ListProjectCandidatePoolRules(channel)
		if err != nil {
			return nil, err
		}
		projectRules = rules
	}
	result := explainChannelRoutingWithProjectCandidatePool(accounts, *cfg, input, store.RuntimeStates, projectRules)
	if err := appendChannelRouteEvent(input, result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (a *App) MarkChannelRouteAccountResult(input ChannelRouteAccountResultInput) (*ChannelAccountRuntimeState, error) {
	return markChannelRouteAccountResult(input, time.Now().UTC())
}

func (a *App) ListChannelRouteEvents(input ChannelRouteEventsInput) ([]ChannelRouteEvent, error) {
	channel := strings.TrimSpace(input.Channel)
	if channel != "" {
		normalized, err := normalizeChannelID(channel)
		if err != nil {
			return nil, err
		}
		channel = normalized
	}
	store, err := loadChannelRoutingStore()
	if err != nil {
		return nil, err
	}
	limit := input.Limit
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	out := make([]ChannelRouteEvent, 0, limit)
	for index := len(store.Events) - 1; index >= 0 && len(out) < limit; index-- {
		event := store.Events[index]
		if channel != "" && event.Channel != channel {
			continue
		}
		out = append(out, event)
	}
	return out, nil
}

func explainChannelRoutingWithAccounts(accounts []accountsdomain.AccountRecord, cfg ChannelRoutingConfig, input ChannelRoutingExplainInput) ChannelRoutingExplainResult {
	return explainChannelRoutingWithRuntime(accounts, cfg, input, nil)
}

func explainChannelRoutingWithRuntime(accounts []accountsdomain.AccountRecord, cfg ChannelRoutingConfig, input ChannelRoutingExplainInput, runtimeStates map[string]ChannelAccountRuntimeState) ChannelRoutingExplainResult {
	return explainChannelRoutingWithProjectCandidatePool(accounts, cfg, input, runtimeStates, nil)
}

func explainChannelRoutingWithProjectCandidatePool(accounts []accountsdomain.AccountRecord, cfg ChannelRoutingConfig, input ChannelRoutingExplainInput, runtimeStates map[string]ChannelAccountRuntimeState, projectRules []ProjectCandidatePoolRule) ChannelRoutingExplainResult {
	normalized, meta := normalizeChannelRoutingConfig(cfg, cfg.Channel)
	result := explainNormalizedChannelRouting(accounts, normalized, input, meta, runtimeStates, projectRules)
	result.SnapshotVersion = channelRoutingSnapshotVersion(normalized)
	result.PolicyVersion = "channel-routing-v1"
	shadowConfig := normalized
	shadowConfig.RouteMode = normalizeShadowRouteMode(normalized.ShadowRouteMode, normalized.RouteMode)
	shadowConfig.ShadowEnabled = false
	shadow := explainNormalizedChannelRouting(accounts, shadowConfig, input, ChannelRoutingConfigMeta{}, runtimeStates, projectRules)
	result.Shadow = &ChannelRoutingShadowDecision{
		Enabled:           true,
		RouteMode:         shadow.RouteMode,
		SelectedAccountID: shadow.SelectedAccountID,
		Candidates:        append([]ChannelRoutingCandidate(nil), shadow.Candidates...),
		Diff:              shadow.SelectedAccountID != result.SelectedAccountID,
		Steps:             append([]string(nil), shadow.Steps...),
	}
	return result
}

func explainNormalizedChannelRouting(accounts []accountsdomain.AccountRecord, normalized ChannelRoutingConfig, input ChannelRoutingExplainInput, meta ChannelRoutingConfigMeta, runtimeStates map[string]ChannelAccountRuntimeState, projectRules []ProjectCandidatePoolRule) ChannelRoutingExplainResult {
	mode := normalized.RouteMode
	steps := []string{"mode:" + string(mode)}
	return decideChannelRoute(accounts, normalized, input, mode, steps, meta, runtimeStates, projectRules)
}

func decideChannelRoute(accounts []accountsdomain.AccountRecord, cfg ChannelRoutingConfig, input ChannelRoutingExplainInput, mode ChannelRouteMode, steps []string, meta ChannelRoutingConfigMeta, runtimeStates map[string]ChannelAccountRuntimeState, projectRules []ProjectCandidatePoolRule) ChannelRoutingExplainResult {
	candidates, filtered := buildChannelRouteablePool(accounts, cfg, input, runtimeStates)
	requestedModel := strings.TrimSpace(input.RequestedModel)
	if requestedModel != "" {
		candidates, filtered = applyRequestedModelExplain(candidates, filtered, requestedModel)
		steps = append(steps, "model:"+requestedModel)
	}
	projectCandidatePool := (*ChannelRoutingProjectCandidatePoolInfo)(nil)
	candidates, filtered, projectCandidatePool = applyProjectCandidatePoolExplain(candidates, filtered, cfg.Channel, input, projectRules)
	if projectCandidatePool != nil && projectCandidatePool.Reason != "" {
		steps = append(steps, projectCandidatePool.Reason)
	}
	candidates = orderChannelRouteCandidatesForMode(candidates, mode)
	steps = append(steps, "candidates:"+intString(len(candidates)))
	selected := ""
	stickyAccountID := strings.TrimSpace(input.StickyAccountID)
	if stickyAccountID != "" {
		if stickyCandidate, ok := findChannelRouteCandidate(candidates, stickyAccountID); ok {
			selected = stickyCandidate.Account.ID
			steps = append(steps, "sticky:hit:"+stickyCandidate.Account.ID)
		} else if reason, ok := findChannelFilteredReason(filtered, stickyAccountID); ok {
			steps = append(steps, "sticky:invalidated:"+reason)
		} else {
			steps = append(steps, "sticky:miss")
		}
	}
	if selected == "" && len(candidates) > 0 {
		selected = candidates[0].Account.ID
	}
	return ChannelRoutingExplainResult{
		Channel:              cfg.Channel,
		RouteMode:            mode,
		RequestedModel:       requestedModel,
		SelectedAccountID:    selected,
		Candidates:           mapChannelRouteCandidates(candidates),
		Filtered:             filtered,
		Steps:                steps,
		Meta:                 meta,
		ProjectCandidatePool: projectCandidatePool,
	}
}

func orderChannelRouteCandidatesForMode(candidates []channelRouteCandidate, mode ChannelRouteMode) []channelRouteCandidate {
	if mode != ChannelRouteModeBalanced || len(candidates) < 2 {
		return candidates
	}
	out := append([]channelRouteCandidate(nil), candidates...)
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Sessions != out[j].Sessions {
			return out[i].Sessions < out[j].Sessions
		}
		return lessChannelRouteSortKey(out[i].Key, out[j].Key)
	})
	return out
}

func applyRequestedModelExplain(candidates []channelRouteCandidate, filtered []ChannelRoutingFilteredAccount, requestedModel string) ([]channelRouteCandidate, []ChannelRoutingFilteredAccount) {
	requestedModel = strings.TrimSpace(requestedModel)
	if requestedModel == "" {
		return candidates, filtered
	}
	kept := make([]channelRouteCandidate, 0, len(candidates))
	for _, candidate := range candidates {
		if channelRouteCandidateSupportsRequestedModel(candidate, requestedModel) {
			kept = append(kept, candidate)
			continue
		}
		filtered = append(filtered, ChannelRoutingFilteredAccount{ID: candidate.Account.ID, Reason: "runtime-model-unavailable"})
	}
	return kept, filtered
}

func channelRouteCandidateSupportsRequestedModel(candidate channelRouteCandidate, requestedModel string) bool {
	requestedModel = strings.TrimSpace(requestedModel)
	if requestedModel == "" {
		return true
	}
	models := candidate.Account.Models
	if len(models) == 0 {
		return true
	}
	for _, model := range models {
		name := strings.TrimSpace(model.Name)
		alias := strings.TrimSpace(model.Alias)
		if name == requestedModel || alias == requestedModel {
			return true
		}
	}
	return false
}

func applyProjectCandidatePoolExplain(candidates []channelRouteCandidate, filtered []ChannelRoutingFilteredAccount, channel string, input ChannelRoutingExplainInput, rules []ProjectCandidatePoolRule) ([]channelRouteCandidate, []ChannelRoutingFilteredAccount, *ChannelRoutingProjectCandidatePoolInfo) {
	if !channelRoutingExplainHasProjectContext(input) {
		return candidates, filtered, nil
	}
	info := &ChannelRoutingProjectCandidatePoolInfo{
		ProjectKey:           strings.TrimSpace(input.ProjectKey),
		ProjectName:          strings.TrimSpace(input.ProjectName),
		ProjectKeySource:     strings.TrimSpace(input.ProjectKeySource),
		ProjectKeyConfidence: strings.TrimSpace(input.ProjectKeyConfidence),
		BeforeCandidateCount: len(candidates),
		AfterCandidateCount:  len(candidates),
	}
	if strings.EqualFold(info.ProjectKeyConfidence, "ambiguous") {
		info.Reason = "project-candidate-pool:not-evaluated:ambiguous-project"
		return candidates, filtered, info
	}
	matchKeys := normalizeIDList(input.ProjectMatchKeys)
	if len(matchKeys) == 0 && info.ProjectKey != "" {
		matchKeys = []string{info.ProjectKey}
	}
	if len(matchKeys) == 0 {
		info.Reason = "project-candidate-pool:not-evaluated:no-project-key"
		return candidates, filtered, info
	}
	info.Evaluated = true
	matches := matchingProjectCandidatePoolExplainRules(rules, channel, matchKeys)
	switch len(matches) {
	case 0:
		info.Reason = "project-candidate-pool:not-matched"
		return candidates, filtered, info
	case 1:
		rule := matches[0]
		info.Activated = true
		info.RuleID = rule.ID
		if info.ProjectName == "" {
			info.ProjectName = rule.ProjectName
		}
		if info.ProjectKeySource == "" {
			info.ProjectKeySource = rule.ProjectKeySource
		}
		if info.ProjectKeyConfidence == "" {
			info.ProjectKeyConfidence = rule.ProjectKeyConfidence
		}
		info.AllowAccountIDs = normalizeIDList(rule.AllowAccountIDs)
		allowed := idSet(info.AllowAccountIDs)
		candidatesByID := make(map[string]channelRouteCandidate, len(candidates))
		kept := make([]channelRouteCandidate, 0, len(candidates))
		for _, candidate := range candidates {
			id := candidate.Account.ID
			if _, ok := allowed[id]; ok {
				if _, exists := candidatesByID[id]; !exists {
					candidatesByID[id] = candidate
				}
				continue
			}
			info.FilteredAccountIDs = append(info.FilteredAccountIDs, id)
			filtered = append(filtered, ChannelRoutingFilteredAccount{ID: id, Reason: "project-candidate-pool"})
		}
		for _, id := range info.AllowAccountIDs {
			if candidate, ok := candidatesByID[id]; ok {
				kept = append(kept, candidate)
			}
		}
		info.AfterCandidateCount = len(kept)
		if len(kept) == 0 {
			info.Reason = "project-candidate-pool:no-routeable-account"
			for index := range filtered {
				if _, ok := allowed[filtered[index].ID]; !ok && filtered[index].Reason == "project-candidate-pool" {
					filtered[index].Reason = "project-candidate-pool-no-routeable-account"
				}
			}
			return kept, filtered, info
		}
		info.Reason = "project-candidate-pool:matched"
		return kept, filtered, info
	default:
		info.Activated = true
		info.Reason = "project-candidate-pool:conflict"
		info.AfterCandidateCount = 0
		for _, candidate := range candidates {
			info.FilteredAccountIDs = append(info.FilteredAccountIDs, candidate.Account.ID)
			filtered = append(filtered, ChannelRoutingFilteredAccount{ID: candidate.Account.ID, Reason: "project-candidate-pool-conflict"})
		}
		return []channelRouteCandidate{}, filtered, info
	}
}

func channelRoutingExplainHasProjectContext(input ChannelRoutingExplainInput) bool {
	return strings.TrimSpace(input.ProjectKey) != "" ||
		strings.TrimSpace(input.ProjectName) != "" ||
		strings.TrimSpace(input.ProjectKeySource) != "" ||
		strings.TrimSpace(input.ProjectKeyConfidence) != "" ||
		len(normalizeIDList(input.ProjectMatchKeys)) > 0
}

func channelRoutingExplainShouldLoadProjectRules(input ChannelRoutingExplainInput) bool {
	if !channelRoutingExplainHasProjectContext(input) {
		return false
	}
	return strings.TrimSpace(input.ProjectKey) != "" || len(normalizeIDList(input.ProjectMatchKeys)) > 0
}

func matchingProjectCandidatePoolExplainRules(rules []ProjectCandidatePoolRule, channel string, matchKeys []string) []ProjectCandidatePoolRule {
	keySet := idSet(matchKeys)
	out := make([]ProjectCandidatePoolRule, 0, 1)
	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}
		if !strings.EqualFold(strings.TrimSpace(rule.Channel), strings.TrimSpace(channel)) {
			continue
		}
		projectKey := strings.TrimSpace(rule.ProjectKey)
		if projectKey == "" {
			continue
		}
		if _, ok := keySet[projectKey]; !ok {
			continue
		}
		out = append(out, rule)
	}
	return out
}

func buildChannelRouteablePool(accounts []accountsdomain.AccountRecord, cfg ChannelRoutingConfig, input ChannelRoutingExplainInput, runtimeStates map[string]ChannelAccountRuntimeState) ([]channelRouteCandidate, []ChannelRoutingFilteredAccount) {
	groupLookup := channelAccountGroupLookup(cfg.AccountGroups, cfg.ChannelGroupStates)
	groupMembership := channelAccountGroupMembership(groupLookup)
	channelOrder := rankIDs(cfg.OrderedAccountIDs)
	manualRequestable := idSet(cfg.ManualRequestableAccountIDs)
	tried := idSet(input.TriedAccountIDs)
	candidates := make([]channelRouteCandidate, 0, len(accounts))
	filtered := make([]ChannelRoutingFilteredAccount, 0)
	for _, account := range accounts {
		account.ID = strings.TrimSpace(account.ID)
		if account.ID == "" {
			continue
		}
		if reason, ok := accountSupportsChannel(account, cfg.Channel); !ok {
			filtered = append(filtered, ChannelRoutingFilteredAccount{ID: account.ID, Reason: reason})
			continue
		}
		if _, ok := tried[account.ID]; ok {
			filtered = append(filtered, ChannelRoutingFilteredAccount{ID: account.ID, Reason: "tried"})
			continue
		}
		if account.Disabled {
			filtered = append(filtered, ChannelRoutingFilteredAccount{ID: account.ID, Reason: "account-disabled"})
			continue
		}
		if reason, blocked := activeRuntimeBlockReason(runtimeStates[account.ID], time.Now().UTC()); blocked {
			filtered = append(filtered, ChannelRoutingFilteredAccount{ID: account.ID, Reason: reason})
			continue
		}
		if reason, ok := accountRequestable(account, manualRequestable); !ok {
			filtered = append(filtered, ChannelRoutingFilteredAccount{ID: account.ID, Reason: reason})
			continue
		}
		groupID, groupOrder, ok, reason := effectiveChannelGroup(account.ID, groupLookup, groupMembership)
		if !ok {
			filtered = append(filtered, ChannelRoutingFilteredAccount{ID: account.ID, Reason: reason})
			continue
		}
		candidates = append(candidates, channelRouteCandidate{
			Account:  account,
			GroupID:  groupID,
			Sessions: input.ActiveSessions[strings.TrimSpace(account.ID)],
			Key: channelRouteSortKey{
				GroupOrder:   groupOrder,
				ChannelOrder: lookupIDRank(channelOrder, account.ID),
				AccountOrder: account.Priority,
				AccountID:    account.ID,
			},
		})
	}
	sort.SliceStable(candidates, func(i, j int) bool {
		return lessChannelRouteSortKey(candidates[i].Key, candidates[j].Key)
	})
	return candidates, filtered
}

func loadChannelRoutingStore() (channelRoutingStore, error) {
	path, err := channelRoutingStorePath()
	if err != nil {
		return channelRoutingStore{}, err
	}
	body, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return defaultChannelRoutingStore(), nil
		}
		return channelRoutingStore{}, err
	}
	var store channelRoutingStore
	if err := json.Unmarshal(body, &store); err != nil {
		return channelRoutingStore{}, err
	}
	if store.Channels == nil {
		store.Channels = map[string]ChannelRoutingConfig{}
	}
	if store.RuntimeStates == nil {
		store.RuntimeStates = map[string]ChannelAccountRuntimeState{}
	}
	for _, channel := range []string{"codex", "claude"} {
		if cfg, ok := store.Channels[channel]; ok {
			normalized, _ := normalizeChannelRoutingConfig(cfg, channel)
			store.Channels[channel] = normalized
		}
	}
	return store, nil
}

func saveChannelRoutingStore(store channelRoutingStore) error {
	path, err := channelRoutingStorePath()
	if err != nil {
		return err
	}
	if store.Channels == nil {
		store.Channels = map[string]ChannelRoutingConfig{}
	}
	pruneManualDisabledRuntimeStates(store.RuntimeStates)
	for _, channel := range []string{"codex", "claude"} {
		if cfg, ok := store.Channels[channel]; ok {
			normalized, _ := normalizeChannelRoutingConfig(cfg, channel)
			store.Channels[channel] = normalized
		}
	}
	body, err := json.MarshalIndent(store, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, body, 0o600)
}

func channelRoutingStorePath() (string, error) {
	configDir, err := sidecar.CurrentProfileConfigDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(configDir, channelRoutingStoreDirName)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	return filepath.Join(dir, "config.json"), nil
}

func clearManualDisabledRuntimeState(accountID string) error {
	accountID = strings.TrimSpace(accountID)
	if accountID == "" {
		return nil
	}
	store, err := loadChannelRoutingStore()
	if err != nil {
		return err
	}
	if store.RuntimeStates == nil {
		store.RuntimeStates = map[string]ChannelAccountRuntimeState{}
	}
	state, ok := store.RuntimeStates[accountID]
	if ok && len(state.Sources) > 0 {
		delete(state.Sources, "manual-disabled")
		if len(state.Sources) == 0 {
			delete(store.RuntimeStates, accountID)
		} else {
			state.UpdatedAt = latestChannelRuntimeStateUpdatedAt(state.Sources)
			store.RuntimeStates[accountID] = state
		}
	}
	return saveChannelRoutingStore(store)
}

func pruneManualDisabledRuntimeStates(states map[string]ChannelAccountRuntimeState) {
	for accountID, state := range states {
		if len(state.Sources) == 0 {
			continue
		}
		delete(state.Sources, "manual-disabled")
		if len(state.Sources) == 0 {
			delete(states, accountID)
			continue
		}
		state.UpdatedAt = latestChannelRuntimeStateUpdatedAt(state.Sources)
		states[accountID] = state
	}
}

func latestChannelRuntimeStateUpdatedAt(sources map[string]ChannelRuntimeStateSource) string {
	latest := ""
	for _, source := range sources {
		if strings.TrimSpace(source.UpdatedAt) > latest {
			latest = strings.TrimSpace(source.UpdatedAt)
		}
	}
	return latest
}

func defaultChannelRoutingStore() channelRoutingStore {
	return channelRoutingStore{
		Channels: map[string]ChannelRoutingConfig{
			"codex":  defaultChannelRoutingConfig("codex"),
			"claude": defaultChannelRoutingConfig("claude"),
		},
		RuntimeStates: map[string]ChannelAccountRuntimeState{},
	}
}

func defaultChannelRoutingConfig(channel string) ChannelRoutingConfig {
	return ChannelRoutingConfig{
		Channel:                     channel,
		RouteMode:                   ChannelRouteModeSequential,
		OrderedAccountIDs:           []string{},
		ManualRequestableAccountIDs: []string{},
		AccountGroups:               []ChannelAccountGroup{},
		ChannelGroupStates:          map[string]ChannelGroupState{},
		ShadowEnabled:               false,
		ShadowRouteMode:             ChannelRouteModeBalanced,
	}
}

func normalizeChannelRoutingConfig(input ChannelRoutingConfig, fallbackChannel string) (ChannelRoutingConfig, ChannelRoutingConfigMeta) {
	channel, err := normalizeChannelID(input.Channel)
	if err != nil {
		channel, _ = normalizeChannelID(fallbackChannel)
	}
	meta := ChannelRoutingConfigMeta{}
	routeMode := normalizeChannelRouteMode(input.RouteMode, ChannelRouteModeSequential, &meta)
	return ChannelRoutingConfig{
		Channel:                     channel,
		RouteMode:                   routeMode,
		OrderedAccountIDs:           normalizeIDList(input.OrderedAccountIDs),
		ManualRequestableAccountIDs: normalizeIDList(input.ManualRequestableAccountIDs),
		AccountGroups:               normalizeChannelAccountGroups(input.AccountGroups),
		ChannelGroupStates:          normalizeChannelGroupStates(input.ChannelGroupStates),
		ShadowEnabled:               input.ShadowEnabled,
		ShadowRouteMode:             normalizeShadowRouteModeWithMeta(input.ShadowRouteMode, routeMode, &meta),
	}, meta
}

func normalizeChannelID(channel string) (string, error) {
	switch strings.TrimSpace(channel) {
	case "codex":
		return "codex", nil
	case "claude":
		return "claude", nil
	default:
		return "", errors.New("channel 只能是 codex 或 claude")
	}
}

func normalizeChannelRouteMode(mode ChannelRouteMode, fallback ChannelRouteMode, meta *ChannelRoutingConfigMeta) ChannelRouteMode {
	switch mode {
	case ChannelRouteModeSequential, ChannelRouteModeBalanced:
		return mode
	default:
		if strings.TrimSpace(string(mode)) != "" {
			appendInvalidMode(meta, string(mode))
		}
	}
	return fallback
}

func normalizeShadowRouteMode(mode ChannelRouteMode, production ChannelRouteMode) ChannelRouteMode {
	switch mode {
	case ChannelRouteModeSequential, ChannelRouteModeBalanced:
		return mode
	default:
		if production == ChannelRouteModeBalanced {
			return ChannelRouteModeSequential
		}
		return ChannelRouteModeBalanced
	}
}

func normalizeShadowRouteModeWithMeta(mode ChannelRouteMode, production ChannelRouteMode, meta *ChannelRoutingConfigMeta) ChannelRouteMode {
	switch mode {
	case ChannelRouteModeSequential, ChannelRouteModeBalanced:
		return mode
	default:
		if strings.TrimSpace(string(mode)) != "" {
			appendInvalidMode(meta, string(mode))
		}
	}
	return normalizeShadowRouteMode("", production)
}

func normalizeChannelAccountGroups(groups []ChannelAccountGroup) []ChannelAccountGroup {
	out := make([]ChannelAccountGroup, 0, len(groups))
	seen := map[string]struct{}{}
	for _, group := range groups {
		id := strings.TrimSpace(group.ID)
		if id == "" {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, ChannelAccountGroup{
			ID:         id,
			Name:       strings.TrimSpace(group.Name),
			Enabled:    group.Enabled,
			RouteOrder: group.RouteOrder,
			AccountIDs: normalizeIDList(group.AccountIDs),
		})
	}
	return out
}

func normalizeChannelGroupStates(states map[string]ChannelGroupState) map[string]ChannelGroupState {
	out := map[string]ChannelGroupState{}
	for rawID, state := range states {
		id := strings.TrimSpace(rawID)
		if id == "" {
			continue
		}
		out[id] = ChannelGroupState{
			Enabled:    state.Enabled,
			RouteOrder: cloneIntPtr(state.RouteOrder),
		}
	}
	return out
}

func channelAccountGroupLookup(groups []ChannelAccountGroup, states map[string]ChannelGroupState) map[string]ChannelAccountGroup {
	out := map[string]ChannelAccountGroup{}
	for _, group := range groups {
		id := strings.TrimSpace(group.ID)
		if id == "" {
			continue
		}
		if state, ok := states[id]; ok {
			group.Enabled = state.Enabled
			if state.RouteOrder != nil {
				group.RouteOrder = *state.RouteOrder
			}
		}
		out[id] = group
	}
	return out
}

func channelAccountGroupMembership(groups map[string]ChannelAccountGroup) map[string][]string {
	out := map[string][]string{}
	for groupID, group := range groups {
		for _, accountID := range normalizeIDList(group.AccountIDs) {
			out[accountID] = append(out[accountID], groupID)
		}
	}
	return out
}

func effectiveChannelGroup(accountID string, groups map[string]ChannelAccountGroup, membership map[string][]string) (string, int, bool, string) {
	groupIDs := membership[accountID]
	if len(groupIDs) == 0 {
		return "", 0, true, ""
	}
	found := false
	bestID := ""
	bestOrder := 0
	for _, groupID := range groupIDs {
		group, ok := groups[groupID]
		if !ok || !group.Enabled {
			continue
		}
		if !found || group.RouteOrder < bestOrder || (group.RouteOrder == bestOrder && groupID < bestID) {
			found = true
			bestID = groupID
			bestOrder = group.RouteOrder
		}
	}
	if !found {
		return "", 0, false, "group-disabled-or-missing"
	}
	return bestID, bestOrder, true, ""
}

func accountSupportsChannel(account accountsdomain.AccountRecord, channel string) (string, bool) {
	switch strings.TrimSpace(strings.ToLower(channel)) {
	case "claude":
		if accountHasFormat(account, accountsdomain.APIFmtAnthropic) {
			return "", true
		}
		return "missing_format:" + accountsdomain.APIFmtAnthropic, false
	default:
		if accountHasFormat(account, "codex") || accountHasFormat(account, accountsdomain.APIFmtOpenAIResponses) ||
			strings.TrimSpace(strings.ToLower(account.Provider)) == "codex" {
			return "", true
		}
		return "missing_format:" + accountsdomain.APIFmtOpenAIResponses, false
	}
}

func accountHasFormat(account accountsdomain.AccountRecord, format string) bool {
	target := strings.TrimSpace(format)
	if target == "" {
		return false
	}
	for _, item := range account.SupportedFormats {
		if strings.TrimSpace(item) == target {
			return true
		}
	}
	return false
}

func accountRequestable(account accountsdomain.AccountRecord, manualRequestable map[string]struct{}) (string, bool) {
	status := strings.TrimSpace(strings.ToLower(account.Status))
	switch status {
	case "active", "local", "ok", "ready":
		return "", true
	case "configured", "":
		if accountHasRequestabilityEvidence(account.Requestability) {
			return "", true
		}
		if _, ok := manualRequestable[account.ID]; ok {
			return "", true
		}
		if account.AccountKind == accountsdomain.AccountKindOpenAICompatible {
			return "", true
		}
		return "waiting-check", false
	case "disabled", "error", "unavailable", "blocked", "cooldown":
		return "account-unrequestable", false
	default:
		return "account-unrequestable", false
	}
}

func accountHasRequestabilityEvidence(requestability accountsdomain.AccountRequestability) bool {
	if requestability.Manual {
		return true
	}
	for _, raw := range requestability.Evidence {
		switch strings.TrimSpace(strings.ToLower(raw)) {
		case "active", "local", "ready", "ok", "verified", "manual", "usage", "quota", "configured-provider":
			return true
		}
	}
	return false
}

func findChannelRouteCandidate(candidates []channelRouteCandidate, accountID string) (channelRouteCandidate, bool) {
	for _, candidate := range candidates {
		if candidate.Account.ID == accountID {
			return candidate, true
		}
	}
	return channelRouteCandidate{}, false
}

func findChannelFilteredReason(filtered []ChannelRoutingFilteredAccount, accountID string) (string, bool) {
	for _, item := range filtered {
		if item.ID == accountID {
			return item.Reason, true
		}
	}
	return "", false
}

func activeRuntimeBlockReason(state ChannelAccountRuntimeState, now time.Time) (string, bool) {
	if len(state.Sources) == 0 {
		return "", false
	}
	for _, source := range []string{"auth-error", "quota-empty", "rate-limit", "cooldown", "model-unavailable", "upstream-error"} {
		entry, ok := state.Sources[source]
		if !ok {
			continue
		}
		if entry.ExpiresAt != "" {
			expiresAt, err := time.Parse(time.RFC3339Nano, entry.ExpiresAt)
			if err == nil && !expiresAt.After(now) {
				continue
			}
		}
		return "runtime-" + source, true
	}
	return "", false
}

func markChannelRouteAccountResult(input ChannelRouteAccountResultInput, now time.Time) (*ChannelAccountRuntimeState, error) {
	accountID := strings.TrimSpace(input.AccountID)
	if accountID == "" {
		return nil, errors.New("accountID is required")
	}
	source, defaultCooldown := channelRuntimeSourceForResult(input)
	if source == "" {
		return nil, errors.New("unsupported channel route result")
	}
	store, err := loadChannelRoutingStore()
	if err != nil {
		return nil, err
	}
	if store.RuntimeStates == nil {
		store.RuntimeStates = map[string]ChannelAccountRuntimeState{}
	}
	state := store.RuntimeStates[accountID]
	state.AccountID = accountID
	if state.Sources == nil {
		state.Sources = map[string]ChannelRuntimeStateSource{}
	}
	if source == "success" {
		for _, transient := range []string{"rate-limit", "cooldown", "upstream-error"} {
			delete(state.Sources, transient)
		}
	} else {
		cooldownSeconds := input.CooldownSeconds
		if cooldownSeconds <= 0 {
			cooldownSeconds = defaultCooldown
		}
		entry := ChannelRuntimeStateSource{
			Source:    source,
			Reason:    strings.TrimSpace(input.Reason),
			Model:     strings.TrimSpace(input.Model),
			UpdatedAt: now.Format(time.RFC3339Nano),
		}
		if cooldownSeconds > 0 {
			entry.ExpiresAt = now.Add(time.Duration(cooldownSeconds) * time.Second).Format(time.RFC3339Nano)
		}
		state.Sources[source] = entry
	}
	state.UpdatedAt = now.Format(time.RFC3339Nano)
	if len(state.Sources) == 0 {
		delete(store.RuntimeStates, accountID)
	} else {
		store.RuntimeStates[accountID] = state
	}
	if err := saveChannelRoutingStore(store); err != nil {
		return nil, err
	}
	return &state, nil
}

func channelRuntimeSourceForResult(input ChannelRouteAccountResultInput) (string, int) {
	errorType := strings.TrimSpace(strings.ToLower(input.ErrorType))
	switch {
	case errorType == "success" || input.StatusCode >= 200 && input.StatusCode < 300:
		return "success", 0
	case input.StatusCode == 401 || errorType == "auth-error" || errorType == "token-expired" || errorType == "credential-invalid":
		return "auth-error", 0
	case input.StatusCode == 429 || errorType == "rate-limit" || errorType == "quota" || errorType == "cooldown":
		return "rate-limit", 60
	case input.StatusCode == 404 && errorType == "model-unavailable" || errorType == "model-unavailable":
		return "model-unavailable", 0
	case input.StatusCode >= 500 || errorType == "upstream-error" || errorType == "timeout" || errorType == "network":
		return "upstream-error", 30
	default:
		return "", 0
	}
}

func selectBalancedChannelCandidate(candidates []channelRouteCandidate) channelRouteCandidate {
	best := candidates[0]
	for _, candidate := range candidates[1:] {
		if candidate.Sessions < best.Sessions || (candidate.Sessions == best.Sessions && lessChannelRouteSortKey(candidate.Key, best.Key)) {
			best = candidate
		}
	}
	return best
}

func mapChannelRouteCandidates(candidates []channelRouteCandidate) []ChannelRoutingCandidate {
	out := make([]ChannelRoutingCandidate, 0, len(candidates))
	for _, candidate := range candidates {
		out = append(out, ChannelRoutingCandidate{
			ID:             candidate.Account.ID,
			DisplayName:    candidate.Account.DisplayName,
			Provider:       candidate.Account.Provider,
			RouteOrder:     candidate.Account.Priority,
			GroupID:        candidate.GroupID,
			GroupOrder:     candidate.Key.GroupOrder,
			ChannelOrder:   candidate.Key.ChannelOrder,
			ActiveSessions: candidate.Sessions,
		})
	}
	return out
}

func lessChannelRouteSortKey(left, right channelRouteSortKey) bool {
	if left.GroupOrder != right.GroupOrder {
		return left.GroupOrder < right.GroupOrder
	}
	if left.ChannelOrder != right.ChannelOrder {
		return left.ChannelOrder < right.ChannelOrder
	}
	if left.AccountOrder != right.AccountOrder {
		return left.AccountOrder < right.AccountOrder
	}
	return left.AccountID < right.AccountID
}

func normalizeIDList(ids []string) []string {
	out := make([]string, 0, len(ids))
	seen := map[string]struct{}{}
	for _, raw := range ids {
		id := strings.TrimSpace(raw)
		if id == "" {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}

func rankIDs(ids []string) map[string]int {
	out := map[string]int{}
	for index, id := range normalizeIDList(ids) {
		out[id] = index
	}
	return out
}

func lookupIDRank(ranks map[string]int, id string) int {
	if rank, ok := ranks[id]; ok {
		return rank
	}
	return 1_000_000
}

func idSet(ids []string) map[string]struct{} {
	out := map[string]struct{}{}
	for _, id := range normalizeIDList(ids) {
		out[id] = struct{}{}
	}
	return out
}

func idListContains(ids []string, target string) bool {
	for _, id := range ids {
		if id == target {
			return true
		}
	}
	return false
}

func cloneIntPtr(value *int) *int {
	if value == nil {
		return nil
	}
	cloned := *value
	return &cloned
}

func appendInvalidMode(meta *ChannelRoutingConfigMeta, mode string) {
	if meta == nil || strings.TrimSpace(mode) == "" || idListContains(meta.InvalidModes, mode) {
		return
	}
	meta.InvalidModes = append(meta.InvalidModes, mode)
}

func intString(value int) string {
	return strconv.Itoa(value)
}

func appendChannelRouteEvent(input ChannelRoutingExplainInput, result ChannelRoutingExplainResult) error {
	store, err := loadChannelRoutingStore()
	if err != nil {
		return err
	}
	store.NextEventID++
	event := ChannelRouteEvent{
		ID:                   fmt.Sprintf("route-%06d", store.NextEventID),
		RecordedAt:           time.Now().UTC().Format(time.RFC3339Nano),
		Channel:              result.Channel,
		ProjectKey:           strings.TrimSpace(input.ProjectKey),
		ProjectName:          strings.TrimSpace(input.ProjectName),
		ProjectKeySource:     strings.TrimSpace(input.ProjectKeySource),
		ProjectKeyConfidence: strings.TrimSpace(input.ProjectKeyConfidence),
		RouteMode:            result.RouteMode,
		SelectedAccountID:    result.SelectedAccountID,
		CandidateCount:       len(result.Candidates),
		FilteredCount:        len(result.Filtered),
		SnapshotVersion:      result.SnapshotVersion,
		PolicyVersion:        result.PolicyVersion,
		Redacted:             true,
	}
	if result.ProjectCandidatePool != nil {
		if event.ProjectKey == "" {
			event.ProjectKey = strings.TrimSpace(result.ProjectCandidatePool.ProjectKey)
		}
		if event.ProjectName == "" {
			event.ProjectName = strings.TrimSpace(result.ProjectCandidatePool.ProjectName)
		}
		if event.ProjectKeySource == "" {
			event.ProjectKeySource = strings.TrimSpace(result.ProjectCandidatePool.ProjectKeySource)
		}
		if event.ProjectKeyConfidence == "" {
			event.ProjectKeyConfidence = strings.TrimSpace(result.ProjectCandidatePool.ProjectKeyConfidence)
		}
	}
	if result.Shadow != nil && result.Shadow.Enabled {
		event.ShadowEnabled = true
		event.ShadowRouteMode = result.Shadow.RouteMode
		event.ShadowSelectedAccountID = result.Shadow.SelectedAccountID
		event.ShadowDiff = result.Shadow.Diff
	}
	store.Events = append(store.Events, event)
	if len(store.Events) > 200 {
		store.Events = append([]ChannelRouteEvent(nil), store.Events[len(store.Events)-200:]...)
	}
	return saveChannelRoutingStore(store)
}

func channelRoutingSnapshotVersion(cfg ChannelRoutingConfig) string {
	body, err := json.Marshal(cfg)
	if err != nil {
		return "snapshot-error"
	}
	sum := sha256.Sum256(body)
	return fmt.Sprintf("sha256:%x", sum[:6])
}
