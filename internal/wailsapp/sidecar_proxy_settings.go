package wailsapp

import (
	"bytes"
	"os"

	"github.com/linhay/gettokens/internal/sidecar"
)

func (a *App) GetSidecarProxySettings() (*SidecarProxySettings, error) {
	enabled, err := a.sidecar.UseSystemProxy()
	if err != nil {
		return nil, err
	}
	configPath, err := a.sidecar.ConfigFilePath()
	if err != nil {
		return nil, err
	}
	return &SidecarProxySettings{
		UseSystemProxy: enabled,
		ConfigPath:     configPath,
	}, nil
}

func (a *App) UpdateSidecarProxySettings(input SidecarProxySettings) (*SidecarProxySettings, error) {
	configPath, err := a.sidecar.SetUseSystemProxy(input.UseSystemProxy)
	if err != nil {
		return nil, err
	}

	applied := false
	status := a.sidecar.CurrentStatus()
	if status.Code == sidecar.StatusReady {
		if putErr := a.applySidecarConfigYAML(configPath); putErr != nil {
			return nil, putErr
		}
		applied = true
		a.setSidecarProxyPendingApply(false)
	} else {
		a.setSidecarProxyPendingApply(true)
	}

	return &SidecarProxySettings{
		UseSystemProxy:          input.UseSystemProxy,
		ConfigPath:              configPath,
		AppliedToRunningSidecar: applied,
	}, nil
}

func (a *App) applyPendingSidecarProxySettings() error {
	if !a.takeSidecarProxyPendingApply() {
		return nil
	}
	configPath, err := a.sidecar.ConfigFilePath()
	if err != nil {
		a.setSidecarProxyPendingApply(true)
		return err
	}
	if err := a.applySidecarConfigYAML(configPath); err != nil {
		a.setSidecarProxyPendingApply(true)
		return err
	}
	return nil
}

func (a *App) applySidecarConfigYAML(configPath string) error {
	body, err := os.ReadFile(configPath)
	if err != nil {
		return err
	}
	_, _, err = a.SidecarRequest("PUT", ManagementAPIPrefix+"/config.yaml", nil, bytes.NewReader(body), "application/x-yaml")
	return err
}

func (a *App) setSidecarProxyPendingApply(pending bool) {
	a.sidecarProxyMu.Lock()
	a.sidecarProxyPendingApply = pending
	a.sidecarProxyMu.Unlock()
}

func (a *App) takeSidecarProxyPendingApply() bool {
	a.sidecarProxyMu.Lock()
	defer a.sidecarProxyMu.Unlock()
	pending := a.sidecarProxyPendingApply
	a.sidecarProxyPendingApply = false
	return pending
}
