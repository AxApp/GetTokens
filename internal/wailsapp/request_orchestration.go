package wailsapp

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	requestOrchestrationDirName          = "request-orchestration"
	requestOrchestrationConfigFileName   = "config.json"
	requestOrchestrationSnapshotFileName = "runtime-snapshot.json"
)

type RequestOrchestrationFlowTest struct {
	Status string `json:"status"`
	Time   string `json:"time,omitempty"`
	Reason string `json:"reason,omitempty"`
}

type RequestOrchestrationFlowConfig struct {
	ID                string                        `json:"id"`
	Label             string                        `json:"label"`
	CLI               string                        `json:"cli"`
	GroupID           string                        `json:"groupID"`
	AccountID         string                        `json:"accountID,omitempty"`
	EnabledAccountIDs []string                      `json:"enabledAccountIDs"`
	Routes            map[string]string             `json:"routes,omitempty"`
	Applied           bool                          `json:"applied,omitempty"`
	Test              *RequestOrchestrationFlowTest `json:"test,omitempty"`
}

type RequestOrchestrationAccountOverride struct {
	Disabled         *bool `json:"disabled,omitempty"`
	ProxyPoolEnabled *bool `json:"proxyPoolEnabled,omitempty"`
}

type RequestOrchestrationConfig struct {
	ActiveFlowID     string                                         `json:"activeFlowID"`
	Flows            []RequestOrchestrationFlowConfig               `json:"flows"`
	AccountOverrides map[string]RequestOrchestrationAccountOverride `json:"accountOverrides,omitempty"`
	Routing          *RelayRoutingConfig                            `json:"routing,omitempty"`
}

type RequestOrchestrationAccountState struct {
	ID       string `json:"id"`
	Disabled bool   `json:"disabled"`
}

type RequestOrchestrationSnapshot struct {
	Applied       bool                               `json:"applied"`
	AppliedFlowID string                             `json:"appliedFlowID,omitempty"`
	AppliedAt     string                             `json:"appliedAt,omitempty"`
	Config        RequestOrchestrationConfig         `json:"config"`
	Routing       RelayRoutingConfig                 `json:"routing"`
	Accounts      []RequestOrchestrationAccountState `json:"accounts"`
}

type ApplyRequestOrchestrationResult struct {
	AppliedFlowID string `json:"appliedFlowID,omitempty"`
	EnabledCount  int    `json:"enabledCount,omitempty"`
	DisabledCount int    `json:"disabledCount,omitempty"`
	RestoredCount int    `json:"restoredCount,omitempty"`
	SnapshotPath  string `json:"snapshotPath,omitempty"`
	ConfigPath    string `json:"configPath,omitempty"`
	Message       string `json:"message,omitempty"`
}

func requestOrchestrationDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".config", "gettokens-data", requestOrchestrationDirName)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}
	return dir, nil
}

func requestOrchestrationConfigPath() (string, error) {
	dir, err := requestOrchestrationDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, requestOrchestrationConfigFileName), nil
}

func requestOrchestrationSnapshotPath() (string, error) {
	dir, err := requestOrchestrationDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, requestOrchestrationSnapshotFileName), nil
}

func normalizeRequestOrchestrationConfig(input RequestOrchestrationConfig) RequestOrchestrationConfig {
	flows := make([]RequestOrchestrationFlowConfig, 0, len(input.Flows))
	seenFlowIDs := map[string]struct{}{}
	for _, flow := range input.Flows {
		flow.ID = strings.TrimSpace(flow.ID)
		if flow.ID == "" {
			continue
		}
		if _, ok := seenFlowIDs[flow.ID]; ok {
			continue
		}
		seenFlowIDs[flow.ID] = struct{}{}
		flow.Label = strings.TrimSpace(flow.Label)
		if flow.Label == "" {
			flow.Label = flow.ID
		}
		flow.CLI = strings.TrimSpace(flow.CLI)
		flow.GroupID = strings.TrimSpace(flow.GroupID)
		flow.AccountID = strings.TrimSpace(flow.AccountID)
		flow.EnabledAccountIDs = dedupeTrimmedStrings(flow.EnabledAccountIDs)
		if flow.Routes == nil {
			flow.Routes = map[string]string{}
		}
		flows = append(flows, flow)
	}

	activeFlowID := strings.TrimSpace(input.ActiveFlowID)
	if activeFlowID == "" && len(flows) > 0 {
		activeFlowID = flows[0].ID
	}

	return RequestOrchestrationConfig{
		ActiveFlowID:     activeFlowID,
		Flows:            flows,
		AccountOverrides: input.AccountOverrides,
		Routing:          input.Routing,
	}
}

func dedupeTrimmedStrings(values []string) []string {
	result := make([]string, 0, len(values))
	seen := map[string]struct{}{}
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}

func loadRequestOrchestrationConfig() (RequestOrchestrationConfig, error) {
	path, err := requestOrchestrationConfigPath()
	if err != nil {
		return RequestOrchestrationConfig{}, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return RequestOrchestrationConfig{Flows: []RequestOrchestrationFlowConfig{}}, nil
		}
		return RequestOrchestrationConfig{}, err
	}
	var config RequestOrchestrationConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return RequestOrchestrationConfig{}, err
	}
	return normalizeRequestOrchestrationConfig(config), nil
}

func saveRequestOrchestrationConfig(config RequestOrchestrationConfig) (RequestOrchestrationConfig, error) {
	normalized := normalizeRequestOrchestrationConfig(config)
	path, err := requestOrchestrationConfigPath()
	if err != nil {
		return RequestOrchestrationConfig{}, err
	}
	body, err := json.MarshalIndent(normalized, "", "  ")
	if err != nil {
		return RequestOrchestrationConfig{}, err
	}
	if err := writeFileAtomically(path, append(body, '\n'), 0600); err != nil {
		return RequestOrchestrationConfig{}, err
	}
	return normalized, nil
}

func loadRequestOrchestrationSnapshot() (RequestOrchestrationSnapshot, error) {
	path, err := requestOrchestrationSnapshotPath()
	if err != nil {
		return RequestOrchestrationSnapshot{}, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return RequestOrchestrationSnapshot{}, nil
		}
		return RequestOrchestrationSnapshot{}, err
	}
	var snapshot RequestOrchestrationSnapshot
	if err := json.Unmarshal(data, &snapshot); err != nil {
		return RequestOrchestrationSnapshot{}, err
	}
	return snapshot, nil
}

func saveRequestOrchestrationSnapshot(snapshot RequestOrchestrationSnapshot) (string, error) {
	path, err := requestOrchestrationSnapshotPath()
	if err != nil {
		return "", err
	}
	body, err := json.MarshalIndent(snapshot, "", "  ")
	if err != nil {
		return "", err
	}
	if err := writeFileAtomically(path, append(body, '\n'), 0600); err != nil {
		return "", err
	}
	return path, nil
}

func (a *App) GetRequestOrchestrationConfig() (*RequestOrchestrationConfig, error) {
	config, err := loadRequestOrchestrationConfig()
	if err != nil {
		return nil, err
	}
	return &config, nil
}

func (a *App) SaveRequestOrchestrationConfig(input RequestOrchestrationConfig) (*RequestOrchestrationConfig, error) {
	config, err := saveRequestOrchestrationConfig(input)
	if err != nil {
		return nil, err
	}
	return &config, nil
}

func (a *App) GetRequestOrchestrationSnapshot() (*RequestOrchestrationSnapshot, error) {
	snapshot, err := loadRequestOrchestrationSnapshot()
	if err != nil {
		return nil, err
	}
	return &snapshot, nil
}

func (a *App) ApplyRequestOrchestration() (*ApplyRequestOrchestrationResult, error) {
	config, err := loadRequestOrchestrationConfig()
	if err != nil {
		return nil, err
	}
	flow, err := activeRequestOrchestrationFlow(config)
	if err != nil {
		return nil, err
	}
	enabledIDs := map[string]struct{}{}
	for _, id := range flow.EnabledAccountIDs {
		enabledIDs[id] = struct{}{}
	}
	if len(enabledIDs) == 0 {
		return nil, errors.New("当前流程组没有勾选可参与账号")
	}

	routing, err := a.GetRelayRoutingConfig()
	if err != nil {
		return nil, err
	}
	accounts, err := a.requestOrchestrationAccountStates()
	if err != nil {
		return nil, err
	}
	if len(accounts) == 0 {
		return nil, errors.New("没有可编排账号")
	}

	snapshotPath, err := saveRequestOrchestrationSnapshot(RequestOrchestrationSnapshot{
		Applied:       true,
		AppliedFlowID: flow.ID,
		AppliedAt:     time.Now().Format(time.RFC3339),
		Config:        config,
		Routing:       *routing,
		Accounts:      accounts,
	})
	if err != nil {
		return nil, err
	}

	enabledCount := 0
	disabledCount := 0
	for _, account := range accounts {
		_, enabled := enabledIDs[account.ID]
		if enabled {
			enabledCount++
		} else {
			disabledCount++
		}
		targetDisabled := !enabled
		if account.Disabled == targetDisabled {
			continue
		}
		if err := a.SetAccountDisabled(account.ID, targetDisabled); err != nil {
			return nil, err
		}
	}

	configPath, _ := requestOrchestrationConfigPath()
	return &ApplyRequestOrchestrationResult{
		AppliedFlowID: flow.ID,
		EnabledCount:  enabledCount,
		DisabledCount: disabledCount,
		SnapshotPath:  snapshotPath,
		ConfigPath:    configPath,
		Message:       "已应用请求编排",
	}, nil
}

func (a *App) RestoreRequestOrchestration() (*ApplyRequestOrchestrationResult, error) {
	snapshot, err := loadRequestOrchestrationSnapshot()
	if err != nil {
		return nil, err
	}
	if !snapshot.Applied {
		return nil, errors.New("没有可恢复的请求编排快照")
	}

	if err := a.restoreRelayRoutingConfig(snapshot.Routing); err != nil {
		return nil, err
	}

	restoredCount := 0
	for _, account := range snapshot.Accounts {
		if err := a.SetAccountDisabled(account.ID, account.Disabled); err != nil {
			return nil, err
		}
		restoredCount++
	}

	snapshotPath, err := requestOrchestrationSnapshotPath()
	if err != nil {
		return nil, err
	}
	if err := os.Remove(snapshotPath); err != nil && !os.IsNotExist(err) {
		return nil, err
	}

	return &ApplyRequestOrchestrationResult{
		AppliedFlowID: snapshot.AppliedFlowID,
		RestoredCount: restoredCount,
		SnapshotPath:  snapshotPath,
		Message:       "已恢复请求编排快照",
	}, nil
}

func activeRequestOrchestrationFlow(config RequestOrchestrationConfig) (RequestOrchestrationFlowConfig, error) {
	for _, flow := range config.Flows {
		if flow.ID == config.ActiveFlowID {
			return flow, nil
		}
	}
	return RequestOrchestrationFlowConfig{}, errors.New("未找到当前流程组")
}

func (a *App) requestOrchestrationAccountStates() ([]RequestOrchestrationAccountState, error) {
	records, err := a.ListAccounts()
	if err != nil {
		return nil, err
	}
	states := make([]RequestOrchestrationAccountState, 0, len(records))
	seen := map[string]struct{}{}
	for _, record := range records {
		id := strings.TrimSpace(record.ID)
		if id == "" {
			continue
		}
		states = append(states, RequestOrchestrationAccountState{ID: id, Disabled: record.Disabled})
		seen[id] = struct{}{}
	}

	providers, err := a.managementClient().ListOpenAICompatibleProviders()
	if err != nil {
		return nil, err
	}
	for _, provider := range providers {
		name := strings.TrimSpace(provider.Name)
		if name == "" {
			continue
		}
		id := "openai-compatible:" + name
		if _, ok := seen[id]; ok {
			continue
		}
		states = append(states, RequestOrchestrationAccountState{ID: id, Disabled: provider.Disabled})
	}
	return states, nil
}

func (a *App) restoreRelayRoutingConfig(config RelayRoutingConfig) error {
	body, _, err := a.SidecarRequest("GET", ManagementAPIPrefix+"/config.yaml", nil, nil, "")
	if err != nil {
		return err
	}
	nextConfigYAML, err := updateRelayRoutingConfigYAML(body, config)
	if err != nil {
		return err
	}
	_, _, err = a.SidecarRequest("PUT", ManagementAPIPrefix+"/config.yaml", nil, strings.NewReader(string(nextConfigYAML)), "application/x-yaml")
	return err
}
