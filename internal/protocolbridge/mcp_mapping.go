package protocolbridge

import (
	"encoding/json"
	"fmt"
	"strings"
)

const MCPAdapterMappingVersion = "gettokens.bridge.mcp.adapter.mapping.v1"

type MCPAdapterMapping struct {
	Version           string               `json:"version"`
	Transport         Transport            `json:"transport"`
	CanonicalManifest string               `json:"canonical_manifest"`
	BridgeSchema      string               `json:"bridge_schema"`
	Tools             []MCPToolMapping     `json:"tools"`
	Resources         []MCPResourceMapping `json:"resources"`
}

type MCPToolMapping struct {
	Name                   string    `json:"name"`
	CanonicalOperation     Operation `json:"canonical_operation"`
	Type                   string    `json:"type"`
	RequiredScope          Scope     `json:"required_scope"`
	QueryTarget            string    `json:"query_target"`
	QuerySchemaRef         string    `json:"query_schema_ref"`
	ResponseEnvelope       string    `json:"response_envelope"`
	RequiresIdempotencyKey bool      `json:"requires_idempotency_key"`
	AdapterOnlyTruthFields []string  `json:"adapter_only_truth_fields"`
	SafeActionResult       string    `json:"safe_action_result,omitempty"`
}

type MCPResourceMapping struct {
	Name    string   `json:"name"`
	URI     string   `json:"uri"`
	Kind    string   `json:"kind"`
	Source  string   `json:"source"`
	Exposes []string `json:"exposes"`
}

func LoadMCPAdapterMapping(raw []byte) (MCPAdapterMapping, error) {
	var mapping MCPAdapterMapping
	if err := json.Unmarshal(raw, &mapping); err != nil {
		return MCPAdapterMapping{}, fmt.Errorf("parse MCP adapter mapping: %w", err)
	}
	return mapping, nil
}

func ValidateMCPAdapterMapping(mapping MCPAdapterMapping) error {
	var problems []string
	if mapping.Version != MCPAdapterMappingVersion {
		problems = append(problems, fmt.Sprintf("version=%q, want %q", mapping.Version, MCPAdapterMappingVersion))
	}
	if mapping.Transport != TransportMCP {
		problems = append(problems, fmt.Sprintf("transport=%q, want %q", mapping.Transport, TransportMCP))
	}
	if strings.TrimSpace(mapping.CanonicalManifest) != "schemas/canonical-operations-v01.json" {
		problems = append(problems, "canonical_manifest must point to schemas/canonical-operations-v01.json")
	}
	if strings.TrimSpace(mapping.BridgeSchema) != "schemas/bridge-surface-v1.schema.json" {
		problems = append(problems, "bridge_schema must point to schemas/bridge-surface-v1.schema.json")
	}
	problems = append(problems, validateMCPTools(mapping.Tools)...)
	problems = append(problems, validateMCPResources(mapping.Resources)...)
	if len(problems) > 0 {
		return fmt.Errorf("invalid MCP adapter mapping: %s", strings.Join(problems, "; "))
	}
	return nil
}

func validateMCPTools(tools []MCPToolMapping) []string {
	var problems []string
	seenOperations := map[Operation]string{}
	seenNames := map[string]Operation{}
	for _, tool := range tools {
		spec, ok := operationSpecs[tool.CanonicalOperation]
		if !ok {
			problems = append(problems, fmt.Sprintf("tool %q maps unknown operation %q", tool.Name, tool.CanonicalOperation))
			continue
		}
		if strings.TrimSpace(tool.Name) == "" {
			problems = append(problems, fmt.Sprintf("operation %q has empty MCP tool name", tool.CanonicalOperation))
		}
		if previous, exists := seenNames[tool.Name]; exists {
			problems = append(problems, fmt.Sprintf("MCP tool name %q maps to both %q and %q", tool.Name, previous, tool.CanonicalOperation))
		}
		seenNames[tool.Name] = tool.CanonicalOperation
		if previous, exists := seenOperations[tool.CanonicalOperation]; exists {
			problems = append(problems, fmt.Sprintf("operation %q maps to both MCP tools %q and %q", tool.CanonicalOperation, previous, tool.Name))
		}
		seenOperations[tool.CanonicalOperation] = tool.Name
		if tool.Type != spec.Type {
			problems = append(problems, fmt.Sprintf("tool %q type=%q, want %q", tool.Name, tool.Type, spec.Type))
		}
		if tool.RequiredScope != spec.Scope {
			problems = append(problems, fmt.Sprintf("tool %q required_scope=%q, want %q", tool.Name, tool.RequiredScope, spec.Scope))
		}
		if tool.QueryTarget != "canonical.query" {
			problems = append(problems, fmt.Sprintf("tool %q must map parameters to canonical.query", tool.Name))
		}
		if strings.TrimSpace(tool.QuerySchemaRef) == "" {
			problems = append(problems, fmt.Sprintf("tool %q must declare query_schema_ref", tool.Name))
		}
		if tool.ResponseEnvelope != "bridge.surface.v1.responseEnvelope" {
			problems = append(problems, fmt.Sprintf("tool %q must reuse canonical response envelope", tool.Name))
		}
		if len(tool.AdapterOnlyTruthFields) > 0 {
			problems = append(problems, fmt.Sprintf("tool %q declares adapter-only truth fields: %s", tool.Name, strings.Join(tool.AdapterOnlyTruthFields, ",")))
		}
		if spec.Type == "safe_action" {
			if !tool.RequiresIdempotencyKey {
				problems = append(problems, fmt.Sprintf("safe action tool %q must require idempotency key", tool.Name))
			}
			if tool.SafeActionResult != "operation_ref_only" {
				problems = append(problems, fmt.Sprintf("safe action tool %q must expose operation_ref_only result semantics", tool.Name))
			}
		}
		if spec.Type == "read" && tool.RequiresIdempotencyKey {
			problems = append(problems, fmt.Sprintf("read tool %q must not require idempotency key", tool.Name))
		}
	}
	for operation := range operationSpecs {
		if _, ok := seenOperations[operation]; !ok {
			problems = append(problems, fmt.Sprintf("missing MCP tool for operation %q", operation))
		}
	}
	return problems
}

func validateMCPResources(resources []MCPResourceMapping) []string {
	var problems []string
	allowedKinds := map[string]bool{
		"manifest":   true,
		"schema":     true,
		"scope_list": true,
	}
	seenKinds := map[string]bool{}
	for _, resource := range resources {
		if !allowedKinds[resource.Kind] {
			problems = append(problems, fmt.Sprintf("resource %q kind=%q is not allowed", resource.Name, resource.Kind))
		}
		seenKinds[resource.Kind] = true
		if strings.TrimSpace(resource.URI) == "" {
			problems = append(problems, fmt.Sprintf("resource %q must declare uri", resource.Name))
		}
		if exposesForbiddenMCPResourceValue(resource) {
			problems = append(problems, fmt.Sprintf("resource %q exposes forbidden secret/hash/audit material", resource.Name))
		}
	}
	for kind := range allowedKinds {
		if !seenKinds[kind] {
			problems = append(problems, fmt.Sprintf("missing MCP resource kind %q", kind))
		}
	}
	return problems
}

func exposesForbiddenMCPResourceValue(resource MCPResourceMapping) bool {
	values := []string{resource.Name, resource.URI, resource.Kind, resource.Source}
	values = append(values, resource.Exposes...)
	for _, value := range values {
		normalized := strings.ToLower(strings.ReplaceAll(value, "-", "_"))
		for _, forbidden := range []string{
			"token_hash",
			"auth_subject_hash",
			"audit_secret",
			"raw_token",
			"access_token",
			"refresh_token",
			"id_token",
			"api_key_plaintext",
			"cookie",
			"authorization_header",
		} {
			if strings.Contains(normalized, forbidden) {
				return true
			}
		}
	}
	return false
}
