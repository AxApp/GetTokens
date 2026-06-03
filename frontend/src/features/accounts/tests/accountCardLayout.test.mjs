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

test('account card grids use page-level fixed card widths instead of equal-width tracks', async () => {
  const styleSource = await readFile(new URL('../../../style.css', import.meta.url), 'utf8');

  assert.match(styleSource, /--account-card-grid-full-width:\s*20rem/);
  assert.match(styleSource, /--account-card-grid-compact-width:\s*18rem/);
  assert.match(
    styleSource,
    /\.account-card-grid-full\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*var\(--account-card-grid-full-width\)\),\s*var\(--account-card-grid-full-width\)\)\)/s,
  );
  assert.match(
    styleSource,
    /\.account-card-grid-compact\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*var\(--account-card-grid-compact-width\)\),\s*var\(--account-card-grid-compact-width\)\)\)/s,
  );
  assert.match(styleSource, /\.account-card-grid-full\s*\{[^}]*justify-content:\s*start/s);
  assert.match(styleSource, /\.account-card-grid-compact\s*\{[^}]*justify-content:\s*start/s);
  assert.doesNotMatch(styleSource, /\.account-card-grid-full\s*\{[^}]*repeat\(auto-fill,/s);
  assert.doesNotMatch(styleSource, /\.account-card-grid-compact\s*\{[^}]*repeat\(auto-fill,/s);
  assert.doesNotMatch(styleSource, /\.account-card-grid-full\s*\{[^}]*minmax\([^;{]*,\s*1fr\)/s);
  assert.doesNotMatch(styleSource, /\.account-card-grid-compact\s*\{[^}]*minmax\([^;{]*,\s*1fr\)/s);
});

test('list density keeps only the plan badge before metrics and actions', async () => {
  const source = await readFile(new URL('../components/AttributionCard.tsx', import.meta.url), 'utf8');
  const sectionsSource = await readFile(new URL('../components/CardSections.tsx', import.meta.url), 'utf8');
  const styleSource = await readFile(new URL('../../../style.css', import.meta.url), 'utf8');

  assert.match(source, /account-card-list-identity/);
  assert.match(source, /account-card-list-status/);
  assert.match(source, /account-card-list-endpoint/);
  assert.match(source, /badges\.find\(\(badge\) => badge\.backgroundColor\)/);
  assert.match(source, /join\(' · '\)/);
  assert.match(source, /formatCountMetric\(usageSummary\?\.requestCount \?\? 0\)/);
  assert.match(source, /formatTokenMetric\(usageSummary\?\.totalTokens \?\? 0\)/);
  assert.match(source, /quotaDisplay\?\.status === 'unsupported'/);
  assert.doesNotMatch(source, /AccountMiniMetrics usageSummary=\{usageSummary\}/);
  assert.doesNotMatch(source, /account-card-list-metrics/);
  assert.doesNotMatch(source, /account-card-list-badges/);
  assert.match(styleSource, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto/);
  assert.doesNotMatch(styleSource, /\.account-card-list-row\s*\{[^}]*minmax\(18rem,\s*1\.35fr\)/s);
  assert.match(sectionsSource, /account-card-list-metric-cell/);
  assert.match(sectionsSource, /first:border-l-0/);
});

test('quota bars render reset time from quota windows', async () => {
  const source = await readFile(new URL('../components/CardSections.tsx', import.meta.url), 'utf8');

  assert.match(source, /formatQuotaResetDisplayWithUnix\(window\.resetLabel,\s*window\.resetAtUnix\)/);
  assert.match(source, /t\('accounts\.quota_reset'\)/);
});

test('quota bars surface stale runtime error reason on cards and details', async () => {
  const source = await readFile(new URL('../components/CardSections.tsx', import.meta.url), 'utf8');

  assert.match(source, /formatQuotaRuntimeWarning\(quotaDisplay\)/);
  assert.match(source, /data-account-quota-runtime-warning/);
  assert.match(source, /quotaDisplay\.degradedReason/);
  assert.match(source, /quotaDisplay\.stale/);
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
  assert.match(source, /className=\{`grid gap-2\.5 border-b border-dashed/);
  assert.match(source, /className="account-card-quota-row grid min-w-0 gap-1\.5"/);
  assert.doesNotMatch(styleSource, /\.account-card-quota-row\s*\{[^}]*grid-template-columns:\s*4\.25rem/s);
});


test('full attribution cards group traffic and usage statistics in one module component', async () => {
  const cardSource = await readFile(new URL('../components/AttributionCard.tsx', import.meta.url), 'utf8');
  const sectionsSource = await readFile(new URL('../components/CardSections.tsx', import.meta.url), 'utf8');

  assert.match(sectionsSource, /export function TrafficMetricsModule\(\{ usageSummary, t \}: TrafficMetricsModuleProps\)/);
  assert.match(sectionsSource, /account-card-traffic-module/);
  assert.match(sectionsSource, /<TrafficSection usageSummary=\{usageSummary\} t=\{t\} embedded \/>/);
  assert.match(sectionsSource, /<UsageMetrics usageSummary=\{usageSummary\} t=\{t\} embedded \/>/);
  assert.match(cardSource, /TrafficMetricsModule usageSummary=\{usageSummary\} t=\{t\}/);
  assert.doesNotMatch(cardSource, /<TrafficSection usageSummary=\{usageSummary\} t=\{t\} \/>[\s\S]*<UsageMetrics usageSummary=\{usageSummary\} t=\{t\} \/>/);
});

test('quota bars can toggle from percent to token progress when token counts exist', async () => {
  const source = await readFile(new URL('../components/CardSections.tsx', import.meta.url), 'utf8');

  assert.match(source, /useState<QuotaBarsDisplayMode>\('percent'\)/);
  assert.match(source, /data-quota-display-mode=\{displayMode\}/);
  assert.match(source, /onClick=\{hasTokenProgress \? handleToggleDisplayMode : undefined\}/);
  assert.match(source, /onKeyDown=\{hasTokenProgress \? handleToggleDisplayModeKeyDown : undefined\}/);
  assert.match(source, /role=\{hasTokenProgress \? 'button' : undefined\}/);
  assert.match(source, /data-account-card-ignore-click=\{hasTokenProgress \? 'true' : undefined\}/);
  assert.match(source, /setDisplayMode\(\(current\) => current === 'percent' \? 'tokens' : 'percent'\)/);
  assert.match(source, /formatQuotaTokenProgress\(window\)/);
  assert.match(source, /event\.stopPropagation\(\)/);
  assert.doesNotMatch(source, /<button[\s\S]*handleToggleDisplayMode[\s\S]*<\/button>/);
});
