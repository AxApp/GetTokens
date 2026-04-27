import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOpenAICompatibleProviderDraft,
  emptyOpenAICompatibleProviderForm,
  maskProviderAPIKey,
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
      },
      {
        model: 'deepseek-chat',
        status: 'success',
        message: 'ok',
        lastVerifiedAt: 123,
      },
    ),
    {
      currentName: 'deepseek',
      name: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      prefix: 'team-a',
      apiKey: 'sk-test',
      verifyModel: 'deepseek-chat',
    },
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
