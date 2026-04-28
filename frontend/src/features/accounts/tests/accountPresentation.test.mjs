import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAccountStabilitySummary,
  isCodexAuthFile,
  isCodexReauthEligible,
  mapBackendAccountRecord,
  mapAuthFileToRecord,
  resolveAccountAPIKeyPlainNotice,
  resolveAccountConfigurationWorkspaceHeading,
  resolveAccountFailureReason,
  resolveAccountOperationalState,
  resolveAccountProviderConfigHeading,
  resolveAccountStatusTone,
  resolveAccountSourceHeading,
} from '../model/accountPresentation.ts';

test('mapAuthFileToRecord keeps auth file status message', () => {
  const record = mapAuthFileToRecord({
    name: 'broken.json',
    provider: 'codex',
    status: 'error',
    statusMessage: 'refresh token expired',
  });

  assert.equal(record.status, 'ERROR');
  assert.equal(record.statusMessage, 'refresh token expired');
});

test('mapBackendAccountRecord keeps backend display name for api keys', () => {
  const record = mapBackendAccountRecord({
    id: 'codex-api-key:test',
    provider: 'codex',
    credentialSource: 'api-key',
    displayName: 'PRIMARY PROD KEY',
    status: 'ACTIVE',
    apiKey: 'sk-test',
    baseUrl: 'https://api.openai.com/v1',
    prefix: '',
  });

  assert.equal(record.displayName, 'PRIMARY PROD KEY');
});

test('resolveAccountFailureReason only returns message for failed statuses', () => {
  assert.equal(
    resolveAccountFailureReason({
      id: 'auth-file:broken',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'broken.json',
      status: 'ERROR',
      statusMessage: 'refresh token expired',
    }),
    'refresh token expired'
  );

  assert.equal(
    resolveAccountFailureReason({
      id: 'auth-file:healthy',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'healthy.json',
      status: 'ACTIVE',
      statusMessage: 'should stay hidden',
    }),
    ''
  );
});

test('isCodexReauthEligible only allows failed codex auth-file accounts', () => {
  assert.equal(
    isCodexReauthEligible({
      id: 'auth-file:expired',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'expired.json',
      name: 'expired.json',
      status: 'ERROR',
    }),
    true
  );

  assert.equal(
    isCodexReauthEligible({
      id: 'auth-file:healthy',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'healthy.json',
      name: 'healthy.json',
      status: 'ACTIVE',
    }),
    false
  );

  assert.equal(
    isCodexReauthEligible({
      id: 'api-key:codex',
      provider: 'codex',
      credentialSource: 'api-key',
      displayName: 'CODEX API KEY',
      status: 'ERROR',
    }),
    false
  );
});

test('isCodexAuthFile allows any codex auth-file with a file name', () => {
  assert.equal(
    isCodexAuthFile({
      id: 'auth-file:healthy',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'healthy.json',
      name: 'healthy.json',
      status: 'ACTIVE',
    }),
    true
  );

  assert.equal(
    isCodexAuthFile({
      id: 'api-key:codex',
      provider: 'codex',
      credentialSource: 'api-key',
      displayName: 'CODEX API KEY',
      status: 'ACTIVE',
    }),
    false
  );
});

test('buildAccountStabilitySummary prefers failure reason and falls back to placeholder states', () => {
  const t = (key) => key;

  assert.deepEqual(
    buildAccountStabilitySummary(
      {
        id: 'auth-file:broken',
        provider: 'codex',
        credentialSource: 'auth-file',
        displayName: 'broken.json',
        status: 'ERROR',
        statusMessage: 'refresh token expired',
      },
      {
        status: 'success',
        planType: '',
        windows: [{ id: 'month', label: 'MONTH', remainingPercent: 80, usedLabel: '', resetLabel: '' }],
      },
      t
    ),
    {
      title: 'accounts.stability_attention_title',
      body: 'refresh token expired',
      tone: 'warning',
    }
  );

  assert.deepEqual(
    buildAccountStabilitySummary(
      {
        id: 'auth-file:healthy',
        provider: 'codex',
        credentialSource: 'auth-file',
        displayName: 'healthy.json',
        status: 'ACTIVE',
      },
      {
        status: 'success',
        planType: '',
        windows: [{ id: 'month', label: 'MONTH', remainingPercent: 80, usedLabel: '', resetLabel: '' }],
      },
      t
    ),
    {
      title: 'accounts.stability_ready_title',
      body: 'accounts.stability_ready_body',
      tone: 'positive',
    }
  );

  assert.deepEqual(
    buildAccountStabilitySummary(
      {
        id: 'api-key:codex',
        provider: 'codex',
        credentialSource: 'api-key',
        displayName: 'CODEX API KEY',
        status: 'ACTIVE',
      },
      {
        status: 'unsupported',
        planType: '',
        windows: [],
      },
      t
    ),
    {
      title: 'accounts.stability_placeholder_title',
      body: 'accounts.stability_placeholder_body',
      tone: 'neutral',
    }
  );
});

test('account detail headings keep explicit provider scope', () => {
  const t = (key) =>
    ({
      'accounts.source_api_key_with_provider': '{provider} API KEY',
      'accounts.provider_config_with_provider': '{provider} Provider Config',
      'accounts.configuration_workspace_with_provider': '{provider} Config Workspace',
      'accounts.api_key_plain_notice_with_provider': 'This panel shows the {provider} API key in plain text.',
    })[key] || key;

  const account = {
    id: 'api-key:codex',
    provider: 'codex',
    credentialSource: 'api-key',
    displayName: 'CODEX API KEY',
    status: 'ACTIVE',
  };

  assert.equal(resolveAccountSourceHeading(account, t), 'CODEX API KEY');
  assert.equal(resolveAccountProviderConfigHeading(account, t), 'CODEX Provider Config');
  assert.equal(resolveAccountConfigurationWorkspaceHeading(account, t), 'CODEX Config Workspace');
  assert.equal(resolveAccountAPIKeyPlainNotice(account, t), 'This panel shows the CODEX API key in plain text.');
});

test('resolveAccountStatusTone treats configured api keys as healthy', () => {
  assert.equal(
    resolveAccountStatusTone({
      id: 'api-key:codex',
      provider: 'codex',
      credentialSource: 'api-key',
      displayName: 'CODEX API KEY',
      status: 'CONFIGURED',
    }),
    'positive',
  );

  assert.equal(
    resolveAccountStatusTone({
      id: 'api-key:codex',
      provider: 'codex',
      credentialSource: 'api-key',
      displayName: 'CODEX API KEY',
      status: 'DISABLED',
    }),
    'warning',
  );

  assert.equal(
    resolveAccountStatusTone({
      id: 'api-key:codex',
      provider: 'codex',
      credentialSource: 'api-key',
      displayName: 'CODEX API KEY',
      status: 'ERROR',
    }),
    'danger',
  );
});

test('resolveAccountOperationalState prefers recent usage and falls back to waiting-check', () => {
  const t = (key) =>
    ({
      'accounts.status_available': '可用',
      'accounts.status_waiting_check': '等待检测',
      'accounts.status_disabled_display': '已禁用',
      'accounts.status_error_display': '异常',
      'accounts.status_local': '本地草稿',
    })[key] || key;

  assert.deepEqual(
    resolveAccountOperationalState(
      {
        id: 'api-key:codex',
        provider: 'codex',
        credentialSource: 'api-key',
        displayName: 'CODEX API KEY',
        status: 'CONFIGURED',
      },
      {
        hasData: true,
        success: 3,
        failure: 0,
        successRate: 100,
        averageLatencyMs: 120,
        lastActivityAt: Date.now(),
        statusBar: { blocks: [], blockDetails: [], successRate: 100, totalSuccess: 3, totalFailure: 0 },
      },
      undefined,
      t,
    ),
    { tone: 'positive', label: '可用' },
  );

  assert.deepEqual(
    resolveAccountOperationalState(
      {
        id: 'api-key:codex',
        provider: 'codex',
        credentialSource: 'api-key',
        displayName: 'CODEX API KEY',
        status: 'CONFIGURED',
      },
      undefined,
      undefined,
      t,
    ),
    { tone: 'warning', label: '等待检测' },
  );

  assert.deepEqual(
    resolveAccountOperationalState(
      {
        id: 'api-key:codex',
        provider: 'codex',
        credentialSource: 'api-key',
        displayName: 'CODEX API KEY',
        status: 'ERROR',
      },
      {
        hasData: true,
        success: 0,
        failure: 2,
        successRate: 0,
        averageLatencyMs: null,
        lastActivityAt: Date.now(),
        statusBar: { blocks: [], blockDetails: [], successRate: 0, totalSuccess: 0, totalFailure: 2 },
      },
      undefined,
      t,
    ),
    { tone: 'danger', label: '异常' },
  );
});

test('resolveAccountOperationalState treats oauth accounts with quota data as available', () => {
  const t = (key) =>
    ({
      'accounts.status_available': '可用',
      'accounts.status_waiting_check': '等待检测',
      'accounts.status_disabled_display': '已禁用',
      'accounts.status_error_display': '异常',
      'accounts.status_local': '本地草稿',
    })[key] || key;

  assert.deepEqual(
    resolveAccountOperationalState(
      {
        id: 'auth-file:codex',
        provider: 'codex',
        credentialSource: 'auth-file',
        displayName: 'codex.json',
        status: 'ACTIVE',
      },
      undefined,
      {
        status: 'success',
        planType: 'PLUS',
        windows: [{ id: 'weekly', label: 'WEEKLY', remainingPercent: 80, usedLabel: '20%', resetLabel: 'soon' }],
      },
      t,
    ),
    { tone: 'positive', label: '可用' },
  );
});
