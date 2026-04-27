import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildHeadersMap,
  buildHeaderRows,
  buildModelRows,
  buildOpenAICompatibleProviderDraft,
  emptyOpenAICompatibleProviderForm,
  maskProviderAPIKey,
  normalizeProviderAPIKeys,
  normalizeProviderModels,
  renameProviderVerifyState,
} from '../model/openAICompatible.ts';

test('maskProviderAPIKey keeps short keys and masks long keys', () => {
  assert.equal(maskProviderAPIKey(''), '—');
  assert.equal(maskProviderAPIKey('sk-1234'), 'sk-1234');
  assert.equal(maskProviderAPIKey('sk-1234567890'), 'sk-1...7890');
});

test('emptyOpenAICompatibleProviderForm starts with blank fields', () => {
  assert.deepEqual(emptyOpenAICompatibleProviderForm, {
    name: '',
    baseUrl: '',
    prefix: '',
    apiKey: '',
  });
});

test('buildOpenAICompatibleProviderDraft keeps editable provider basics and verify model', () => {
  assert.deepEqual(
    buildOpenAICompatibleProviderDraft(
      {
        name: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        prefix: 'team-a',
        apiKey: 'sk-test',
        models: [{ name: 'deepseek-chat', alias: 'chat' }],
      },
    ),
    {
      currentName: 'deepseek',
      name: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      prefix: 'team-a',
      apiKey: 'sk-test',
      apiKeys: ['sk-test'],
      headers: [{ key: '', value: '' }],
      models: [{ name: 'deepseek-chat', alias: 'chat' }],
      verifyModel: 'deepseek-chat',
    },
  );
});

test('buildOpenAICompatibleProviderDraft prefers cached verify model when present', () => {
  assert.equal(
    buildOpenAICompatibleProviderDraft(
      {
        name: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        prefix: 'team-a',
        apiKey: 'sk-test',
        models: [{ name: 'deepseek-chat', alias: 'chat' }],
      },
      {
        model: 'deepseek-reasoner',
        status: 'success',
        message: 'ok',
        lastVerifiedAt: 123,
      },
    ).verifyModel,
    'deepseek-reasoner',
  );
});

test('renameProviderVerifyState moves cached state to the new provider name', () => {
  const states = {
    deepseek: {
      model: 'deepseek-chat',
      status: 'success',
      message: 'ok',
      lastVerifiedAt: 123,
    },
  };

  assert.deepEqual(renameProviderVerifyState(states, 'deepseek', 'deepseek-prod'), {
    'deepseek-prod': {
      model: 'deepseek-chat',
      status: 'success',
      message: 'ok',
      lastVerifiedAt: 123,
    },
  });
});

test('normalizeProviderAPIKeys trims blanks and removes duplicates', () => {
  assert.deepEqual(normalizeProviderAPIKeys([' sk-a ', '', 'sk-b', 'sk-a', '   ']), ['sk-a', 'sk-b']);
});

test('buildHeaderRows and buildHeadersMap convert between map and editable rows', () => {
  assert.deepEqual(buildHeaderRows({ Authorization: 'Bearer sk-test', 'X-Team': 'team-a' }), [
    { key: 'Authorization', value: 'Bearer sk-test' },
    { key: 'X-Team', value: 'team-a' },
  ]);

  assert.deepEqual(
    buildHeadersMap([
      { key: ' Authorization ', value: ' Bearer sk-test ' },
      { key: '', value: 'ignored' },
      { key: 'X-Team', value: 'team-a' },
    ]),
    {
      Authorization: 'Bearer sk-test',
      'X-Team': 'team-a',
    },
  );
});

test('buildModelRows and normalizeProviderModels keep editable model aliases', () => {
  assert.deepEqual(buildModelRows([{ name: 'deepseek-chat', alias: 'chat' }]), [
    { name: 'deepseek-chat', alias: 'chat' },
  ]);

  assert.deepEqual(
    normalizeProviderModels([
      { name: ' deepseek-chat ', alias: ' chat ' },
      { name: '', alias: 'ignored' },
      { name: 'deepseek-chat', alias: 'dup' },
      { name: 'deepseek-reasoner', alias: '' },
    ]),
    [
      { name: 'deepseek-chat', alias: 'chat' },
      { name: 'deepseek-reasoner', alias: '' },
    ],
  );
});
