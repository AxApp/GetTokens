package protocolbridge

import (
	"fmt"
	"regexp"
	"strings"
)

const mcpStdioCredentialInputMessage = "MCP stdio request contains credential-bearing input"
const mcpStdioQuerySchemaValidationMessage = "MCP stdio tool query does not satisfy canonical query schema"

type MCPStdioPreflight struct {
	toolsByName        map[string]MCPToolMapping
	resourcesByURI     map[string]MCPResourceMapping
	toolQueryContracts map[string]mcpQuerySchemaContract
}

func NewMCPStdioPreflight(mapping MCPAdapterMapping) (*MCPStdioPreflight, error) {
	if err := ValidateMCPAdapterMapping(mapping); err != nil {
		return nil, err
	}

	preflight := &MCPStdioPreflight{
		toolsByName:        make(map[string]MCPToolMapping, len(mapping.Tools)),
		resourcesByURI:     make(map[string]MCPResourceMapping, len(mapping.Resources)),
		toolQueryContracts: make(map[string]mcpQuerySchemaContract, len(mapping.Tools)),
	}
	for _, tool := range mapping.Tools {
		preflight.toolsByName[tool.Name] = tool
		contract, err := mcpToolQueryContractForSchema(tool.QuerySchemaRef)
		if err != nil {
			return nil, fmt.Errorf("MCP stdio preflight: tool %q: %w", tool.Name, err)
		}
		preflight.toolQueryContracts[tool.Name] = contract
	}
	for _, resource := range mapping.Resources {
		preflight.resourcesByURI[resource.URI] = resource
	}
	return preflight, nil
}

func (p *MCPStdioPreflight) Tool(req MCPToolRequest) (MCPToolMapping, error) {
	if p == nil {
		return MCPToolMapping{}, fmt.Errorf("MCP stdio preflight is required")
	}
	tool, ok := p.toolsByName[strings.TrimSpace(req.ToolName)]
	if !ok {
		return MCPToolMapping{}, fmt.Errorf("MCP stdio tool is not declared in mapping fixture")
	}
	if err := validateMCPToolQueryAgainstContract(req.Query, p.toolQueryContracts[tool.Name]); err != nil {
		return MCPToolMapping{}, err
	}
	if containsCredentialBearingInput(req.Query) {
		return MCPToolMapping{}, fmt.Errorf(mcpStdioCredentialInputMessage)
	}
	return tool, nil
}

func (p *MCPStdioPreflight) Resource(req MCPResourceRequest) (MCPResourceMapping, error) {
	if p == nil {
		return MCPResourceMapping{}, fmt.Errorf("MCP stdio preflight is required")
	}
	uri := strings.TrimSpace(req.URI)
	resource, ok := p.resourcesByURI[uri]
	if !ok || resourceKindForbidden(resource) || exposesForbiddenMCPResourceValue(resource) {
		return MCPResourceMapping{}, fmt.Errorf("MCP stdio resource is not declared in mapping fixture")
	}
	if containsCredentialBearingInput(uri) {
		return MCPResourceMapping{}, fmt.Errorf(mcpStdioCredentialInputMessage)
	}
	return resource, nil
}

var mcpStdioCredentialValuePatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)\bauthorization\b\s*[:=]`),
	regexp.MustCompile(`(?i)\bcookie\b\s*[:=]`),
	regexp.MustCompile(`(?i)\b(?:access|refresh|id)[_ -]?token\b\s*[:=]`),
	regexp.MustCompile(`(?i)\bapi[_ -]?key\b\s*[:=]`),
	regexp.MustCompile(`(?i)\bbearer\s+[^\s,;]+`),
}

var mcpStdioCredentialKeys = map[string]struct{}{
	"authorization":       {},
	"proxy_authorization": {},
	"cookie":              {},
	"cookies":             {},
	"set_cookie":          {},
	"header":              {},
	"headers":             {},
	"http_header":         {},
	"http_headers":        {},
	"access_token":        {},
	"refresh_token":       {},
	"id_token":            {},
	"api_key":             {},
	"api_key_plaintext":   {},
	"raw_token":           {},
	"bearer_token":        {},
	"auth_token":          {},
}

func containsCredentialBearingInput(value any) bool {
	switch typed := value.(type) {
	case nil:
		return false
	case string:
		return containsCredentialBearingText(typed)
	case map[string]any:
		for key, nested := range typed {
			if forbiddenCredentialKey(key) || containsCredentialBearingInput(nested) {
				return true
			}
		}
	case []any:
		for _, nested := range typed {
			if containsCredentialBearingInput(nested) {
				return true
			}
		}
	case []string:
		for _, nested := range typed {
			if containsCredentialBearingInput(nested) {
				return true
			}
		}
	case map[string]string:
		for key, nested := range typed {
			if forbiddenCredentialKey(key) || containsCredentialBearingInput(nested) {
				return true
			}
		}
	}
	return false
}

type mcpQueryFieldType string

const (
	mcpQueryFieldTypeBoolean     mcpQueryFieldType = "boolean"
	mcpQueryFieldTypeString      mcpQueryFieldType = "string"
	mcpQueryFieldTypeStringArray mcpQueryFieldType = "array[string]"
)

type mcpQuerySchemaContract struct {
	fields   map[string]mcpQueryFieldType
	required map[string]struct{}
	enums    map[string]map[string]struct{}
}

func validateMCPToolQueryAgainstContract(query map[string]any, contract mcpQuerySchemaContract) error {
	if len(contract.fields) == 0 {
		return fmt.Errorf(mcpStdioQuerySchemaValidationMessage)
	}
	if len(query) == 0 {
		if len(contract.required) > 0 {
			return fmt.Errorf(mcpStdioQuerySchemaValidationMessage)
		}
		return nil
	}
	for key := range query {
		normalized := strings.TrimSpace(key)
		if normalized == "" || normalized != key {
			return fmt.Errorf(mcpStdioQuerySchemaValidationMessage)
		}
		fieldType, ok := contract.fields[normalized]
		if !ok {
			return fmt.Errorf(mcpStdioQuerySchemaValidationMessage)
		}
		if !mcpQueryValueMatchesType(query[normalized], fieldType) {
			return fmt.Errorf(mcpStdioQuerySchemaValidationMessage)
		}
		if !mcpQueryValueMatchesEnum(query[normalized], fieldType, contract.enums[normalized]) {
			return fmt.Errorf(mcpStdioQuerySchemaValidationMessage)
		}
	}
	for key := range contract.required {
		if _, ok := query[key]; !ok {
			return fmt.Errorf(mcpStdioQuerySchemaValidationMessage)
		}
	}
	return nil
}

func mcpQueryValueMatchesType(value any, fieldType mcpQueryFieldType) bool {
	switch fieldType {
	case mcpQueryFieldTypeBoolean:
		_, ok := value.(bool)
		return ok
	case mcpQueryFieldTypeString:
		_, ok := value.(string)
		return ok
	case mcpQueryFieldTypeStringArray:
		switch typed := value.(type) {
		case []string:
			return true
		case []any:
			for _, item := range typed {
				if _, ok := item.(string); !ok {
					return false
				}
			}
			return true
		default:
			return false
		}
	default:
		return false
	}
}

func mcpQueryValueMatchesEnum(value any, fieldType mcpQueryFieldType, allowed map[string]struct{}) bool {
	if len(allowed) == 0 {
		return true
	}
	switch fieldType {
	case mcpQueryFieldTypeString:
		typed, ok := value.(string)
		if !ok {
			return false
		}
		_, ok = allowed[typed]
		return ok
	case mcpQueryFieldTypeStringArray:
		switch typed := value.(type) {
		case []string:
			for _, item := range typed {
				if _, ok := allowed[item]; !ok {
					return false
				}
			}
			return true
		case []any:
			for _, item := range typed {
				text, ok := item.(string)
				if !ok {
					return false
				}
				if _, ok := allowed[text]; !ok {
					return false
				}
			}
			return true
		default:
			return false
		}
	default:
		return true
	}
}

func mcpToolQueryContractForSchema(querySchemaRef string) (mcpQuerySchemaContract, error) {
	contract, ok := mcpQuerySchemaContractsByRef[strings.TrimSpace(querySchemaRef)]
	if !ok {
		return mcpQuerySchemaContract{}, fmt.Errorf("unknown query schema ref %q", querySchemaRef)
	}
	return contract.clone(), nil
}

func (c mcpQuerySchemaContract) clone() mcpQuerySchemaContract {
	cloned := mcpQuerySchemaContract{
		fields:   make(map[string]mcpQueryFieldType, len(c.fields)),
		required: make(map[string]struct{}, len(c.required)),
		enums:    make(map[string]map[string]struct{}, len(c.enums)),
	}
	for key, fieldType := range c.fields {
		cloned.fields[key] = fieldType
	}
	for key := range c.required {
		cloned.required[key] = struct{}{}
	}
	for key, allowed := range c.enums {
		cloned.enums[key] = cloneStringSet(allowed)
	}
	return cloned
}

func mcpQueryEnumValues(values ...string) map[string]struct{} {
	set := make(map[string]struct{}, len(values))
	for _, value := range values {
		set[value] = struct{}{}
	}
	return set
}

func cloneStringSet(values map[string]struct{}) map[string]struct{} {
	if len(values) == 0 {
		return nil
	}
	cloned := make(map[string]struct{}, len(values))
	for value := range values {
		cloned[value] = struct{}{}
	}
	return cloned
}

var mcpQueryProtocolEnum = mcpQueryEnumValues("codex", "openai_responses", "openai_chat", "anthropic")

var mcpQuerySchemaContractsByRef = map[string]mcpQuerySchemaContract{
	"schemas/bridge-surface-v1.schema.json#/$defs/accountsSummaryInput": {
		fields: map[string]mcpQueryFieldType{
			"include_disabled": mcpQueryFieldTypeBoolean,
			"kinds":            mcpQueryFieldTypeStringArray,
			"protocol":         mcpQueryFieldTypeString,
			"detail_level":     mcpQueryFieldTypeString,
		},
		enums: map[string]map[string]struct{}{
			"kinds":        mcpQueryEnumValues("auth-file", "codex-api-key", "openai-compatible"),
			"protocol":     mcpQueryProtocolEnum,
			"detail_level": mcpQueryEnumValues("summary", "diagnostic_refs"),
		},
	},
	"schemas/bridge-surface-v1.schema.json#/$defs/modelsSupportedInput": {
		fields: map[string]mcpQueryFieldType{
			"protocol":                 mcpQueryFieldTypeString,
			"account_key":              mcpQueryFieldTypeString,
			"include_disabled_sources": mcpQueryFieldTypeBoolean,
		},
		enums: map[string]map[string]struct{}{
			"protocol": mcpQueryProtocolEnum,
		},
	},
	"schemas/bridge-surface-v1.schema.json#/$defs/routesDiagnosticsInput": {
		fields: map[string]mcpQueryFieldType{
			"protocol":                 mcpQueryFieldTypeString,
			"model":                    mcpQueryFieldTypeString,
			"project":                  mcpQueryFieldTypeString,
			"account_key":              mcpQueryFieldTypeString,
			"include_recent_decisions": mcpQueryFieldTypeBoolean,
			"probe_mode":               mcpQueryFieldTypeString,
		},
		required: map[string]struct{}{
			"protocol": {},
			"model":    {},
		},
		enums: map[string]map[string]struct{}{
			"protocol":   mcpQueryProtocolEnum,
			"probe_mode": mcpQueryEnumValues("none", "dry_run"),
		},
	},
	"schemas/bridge-surface-v1.schema.json#/$defs/quotaSummaryInput": {
		fields: map[string]mcpQueryFieldType{
			"account_key":     mcpQueryFieldTypeString,
			"protocol":        mcpQueryFieldTypeString,
			"include_billing": mcpQueryFieldTypeBoolean,
			"include_stale":   mcpQueryFieldTypeBoolean,
		},
		enums: map[string]map[string]struct{}{
			"protocol": mcpQueryProtocolEnum,
		},
	},
	"schemas/bridge-surface-v1.schema.json#/$defs/actionInput": {
		fields: map[string]mcpQueryFieldType{
			"account_key":     mcpQueryFieldTypeString,
			"protocol":        mcpQueryFieldTypeString,
			"model":           mcpQueryFieldTypeString,
			"project":         mcpQueryFieldTypeString,
			"include_billing": mcpQueryFieldTypeBoolean,
			"probe_mode":      mcpQueryFieldTypeString,
			"reason":          mcpQueryFieldTypeString,
		},
		enums: map[string]map[string]struct{}{
			"protocol":   mcpQueryProtocolEnum,
			"probe_mode": mcpQueryEnumValues("dry_run"),
		},
	},
}

func forbiddenCredentialKey(key string) bool {
	normalized := strings.NewReplacer("-", "_", " ", "_", ".", "_", "/", "_", ":", "_").Replace(strings.ToLower(strings.TrimSpace(key)))
	_, ok := mcpStdioCredentialKeys[normalized]
	return ok
}

func containsCredentialBearingText(text string) bool {
	text = strings.TrimSpace(text)
	if text == "" {
		return false
	}
	for _, pattern := range mcpStdioCredentialValuePatterns {
		if pattern.MatchString(text) {
			return true
		}
	}
	return false
}
