import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function sourceBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

test('account detail header and runtime route use the quiet workspace shell', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const targetSource = [
    sourceBlock(source, 'export function AccountDetailHeader', 'function resolveAccountHeaderTypeLabel'),
    sourceBlock(source, 'export function AccountRuntimeRouteSection', 'function resolveRuntimeRouteStatusLabel'),
    sourceBlock(source, 'function RuntimeRouteResilienceEvidenceMarker', 'function formatRouteResilienceLatestEvidenceLabel'),
  ].join('\n');

  assert.match(source, /const accountDetailHeaderShellClass =/);
  assert.match(source, /const accountDetailHeaderRailClass =/);
  assert.match(source, /const accountDetailHeaderPillClass =/);
  assert.match(source, /const accountDetailRuntimeMetaLabelClass =/);
  assert.match(source, /const accountDetailRuntimeDecisionClass =/);
  assert.match(source, /const accountDetailRuntimeEvidenceClass =/);
  assert.match(targetSource, /data-account-detail-header="quiet"/);
  assert.match(targetSource, /data-account-runtime-route-layout="summary"/);
  assert.match(targetSource, /data-account-runtime-route-resilience-marker/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.doesNotMatch(targetSource, /border-2/);
  assert.doesNotMatch(targetSource, /border-r-2/);
  assert.doesNotMatch(targetSource, /bg-\[var\(--bg-main\)\]/);
  assert.doesNotMatch(targetSource, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(targetSource, /font-black/);
  assert.doesNotMatch(targetSource, /uppercase/);
  assert.doesNotMatch(targetSource, /tracking-\[0\.12em\]/);
  assert.doesNotMatch(targetSource, /tracking-\[0\.14em\]/);
  assert.doesNotMatch(targetSource, /tracking-\[0\.18em\]/);
  assert.doesNotMatch(targetSource, /shadow-\[/);
});
