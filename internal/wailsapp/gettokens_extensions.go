package wailsapp

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/linhay/gettokens/internal/gettokensextensions"
)

type GetTokensExtensionRegistrySnapshotInput struct {
	ManifestPaths []string                    `json:"manifestPaths,omitempty"`
	Roots         []GetTokensExtensionRootDTO `json:"roots,omitempty"`
	StatePath     string                      `json:"statePath,omitempty"`
}

type GetTokensExtensionRootDTO struct {
	ID       string `json:"id"`
	Path     string `json:"path"`
	ReadOnly bool   `json:"readOnly"`
}

type SetGetTokensExtensionEnabledInput struct {
	ExtensionID string `json:"extensionID"`
	Enabled     bool   `json:"enabled"`
	StatePath   string `json:"statePath,omitempty"`
}

type PreviewGetTokensExtensionCodexConfigDryRunInput struct {
	ManifestPaths []string                    `json:"manifestPaths,omitempty"`
	Roots         []GetTokensExtensionRootDTO `json:"roots,omitempty"`
	StatePath     string                      `json:"statePath,omitempty"`
	TargetPath    string                      `json:"targetPath,omitempty"`
	ConfigText    string                      `json:"configText,omitempty"`
}

type PrepareGetTokensExtensionCodexConfigApplyInput struct {
	ManifestPaths []string                    `json:"manifestPaths,omitempty"`
	Roots         []GetTokensExtensionRootDTO `json:"roots,omitempty"`
	StatePath     string                      `json:"statePath,omitempty"`
	TargetPath    string                      `json:"targetPath"`
	ConfigText    string                      `json:"configText"`
}

type ApplyGetTokensExtensionCodexConfigTransactionInput struct {
	ManifestPaths      []string                    `json:"manifestPaths,omitempty"`
	Roots              []GetTokensExtensionRootDTO `json:"roots,omitempty"`
	StatePath          string                      `json:"statePath,omitempty"`
	TargetPath         string                      `json:"targetPath"`
	TempDir            string                      `json:"tempDir"`
	ConfigText         string                      `json:"configText"`
	ConfirmationToken  string                      `json:"confirmationToken"`
	SkipVerifyReadback bool                        `json:"skipVerifyReadback,omitempty"`
}

func (a *App) GetGetTokensExtensionRegistrySnapshot(input GetTokensExtensionRegistrySnapshotInput) (*gettokensextensions.RegistrySnapshot, error) {
	roots := mapGetTokensExtensionInputRoots(input.Roots)
	if len(roots) == 0 && len(input.ManifestPaths) == 0 {
		root, err := defaultGetTokensExtensionRoot()
		if err != nil {
			return nil, err
		}
		roots = []gettokensextensions.Root{root}
	}
	statePath, err := a.getTokensExtensionEnableStatePath(input.StatePath)
	if err != nil {
		return nil, err
	}

	snapshot, err := gettokensextensions.LoadRegistrySnapshot(gettokensextensions.LoadOptions{
		ManifestPaths: append([]string(nil), input.ManifestPaths...),
		Roots:         roots,
		StatePath:     statePath,
		Now:           time.Now,
	})
	if err != nil {
		return nil, err
	}
	return &snapshot, nil
}

func (a *App) PreviewGetTokensExtensionCodexConfigDryRun(input PreviewGetTokensExtensionCodexConfigDryRunInput) (*gettokensextensions.CodexConfigDryRunPreview, error) {
	snapshot, err := a.GetGetTokensExtensionRegistrySnapshot(GetTokensExtensionRegistrySnapshotInput{
		ManifestPaths: append([]string(nil), input.ManifestPaths...),
		Roots:         append([]GetTokensExtensionRootDTO(nil), input.Roots...),
		StatePath:     input.StatePath,
	})
	if err != nil {
		return nil, err
	}
	preview := gettokensextensions.PreviewCodexConfigDryRun(*snapshot, gettokensextensions.CodexConfigDryRunOptions{
		TargetPath: input.TargetPath,
		ConfigText: input.ConfigText,
		Now:        time.Now,
	})
	return &preview, nil
}

func (a *App) PrepareGetTokensExtensionCodexConfigApply(input PrepareGetTokensExtensionCodexConfigApplyInput) (*gettokensextensions.CodexConfigStagedApplyPlan, error) {
	if err := rejectRealCodexConfigTarget(input.TargetPath); err != nil {
		return nil, err
	}
	preview, err := a.PreviewGetTokensExtensionCodexConfigDryRun(PreviewGetTokensExtensionCodexConfigDryRunInput{
		ManifestPaths: append([]string(nil), input.ManifestPaths...),
		Roots:         append([]GetTokensExtensionRootDTO(nil), input.Roots...),
		StatePath:     input.StatePath,
		TargetPath:    input.TargetPath,
		ConfigText:    input.ConfigText,
	})
	if err != nil {
		return nil, err
	}
	plan, err := gettokensextensions.PrepareCodexConfigStagedApply(*preview, gettokensextensions.CodexConfigTempApplyOptions{
		ConfigText: input.ConfigText,
	})
	if err != nil {
		return nil, err
	}
	return &plan, nil
}

func (a *App) ApplyGetTokensExtensionCodexConfigTransaction(input ApplyGetTokensExtensionCodexConfigTransactionInput) (*gettokensextensions.CodexConfigStagedApplyResult, error) {
	if err := rejectRealCodexConfigTarget(input.TargetPath); err != nil {
		return nil, err
	}
	preview, err := a.PreviewGetTokensExtensionCodexConfigDryRun(PreviewGetTokensExtensionCodexConfigDryRunInput{
		ManifestPaths: append([]string(nil), input.ManifestPaths...),
		Roots:         append([]GetTokensExtensionRootDTO(nil), input.Roots...),
		StatePath:     input.StatePath,
		TargetPath:    input.TargetPath,
		ConfigText:    input.ConfigText,
	})
	if err != nil {
		return nil, err
	}
	verify := func(verifyInput gettokensextensions.CodexConfigStagedApplyVerifyInput) error {
		if input.SkipVerifyReadback {
			return nil
		}
		body, err := os.ReadFile(verifyInput.TargetPath)
		if err != nil {
			return err
		}
		if string(body) != verifyInput.AppliedText {
			return fmt.Errorf("target readback does not match staged Codex config text")
		}
		return nil
	}
	result, err := gettokensextensions.ApplyCodexConfigStagedTransaction(*preview, gettokensextensions.CodexConfigStagedApplyOptions{
		TargetPath:        input.TargetPath,
		TempDir:           input.TempDir,
		ConfigText:        input.ConfigText,
		ConfirmationToken: input.ConfirmationToken,
		Verify:            verify,
	})
	if err != nil {
		return &result, err
	}
	return &result, nil
}

func (a *App) SetGetTokensExtensionEnabled(input SetGetTokensExtensionEnabledInput) (*gettokensextensions.ExtensionEnableStateFile, error) {
	statePath, err := a.getTokensExtensionEnableStatePath(input.StatePath)
	if err != nil {
		return nil, err
	}
	state, err := gettokensextensions.SetExtensionEnabled(statePath, input.ExtensionID, input.Enabled, time.Now)
	if err != nil {
		return nil, err
	}
	return &state, nil
}

func (a *App) getTokensExtensionEnableStatePath(override string) (string, error) {
	if strings.TrimSpace(override) != "" {
		return override, nil
	}
	if strings.TrimSpace(a.getTokensExtensionStatePath) != "" {
		return a.getTokensExtensionStatePath, nil
	}
	dir, err := defaultGetTokensExtensionStateDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "extension-enable-state.json"), nil
}

func mapGetTokensExtensionInputRoots(items []GetTokensExtensionRootDTO) []gettokensextensions.Root {
	if len(items) == 0 {
		return nil
	}
	roots := make([]gettokensextensions.Root, 0, len(items))
	for _, item := range items {
		if strings.TrimSpace(item.Path) == "" {
			continue
		}
		id := strings.TrimSpace(item.ID)
		if id == "" {
			id = "local"
		}
		roots = append(roots, gettokensextensions.Root{
			ID:       id,
			Path:     item.Path,
			ReadOnly: true,
		})
	}
	return roots
}

func defaultGetTokensExtensionRoot() (gettokensextensions.Root, error) {
	dir, err := defaultGetTokensExtensionStateDir()
	if err != nil {
		return gettokensextensions.Root{}, err
	}
	return gettokensextensions.Root{
		ID:       "app-owned",
		Path:     filepath.Join(dir, "extensions"),
		ReadOnly: true,
	}, nil
}

func defaultGetTokensExtensionStateDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	profile := strings.ToLower(strings.TrimSpace(os.Getenv("GETTOKENS_APP_PROFILE")))
	dirName := "gettokens"
	if profile == "dev" {
		dirName = "gettokens-dev"
	}
	return filepath.Join(home, ".config", dirName), nil
}

func rejectRealCodexConfigTarget(targetPath string) error {
	target := strings.TrimSpace(targetPath)
	if target == "" {
		return fmt.Errorf("explicit target path is required for GetTokens extension Codex config apply")
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	realCodexConfig := filepath.Clean(filepath.Join(home, ".codex", "config.toml"))
	if filepath.Clean(target) == realCodexConfig {
		return fmt.Errorf("refusing to read or write real Codex config target %q; use caller-supplied config text and an explicit test target", target)
	}
	return nil
}
