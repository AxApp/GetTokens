package gettokensextensions

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type CodexConfigTempApplyOptions struct {
	TempDir    string
	ConfigText string
}

type CodexConfigTempApplyResult struct {
	TargetPath        string   `json:"targetPath,omitempty"`
	TempPath          string   `json:"tempPath"`
	AppliedText       string   `json:"appliedText"`
	AppliedOperations []string `json:"appliedOperations"`
}

type CodexConfigStagedApplyPlan struct {
	ContractVersion   string   `json:"contractVersion"`
	TargetPath        string   `json:"targetPath"`
	ConfirmationToken string   `json:"confirmationToken"`
	DiffPreview       []string `json:"diffPreview"`
	AppliedText       string   `json:"appliedText"`
	AppliedOperations []string `json:"appliedOperations"`
}

type CodexConfigStagedApplyOptions struct {
	TargetPath         string
	TempDir            string
	ConfigText         string
	ConfirmationToken  string
	Verify             func(CodexConfigStagedApplyVerifyInput) error
	WriteFile          func(string, []byte, os.FileMode) error
	CreateTempFileName func(string, string) (*os.File, error)
}

type CodexConfigStagedApplyVerifyInput struct {
	TargetPath  string
	TempPath    string
	BackupPath  string
	AppliedText string
}

type CodexConfigStagedApplyResult struct {
	Status            string   `json:"status"`
	TargetPath        string   `json:"targetPath"`
	BackupPath        string   `json:"backupPath,omitempty"`
	TempPath          string   `json:"tempPath,omitempty"`
	ConfirmationToken string   `json:"confirmationToken"`
	AppliedOperations []string `json:"appliedOperations"`
	RolledBack        bool     `json:"rolledBack"`
	ErrorStage        string   `json:"errorStage,omitempty"`
}

type codexConfigPreviewApplyResult struct {
	text      string
	operation string
}

type codexConfigAppliedTextResult struct {
	text       string
	operations []string
}

func ApplyCodexConfigDryRunPreviewToTempFile(preview CodexConfigDryRunPreview, options CodexConfigTempApplyOptions) (CodexConfigTempApplyResult, error) {
	tempDir := strings.TrimSpace(options.TempDir)
	if tempDir == "" {
		return CodexConfigTempApplyResult{}, fmt.Errorf("temp dir is required for Codex config preview apply")
	}
	if err := os.MkdirAll(tempDir, 0o755); err != nil {
		return CodexConfigTempApplyResult{}, fmt.Errorf("prepare temp dir: %w", err)
	}

	applied, err := buildCodexConfigAppliedText(preview, options.ConfigText, false)
	if err != nil {
		return CodexConfigTempApplyResult{}, err
	}

	file, err := os.CreateTemp(tempDir, "config-preview-*.toml")
	if err != nil {
		return CodexConfigTempApplyResult{}, fmt.Errorf("create temp config: %w", err)
	}
	tempPath := file.Name()
	if _, err := file.WriteString(applied.text); err != nil {
		_ = file.Close()
		return CodexConfigTempApplyResult{}, fmt.Errorf("write temp config: %w", err)
	}
	if err := file.Close(); err != nil {
		return CodexConfigTempApplyResult{}, fmt.Errorf("close temp config: %w", err)
	}
	return CodexConfigTempApplyResult{
		TargetPath:        preview.TargetPath,
		TempPath:          filepath.Clean(tempPath),
		AppliedText:       applied.text,
		AppliedOperations: applied.operations,
	}, nil
}

func PrepareCodexConfigStagedApply(preview CodexConfigDryRunPreview, options CodexConfigTempApplyOptions) (CodexConfigStagedApplyPlan, error) {
	targetPath := strings.TrimSpace(preview.TargetPath)
	if targetPath == "" {
		targetPath = strings.TrimSpace(options.TempDir)
	}
	if strings.TrimSpace(preview.TargetPath) == "" {
		return CodexConfigStagedApplyPlan{}, fmt.Errorf("target path is required for staged Codex config apply")
	}
	applied, err := buildCodexConfigAppliedText(preview, options.ConfigText, true)
	if err != nil {
		return CodexConfigStagedApplyPlan{}, err
	}
	token := codexConfigStagedConfirmationToken(preview, applied.text)
	return CodexConfigStagedApplyPlan{
		ContractVersion:   ContractVersionV0,
		TargetPath:        filepath.Clean(targetPath),
		ConfirmationToken: token,
		DiffPreview:       codexConfigStagedDiffPreview(preview, applied.text),
		AppliedText:       applied.text,
		AppliedOperations: applied.operations,
	}, nil
}

func ApplyCodexConfigStagedTransaction(preview CodexConfigDryRunPreview, options CodexConfigStagedApplyOptions) (CodexConfigStagedApplyResult, error) {
	targetPath := strings.TrimSpace(options.TargetPath)
	if targetPath == "" {
		targetPath = strings.TrimSpace(preview.TargetPath)
	}
	if targetPath == "" {
		return CodexConfigStagedApplyResult{Status: "failed", ErrorStage: "validate"}, fmt.Errorf("target path is required for staged Codex config apply")
	}
	if strings.Contains(filepath.Clean(targetPath), filepath.Join(".codex", "config.toml")) && strings.TrimSpace(options.TargetPath) == "" {
		return CodexConfigStagedApplyResult{Status: "failed", TargetPath: filepath.Clean(targetPath), ErrorStage: "validate"}, fmt.Errorf("explicit test target is required; refusing implicit Codex config path %q", targetPath)
	}
	if strings.TrimSpace(options.TempDir) == "" {
		return CodexConfigStagedApplyResult{Status: "failed", TargetPath: filepath.Clean(targetPath), ErrorStage: "validate"}, fmt.Errorf("temp dir is required for staged Codex config apply")
	}

	plan, err := PrepareCodexConfigStagedApply(preview, CodexConfigTempApplyOptions{ConfigText: options.ConfigText})
	if err != nil {
		return CodexConfigStagedApplyResult{Status: "failed", TargetPath: filepath.Clean(targetPath), ErrorStage: "validate"}, err
	}
	if strings.TrimSpace(options.ConfirmationToken) == "" || options.ConfirmationToken != plan.ConfirmationToken {
		return CodexConfigStagedApplyResult{Status: "failed", TargetPath: filepath.Clean(targetPath), ConfirmationToken: plan.ConfirmationToken, ErrorStage: "confirm"}, fmt.Errorf("staged Codex config apply confirmation token mismatch")
	}

	if err := os.MkdirAll(options.TempDir, 0o755); err != nil {
		return CodexConfigStagedApplyResult{Status: "failed", TargetPath: filepath.Clean(targetPath), ConfirmationToken: plan.ConfirmationToken, ErrorStage: "backup"}, fmt.Errorf("prepare temp dir: %w", err)
	}
	backupPath := filepath.Join(options.TempDir, "config-backup.toml")
	tempPath := ""
	result := CodexConfigStagedApplyResult{
		Status:            "failed",
		TargetPath:        filepath.Clean(targetPath),
		BackupPath:        filepath.Clean(backupPath),
		ConfirmationToken: plan.ConfirmationToken,
		AppliedOperations: append([]string(nil), plan.AppliedOperations...),
	}

	original := []byte(options.ConfigText)
	if err := os.WriteFile(backupPath, original, 0o600); err != nil {
		result.ErrorStage = "backup"
		return result, fmt.Errorf("write Codex config backup: %w", err)
	}

	createTemp := options.CreateTempFileName
	if createTemp == nil {
		createTemp = os.CreateTemp
	}
	file, err := createTemp(options.TempDir, "config-staged-*.toml")
	if err != nil {
		result.ErrorStage = "temp-write"
		return result, fmt.Errorf("create staged Codex config temp file: %w", err)
	}
	tempPath = file.Name()
	result.TempPath = filepath.Clean(tempPath)
	if _, err := file.WriteString(plan.AppliedText); err != nil {
		_ = file.Close()
		result.ErrorStage = "temp-write"
		return result, fmt.Errorf("write staged Codex config temp file: %w", err)
	}
	if err := file.Close(); err != nil {
		result.ErrorStage = "temp-write"
		return result, fmt.Errorf("close staged Codex config temp file: %w", err)
	}

	writeFile := options.WriteFile
	if writeFile == nil {
		writeFile = os.WriteFile
	}
	if err := writeFile(targetPath, []byte(plan.AppliedText), 0o600); err != nil {
		result.ErrorStage = "target-write"
		_ = writeFile(targetPath, original, 0o600)
		result.RolledBack = true
		return result, fmt.Errorf("write staged Codex config target: %w", err)
	}
	if options.Verify != nil {
		if err := options.Verify(CodexConfigStagedApplyVerifyInput{
			TargetPath:  filepath.Clean(targetPath),
			TempPath:    filepath.Clean(tempPath),
			BackupPath:  filepath.Clean(backupPath),
			AppliedText: plan.AppliedText,
		}); err != nil {
			result.ErrorStage = "verify"
			if rollbackErr := writeFile(targetPath, original, 0o600); rollbackErr != nil {
				return result, fmt.Errorf("verify staged Codex config target: %w; rollback failed: %v", err, rollbackErr)
			}
			result.RolledBack = true
			return result, fmt.Errorf("verify staged Codex config target: %w", err)
		}
	}
	result.Status = "applied"
	return result, nil
}

func buildCodexConfigAppliedText(preview CodexConfigDryRunPreview, configText string, strict bool) (codexConfigAppliedTextResult, error) {
	if strict {
		if preview.Target != CodexConfigDryRunTarget {
			return codexConfigAppliedTextResult{}, fmt.Errorf("unsupported staged apply preview target %q", preview.Target)
		}
		if countCodexConfigDryRunValidationErrors(preview.Validation) > 0 {
			return codexConfigAppliedTextResult{}, fmt.Errorf("staged Codex config apply requires a preview without validation errors")
		}
	}
	applied := strings.ReplaceAll(configText, "\r\n", "\n")
	appliedOperations := make([]string, 0, len(preview.Operations))
	for _, operation := range preview.Operations {
		if operation.Target != "skills.config" && operation.Target != "mcp_servers" {
			if strict {
				return codexConfigAppliedTextResult{}, fmt.Errorf("unsupported Codex config staged apply target %q", operation.Target)
			}
			continue
		}
		result, err := applyCodexConfigPreviewOperation(applied, operation)
		if err != nil {
			return codexConfigAppliedTextResult{}, err
		}
		applied = result.text
		if result.operation != "" {
			appliedOperations = append(appliedOperations, result.operation)
		}
	}
	applied = redactCodexConfigDocument(applied)
	applied = codexConfigEnsureTrailingNewline(applied)
	return codexConfigAppliedTextResult{text: applied, operations: appliedOperations}, nil
}

func codexConfigStagedConfirmationToken(preview CodexConfigDryRunPreview, appliedText string) string {
	h := sha256.New()
	_, _ = h.Write([]byte(preview.Target))
	_, _ = h.Write([]byte("\n"))
	_, _ = h.Write([]byte(preview.TargetPath))
	_, _ = h.Write([]byte("\n"))
	for _, operation := range preview.Operations {
		_, _ = h.Write([]byte(operation.ID))
		_, _ = h.Write([]byte("|"))
		_, _ = h.Write([]byte(operation.Target))
		_, _ = h.Write([]byte("|"))
		_, _ = h.Write([]byte(operation.PatchPlan.Operation))
		_, _ = h.Write([]byte("\n"))
	}
	_, _ = h.Write([]byte(appliedText))
	return hex.EncodeToString(h.Sum(nil))
}

func codexConfigStagedDiffPreview(preview CodexConfigDryRunPreview, appliedText string) []string {
	lines := make([]string, 0, len(preview.Operations)+3)
	lines = append(lines,
		fmt.Sprintf("# target = %q", preview.TargetPath),
		"# staged transaction: backup -> temp write -> target write -> verify -> rollback-on-failure",
	)
	for _, operation := range preview.Operations {
		lines = append(lines, fmt.Sprintf("# operation %s %s %s", operation.Target, operation.PatchPlan.Operation, operation.ID))
	}
	if strings.TrimSpace(appliedText) != "" {
		lines = append(lines, "# applied text preview follows")
		lines = append(lines, appliedText)
	}
	return lines
}

func applyCodexConfigPreviewOperation(configText string, operation CodexConfigDryRunOperation) (codexConfigPreviewApplyResult, error) {
	switch operation.Target {
	case "skills.config":
		if codexConfigHasMatchingGeneratedSection(configText, "[[skills.config]]", operation.ExtensionID, operation.CapabilityID) {
			return codexConfigPreviewApplyResult{text: configText, operation: "noop-existing-array-table-preview"}, nil
		}
		return codexConfigPreviewApplyResult{
			text:      appendCodexConfigPreviewBlock(configText, codexConfigPreviewSkillsBlock(operation)),
			operation: "add-array-table-preview",
		}, nil
	case "mcp_servers":
		header := "[" + operation.PatchPlan.TargetSection + "]"
		if codexConfigHasMatchingGeneratedSection(configText, header, operation.ExtensionID, operation.CapabilityID) {
			return codexConfigPreviewApplyResult{text: configText, operation: "noop-existing-parent-table-preview"}, nil
		}
		if codexConfigHasSectionHeader(configText, header) {
			next, _, err := updateCodexConfigPreviewParentTable(configText, operation)
			if err != nil {
				return codexConfigPreviewApplyResult{}, err
			}
			return codexConfigPreviewApplyResult{text: next, operation: "update-parent-table-preview"}, nil
		}
		return codexConfigPreviewApplyResult{
			text:      appendCodexConfigPreviewBlock(configText, codexConfigPreviewMcpBlock(operation)),
			operation: "add-parent-table-preview",
		}, nil
	default:
		return codexConfigPreviewApplyResult{}, fmt.Errorf("unsupported Codex config preview apply target %q", operation.Target)
	}
}

func appendCodexConfigPreviewBlock(configText string, block string) string {
	configText = strings.TrimRight(configText, "\n")
	if strings.TrimSpace(configText) == "" {
		return block
	}
	return configText + "\n\n" + block
}

func updateCodexConfigPreviewParentTable(configText string, operation CodexConfigDryRunOperation) (string, bool, error) {
	header := "[" + operation.PatchPlan.TargetSection + "]"
	lines := strings.Split(strings.ReplaceAll(configText, "\r\n", "\n"), "\n")
	sections := readCodexConfigTomlRawSections(lines)
	for _, section := range sections {
		if section.header != header {
			continue
		}
		if codexConfigSectionHasSourceMarkers(lines[section.start:section.end], operation.ExtensionID, operation.CapabilityID) {
			return configText, false, nil
		}
		next := make([]string, 0, len(lines)+2)
		next = append(next, lines[:section.start+1]...)
		next = append(next,
			fmt.Sprintf("# source_extension = %q", operation.ExtensionID),
			fmt.Sprintf("# source_capability = %q", operation.CapabilityID),
		)
		next = append(next, lines[section.start+1:]...)
		return strings.Join(next, "\n"), true, nil
	}
	return appendCodexConfigPreviewBlock(configText, codexConfigPreviewMcpBlock(operation)), true, nil
}

func codexConfigHasSectionHeader(configText string, header string) bool {
	lines := strings.Split(strings.ReplaceAll(configText, "\r\n", "\n"), "\n")
	for _, section := range readCodexConfigTomlRawSections(lines) {
		if section.header == header {
			return true
		}
	}
	return false
}

func codexConfigHasMatchingGeneratedSection(configText string, header string, extensionID string, capabilityID string) bool {
	lines := strings.Split(strings.ReplaceAll(configText, "\r\n", "\n"), "\n")
	for _, section := range readCodexConfigTomlRawSections(lines) {
		if section.header != header {
			continue
		}
		if codexConfigSectionHasSourceMarkers(lines[section.start:section.end], extensionID, capabilityID) {
			return true
		}
	}
	return false
}

func codexConfigPreviewSkillsBlock(operation CodexConfigDryRunOperation) string {
	return strings.Join([]string{
		"[[skills.config]]",
		fmt.Sprintf("# source_extension = %q", operation.ExtensionID),
		fmt.Sprintf("# source_capability = %q", operation.CapabilityID),
		"# temp-apply-preview = true",
		"# path intentionally omitted until an explicit Codex skill install path exists",
	}, "\n")
}

func codexConfigPreviewMcpBlock(operation CodexConfigDryRunOperation) string {
	return strings.Join([]string{
		"[" + operation.PatchPlan.TargetSection + "]",
		fmt.Sprintf("# source_extension = %q", operation.ExtensionID),
		fmt.Sprintf("# source_capability = %q", operation.CapabilityID),
		"# temp-apply-preview = true",
		"# bearer_token_env_var is the only supported token reference in any future patch",
	}, "\n")
}

type codexConfigTomlRawSection struct {
	header string
	start  int
	end    int
}

func readCodexConfigTomlRawSections(lines []string) []codexConfigTomlRawSection {
	sections := make([]codexConfigTomlRawSection, 0)
	current := codexConfigTomlRawSection{start: -1}
	flush := func(end int) {
		if current.start < 0 {
			return
		}
		current.end = end
		sections = append(sections, current)
	}
	for index, line := range lines {
		trimmed := strings.TrimSpace(line)
		if !isCodexConfigTomlHeader(trimmed) {
			continue
		}
		flush(index)
		current = codexConfigTomlRawSection{
			header: trimmed,
			start:  index,
		}
	}
	flush(len(lines))
	return sections
}

func codexConfigSectionHasSourceMarkers(lines []string, extensionID string, capabilityID string) bool {
	joined := strings.Join(lines, "\n")
	return strings.Contains(joined, fmt.Sprintf("source_extension = %q", extensionID)) &&
		strings.Contains(joined, fmt.Sprintf("source_capability = %q", capabilityID))
}

func codexConfigEnsureTrailingNewline(value string) string {
	if value == "" || strings.HasSuffix(value, "\n") {
		return value
	}
	return value + "\n"
}

func redactCodexConfigDocument(configText string) string {
	return strings.Join(redactCodexConfigTomlSnippet(strings.Split(strings.ReplaceAll(configText, "\r\n", "\n"), "\n")), "\n")
}
