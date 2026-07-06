import type { main } from '../../../wailsjs/go/models';

export interface GetTokensExtensionRegistryViewOptions {
  query?: string;
  selectedExtensionID?: string;
}

export interface GetTokensExtensionRegistrySummary {
  extensionCount: number;
  invalidCount: number;
  compatibleCount: number;
  registryDiagnosticCount: number;
  rootCount: number;
  capabilityKindCount: number;
  capabilityKinds: string[];
  readOnly: boolean;
}

export interface GetTokensExtensionRegistryRootView {
  id: string;
  path: string;
  readOnly: boolean;
  extensionCount: number;
}

export interface GetTokensExtensionRegistryDiagnosticView {
  scope: 'registry' | 'extension' | 'capability';
  severity: string;
  code: string;
  path: string;
  message: string;
  source: string;
  capabilityID?: string;
  capabilityKind?: string;
}

export interface GetTokensExtensionRegistryActionReasonView {
  code: string;
  label: string;
  message: string;
}

export interface GetTokensExtensionRegistryEnableStateView {
  state: 'enabled' | 'disabled' | 'blocked' | 'pending' | 'readonly-unsupported';
  label: string;
  reasonSummary: string;
  reasons: GetTokensExtensionRegistryActionReasonView[];
}

export interface GetTokensExtensionRegistryActionAvailabilityView {
  state: 'available' | 'disabled';
  action: 'enable' | 'disable' | null;
  label: string;
  reasonSummary: string;
  reasons: GetTokensExtensionRegistryActionReasonView[];
}

export interface GetTokensExtensionRegistryCapabilityView {
  id: string;
  kind: string;
  state: string;
  requiredPermissions: string[];
  declaredContributions: string[];
  diagnostics: GetTokensExtensionRegistryDiagnosticView[];
}

export interface GetTokensExtensionRegistryExtensionView {
  id: string;
  name: string;
  version: string;
  state: string;
  publisherName: string;
  manifestPath: string;
  sourceURI: string;
  sourceType: string;
  sourceRevision: string;
  rootID: string;
  rootPath: string;
  permissions: string[];
  capabilityKinds: string[];
  capabilityCount: number;
  diagnosticCount: number;
  diagnostics: GetTokensExtensionRegistryDiagnosticView[];
  capabilities: GetTokensExtensionRegistryCapabilityView[];
  compatibilityStatus: string;
  compatibilityManifestContract: string;
  compatibilitySidecarContract: string;
  compatibilityCapabilityContract: string;
  enableState: GetTokensExtensionRegistryEnableStateView;
  actionAvailability: GetTokensExtensionRegistryActionAvailabilityView;
  readOnly: boolean;
}

export interface GetTokensExtensionRegistryView {
  summary: GetTokensExtensionRegistrySummary;
  query: string;
  roots: GetTokensExtensionRegistryRootView[];
  extensions: GetTokensExtensionRegistryExtensionView[];
  selectedExtension: GetTokensExtensionRegistryExtensionView | null;
  registryDiagnostics: GetTokensExtensionRegistryDiagnosticView[];
}

export interface GetTokensExtensionCodexConfigDryRunView {
  dryRun: boolean;
  target: string;
  targetPath: string;
  generatedAt: string;
  enabledExtensionCount: number;
  skippedExtensionCount: number;
  operationCount: number;
  validationErrorCount: number;
  sections: GetTokensExtensionCodexConfigDryRunSectionView[];
  operations: GetTokensExtensionCodexConfigDryRunOperationView[];
  validation: GetTokensExtensionCodexConfigDryRunValidationView[];
}

export interface GetTokensExtensionCodexConfigDryRunSectionView {
  id: string;
  label: string;
  status: string;
  diffPreview: string[];
}

export interface GetTokensExtensionCodexConfigDryRunValidationView {
  code: string;
  severity: string;
  extensionID: string;
  capabilityID: string;
  target: string;
  message: string;
}

export interface GetTokensExtensionCodexConfigDryRunOperationView {
  id: string;
  target: string;
  action: string;
  extensionID: string;
  capabilityID: string;
  preview: string;
  patchPlan: GetTokensExtensionCodexConfigTomlPatchPlanView;
}

export interface GetTokensExtensionCodexConfigTomlPatchPlanView {
  targetSection: string;
  operation: string;
  beforeSnippet: string;
  afterSnippet: string;
  validation: string[];
}

export type GetTokensExtensionCodexConfigStagedApplyStatus =
  | 'blocked'
  | 'ready'
  | 'preparing'
  | 'prepared'
  | 'applying'
  | 'applied'
  | 'failed';

export interface GetTokensExtensionCodexConfigStagedApplyView {
  status: GetTokensExtensionCodexConfigStagedApplyStatus;
  targetPath: string;
  tempDir: string;
  enabledPrepare: boolean;
  enabledApply: boolean;
  disabledReason: string;
  confirmationLabel: string;
  diffPreview: string[];
  appliedOperations: string[];
  resultLabel: string;
  rollbackLabel: string;
  errorDetail: string;
}

export function deriveGetTokensExtensionRegistryView(
  snapshot: main.GetTokensExtensionRegistrySnapshot,
  options: GetTokensExtensionRegistryViewOptions = {},
): GetTokensExtensionRegistryView {
  const query = (options.query || '').trim().toLowerCase();
  const roots = buildRootViews(snapshot);
  const registryDiagnostics = (snapshot.diagnostics || []).map((diagnostic) => mapDiagnostic('registry', diagnostic));
  const capabilityKinds = new Set<string>();

  const extensions = (snapshot.extensions || [])
    .map((extension) => mapExtension(snapshot, extension, capabilityKinds))
    .filter((extension) => matchesExtensionQuery(extension, query))
    .sort(compareExtensions);

  const selectedExtension = resolveSelectedExtension(extensions, options.selectedExtensionID);

  return {
    summary: {
      extensionCount: (snapshot.extensions || []).length,
      invalidCount: (snapshot.extensions || []).filter((extension) => extension.state === 'invalid').length,
      compatibleCount: (snapshot.extensions || []).filter((extension) => extension.state === 'readonly-compatible').length,
      registryDiagnosticCount: registryDiagnostics.length,
      rootCount: roots.length,
      capabilityKindCount: capabilityKinds.size,
      capabilityKinds: [...capabilityKinds].sort(),
      readOnly: Boolean(snapshot.readOnly),
    },
    query,
    roots,
    extensions,
    selectedExtension,
    registryDiagnostics,
  };
}

export function deriveGetTokensExtensionCodexConfigDryRunView(
  preview: main.GetTokensExtensionCodexConfigDryRunPreview,
): GetTokensExtensionCodexConfigDryRunView {
  return {
    dryRun: Boolean(preview.dryRun),
    target: preview.target || 'codex-config',
    targetPath: preview.targetPath || 'not-read',
    generatedAt: formatRegistryGeneratedAt(preview.generatedAt),
    enabledExtensionCount: preview.summary?.enabledExtensionCount || 0,
    skippedExtensionCount: preview.summary?.skippedExtensionCount || 0,
    operationCount: preview.summary?.operationCount || 0,
    validationErrorCount: preview.summary?.validationErrorCount || 0,
    sections: (preview.sections || []).map((section) => ({
      id: section.id || '',
      label: section.label || section.id || 'Codex config section',
      status: section.status || 'unknown',
      diffPreview: (section.diffPreview || []).map((line) => redactCodexConfigSensitiveText(line)),
    })),
    operations: (preview.operations || []).map((operation) => {
      const patchPlan = readCodexConfigTomlPatchPlan(operation);
      return {
        id: operation.id || '',
        target: operation.target || 'codex-config',
        action: operation.action || 'preview',
        extensionID: operation.extensionID || '',
        capabilityID: operation.capabilityID || '',
        preview: redactCodexConfigSensitiveText(operation.preview || ''),
        patchPlan,
      };
    }),
    validation: (preview.validation || []).map((item) => ({
      code: item.code || 'unknown-validation',
      severity: item.severity || 'error',
      extensionID: item.extensionID || '',
      capabilityID: item.capabilityID || '',
      target: item.target || 'codex-config',
      message: redactCodexConfigSensitiveText(item.message || ''),
    })),
  };
}

export function deriveGetTokensExtensionCodexConfigStagedApplyView({
  runtimeAvailable,
  targetPath,
  tempDir,
  operationCount,
  validationErrorCount,
  preparing = false,
  applying = false,
  plan,
  result,
  error = '',
}: {
  runtimeAvailable: boolean;
  targetPath: string;
  tempDir: string;
  operationCount: number;
  validationErrorCount: number;
  preparing?: boolean;
  applying?: boolean;
  plan?: Partial<main.GetTokensExtensionCodexConfigStagedApplyPlan> | null;
  result?: Partial<main.GetTokensExtensionCodexConfigStagedApplyResult> | null;
  error?: string;
}): GetTokensExtensionCodexConfigStagedApplyView {
  const cleanTargetPath = String(targetPath || '').trim();
  const cleanTempDir = String(tempDir || '').trim();
  const planReady = Boolean(plan?.confirmationToken);
  const hasResult = Boolean(result?.status);
  const hasError = Boolean(error);
  const safeTarget = isExplicitTempCodexConfigTarget(cleanTargetPath);
  const disabledReason = !runtimeAvailable
    ? 'Wails runtime is required before staged test apply can run.'
    : !safeTarget
      ? 'Staged apply requires an explicit /tmp or /private/tmp target path; real ~/.codex/config.toml is blocked.'
      : !cleanTempDir
        ? 'Staged apply requires an explicit temp dir.'
        : operationCount <= 0
          ? 'No dry-run operation is available to stage.'
          : validationErrorCount > 0
            ? 'Dry-run validation errors must be resolved before staging.'
            : '';
  const status: GetTokensExtensionCodexConfigStagedApplyStatus = preparing
    ? 'preparing'
    : applying
      ? 'applying'
      : hasError || (hasResult && result?.status !== 'applied')
        ? 'failed'
        : result?.status === 'applied'
          ? 'applied'
          : planReady
            ? 'prepared'
            : disabledReason
              ? 'blocked'
              : 'ready';
  return {
    status,
    targetPath: cleanTargetPath || 'not-set',
    tempDir: cleanTempDir || 'not-set',
    enabledPrepare: !disabledReason && !preparing && !applying,
    enabledApply: !disabledReason && planReady && !preparing && !applying,
    disabledReason,
    confirmationLabel: planReady ? `confirmation=${plan?.confirmationToken}` : 'Prepare creates a one-use confirmation token.',
    diffPreview: (plan?.diffPreview || []).map((line) => redactCodexConfigSensitiveText(String(line))),
    appliedOperations: (result?.appliedOperations || plan?.appliedOperations || []).map((item) => String(item)),
    resultLabel: hasResult ? String(result?.status || 'unknown') : 'No staged transaction has run.',
    rollbackLabel: hasResult
      ? `rolledBack=${String(Boolean(result?.rolledBack))}${result?.errorStage ? ` stage=${result.errorStage}` : ''}`
      : 'Rollback result appears after apply/verify runs.',
    errorDetail: error || '',
  };
}

function isExplicitTempCodexConfigTarget(targetPath: string): boolean {
  const clean = targetPath.trim();
  if (!clean) {
    return false;
  }
  if (clean.includes('/.codex/config.toml') || clean === '~/.codex/config.toml') {
    return false;
  }
  return clean.startsWith('/tmp/') || clean.startsWith('/private/tmp/');
}

function readCodexConfigTomlPatchPlan(
  operation: main.GetTokensExtensionCodexConfigDryRunOperation,
): GetTokensExtensionCodexConfigTomlPatchPlanView {
  const patchPlan = (operation as unknown as { patchPlan?: Partial<GetTokensExtensionCodexConfigTomlPatchPlanView> })
    .patchPlan;
  return {
    targetSection: patchPlan?.targetSection || operation.target || 'codex-config',
    operation: patchPlan?.operation || operation.action || 'preview',
    beforeSnippet: redactCodexConfigSensitiveText(patchPlan?.beforeSnippet || ''),
    afterSnippet: redactCodexConfigSensitiveText(patchPlan?.afterSnippet || operation.preview || ''),
    validation: [...(patchPlan?.validation || [])],
  };
}

function redactCodexConfigSensitiveText(value: string): string {
  if (!value) {
    return '';
  }
  return value
    .split('\n')
    .map((line) => {
      const redactedLine = redactCodexConfigSensitiveLine(line);
      if (redactedLine !== line || line.includes('=')) {
        return redactedLine;
      }
      return redactCodexConfigSensitivePhrase(line);
    })
    .join('\n');
}

function redactCodexConfigSensitivePhrase(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._-]+\b/gi, 'Bearer <redacted>')
    .replace(/\b[A-Za-z0-9._-]*(?:token|cookie|secret)[A-Za-z0-9._-]*\b/gi, (match) =>
      match === 'bearer_token_env_var' ? match : '<redacted>',
    );
}

function redactCodexConfigSensitiveLine(line: string): string {
  const match = line.match(/^(\s*["']?([A-Za-z0-9_.-]+)["']?\s*=\s*)(.*)$/);
  if (!match) {
    return line;
  }
  const key = match[2].toLowerCase();
  if (key === 'bearer_token_env_var') {
    return line;
  }
  if (
    key === 'bearer_token' ||
    key === 'authorization' ||
    key === 'auth_header' ||
    key === 'header' ||
    key === 'headers' ||
    key === 'cookie' ||
    key === 'token' ||
    key.includes('token') ||
    key.includes('secret') ||
    key.includes('cookie') ||
    key.includes('header')
  ) {
    return `${match[1]}"<redacted>"`;
  }
  return line;
}

export function formatRegistryGeneratedAt(value: string | undefined): string {
  if (!value) {
    return 'unknown';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toISOString().replace('.000Z', 'Z');
}

export function formatRegistryStateLabel(state: string | undefined): string {
  switch (state) {
    case 'invalid':
      return 'INVALID';
    case 'readonly-compatible':
      return 'READONLY COMPATIBLE';
    case 'readonly-incompatible':
      return 'READONLY INCOMPATIBLE';
    default:
      return (state || 'UNKNOWN').replace(/_/g, ' ').toUpperCase();
  }
}

function buildRootViews(snapshot: main.GetTokensExtensionRegistrySnapshot): GetTokensExtensionRegistryRootView[] {
  const counts = new Map<string, number>();
  for (const extension of snapshot.extensions || []) {
    const root = findRootForManifestPath(snapshot.roots || [], extension.source?.manifestPath || '');
    if (!root) {
      continue;
    }
    counts.set(root.id, (counts.get(root.id) || 0) + 1);
  }

  return (snapshot.roots || [])
    .map((root) => ({
      id: root.id || 'unknown-root',
      path: root.path || '',
      readOnly: Boolean(root.readOnly),
      extensionCount: counts.get(root.id || '') || 0,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function mapExtension(
  snapshot: main.GetTokensExtensionRegistrySnapshot,
  extension: main.GetTokensExtensionSnapshot,
  capabilityKinds: Set<string>,
): GetTokensExtensionRegistryExtensionView {
  const root = findRootForManifestPath(snapshot.roots || [], extension.source?.manifestPath || '');
  const capabilities = (extension.capabilities || []).map((capability) => {
    const kind = capability.kind || 'unknown';
    capabilityKinds.add(kind);
    return {
      id: capability.id || '',
      kind,
      state: capability.state || '',
      requiredPermissions: [...(capability.requiredPermissions || [])],
      declaredContributions: [...(capability.declaredContributions || [])],
      diagnostics: (capability.diagnostics || []).map((diagnostic) =>
        mapDiagnostic('capability', diagnostic, capability.id || '', kind),
      ),
    };
  });
  const diagnostics = [
    ...(extension.diagnostics || []).map((diagnostic) => mapDiagnostic('extension', diagnostic)),
    ...capabilities.flatMap((capability) => capability.diagnostics),
  ];

  return {
    id: extension.id || '',
    name: extension.name || extension.id || 'Unnamed extension',
    version: extension.version || '0.0.0',
    state: extension.state || 'unknown',
    publisherName: extension.publisher?.name || '',
    manifestPath: extension.source?.manifestPath || '',
    sourceURI: extension.source?.uri || '',
    sourceType: extension.source?.type || '',
    sourceRevision: extension.source?.revision || '',
    rootID: root?.id || 'unmapped-root',
    rootPath: root?.path || '',
    permissions: [...(extension.permissions || [])],
    capabilityKinds: [...new Set(capabilities.map((capability) => capability.kind))].sort(),
    capabilityCount: capabilities.length,
    diagnosticCount: diagnostics.length,
    diagnostics,
    capabilities,
    compatibilityStatus: extension.compatibility?.status || '',
    compatibilityManifestContract: extension.compatibility?.manifestContract || '',
    compatibilitySidecarContract: extension.compatibility?.sidecarContract || '',
    compatibilityCapabilityContract: extension.compatibility?.capabilityContract || '',
    enableState: deriveEnableState(extension, diagnostics),
    actionAvailability: deriveActionAvailability(extension, diagnostics),
    readOnly: Boolean(extension.readOnly),
  };
}

function mapDiagnostic(
  scope: GetTokensExtensionRegistryDiagnosticView['scope'],
  diagnostic: main.GetTokensExtensionDiagnostic,
  capabilityID?: string,
  capabilityKind?: string,
): GetTokensExtensionRegistryDiagnosticView {
  return {
    scope,
    severity: diagnostic.severity || 'warning',
    code: diagnostic.code || 'unknown-diagnostic',
    path: diagnostic.path || '',
    message: diagnostic.message || '',
    source: diagnostic.source || '',
    capabilityID,
    capabilityKind,
  };
}

function matchesExtensionQuery(extension: GetTokensExtensionRegistryExtensionView, query: string): boolean {
  if (!query) {
    return true;
  }
  const haystack = [
    extension.id,
    extension.name,
    extension.publisherName,
    extension.state,
    extension.manifestPath,
    extension.sourceURI,
    extension.sourceType,
    extension.rootID,
    extension.rootPath,
    extension.permissions.join(' '),
    extension.capabilityKinds.join(' '),
    extension.diagnostics.map((diagnostic) => `${diagnostic.code} ${diagnostic.message} ${diagnostic.path}`).join(' '),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function compareExtensions(
  left: GetTokensExtensionRegistryExtensionView,
  right: GetTokensExtensionRegistryExtensionView,
): number {
  return (
    compareStateWeight(left.enableState.state, right.enableState.state) ||
    compareStateWeight(left.state, right.state) ||
    compareSeverityWeight(left.diagnostics, right.diagnostics) ||
    left.name.localeCompare(right.name) ||
    left.id.localeCompare(right.id)
  );
}

function compareStateWeight(left: string, right: string): number {
  return stateWeight(left) - stateWeight(right);
}

function compareSeverityWeight(
  left: GetTokensExtensionRegistryDiagnosticView[],
  right: GetTokensExtensionRegistryDiagnosticView[],
): number {
  return highestDiagnosticWeight(right) - highestDiagnosticWeight(left);
}

function highestDiagnosticWeight(items: GetTokensExtensionRegistryDiagnosticView[]): number {
  if (items.some((item) => item.severity === 'error')) {
    return 2;
  }
  if (items.some((item) => item.severity === 'warning')) {
    return 1;
  }
  return 0;
}

function stateWeight(value: string): number {
  switch (value) {
    case 'invalid':
      return 0;
    case 'readonly-incompatible':
      return 1;
    case 'readonly-compatible':
      return 2;
    default:
      return 3;
  }
}

function deriveEnableState(
  extension: main.GetTokensExtensionSnapshot,
  diagnostics: GetTokensExtensionRegistryDiagnosticView[],
): GetTokensExtensionRegistryEnableStateView {
  if (isPendingState(extension, diagnostics)) {
    return buildEnableState('pending', collectPendingReasons(diagnostics));
  }
  if (isDisabledState(extension, diagnostics)) {
    return buildEnableState('disabled', collectDisabledReasons(diagnostics));
  }
  if (isBlockedState(extension, diagnostics)) {
    return buildEnableState('blocked', collectBlockedReasons(extension, diagnostics));
  }
  if (extension.state === 'readonly-compatible') {
    return buildEnableState('enabled', [
      {
        code: 'readonly-compatible-active-view',
        label: 'Readonly Active View',
        message: 'registry snapshot shows this extension in the current read-only active view',
      },
    ]);
  }
  return buildEnableState('readonly-unsupported', [
    {
      code: 'readonly-enable-state-unsupported',
      label: 'Readonly Unsupported',
      message: 'snapshot does not yet provide a stable writable enable-state contract and remains readonly unsupported for this extension',
    },
  ]);
}

function deriveActionAvailability(
  extension: main.GetTokensExtensionSnapshot,
  diagnostics: GetTokensExtensionRegistryDiagnosticView[],
): GetTokensExtensionRegistryActionAvailabilityView {
  const enableState = deriveEnableState(extension, diagnostics);
  if (enableState.state === 'enabled') {
    return buildActionAvailability('available', 'disable', [
      {
        code: 'local-state-disable-available',
        label: 'Local Only',
        message: 'disable writes only the GetTokens app-local extension enable-state file; Codex config and capabilities are untouched',
      },
    ]);
  }
  if (enableState.state === 'disabled') {
    return buildActionAvailability('available', 'enable', [
      {
        code: 'local-state-enable-available',
        label: 'Local Only',
        message: 'enable writes only the GetTokens app-local extension enable-state file; Codex config and capabilities are untouched',
      },
    ]);
  }
  return buildActionAvailability('disabled', null, enableState.reasons);
}

function buildEnableState(
  state: GetTokensExtensionRegistryEnableStateView['state'],
  reasons: GetTokensExtensionRegistryActionReasonView[],
): GetTokensExtensionRegistryEnableStateView {
  return {
    state,
    label: formatEnableStateLabel(state),
    reasonSummary: reasons[0]?.message || '',
    reasons,
  };
}

function buildActionAvailability(
  state: GetTokensExtensionRegistryActionAvailabilityView['state'],
  action: GetTokensExtensionRegistryActionAvailabilityView['action'],
  reasons: GetTokensExtensionRegistryActionReasonView[],
): GetTokensExtensionRegistryActionAvailabilityView {
  return {
    state,
    action,
    label: action === 'enable' ? 'ENABLE LOCAL' : action === 'disable' ? 'DISABLE LOCAL' : 'DISABLED',
    reasonSummary: reasons[0]?.message || '',
    reasons,
  };
}

function formatEnableStateLabel(value: GetTokensExtensionRegistryEnableStateView['state']): string {
  switch (value) {
    case 'readonly-unsupported':
      return 'READONLY UNSUPPORTED';
    default:
      return value.replace(/-/g, ' ').toUpperCase();
  }
}

function isDisabledState(
  extension: main.GetTokensExtensionSnapshot,
  diagnostics: GetTokensExtensionRegistryDiagnosticView[],
): boolean {
  return extension.state === 'disabled' || diagnostics.some((item) => /disabled/.test(item.code));
}

function isPendingState(
  extension: main.GetTokensExtensionSnapshot,
  diagnostics: GetTokensExtensionRegistryDiagnosticView[],
): boolean {
  return extension.state === 'pending' || diagnostics.some((item) => /pending/.test(item.code));
}

function isBlockedState(
  extension: main.GetTokensExtensionSnapshot,
  diagnostics: GetTokensExtensionRegistryDiagnosticView[],
): boolean {
  return (
    extension.state === 'invalid' ||
    extension.state === 'readonly-incompatible' ||
    extension.compatibility?.status === 'incompatible' ||
    diagnostics.some((item) => item.severity === 'error')
  );
}

function collectDisabledReasons(
  diagnostics: GetTokensExtensionRegistryDiagnosticView[],
): GetTokensExtensionRegistryActionReasonView[] {
  return (
    diagnostics
      .filter((item) => /disabled/.test(item.code))
      .map((item) => mapReason('Disabled By Plan', item)) || []
  ).concat([
    {
      code: 'disabled-state-declared',
      label: 'Disabled',
      message: 'extension is present in registry snapshot but not active in the current plan',
    },
  ]);
}

function collectPendingReasons(
  diagnostics: GetTokensExtensionRegistryDiagnosticView[],
): GetTokensExtensionRegistryActionReasonView[] {
  return (
    diagnostics
      .filter((item) => /pending/.test(item.code))
      .map((item) => mapReason('Pending Review', item)) || []
  ).concat([
    {
      code: 'pending-state-declared',
      label: 'Pending',
      message: 'extension state is pending and cannot be acted on in this read-only slice',
    },
  ]);
}

function collectBlockedReasons(
  extension: main.GetTokensExtensionSnapshot,
  diagnostics: GetTokensExtensionRegistryDiagnosticView[],
): GetTokensExtensionRegistryActionReasonView[] {
  const reasons = diagnostics
    .filter((item) => item.severity === 'error')
    .map((item) => mapReason('Blocked By Diagnostic', item));
  if (extension.compatibility?.status === 'incompatible') {
    reasons.unshift({
      code: 'compatibility-incompatible',
      label: 'Compatibility Blocked',
      message: 'extension compatibility contract is incompatible with the current registry runtime',
    });
  }
  if (reasons.length === 0) {
    reasons.push({
      code: 'blocked-state-declared',
      label: 'Blocked',
      message: 'extension state is blocked by current contract validation results',
    });
  }
  return reasons;
}

function mapReason(
  fallbackLabel: string,
  diagnostic: GetTokensExtensionRegistryDiagnosticView,
): GetTokensExtensionRegistryActionReasonView {
  return {
    code: diagnostic.code,
    label: fallbackLabel,
    message: diagnostic.message || fallbackLabel,
  };
}

function resolveSelectedExtension(
  extensions: GetTokensExtensionRegistryExtensionView[],
  selectedExtensionID: string | undefined,
): GetTokensExtensionRegistryExtensionView | null {
  if (selectedExtensionID) {
    const selected = extensions.find((extension) => extension.id === selectedExtensionID || extension.manifestPath === selectedExtensionID);
    if (selected) {
      return selected;
    }
  }
  return extensions[0] || null;
}

function findRootForManifestPath(
  roots: main.GetTokensExtensionRoot[],
  manifestPath: string,
): main.GetTokensExtensionRoot | null {
  const normalizedManifestPath = normalizePath(manifestPath);
  for (const root of roots) {
    const normalizedRootPath = normalizePath(root.path || '');
    if (!normalizedRootPath) {
      continue;
    }
    if (normalizedManifestPath === normalizedRootPath || normalizedManifestPath.startsWith(`${normalizedRootPath}/`)) {
      return root;
    }
  }
  return null;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '').trim();
}
