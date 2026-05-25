import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('AccountsFeature does not expose account rotation orchestration from Account Inventory', async () => {
  const source = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');

  assert.equal(source.includes('AccountRotationModal'), false);
  assert.equal(source.includes('onOpenRotationModal'), false);
  assert.equal(source.includes('setIsRotationModalOpen'), false);
});

test('Accounts page state no longer tracks rotation modal UI state', async () => {
  const source = await readFile(new URL('../hooks/useAccountsPageState.ts', import.meta.url), 'utf8');

  assert.equal(source.includes('isRotationModalOpen'), false);
  assert.equal(source.includes('setIsRotationModalOpen'), false);
});
