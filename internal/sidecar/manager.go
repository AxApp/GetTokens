// Package sidecar manages the lifecycle of the CLIProxyAPI backend subprocess.
package sidecar

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	defaultPort    = 8317
	healthzPath    = "/healthz"
	startupTimeout = 30 * time.Second
	pollInterval   = 500 * time.Millisecond
	// ManagementKey is used for local management API auth between app frontend and sidecar.
	ManagementKey = "gettokens-local-management-key"
)

// StatusCode describes the current state of the sidecar.
type StatusCode string

const (
	StatusStarting StatusCode = "starting"
	StatusReady    StatusCode = "ready"
	StatusError    StatusCode = "error"
	StatusStopped  StatusCode = "stopped"
)

// Status is emitted to the frontend on every state transition.
type Status struct {
	Code    StatusCode `json:"code"`
	Port    int        `json:"port"`
	Message string     `json:"message"`
	Version string     `json:"version"`
}

// Manager controls the backend subprocess.
type Manager struct {
	mu            sync.Mutex
	cmd           *exec.Cmd
	port          int
	status        Status
	serviceAPIKey string
}

// NewManager creates a Manager with default configuration.
func NewManager() *Manager {
	return &Manager{
		port:   defaultPort,
		status: Status{Code: StatusStopped},
	}
}

// Start launches the sidecar and calls notify on every status change.
// It blocks until ctx is cancelled.
func (m *Manager) Start(ctx context.Context, notify func(Status)) {
	m.setStatus(Status{Code: StatusStarting, Message: "正在启动后端服务…"}, notify)

	binPath, err := m.resolveBinaryPath()
	if err != nil {
		m.setStatus(Status{Code: StatusError, Message: fmt.Sprintf("找不到后端二进制: %v", err)}, notify)
		return
	}

	port, err := m.pickPort()
	if err != nil {
		m.setStatus(Status{Code: StatusError, Message: fmt.Sprintf("端口分配失败: %v", err)}, notify)
		return
	}
	m.mu.Lock()
	m.port = port
	m.mu.Unlock()

	configDir, err := ensureConfigDir()
	if err != nil {
		m.setStatus(Status{Code: StatusError, Message: fmt.Sprintf("配置目录初始化失败: %v", err)}, notify)
		return
	}
	if _, err := normalizeLegacyAuthFiles(configDir); err != nil {
		m.setStatus(Status{Code: StatusError, Message: fmt.Sprintf("兼容旧版 auth 文件失败: %v", err)}, notify)
		return
	}

	// Write YAML config file (CLIProxyAPI reads host/port from config, not CLI flags).
	configFile := filepath.Join(configDir, "config.yaml")
	serviceAPIKey, err := writeConfig(configFile, port, configDir)
	if err != nil {
		m.setStatus(Status{Code: StatusError, Message: fmt.Sprintf("写配置文件失败: %v", err)}, notify)
		return
	}
	m.mu.Lock()
	m.serviceAPIKey = serviceAPIKey
	m.mu.Unlock()

	cmd := exec.CommandContext(ctx, binPath, "-config", configFile)

	// Redirect sidecar stdout/stderr to files for debugging.
	logFile := filepath.Join(configDir, "sidecar.log")
	if f, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600); err == nil {
		cmd.Stdout = f
		cmd.Stderr = f
		defer f.Close()
	}

	m.mu.Lock()
	m.cmd = cmd
	m.mu.Unlock()

	if err := cmd.Start(); err != nil {
		m.setStatus(Status{Code: StatusError, Message: fmt.Sprintf("启动失败: %v", err)}, notify)
		return
	}

	// Wait for health check or timeout.
	healthURL := fmt.Sprintf("http://127.0.0.1:%d%s", port, healthzPath)
	if err := m.waitHealthy(ctx, healthURL); err != nil {
		m.setStatus(Status{Code: StatusError, Message: fmt.Sprintf("健康检查超时: %v", err)}, notify)
		_ = cmd.Process.Kill()
		return
	}

	m.setStatus(Status{Code: StatusReady, Port: port, Message: "后端服务已就绪"}, notify)

	// Wait for process exit or context cancellation.
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()

	select {
	case <-ctx.Done():
		// Graceful stop triggered externally.
	case err := <-done:
		if err != nil {
			m.setStatus(Status{Code: StatusError, Message: fmt.Sprintf("后端意外退出: %v", err)}, notify)
		}
	}
}

// Stop sends SIGTERM to the sidecar process.
func (m *Manager) Stop() {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.cmd != nil && m.cmd.Process != nil {
		_ = m.cmd.Process.Signal(os.Interrupt)
	}
	m.status = Status{Code: StatusStopped}
}

// CurrentStatus returns the latest known status.
func (m *Manager) CurrentStatus() Status {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.status
}

func (m *Manager) CurrentServiceAPIKey() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.serviceAPIKey
}

func (m *Manager) SetCurrentServiceAPIKey(apiKey string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.serviceAPIKey = strings.TrimSpace(apiKey)
}

func (m *Manager) setStatus(s Status, notify func(Status)) {
	m.mu.Lock()
	m.status = s
	m.mu.Unlock()
	if notify != nil {
		notify(s)
	}
}
