import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  countRenderedGridColumns,
  resolveAccountCardColumnHeights,
  shouldEqualizeAccountCardDisplayMode,
  shouldEqualizeAccountCardGrid,
} from '../model/accountCardLayout.ts';
import { resolveQuotaRemainingFillClass } from '../model/quotaColor.ts';

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

test('shouldEqualizeAccountCardDisplayMode includes side-by-side card layouts only', () => {
  assert.equal(shouldEqualizeAccountCardDisplayMode('full'), true);
  assert.equal(shouldEqualizeAccountCardDisplayMode('compact'), true);
  assert.equal(shouldEqualizeAccountCardDisplayMode('list'), false);
});

test('resolveAccountCardColumnHeights equalizes cards by rendered column', () => {
  assert.deepEqual(
    resolveAccountCardColumnHeights([
      { id: 'left-a', columnLeft: 0, height: 320 },
      { id: 'right-a', columnLeft: 420, height: 280 },
      { id: 'left-b', columnLeft: 0, height: 360 },
      { id: 'right-b', columnLeft: 420, height: 340 },
    ]),
    {
      'left-a': 360,
      'left-b': 360,
      'right-a': 340,
      'right-b': 340,
    },
  );
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

test('quota bar fill color is derived only from remaining quota value', async () => {
  const source = await readFile(new URL('../components/CardSections.tsx', import.meta.url), 'utf8');

  assert.equal(resolveQuotaRemainingFillClass(80), 'bg-[var(--color-status-success)]');
  assert.equal(resolveQuotaRemainingFillClass(50), 'bg-[var(--color-status-warning)]');
  assert.equal(resolveQuotaRemainingFillClass(20), 'bg-[var(--color-status-danger)]');
  assert.match(source, /resolveQuotaRemainingFillClass\(window\.remainingPercent\)/);
  assert.doesNotMatch(source, /QuotaBars\(\{ quotaDisplay,\s*accentFillClass/);
});

test('quota rows keep label and percentage together above the progress bar', async () => {
  const source = await readFile(new URL('../components/CardSections.tsx', import.meta.url), 'utf8');
  const styleSource = await readFile(new URL('../../../style.css', import.meta.url), 'utf8');

  assert.match(source, /account-card-quota-heading/);
  assert.match(source, /className="grid gap-2\.5 border-b/);
  assert.match(source, /className="account-card-quota-row grid min-w-0 gap-1\.5"/);
  assert.doesNotMatch(styleSource, /\.account-card-quota-row\s*\{[^}]*grid-template-columns:\s*4\.25rem/s);
});
