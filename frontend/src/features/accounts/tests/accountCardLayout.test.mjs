import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  countRenderedGridColumns,
  shouldEqualizeAccountCardGrid,
} from '../model/accountCardLayout.ts';

test('countRenderedGridColumns counts expanded CSS grid tracks', () => {
  assert.equal(countRenderedGridColumns('556px'), 1);
  assert.equal(countRenderedGridColumns('348px 348px 348px'), 3);
  assert.equal(countRenderedGridColumns('minmax(0px, 1fr) minmax(0px, 1fr)'), 2);
  assert.equal(countRenderedGridColumns('none'), 0);
});

test('shouldEqualizeAccountCardGrid only equalizes actual multi-column card grids', () => {
  assert.equal(shouldEqualizeAccountCardGrid('556px', 6), false);
  assert.equal(shouldEqualizeAccountCardGrid('348px 348px 348px', 6), true);
  assert.equal(shouldEqualizeAccountCardGrid('348px 348px 348px', 1), false);
});

test('account card grids keep empty tracks so single-card groups match page card width', async () => {
  const styleSource = await readFile(new URL('../../../style.css', import.meta.url), 'utf8');

  assert.match(
    styleSource,
    /\.account-card-grid-full\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,/s,
  );
  assert.match(
    styleSource,
    /\.account-card-grid-compact\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,/s,
  );
});

test('quota bars render reset time from quota windows', async () => {
  const source = await readFile(new URL('../components/CardSections.tsx', import.meta.url), 'utf8');

  assert.match(source, /formatQuotaResetDisplayWithUnix\(window\.resetLabel,\s*window\.resetAtUnix\)/);
  assert.match(source, /t\('accounts\.quota_reset'\)/);
});
