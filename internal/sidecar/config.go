package sidecar

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

// sidecarConfig is the YAML config written for CLIProxyAPI.
type sidecarConfig struct {
	Host                   string   `yaml:"host"`
	Port                   int      `yaml:"port"`
	AuthDir                string   `yaml:"auth-dir"`
	APIKeys                []string `yaml:"api-keys"`
	UsageStatisticsEnabled bool     `yaml:"usage-statistics-enabled"`
	RemoteManagement       struct {
		AllowRemote bool   `yaml:"allow-remote"`
		SecretKey   string `yaml:"secret-key"`
	} `yaml:"remote-management"`
}

// writeConfig serialises a minimal YAML config for CLIProxyAPI.
func writeConfig(path string, port int, authDir string) (string, error) {
	cfg := sidecarConfig{
		Host:                   "",
		Port:                   port,
		AuthDir:                authDir,
		APIKeys:                []string{mustGenerateServiceAPIKey()},
		UsageStatisticsEnabled: true,
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
