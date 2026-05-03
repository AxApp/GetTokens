package wailsapp

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"

	"github.com/linhay/gettokens/internal/sidecar"
)

type RelayRoutingConfig struct {
	Strategy            string `json:"strategy"`
	SessionAffinity     bool   `json:"sessionAffinity"`
	SessionAffinityTTL  string `json:"sessionAffinityTTL"`
	RequestRetry        int    `json:"requestRetry"`
	MaxRetryCredentials int    `json:"maxRetryCredentials"`
	MaxRetryInterval    int    `json:"maxRetryInterval"`
	SwitchProject       bool   `json:"switchProject"`
	SwitchPreviewModel  bool   `json:"switchPreviewModel"`
	AntigravityCredits  bool   `json:"antigravityCredits"`
}

func (a *App) GetRelayRoutingConfig() (*RelayRoutingConfig, error) {
	body, _, err := a.SidecarRequest("GET", ManagementAPIPrefix+"/config", nil, nil, "")
	if err != nil {
		return nil, err
	}
	return parseRelayRoutingConfig(body)
}

func (a *App) UpdateRelayRoutingConfig(config RelayRoutingConfig) (*RelayRoutingConfig, error) {
	status := a.sidecar.CurrentStatus()
	if status.Code != sidecar.StatusReady || status.Port <= 0 {
		return nil, errors.New("后端未就绪")
	}

	body, _, err := a.SidecarRequest("GET", ManagementAPIPrefix+"/config.yaml", nil, nil, "")
	if err != nil {
		return nil, err
	}

	nextConfigYAML, err := updateRelayRoutingConfigYAML(body, config)
	if err != nil {
		return nil, err
	}

	if _, _, err := a.SidecarRequest("PUT", ManagementAPIPrefix+"/config.yaml", nil, bytes.NewReader(nextConfigYAML), "application/x-yaml"); err != nil {
		return nil, err
	}

	return a.GetRelayRoutingConfig()
}

func parseRelayRoutingConfig(body []byte) (*RelayRoutingConfig, error) {
	var payload struct {
		RequestRetry        int `json:"request-retry"`
		MaxRetryCredentials int `json:"max-retry-credentials"`
		MaxRetryInterval    int `json:"max-retry-interval"`
		Routing             struct {
			Strategy           string `json:"strategy"`
			SessionAffinity    bool   `json:"session-affinity"`
			SessionAffinityTTL string `json:"session-affinity-ttl"`
		} `json:"routing"`
		QuotaExceeded struct {
			SwitchProject      bool `json:"switch-project"`
			SwitchPreviewModel bool `json:"switch-preview-model"`
			AntigravityCredits bool `json:"antigravity-credits"`
		} `json:"quota-exceeded"`
	}

	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}

	normalized := normalizeRelayRoutingConfig(RelayRoutingConfig{
		Strategy:            payload.Routing.Strategy,
		SessionAffinity:     payload.Routing.SessionAffinity,
		SessionAffinityTTL:  payload.Routing.SessionAffinityTTL,
		RequestRetry:        payload.RequestRetry,
		MaxRetryCredentials: payload.MaxRetryCredentials,
		MaxRetryInterval:    payload.MaxRetryInterval,
		SwitchProject:       payload.QuotaExceeded.SwitchProject,
		SwitchPreviewModel:  payload.QuotaExceeded.SwitchPreviewModel,
		AntigravityCredits:  payload.QuotaExceeded.AntigravityCredits,
	})

	if normalized.Strategy == "" {
		return nil, errors.New("轮动策略为空")
	}

	return &normalized, nil
}

func buildRelayRoutingConfigPayload(input RelayRoutingConfig) ([]byte, error) {
	normalized := normalizeRelayRoutingConfig(input)

	payload := struct {
		RequestRetry        int `json:"request-retry"`
		MaxRetryCredentials int `json:"max-retry-credentials"`
		MaxRetryInterval    int `json:"max-retry-interval"`
		Routing             struct {
			Strategy           string `json:"strategy"`
			SessionAffinity    bool   `json:"session-affinity"`
			SessionAffinityTTL string `json:"session-affinity-ttl"`
		} `json:"routing"`
		QuotaExceeded struct {
			SwitchProject      bool `json:"switch-project"`
			SwitchPreviewModel bool `json:"switch-preview-model"`
			AntigravityCredits bool `json:"antigravity-credits"`
		} `json:"quota-exceeded"`
	}{
		RequestRetry:        normalized.RequestRetry,
		MaxRetryCredentials: normalized.MaxRetryCredentials,
		MaxRetryInterval:    normalized.MaxRetryInterval,
	}
	payload.Routing.Strategy = normalized.Strategy
	payload.Routing.SessionAffinity = normalized.SessionAffinity
	payload.Routing.SessionAffinityTTL = normalized.SessionAffinityTTL
	payload.QuotaExceeded.SwitchProject = normalized.SwitchProject
	payload.QuotaExceeded.SwitchPreviewModel = normalized.SwitchPreviewModel
	payload.QuotaExceeded.AntigravityCredits = normalized.AntigravityCredits

	return json.Marshal(payload)
}

func normalizeRelayRoutingConfig(input RelayRoutingConfig) RelayRoutingConfig {
	strategy := strings.TrimSpace(input.Strategy)
	if strategy == "" {
		strategy = "round-robin"
	}

	ttl := strings.TrimSpace(input.SessionAffinityTTL)
	if ttl == "" {
		ttl = "1h"
	}

	return RelayRoutingConfig{
		Strategy:            strategy,
		SessionAffinity:     input.SessionAffinity,
		SessionAffinityTTL:  ttl,
		RequestRetry:        maxZero(input.RequestRetry),
		MaxRetryCredentials: maxZero(input.MaxRetryCredentials),
		MaxRetryInterval:    maxZero(input.MaxRetryInterval),
		SwitchProject:       input.SwitchProject,
		SwitchPreviewModel:  input.SwitchPreviewModel,
		AntigravityCredits:  input.AntigravityCredits,
	}
}

func updateRelayRoutingConfigYAML(original []byte, config RelayRoutingConfig) ([]byte, error) {
	var document yaml.Node
	if err := yaml.Unmarshal(original, &document); err != nil {
		return nil, fmt.Errorf("解析 config.yaml 失败: %w", err)
	}
	if document.Kind != yaml.DocumentNode || len(document.Content) == 0 || document.Content[0] == nil {
		return nil, errors.New("config.yaml 结构非法")
	}

	root := document.Content[0]
	if root.Kind != yaml.MappingNode {
		return nil, errors.New("config.yaml 根节点不是 mapping")
	}

	normalized := normalizeRelayRoutingConfig(config)

	upsertYAMLScalar(root, "request-retry", fmt.Sprintf("%d", normalized.RequestRetry), "!!int")
	upsertYAMLScalar(root, "max-retry-credentials", fmt.Sprintf("%d", normalized.MaxRetryCredentials), "!!int")
	upsertYAMLScalar(root, "max-retry-interval", fmt.Sprintf("%d", normalized.MaxRetryInterval), "!!int")

	routingNode := ensureYAMLMappingNode(root, "routing")
	upsertYAMLScalar(routingNode, "strategy", normalized.Strategy, "!!str")
	upsertYAMLScalar(routingNode, "session-affinity", boolString(normalized.SessionAffinity), "!!bool")
	upsertYAMLScalar(routingNode, "session-affinity-ttl", normalized.SessionAffinityTTL, "!!str")

	quotaNode := ensureYAMLMappingNode(root, "quota-exceeded")
	upsertYAMLScalar(quotaNode, "switch-project", boolString(normalized.SwitchProject), "!!bool")
	upsertYAMLScalar(quotaNode, "switch-preview-model", boolString(normalized.SwitchPreviewModel), "!!bool")
	upsertYAMLScalar(quotaNode, "antigravity-credits", boolString(normalized.AntigravityCredits), "!!bool")

	var buf bytes.Buffer
	encoder := yaml.NewEncoder(&buf)
	encoder.SetIndent(2)
	if err := encoder.Encode(&document); err != nil {
		_ = encoder.Close()
		return nil, err
	}
	if err := encoder.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func ensureYAMLMappingNode(parent *yaml.Node, key string) *yaml.Node {
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

func upsertYAMLScalar(parent *yaml.Node, key string, value string, tag string) {
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

func boolString(value bool) string {
	if value {
		return "true"
	}
	return "false"
}

func maxZero(value int) int {
	if value < 0 {
		return 0
	}
	return value
}
