// Package sidecar manages the lifecycle of the CLIProxyAPI backend subprocess.
package sidecar

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"
	"time"

	"gopkg.in/yaml.v3"
)

const (
	defaultPort    = 8317
	healthzPath    = "/healthz"
	startupTimeout = 30 * time.Second
	pollInterval   = 500 * time.Millisecond
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
	mu     sync.Mutex
	cmd    *exec.Cmd
	port   int
	status Status
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

	// Write YAML config file (CLIProxyAPI reads host/port from config, not CLI flags).
	configFile := filepath.Join(configDir, "config.yaml")
	if err := writeConfig(configFile, port, configDir); err != nil {
		m.setStatus(Status{Code: StatusError, Message: fmt.Sprintf("写配置文件失败: %v", err)}, notify)
		return
	}

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

func (m *Manager) setStatus(s Status, notify func(Status)) {
	m.mu.Lock()
	m.status = s
	m.mu.Unlock()
	if notify != nil {
		notify(s)
	}
}

// pickPort tries defaultPort; if occupied, finds a free ephemeral port.
func (m *Manager) pickPort() (int, error) {
	if isPortFree(defaultPort) {
		return defaultPort, nil
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	port := ln.Addr().(*net.TCPAddr).Port
	_ = ln.Close()
	return port, nil
}

func isPortFree(port int) bool {
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		return false
	}
	_ = ln.Close()
	return true
}

// resolveBinaryPath returns the absolute path to the bundled sidecar binary.
func (m *Manager) resolveBinaryPath() (string, error) {
	binaryName := "cli-proxy-api"
	if runtime.GOOS == "windows" {
		binaryName += ".exe"
	}

	// 1. Next to the main executable (dev mode / extracted .app).
	exe, err := os.Executable()
	if err == nil {
		candidates := []string{
			filepath.Join(filepath.Dir(exe), binaryName),
			// macOS .app bundle: Contents/MacOS/cli-proxy-api
			filepath.Join(filepath.Dir(exe), "..", "Resources", binaryName),
		}
		for _, p := range candidates {
			if _, err := os.Stat(p); err == nil {
				return p, nil
			}
		}
	}

	// 2. Fallback: system PATH (useful for dev).
	if path, err := exec.LookPath(binaryName); err == nil {
		return path, nil
	}

	return "", fmt.Errorf("binary %q not found", binaryName)
}

// waitHealthy polls the health endpoint until it returns 200 or ctx/timeout expires.
func (m *Manager) waitHealthy(ctx context.Context, url string) error {
	deadline := time.Now().Add(startupTimeout)
	client := &http.Client{Timeout: 2 * time.Second}

	for time.Now().Before(deadline) {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		req, _ := http.NewRequestWithContext(ctx, http.MethodHead, url, nil)
		resp, err := client.Do(req)
		if err == nil && resp.StatusCode == http.StatusOK {
			resp.Body.Close()
			return nil
		}
		if resp != nil {
			resp.Body.Close()
		}
		time.Sleep(pollInterval)
	}
	return fmt.Errorf("timed out after %s", startupTimeout)
}

// ensureConfigDir creates and returns ~/.config/gettokens.
func ensureConfigDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".config", "gettokens")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}
	return dir, nil
}

// sidecarConfig is the YAML config written for CLIProxyAPI.
type sidecarConfig struct {
	Host    string `yaml:"host"`
	Port    int    `yaml:"port"`
	AuthDir string `yaml:"auth-dir"`
}

// writeConfig serialises a minimal YAML config for CLIProxyAPI.
func writeConfig(path string, port int, authDir string) error {
	cfg := sidecarConfig{
		Host:    "127.0.0.1",
		Port:    port,
		AuthDir: authDir,
	}
	data, err := yaml.Marshal(cfg)
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0600)
}
