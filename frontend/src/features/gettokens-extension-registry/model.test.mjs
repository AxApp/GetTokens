import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveGetTokensExtensionCodexConfigDryRunView,
  deriveGetTokensExtensionCodexConfigStagedApplyView,
  deriveGetTokensExtensionRegistryView,
  formatRegistryGeneratedAt,
  formatRegistryStateLabel,
} from './model.ts';
import {
  getGetTokensExtensionCodexConfigDryRunPreview,
  getGetTokensExtensionRegistryPreviewSnapshot,
} from './previewData.ts';

test('deriveGetTokensExtensionRegistryView summarizes read-only snapshot and sorts invalid first', () => {
  const view = deriveGetTokensExtensionRegistryView(getGetTokensExtensionRegistryPreviewSnapshot());

  assert.equal(view.summary.readOnly, true);
  assert.equal(view.summary.extensionCount, 2);
  assert.equal(view.summary.invalidCount, 1);
  assert.equal(view.summary.registryDiagnosticCount, 1);
  assert.deepEqual(view.summary.capabilityKinds, ['model-catalog-source', 'provider-metadata', 'quota-probe']);
  assert.equal(view.extensions[0].state, 'invalid');
  assert.equal(view.extensions[0].diagnosticCount, 2);
  assert.equal(view.extensions[0].enableState.state, 'blocked');
  assert.equal(view.extensions[0].actionAvailability.state, 'disabled');
  assert.equal(view.extensions[1].enableState.state, 'enabled');
  assert.equal(view.extensions[1].actionAvailability.state, 'available');
  assert.equal(view.extensions[1].actionAvailability.action, 'disable');
  assert.equal(view.selectedExtension?.id, 'com.example.legacy-hook');
});

test('deriveGetTokensExtensionRegistryView filters by capability kind, diagnostics and source path', () => {
  const snapshot = getGetTokensExtensionRegistryPreviewSnapshot();

  assert.equal(deriveGetTokensExtensionRegistryView(snapshot, { query: 'quota-probe' }).extensions.length, 1);
  assert.equal(deriveGetTokensExtensionRegistryView(snapshot, { query: 'unknown-capability-kind' }).extensions.length, 1);
  assert.equal(deriveGetTokensExtensionRegistryView(snapshot, { query: 'openai-metadata/gettokens.extension.json' }).extensions.length, 1);
  assert.equal(deriveGetTokensExtensionRegistryView(snapshot, { query: 'does-not-exist' }).extensions.length, 0);
});

test('deriveGetTokensExtensionRegistryView resolves source roots and falls back to first filtered selection', () => {
  const view = deriveGetTokensExtensionRegistryView(getGetTokensExtensionRegistryPreviewSnapshot(), {
    query: 'openai',
    selectedExtensionID: 'missing-selection',
  });

  assert.equal(view.extensions.length, 1);
  assert.equal(view.extensions[0].rootID, 'app-owned');
  assert.equal(view.roots[0].extensionCount, 2);
  assert.equal(view.selectedExtension?.id, 'com.example.openai-metadata');
});

test('deriveGetTokensExtensionRegistryView selects missing-id extensions by manifest path', () => {
  const baseSnapshot = getGetTokensExtensionRegistryPreviewSnapshot();
  const manifestPath = '/tmp/gettokens/missing-id/gettokens.extension.json';
  const view = deriveGetTokensExtensionRegistryView(
    {
      ...baseSnapshot,
      extensions: [
        {
          ...baseSnapshot.extensions[0],
          id: '',
          name: 'Missing ID Extension',
          source: {
            ...baseSnapshot.extensions[0].source,
            manifestPath,
          },
        },
        baseSnapshot.extensions[1],
      ],
    },
    { selectedExtensionID: manifestPath },
  );

  assert.equal(view.selectedExtension?.name, 'Missing ID Extension');
  assert.equal(view.selectedExtension?.manifestPath, manifestPath);
});

test('deriveGetTokensExtensionRegistryView maps disabled pending and fallback enable states without mutation support', () => {
  const baseSnapshot = getGetTokensExtensionRegistryPreviewSnapshot();
  const view = deriveGetTokensExtensionRegistryView({
    ...baseSnapshot,
    extensions: [
      {
        ...baseSnapshot.extensions[0],
        id: 'com.example.disabled',
        name: 'Disabled Extension',
        state: 'disabled',
        diagnostics: [
          {
            code: 'extension-disabled',
            severity: 'warning',
            path: '$.state',
            message: 'extension is disabled in registry plan',
            source: 'disabled.json',
          },
        ],
      },
      {
        ...baseSnapshot.extensions[0],
        id: 'com.example.pending',
        name: 'Pending Extension',
        state: 'pending',
        diagnostics: [
          {
            code: 'enable-state-pending-review',
            severity: 'warning',
            path: '$.compatibility',
            message: 'pending operator review before activation',
            source: 'pending.json',
          },
        ],
      },
      {
        ...baseSnapshot.extensions[0],
        id: 'com.example.unknown-enable-state',
        name: 'Unknown State Extension',
        state: 'mystery-state',
        diagnostics: [],
      },
    ],
  });

  const disabled = view.extensions.find((item) => item.id === 'com.example.disabled');
  const pending = view.extensions.find((item) => item.id === 'com.example.pending');
  const unknown = view.extensions.find((item) => item.id === 'com.example.unknown-enable-state');

  assert.equal(disabled?.enableState.state, 'disabled');
  assert.equal(disabled?.actionAvailability.state, 'available');
  assert.equal(disabled?.actionAvailability.action, 'enable');
  assert.match(disabled?.enableState.reasonSummary || '', /disabled/i);

  assert.equal(pending?.enableState.state, 'pending');
  assert.equal(pending?.actionAvailability.state, 'disabled');
  assert.match(pending?.enableState.reasonSummary || '', /pending/i);

  assert.equal(unknown?.enableState.state, 'readonly-unsupported');
  assert.equal(unknown?.actionAvailability.state, 'disabled');
  assert.match(unknown?.enableState.reasonSummary || '', /unsupported/i);
});

test('deriveGetTokensExtensionRegistryView treats incompatibility and error diagnostics as blocked reasons', () => {
  const baseSnapshot = getGetTokensExtensionRegistryPreviewSnapshot();
  const view = deriveGetTokensExtensionRegistryView({
    ...baseSnapshot,
    extensions: [
      {
        ...baseSnapshot.extensions[0],
        id: 'com.example.incompatible',
        state: 'readonly-incompatible',
        compatibility: {
          ...baseSnapshot.extensions[0].compatibility,
          status: 'incompatible',
        },
        diagnostics: [
          {
            code: 'sidecar-contract-mismatch',
            severity: 'error',
            path: '$.compatibility.sidecarContract',
            message: 'sidecar contract does not satisfy ^0.1.0',
            source: 'incompatible.json',
          },
        ],
      },
    ],
  });

  assert.equal(view.extensions[0].enableState.state, 'blocked');
  assert.equal(view.extensions[0].actionAvailability.state, 'disabled');
  assert.match(view.extensions[0].enableState.reasonSummary, /contract|blocked|incompatible/i);
});

test('registry formatter helpers keep deterministic labels', () => {
  assert.equal(formatRegistryGeneratedAt('2026-06-17T08:40:00Z'), '2026-06-17T08:40:00Z');
  assert.equal(formatRegistryGeneratedAt('not-a-date'), 'not-a-date');
  assert.equal(formatRegistryStateLabel('readonly-compatible'), 'READONLY COMPATIBLE');
  assert.equal(formatRegistryStateLabel('invalid'), 'INVALID');
});

test('deriveGetTokensExtensionCodexConfigDryRunView exposes preview-only operations and validation', () => {
  const preview = getGetTokensExtensionCodexConfigDryRunPreview();
  const view = deriveGetTokensExtensionCodexConfigDryRunView(preview);

  assert.equal(typeof preview.convertValues, 'function');
  assert.equal(view.dryRun, true);
  assert.equal(view.target, 'codex-config');
  assert.equal(view.targetPath, '~/.codex/config.toml');
  assert.equal(view.operationCount, 2);
  assert.equal(view.validationErrorCount, 0);
  assert.deepEqual(view.sections.map((section) => section.id), ['skills.config', 'mcp_servers']);
  assert.deepEqual(view.operations.map((operation) => operation.target), ['skills.config', 'mcp_servers']);
  assert.equal(view.operations[0].action, 'preview');
  assert.equal(view.operations[0].capabilityID, 'provider-openai');
  assert.equal(view.operations[0].patchPlan.targetSection, 'skills.config');
  assert.equal(view.operations[0].patchPlan.operation, 'append-array-table-preview');
  assert.match(view.operations[0].patchPlan.beforeSnippet, /does not read ~\/\.codex\/config\.toml/);
  assert.match(view.operations[0].patchPlan.afterSnippet, /\[\[skills\.config\]\]/);
  assert.ok(view.operations[0].patchPlan.validation.includes('dry-run-only'));
  assert.match(view.operations[1].preview, /preview-only/);
  assert.equal(view.operations[1].patchPlan.targetSection, 'mcp_servers.com-example-openai-metadata-catalog-openai');
  assert.match(view.operations[1].patchPlan.afterSnippet, /\[mcp_servers\.com-example-openai-metadata-catalog-openai\]/);
  assert.doesNotMatch(view.operations[1].patchPlan.afterSnippet, /\.tools\./);
  assert.ok(view.operations[1].patchPlan.validation.includes('mcp-parent-server-table-only'));
  assert.equal(view.validation[0].code, 'codex-config-projection-only');
  assert.match(view.validation[0].message, /no save\/apply operation is available/);
});

test('deriveGetTokensExtensionCodexConfigDryRunView redacts sensitive preview fields before display', () => {
  const preview = getGetTokensExtensionCodexConfigDryRunPreview();
  preview.sections[1].diffPreview = [
    'token = "plain-token-should-not-render"',
    'headers = { Authorization = "Bearer header-token-should-not-render" }',
    'cookie = "session-cookie-should-not-render"',
  ];
  preview.operations[1].preview = 'api_token = "api-token-should-not-render"';
  preview.operations[1].patchPlan.beforeSnippet = [
    '[mcp_servers.com-example-openai-metadata-catalog-openai]',
    'Authorization = "Bearer authorization-token-should-not-render"',
    'bearer_token = "bearer-token-should-not-render"',
    'bearer_token_env_var = "OPENAI_MCP_TOKEN"',
  ].join('\n');
  preview.operations[1].patchPlan.afterSnippet = 'Cookie = "after-cookie-should-not-render"';
  preview.validation[1].message = 'token plain-validation-token-should-not-render';

  const view = deriveGetTokensExtensionCodexConfigDryRunView(preview);
  const renderedText = JSON.stringify(view);

  for (const leaked of [
    'plain-token-should-not-render',
    'header-token-should-not-render',
    'session-cookie-should-not-render',
    'api-token-should-not-render',
    'authorization-token-should-not-render',
    'bearer-token-should-not-render',
    'after-cookie-should-not-render',
    'plain-validation-token-should-not-render',
  ]) {
    assert.doesNotMatch(renderedText, new RegExp(leaked));
  }
  assert.deepEqual(view.sections[1].diffPreview, [
    'token = "<redacted>"',
    'headers = "<redacted>"',
    'cookie = "<redacted>"',
  ]);
  assert.match(view.operations[1].preview, /api_token = "<redacted>"/);
  assert.match(view.operations[1].patchPlan.beforeSnippet, /Authorization = "<redacted>"/);
  assert.match(view.operations[1].patchPlan.beforeSnippet, /bearer_token = "<redacted>"/);
  assert.match(view.operations[1].patchPlan.beforeSnippet, /bearer_token_env_var = "OPENAI_MCP_TOKEN"/);
  assert.match(view.operations[1].patchPlan.afterSnippet, /Cookie = "<redacted>"/);
  assert.equal(view.validation[1].message, '<redacted> <redacted>');
});

test('deriveGetTokensExtensionCodexConfigStagedApplyView blocks unsafe or non-runtime apply', () => {
  const noRuntime = deriveGetTokensExtensionCodexConfigStagedApplyView({
    runtimeAvailable: false,
    targetPath: '/tmp/gettokens-extension-codex-config-staged-preview.toml',
    tempDir: '/tmp',
    operationCount: 2,
    validationErrorCount: 0,
  });
  assert.equal(noRuntime.status, 'blocked');
  assert.equal(noRuntime.enabledPrepare, false);
  assert.equal(noRuntime.enabledApply, false);
  assert.match(noRuntime.disabledReason, /Wails runtime/);

  const realConfig = deriveGetTokensExtensionCodexConfigStagedApplyView({
    runtimeAvailable: true,
    targetPath: '~/.codex/config.toml',
    tempDir: '/tmp',
    operationCount: 2,
    validationErrorCount: 0,
  });
  assert.equal(realConfig.status, 'blocked');
  assert.match(realConfig.disabledReason, /real ~\/\.codex\/config\.toml is blocked/);

  const validationBlocked = deriveGetTokensExtensionCodexConfigStagedApplyView({
    runtimeAvailable: true,
    targetPath: '/tmp/gettokens-extension-codex-config-staged-preview.toml',
    tempDir: '/tmp',
    operationCount: 2,
    validationErrorCount: 1,
  });
  assert.equal(validationBlocked.status, 'blocked');
  assert.match(validationBlocked.disabledReason, /validation errors/);
});

test('deriveGetTokensExtensionCodexConfigStagedApplyView exposes prepare apply and rollback state', () => {
  const ready = deriveGetTokensExtensionCodexConfigStagedApplyView({
    runtimeAvailable: true,
    targetPath: '/tmp/gettokens-extension-codex-config-staged-preview.toml',
    tempDir: '/tmp',
    operationCount: 2,
    validationErrorCount: 0,
  });
  assert.equal(ready.status, 'ready');
  assert.equal(ready.enabledPrepare, true);
  assert.equal(ready.enabledApply, false);

  const prepared = deriveGetTokensExtensionCodexConfigStagedApplyView({
    runtimeAvailable: true,
    targetPath: '/tmp/gettokens-extension-codex-config-staged-preview.toml',
    tempDir: '/tmp',
    operationCount: 2,
    validationErrorCount: 0,
    plan: {
      confirmationToken: 'confirm-test-token',
      diffPreview: ['token = "secret-token-should-redact"'],
      appliedOperations: ['skills.config:append'],
    },
  });
  assert.equal(prepared.status, 'prepared');
  assert.equal(prepared.enabledApply, true);
  assert.match(prepared.confirmationLabel, /confirm-test-token/);
  assert.deepEqual(prepared.diffPreview, ['token = "<redacted>"']);
  assert.deepEqual(prepared.appliedOperations, ['skills.config:append']);

  const failed = deriveGetTokensExtensionCodexConfigStagedApplyView({
    runtimeAvailable: true,
    targetPath: '/tmp/gettokens-extension-codex-config-staged-preview.toml',
    tempDir: '/tmp',
    operationCount: 2,
    validationErrorCount: 0,
    result: {
      status: 'failed',
      rolledBack: true,
      errorStage: 'verify',
      appliedOperations: ['skills.config:append'],
    },
  });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.resultLabel, 'failed');
  assert.match(failed.rollbackLabel, /rolledBack=true stage=verify/);
});
