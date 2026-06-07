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
	healthzPath          = "/healthz"
	startupTimeout       = 30 * time.Second
	pollInterval         = 500 * time.Millisecond
	sidecarShutdownGrace = 2 * time.Second
	orphanShutdownGrace  = 1500 * time.Millisecond
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
	Code          StatusCode `json:"code"`
	Port          int        `json:"port"`
	Message       string     `json:"message"`
	Version       string     `json:"version"`
	GitHash       string     `json:"gitHash"`
	StartedAtUnix int64      `json:"startedAtUnix"`
}

// Manager controls the backend subprocess.
type Manager struct {
	mu            sync.Mutex
	cmd           *exec.Cmd
	done          chan struct{}
	exitErr       error
	port          int
	status        Status
	serviceAPIKey string
	profile       string
}

// NewManager creates a Manager with default configuration.
func NewManager() *Manager {
	profile := resolveSidecarProfile()
	manager := &Manager{
		port:    preferredPortForProfile(profile),
		status:  Status{Code: StatusStopped},
		profile: profile,
	}
	if gitHash, err := manager.resolveBinaryGitHash(); err == nil {
		manager.status.GitHash = gitHash
	}
	return manager
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

	binaryGitHash, err := readBinaryGitHash(binPath)
	if err != nil {
		binaryGitHash = ""
	}

	configDir, err := ensureConfigDir(m.profile)
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
	if err := cleanupOrphanedSidecars(configFile); err != nil {
		m.setStatus(Status{Code: StatusError, Message: fmt.Sprintf("清理残留后端失败: %v", err)}, notify)
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
	m.done = nil
	m.exitErr = nil
	m.mu.Unlock()

	if err := cmd.Start(); err != nil {
		m.mu.Lock()
		if m.cmd == cmd {
			m.cmd = nil
		}
		m.mu.Unlock()
		m.setStatus(Status{Code: StatusError, Message: fmt.Sprintf("启动失败: %v", err)}, notify)
		return
	}

	done := make(chan struct{})
	m.mu.Lock()
	m.done = done
	m.mu.Unlock()
	go func() {
		err := cmd.Wait()
		m.mu.Lock()
		if m.cmd == cmd {
			m.exitErr = err
		}
		m.mu.Unlock()
		close(done)
	}()

	startingStatus := Status{
		Code:          StatusStarting,
		Port:          port,
		Message:       "正在启动后端服务…",
		StartedAtUnix: time.Now().UnixMilli(),
	}
	if binaryGitHash != "" {
		startingStatus.GitHash = binaryGitHash
	}
	m.setStatus(startingStatus, notify)

	// Wait for health check or timeout.
	healthURL := fmt.Sprintf("http://127.0.0.1:%d%s", port, healthzPath)
	if err := m.waitHealthy(ctx, healthURL); err != nil {
		m.setStatus(Status{Code: StatusError, Message: fmt.Sprintf("健康检查超时: %v", err)}, notify)
		_ = cmd.Process.Kill()
		waitForDone(done, sidecarShutdownGrace)
		return
	}

	m.setStatus(Status{Code: StatusReady, Port: port, Message: "后端服务已就绪"}, notify)

	select {
	case <-ctx.Done():
		stopProcess(cmd.Process, done, sidecarShutdownGrace)
	case <-done:
		m.mu.Lock()
		err := m.exitErr
		m.mu.Unlock()
		if err != nil {
			m.setStatus(Status{Code: StatusError, Message: fmt.Sprintf("后端意外退出: %v", err)}, notify)
		}
	}
}

// Stop sends SIGTERM to the sidecar process.
func (m *Manager) Stop() {
	m.mu.Lock()
	cmd := m.cmd
	done := m.done
	m.status = Status{Code: StatusStopped, GitHash: m.status.GitHash}
	m.mu.Unlock()

	if cmd != nil && cmd.Process != nil {
		stopProcess(cmd.Process, done, sidecarShutdownGrace)
	}
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

func (m *Manager) Profile() string {
	if m == nil {
		return "prod"
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if strings.EqualFold(strings.TrimSpace(m.profile), "dev") {
		return "dev"
	}
	return "prod"
}

func (m *Manager) SetCurrentServiceAPIKey(apiKey string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.serviceAPIKey = strings.TrimSpace(apiKey)
}

func (m *Manager) ConfigFilePath() (string, error) {
	configDir, err := ensureConfigDir(m.profile)
	if err != nil {
		return "", err
	}
	return filepath.Join(configDir, "config.yaml"), nil
}

func (m *Manager) UseSystemProxy() (bool, error) {
	configFile, err := m.ConfigFilePath()
	if err != nil {
		return false, err
	}
	return readUseSystemProxy(configFile)
}

func (m *Manager) SetUseSystemProxy(enabled bool) (string, error) {
	configFile, err := m.ConfigFilePath()
	if err != nil {
		return "", err
	}
	if err := writeUseSystemProxy(configFile, enabled); err != nil {
		return "", err
	}
	return configFile, nil
}

func (m *Manager) setStatus(s Status, notify func(Status)) {
	m.mu.Lock()
	if s.StartedAtUnix == 0 && s.Code != StatusStopped {
		s.StartedAtUnix = m.status.StartedAtUnix
	}
	if s.GitHash == "" && m.status.GitHash != "" {
		s.GitHash = m.status.GitHash
	}
	m.status = s
	m.mu.Unlock()
	if notify != nil {
		notify(s)
	}
}

func (m *Manager) resolveBinaryGitHash() (string, error) {
	binPath, err := m.resolveBinaryPath()
	if err != nil {
		return "", err
	}
	return readBinaryGitHash(binPath)
}
