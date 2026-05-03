import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeRelayProviderCatalog } from '../model/relayProviderCatalog.ts';

test('mergeRelayProviderCatalog keeps defaults and merges local codex providers by id', () => {
  const providers = mergeRelayProviderCatalog(
    [
      { id: 'openai', name: 'OpenAI' },
      { id: 'gettokens', name: 'GetTokens' },
    ],
    [
      { id: 'custom-local', name: 'Old Local Name' },
    ],
    [
      { providerID: 'custom-local', providerName: 'Workspace Relay' },
      { providerID: 'corp', providerName: 'Corp Relay' },
    ],
  );

  assert.deepEqual(providers, [
    { id: 'openai', name: 'OpenAI' },
    { id: 'gettokens', name: 'GetTokens' },
    { id: 'custom-local', name: 'Workspace Relay' },
    { id: 'corp', name: 'Corp Relay' },
  ]);
});
