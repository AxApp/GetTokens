package gettokensextensions

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

var extensionIDPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]*$`)

type ExtensionEnableStateFile struct {
	ContractVersion string                      `json:"contractVersion"`
	UpdatedAt       string                      `json:"updatedAt,omitempty"`
	Extensions      []ExtensionEnableStateEntry `json:"extensions"`
}

type ExtensionEnableStateEntry struct {
	ID        string         `json:"id"`
	State     ExtensionState `json:"state"`
	UpdatedAt string         `json:"updatedAt,omitempty"`
	Reason    string         `json:"reason,omitempty"`
}

func LoadExtensionEnableState(path string) (ExtensionEnableStateFile, error) {
	if path == "" {
		return emptyExtensionEnableState(), nil
	}

	body, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return emptyExtensionEnableState(), nil
		}
		return ExtensionEnableStateFile{}, err
	}

	var state ExtensionEnableStateFile
	if err := json.Unmarshal(body, &state); err != nil {
		return ExtensionEnableStateFile{}, fmt.Errorf("%s: %w", DiagnosticEnableStateParseError, err)
	}
	return normalizeExtensionEnableState(state)
}

func SaveExtensionEnableState(path string, state ExtensionEnableStateFile) error {
	if path == "" {
		return fmt.Errorf("extension enable state path is required")
	}
	normalized, err := normalizeExtensionEnableState(state)
	if err != nil {
		return err
	}

	body, err := json.MarshalIndent(normalized, "", "  ")
	if err != nil {
		return err
	}
	body = append(body, '\n')

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	tmpPath := path + ".tmp"
	if err := os.WriteFile(tmpPath, body, 0o644); err != nil {
		return err
	}
	return os.Rename(tmpPath, path)
}

func SetExtensionEnabled(path string, extensionID string, enabled bool, now timeNowFunc) (ExtensionEnableStateFile, error) {
	if path == "" {
		return ExtensionEnableStateFile{}, fmt.Errorf("extension enable state path is required")
	}
	extensionID = strings.TrimSpace(extensionID)
	if !isValidExtensionID(extensionID) {
		return ExtensionEnableStateFile{}, fmt.Errorf("invalid extension id %q", extensionID)
	}
	if now == nil {
		now = defaultTimeNow
	}

	state, err := LoadExtensionEnableState(path)
	if err != nil {
		return ExtensionEnableStateFile{}, err
	}

	nextState := StateDisabled
	if enabled {
		nextState = StateEnabled
	}
	updatedAt := now().UTC().Format(time.RFC3339)
	replaced := false
	for index := range state.Extensions {
		if state.Extensions[index].ID != extensionID {
			continue
		}
		state.Extensions[index].State = nextState
		state.Extensions[index].UpdatedAt = updatedAt
		state.Extensions[index].Reason = "local-state-mutation"
		replaced = true
		break
	}
	if !replaced {
		state.Extensions = append(state.Extensions, ExtensionEnableStateEntry{
			ID:        extensionID,
			State:     nextState,
			UpdatedAt: updatedAt,
			Reason:    "local-state-mutation",
		})
	}
	state.UpdatedAt = updatedAt

	if err := SaveExtensionEnableState(path, state); err != nil {
		return ExtensionEnableStateFile{}, err
	}
	return LoadExtensionEnableState(path)
}

func normalizeExtensionEnableState(state ExtensionEnableStateFile) (ExtensionEnableStateFile, error) {
	if state.ContractVersion == "" {
		state.ContractVersion = ContractVersionV0
	}
	if state.ContractVersion != ContractVersionV0 {
		return ExtensionEnableStateFile{}, fmt.Errorf("unsupported extension enable state contract version %q", state.ContractVersion)
	}

	byID := map[string]ExtensionEnableStateEntry{}
	for index, entry := range state.Extensions {
		entry.ID = strings.TrimSpace(entry.ID)
		if !isValidExtensionID(entry.ID) {
			return ExtensionEnableStateFile{}, fmt.Errorf("invalid extension id at extensions[%d]: %q", index, entry.ID)
		}
		normalizedState, err := normalizePersistedExtensionState(entry.State)
		if err != nil {
			return ExtensionEnableStateFile{}, fmt.Errorf("invalid state for extension %q: %w", entry.ID, err)
		}
		entry.State = normalizedState
		entry.UpdatedAt = strings.TrimSpace(entry.UpdatedAt)
		entry.Reason = strings.TrimSpace(entry.Reason)
		byID[entry.ID] = entry
	}

	normalized := ExtensionEnableStateFile{
		ContractVersion: state.ContractVersion,
		UpdatedAt:       strings.TrimSpace(state.UpdatedAt),
		Extensions:      make([]ExtensionEnableStateEntry, 0, len(byID)),
	}
	for _, entry := range byID {
		normalized.Extensions = append(normalized.Extensions, entry)
	}
	sort.Slice(normalized.Extensions, func(i, j int) bool {
		return normalized.Extensions[i].ID < normalized.Extensions[j].ID
	})
	return normalized, nil
}

type timeNowFunc func() time.Time

func defaultTimeNow() time.Time {
	return time.Now()
}

func mergeEnableState(snapshot *RegistrySnapshot, state ExtensionEnableStateFile) {
	byID := map[string]ExtensionState{}
	for _, entry := range state.Extensions {
		byID[entry.ID] = entry.State
	}
	for index := range snapshot.Extensions {
		extension := &snapshot.Extensions[index]
		if extension.ID == "" || extension.State == StateInvalid {
			continue
		}
		state, ok := byID[extension.ID]
		if !ok {
			continue
		}
		extension.State = state
		for capabilityIndex := range extension.Capabilities {
			if extension.Capabilities[capabilityIndex].State != StateInvalid {
				extension.Capabilities[capabilityIndex].State = state
			}
		}
	}
}

func emptyExtensionEnableState() ExtensionEnableStateFile {
	return ExtensionEnableStateFile{
		ContractVersion: ContractVersionV0,
		Extensions:      []ExtensionEnableStateEntry{},
	}
}

func isValidExtensionID(id string) bool {
	if id == "" || strings.Contains(id, "..") {
		return false
	}
	return extensionIDPattern.MatchString(id)
}

func normalizePersistedExtensionState(state ExtensionState) (ExtensionState, error) {
	switch ExtensionState(strings.ToLower(strings.TrimSpace(string(state)))) {
	case StateEnabled:
		return StateEnabled, nil
	case StateDisabled:
		return StateDisabled, nil
	default:
		return "", fmt.Errorf("unknown extension enable state %q", state)
	}
}
