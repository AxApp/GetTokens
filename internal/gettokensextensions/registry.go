package gettokensextensions

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const (
	ManifestFileName = "gettokens.extension.json"

	RegistryModeReadOnly = "read-only"
	ContractVersionV0    = "0.1.0"

	StateInvalid              ExtensionState = "invalid"
	StateEnabled              ExtensionState = "enabled"
	StateDisabled             ExtensionState = "disabled"
	StateReadonlyCompatible   ExtensionState = "readonly-compatible"
	StateReadonlyIncompatible ExtensionState = "readonly-incompatible"

	SeverityError   DiagnosticSeverity = "error"
	SeverityWarning DiagnosticSeverity = "warning"

	DiagnosticManifestReadError     = "manifest-read-error"
	DiagnosticRootNotFound          = "extension-root-not-found"
	DiagnosticManifestParseError    = "manifest-parse-error"
	DiagnosticSchemaValidationError = "schema-validation-error"
	DiagnosticUnknownCapabilityKind = "unknown-capability-kind"
	DiagnosticForbiddenPermission   = "forbidden-permission"
	DiagnosticMissingPermission     = "missing-required-permission"
	DiagnosticDuplicateExtensionID  = "duplicate-extension-id"
	DiagnosticDuplicateCapabilityID = "duplicate-capability-id"
	DiagnosticIncompatibleContract  = "incompatible-contract"
	DiagnosticEnableStateReadError  = "enable-state-read-error"
	DiagnosticEnableStateParseError = "enable-state-parse-error"
)

var allowedPermissions = map[string]struct{}{
	"provider.metadata.read":           {},
	"model.catalog.read":               {},
	"account.import.preview":           {},
	"account.import.apply":             {},
	"quota.probe.read":                 {},
	"network.fetch.declared-endpoints": {},
	"secret.ref.read":                  {},
}

var allowedCapabilityKinds = map[string]struct{}{
	"provider-metadata":    {},
	"model-catalog-source": {},
	"account-importer":     {},
	"quota-probe":          {},
}

var topLevelManifestKeys = map[string]struct{}{
	"contractVersion": {},
	"id":              {},
	"name":            {},
	"version":         {},
	"publisher":       {},
	"description":     {},
	"homepage":        {},
	"source":          {},
	"compatibility":   {},
	"permissions":     {},
	"capabilities":    {},
	"metadata":        {},
}

var commonCapabilityKeys = map[string]struct{}{
	"id":   {},
	"kind": {},
}

var capabilityKeysByKind = map[string]map[string]struct{}{
	"provider-metadata": mergeKeySets(commonCapabilityKeys, map[string]struct{}{
		"provider":  {},
		"endpoints": {},
		"ui":        {},
	}),
	"model-catalog-source": mergeKeySets(commonCapabilityKeys, map[string]struct{}{
		"providerId":       {},
		"source":           {},
		"models":           {},
		"contributionMode": {},
		"priority":         {},
	}),
	"account-importer": mergeKeySets(commonCapabilityKeys, map[string]struct{}{
		"providerId": {},
		"formats":    {},
		"preview":    {},
	}),
	"quota-probe": mergeKeySets(commonCapabilityKeys, map[string]struct{}{
		"providerId": {},
		"target":     {},
		"request":    {},
		"response":   {},
		"schedule":   {},
	}),
}

var providerMetadataProviderKeys = map[string]struct{}{
	"id":               {},
	"displayName":      {},
	"family":           {},
	"homepage":         {},
	"contributionMode": {},
}

var providerEndpointKeys = map[string]struct{}{
	"id":       {},
	"baseUrl":  {},
	"protocol": {},
	"auth":     {},
}

var providerUIKeys = map[string]struct{}{
	"accent":  {},
	"docsUrl": {},
}

var modelCatalogSourceKeys = map[string]struct{}{
	"type":     {},
	"path":     {},
	"endpoint": {},
}

var modelCatalogEntryKeys = map[string]struct{}{
	"id":               {},
	"displayName":      {},
	"inputModalities":  {},
	"outputModalities": {},
	"contextWindow":    {},
	"status":           {},
	"docsUrl":          {},
}

var quotaTargetKeys = map[string]struct{}{
	"scope":          {},
	"credentialRef":  {},
	"quotaDimension": {},
}

var quotaRequestKeys = map[string]struct{}{
	"method":      {},
	"urlTemplate": {},
	"headers":     {},
	"timeoutMs":   {},
}

var quotaHeaderKeys = map[string]struct{}{
	"name":      {},
	"valueFrom": {},
}

var quotaResponseKeys = map[string]struct{}{
	"parser": {},
	"fields": {},
}

var quotaScheduleKeys = map[string]struct{}{
	"mode":           {},
	"minIntervalSec": {},
}

type ExtensionState string

type DiagnosticSeverity string

type LoadOptions struct {
	ManifestPaths []string
	Roots         []Root
	StatePath     string
	Now           func() time.Time
}

type Root struct {
	ID       string `json:"id"`
	Path     string `json:"path"`
	ReadOnly bool   `json:"readOnly"`
}

type RegistrySnapshot struct {
	ContractVersion string              `json:"contractVersion"`
	RegistryMode    string              `json:"registryMode"`
	GeneratedAt     string              `json:"generatedAt"`
	ReadOnly        bool                `json:"readOnly"`
	Roots           []Root              `json:"roots"`
	Extensions      []ExtensionSnapshot `json:"extensions"`
	Diagnostics     []Diagnostic        `json:"diagnostics"`
}

type ExtensionSnapshot struct {
	ID            string                `json:"id,omitempty"`
	Name          string                `json:"name,omitempty"`
	Version       string                `json:"version,omitempty"`
	Publisher     Publisher             `json:"publisher,omitempty"`
	Source        ExtensionSource       `json:"source"`
	State         ExtensionState        `json:"state"`
	ReadOnly      bool                  `json:"readOnly"`
	Compatibility CompatibilitySnapshot `json:"compatibility,omitempty"`
	Permissions   []string              `json:"permissions,omitempty"`
	Capabilities  []CapabilitySnapshot  `json:"capabilities,omitempty"`
	Diagnostics   []Diagnostic          `json:"diagnostics"`
}

type Publisher struct {
	Name string `json:"name,omitempty"`
	URL  string `json:"url,omitempty"`
}

type ExtensionSource struct {
	Type         string `json:"type,omitempty"`
	URI          string `json:"uri,omitempty"`
	Revision     string `json:"revision,omitempty"`
	ManifestPath string `json:"manifestPath"`
}

type CompatibilitySnapshot struct {
	ManifestContract   string `json:"manifestContract,omitempty"`
	SidecarContract    string `json:"sidecarContract,omitempty"`
	CapabilityContract string `json:"capabilityContract,omitempty"`
	Status             string `json:"status,omitempty"`
}

type CapabilitySnapshot struct {
	ID                    string         `json:"id,omitempty"`
	Kind                  string         `json:"kind,omitempty"`
	State                 ExtensionState `json:"state"`
	RequiredPermissions   []string       `json:"requiredPermissions,omitempty"`
	DeclaredContributions []string       `json:"declaredContributions,omitempty"`
	Diagnostics           []Diagnostic   `json:"diagnostics"`
}

type Diagnostic struct {
	Code     string             `json:"code"`
	Severity DiagnosticSeverity `json:"severity"`
	Path     string             `json:"path,omitempty"`
	Message  string             `json:"message"`
	Source   string             `json:"source,omitempty"`
}

type manifest struct {
	ContractVersion string                `json:"contractVersion"`
	ID              string                `json:"id"`
	Name            string                `json:"name"`
	Version         string                `json:"version"`
	Publisher       Publisher             `json:"publisher"`
	Description     string                `json:"description"`
	Homepage        string                `json:"homepage"`
	Source          manifestSource        `json:"source"`
	Compatibility   manifestCompatibility `json:"compatibility"`
	Permissions     []string              `json:"permissions"`
	Capabilities    []json.RawMessage     `json:"capabilities"`
	Metadata        json.RawMessage       `json:"metadata"`
}

type manifestSource struct {
	Type     string `json:"type"`
	URI      string `json:"uri"`
	Revision string `json:"revision"`
}

type manifestCompatibility struct {
	GetTokens          string `json:"gettokens"`
	SidecarContract    string `json:"sidecarContract"`
	CapabilityContract string `json:"capabilityContract"`
}

type capabilityManifest struct {
	ID         string                `json:"id"`
	Kind       string                `json:"kind"`
	Provider   providerManifest      `json:"provider"`
	ProviderID string                `json:"providerId"`
	Source     catalogSourceManifest `json:"source"`
	Endpoints  []json.RawMessage     `json:"endpoints"`
	Models     []modelManifest       `json:"models"`
	Target     quotaTargetManifest   `json:"target"`
	Request    quotaRequestManifest  `json:"request"`
	Response   quotaResponseManifest `json:"response"`
	Schedule   quotaScheduleManifest `json:"schedule"`
}

type providerManifest struct {
	ID               string `json:"id"`
	DisplayName      string `json:"displayName"`
	Family           string `json:"family"`
	Homepage         string `json:"homepage"`
	ContributionMode string `json:"contributionMode"`
}

type catalogSourceManifest struct {
	Type     string `json:"type"`
	Path     string `json:"path"`
	Endpoint string `json:"endpoint"`
}

type modelManifest struct {
	ID string `json:"id"`
}

type quotaTargetManifest struct {
	Scope          string `json:"scope"`
	CredentialRef  string `json:"credentialRef"`
	QuotaDimension string `json:"quotaDimension"`
}

type quotaRequestManifest struct {
	Method      string                `json:"method"`
	URLTemplate string                `json:"urlTemplate"`
	Headers     []quotaHeaderManifest `json:"headers"`
	TimeoutMs   int                   `json:"timeoutMs"`
}

type quotaHeaderManifest struct {
	Name      string `json:"name"`
	ValueFrom string `json:"valueFrom"`
}

type quotaResponseManifest struct {
	Parser string            `json:"parser"`
	Fields map[string]string `json:"fields"`
}

type quotaScheduleManifest struct {
	Mode           string `json:"mode"`
	MinIntervalSec int    `json:"minIntervalSec"`
}

func LoadRegistrySnapshot(options LoadOptions) (RegistrySnapshot, error) {
	now := time.Now
	if options.Now != nil {
		now = options.Now
	}

	snapshot := RegistrySnapshot{
		ContractVersion: ContractVersionV0,
		RegistryMode:    RegistryModeReadOnly,
		GeneratedAt:     now().UTC().Format(time.RFC3339),
		ReadOnly:        true,
		Roots:           normalizeRoots(options.Roots),
		Extensions:      []ExtensionSnapshot{},
		Diagnostics:     []Diagnostic{},
	}

	manifestPaths := append([]string{}, options.ManifestPaths...)
	scannedPaths, scanDiagnostics := scanRoots(options.Roots)
	manifestPaths = append(manifestPaths, scannedPaths...)
	snapshot.Diagnostics = append(snapshot.Diagnostics, scanDiagnostics...)

	seenExtensionIDs := map[string]string{}
	for _, manifestPath := range manifestPaths {
		extension := loadManifest(manifestPath)
		if extension.ID != "" {
			if firstPath, ok := seenExtensionIDs[extension.ID]; ok {
				extension.State = StateInvalid
				extension.Diagnostics = append(extension.Diagnostics, diagnostic(
					DiagnosticDuplicateExtensionID,
					SeverityError,
					"$.id",
					fmt.Sprintf("extension id %q already appeared at %s", extension.ID, firstPath),
					manifestPath,
				))
			} else {
				seenExtensionIDs[extension.ID] = manifestPath
			}
		}
		snapshot.Extensions = append(snapshot.Extensions, extension)
	}

	if options.StatePath != "" {
		state, err := LoadExtensionEnableState(options.StatePath)
		if err != nil {
			snapshot.Diagnostics = append(snapshot.Diagnostics, diagnostic(
				DiagnosticEnableStateReadError,
				SeverityError,
				options.StatePath,
				err.Error(),
				options.StatePath,
			))
		} else {
			mergeEnableState(&snapshot, state)
		}
	}

	return snapshot, nil
}

func normalizeRoots(roots []Root) []Root {
	normalized := make([]Root, 0, len(roots))
	for _, root := range roots {
		if root.ID == "" {
			root.ID = "local"
		}
		root.ReadOnly = true
		normalized = append(normalized, root)
	}
	return normalized
}

func scanRoots(roots []Root) ([]string, []Diagnostic) {
	var paths []string
	var diagnostics []Diagnostic
	for _, root := range roots {
		if root.Path == "" {
			continue
		}
		if _, err := os.Stat(root.Path); err != nil {
			if os.IsNotExist(err) {
				diagnostics = append(diagnostics, diagnostic(
					DiagnosticRootNotFound,
					SeverityWarning,
					root.Path,
					"extension root does not exist; returning an empty read-only registry for this root",
					root.Path,
				))
				continue
			}
			diagnostics = append(diagnostics, diagnostic(
				DiagnosticManifestReadError,
				SeverityError,
				root.Path,
				err.Error(),
				root.Path,
			))
			continue
		}
		err := filepath.WalkDir(root.Path, func(path string, entry fs.DirEntry, err error) error {
			if err != nil {
				diagnostics = append(diagnostics, diagnostic(
					DiagnosticManifestReadError,
					SeverityError,
					path,
					err.Error(),
					path,
				))
				return filepath.SkipDir
			}
			if entry.IsDir() {
				return nil
			}
			if filepath.Base(path) == ManifestFileName {
				paths = append(paths, path)
			}
			return nil
		})
		if err != nil {
			diagnostics = append(diagnostics, diagnostic(
				DiagnosticManifestReadError,
				SeverityError,
				root.Path,
				err.Error(),
				root.Path,
			))
		}
	}
	sort.Strings(paths)
	return paths, diagnostics
}

func loadManifest(manifestPath string) ExtensionSnapshot {
	extension := ExtensionSnapshot{
		Source: ExtensionSource{
			ManifestPath: manifestPath,
		},
		State:       StateInvalid,
		ReadOnly:    true,
		Diagnostics: []Diagnostic{},
	}

	body, err := os.ReadFile(manifestPath)
	if err != nil {
		extension.Diagnostics = append(extension.Diagnostics, diagnostic(
			DiagnosticManifestReadError,
			SeverityError,
			"",
			err.Error(),
			manifestPath,
		))
		return extension
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(body, &raw); err != nil {
		extension.Diagnostics = append(extension.Diagnostics, diagnostic(
			DiagnosticManifestParseError,
			SeverityError,
			"",
			err.Error(),
			manifestPath,
		))
		return extension
	}

	var parsed manifest
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&parsed); err != nil {
		extension.Diagnostics = append(extension.Diagnostics, diagnostic(
			DiagnosticSchemaValidationError,
			SeverityError,
			"$",
			err.Error(),
			manifestPath,
		))
	}

	extension.ID = parsed.ID
	extension.Name = parsed.Name
	extension.Version = parsed.Version
	extension.Publisher = parsed.Publisher
	extension.Source.Type = parsed.Source.Type
	extension.Source.URI = parsed.Source.URI
	extension.Source.Revision = parsed.Source.Revision
	extension.Permissions = append([]string{}, parsed.Permissions...)
	extension.Compatibility = CompatibilitySnapshot{
		ManifestContract:   parsed.ContractVersion,
		SidecarContract:    parsed.Compatibility.SidecarContract,
		CapabilityContract: parsed.Compatibility.CapabilityContract,
		Status:             "compatible",
	}

	extension.Diagnostics = append(extension.Diagnostics, validateTopLevel(raw, parsed, manifestPath)...)
	permissionSet := map[string]struct{}{}
	for index, permission := range parsed.Permissions {
		if _, ok := allowedPermissions[permission]; !ok {
			extension.Diagnostics = append(extension.Diagnostics, diagnostic(
				DiagnosticForbiddenPermission,
				SeverityError,
				fmt.Sprintf("$.permissions[%d]", index),
				fmt.Sprintf("permission %q is not allowed by extension contract v0", permission),
				manifestPath,
			))
			continue
		}
		permissionSet[permission] = struct{}{}
	}

	extension.Capabilities = validateCapabilities(parsed.Capabilities, permissionSet, manifestPath, &extension.Diagnostics)
	if !isContractCompatible(parsed.ContractVersion, parsed.Compatibility) {
		extension.Compatibility.Status = "incompatible"
		extension.Diagnostics = append(extension.Diagnostics, diagnostic(
			DiagnosticIncompatibleContract,
			SeverityError,
			"$.compatibility",
			"manifest contract range is not compatible with extension contract v0 phase 1",
			manifestPath,
		))
	}

	if containsError(extension.Diagnostics) {
		extension.State = StateInvalid
		for i := range extension.Capabilities {
			if containsError(extension.Capabilities[i].Diagnostics) {
				extension.Capabilities[i].State = StateInvalid
			}
		}
		return extension
	}

	if extension.Compatibility.Status == "incompatible" {
		extension.State = StateReadonlyIncompatible
	} else {
		extension.State = StateReadonlyCompatible
	}
	for i := range extension.Capabilities {
		extension.Capabilities[i].State = extension.State
	}
	return extension
}

func validateTopLevel(raw map[string]json.RawMessage, parsed manifest, source string) []Diagnostic {
	var diagnostics []Diagnostic
	for key := range raw {
		if _, ok := topLevelManifestKeys[key]; !ok {
			diagnostics = append(diagnostics, diagnostic(
				DiagnosticSchemaValidationError,
				SeverityError,
				"$."+key,
				fmt.Sprintf("unknown manifest field %q", key),
				source,
			))
		}
	}

	required := map[string]string{
		"contractVersion":                  parsed.ContractVersion,
		"id":                               parsed.ID,
		"name":                             parsed.Name,
		"version":                          parsed.Version,
		"publisher.name":                   parsed.Publisher.Name,
		"source.type":                      parsed.Source.Type,
		"source.uri":                       parsed.Source.URI,
		"compatibility.sidecarContract":    parsed.Compatibility.SidecarContract,
		"compatibility.capabilityContract": parsed.Compatibility.CapabilityContract,
	}
	for field, value := range required {
		if value == "" {
			diagnostics = append(diagnostics, diagnostic(
				DiagnosticSchemaValidationError,
				SeverityError,
				"$."+field,
				"required manifest field is missing",
				source,
			))
		}
	}
	if len(parsed.Permissions) == 0 {
		diagnostics = append(diagnostics, diagnostic(
			DiagnosticSchemaValidationError,
			SeverityError,
			"$.permissions",
			"permissions must contain at least one item",
			source,
		))
	}
	if len(parsed.Capabilities) == 0 {
		diagnostics = append(diagnostics, diagnostic(
			DiagnosticSchemaValidationError,
			SeverityError,
			"$.capabilities",
			"capabilities must contain at least one item",
			source,
		))
	}
	if parsed.Source.Type != "" && parsed.Source.Type != "local" && parsed.Source.Type != "bundled" {
		diagnostics = append(diagnostics, diagnostic(
			DiagnosticSchemaValidationError,
			SeverityError,
			"$.source.type",
			"source type must be local or bundled",
			source,
		))
	}
	return diagnostics
}

func validateCapabilities(rawCapabilities []json.RawMessage, permissions map[string]struct{}, source string, extensionDiagnostics *[]Diagnostic) []CapabilitySnapshot {
	capabilities := make([]CapabilitySnapshot, 0, len(rawCapabilities))
	seenIDs := map[string]struct{}{}
	for index, rawCapability := range rawCapabilities {
		var capability capabilityManifest
		if err := json.Unmarshal(rawCapability, &capability); err != nil {
			capabilitySnapshot := CapabilitySnapshot{
				State:       StateInvalid,
				Diagnostics: []Diagnostic{diagnostic(DiagnosticSchemaValidationError, SeverityError, fmt.Sprintf("$.capabilities[%d]", index), err.Error(), source)},
			}
			*extensionDiagnostics = append(*extensionDiagnostics, capabilitySnapshot.Diagnostics...)
			capabilities = append(capabilities, capabilitySnapshot)
			continue
		}

		capabilityPath := fmt.Sprintf("$.capabilities[%d]", index)
		capabilitySnapshot := CapabilitySnapshot{
			ID:          capability.ID,
			Kind:        capability.Kind,
			State:       StateReadonlyCompatible,
			Diagnostics: []Diagnostic{},
		}

		if capability.ID == "" {
			capabilitySnapshot.Diagnostics = append(capabilitySnapshot.Diagnostics, diagnostic(
				DiagnosticSchemaValidationError,
				SeverityError,
				capabilityPath+".id",
				"capability id is required",
				source,
			))
		} else if _, ok := seenIDs[capability.ID]; ok {
			capabilitySnapshot.Diagnostics = append(capabilitySnapshot.Diagnostics, diagnostic(
				DiagnosticDuplicateCapabilityID,
				SeverityError,
				capabilityPath+".id",
				fmt.Sprintf("capability id %q appears more than once in the same extension", capability.ID),
				source,
			))
		} else {
			seenIDs[capability.ID] = struct{}{}
		}

		if _, ok := allowedCapabilityKinds[capability.Kind]; !ok {
			capabilitySnapshot.Diagnostics = append(capabilitySnapshot.Diagnostics, diagnostic(
				DiagnosticUnknownCapabilityKind,
				SeverityError,
				capabilityPath+".kind",
				fmt.Sprintf("capability kind %q is not allowed by extension contract v0", capability.Kind),
				source,
			))
		}
		capabilitySnapshot.Diagnostics = append(
			capabilitySnapshot.Diagnostics,
			validateCapabilityShape(rawCapability, capability, capabilityPath, source)...,
		)

		capabilitySnapshot.RequiredPermissions = requiredPermissions(capability)
		for _, permission := range capabilitySnapshot.RequiredPermissions {
			if _, ok := permissions[permission]; !ok {
				capabilitySnapshot.Diagnostics = append(capabilitySnapshot.Diagnostics, diagnostic(
					DiagnosticMissingPermission,
					SeverityError,
					capabilityPath+".requiredPermissions",
					fmt.Sprintf("capability %q requires permission %q", capability.ID, permission),
					source,
				))
			}
		}
		capabilitySnapshot.DeclaredContributions = declaredContributions(capability)

		if containsError(capabilitySnapshot.Diagnostics) {
			capabilitySnapshot.State = StateInvalid
			*extensionDiagnostics = append(*extensionDiagnostics, capabilitySnapshot.Diagnostics...)
		}
		capabilities = append(capabilities, capabilitySnapshot)
	}
	return capabilities
}

func validateCapabilityShape(rawCapability json.RawMessage, capability capabilityManifest, capabilityPath string, source string) []Diagnostic {
	var diagnostics []Diagnostic
	rawFields, ok, err := rawObject(rawCapability)
	if err != nil || !ok {
		if err != nil {
			diagnostics = append(diagnostics, diagnostic(DiagnosticSchemaValidationError, SeverityError, capabilityPath, err.Error(), source))
		}
		return diagnostics
	}

	if allowedKeys, ok := capabilityKeysByKind[capability.Kind]; ok {
		diagnostics = append(diagnostics, validateUnknownFields(rawFields, allowedKeys, capabilityPath, source)...)
	}

	switch capability.Kind {
	case "provider-metadata":
		diagnostics = append(diagnostics, validateProviderMetadataShape(rawFields, capability, capabilityPath, source)...)
	case "model-catalog-source":
		diagnostics = append(diagnostics, validateModelCatalogSourceShape(rawFields, capability, capabilityPath, source)...)
	case "quota-probe":
		diagnostics = append(diagnostics, validateQuotaProbeShape(rawFields, capability, capabilityPath, source)...)
	}
	return diagnostics
}

func validateProviderMetadataShape(rawFields map[string]json.RawMessage, capability capabilityManifest, capabilityPath string, source string) []Diagnostic {
	var diagnostics []Diagnostic
	providerRaw, ok := rawFields["provider"]
	if !ok {
		return append(diagnostics, requiredFieldDiagnostic(capabilityPath+".provider", source))
	}
	providerObject, ok, err := rawObject(providerRaw)
	if err != nil || !ok {
		return append(diagnostics, diagnostic(DiagnosticSchemaValidationError, SeverityError, capabilityPath+".provider", "provider must be an object", source))
	}
	diagnostics = append(diagnostics, validateUnknownFields(providerObject, providerMetadataProviderKeys, capabilityPath+".provider", source)...)
	if capability.Provider.ID == "" {
		diagnostics = append(diagnostics, requiredFieldDiagnostic(capabilityPath+".provider.id", source))
	}
	if endpointsRaw, ok := rawFields["endpoints"]; ok {
		diagnostics = append(diagnostics, validateUnknownFieldsInObjectArray(endpointsRaw, providerEndpointKeys, capabilityPath+".endpoints", source)...)
	}
	if uiRaw, ok := rawFields["ui"]; ok {
		uiObject, ok, err := rawObject(uiRaw)
		if err != nil || !ok {
			diagnostics = append(diagnostics, diagnostic(DiagnosticSchemaValidationError, SeverityError, capabilityPath+".ui", "ui must be an object", source))
		} else {
			diagnostics = append(diagnostics, validateUnknownFields(uiObject, providerUIKeys, capabilityPath+".ui", source)...)
		}
	}
	return diagnostics
}

func validateModelCatalogSourceShape(rawFields map[string]json.RawMessage, capability capabilityManifest, capabilityPath string, source string) []Diagnostic {
	var diagnostics []Diagnostic
	if capability.ProviderID == "" {
		diagnostics = append(diagnostics, requiredFieldDiagnostic(capabilityPath+".providerId", source))
	}
	sourceRaw, ok := rawFields["source"]
	if !ok {
		return append(diagnostics, requiredFieldDiagnostic(capabilityPath+".source", source))
	}
	sourceObject, ok, err := rawObject(sourceRaw)
	if err != nil || !ok {
		return append(diagnostics, diagnostic(DiagnosticSchemaValidationError, SeverityError, capabilityPath+".source", "source must be an object", source))
	}
	diagnostics = append(diagnostics, validateUnknownFields(sourceObject, modelCatalogSourceKeys, capabilityPath+".source", source)...)
	switch capability.Source.Type {
	case "static-json":
		if capability.Source.Path == "" {
			diagnostics = append(diagnostics, requiredFieldDiagnostic(capabilityPath+".source.path", source))
		}
	case "declared-endpoint":
		if capability.Source.Endpoint == "" {
			diagnostics = append(diagnostics, requiredFieldDiagnostic(capabilityPath+".source.endpoint", source))
		} else if !strings.HasPrefix(capability.Source.Endpoint, "https://") {
			diagnostics = append(diagnostics, diagnostic(DiagnosticSchemaValidationError, SeverityError, capabilityPath+".source.endpoint", "declared endpoint must use https", source))
		}
	default:
		diagnostics = append(diagnostics, diagnostic(DiagnosticSchemaValidationError, SeverityError, capabilityPath+".source.type", "source type must be static-json or declared-endpoint", source))
	}
	if modelsRaw, ok := rawFields["models"]; ok {
		diagnostics = append(diagnostics, validateUnknownFieldsInObjectArray(modelsRaw, modelCatalogEntryKeys, capabilityPath+".models", source)...)
	}
	return diagnostics
}

func validateQuotaProbeShape(rawFields map[string]json.RawMessage, capability capabilityManifest, capabilityPath string, source string) []Diagnostic {
	var diagnostics []Diagnostic
	if capability.ProviderID == "" {
		diagnostics = append(diagnostics, requiredFieldDiagnostic(capabilityPath+".providerId", source))
	}
	targetRaw, ok := rawFields["target"]
	if !ok {
		diagnostics = append(diagnostics, requiredFieldDiagnostic(capabilityPath+".target", source))
	} else {
		targetObject, ok, err := rawObject(targetRaw)
		if err != nil || !ok {
			diagnostics = append(diagnostics, diagnostic(DiagnosticSchemaValidationError, SeverityError, capabilityPath+".target", "target must be an object", source))
		} else {
			diagnostics = append(diagnostics, validateUnknownFields(targetObject, quotaTargetKeys, capabilityPath+".target", source)...)
			if capability.Target.Scope != "account" && capability.Target.Scope != "provider" {
				diagnostics = append(diagnostics, diagnostic(DiagnosticSchemaValidationError, SeverityError, capabilityPath+".target.scope", "target scope must be account or provider", source))
			}
			if capability.Target.CredentialRef != "" && !isAllowedCredentialRef(capability.Target.CredentialRef) {
				diagnostics = append(diagnostics, diagnostic(DiagnosticSchemaValidationError, SeverityError, capabilityPath+".target.credentialRef", "credentialRef must reference a supported secret ref", source))
			}
		}
	}
	requestRaw, ok := rawFields["request"]
	if !ok {
		diagnostics = append(diagnostics, requiredFieldDiagnostic(capabilityPath+".request", source))
	} else {
		requestObject, ok, err := rawObject(requestRaw)
		if err != nil || !ok {
			diagnostics = append(diagnostics, diagnostic(DiagnosticSchemaValidationError, SeverityError, capabilityPath+".request", "request must be an object", source))
		} else {
			diagnostics = append(diagnostics, validateUnknownFields(requestObject, quotaRequestKeys, capabilityPath+".request", source)...)
			if capability.Request.Method != "GET" && capability.Request.Method != "POST" {
				diagnostics = append(diagnostics, diagnostic(DiagnosticSchemaValidationError, SeverityError, capabilityPath+".request.method", "request method must be GET or POST", source))
			}
			if capability.Request.URLTemplate == "" {
				diagnostics = append(diagnostics, requiredFieldDiagnostic(capabilityPath+".request.urlTemplate", source))
			} else if !strings.HasPrefix(capability.Request.URLTemplate, "https://") {
				diagnostics = append(diagnostics, diagnostic(DiagnosticSchemaValidationError, SeverityError, capabilityPath+".request.urlTemplate", "request urlTemplate must use https", source))
			}
			if headersRaw, ok := requestObject["headers"]; ok {
				diagnostics = append(diagnostics, validateQuotaHeaders(headersRaw, capability, capabilityPath+".request.headers", source)...)
			}
		}
	}
	responseRaw, ok := rawFields["response"]
	if !ok {
		diagnostics = append(diagnostics, requiredFieldDiagnostic(capabilityPath+".response", source))
	} else {
		responseObject, ok, err := rawObject(responseRaw)
		if err != nil || !ok {
			diagnostics = append(diagnostics, diagnostic(DiagnosticSchemaValidationError, SeverityError, capabilityPath+".response", "response must be an object", source))
		} else {
			diagnostics = append(diagnostics, validateUnknownFields(responseObject, quotaResponseKeys, capabilityPath+".response", source)...)
			if capability.Response.Parser != "json-pointer" {
				diagnostics = append(diagnostics, diagnostic(DiagnosticSchemaValidationError, SeverityError, capabilityPath+".response.parser", "response parser must be json-pointer", source))
			}
			if len(capability.Response.Fields) == 0 {
				diagnostics = append(diagnostics, requiredFieldDiagnostic(capabilityPath+".response.fields", source))
			}
		}
	}
	scheduleRaw, ok := rawFields["schedule"]
	if !ok {
		diagnostics = append(diagnostics, requiredFieldDiagnostic(capabilityPath+".schedule", source))
	} else {
		scheduleObject, ok, err := rawObject(scheduleRaw)
		if err != nil || !ok {
			diagnostics = append(diagnostics, diagnostic(DiagnosticSchemaValidationError, SeverityError, capabilityPath+".schedule", "schedule must be an object", source))
		} else {
			diagnostics = append(diagnostics, validateUnknownFields(scheduleObject, quotaScheduleKeys, capabilityPath+".schedule", source)...)
			if capability.Schedule.Mode != "manual" && capability.Schedule.Mode != "manual-or-background" {
				diagnostics = append(diagnostics, diagnostic(DiagnosticSchemaValidationError, SeverityError, capabilityPath+".schedule.mode", "schedule mode must be manual or manual-or-background", source))
			}
		}
	}
	return diagnostics
}

func validateQuotaHeaders(headersRaw json.RawMessage, capability capabilityManifest, path string, source string) []Diagnostic {
	diagnostics := validateUnknownFieldsInObjectArray(headersRaw, quotaHeaderKeys, path, source)
	for index, header := range capability.Request.Headers {
		headerPath := fmt.Sprintf("%s[%d]", path, index)
		if header.Name == "" {
			diagnostics = append(diagnostics, requiredFieldDiagnostic(headerPath+".name", source))
		}
		if !isAllowedCredentialRef(header.ValueFrom) {
			diagnostics = append(diagnostics, diagnostic(DiagnosticSchemaValidationError, SeverityError, headerPath+".valueFrom", "header valueFrom must reference a supported secret ref", source))
		}
	}
	return diagnostics
}

func validateUnknownFieldsInObjectArray(raw json.RawMessage, allowed map[string]struct{}, path string, source string) []Diagnostic {
	var items []json.RawMessage
	if err := json.Unmarshal(raw, &items); err != nil {
		return []Diagnostic{diagnostic(DiagnosticSchemaValidationError, SeverityError, path, "must be an array", source)}
	}
	var diagnostics []Diagnostic
	for index, item := range items {
		itemObject, ok, err := rawObject(item)
		itemPath := fmt.Sprintf("%s[%d]", path, index)
		if err != nil || !ok {
			diagnostics = append(diagnostics, diagnostic(DiagnosticSchemaValidationError, SeverityError, itemPath, "must be an object", source))
			continue
		}
		diagnostics = append(diagnostics, validateUnknownFields(itemObject, allowed, itemPath, source)...)
	}
	return diagnostics
}

func validateUnknownFields(raw map[string]json.RawMessage, allowed map[string]struct{}, path string, source string) []Diagnostic {
	var diagnostics []Diagnostic
	for key := range raw {
		if _, ok := allowed[key]; !ok {
			diagnostics = append(diagnostics, diagnostic(
				DiagnosticSchemaValidationError,
				SeverityError,
				path+"."+key,
				fmt.Sprintf("unknown capability field %q", key),
				source,
			))
		}
	}
	return diagnostics
}

func rawObject(raw json.RawMessage) (map[string]json.RawMessage, bool, error) {
	var object map[string]json.RawMessage
	if err := json.Unmarshal(raw, &object); err != nil {
		return nil, false, err
	}
	return object, object != nil, nil
}

func requiredFieldDiagnostic(path string, source string) Diagnostic {
	return diagnostic(DiagnosticSchemaValidationError, SeverityError, path, "required capability field is missing", source)
}

func isAllowedCredentialRef(value string) bool {
	switch value {
	case "account.defaultCredential", "credential.bearer", "credential.apiKey":
		return true
	default:
		return false
	}
}

func mergeKeySets(sets ...map[string]struct{}) map[string]struct{} {
	merged := map[string]struct{}{}
	for _, set := range sets {
		for key := range set {
			merged[key] = struct{}{}
		}
	}
	return merged
}

func requiredPermissions(capability capabilityManifest) []string {
	switch capability.Kind {
	case "provider-metadata":
		permissions := []string{"provider.metadata.read"}
		if len(capability.Endpoints) > 0 {
			permissions = append(permissions, "network.fetch.declared-endpoints")
		}
		return permissions
	case "model-catalog-source":
		permissions := []string{"model.catalog.read"}
		if capability.Source.Type == "declared-endpoint" {
			permissions = append(permissions, "network.fetch.declared-endpoints")
		}
		return permissions
	case "account-importer":
		return []string{"account.import.preview"}
	case "quota-probe":
		permissions := []string{"quota.probe.read", "network.fetch.declared-endpoints"}
		if capability.Target.CredentialRef != "" || len(capability.Request.Headers) > 0 {
			permissions = append(permissions, "secret.ref.read")
		}
		return permissions
	default:
		return nil
	}
}

func declaredContributions(capability capabilityManifest) []string {
	switch capability.Kind {
	case "provider-metadata":
		if capability.Provider.ID != "" {
			return []string{"provider:" + capability.Provider.ID}
		}
	case "model-catalog-source":
		contributions := []string{}
		for _, model := range capability.Models {
			if capability.ProviderID != "" && model.ID != "" {
				contributions = append(contributions, "provider:"+capability.ProviderID+"/model:"+model.ID)
			}
		}
		sort.Strings(contributions)
		return contributions
	case "account-importer":
		if capability.ProviderID != "" {
			return []string{"account-importer:" + capability.ProviderID}
		}
	case "quota-probe":
		if capability.ProviderID != "" {
			return []string{"quota-probe:" + capability.ProviderID}
		}
	}
	return nil
}

func isContractCompatible(contractVersion string, compatibility manifestCompatibility) bool {
	if !strings.HasPrefix(contractVersion, "0.1.") {
		return false
	}
	return strings.Contains(compatibility.SidecarContract, "0.1.") || strings.Contains(compatibility.SidecarContract, "0.1")
}

func containsError(diagnostics []Diagnostic) bool {
	for _, item := range diagnostics {
		if item.Severity == SeverityError {
			return true
		}
	}
	return false
}

func diagnostic(code string, severity DiagnosticSeverity, path string, message string, source string) Diagnostic {
	return Diagnostic{
		Code:     code,
		Severity: severity,
		Path:     path,
		Message:  sanitizeDiagnosticMessage(message),
		Source:   source,
	}
}

func sanitizeDiagnosticMessage(message string) string {
	if message == "" {
		return ""
	}
	message = strings.ReplaceAll(message, "\n", " ")
	message = strings.ReplaceAll(message, "\r", " ")
	return message
}
