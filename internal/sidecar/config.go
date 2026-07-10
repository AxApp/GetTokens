package sidecar

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"
)

// sidecarConfig is the YAML config written for CLIProxyAPI.
type sidecarConfig struct {
	Host                   string   `yaml:"host"`
	Port                   int      `yaml:"port"`
	AuthDir                string   `yaml:"auth-dir"`
	AccountStoreDB         string   `yaml:"account-store-db"`
	APIKeys                []string `yaml:"api-keys"`
	UseSystemProxy         bool     `yaml:"use-system-proxy"`
	UsageStatisticsEnabled bool     `yaml:"usage-statistics-enabled"`
	RequestRetry           int      `yaml:"request-retry"`
	MaxRetryCredentials    int      `yaml:"max-retry-credentials"`
	MaxRetryInterval       int      `yaml:"max-retry-interval"`
	RemoteManagement       struct {
		AllowRemote            bool   `yaml:"allow-remote"`
		SecretKey              string `yaml:"secret-key"`
		DisableControlPanel    bool   `yaml:"disable-control-panel"`
		DisableAutoUpdatePanel bool   `yaml:"disable-auto-update-panel"`
	} `yaml:"remote-management"`
}

const (
	defaultRequestRetry        = 3
	defaultMaxRetryCredentials = 0
	defaultMaxRetryInterval    = 30
	retryDefaultsMarkerName    = ".gettokens-retry-defaults-v1"
)

func defaultAccountStoreDBPath(authDir string) string {
	return filepath.Join(strings.TrimSpace(authDir), "accounts-v1.sqlite")
}

// writeConfig serialises a minimal YAML config for CLIProxyAPI.
func writeConfig(path string, port int, authDir string) (string, error) {
	if err := migrateLegacyChannelRoutingConfig(path); err != nil {
		return "", err
	}

	cfg := sidecarConfig{
		Host:                   "",
		Port:                   port,
		AuthDir:                authDir,
		AccountStoreDB:         defaultAccountStoreDBPath(authDir),
		APIKeys:                []string{mustGenerateServiceAPIKey()},
		UsageStatisticsEnabled: true,
		RequestRetry:           defaultRequestRetry,
		MaxRetryCredentials:    defaultMaxRetryCredentials,
		MaxRetryInterval:       defaultMaxRetryInterval,
	}
	cfg.RemoteManagement.AllowRemote = false
	cfg.RemoteManagement.SecretKey = ManagementKeyHash
	cfg.RemoteManagement.DisableControlPanel = true
	cfg.RemoteManagement.DisableAutoUpdatePanel = true

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
			upsertMappingScalar(root, "account-store-db", cfg.AccountStoreDB, "!!str")
			upsertMappingScalar(root, "usage-statistics-enabled", "true", "!!bool")
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
			upsertMappingScalar(remoteManagement, "disable-control-panel", "true", "!!bool")
			upsertMappingScalar(remoteManagement, "disable-auto-update-panel", "true", "!!bool")
			upsertMappingScalar(remoteManagement, "secret-key", cfg.RemoteManagement.SecretKey, "!!str")
			if err := applyRetryDefaults(root, path); err != nil {
				return "", err
			}

			var buf bytes.Buffer
			encoder := yaml.NewEncoder(&buf)
			encoder.SetIndent(2)
			if encodeErr := encoder.Encode(&original); encodeErr == nil {
				if closeErr := encoder.Close(); closeErr == nil {
					if writeErr := os.WriteFile(path, buf.Bytes(), 0600); writeErr != nil {
						return "", writeErr
					}
					if markerErr := markRetryDefaultsApplied(path); markerErr != nil {
						return "", markerErr
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
	if err := markRetryDefaultsApplied(path); err != nil {
		return "", err
	}
	return cfg.APIKeys[0], nil
}

func applyRetryDefaults(root *yaml.Node, configPath string) error {
	requestRetry, hasRequestRetry := readMappingInt(root, "request-retry")
	maxRetryCredentials, hasMaxRetryCredentials := readMappingInt(root, "max-retry-credentials")
	maxRetryInterval, hasMaxRetryInterval := readMappingInt(root, "max-retry-interval")

	if !hasRequestRetry {
		upsertMappingScalar(root, "request-retry", fmt.Sprintf("%d", defaultRequestRetry), "!!int")
	}
	if !hasMaxRetryCredentials {
		upsertMappingScalar(root, "max-retry-credentials", fmt.Sprintf("%d", defaultMaxRetryCredentials), "!!int")
	}
	if !hasMaxRetryInterval {
		upsertMappingScalar(root, "max-retry-interval", fmt.Sprintf("%d", defaultMaxRetryInterval), "!!int")
	}

	if hasRequestRetry && hasMaxRetryCredentials && hasMaxRetryInterval &&
		requestRetry == 0 && maxRetryCredentials == 0 && maxRetryInterval == 0 &&
		!retryDefaultsMarkerExists(configPath) {
		upsertMappingScalar(root, "request-retry", fmt.Sprintf("%d", defaultRequestRetry), "!!int")
		upsertMappingScalar(root, "max-retry-credentials", fmt.Sprintf("%d", defaultMaxRetryCredentials), "!!int")
		upsertMappingScalar(root, "max-retry-interval", fmt.Sprintf("%d", defaultMaxRetryInterval), "!!int")
	}

	return nil
}

func retryDefaultsMarkerExists(configPath string) bool {
	_, err := os.Stat(retryDefaultsMarkerPath(configPath))
	return err == nil
}

func markRetryDefaultsApplied(configPath string) error {
	markerPath := retryDefaultsMarkerPath(configPath)
	if err := os.MkdirAll(filepath.Dir(markerPath), 0o700); err != nil {
		return err
	}
	return os.WriteFile(markerPath, []byte("1\n"), 0o600)
}

func retryDefaultsMarkerPath(configPath string) string {
	return filepath.Join(filepath.Dir(strings.TrimSpace(configPath)), retryDefaultsMarkerName)
}

func migrateLegacyChannelRoutingConfig(configPath string) error {
	configDir := filepath.Dir(strings.TrimSpace(configPath))
	if configDir == "." || configDir == "" || filepath.Base(configDir) != "gettokens" {
		return nil
	}
	targetPath := filepath.Join(configDir, "channel-routing", "config.json")
	if _, err := os.Stat(targetPath); err == nil {
		return nil
	} else if !os.IsNotExist(err) {
		return err
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	legacyPath := filepath.Join(home, ".config", "gettokens-data", "channel-routing", "config.json")
	body, err := os.ReadFile(legacyPath)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(targetPath), 0o700); err != nil {
		return err
	}
	return os.WriteFile(targetPath, body, 0o600)
}

func readUseSystemProxy(path string) (bool, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	var document yaml.Node
	if err := yaml.Unmarshal(data, &document); err != nil {
		return false, err
	}
	root := yamlDocumentRoot(&document)
	if root == nil {
		return false, nil
	}
	return readMappingBool(root, "use-system-proxy"), nil
}

func writeUseSystemProxy(path string, enabled bool) error {
	var document yaml.Node
	data, err := os.ReadFile(path)
	if err == nil {
		if unmarshalErr := yaml.Unmarshal(data, &document); unmarshalErr != nil {
			return unmarshalErr
		}
	} else if os.IsNotExist(err) {
		document = yaml.Node{
			Kind: yaml.DocumentNode,
			Content: []*yaml.Node{{
				Kind: yaml.MappingNode,
			}},
		}
	} else {
		return err
	}

	root := yamlDocumentRoot(&document)
	if root == nil {
		document = yaml.Node{
			Kind: yaml.DocumentNode,
			Content: []*yaml.Node{{
				Kind: yaml.MappingNode,
			}},
		}
		root = document.Content[0]
	}
	upsertMappingScalar(root, "use-system-proxy", fmt.Sprintf("%t", enabled), "!!bool")

	var buf bytes.Buffer
	encoder := yaml.NewEncoder(&buf)
	encoder.SetIndent(2)
	if err := encoder.Encode(&document); err != nil {
		_ = encoder.Close()
		return err
	}
	if err := encoder.Close(); err != nil {
		return err
	}
	return os.WriteFile(path, buf.Bytes(), 0600)
}

func yamlDocumentRoot(document *yaml.Node) *yaml.Node {
	if document == nil || document.Kind != yaml.DocumentNode || len(document.Content) == 0 || document.Content[0] == nil {
		return nil
	}
	if document.Content[0].Kind != yaml.MappingNode {
		return nil
	}
	return document.Content[0]
}

func readMappingBool(parent *yaml.Node, key string) bool {
	if parent == nil || parent.Kind != yaml.MappingNode {
		return false
	}
	for index := 0; index+1 < len(parent.Content); index += 2 {
		keyNode := parent.Content[index]
		if keyNode == nil || keyNode.Value != key {
			continue
		}
		valueNode := parent.Content[index+1]
		if valueNode == nil {
			return false
		}
		return strings.EqualFold(strings.TrimSpace(valueNode.Value), "true") || strings.TrimSpace(valueNode.Value) == "1"
	}
	return false
}

func readMappingInt(parent *yaml.Node, key string) (int, bool) {
	if parent == nil || parent.Kind != yaml.MappingNode {
		return 0, false
	}
	for index := 0; index+1 < len(parent.Content); index += 2 {
		keyNode := parent.Content[index]
		if keyNode == nil || keyNode.Value != key {
			continue
		}
		valueNode := parent.Content[index+1]
		if valueNode == nil {
			return 0, true
		}
		parsed, err := strconv.Atoi(strings.TrimSpace(valueNode.Value))
		if err != nil {
			return 0, true
		}
		return parsed, true
	}
	return 0, false
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
