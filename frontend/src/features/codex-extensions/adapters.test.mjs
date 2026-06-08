import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('adapter preserves backend diagnostic transports instead of coercing them to stdio', async () => {
  const adapterSource = await readFile(new URL('./adapters.ts', import.meta.url), 'utf8');

  assert.match(adapterSource, /normalizeMcpTransport\(server\.transport\)/);
  assert.match(adapterSource, /value === 'conflict'/);
  assert.match(adapterSource, /value === 'unknown'/);
  assert.match(adapterSource, /normalizeMcpStatus\(server\.status\)/);
  assert.match(adapterSource, /value === 'error'/);
  assert.match(adapterSource, /isEditableMcpTransport\(server\.transport\)/);
  assert.doesNotMatch(adapterSource, /server\.transport === 'streamable_http' \? 'streamable_http' : 'stdio'/);
});

test('adapter maps skill scan warnings from backend records', async () => {
  const adapterSource = await readFile(new URL('./adapters.ts', import.meta.url), 'utf8');

  assert.match(adapterSource, /warnings:\s*\[\.\.\.\(extendedSkill\.warnings \|\| \[\]\)\]/);
});
