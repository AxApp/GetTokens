package wailsapp

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/linhay/gettokens/internal/gettokensextensions"
)

func TestGetTokensExtensionRegistrySnapshotMapsValidFixture(t *testing.T) {
	manifest := filepath.Join("..", "..", "docs-linhay", "spaces", "20260616-extension-contract-v0", "examples", "provider-metadata-model-catalog.valid.json")
	app := New("test", "", "")

	snapshot, err := app.GetGetTokensExtensionRegistrySnapshot(GetTokensExtensionRegistrySnapshotInput{
		ManifestPaths: []string{manifest},
	})
	if err != nil {
		t.Fatalf("GetGetTokensExtensionRegistrySnapshot returned error: %v", err)
	}
	if snapshot == nil {
		t.Fatal("snapshot is nil")
	}
	if snapshot.RegistryMode != gettokensextensions.RegistryModeReadOnly || !snapshot.ReadOnly {
		t.Fatalf("snapshot should be read-only: %#v", snapshot)
	}
	if len(snapshot.Extensions) != 1 {
		t.Fatalf("extensions len = %d, want 1", len(snapshot.Extensions))
	}
	extension := snapshot.Extensions[0]
	if extension.ID != "com.example.openai-metadata" || extension.State != gettokensextensions.StateReadonlyCompatible {
		t.Fatalf("extension mismatch: %#v", extension)
	}
	if len(extension.Capabilities) != 2 {
		t.Fatalf("capabilities len = %d, want 2", len(extension.Capabilities))
	}
}

func TestGetTokensExtensionRegistrySnapshotPropagatesInvalidDiagnostics(t *testing.T) {
	manifest := filepath.Join("..", "..", "docs-linhay", "spaces", "20260616-extension-contract-v0", "examples", "js-hook-unknown-capability.invalid.json")
	app := New("test", "", "")

	snapshot, err := app.GetGetTokensExtensionRegistrySnapshot(GetTokensExtensionRegistrySnapshotInput{
		ManifestPaths: []string{manifest},
	})
	if err != nil {
		t.Fatalf("GetGetTokensExtensionRegistrySnapshot returned error: %v", err)
	}
	if len(snapshot.Extensions) != 1 {
		t.Fatalf("extensions len = %d, want 1", len(snapshot.Extensions))
	}
	extension := snapshot.Extensions[0]
	if extension.State != gettokensextensions.StateInvalid {
		t.Fatalf("extension state = %q, want invalid", extension.State)
	}
	if !hasGetTokensExtensionDiagnostic(extension.Diagnostics, gettokensextensions.DiagnosticUnknownCapabilityKind) {
		t.Fatalf("missing unknown capability diagnostic: %#v", extension.Diagnostics)
	}
	if !hasGetTokensExtensionDiagnostic(extension.Diagnostics, gettokensextensions.DiagnosticForbiddenPermission) {
		t.Fatalf("missing forbidden permission diagnostic: %#v", extension.Diagnostics)
	}
}

func TestGetTokensExtensionRegistrySnapshotMissingRootReturnsEmptyReadOnlySnapshot(t *testing.T) {
	missingRoot := filepath.Join(t.TempDir(), "missing")
	app := New("test", "", "")

	snapshot, err := app.GetGetTokensExtensionRegistrySnapshot(GetTokensExtensionRegistrySnapshotInput{
		Roots: []GetTokensExtensionRootDTO{{ID: "fake", Path: missingRoot}},
	})
	if err != nil {
		t.Fatalf("GetGetTokensExtensionRegistrySnapshot returned error: %v", err)
	}
	if snapshot == nil || !snapshot.ReadOnly || snapshot.RegistryMode != gettokensextensions.RegistryModeReadOnly {
		t.Fatalf("snapshot should be read-only: %#v", snapshot)
	}
	if len(snapshot.Extensions) != 0 {
		t.Fatalf("extensions len = %d, want 0", len(snapshot.Extensions))
	}
	if !hasGetTokensExtensionDiagnostic(snapshot.Diagnostics, gettokensextensions.DiagnosticRootNotFound) {
		t.Fatalf("missing root-not-found diagnostic: %#v", snapshot.Diagnostics)
	}
}

func TestGetTokensExtensionRegistrySnapshotUsesAppOwnedRootWithoutCodexConfig(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("GETTOKENS_APP_PROFILE", "dev")
	codexConfigPath := filepath.Join(home, ".codex", "config.toml")
	if err := os.MkdirAll(filepath.Dir(codexConfigPath), 0o755); err != nil {
		t.Fatalf("mkdir codex config dir: %v", err)
	}
	if err := os.WriteFile(codexConfigPath, []byte(`this is not toml and must not be read`), 0o600); err != nil {
		t.Fatalf("write codex config: %v", err)
	}

	root := filepath.Join(home, ".config", "gettokens-dev", "extensions", "openai")
	manifest := filepath.Join(root, gettokensextensions.ManifestFileName)
	if err := os.MkdirAll(root, 0o755); err != nil {
		t.Fatalf("mkdir extension root: %v", err)
	}
	body, err := os.ReadFile(filepath.Join("..", "..", "docs-linhay", "spaces", "20260616-extension-contract-v0", "examples", "provider-metadata-model-catalog.valid.json"))
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	if err := os.WriteFile(manifest, body, 0o600); err != nil {
		t.Fatalf("write manifest: %v", err)
	}

	app := New("test", "", "")
	snapshot, err := app.GetGetTokensExtensionRegistrySnapshot(GetTokensExtensionRegistrySnapshotInput{})
	if err != nil {
		t.Fatalf("GetGetTokensExtensionRegistrySnapshot returned error: %v", err)
	}
	if len(snapshot.Roots) != 1 {
		t.Fatalf("roots len = %d, want 1", len(snapshot.Roots))
	}
	if snapshot.Roots[0].Path != filepath.Join(home, ".config", "gettokens-dev", "extensions") {
		t.Fatalf("default root path = %q", snapshot.Roots[0].Path)
	}
	if len(snapshot.Extensions) != 1 || snapshot.Extensions[0].ID != "com.example.openai-metadata" {
		t.Fatalf("extensions mismatch: %#v", snapshot.Extensions)
	}
}

func TestSetGetTokensExtensionEnabledPersistsAndSnapshotMergesState(t *testing.T) {
	dir := t.TempDir()
	statePath := filepath.Join(dir, "extension-enable-state.json")
	manifest := filepath.Join(dir, "openai", gettokensextensions.ManifestFileName)
	body, err := os.ReadFile(filepath.Join("..", "..", "docs-linhay", "spaces", "20260616-extension-contract-v0", "examples", "provider-metadata-model-catalog.valid.json"))
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	if err := os.MkdirAll(filepath.Dir(manifest), 0o755); err != nil {
		t.Fatalf("mkdir manifest dir: %v", err)
	}
	if err := os.WriteFile(manifest, body, 0o600); err != nil {
		t.Fatalf("write manifest: %v", err)
	}

	app := New("test", "", "")
	state, err := app.SetGetTokensExtensionEnabled(SetGetTokensExtensionEnabledInput{
		ExtensionID: "com.example.openai-metadata",
		Enabled:     false,
		StatePath:   statePath,
	})
	if err != nil {
		t.Fatalf("SetGetTokensExtensionEnabled returned error: %v", err)
	}
	if len(state.Extensions) != 1 || state.Extensions[0].State != gettokensextensions.StateDisabled {
		t.Fatalf("state mismatch: %#v", state)
	}

	snapshot, err := app.GetGetTokensExtensionRegistrySnapshot(GetTokensExtensionRegistrySnapshotInput{
		ManifestPaths: []string{manifest},
		StatePath:     statePath,
	})
	if err != nil {
		t.Fatalf("GetGetTokensExtensionRegistrySnapshot returned error: %v", err)
	}
	if len(snapshot.Extensions) != 1 || snapshot.Extensions[0].State != gettokensextensions.StateDisabled {
		t.Fatalf("snapshot state mismatch: %#v", snapshot.Extensions)
	}
	if snapshot.Extensions[0].Capabilities[0].State != gettokensextensions.StateDisabled {
		t.Fatalf("capability state mismatch: %#v", snapshot.Extensions[0].Capabilities)
	}
}

func TestGetTokensExtensionRegistrySnapshotUsesDefaultDevStatePath(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("GETTOKENS_APP_PROFILE", "dev")

	root := filepath.Join(home, ".config", "gettokens-dev", "extensions", "openai")
	manifest := filepath.Join(root, gettokensextensions.ManifestFileName)
	body, err := os.ReadFile(filepath.Join("..", "..", "docs-linhay", "spaces", "20260616-extension-contract-v0", "examples", "provider-metadata-model-catalog.valid.json"))
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	if err := os.MkdirAll(root, 0o755); err != nil {
		t.Fatalf("mkdir extension root: %v", err)
	}
	if err := os.WriteFile(manifest, body, 0o600); err != nil {
		t.Fatalf("write manifest: %v", err)
	}

	app := New("test", "", "")
	if _, err := app.SetGetTokensExtensionEnabled(SetGetTokensExtensionEnabledInput{
		ExtensionID: "com.example.openai-metadata",
		Enabled:     false,
	}); err != nil {
		t.Fatalf("SetGetTokensExtensionEnabled returned error: %v", err)
	}
	if _, err := os.Stat(filepath.Join(home, ".config", "gettokens-dev", "extension-enable-state.json")); err != nil {
		t.Fatalf("default dev state file missing: %v", err)
	}

	snapshot, err := app.GetGetTokensExtensionRegistrySnapshot(GetTokensExtensionRegistrySnapshotInput{})
	if err != nil {
		t.Fatalf("GetGetTokensExtensionRegistrySnapshot returned error: %v", err)
	}
	if len(snapshot.Extensions) != 1 || snapshot.Extensions[0].State != gettokensextensions.StateDisabled {
		t.Fatalf("default state path was not merged: %#v", snapshot.Extensions)
	}
}

func TestPreviewGetTokensExtensionCodexConfigDryRunDoesNotReadCodexConfig(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("GETTOKENS_APP_PROFILE", "dev")
	codexConfigPath := filepath.Join(home, ".codex", "config.toml")
	targetConfig := `not valid toml and must not be parsed`
	if err := os.MkdirAll(filepath.Dir(codexConfigPath), 0o755); err != nil {
		t.Fatalf("mkdir codex config dir: %v", err)
	}
	if err := os.WriteFile(codexConfigPath, []byte(targetConfig), 0o600); err != nil {
		t.Fatalf("write codex config: %v", err)
	}

	root := filepath.Join(home, ".config", "gettokens-dev", "extensions", "openai")
	manifest := filepath.Join(root, gettokensextensions.ManifestFileName)
	body, err := os.ReadFile(filepath.Join("..", "..", "docs-linhay", "spaces", "20260616-extension-contract-v0", "examples", "provider-metadata-model-catalog.valid.json"))
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	if err := os.MkdirAll(root, 0o755); err != nil {
		t.Fatalf("mkdir extension root: %v", err)
	}
	if err := os.WriteFile(manifest, body, 0o600); err != nil {
		t.Fatalf("write manifest: %v", err)
	}

	app := New("test", "", "")
	if _, err := app.SetGetTokensExtensionEnabled(SetGetTokensExtensionEnabledInput{
		ExtensionID: "com.example.openai-metadata",
		Enabled:     true,
	}); err != nil {
		t.Fatalf("SetGetTokensExtensionEnabled returned error: %v", err)
	}

	preview, err := app.PreviewGetTokensExtensionCodexConfigDryRun(PreviewGetTokensExtensionCodexConfigDryRunInput{
		TargetPath: codexConfigPath,
		ConfigText: `
[[skills.config]]
path = "/tmp/existing-skill"

[mcp_servers.com-example-openai-metadata-openai-model-catalog]
command = "existing-catalog"
bearer_token = "literal-token-do-not-keep"

[mcp_servers.com-example-openai-metadata-openai-model-catalog.tools.list_models]
approval = "never"
`,
	})
	if err != nil {
		t.Fatalf("PreviewGetTokensExtensionCodexConfigDryRun returned error: %v", err)
	}
	if preview == nil || !preview.DryRun || preview.Target != gettokensextensions.CodexConfigDryRunTarget {
		t.Fatalf("preview mismatch: %#v", preview)
	}
	if preview.TargetPath != codexConfigPath {
		t.Fatalf("target path = %q, want %q", preview.TargetPath, codexConfigPath)
	}
	if preview.Summary.EnabledExtensionCount != 1 {
		t.Fatalf("enabled count = %d, want 1", preview.Summary.EnabledExtensionCount)
	}
	if preview.Summary.OperationCount != 2 || len(preview.Operations) != 2 {
		t.Fatalf("dry-run should project candidate operations: %#v", preview.Operations)
	}
	if preview.Summary.ValidationErrorCount != 0 {
		t.Fatalf("candidate projections should not be validation errors: %#v", preview)
	}
	if preview.Operations[0].Action != "preview" || preview.Operations[0].CapabilityID == "" {
		t.Fatalf("operation should be preview-only and capability-scoped: %#v", preview.Operations[0])
	}
	if preview.Operations[0].PatchPlan.TargetSection == "" || preview.Operations[0].PatchPlan.Operation == "" || preview.Operations[0].PatchPlan.BeforeSnippet == "" || preview.Operations[0].PatchPlan.AfterSnippet == "" {
		t.Fatalf("operation should carry typed patch plan: %#v", preview.Operations[0].PatchPlan)
	}
	if len(preview.Operations[0].PatchPlan.Validation) == 0 {
		t.Fatalf("operation patch plan should carry validation markers: %#v", preview.Operations[0].PatchPlan)
	}
	joined := preview.Operations[0].PatchPlan.BeforeSnippet + "\n" + preview.Operations[0].PatchPlan.AfterSnippet + "\n" +
		preview.Operations[1].PatchPlan.BeforeSnippet + "\n" + preview.Operations[1].PatchPlan.AfterSnippet
	if strings.Contains(joined, "literal-token-do-not-keep") {
		t.Fatalf("dry-run patch plan must not retain token literals: %s", joined)
	}
	if strings.Contains(joined, "not valid toml and must not be parsed") {
		t.Fatalf("dry-run handler must not read targetPath config content: %s", joined)
	}
	if !strings.Contains(joined, "/tmp/existing-skill") || !strings.Contains(joined, `command = "existing-catalog"`) {
		t.Fatalf("dry-run handler should pass caller-supplied configText through to core planner: %s", joined)
	}
	if !strings.Contains(joined, "input-toml-read-only") && !strings.Contains(strings.Join(preview.Operations[0].PatchPlan.Validation, "\n")+strings.Join(preview.Operations[1].PatchPlan.Validation, "\n"), "input-toml-read-only") {
		t.Fatalf("patch plan should mark configText as read-only input: %#v", preview.Operations)
	}
	bodyAfter, err := os.ReadFile(codexConfigPath)
	if err != nil {
		t.Fatalf("read codex config after dry-run: %v", err)
	}
	if string(bodyAfter) != targetConfig {
		t.Fatalf("dry-run handler must not write targetPath config; got %q", string(bodyAfter))
	}
}

func TestPrepareAndApplyGetTokensExtensionCodexConfigTransactionUsesExplicitTarget(t *testing.T) {
	dir := t.TempDir()
	manifest := filepath.Join(dir, "openai", gettokensextensions.ManifestFileName)
	body, err := os.ReadFile(filepath.Join("..", "..", "docs-linhay", "spaces", "20260616-extension-contract-v0", "examples", "provider-metadata-model-catalog.valid.json"))
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	if err := os.MkdirAll(filepath.Dir(manifest), 0o755); err != nil {
		t.Fatalf("mkdir manifest dir: %v", err)
	}
	if err := os.WriteFile(manifest, body, 0o600); err != nil {
		t.Fatalf("write manifest: %v", err)
	}

	configText := `# caller supplied text only
model = "gpt-5"

[mcp_servers.com-example-openai-metadata-catalog-openai]
command = "existing-catalog"
bearer_token = "literal-token-do-not-keep"

[mcp_servers.com-example-openai-metadata-catalog-openai.tools.list_models]
approval = "never"
`
	targetPath := filepath.Join(t.TempDir(), "config.toml")
	if err := os.WriteFile(targetPath, []byte(configText), 0o600); err != nil {
		t.Fatalf("write target: %v", err)
	}
	app := New("test", "", "")
	prepare, err := app.PrepareGetTokensExtensionCodexConfigApply(PrepareGetTokensExtensionCodexConfigApplyInput{
		ManifestPaths: []string{manifest},
		TargetPath:    targetPath,
		ConfigText:    configText,
	})
	if err != nil {
		t.Fatalf("PrepareGetTokensExtensionCodexConfigApply returned error: %v", err)
	}
	if prepare.ConfirmationToken == "" || len(prepare.DiffPreview) == 0 || prepare.AppliedText == "" {
		t.Fatalf("prepare result mismatch: %#v", prepare)
	}
	if strings.Contains(prepare.AppliedText, "literal-token-do-not-keep") {
		t.Fatalf("prepare applied text should be redacted: %s", prepare.AppliedText)
	}

	result, err := app.ApplyGetTokensExtensionCodexConfigTransaction(ApplyGetTokensExtensionCodexConfigTransactionInput{
		ManifestPaths:     []string{manifest},
		TargetPath:        targetPath,
		TempDir:           t.TempDir(),
		ConfigText:        configText,
		ConfirmationToken: prepare.ConfirmationToken,
	})
	if err != nil {
		t.Fatalf("ApplyGetTokensExtensionCodexConfigTransaction returned error: %v", err)
	}
	if result.Status != "applied" || result.BackupPath == "" || result.TempPath == "" || result.RolledBack {
		t.Fatalf("apply result mismatch: %#v", result)
	}
	targetBody, err := os.ReadFile(targetPath)
	if err != nil {
		t.Fatalf("read target: %v", err)
	}
	if string(targetBody) != prepare.AppliedText {
		t.Fatalf("target body should match prepared staged text")
	}
	backupBody, err := os.ReadFile(result.BackupPath)
	if err != nil {
		t.Fatalf("read backup: %v", err)
	}
	if string(backupBody) != configText {
		t.Fatalf("backup should preserve original caller-supplied text")
	}
}

func TestApplyGetTokensExtensionCodexConfigTransactionRejectsRealCodexConfig(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	targetPath := filepath.Join(home, ".codex", "config.toml")
	app := New("test", "", "")

	if _, err := app.PrepareGetTokensExtensionCodexConfigApply(PrepareGetTokensExtensionCodexConfigApplyInput{
		TargetPath: targetPath,
		ConfigText: "model = \"gpt-5\"\n",
	}); err == nil {
		t.Fatalf("prepare should reject real ~/.codex/config.toml target")
	}
	if _, err := app.ApplyGetTokensExtensionCodexConfigTransaction(ApplyGetTokensExtensionCodexConfigTransactionInput{
		TargetPath:        targetPath,
		TempDir:           t.TempDir(),
		ConfigText:        "model = \"gpt-5\"\n",
		ConfirmationToken: "token",
	}); err == nil {
		t.Fatalf("apply should reject real ~/.codex/config.toml target")
	}
	if _, err := os.Stat(targetPath); !os.IsNotExist(err) {
		t.Fatalf("real codex config target should not be created, stat err=%v", err)
	}
}

func hasGetTokensExtensionDiagnostic(diagnostics []gettokensextensions.Diagnostic, code string) bool {
	for _, diagnostic := range diagnostics {
		if diagnostic.Code == code {
			return true
		}
	}
	return false
}
