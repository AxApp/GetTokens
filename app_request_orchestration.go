package main

import wailsapp "github.com/linhay/gettokens/internal/wailsapp"

type RequestOrchestrationFlowTest = wailsapp.RequestOrchestrationFlowTest
type RequestOrchestrationFlowConfig = wailsapp.RequestOrchestrationFlowConfig
type RequestOrchestrationAccountOverride = wailsapp.RequestOrchestrationAccountOverride
type RequestOrchestrationConfig = wailsapp.RequestOrchestrationConfig
type RequestOrchestrationAccountState = wailsapp.RequestOrchestrationAccountState
type RequestOrchestrationSnapshot = wailsapp.RequestOrchestrationSnapshot
type ApplyRequestOrchestrationResult = wailsapp.ApplyRequestOrchestrationResult

func (a *App) GetRequestOrchestrationConfig() (*RequestOrchestrationConfig, error) {
	return a.core.GetRequestOrchestrationConfig()
}

func (a *App) SaveRequestOrchestrationConfig(input RequestOrchestrationConfig) (*RequestOrchestrationConfig, error) {
	return a.core.SaveRequestOrchestrationConfig(input)
}

func (a *App) GetRequestOrchestrationSnapshot() (*RequestOrchestrationSnapshot, error) {
	return a.core.GetRequestOrchestrationSnapshot()
}

func (a *App) ApplyRequestOrchestration() (*ApplyRequestOrchestrationResult, error) {
	return a.core.ApplyRequestOrchestration()
}

func (a *App) RestoreRequestOrchestration() (*ApplyRequestOrchestrationResult, error) {
	return a.core.RestoreRequestOrchestration()
}
