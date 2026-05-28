package wailsapp

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

func applyDeepLinkDocumentsToCodexConfig(config *DeepLinkCodexConfig, documents []DeepLinkDocumentPatch) error {
	for _, document := range documents {
		target := strings.TrimSpace(document.Target)
		switch target {
		case "auth.json":
			if err := applyAuthDocumentToCodexConfig(config, document); err != nil {
				return err
			}
		case "config.toml":
			if err := applyConfigTomlDocumentToCodexConfig(config, document); err != nil {
				return err
			}
		}
	}
	return nil
}

func applyAuthDocumentToCodexConfig(config *DeepLinkCodexConfig, document DeepLinkDocumentPatch) error {
	if strings.TrimSpace(document.Format) != "" && strings.TrimSpace(document.Format) != "json" {
		return errors.New("auth.json document format 必须是 json")
	}
	for _, operation := range document.Operations {
		op := strings.TrimSpace(strings.ToLower(operation.Op))
		if op == "" {
			op = "set"
		}
		if op != "set" && op != "merge" {
			continue
		}
		value, err := decodeDeepLinkPatchValue(operation)
		if err != nil {
			return err
		}
		path := strings.TrimSpace(operation.Path)
		if op == "merge" && (path == "/" || path == "") {
			object, ok := value.(map[string]any)
			if !ok {
				return errors.New("auth.json root merge value 必须是对象")
			}
			applyAuthObjectToCodexConfig(config, object)
			continue
		}
		switch path {
		case "/OPENAI_API_KEY":
			config.APIKey = stringifyDeepLinkPatchScalar(value)
			config.APIKeySet = true
		case "/auth_mode":
			if config.Mode == "" {
				switch strings.TrimSpace(strings.ToLower(stringifyDeepLinkPatchScalar(value))) {
				case "apikey", "api-key":
					config.Mode = "api-key"
				case "chatgpt":
					config.Mode = "oauth-auth-file"
				}
			}
		}
	}
	return nil
}

func applyAuthObjectToCodexConfig(config *DeepLinkCodexConfig, object map[string]any) {
	if _, ok := object["OPENAI_API_KEY"]; ok {
		config.APIKey = stringifyDeepLinkPatchScalar(object["OPENAI_API_KEY"])
		config.APIKeySet = true
	}
	if config.Mode == "" {
		switch strings.TrimSpace(strings.ToLower(stringifyDeepLinkPatchScalar(object["auth_mode"]))) {
		case "apikey", "api-key":
			config.Mode = "api-key"
		case "chatgpt":
			config.Mode = "oauth-auth-file"
		}
	}
}

func applyConfigTomlDocumentToCodexConfig(config *DeepLinkCodexConfig, document DeepLinkDocumentPatch) error {
	if strings.TrimSpace(document.Format) != "" && strings.TrimSpace(document.Format) != "toml" {
		return errors.New("config.toml document format 必须是 toml")
	}
	for _, operation := range document.Operations {
		op := strings.TrimSpace(strings.ToLower(operation.Op))
		if op == "" {
			op = "set"
		}
		if op != "set" {
			continue
		}
		value, err := decodeDeepLinkPatchValue(operation)
		if err != nil {
			return err
		}
		path := strings.TrimSpace(operation.Path)
		switch {
		case path == "model":
			config.Model = stringifyDeepLinkPatchScalar(value)
			config.ModelSet = true
		case path == "model_reasoning_effort":
			config.ReasoningEffort = stringifyDeepLinkPatchScalar(value)
			config.ReasoningEffortSet = true
		case path == "model_provider":
			config.ProviderID = stringifyDeepLinkPatchScalar(value)
			config.ProviderIDSet = true
		case strings.HasPrefix(path, "model_providers."):
			applyModelProviderTomlPathToCodexConfig(config, strings.TrimPrefix(path, "model_providers."), value)
		}
	}
	return nil
}

func applyModelProviderTomlPathToCodexConfig(config *DeepLinkCodexConfig, suffix string, value any) {
	parts := strings.Split(suffix, ".")
	if len(parts) < 2 {
		return
	}
	providerID := strings.TrimSpace(parts[0])
	key := strings.Join(parts[1:], ".")
	if providerID == "" {
		return
	}
	if config.ProviderID == "" {
		config.ProviderID = providerID
	}
	if config.ProviderID == providerID {
		config.ProviderIDSet = true
	}
	if config.ProviderID != providerID {
		return
	}
	switch key {
	case "name":
		config.ProviderName = stringifyDeepLinkPatchScalar(value)
		config.ProviderNameSet = true
	case "base_url":
		config.BaseURL = stringifyDeepLinkPatchScalar(value)
		config.BaseURLSet = true
	case "requires_openai_auth":
		if typed, ok := value.(bool); ok {
			config.RequiresOpenAIAuth = typed
			config.RequiresOpenAIAuthSet = true
		}
	case "wire_api":
		config.WireAPI = stringifyDeepLinkPatchScalar(value)
		config.WireAPISet = true
	case "supports_websockets":
		if typed, ok := value.(bool); ok {
			config.SupportsWebsockets = typed
			config.SupportsWebsocketsSet = true
		}
	}
}

func stringifyDeepLinkPatchScalar(value any) string {
	switch typed := value.(type) {
	case nil:
		return ""
	case string:
		return strings.TrimSpace(typed)
	default:
		return strings.TrimSpace(fmt.Sprint(typed))
	}
}

func buildAuthJSONFromDeepLinkDocuments(documents []DeepLinkDocumentPatch) ([]byte, error) {
	var authDocument *DeepLinkDocumentPatch
	for index := range documents {
		if strings.TrimSpace(documents[index].Target) == "auth.json" {
			authDocument = &documents[index]
			break
		}
	}
	if authDocument == nil {
		return nil, errors.New("auth-file 导入缺少 auth.json document")
	}
	if strings.TrimSpace(authDocument.Format) != "" && strings.TrimSpace(authDocument.Format) != "json" {
		return nil, errors.New("auth.json document format 必须是 json")
	}

	payload := map[string]any{}
	for _, operation := range authDocument.Operations {
		if err := applyJSONPatchOperation(payload, operation); err != nil {
			return nil, err
		}
	}
	body, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("序列化 auth.json document 失败: %w", err)
	}
	return append(body, '\n'), nil
}

func applyJSONPatchOperation(payload map[string]any, operation DeepLinkPatchOperation) error {
	op := strings.TrimSpace(strings.ToLower(operation.Op))
	path := strings.TrimSpace(operation.Path)
	if op == "" {
		op = "set"
	}
	if path == "" || !strings.HasPrefix(path, "/") {
		return errors.New("JSON document operation path 必须是 JSON Pointer")
	}
	segments := parseJSONPointer(path)
	if len(segments) == 0 {
		if op == "merge" {
			value, err := decodeDeepLinkPatchValue(operation)
			if err != nil {
				return err
			}
			object, ok := value.(map[string]any)
			if !ok {
				return errors.New("root merge value 必须是对象")
			}
			for key, item := range object {
				payload[key] = item
			}
			return nil
		}
		return errors.New("不支持直接替换 JSON root")
	}

	parent := payload
	for _, segment := range segments[:len(segments)-1] {
		next, ok := parent[segment].(map[string]any)
		if !ok {
			next = map[string]any{}
			parent[segment] = next
		}
		parent = next
	}
	key := segments[len(segments)-1]
	switch op {
	case "set":
		value, err := decodeDeepLinkPatchValue(operation)
		if err != nil {
			return err
		}
		parent[key] = value
	case "delete":
		delete(parent, key)
	case "merge":
		value, err := decodeDeepLinkPatchValue(operation)
		if err != nil {
			return err
		}
		object, ok := value.(map[string]any)
		if !ok {
			return errors.New("merge value 必须是对象")
		}
		current, _ := parent[key].(map[string]any)
		if current == nil {
			current = map[string]any{}
			parent[key] = current
		}
		for itemKey, item := range object {
			current[itemKey] = item
		}
	default:
		return fmt.Errorf("auth.json document 不支持 op=%s", operation.Op)
	}
	return nil
}

func decodeDeepLinkPatchValue(operation DeepLinkPatchOperation) (any, error) {
	if len(operation.Value) == 0 {
		return nil, nil
	}
	valueBody := []byte(operation.Value)
	if strings.TrimSpace(strings.ToLower(operation.ValueEncoding)) == "base64" {
		var encoded string
		if err := json.Unmarshal(operation.Value, &encoded); err != nil {
			return nil, errors.New("base64 value 必须是字符串")
		}
		decoded, err := base64.StdEncoding.DecodeString(encoded)
		if err != nil {
			return nil, fmt.Errorf("base64 value 解码失败: %w", err)
		}
		valueBody = decoded
	}
	var value any
	if err := json.Unmarshal(valueBody, &value); err != nil {
		if strings.TrimSpace(strings.ToLower(operation.ValueEncoding)) == "base64" {
			return string(valueBody), nil
		}
		return nil, fmt.Errorf("operation value 不是有效 JSON: %w", err)
	}
	return value, nil
}

func parseJSONPointer(path string) []string {
	trimmed := strings.TrimPrefix(path, "/")
	if trimmed == "" {
		return nil
	}
	parts := strings.Split(trimmed, "/")
	for index, part := range parts {
		part = strings.ReplaceAll(part, "~1", "/")
		part = strings.ReplaceAll(part, "~0", "~")
		parts[index] = part
	}
	return parts
}
