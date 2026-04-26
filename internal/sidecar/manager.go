// Package sidecar manages the lifecycle of the CLIProxyAPI backend subprocess.
package sidecar

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
	"gopkg.in/yaml.v3"
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
	Host             string   `yaml:"host"`
	Port             int      `yaml:"port"`
	AuthDir          string   `yaml:"auth-dir"`
	APIKeys          []string `yaml:"api-keys"`
	RemoteManagement struct {
		AllowRemote bool   `yaml:"allow-remote"`
		SecretKey   string `yaml:"secret-key"`
	} `yaml:"remote-management"`
}

// writeConfig serialises a minimal YAML config for CLIProxyAPI.
func writeConfig(path string, port int, authDir string) (string, error) {
	cfg := sidecarConfig{
		Host:    "",
		Port:    port,
		AuthDir: authDir,
		APIKeys: []string{mustGenerateServiceAPIKey()},
	}
	cfg.RemoteManagement.AllowRemote = false
	cfg.RemoteManagement.SecretKey = ManagementKey

	data, err := os.ReadFile(path)
	if err == nil {
		var original yaml.Node
		if unmarshalErr := yaml.Unmarshal(data, &original); unmarshalErr == nil &&
			original.Kind == yaml.DocumentNode &&
			len(original.Content) > 0 &&
			original.Content[0] != nil &&
			original.Content[0].Kind == yaml.MappingNode {
			root := original.Content[0]
			upsertMappingScalar(root, "host", cfg.Host, "!!str")
			upsertMappingScalar(root, "port", fmt.Sprintf("%d", cfg.Port), "!!int")
			upsertMappingScalar(root, "auth-dir", cfg.AuthDir, "!!str")
			apiKeys := existingAPIKeys(root)
			if len(apiKeys) == 0 {
				apiKeys = cfg.APIKeys
			}
			if len(apiKeys) == 0 {
				apiKeys = []string{mustGenerateServiceAPIKey()}
			}
			if upsertSequenceString(root, "api-keys", apiKeys) == 0 {
				return "", fmt.Errorf("写入 api-keys 失败")
			}
			remoteManagement := ensureMappingNode(root, "remote-management")
			upsertMappingScalar(remoteManagement, "allow-remote", "false", "!!bool")
			upsertMappingScalar(remoteManagement, "secret-key", cfg.RemoteManagement.SecretKey, "!!str")

			var buf bytes.Buffer
			encoder := yaml.NewEncoder(&buf)
			encoder.SetIndent(2)
			if encodeErr := encoder.Encode(&original); encodeErr == nil {
				if closeErr := encoder.Close(); closeErr == nil {
					if writeErr := os.WriteFile(path, buf.Bytes(), 0600); writeErr != nil {
						return "", writeErr
					}
					return apiKeys[0], nil
				}
			}
			_ = encoder.Close()
		}
	} else if !os.IsNotExist(err) {
		return "", err
	}

	rendered, err := yaml.Marshal(cfg)
	if err != nil {
		return "", err
	}
	if err := os.WriteFile(path, rendered, 0600); err != nil {
		return "", err
	}
	return cfg.APIKeys[0], nil
}

func ensureMappingNode(parent *yaml.Node, key string) *yaml.Node {
	if parent == nil || parent.Kind != yaml.MappingNode {
		return &yaml.Node{Kind: yaml.MappingNode}
	}

	for index := 0; index+1 < len(parent.Content); index += 2 {
		keyNode := parent.Content[index]
		if keyNode != nil && keyNode.Value == key {
			valueNode := parent.Content[index+1]
			if valueNode == nil {
				valueNode = &yaml.Node{Kind: yaml.MappingNode}
				parent.Content[index+1] = valueNode
			}
			if valueNode.Kind != yaml.MappingNode {
				*valueNode = yaml.Node{Kind: yaml.MappingNode}
			}
			return valueNode
		}
	}

	keyNode := &yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: key}
	valueNode := &yaml.Node{Kind: yaml.MappingNode}
	parent.Content = append(parent.Content, keyNode, valueNode)
	return valueNode
}

func upsertMappingScalar(parent *yaml.Node, key string, value string, tag string) {
	if parent == nil || parent.Kind != yaml.MappingNode {
		return
	}

	for index := 0; index+1 < len(parent.Content); index += 2 {
		keyNode := parent.Content[index]
		if keyNode != nil && keyNode.Value == key {
			parent.Content[index+1] = &yaml.Node{Kind: yaml.ScalarNode, Tag: tag, Value: value}
			return
		}
	}

	parent.Content = append(
		parent.Content,
		&yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: key},
		&yaml.Node{Kind: yaml.ScalarNode, Tag: tag, Value: value},
	)
}

func existingAPIKeys(parent *yaml.Node) []string {
	if parent == nil || parent.Kind != yaml.MappingNode {
		return nil
	}

	for index := 0; index+1 < len(parent.Content); index += 2 {
		keyNode := parent.Content[index]
		if keyNode == nil || keyNode.Value != "api-keys" {
			continue
		}

		valueNode := parent.Content[index+1]
		if valueNode == nil || valueNode.Kind != yaml.SequenceNode {
			return nil
		}

		keys := make([]string, 0, len(valueNode.Content))
		for _, item := range valueNode.Content {
			if item == nil {
				continue
			}
			trimmed := strings.TrimSpace(item.Value)
			if trimmed == "" {
				continue
			}
			keys = append(keys, trimmed)
		}
		return keys
	}

	return nil
}

func upsertSequenceString(parent *yaml.Node, key string, values []string) int {
	if parent == nil || parent.Kind != yaml.MappingNode {
		return 0
	}

	content := make([]*yaml.Node, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		content = append(content, &yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: trimmed})
	}
	if len(content) == 0 {
		return 0
	}

	sequenceNode := &yaml.Node{Kind: yaml.SequenceNode, Tag: "!!seq", Content: content}
	for index := 0; index+1 < len(parent.Content); index += 2 {
		keyNode := parent.Content[index]
		if keyNode != nil && keyNode.Value == key {
			parent.Content[index+1] = sequenceNode
			return len(content)
		}
	}

	parent.Content = append(
		parent.Content,
		&yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: key},
		sequenceNode,
	)
	return len(content)
}

func mustGenerateServiceAPIKey() string {
	buffer := make([]byte, 12)
	if _, err := rand.Read(buffer); err != nil {
		return "sk-gettokens-local"
	}
	return "sk-gettokens-" + hex.EncodeToString(buffer)
}

func normalizeLegacyAuthFiles(dir string) (int, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0, err
	}

	changedCount := 0
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(strings.ToLower(entry.Name()), ".json") {
			continue
		}

		path := filepath.Join(dir, entry.Name())
		body, readErr := os.ReadFile(path)
		if readErr != nil || len(body) == 0 {
			continue
		}

		normalized, changed, normalizeErr := accountsdomain.NormalizeAuthFileForSidecar(body)
		if normalizeErr != nil || !changed {
			continue
		}
		if writeErr := os.WriteFile(path, normalized, 0600); writeErr != nil {
			return changedCount, writeErr
		}
		changedCount++
	}

	return changedCount, nil
}
