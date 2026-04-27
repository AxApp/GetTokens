import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAccountStabilitySummary,
  isCodexAuthFile,
  isCodexReauthEligible,
  mapAuthFileToRecord,
  resolveAccountAPIKeyPlainNotice,
  resolveAccountConfigurationWorkspaceHeading,
  resolveAccountFailureReason,
  resolveAccountProviderConfigHeading,
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
