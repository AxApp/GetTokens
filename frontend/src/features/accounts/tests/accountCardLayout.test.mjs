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

test('account card full grid uses elastic tracks that can fit additional cards', async () => {
  const styleSource = await readFile(new URL('../../../style.css', import.meta.url), 'utf8');

  assert.match(styleSource, /--account-card-grid-full-min-width:\s*18rem/);
  assert.match(
    styleSource,
    /\.account-card-grid-full\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(100%,\s*var\(--account-card-grid-full-min-width\)\),\s*1fr\)\)/s,
  );
  assert.match(styleSource, /\.account-card-grid-full\s*\{[^}]*justify-content:\s*start/s);
  assert.doesNotMatch(styleSource, /--account-card-grid-full-width:\s*20rem/);
  assert.doesNotMatch(styleSource, /account-card-grid-compact|--account-card-grid-compact-width/);
});

test('account card frame does not render a tone-colored side border', async () => {
  const source = await readFile(new URL('../components/AttributionCard.tsx', import.meta.url), 'utf8');
  const toneSource = await readFile(new URL('../components/attributionCardTone.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /ATTRIBUTION_CARD_TONE_BORDER_CLASS/);
  assert.doesNotMatch(source, /border-l-\[\d+px\]/);
  assert.doesNotMatch(toneSource, /border-l-\[var\(--gt-status-/);
  assert.doesNotMatch(toneSource, /border-l-\[var\(--gt-border-default\)\]/);
  assert.match(source, /const tintClass = ATTRIBUTION_CARD_TONE_TINT_CLASS\[tone\];/);
  assert.match(source, /className=\{`min-h-\[4\.5rem\] p-0 \$\{tintClass\} \$\{className\}`\}/);
  assert.match(source, /className=\{`p-0 \$\{tintClass\} \$\{className\}`\}/);
});

test('account cards render a subtle status edge tint', async () => {
  const source = await readFile(new URL('../components/AttributionCard.tsx', import.meta.url), 'utf8');
  const toneSource = await readFile(new URL('../components/attributionCardTone.ts', import.meta.url), 'utf8');
  const styleSource = await readFile(new URL('../../../style.css', import.meta.url), 'utf8');

  assert.match(source, /ATTRIBUTION_CARD_TONE_TINT_CLASS/);
  assert.match(toneSource, /positive: 'account-card-status-tint account-card-status-tint-positive'/);
  assert.match(toneSource, /warning: 'account-card-status-tint account-card-status-tint-warning'/);
  assert.match(toneSource, /critical: 'account-card-status-tint account-card-status-tint-critical'/);
  const tintBlock = styleSource.match(/\[data-account-card\]\.account-card-status-tint\s*\{[\s\S]*?\n\s*\}/)?.[0] || '';
  assert.match(tintBlock, /box-shadow:\s*inset 3px 0 0/);
  assert.match(tintBlock, /background-color:\s*color-mix\(in srgb, var\(--account-card-status-accent\) 3%, var\(--gt-surface-canvas\)\)/);
  assert.doesNotMatch(tintBlock, /radial-gradient|linear-gradient/);
  assert.doesNotMatch(styleSource, /account-card-status-glow/);
  assert.match(styleSource, /\[data-account-card\]\.account-card-status-tint-positive\s*\{[^}]*--account-card-status-accent:\s*var\(--gt-status-success\)/s);
  assert.match(styleSource, /\[data-account-card\]\.account-card-status-tint-warning\s*\{[^}]*--account-card-status-accent:\s*var\(--gt-status-warning\)/s);
  assert.match(styleSource, /\[data-account-card\]\.account-card-status-tint-critical\s*\{[^}]*--account-card-status-accent:\s*var\(--gt-status-danger\)/s);
});

test('full account card subtitle renders as its own header row', async () => {
  const source = await readFile(new URL('../components/AttributionCard.tsx', import.meta.url), 'utf8');
  const fullSource = source.split('// ── Full density ──')[1] || '';

  assert.match(fullSource, /<div className="account-card-meta-action-row -mr-4 grid min-w-0 grid-cols-\[minmax\(0,1fr\)_auto\] items-center gap-2">[\s\S]*\{topActions \? <div className="col-start-2 shrink-0 justify-self-end">\{topActions\}<\/div> : null\}\s*<\/div>\s*\) : null\}\s*<div className="flex items-center gap-2">/);
  assert.match(fullSource, /<div className="flex items-center gap-2">[\s\S]*<h3[\s\S]*\{title\}[\s\S]*<\/div>\s*<\/div>\s*\{subtitle \? \(/);
  assert.match(source, /className="mt-1\.5 break-all font-mono text-xs text-\[var\(--gt-ink-muted\)\]"/);
  assert.match(source, /className="mt-1\.5 text-xs font-normal text-\[var\(--gt-status-danger\)\]"/);
});

test('full account card tone dot starts the metadata row', async () => {
  const source = await readFile(new URL('../components/AttributionCard.tsx', import.meta.url), 'utf8');
  const fullSource = source.split('// ── Full density ──')[1] || '';

  assert.match(fullSource, /<div[\s\S]*className="account-card-meta-row[^"]*"[\s\S]*>\s*<span className=\{`h-2 w-2 shrink-0 rounded-full \$\{accentFillClass\}`\} \/>/);
  assert.doesNotMatch(fullSource, /\{eyebrow \? <span className="min-w-0 truncate">\{eyebrow\}<\/span> : null\}\s*<span className=\{`h-2 w-2 shrink-0 rounded-full \$\{accentFillClass\}`\} \/>/);
  assert.doesNotMatch(fullSource, /<div className="flex items-center gap-2">\s*<span className=\{`h-2 w-2 shrink-0 rounded-full \$\{accentFillClass\}`\} \/>/);
});

test('full account card badges share the eyebrow metadata row', async () => {
  const source = await readFile(new URL('../components/AttributionCard.tsx', import.meta.url), 'utf8');
  const fullSource = source.split('// ── Full density ──')[1] || '';

  assert.match(fullSource, /eyebrow \|\| eyebrowPrefix \|\| priorityBadges\.length > 0/);
  assert.match(fullSource, /className="account-card-meta-row col-start-1 flex min-w-0 flex-nowrap items-center gap-x-1\.5 overflow-hidden font-mono text-\[length:var\(--gt-font-size-sm-plus\)\] font-semibold leading-none text-\[var\(--gt-ink-muted\)\]"/);
  assert.match(fullSource, /\{eyebrow \? <span className="min-w-0 truncate">\{eyebrow\}<\/span> : null\}\s*\{priorityBadges\.length > 0 \? \(\s*<div className="account-card-meta-badges flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden">/s);
  assert.match(source, /import \{ Tag \} from 'antd'/);
  assert.match(fullSource, /<Tag[\s\S]*data-account-card-badge-priority=\{resolveAttributionCardBadgePriority\(badge\)\}/);
  assert.match(fullSource, /className="m-0 shrink-0 truncate"/);
  assert.doesNotMatch(fullSource, /<div className="mt-2 flex flex-wrap gap-1">/);
  assert.doesNotMatch(fullSource, /\{topActions \? <div className="-mr-4 shrink-0 pl-4">\{topActions\}<\/div> : null\}/);
});

test('full account card metadata tags use priority order and hide low priority tags first', async () => {
  const source = await readFile(new URL('../components/AttributionCard.tsx', import.meta.url), 'utf8');
  const styleSource = await readFile(new URL('../../../style.css', import.meta.url), 'utf8');

  assert.match(source, /function resolveAttributionCardBadgePriority\(badge: AttributionCardBadge\)/);
  assert.match(source, /if \(badge\.tone === 'critical'\) return 0;/);
  assert.match(source, /if \(badge\.tone === 'warning'\) return 1;/);
  assert.match(source, /if \(badge\.backgroundColor\) return 2;/);
  assert.match(source, /return 3;/);
  assert.match(source, /const priorityBadges = \[\.\.\.badges\]\.sort\(compareAttributionCardBadges\);/);
  assert.match(source, /data-account-card-badge-priority=\{resolveAttributionCardBadgePriority\(badge\)\}/);
  assert.match(styleSource, /\.account-card-meta-row\s*\{[^}]*container-type:\s*inline-size/s);
  assert.match(styleSource, /@container \(max-width: 176px\)\s*\{[\s\S]*\.account-card-meta-badge\[data-account-card-badge-priority="3"\]\s*\{[^}]*display:\s*none/s);
  assert.match(styleSource, /@container \(max-width: 128px\)\s*\{[\s\S]*\.account-card-meta-badge\[data-account-card-badge-priority="2"\]\s*\{[^}]*display:\s*none/s);
  assert.match(styleSource, /@container \(max-width: 96px\)\s*\{[\s\S]*\.account-card-meta-badge\[data-account-card-badge-priority="1"\]\s*\{[^}]*display:\s*none/s);
});

test('list density keeps only the plan badge before metrics and actions', async () => {
  const source = await readFile(new URL('../components/AttributionCard.tsx', import.meta.url), 'utf8');
  const sectionsSource = await readFile(new URL('../components/CardSections.tsx', import.meta.url), 'utf8');
  const styleSource = await readFile(new URL('../../../style.css', import.meta.url), 'utf8');

  assert.match(source, /const listStatusText = \[/);
  assert.match(source, /className="min-w-0 flex-1 space-y-1"/);
  assert.match(source, /className="min-w-0 truncate font-mono text-xs font-normal text-\[var\(--gt-ink-muted\)\]"/);
  assert.match(source, /priorityBadges\.find\(\(badge\) => badge\.backgroundColor\)/);
  assert.match(source, /join\(' · '\)/);
  assert.match(source, /formatCountMetric\(usageSummary\?\.requestCount \?\? 0\)/);
  assert.match(source, /formatTokenMetric\(usageSummary\?\.totalTokens \?\? 0\)/);
  assert.match(source, /quotaDisplay\?\.status === 'unsupported'/);
  assert.doesNotMatch(source, /AccountMiniMetrics usageSummary=\{usageSummary\}/);
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

test('account cards skip unsupported quota placeholder modules when telemetry is absent', async () => {
  const source = await readFile(new URL('../components/AttributionCard.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /UnsupportedQuotaPlaceholder/);
  assert.match(source, /<QuotaBars quotaDisplay=\{resolvedQuotaDisplay\} t=\{t\} \/>/);
  assert.match(source, /<BillingBalance billing=\{billing\} \/>/);
  assert.match(source, /<RateLimitGuard rateLimitStatus=\{rateLimitStatus\} usageSummary=\{usageSummary\} refreshing=\{rateLimitRefreshing \|\| usageRefreshing\} t=\{t\} \/>/);
});

test('quota bars surface stale runtime error reason on cards and details', async () => {
  const source = await readFile(new URL('../components/CardSections.tsx', import.meta.url), 'utf8');

  assert.match(source, /formatQuotaRuntimeWarning\(quotaDisplay\)/);
  assert.match(source, /data-account-quota-runtime-warning/);
  assert.match(source, /quotaDisplay\.degradedReason/);
  assert.match(source, /quotaDisplay\.stale/);
});

test('quota bars keep sidecar quota fact diagnostics out of normal cards', async () => {
  const source = await readFile(new URL('../components/CardSections.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /QuotaFactEvidenceStrip/);
  assert.doesNotMatch(source, /data-account-quota-fact-evidence/);
  assert.doesNotMatch(source, /FACT \{fact\.state\}/);
  assert.doesNotMatch(source, /fact\.evidenceRefs/);
  assert.doesNotMatch(source, /formatQuotaRuntimeTimestampDisplay\(fact\.observedAt\)/);
  assert.doesNotMatch(source, /formatQuotaRuntimeTimestampDisplay\(fact\.expiresAt\)/);
  assert.doesNotMatch(source, /resolveQuotaFact\(/);
});

test('quota bar fill color is derived only from remaining quota value', async () => {
  const source = await readFile(new URL('../components/CardSections.tsx', import.meta.url), 'utf8');

  assert.equal(resolveQuotaRemainingFillClass(80), 'bg-[var(--gt-status-success)]');
  assert.equal(resolveQuotaRemainingFillClass(50), 'bg-[var(--gt-status-warning)]');
  assert.equal(resolveQuotaRemainingFillClass(20), 'bg-[var(--gt-status-danger)]');
  assert.match(source, /resolveQuotaRemainingFillClass\(window\.remainingPercent\)/);
  assert.doesNotMatch(source, /QuotaBars\(\{ quotaDisplay,\s*accentFillClass/);
});

test('quota percentage progress renders remaining quota for every provider', async () => {
  const source = await readFile(new URL('../components/CardSections.tsx', import.meta.url), 'utf8');

  assert.match(source, /formatQuotaPercent\(window\)/);
  assert.match(source, /:\s*window\.remainingPercent;/);
  assert.doesNotMatch(source, /resolveQuotaWindowPercentProgress/);
  assert.doesNotMatch(source, /formatQuotaWindowUsageLabel\(window\)/);
  assert.doesNotMatch(source, /resolveQuotaWindowUsagePercent\(window\)/);
});

test('quota rows keep label and percentage together above the progress bar', async () => {
  const source = await readFile(new URL('../components/CardSections.tsx', import.meta.url), 'utf8');
  const styleSource = await readFile(new URL('../../../style.css', import.meta.url), 'utf8');

  assert.match(source, /account-card-quota-heading/);
  assert.match(source, /showDivider = true/);
  assert.match(source, /showDivider \? 'border-b border-dashed border-\[var\(--gt-border-subtle\)\]' : ''/);
  assert.match(source, /className="account-card-quota-row grid min-w-0 gap-1\.5"/);
  assert.doesNotMatch(source, /tracking-\[0\.08em\]/, 'account card quota, balance, and rate-limit values must not use wide tracking');
  assert.doesNotMatch(source, /\bfont-black\b/, 'account card quota and balance values must not use heavy brutalist weight');
  assert.doesNotMatch(styleSource, /\.account-card-quota-row\s*\{[^}]*grid-template-columns:\s*4\.25rem/s);
});


test('full attribution cards do not render the retired traffic metrics module', async () => {
  const cardSource = await readFile(new URL('../components/AttributionCard.tsx', import.meta.url), 'utf8');
  const sectionsSource = await readFile(new URL('../components/CardSections.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(sectionsSource, /TrafficMetricsModule|TrafficSection|UsageMetrics|account-card-traffic-module|account-card-usage-metrics/);
  assert.doesNotMatch(sectionsSource, /buildTrafficCurveState|AccountTrafficFlowState|TrafficChart|TrafficSummary/);
  assert.doesNotMatch(cardSource, /TrafficMetricsModule|TrafficSection|UsageMetrics/);
  assert.match(cardSource, /<QuotaBars quotaDisplay=\{resolvedQuotaDisplay\} t=\{t\} \/>/);
  assert.match(cardSource, /<RateLimitGuard rateLimitStatus=\{rateLimitStatus\} usageSummary=\{usageSummary\} refreshing=\{rateLimitRefreshing \|\| usageRefreshing\} t=\{t\} \/>/);
});

test('account card footer only renders the reauth action when required', async () => {
  const attributionSource = await readFile(new URL('../components/AttributionCard.tsx', import.meta.url), 'utf8');
  const cardSource = await readFile(new URL('../components/AccountCard.tsx', import.meta.url), 'utf8');
  const sectionsSource = await readFile(new URL('../components/CardSections.tsx', import.meta.url), 'utf8');
  const styleSource = await readFile(new URL('../../../style.css', import.meta.url), 'utf8');

  assert.match(attributionSource, /footer \? <div className="mt-auto border-t border-\[var\(--gt-border-subtle\)\] px-4 pb-3 pt-2">\{footer\}<\/div> : null/);
  assert.match(cardSource, /const showFooterReauth = showFooterReauthAction && canReauth;/);
  assert.match(cardSource, /density === 'list' \|\| !showFooterReauth \? undefined/);
  assert.match(cardSource, /className="grid gap-2"/);
  assert.match(cardSource, /onClick=\{\(\) => onStartReauth\(account\)\}/);
  assert.doesNotMatch(cardSource, /t\('common\.details'\)/);
  assert.doesNotMatch(cardSource, /account-card-footer-refresh-button/);
  assert.doesNotMatch(sectionsSource, /<section className="grid gap-2\.5 border-b border-dashed border-\[var\(--gt-border-strong\)\] px-4 py-3">/);
  assert.doesNotMatch(cardSource, /actionColumnClass|account-card-action-grid-1|account-card-action-grid-2|account-card-action-grid-3/);
  assert.doesNotMatch(styleSource, /account-card-action-grid|account-card-action-grid-span/);
});

test('account card top action buttons render without inner gap', async () => {
  const cardSource = await readFile(new URL('../components/AccountCard.tsx', import.meta.url), 'utf8');

  assert.match(cardSource, /<div className="flex shrink-0 items-center gap-1" data-account-card-ignore-click="true">/);
  assert.doesNotMatch(cardSource, /className="-mr-4 flex shrink-0 items-center/);
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
