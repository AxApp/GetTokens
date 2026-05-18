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
		body, readErr := os.ReadFile(configPath)
		if readErr != nil {
			return nil, readErr
		}
		if _, _, putErr := a.SidecarRequest("PUT", ManagementAPIPrefix+"/config.yaml", nil, bytes.NewReader(body), "application/x-yaml"); putErr != nil {
			return nil, putErr
		}
		applied = true
	}

	return &SidecarProxySettings{
		UseSystemProxy:          input.UseSystemProxy,
		ConfigPath:              configPath,
		AppliedToRunningSidecar: applied,
	}, nil
}
