import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('menu bar navigate event opens the accounts frame', async () => {
  const appSource = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');

  assert.match(appSource, /EventsOn\('menubar:navigate'/);
  assert.match(appSource, /payload\?\.page !== 'accounts'/);
  assert.match(appSource, /setActivePage\('accounts'\)/);
  assert.match(appSource, /window\.location\.hash = '#frame=accounts'/);
});
