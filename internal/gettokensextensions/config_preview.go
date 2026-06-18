package gettokensextensions

import (
	"fmt"
	"sort"
	"strings"
	"time"
)

const (
	CodexConfigDryRunTarget = "codex-config"

	DiagnosticCodexConfigWriteUnsupported = "codex-config-write-unsupported"
	DiagnosticCodexConfigNoEnabled        = "codex-config-no-enabled-extensions"
	DiagnosticCodexConfigProjectionOnly   = "codex-config-projection-only"
)

type CodexConfigDryRunOptions struct {
	TargetPath string
	ConfigText string
	Now        func() time.Time
}

type CodexConfigDryRunPreview struct {
	ContractVersion string                        `json:"contractVersion"`
	DryRun          bool                          `json:"dryRun"`
	GeneratedAt     string                        `json:"generatedAt"`
	Target          string                        `json:"target"`
	TargetPath      string                        `json:"targetPath,omitempty"`
	Summary         CodexConfigDryRunSummary      `json:"summary"`
	Sections        []CodexConfigDryRunSection    `json:"sections"`
	Operations      []CodexConfigDryRunOperation  `json:"operations"`
	Validation      []CodexConfigDryRunValidation `json:"validation"`
}

type CodexConfigDryRunSummary struct {
	EnabledExtensionCount int `json:"enabledExtensionCount"`
	SkippedExtensionCount int `json:"skippedExtensionCount"`
	OperationCount        int `json:"operationCount"`
	ValidationErrorCount  int `json:"validationErrorCount"`
}

type CodexConfigDryRunSection struct {
	ID          string   `json:"id"`
	Label       string   `json:"label"`
	Status      string   `json:"status"`
	DiffPreview []string `json:"diffPreview"`
}

type CodexConfigDryRunOperation struct {
	ID           string                   `json:"id"`
	Target       string                   `json:"target"`
	Action       string                   `json:"action"`
	ExtensionID  string                   `json:"extensionID,omitempty"`
	CapabilityID string                   `json:"capabilityID,omitempty"`
	Preview      string                   `json:"preview,omitempty"`
	PatchPlan    CodexConfigTomlPatchPlan `json:"patchPlan"`
}

type CodexConfigTomlPatchPlan struct {
	TargetSection string   `json:"targetSection"`
	Operation     string   `json:"operation"`
	BeforeSnippet string   `json:"beforeSnippet"`
	AfterSnippet  string   `json:"afterSnippet"`
	Validation    []string `json:"validation"`
}

type CodexConfigDryRunValidation struct {
	Code         string `json:"code"`
	Severity     string `json:"severity"`
	ExtensionID  string `json:"extensionID,omitempty"`
	CapabilityID string `json:"capabilityID,omitempty"`
	Target       string `json:"target"`
	Message      string `json:"message"`
}

func PreviewCodexConfigDryRun(snapshot RegistrySnapshot, options CodexConfigDryRunOptions) CodexConfigDryRunPreview {
	now := time.Now
	if options.Now != nil {
		now = options.Now
	}

	preview := CodexConfigDryRunPreview{
		ContractVersion: ContractVersionV0,
		DryRun:          true,
		GeneratedAt:     now().UTC().Format(time.RFC3339),
		Target:          CodexConfigDryRunTarget,
		TargetPath:      options.TargetPath,
		Sections: []CodexConfigDryRunSection{
			{
				ID:     "skills.config",
				Label:  "Codex Skills Config",
				Status: "preview",
				DiffPreview: []string{
					"# dry-run: candidate [[skills.config]] projections will appear here",
					"# boundary: preview only; no Codex config file is read or written",
				},
			},
			{
				ID:     "mcp_servers",
				Label:  "Codex MCP Servers",
				Status: "preview",
				DiffPreview: []string{
					"# dry-run: candidate [mcp_servers.<id>] projections will appear here",
					"# boundary: preview only; no Codex config file is read or written",
				},
			},
		},
		Operations: []CodexConfigDryRunOperation{},
		Validation: []CodexConfigDryRunValidation{},
	}

	for _, extension := range snapshot.Extensions {
		if !isCodexConfigDryRunEnabledState(extension.State) {
			preview.Summary.SkippedExtensionCount++
			continue
		}
		preview.Summary.EnabledExtensionCount++
		if extension.ID == "" {
			preview.Validation = append(preview.Validation, codexConfigDryRunValidation(
				DiagnosticCodexConfigWriteUnsupported,
				string(SeverityError),
				"",
				"",
				"enabled extension is missing an id and cannot produce a Codex config dry-run operation",
			))
			continue
		}
		if len(extension.Capabilities) == 0 {
			preview.Validation = append(preview.Validation, codexConfigDryRunValidation(
				DiagnosticCodexConfigWriteUnsupported,
				string(SeverityError),
				extension.ID,
				"",
				fmt.Sprintf("extension %q is enabled but has no capabilities that declare Codex Skills or MCP config writes", extension.ID),
			))
			continue
		}
		for _, capability := range extension.Capabilities {
			operation, ok := projectCodexConfigDryRunOperation(extension, capability, options.ConfigText)
			if !ok {
				preview.Validation = append(preview.Validation, codexConfigDryRunValidation(
					DiagnosticCodexConfigWriteUnsupported,
					string(SeverityWarning),
					extension.ID,
					capability.ID,
					fmt.Sprintf("capability %q (%s) does not project to Codex Skills or MCP config in Extension Contract v0 dry-run", capability.ID, capability.Kind),
				))
				continue
			}
			preview.Operations = append(preview.Operations, operation)
			appendSectionDiffPreview(&preview.Sections, operation)
			preview.Validation = append(preview.Validation, codexConfigDryRunValidation(
				DiagnosticCodexConfigProjectionOnly,
				string(SeverityWarning),
				extension.ID,
				capability.ID,
				fmt.Sprintf("capability %q (%s) produced a dry-run candidate only; no save/apply operation is available", capability.ID, capability.Kind),
			))
		}
	}
	if preview.Summary.EnabledExtensionCount == 0 {
		preview.Validation = append(preview.Validation, codexConfigDryRunValidation(
			DiagnosticCodexConfigNoEnabled,
			string(SeverityError),
			"",
			"",
			"no enabled extensions are available for Codex config dry-run preview",
		))
	}

	sort.Slice(preview.Validation, func(i, j int) bool {
		left := preview.Validation[i]
		right := preview.Validation[j]
		if left.ExtensionID != right.ExtensionID {
			return left.ExtensionID < right.ExtensionID
		}
		if left.CapabilityID != right.CapabilityID {
			return left.CapabilityID < right.CapabilityID
		}
		return left.Code < right.Code
	})
	preview.Summary.OperationCount = len(preview.Operations)
	preview.Summary.ValidationErrorCount = countCodexConfigDryRunValidationErrors(preview.Validation)
	return preview
}

func isCodexConfigDryRunEnabledState(state ExtensionState) bool {
	return state == StateEnabled || state == StateReadonlyCompatible
}

func projectCodexConfigDryRunOperation(extension ExtensionSnapshot, capability CapabilitySnapshot, configText string) (CodexConfigDryRunOperation, bool) {
	if capability.ID == "" || !isCodexConfigDryRunEnabledState(capability.State) {
		return CodexConfigDryRunOperation{}, false
	}

	target := ""
	switch capability.Kind {
	case "provider-metadata":
		target = "skills.config"
	case "model-catalog-source":
		target = "mcp_servers"
	default:
		return CodexConfigDryRunOperation{}, false
	}

	operation := CodexConfigDryRunOperation{
		ID:           fmt.Sprintf("%s:%s:%s", target, extension.ID, capability.ID),
		Target:       target,
		Action:       "preview",
		ExtensionID:  extension.ID,
		CapabilityID: capability.ID,
		Preview:      codexConfigDryRunOperationPreview(target, extension, capability),
		PatchPlan:    codexConfigTomlPatchPlan(target, extension, capability, configText),
	}
	return operation, true
}

func codexConfigDryRunOperationPreview(target string, extension ExtensionSnapshot, capability CapabilitySnapshot) string {
	contributions := strings.Join(capability.DeclaredContributions, ", ")
	if contributions == "" {
		contributions = capability.Kind
	}
	switch target {
	case "skills.config":
		return strings.Join([]string{
			fmt.Sprintf("# + candidate [[skills.config]] from extension %q", extension.ID),
			fmt.Sprintf("# + capability = %q", capability.ID),
			fmt.Sprintf("# + contribution = %q", contributions),
			"# + enabled = false",
		}, "\n")
	case "mcp_servers":
		serverID := sanitizeCodexConfigIdentifier(extension.ID + "." + capability.ID)
		return strings.Join([]string{
			fmt.Sprintf("# + candidate [mcp_servers.%s] from extension %q", serverID, extension.ID),
			fmt.Sprintf("# + capability = %q", capability.ID),
			fmt.Sprintf("# + contribution = %q", contributions),
			"# + transport = \"preview-only\"",
		}, "\n")
	default:
		return fmt.Sprintf("# + candidate %s from extension %q capability %q", target, extension.ID, capability.ID)
	}
}

func codexConfigTomlPatchPlan(target string, extension ExtensionSnapshot, capability CapabilitySnapshot, configText string) CodexConfigTomlPatchPlan {
	switch target {
	case "skills.config":
		matchingBlock := ""
		before := strings.Join([]string{
			"# before: dry-run does not read ~/.codex/config.toml",
			"# before: no matching [[skills.config]] block is assumed",
		}, "\n")
		operation := "add-array-table-preview"
		validation := []string{
			"dry-run-only",
			"no-target-config-read",
			"no-target-config-write",
			"local-patch-plan-only",
			"sensitive-fields-redacted",
			"raw-and-structured-editors-must-reload-after-any-future-save",
		}
		if strings.TrimSpace(configText) != "" {
			before = codexConfigTomlBeforeSnippet(configText, target, "")
			matchingBlock = codexConfigTomlMatchingGeneratedBlock(configText, target, extension.ID, capability.ID, "")
			validation = append(validation, "input-toml-read-only")
		}
		if matchingBlock != "" {
			operation = "noop-existing-array-table-preview"
			validation = append(validation, "idempotent-existing-action-noop")
			return CodexConfigTomlPatchPlan{
				TargetSection: target,
				Operation:     operation,
				BeforeSnippet: matchingBlock,
				AfterSnippet: strings.Join([]string{
					matchingBlock,
					"# after: existing generated action retained; no duplicate [[skills.config]] block is added",
				}, "\n"),
				Validation: validation,
			}
		}
		after := strings.Join([]string{
			"[[skills.config]]",
			fmt.Sprintf("# source_extension = %q", extension.ID),
			fmt.Sprintf("# source_capability = %q", capability.ID),
			fmt.Sprintf("# contribution = %q", codexConfigContributionSummary(capability)),
			"# path is intentionally omitted until a future explicit Codex skill install path exists",
			"# enabled = false would be preview-only; no save/apply is available in this dry-run",
		}, "\n")
		if strings.TrimSpace(configText) != "" {
			after = strings.Join([]string{
				before,
				"# after: candidate block appended by read-only planner",
				after,
			}, "\n")
		}
		return CodexConfigTomlPatchPlan{
			TargetSection: target,
			Operation:     operation,
			BeforeSnippet: before,
			AfterSnippet:  after,
			Validation:    validation,
		}
	case "mcp_servers":
		serverID := sanitizeCodexConfigIdentifier(extension.ID + "." + capability.ID)
		targetSection := fmt.Sprintf("mcp_servers.%s", serverID)
		existingParent := ""
		before := strings.Join([]string{
			"# before: dry-run does not read ~/.codex/config.toml",
			fmt.Sprintf("# before: [mcp_servers.%s] is not assumed to exist", serverID),
		}, "\n")
		operation := "add-parent-table-preview"
		validation := []string{
			"dry-run-only",
			"no-target-config-read",
			"no-target-config-write",
			"mcp-parent-server-table-only",
			"nested-tools-and-oauth-remain-owned-by-parent-server",
			"bearer-token-literal-forbidden",
			"sensitive-fields-redacted",
		}
		if strings.TrimSpace(configText) != "" {
			before = codexConfigTomlBeforeSnippet(configText, target, serverID)
			existingParent = codexConfigTomlBeforeSnippet(configText, target, serverID)
			validation = append(validation, "input-toml-read-only")
		}
		if existingParent != "" && !strings.HasPrefix(existingParent, "# before: input TOML contains no ") {
			operation = "update-parent-table-preview"
			validation = append(validation, "idempotent-existing-parent-table-update")
		}
		if codexConfigTomlMatchingGeneratedBlock(configText, target, extension.ID, capability.ID, serverID) != "" {
			operation = "noop-existing-parent-table-preview"
			validation = append(validation, "idempotent-existing-action-noop")
		}
		after := strings.Join([]string{
			fmt.Sprintf("[mcp_servers.%s]", serverID),
			fmt.Sprintf("# source_extension = %q", extension.ID),
			fmt.Sprintf("# source_capability = %q", capability.ID),
			fmt.Sprintf("# contribution = %q", codexConfigContributionSummary(capability)),
			"# transport is intentionally unresolved in Extension Contract v0 dry-run",
			"# bearer_token_env_var is the only supported token reference in any future patch",
		}, "\n")
		if strings.TrimSpace(configText) != "" {
			after = strings.Join([]string{
				before,
				"# after: parent table upsert candidate from read-only planner",
				after,
			}, "\n")
		}
		if operation == "noop-existing-parent-table-preview" {
			after = strings.Join([]string{
				before,
				"# after: existing generated parent table retained; no duplicate [mcp_servers.<id>] table is added",
			}, "\n")
		}
		return CodexConfigTomlPatchPlan{
			TargetSection: targetSection,
			Operation:     operation,
			BeforeSnippet: before,
			AfterSnippet:  after,
			Validation:    validation,
		}
	default:
		return CodexConfigTomlPatchPlan{
			TargetSection: target,
			Operation:     "preview",
			BeforeSnippet: "# before: dry-run does not read ~/.codex/config.toml",
			AfterSnippet:  fmt.Sprintf("# after: no TOML patch plan available for %s", target),
			Validation:    []string{"dry-run-only", "no-target-config-read", "no-target-config-write"},
		}
	}
}

func codexConfigTomlMatchingGeneratedBlock(configText string, target string, extensionID string, capabilityID string, serverID string) string {
	if strings.TrimSpace(configText) == "" {
		return ""
	}
	sourceExtension := fmt.Sprintf("source_extension = %q", extensionID)
	sourceCapability := fmt.Sprintf("source_capability = %q", capabilityID)
	for _, section := range readCodexConfigTomlSections(configText) {
		switch target {
		case "skills.config":
			if section.header != "[[skills.config]]" {
				continue
			}
		case "mcp_servers":
			if section.header != fmt.Sprintf("[mcp_servers.%s]", serverID) {
				continue
			}
		default:
			continue
		}
		if strings.Contains(section.snippet, sourceExtension) && strings.Contains(section.snippet, sourceCapability) {
			return section.snippet
		}
	}
	return ""
}

func codexConfigTomlBeforeSnippet(configText string, target string, serverID string) string {
	sections := readCodexConfigTomlSections(configText)
	matches := make([]string, 0)
	for _, section := range sections {
		switch target {
		case "skills.config":
			if section.header == "[[skills.config]]" {
				matches = append(matches, section.snippet)
			}
		case "mcp_servers":
			if section.header == fmt.Sprintf("[mcp_servers.%s]", serverID) {
				matches = append(matches, section.snippet)
			}
		}
	}
	if len(matches) == 0 {
		switch target {
		case "skills.config":
			return "# before: input TOML contains no [[skills.config]] block"
		case "mcp_servers":
			return fmt.Sprintf("# before: input TOML contains no [mcp_servers.%s] parent table", serverID)
		default:
			return "# before: input TOML contains no matching section"
		}
	}
	return strings.Join(matches, "\n\n")
}

type codexConfigTomlSection struct {
	header  string
	snippet string
}

func readCodexConfigTomlSections(configText string) []codexConfigTomlSection {
	lines := strings.Split(strings.ReplaceAll(configText, "\r\n", "\n"), "\n")
	sections := make([]codexConfigTomlSection, 0)
	currentHeader := ""
	currentLines := make([]string, 0)
	flush := func() {
		if currentHeader == "" {
			return
		}
		sections = append(sections, codexConfigTomlSection{
			header:  currentHeader,
			snippet: strings.Join(redactCodexConfigTomlSnippet(currentLines), "\n"),
		})
	}
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if isCodexConfigTomlHeader(trimmed) {
			flush()
			currentHeader = trimmed
			currentLines = []string{line}
			continue
		}
		if currentHeader != "" {
			currentLines = append(currentLines, line)
		}
	}
	flush()
	return sections
}

func isCodexConfigTomlHeader(trimmed string) bool {
	if strings.HasPrefix(trimmed, "[[") && strings.HasSuffix(trimmed, "]]") {
		return true
	}
	return strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]")
}

func redactCodexConfigTomlSnippet(lines []string) []string {
	out := make([]string, 0, len(lines))
	for _, line := range lines {
		if tomlLineDefinesSensitiveCodexConfigKey(line) {
			out = append(out, tomlLineKeyPrefix(line)+"\"<redacted>\"")
			continue
		}
		out = append(out, line)
	}
	return out
}

func tomlLineDefinesSensitiveCodexConfigKey(line string) bool {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" || strings.HasPrefix(trimmed, "#") {
		return false
	}
	index := strings.Index(trimmed, "=")
	if index < 0 {
		return false
	}
	key := strings.ToLower(strings.Trim(strings.TrimSpace(trimmed[:index]), `"'`))
	if key == "bearer_token_env_var" {
		return false
	}
	sensitiveTokens := []string{
		"bearer_token",
		"authorization",
		"auth_header",
		"header",
		"headers",
		"cookie",
		"token",
		"secret",
	}
	for _, sensitive := range sensitiveTokens {
		if key == sensitive || strings.Contains(key, sensitive) {
			return true
		}
	}
	return false
}

func tomlLineKeyPrefix(line string) string {
	index := strings.Index(line, "=")
	if index < 0 {
		return line
	}
	return line[:index+1] + " "
}

func codexConfigContributionSummary(capability CapabilitySnapshot) string {
	contributions := strings.Join(capability.DeclaredContributions, ", ")
	if contributions != "" {
		return contributions
	}
	return capability.Kind
}

func appendSectionDiffPreview(sections *[]CodexConfigDryRunSection, operation CodexConfigDryRunOperation) {
	for index := range *sections {
		if (*sections)[index].ID != operation.Target {
			continue
		}
		plan := operation.PatchPlan
		(*sections)[index].DiffPreview = append((*sections)[index].DiffPreview, strings.Join([]string{
			fmt.Sprintf("# operation: %s", plan.Operation),
			"# before",
			plan.BeforeSnippet,
			"# after",
			plan.AfterSnippet,
			"# validation",
			strings.Join(plan.Validation, "\n"),
		}, "\n"))
		return
	}
}

func sanitizeCodexConfigIdentifier(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	var builder strings.Builder
	lastDash := false
	for _, char := range value {
		if (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') || char == '_' || char == '-' {
			builder.WriteRune(char)
			lastDash = false
			continue
		}
		if !lastDash {
			builder.WriteByte('-')
			lastDash = true
		}
	}
	return strings.Trim(builder.String(), "-")
}

func countCodexConfigDryRunValidationErrors(items []CodexConfigDryRunValidation) int {
	count := 0
	for _, item := range items {
		if item.Severity == string(SeverityError) {
			count++
		}
	}
	return count
}

func codexConfigDryRunValidation(code string, severity string, extensionID string, capabilityID string, message string) CodexConfigDryRunValidation {
	if severity == "" {
		severity = string(SeverityError)
	}
	return CodexConfigDryRunValidation{
		Code:         code,
		Severity:     severity,
		ExtensionID:  extensionID,
		CapabilityID: capabilityID,
		Target:       CodexConfigDryRunTarget,
		Message:      message,
	}
}
