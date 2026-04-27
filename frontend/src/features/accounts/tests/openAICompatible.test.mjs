import test from 'node:test';
import assert from 'node:assert/strict';

import {
  emptyOpenAICompatibleProviderForm,
  maskProviderAPIKey,
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
