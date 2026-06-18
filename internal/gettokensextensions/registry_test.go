package gettokensextensions

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestLoadRegistrySnapshotValidExampleReturnsReadonlyCompatible(t *testing.T) {
	snapshot, err := LoadRegistrySnapshot(LoadOptions{
		ManifestPaths: []string{fixturePath("provider-metadata-model-catalog.valid.json")},
		Now:           fixedNow,
	})
	if err != nil {
		t.Fatalf("load snapshot: %v", err)
	}
	if snapshot.RegistryMode != "read-only" || !snapshot.ReadOnly {
		t.Fatalf("snapshot should be read-only: %#v", snapshot)
	}
	if len(snapshot.Extensions) != 1 {
		t.Fatalf("extensions len = %d", len(snapshot.Extensions))
	}
	extension := snapshot.Extensions[0]
	if extension.ID != "com.example.openai-metadata" {
		t.Fatalf("extension id = %q", extension.ID)
	}
	if extension.State != StateReadonlyCompatible {
		t.Fatalf("extension state = %q, diagnostics=%#v", extension.State, extension.Diagnostics)
	}
	if extension.Source.ManifestPath == "" {
		t.Fatalf("source manifest path should be present")
	}
	if len(extension.Capabilities) != 2 {
		t.Fatalf("capabilities len = %d", len(extension.Capabilities))
	}
	kinds := map[string]bool{}
	for _, capability := range extension.Capabilities {
		kinds[capability.Kind] = true
		if capability.State != StateReadonlyCompatible {
			t.Fatalf("capability %s state = %q", capability.ID, capability.State)
		}
	}
	if !kinds["provider-metadata"] || !kinds["model-catalog-source"] {
		t.Fatalf("capability kinds = %#v", kinds)
	}
	if containsDiagnostic(extension.Diagnostics, SeverityError, "") {
		t.Fatalf("valid example should not have errors: %#v", extension.Diagnostics)
	}
	assertSnapshotDoesNotLeakRawManifest(t, snapshot, "Adds provider metadata and a static model catalog source.")
}

func TestLoadRegistrySnapshotInvalidUnknownCapabilityAndForbiddenPermission(t *testing.T) {
	snapshot, err := LoadRegistrySnapshot(LoadOptions{
		ManifestPaths: []string{fixturePath("js-hook-unknown-capability.invalid.json")},
		Now:           fixedNow,
	})
	if err != nil {
		t.Fatalf("load snapshot: %v", err)
	}
	if len(snapshot.Extensions) != 1 {
		t.Fatalf("extensions len = %d", len(snapshot.Extensions))
	}
	extension := snapshot.Extensions[0]
	if extension.State != StateInvalid {
		t.Fatalf("extension state = %q, diagnostics=%#v", extension.State, extension.Diagnostics)
	}
	if !containsDiagnostic(extension.Diagnostics, SeverityError, DiagnosticUnknownCapabilityKind) {
		t.Fatalf("missing unknown capability diagnostic: %#v", extension.Diagnostics)
	}
	if !containsDiagnostic(extension.Diagnostics, SeverityError, DiagnosticForbiddenPermission) {
		t.Fatalf("missing forbidden permission diagnostic: %#v", extension.Diagnostics)
	}
	assertSnapshotDoesNotLeakRawManifest(t, snapshot, "return request;")
}

func TestLoadRegistrySnapshotDuplicateExtensionIDMarksLaterInvalid(t *testing.T) {
	dir := t.TempDir()
	first := filepath.Join(dir, "first", ManifestFileName)
	second := filepath.Join(dir, "second", ManifestFileName)
	writeFile(t, first, validManifestWithID("com.example.duplicate"))
	writeFile(t, second, validManifestWithID("com.example.duplicate"))

	snapshot, err := LoadRegistrySnapshot(LoadOptions{
		ManifestPaths: []string{first, second},
		Now:           fixedNow,
	})
	if err != nil {
		t.Fatalf("load snapshot: %v", err)
	}
	if len(snapshot.Extensions) != 2 {
		t.Fatalf("extensions len = %d", len(snapshot.Extensions))
	}
	if snapshot.Extensions[0].State != StateReadonlyCompatible {
		t.Fatalf("first duplicate should keep own validation result: %#v", snapshot.Extensions[0])
	}
	if snapshot.Extensions[1].State != StateInvalid {
		t.Fatalf("later duplicate should be invalid: %#v", snapshot.Extensions[1])
	}
	if !containsDiagnostic(snapshot.Extensions[1].Diagnostics, SeverityError, DiagnosticDuplicateExtensionID) {
		t.Fatalf("missing duplicate diagnostic: %#v", snapshot.Extensions[1].Diagnostics)
	}
}

func TestLoadRegistrySnapshotParseErrorKeepsSourcePathWithoutRawContent(t *testing.T) {
	path := filepath.Join(t.TempDir(), ManifestFileName)
	raw := `{"id":"com.example.broken","token":"secret-literal",`
	writeFile(t, path, raw)

	snapshot, err := LoadRegistrySnapshot(LoadOptions{
		ManifestPaths: []string{path},
		Now:           fixedNow,
	})
	if err != nil {
		t.Fatalf("load snapshot: %v", err)
	}
	if len(snapshot.Extensions) != 1 {
		t.Fatalf("extensions len = %d", len(snapshot.Extensions))
	}
	extension := snapshot.Extensions[0]
	if extension.State != StateInvalid {
		t.Fatalf("extension state = %q", extension.State)
	}
	if extension.Source.ManifestPath != path {
		t.Fatalf("manifest path = %q, want %q", extension.Source.ManifestPath, path)
	}
	if !containsDiagnostic(extension.Diagnostics, SeverityError, DiagnosticManifestParseError) {
		t.Fatalf("missing parse diagnostic: %#v", extension.Diagnostics)
	}
	assertSnapshotDoesNotLeakRawManifest(t, snapshot, "secret-literal")
}

func TestLoadRegistrySnapshotDeclaredEndpointDoesNotFetchNetwork(t *testing.T) {
	var hits atomic.Int64
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	path := filepath.Join(t.TempDir(), ManifestFileName)
	writeFile(t, path, declaredEndpointManifest(server.URL+"/models.json"))

	snapshot, err := LoadRegistrySnapshot(LoadOptions{
		ManifestPaths: []string{path},
		Now:           fixedNow,
	})
	if err != nil {
		t.Fatalf("load snapshot: %v", err)
	}
	if hits.Load() != 0 {
		t.Fatalf("declared endpoint was fetched %d times", hits.Load())
	}
	if snapshot.Extensions[0].State != StateReadonlyCompatible {
		t.Fatalf("declared endpoint manifest should be readonly-compatible: %#v", snapshot.Extensions[0])
	}
}

func TestLoadRegistrySnapshotRejectsProviderMetadataMissingProviderIDAndRuntimeHook(t *testing.T) {
	path := filepath.Join(t.TempDir(), ManifestFileName)
	writeFile(t, path, manifestWithCapabilities(
		"com.example.bad-provider-metadata",
		[]string{"provider.metadata.read"},
		`{
      "id": "bad-provider-metadata",
      "kind": "provider-metadata",
      "provider": {"displayName": "OpenAI", "family": "openai-compatible"},
      "runtime": {"command": "node"},
      "onRequest": "handler"
    }`,
	))

	snapshot, err := LoadRegistrySnapshot(LoadOptions{ManifestPaths: []string{path}, Now: fixedNow})
	if err != nil {
		t.Fatalf("load snapshot: %v", err)
	}
	extension := snapshot.Extensions[0]
	if extension.State != StateInvalid {
		t.Fatalf("extension state = %q, diagnostics=%#v", extension.State, extension.Diagnostics)
	}
	if extension.Capabilities[0].State != StateInvalid {
		t.Fatalf("capability should be invalid: %#v", extension.Capabilities[0])
	}
	if !containsDiagnosticPath(extension.Diagnostics, SeverityError, DiagnosticSchemaValidationError, "$.capabilities[0].provider.id") {
		t.Fatalf("missing provider.id diagnostic: %#v", extension.Diagnostics)
	}
	if !containsDiagnosticPath(extension.Diagnostics, SeverityError, DiagnosticSchemaValidationError, "$.capabilities[0].runtime") {
		t.Fatalf("missing runtime hook diagnostic: %#v", extension.Diagnostics)
	}
	if !containsDiagnosticPath(extension.Diagnostics, SeverityError, DiagnosticSchemaValidationError, "$.capabilities[0].onRequest") {
		t.Fatalf("missing onRequest hook diagnostic: %#v", extension.Diagnostics)
	}
}

func TestLoadRegistrySnapshotRejectsModelCatalogMissingProviderOrInvalidSource(t *testing.T) {
	path := filepath.Join(t.TempDir(), ManifestFileName)
	writeFile(t, path, manifestWithCapabilities(
		"com.example.bad-model-catalog",
		[]string{"model.catalog.read"},
		`{
      "id": "bad-model-catalog",
      "kind": "model-catalog-source",
      "source": {"type": "runtime-script", "runtime": "node"}
    }`,
	))

	snapshot, err := LoadRegistrySnapshot(LoadOptions{ManifestPaths: []string{path}, Now: fixedNow})
	if err != nil {
		t.Fatalf("load snapshot: %v", err)
	}
	extension := snapshot.Extensions[0]
	if extension.State != StateInvalid {
		t.Fatalf("extension state = %q, diagnostics=%#v", extension.State, extension.Diagnostics)
	}
	if !containsDiagnosticPath(extension.Diagnostics, SeverityError, DiagnosticSchemaValidationError, "$.capabilities[0].providerId") {
		t.Fatalf("missing providerId diagnostic: %#v", extension.Diagnostics)
	}
	if !containsDiagnosticPath(extension.Diagnostics, SeverityError, DiagnosticSchemaValidationError, "$.capabilities[0].source.type") {
		t.Fatalf("missing source.type diagnostic: %#v", extension.Diagnostics)
	}
	if !containsDiagnosticPath(extension.Diagnostics, SeverityError, DiagnosticSchemaValidationError, "$.capabilities[0].source.runtime") {
		t.Fatalf("missing source.runtime diagnostic: %#v", extension.Diagnostics)
	}
}

func TestLoadRegistrySnapshotRejectsQuotaProbeMissingStructureInlineSecretAndRuntimeHook(t *testing.T) {
	path := filepath.Join(t.TempDir(), ManifestFileName)
	writeFile(t, path, manifestWithCapabilities(
		"com.example.bad-quota-probe",
		[]string{"quota.probe.read", "network.fetch.declared-endpoints", "secret.ref.read"},
		`{
      "id": "bad-quota-probe",
      "kind": "quota-probe",
      "providerId": "openai",
      "target": {"scope": "account", "credentialRef": "sk-inline-secret"},
      "request": {
        "method": "GET",
        "urlTemplate": "https://api.openai.com/v1/usage",
        "headers": [{"name": "Authorization", "value": "Bearer sk-inline-secret"}]
      },
      "response": {"parser": "json-pointer", "fields": {"remaining": "/limits/remaining"}},
      "schedule": {"mode": "manual"},
      "onRequest": "runUserCode"
    }`,
		`{
      "id": "missing-quota-structure",
      "kind": "quota-probe",
      "providerId": "openai",
      "response": {"parser": "json-pointer", "fields": {"remaining": "/limits/remaining"}},
      "schedule": {"mode": "manual"}
    }`,
	))

	snapshot, err := LoadRegistrySnapshot(LoadOptions{ManifestPaths: []string{path}, Now: fixedNow})
	if err != nil {
		t.Fatalf("load snapshot: %v", err)
	}
	extension := snapshot.Extensions[0]
	if extension.State != StateInvalid {
		t.Fatalf("extension state = %q, diagnostics=%#v", extension.State, extension.Diagnostics)
	}
	if !containsDiagnosticPath(extension.Diagnostics, SeverityError, DiagnosticSchemaValidationError, "$.capabilities[0].target.credentialRef") {
		t.Fatalf("missing inline credential diagnostic: %#v", extension.Diagnostics)
	}
	if !containsDiagnosticPath(extension.Diagnostics, SeverityError, DiagnosticSchemaValidationError, "$.capabilities[0].request.headers[0].value") {
		t.Fatalf("missing inline header secret diagnostic: %#v", extension.Diagnostics)
	}
	if !containsDiagnosticPath(extension.Diagnostics, SeverityError, DiagnosticSchemaValidationError, "$.capabilities[0].onRequest") {
		t.Fatalf("missing runtime hook diagnostic: %#v", extension.Diagnostics)
	}
	if !containsDiagnosticPath(extension.Diagnostics, SeverityError, DiagnosticSchemaValidationError, "$.capabilities[1].target") {
		t.Fatalf("missing target structure diagnostic: %#v", extension.Diagnostics)
	}
	if !containsDiagnosticPath(extension.Diagnostics, SeverityError, DiagnosticSchemaValidationError, "$.capabilities[1].request") {
		t.Fatalf("missing request structure diagnostic: %#v", extension.Diagnostics)
	}
}

func TestLoadRegistrySnapshotScansRootsForManifestFiles(t *testing.T) {
	root := t.TempDir()
	manifest := filepath.Join(root, "openai", ManifestFileName)
	writeFile(t, manifest, validManifestWithID("com.example.root-scan"))
	writeFile(t, filepath.Join(root, "ignored.json"), validManifestWithID("com.example.ignored"))

	snapshot, err := LoadRegistrySnapshot(LoadOptions{
		Roots: []Root{{ID: "local", Path: root, ReadOnly: true}},
		Now:   fixedNow,
	})
	if err != nil {
		t.Fatalf("load snapshot: %v", err)
	}
	if len(snapshot.Extensions) != 1 {
		t.Fatalf("extensions len = %d", len(snapshot.Extensions))
	}
	if snapshot.Extensions[0].Source.ManifestPath != manifest {
		t.Fatalf("manifest path = %q, want %q", snapshot.Extensions[0].Source.ManifestPath, manifest)
	}
}

func TestExtensionRegistrySnapshotMissingRootReturnsEmptySnapshotWithDiagnostic(t *testing.T) {
	missingRoot := filepath.Join(t.TempDir(), "missing")

	snapshot, err := LoadRegistrySnapshot(LoadOptions{
		Roots: []Root{{ID: "missing", Path: missingRoot}},
		Now:   fixedNow,
	})
	if err != nil {
		t.Fatalf("load snapshot: %v", err)
	}
	if snapshot.RegistryMode != RegistryModeReadOnly || !snapshot.ReadOnly {
		t.Fatalf("snapshot should be read-only: %#v", snapshot)
	}
	if len(snapshot.Extensions) != 0 {
		t.Fatalf("extensions len = %d, want 0", len(snapshot.Extensions))
	}
	if !containsDiagnostic(snapshot.Diagnostics, SeverityWarning, DiagnosticRootNotFound) {
		t.Fatalf("missing root-not-found diagnostic: %#v", snapshot.Diagnostics)
	}
}

func TestLoadExtensionEnableStateMissingFileReturnsEmpty(t *testing.T) {
	statePath := filepath.Join(t.TempDir(), "extension-enable-state.json")

	state, err := LoadExtensionEnableState(statePath)
	if err != nil {
		t.Fatalf("load missing state: %v", err)
	}
	if state.ContractVersion != ContractVersionV0 {
		t.Fatalf("contract version = %q", state.ContractVersion)
	}
	if len(state.Extensions) != 0 {
		t.Fatalf("extensions len = %d, want 0", len(state.Extensions))
	}
}

func TestSaveExtensionEnableStatePersistsEnableDisableForReload(t *testing.T) {
	statePath := filepath.Join(t.TempDir(), "extension-enable-state.json")
	updatedAt := fixedNow().UTC().Format(time.RFC3339)

	err := SaveExtensionEnableState(statePath, ExtensionEnableStateFile{
		ContractVersion: ContractVersionV0,
		UpdatedAt:       updatedAt,
		Extensions: []ExtensionEnableStateEntry{
			{ID: "com.example.enabled", State: StateEnabled, UpdatedAt: updatedAt},
			{ID: "com.example.disabled", State: StateDisabled, UpdatedAt: updatedAt},
		},
	})
	if err != nil {
		t.Fatalf("save state: %v", err)
	}

	state, err := LoadExtensionEnableState(statePath)
	if err != nil {
		t.Fatalf("reload state: %v", err)
	}
	if len(state.Extensions) != 2 {
		t.Fatalf("extensions len = %d", len(state.Extensions))
	}
	if state.Extensions[0].ID != "com.example.disabled" || state.Extensions[0].State != StateDisabled {
		t.Fatalf("first persisted entry should be sorted disabled entry: %#v", state.Extensions[0])
	}
	if state.Extensions[1].ID != "com.example.enabled" || state.Extensions[1].State != StateEnabled {
		t.Fatalf("second persisted entry should be enabled entry: %#v", state.Extensions[1])
	}
}

func TestSetExtensionEnabledMutatesLocalStateFileOnly(t *testing.T) {
	statePath := filepath.Join(t.TempDir(), "extension-enable-state.json")

	state, err := SetExtensionEnabled(statePath, "com.example.local", false, fixedNow)
	if err != nil {
		t.Fatalf("disable extension: %v", err)
	}
	if len(state.Extensions) != 1 {
		t.Fatalf("extensions len = %d, want 1", len(state.Extensions))
	}
	if state.Extensions[0].ID != "com.example.local" || state.Extensions[0].State != StateDisabled {
		t.Fatalf("disabled state mismatch: %#v", state.Extensions[0])
	}
	if state.Extensions[0].Reason != "local-state-mutation" {
		t.Fatalf("reason = %q", state.Extensions[0].Reason)
	}

	state, err = SetExtensionEnabled(statePath, "com.example.local", true, fixedNow)
	if err != nil {
		t.Fatalf("enable extension: %v", err)
	}
	if len(state.Extensions) != 1 {
		t.Fatalf("extensions len after enable = %d, want 1", len(state.Extensions))
	}
	if state.Extensions[0].State != StateEnabled {
		t.Fatalf("enabled state mismatch: %#v", state.Extensions[0])
	}

	reloaded, err := LoadExtensionEnableState(statePath)
	if err != nil {
		t.Fatalf("reload state: %v", err)
	}
	if reloaded.Extensions[0].State != StateEnabled {
		t.Fatalf("reloaded state mismatch: %#v", reloaded.Extensions[0])
	}
}

func TestLoadRegistrySnapshotMergesManifestWithEnableState(t *testing.T) {
	dir := t.TempDir()
	enabledManifest := filepath.Join(dir, "enabled", ManifestFileName)
	disabledManifest := filepath.Join(dir, "disabled", ManifestFileName)
	writeFile(t, enabledManifest, validManifestWithID("com.example.enabled"))
	writeFile(t, disabledManifest, validManifestWithID("com.example.disabled"))
	statePath := filepath.Join(dir, "extension-enable-state.json")
	updatedAt := fixedNow().UTC().Format(time.RFC3339)
	if err := SaveExtensionEnableState(statePath, ExtensionEnableStateFile{
		ContractVersion: ContractVersionV0,
		UpdatedAt:       updatedAt,
		Extensions: []ExtensionEnableStateEntry{
			{ID: "com.example.enabled", State: StateEnabled, UpdatedAt: updatedAt},
			{ID: "com.example.disabled", State: StateDisabled, UpdatedAt: updatedAt},
		},
	}); err != nil {
		t.Fatalf("save state: %v", err)
	}

	snapshot, err := LoadRegistrySnapshot(LoadOptions{
		ManifestPaths: []string{enabledManifest, disabledManifest},
		StatePath:     statePath,
		Now:           fixedNow,
	})
	if err != nil {
		t.Fatalf("load snapshot: %v", err)
	}

	states := map[string]ExtensionState{}
	for _, extension := range snapshot.Extensions {
		states[extension.ID] = extension.State
		for _, capability := range extension.Capabilities {
			if capability.State != extension.State {
				t.Fatalf("capability %s state = %q, extension state = %q", capability.ID, capability.State, extension.State)
			}
		}
	}
	if states["com.example.enabled"] != StateEnabled {
		t.Fatalf("enabled extension state = %q", states["com.example.enabled"])
	}
	if states["com.example.disabled"] != StateDisabled {
		t.Fatalf("disabled extension state = %q", states["com.example.disabled"])
	}
}

func TestExtensionEnableStateRejectsInvalidIDAndUnknownState(t *testing.T) {
	statePath := filepath.Join(t.TempDir(), "extension-enable-state.json")
	updatedAt := fixedNow().UTC().Format(time.RFC3339)

	err := SaveExtensionEnableState(statePath, ExtensionEnableStateFile{
		ContractVersion: ContractVersionV0,
		UpdatedAt:       updatedAt,
		Extensions: []ExtensionEnableStateEntry{
			{ID: "../bad", State: StateEnabled, UpdatedAt: updatedAt},
		},
	})
	if err == nil {
		t.Fatalf("save should reject invalid extension id")
	}

	err = SaveExtensionEnableState(statePath, ExtensionEnableStateFile{
		ContractVersion: ContractVersionV0,
		UpdatedAt:       updatedAt,
		Extensions: []ExtensionEnableStateEntry{
			{ID: "com.example.unknown", State: ExtensionState("paused"), UpdatedAt: updatedAt},
		},
	})
	if err == nil {
		t.Fatalf("save should reject unknown extension state")
	}

	writeFile(t, statePath, `{
  "contractVersion": "0.1.0",
  "extensions": [{"id": "com.example.upper", "state": " ENABLED "}]
}`)
	state, err := LoadExtensionEnableState(statePath)
	if err != nil {
		t.Fatalf("load normalized state: %v", err)
	}
	if state.Extensions[0].State != StateEnabled {
		t.Fatalf("state should be normalized to enabled: %#v", state.Extensions[0])
	}
}

func TestPreviewCodexConfigDryRunReportsEnabledExtensionsWithoutWritingConfig(t *testing.T) {
	snapshot := RegistrySnapshot{
		ContractVersion: ContractVersionV0,
		Extensions: []ExtensionSnapshot{
			{
				ID:    "com.example.enabled",
				State: StateEnabled,
				Capabilities: []CapabilitySnapshot{{
					ID:                    "catalog-openai",
					Kind:                  "model-catalog-source",
					State:                 StateEnabled,
					DeclaredContributions: []string{"provider:openai/model:gpt-4.1"},
				}},
			},
			{
				ID:    "com.example.readonly-compatible",
				State: StateReadonlyCompatible,
				Capabilities: []CapabilitySnapshot{{
					ID:                    "provider-openai",
					Kind:                  "provider-metadata",
					State:                 StateReadonlyCompatible,
					DeclaredContributions: []string{"provider:openai"},
				}},
			},
			{
				ID:    "com.example.disabled",
				State: StateDisabled,
			},
			{
				ID:    "com.example.invalid",
				State: StateInvalid,
			},
		},
	}

	targetPath := filepath.Join(t.TempDir(), "config.toml")
	preview := PreviewCodexConfigDryRun(snapshot, CodexConfigDryRunOptions{
		TargetPath: targetPath,
		Now:        fixedNow,
	})
	if !preview.DryRun {
		t.Fatalf("preview should be dry-run: %#v", preview)
	}
	if preview.Target != CodexConfigDryRunTarget || preview.TargetPath != targetPath {
		t.Fatalf("target mismatch: %#v", preview)
	}
	if _, err := os.Stat(targetPath); !os.IsNotExist(err) {
		t.Fatalf("dry-run must not create or write target config path, stat err=%v", err)
	}
	if preview.Summary.EnabledExtensionCount != 2 || preview.Summary.SkippedExtensionCount != 2 {
		t.Fatalf("summary mismatch: %#v", preview.Summary)
	}
	if preview.Summary.OperationCount != 2 || len(preview.Operations) != 2 {
		t.Fatalf("dry-run should generate candidate operations: %#v", preview.Operations)
	}
	if preview.Operations[0].Target != "mcp_servers" || preview.Operations[0].CapabilityID != "catalog-openai" {
		t.Fatalf("first operation should project model catalog to MCP preview: %#v", preview.Operations)
	}
	if preview.Operations[1].Target != "skills.config" || preview.Operations[1].CapabilityID != "provider-openai" {
		t.Fatalf("second operation should project provider metadata to Skills preview: %#v", preview.Operations)
	}
	for _, operation := range preview.Operations {
		if operation.Action != "preview" || operation.Preview == "" {
			t.Fatalf("operation should be preview-only with diff text: %#v", operation)
		}
		if operation.PatchPlan.Operation == "" {
			t.Fatalf("operation should include target-scoped patch plan: %#v", operation)
		}
		if operation.Target == "skills.config" && operation.PatchPlan.TargetSection != "skills.config" {
			t.Fatalf("skills operation target section mismatch: %#v", operation.PatchPlan)
		}
		if operation.Target == "mcp_servers" && !strings.HasPrefix(operation.PatchPlan.TargetSection, "mcp_servers.") {
			t.Fatalf("MCP operation should target exact parent server section: %#v", operation.PatchPlan)
		}
		if operation.PatchPlan.BeforeSnippet == "" || operation.PatchPlan.AfterSnippet == "" {
			t.Fatalf("patch plan should include before/after snippets: %#v", operation.PatchPlan)
		}
		joinedValidation := strings.Join(operation.PatchPlan.Validation, "\n")
		if !strings.Contains(joinedValidation, "dry-run-only") || !strings.Contains(joinedValidation, "no-target-config-read") {
			t.Fatalf("patch plan should carry dry-run validation: %#v", operation.PatchPlan.Validation)
		}
		if strings.Contains(operation.PatchPlan.AfterSnippet, "bearer_token") && !strings.Contains(operation.PatchPlan.AfterSnippet, "bearer_token_env_var") {
			t.Fatalf("patch plan must not suggest bearer_token literals: %s", operation.PatchPlan.AfterSnippet)
		}
	}
	mcpPlan := preview.Operations[0].PatchPlan
	if !strings.Contains(mcpPlan.AfterSnippet, "[mcp_servers.com-example-enabled-catalog-openai]") {
		t.Fatalf("MCP patch plan should use a parent server table only: %s", mcpPlan.AfterSnippet)
	}
	if strings.Contains(mcpPlan.AfterSnippet, ".tools.") || strings.Contains(mcpPlan.AfterSnippet, ".oauth]") {
		t.Fatalf("MCP patch plan must not project nested tables as servers: %s", mcpPlan.AfterSnippet)
	}
	skillsPlan := preview.Operations[1].PatchPlan
	if !strings.Contains(skillsPlan.AfterSnippet, "[[skills.config]]") {
		t.Fatalf("Skills patch plan should target skills.config array table: %s", skillsPlan.AfterSnippet)
	}
	if preview.Summary.ValidationErrorCount != 0 || len(preview.Validation) != 2 {
		t.Fatalf("validation mismatch: %#v", preview.Validation)
	}
	for _, validation := range preview.Validation {
		if validation.Code != DiagnosticCodexConfigProjectionOnly || validation.Severity != string(SeverityWarning) {
			t.Fatalf("validation should describe preview-only projection: %#v", validation)
		}
		if validation.Target != CodexConfigDryRunTarget {
			t.Fatalf("validation target mismatch: %#v", validation)
		}
	}
	if len(preview.Sections) != 2 || preview.Sections[0].ID != "skills.config" || preview.Sections[1].ID != "mcp_servers" {
		t.Fatalf("sections mismatch: %#v", preview.Sections)
	}
}

func TestPreviewCodexConfigDryRunPlansFromReadOnlyTomlInput(t *testing.T) {
	snapshot := RegistrySnapshot{
		ContractVersion: ContractVersionV0,
		Extensions: []ExtensionSnapshot{{
			ID:    "com.example.enabled",
			State: StateEnabled,
			Capabilities: []CapabilitySnapshot{
				{
					ID:                    "provider-openai",
					Kind:                  "provider-metadata",
					State:                 StateEnabled,
					DeclaredContributions: []string{"provider:openai"},
				},
				{
					ID:                    "catalog-openai",
					Kind:                  "model-catalog-source",
					State:                 StateEnabled,
					DeclaredContributions: []string{"provider:openai/model:gpt-4.1"},
				},
			},
		}},
	}
	configText := `
model = "gpt-5"

[[skills.config]]
path = "/Users/example/.codex/skills/old-provider"
enabled = false

[mcp_servers.com-example-enabled-catalog-openai]
command = "old-catalog"
args = ["--stdio"]
bearer_token = "literal-token-should-not-survive"

[mcp_servers.com-example-enabled-catalog-openai.tools.list_models]
approval = "never"

[mcp_servers.com-example-enabled-catalog-openai.oauth]
client_id = "local-client"

[mcp_servers.other]
url = "https://example.invalid/mcp"
`

	preview := PreviewCodexConfigDryRun(snapshot, CodexConfigDryRunOptions{
		ConfigText: configText,
		Now:        fixedNow,
	})
	if preview.Summary.OperationCount != 2 {
		t.Fatalf("operation count = %d, want 2: %#v", preview.Summary.OperationCount, preview.Operations)
	}

	var skillsPlan CodexConfigTomlPatchPlan
	var mcpPlan CodexConfigTomlPatchPlan
	for _, operation := range preview.Operations {
		switch operation.Target {
		case "skills.config":
			skillsPlan = operation.PatchPlan
		case "mcp_servers":
			mcpPlan = operation.PatchPlan
		}
	}
	if !strings.Contains(skillsPlan.BeforeSnippet, "[[skills.config]]") ||
		!strings.Contains(skillsPlan.BeforeSnippet, "old-provider") ||
		!strings.Contains(strings.Join(skillsPlan.Validation, "\n"), "input-toml-read-only") {
		t.Fatalf("skills plan should be based on read-only input TOML: %#v", skillsPlan)
	}
	if !strings.Contains(mcpPlan.BeforeSnippet, "[mcp_servers.com-example-enabled-catalog-openai]") ||
		!strings.Contains(mcpPlan.BeforeSnippet, `command = "old-catalog"`) {
		t.Fatalf("MCP plan should include existing parent server table: %#v", mcpPlan)
	}
	if strings.Contains(mcpPlan.BeforeSnippet, "tools.list_models") ||
		strings.Contains(mcpPlan.BeforeSnippet, "[mcp_servers.com-example-enabled-catalog-openai.oauth]") {
		t.Fatalf("MCP before snippet must not treat nested tools/oauth as parent server: %s", mcpPlan.BeforeSnippet)
	}
	joined := mcpPlan.BeforeSnippet + "\n" + mcpPlan.AfterSnippet
	if strings.Contains(joined, "literal-token-should-not-survive") || strings.Contains(joined, `bearer_token = "literal-token`) {
		t.Fatalf("TOML patch plan must redact bearer_token literals: %s", joined)
	}
	if !strings.Contains(mcpPlan.AfterSnippet, "bearer_token_env_var") {
		t.Fatalf("MCP after snippet should only reference bearer_token_env_var boundary: %s", mcpPlan.AfterSnippet)
	}
}

func TestPreviewCodexConfigDryRunUsesOnlySuppliedTomlInputAndClassifiesNoopAddUpdate(t *testing.T) {
	snapshot := RegistrySnapshot{
		ContractVersion: ContractVersionV0,
		Extensions: []ExtensionSnapshot{
			{
				ID:    "com.example.existing",
				State: StateEnabled,
				Capabilities: []CapabilitySnapshot{
					{
						ID:                    "provider-openai",
						Kind:                  "provider-metadata",
						State:                 StateEnabled,
						DeclaredContributions: []string{"provider:openai"},
					},
					{
						ID:                    "catalog-openai",
						Kind:                  "model-catalog-source",
						State:                 StateEnabled,
						DeclaredContributions: []string{"provider:openai/model:gpt-4.1"},
					},
				},
			},
			{
				ID:    "com.example.missing",
				State: StateEnabled,
				Capabilities: []CapabilitySnapshot{{
					ID:                    "catalog-anthropic",
					Kind:                  "model-catalog-source",
					State:                 StateEnabled,
					DeclaredContributions: []string{"provider:anthropic/model:claude-sonnet"},
				}},
			},
		},
	}
	targetPath := filepath.Join(t.TempDir(), "config.toml")
	targetConfig := `
[[skills.config]]
path = "/real-target/should-not-be-read"

[mcp_servers.com-example-missing-catalog-anthropic]
command = "real-target-should-not-be-read"
`
	writeFile(t, targetPath, targetConfig)
	configText := `
[[skills.config]]
# source_extension = "com.example.existing"
# source_capability = "provider-openai"
path = "/caller-supplied/existing-skill"
enabled = false

[mcp_servers.com-example-existing-catalog-openai]
command = "caller-supplied-existing-catalog"

[mcp_servers.com-example-existing-catalog-openai.tools.list_models]
approval = "never"
`

	preview := PreviewCodexConfigDryRun(snapshot, CodexConfigDryRunOptions{
		TargetPath: targetPath,
		ConfigText: configText,
		Now:        fixedNow,
	})
	if preview.Summary.OperationCount != 3 {
		t.Fatalf("operation count = %d, want 3: %#v", preview.Summary.OperationCount, preview.Operations)
	}

	plans := map[string]CodexConfigTomlPatchPlan{}
	for _, operation := range preview.Operations {
		plans[operation.ExtensionID+":"+operation.CapabilityID] = operation.PatchPlan
	}
	skillsPlan := plans["com.example.existing:provider-openai"]
	updatePlan := plans["com.example.existing:catalog-openai"]
	addPlan := plans["com.example.missing:catalog-anthropic"]

	if skillsPlan.Operation != "noop-existing-array-table-preview" {
		t.Fatalf("existing generated skills action should be classified as noop, got %#v", skillsPlan)
	}
	if strings.Count("\n"+skillsPlan.AfterSnippet, "\n[[skills.config]]") != 1 {
		t.Fatalf("noop skills plan must not append a duplicate action: %s", skillsPlan.AfterSnippet)
	}
	if updatePlan.Operation != "update-parent-table-preview" {
		t.Fatalf("existing MCP parent table should be classified as update, got %#v", updatePlan)
	}
	if addPlan.Operation != "add-parent-table-preview" {
		t.Fatalf("missing MCP parent table should be classified as add, got %#v", addPlan)
	}
	joined := skillsPlan.BeforeSnippet + "\n" + skillsPlan.AfterSnippet + "\n" +
		updatePlan.BeforeSnippet + "\n" + updatePlan.AfterSnippet + "\n" +
		addPlan.BeforeSnippet + "\n" + addPlan.AfterSnippet
	if strings.Contains(joined, "real-target-should-not-be-read") || strings.Contains(joined, "/real-target/should-not-be-read") {
		t.Fatalf("dry-run planner must not read targetPath config; output leaked target file content: %s", joined)
	}
	if !strings.Contains(joined, "/caller-supplied/existing-skill") ||
		!strings.Contains(joined, `command = "caller-supplied-existing-catalog"`) {
		t.Fatalf("dry-run planner should derive snippets only from caller-supplied configText: %s", joined)
	}
	body, err := os.ReadFile(targetPath)
	if err != nil {
		t.Fatalf("read target config after dry-run: %v", err)
	}
	if string(body) != targetConfig {
		t.Fatalf("dry-run planner must not write target config; got %q", string(body))
	}
}

func TestPreviewCodexConfigDryRunRedactsSensitiveTomlFields(t *testing.T) {
	snapshot := RegistrySnapshot{
		ContractVersion: ContractVersionV0,
		Extensions: []ExtensionSnapshot{{
			ID:    "com.example.enabled",
			State: StateEnabled,
			Capabilities: []CapabilitySnapshot{{
				ID:                    "catalog-openai",
				Kind:                  "model-catalog-source",
				State:                 StateEnabled,
				DeclaredContributions: []string{"provider:openai/model:gpt-4.1"},
			}},
		}},
	}
	configText := `
[mcp_servers.com-example-enabled-catalog-openai]
command = "old-catalog"
token = "plain-token-should-not-survive"
api_token = "api-token-should-not-survive"
headers = { Authorization = "Bearer header-token-should-not-survive" }
cookie = "session-cookie-should-not-survive"
Authorization = "Bearer authorization-token-should-not-survive"
bearer_token_env_var = "OPENAI_MCP_TOKEN"
`

	preview := PreviewCodexConfigDryRun(snapshot, CodexConfigDryRunOptions{
		ConfigText: configText,
		Now:        fixedNow,
	})
	if preview.Summary.OperationCount != 1 {
		t.Fatalf("operation count = %d, want 1: %#v", preview.Summary.OperationCount, preview.Operations)
	}
	plan := preview.Operations[0].PatchPlan
	joined := plan.BeforeSnippet + "\n" + plan.AfterSnippet + "\n" + strings.Join(preview.Sections[1].DiffPreview, "\n")
	for _, leaked := range []string{
		"plain-token-should-not-survive",
		"api-token-should-not-survive",
		"header-token-should-not-survive",
		"session-cookie-should-not-survive",
		"authorization-token-should-not-survive",
	} {
		if strings.Contains(joined, leaked) {
			t.Fatalf("sensitive TOML value %q leaked in patch preview: %s", leaked, joined)
		}
	}
	for _, key := range []string{"token", "api_token", "headers", "cookie", "Authorization"} {
		if !strings.Contains(joined, key+` = "<redacted>"`) {
			t.Fatalf("expected %s to be redacted in patch preview: %s", key, joined)
		}
	}
	if !strings.Contains(joined, `bearer_token_env_var = "OPENAI_MCP_TOKEN"`) {
		t.Fatalf("bearer_token_env_var should remain visible as an env-var reference: %s", joined)
	}
	if !strings.Contains(strings.Join(plan.Validation, "\n"), "sensitive-fields-redacted") {
		t.Fatalf("patch plan should advertise sensitive-field redaction: %#v", plan.Validation)
	}
}

func TestApplyCodexConfigDryRunPreviewToTempFilePreservesBoundaries(t *testing.T) {
	snapshot := RegistrySnapshot{
		ContractVersion: ContractVersionV0,
		Extensions: []ExtensionSnapshot{
			{
				ID:    "com.example.existing",
				State: StateEnabled,
				Capabilities: []CapabilitySnapshot{
					{
						ID:                    "provider-openai",
						Kind:                  "provider-metadata",
						State:                 StateEnabled,
						DeclaredContributions: []string{"provider:openai"},
					},
					{
						ID:                    "catalog-openai",
						Kind:                  "model-catalog-source",
						State:                 StateEnabled,
						DeclaredContributions: []string{"provider:openai/model:gpt-4.1"},
					},
				},
			},
			{
				ID:    "com.example.missing",
				State: StateEnabled,
				Capabilities: []CapabilitySnapshot{
					{
						ID:                    "provider-anthropic",
						Kind:                  "provider-metadata",
						State:                 StateEnabled,
						DeclaredContributions: []string{"provider:anthropic"},
					},
					{
						ID:                    "catalog-anthropic",
						Kind:                  "model-catalog-source",
						State:                 StateEnabled,
						DeclaredContributions: []string{"provider:anthropic/model:claude-sonnet"},
					},
				},
			},
			{
				ID:    "com.example.generated",
				State: StateEnabled,
				Capabilities: []CapabilitySnapshot{{
					ID:                    "catalog-generated",
					Kind:                  "model-catalog-source",
					State:                 StateEnabled,
					DeclaredContributions: []string{"provider:generated/model:test"},
				}},
			},
		},
	}
	configText := `# top-level comment must remain
model = "gpt-5"

[[skills.config]]
# source_extension = "com.example.existing"
# source_capability = "provider-openai"
path = "/caller-supplied/existing-skill"
enabled = false

[mcp_servers.com-example-existing-catalog-openai]
# local operator comment must remain
command = "caller-supplied-existing-catalog"
unknown_field = "preserve-me"
bearer_token = "literal-token-should-not-survive"
bearer_token_env_var = "OPENAI_CATALOG_TOKEN"

[mcp_servers.com-example-existing-catalog-openai.tools.list_models]
approval = "never"

[mcp_servers.com-example-existing-catalog-openai.oauth]
client_id = "keep-oauth-sibling"

[mcp_servers.com-example-generated-catalog-generated]
# source_extension = "com.example.generated"
# source_capability = "catalog-generated"
command = "generated-existing-catalog"

[mcp_servers.other]
url = "https://example.invalid/mcp"
`
	targetPath := filepath.Join(t.TempDir(), "real", "config.toml")
	if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
		t.Fatalf("mkdir target config dir: %v", err)
	}
	targetConfig := `[[skills.config]]
path = "/real-target/should-not-be-read"

[mcp_servers.com-example-missing-catalog-anthropic]
command = "real-target-should-not-be-read"
`
	writeFile(t, targetPath, targetConfig)

	preview := PreviewCodexConfigDryRun(snapshot, CodexConfigDryRunOptions{
		TargetPath: targetPath,
		ConfigText: configText,
		Now:        fixedNow,
	})
	result, err := ApplyCodexConfigDryRunPreviewToTempFile(preview, CodexConfigTempApplyOptions{
		TempDir:    t.TempDir(),
		ConfigText: configText,
	})
	if err != nil {
		t.Fatalf("apply preview to temp file: %v", err)
	}
	if result.TempPath == "" {
		t.Fatalf("temp apply result should include temp path: %#v", result)
	}
	if !strings.Contains(result.TempPath, string(os.PathSeparator)+"config-preview-") {
		t.Fatalf("temp apply must write to generated temp config path, got %q", result.TempPath)
	}
	if result.TargetPath != targetPath {
		t.Fatalf("result should echo targetPath for preview context only: %#v", result)
	}
	if result.AppliedText == "" {
		t.Fatalf("result should include applied TOML text")
	}
	tempBody, err := os.ReadFile(result.TempPath)
	if err != nil {
		t.Fatalf("read temp config: %v", err)
	}
	if string(tempBody) != result.AppliedText {
		t.Fatalf("temp file body should match applied text")
	}
	targetBody, err := os.ReadFile(targetPath)
	if err != nil {
		t.Fatalf("read target config after temp apply: %v", err)
	}
	if string(targetBody) != targetConfig {
		t.Fatalf("temp apply must not read or write targetPath config; got %q", string(targetBody))
	}

	applied := result.AppliedText
	for _, want := range []string{
		"# top-level comment must remain",
		`path = "/caller-supplied/existing-skill"`,
		"# local operator comment must remain",
		`unknown_field = "preserve-me"`,
		`bearer_token = "<redacted>"`,
		`bearer_token_env_var = "OPENAI_CATALOG_TOKEN"`,
		"[mcp_servers.com-example-existing-catalog-openai.tools.list_models]",
		"[mcp_servers.com-example-existing-catalog-openai.oauth]",
		`client_id = "keep-oauth-sibling"`,
		`[mcp_servers.other]`,
		`[mcp_servers.com-example-missing-catalog-anthropic]`,
		`[mcp_servers.com-example-generated-catalog-generated]`,
		`[[skills.config]]`,
		`# source_extension = "com.example.missing"`,
		`# source_capability = "provider-anthropic"`,
	} {
		if !strings.Contains(applied, want) {
			t.Fatalf("applied TOML missing %q:\n%s", want, applied)
		}
	}
	if strings.Count("\n"+applied, "\n[[skills.config]]") != 2 {
		t.Fatalf("apply should keep existing generated skills noop and append only missing skills block:\n%s", applied)
	}
	if strings.Count(applied, "[mcp_servers.com-example-generated-catalog-generated]") != 1 {
		t.Fatalf("noop MCP generated parent should not be duplicated:\n%s", applied)
	}
	if strings.Contains(applied, "literal-token-should-not-survive") {
		t.Fatalf("temp apply output must redact bearer_token literals:\n%s", applied)
	}
	if strings.Contains(applied, "real-target-should-not-be-read") || strings.Contains(applied, "/real-target/should-not-be-read") {
		t.Fatalf("temp apply must not consume targetPath content:\n%s", applied)
	}
	if !containsString(result.AppliedOperations, "add-array-table-preview") ||
		!containsString(result.AppliedOperations, "update-parent-table-preview") ||
		!containsString(result.AppliedOperations, "add-parent-table-preview") ||
		!containsString(result.AppliedOperations, "noop-existing-parent-table-preview") {
		t.Fatalf("result should record supported operation classes: %#v", result.AppliedOperations)
	}

	second, err := ApplyCodexConfigDryRunPreviewToTempFile(preview, CodexConfigTempApplyOptions{
		TempDir:    t.TempDir(),
		ConfigText: result.AppliedText,
	})
	if err != nil {
		t.Fatalf("apply preview second pass: %v", err)
	}
	if second.AppliedText != result.AppliedText {
		t.Fatalf("second temp apply should be text-stable:\n--- first ---\n%s\n--- second ---\n%s", result.AppliedText, second.AppliedText)
	}
	if !containsString(second.AppliedOperations, "noop-existing-array-table-preview") ||
		!containsString(second.AppliedOperations, "noop-existing-parent-table-preview") {
		t.Fatalf("second pass should degrade stale add/update operations into noop classes: %#v", second.AppliedOperations)
	}
	if containsString(second.AppliedOperations, "add-array-table-preview") ||
		containsString(second.AppliedOperations, "add-parent-table-preview") ||
		containsString(second.AppliedOperations, "update-parent-table-preview") {
		t.Fatalf("second pass must not re-append or re-update generated sections: %#v", second.AppliedOperations)
	}
}

func TestApplyCodexConfigStagedTransactionCommitsAfterConfirmationAndVerify(t *testing.T) {
	preview := PreviewCodexConfigDryRun(stagedApplySnapshot(), CodexConfigDryRunOptions{
		TargetPath: filepath.Join(t.TempDir(), "config.toml"),
		ConfigText: stagedApplyConfigText(),
		Now:        fixedNow,
	})
	targetPath := preview.TargetPath
	writeFile(t, targetPath, stagedApplyConfigText())
	plan, err := PrepareCodexConfigStagedApply(preview, CodexConfigTempApplyOptions{ConfigText: stagedApplyConfigText()})
	if err != nil {
		t.Fatalf("prepare staged apply: %v", err)
	}
	if plan.ConfirmationToken == "" || len(plan.DiffPreview) == 0 {
		t.Fatalf("plan should include confirmation token and diff preview: %#v", plan)
	}

	var verified CodexConfigStagedApplyVerifyInput
	result, err := ApplyCodexConfigStagedTransaction(preview, CodexConfigStagedApplyOptions{
		TempDir:           t.TempDir(),
		ConfigText:        stagedApplyConfigText(),
		ConfirmationToken: plan.ConfirmationToken,
		Verify: func(input CodexConfigStagedApplyVerifyInput) error {
			verified = input
			body, err := os.ReadFile(input.TargetPath)
			if err != nil {
				return err
			}
			if string(body) != input.AppliedText {
				return fmt.Errorf("target body does not match applied text")
			}
			return nil
		},
	})
	if err != nil {
		t.Fatalf("apply staged transaction: %v", err)
	}
	if result.Status != "applied" || result.RolledBack || result.BackupPath == "" || result.TempPath == "" {
		t.Fatalf("result mismatch: %#v", result)
	}
	if verified.TargetPath != targetPath || verified.TempPath == "" || verified.BackupPath == "" {
		t.Fatalf("verify input mismatch: %#v", verified)
	}
	backupBody, err := os.ReadFile(result.BackupPath)
	if err != nil {
		t.Fatalf("read backup: %v", err)
	}
	if string(backupBody) != stagedApplyConfigText() {
		t.Fatalf("backup should preserve original config text:\n%s", backupBody)
	}
	targetBody, err := os.ReadFile(targetPath)
	if err != nil {
		t.Fatalf("read target: %v", err)
	}
	if string(targetBody) != plan.AppliedText {
		t.Fatalf("target should contain applied text")
	}
	for _, want := range []string{
		"# operator comment must remain",
		`unknown_field = "preserve-me"`,
		`bearer_token = "<redacted>"`,
		`[mcp_servers.com-example-enabled-catalog-openai.tools.list_models]`,
		`[mcp_servers.com-example-enabled-catalog-openai.oauth]`,
		`[[skills.config]]`,
	} {
		if !strings.Contains(string(targetBody), want) {
			t.Fatalf("target missing preserved boundary %q:\n%s", want, targetBody)
		}
	}
	if strings.Contains(string(targetBody), "literal-token-should-not-survive") {
		t.Fatalf("target must be redacted:\n%s", targetBody)
	}
}

func TestApplyCodexConfigStagedTransactionRollsBackWhenVerifyFails(t *testing.T) {
	configText := stagedApplyConfigText()
	preview := PreviewCodexConfigDryRun(stagedApplySnapshot(), CodexConfigDryRunOptions{
		TargetPath: filepath.Join(t.TempDir(), "config.toml"),
		ConfigText: configText,
		Now:        fixedNow,
	})
	writeFile(t, preview.TargetPath, configText)
	plan, err := PrepareCodexConfigStagedApply(preview, CodexConfigTempApplyOptions{ConfigText: configText})
	if err != nil {
		t.Fatalf("prepare staged apply: %v", err)
	}

	result, err := ApplyCodexConfigStagedTransaction(preview, CodexConfigStagedApplyOptions{
		TempDir:           t.TempDir(),
		ConfigText:        configText,
		ConfirmationToken: plan.ConfirmationToken,
		Verify: func(CodexConfigStagedApplyVerifyInput) error {
			return fmt.Errorf("forced verify failure")
		},
	})
	if err == nil {
		t.Fatalf("verify failure should fail transaction")
	}
	if result.Status != "failed" || result.ErrorStage != "verify" || !result.RolledBack {
		t.Fatalf("verify failure should rollback: %#v", result)
	}
	assertFileContent(t, preview.TargetPath, configText)
	assertFileContent(t, result.BackupPath, configText)
}

func TestApplyCodexConfigStagedTransactionRollsBackWhenTargetWriteFails(t *testing.T) {
	configText := stagedApplyConfigText()
	preview := PreviewCodexConfigDryRun(stagedApplySnapshot(), CodexConfigDryRunOptions{
		TargetPath: filepath.Join(t.TempDir(), "config.toml"),
		ConfigText: configText,
		Now:        fixedNow,
	})
	writeFile(t, preview.TargetPath, configText)
	plan, err := PrepareCodexConfigStagedApply(preview, CodexConfigTempApplyOptions{ConfigText: configText})
	if err != nil {
		t.Fatalf("prepare staged apply: %v", err)
	}
	writeCalls := 0
	result, err := ApplyCodexConfigStagedTransaction(preview, CodexConfigStagedApplyOptions{
		TempDir:           t.TempDir(),
		ConfigText:        configText,
		ConfirmationToken: plan.ConfirmationToken,
		WriteFile: func(path string, data []byte, mode os.FileMode) error {
			writeCalls++
			if writeCalls == 1 {
				if err := os.WriteFile(path, []byte("partial broken write"), mode); err != nil {
					return err
				}
				return fmt.Errorf("forced target write failure")
			}
			return os.WriteFile(path, data, mode)
		},
	})
	if err == nil {
		t.Fatalf("target write failure should fail transaction")
	}
	if result.ErrorStage != "target-write" || !result.RolledBack {
		t.Fatalf("target write failure should rollback: %#v", result)
	}
	assertFileContent(t, preview.TargetPath, configText)
	assertFileContent(t, result.BackupPath, configText)
}

func TestApplyCodexConfigStagedTransactionRejectsInvalidOperationBeforeBackup(t *testing.T) {
	configText := stagedApplyConfigText()
	targetPath := filepath.Join(t.TempDir(), "config.toml")
	writeFile(t, targetPath, configText)
	preview := CodexConfigDryRunPreview{
		ContractVersion: ContractVersionV0,
		DryRun:          true,
		Target:          CodexConfigDryRunTarget,
		TargetPath:      targetPath,
		Operations: []CodexConfigDryRunOperation{{
			ID:     "bad",
			Target: "auth.json",
			Action: "preview",
		}},
	}
	result, err := ApplyCodexConfigStagedTransaction(preview, CodexConfigStagedApplyOptions{
		TempDir:           t.TempDir(),
		ConfigText:        configText,
		ConfirmationToken: "bad-token",
	})
	if err == nil {
		t.Fatalf("invalid operation should fail transaction")
	}
	if result.ErrorStage != "validate" || result.BackupPath != "" || result.RolledBack {
		t.Fatalf("invalid operation should fail before backup/write: %#v", result)
	}
	assertFileContent(t, targetPath, configText)
}

func TestApplyCodexConfigStagedTransactionRequiresMatchingConfirmationToken(t *testing.T) {
	configText := stagedApplyConfigText()
	preview := PreviewCodexConfigDryRun(stagedApplySnapshot(), CodexConfigDryRunOptions{
		TargetPath: filepath.Join(t.TempDir(), "config.toml"),
		ConfigText: configText,
		Now:        fixedNow,
	})
	writeFile(t, preview.TargetPath, configText)
	result, err := ApplyCodexConfigStagedTransaction(preview, CodexConfigStagedApplyOptions{
		TempDir:           t.TempDir(),
		ConfigText:        configText,
		ConfirmationToken: "wrong",
	})
	if err == nil {
		t.Fatalf("wrong confirmation token should fail transaction")
	}
	if result.ErrorStage != "confirm" || result.RolledBack || result.BackupPath != "" {
		t.Fatalf("confirmation failure should happen before backup/write: %#v", result)
	}
	assertFileContent(t, preview.TargetPath, configText)
}

func TestPreviewCodexConfigDryRunReportsNoEnabledExtensions(t *testing.T) {
	preview := PreviewCodexConfigDryRun(RegistrySnapshot{
		ContractVersion: ContractVersionV0,
		Extensions: []ExtensionSnapshot{{
			ID:    "com.example.disabled",
			State: StateDisabled,
		}},
	}, CodexConfigDryRunOptions{Now: fixedNow})

	if preview.Summary.EnabledExtensionCount != 0 || preview.Summary.ValidationErrorCount != 1 {
		t.Fatalf("summary mismatch: %#v", preview.Summary)
	}
	if len(preview.Validation) != 1 || preview.Validation[0].Code != DiagnosticCodexConfigNoEnabled {
		t.Fatalf("validation mismatch: %#v", preview.Validation)
	}
}

func stagedApplySnapshot() RegistrySnapshot {
	return RegistrySnapshot{
		ContractVersion: ContractVersionV0,
		Extensions: []ExtensionSnapshot{{
			ID:    "com.example.enabled",
			State: StateEnabled,
			Capabilities: []CapabilitySnapshot{
				{
					ID:                    "provider-openai",
					Kind:                  "provider-metadata",
					State:                 StateEnabled,
					DeclaredContributions: []string{"provider:openai"},
				},
				{
					ID:                    "catalog-openai",
					Kind:                  "model-catalog-source",
					State:                 StateEnabled,
					DeclaredContributions: []string{"provider:openai/model:gpt-4.1"},
				},
			},
		}},
	}
}

func stagedApplyConfigText() string {
	return `# operator comment must remain
model = "gpt-5"

[mcp_servers.com-example-enabled-catalog-openai]
command = "existing-catalog"
unknown_field = "preserve-me"
bearer_token = "literal-token-should-not-survive"
bearer_token_env_var = "OPENAI_CATALOG_TOKEN"

[mcp_servers.com-example-enabled-catalog-openai.tools.list_models]
approval = "never"

[mcp_servers.com-example-enabled-catalog-openai.oauth]
client_id = "keep-oauth-sibling"
`
}

func assertFileContent(t *testing.T, path string, want string) {
	t.Helper()
	body, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	if string(body) != want {
		t.Fatalf("%s content mismatch:\n--- got ---\n%s\n--- want ---\n%s", path, body, want)
	}
}

func fixedNow() time.Time {
	return time.Date(2026, 6, 16, 8, 0, 0, 0, time.UTC)
}

func fixturePath(name string) string {
	return filepath.Join("..", "..", "docs-linhay", "spaces", "20260616-extension-contract-v0", "examples", name)
}

func containsString(items []string, want string) bool {
	for _, item := range items {
		if item == want {
			return true
		}
	}
	return false
}

func containsDiagnostic(diagnostics []Diagnostic, severity DiagnosticSeverity, code string) bool {
	for _, diagnostic := range diagnostics {
		if diagnostic.Severity == severity && (code == "" || diagnostic.Code == code) {
			return true
		}
	}
	return false
}

func containsDiagnosticPath(diagnostics []Diagnostic, severity DiagnosticSeverity, code string, path string) bool {
	for _, diagnostic := range diagnostics {
		if diagnostic.Severity == severity && diagnostic.Code == code && diagnostic.Path == path {
			return true
		}
	}
	return false
}

func assertSnapshotDoesNotLeakRawManifest(t *testing.T, snapshot RegistrySnapshot, needle string) {
	t.Helper()
	body, err := json.Marshal(snapshot)
	if err != nil {
		t.Fatalf("marshal snapshot: %v", err)
	}
	if strings.Contains(string(body), needle) {
		t.Fatalf("snapshot leaked raw manifest content containing %q: %s", needle, body)
	}
}

func writeFile(t *testing.T, path string, body string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatalf("write file: %v", err)
	}
}

func validManifestWithID(id string) string {
	return `{
  "contractVersion": "0.1.0",
  "id": "` + id + `",
  "name": "Example Metadata",
  "version": "0.1.0",
  "publisher": {"name": "Example Labs"},
  "source": {"type": "local", "uri": "file:///tmp/example", "revision": "local"},
  "compatibility": {"sidecarContract": "^0.1.0", "capabilityContract": "^0.1.0"},
  "permissions": ["provider.metadata.read"],
  "capabilities": [
    {
      "id": "example-provider-metadata",
      "kind": "provider-metadata",
      "provider": {"id": "example", "displayName": "Example", "family": "openai-compatible"}
    }
  ]
}`
}

func manifestWithCapabilities(id string, permissions []string, capabilities ...string) string {
	permissionBody, err := json.Marshal(permissions)
	if err != nil {
		panic(err)
	}
	return `{
  "contractVersion": "0.1.0",
  "id": "` + id + `",
  "name": "Example Metadata",
  "version": "0.1.0",
  "publisher": {"name": "Example Labs"},
  "source": {"type": "local", "uri": "file:///tmp/example", "revision": "local"},
  "compatibility": {"sidecarContract": "^0.1.0", "capabilityContract": "^0.1.0"},
  "permissions": ` + string(permissionBody) + `,
  "capabilities": [
    ` + strings.Join(capabilities, ",\n    ") + `
  ]
}`
}

func declaredEndpointManifest(endpoint string) string {
	return `{
  "contractVersion": "0.1.0",
  "id": "com.example.declared-endpoint",
  "name": "Declared Endpoint",
  "version": "0.1.0",
  "publisher": {"name": "Example Labs"},
  "source": {"type": "local", "uri": "file:///tmp/declared-endpoint", "revision": "local"},
  "compatibility": {"sidecarContract": "^0.1.0", "capabilityContract": "^0.1.0"},
  "permissions": ["model.catalog.read", "network.fetch.declared-endpoints"],
  "capabilities": [
    {
      "id": "declared-endpoint-catalog",
      "kind": "model-catalog-source",
      "providerId": "openai",
      "source": {"type": "declared-endpoint", "endpoint": "` + endpoint + `"}
    }
  ]
}`
}
