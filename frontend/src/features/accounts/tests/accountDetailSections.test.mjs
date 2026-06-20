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

test('account credential detail editor uses the quiet workspace shell', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const targetSource = [
    sourceBlock(source, 'export function AccountCredentialVerifySection', 'function CapabilityEndpointsPanel'),
    sourceBlock(source, 'function CapabilityEndpointsPanel', 'function CredentialProxyRoutePanel'),
    sourceBlock(source, 'function CredentialProxyRoutePanel', 'function readCredentialProxyNodes'),
    sourceBlock(source, 'function VendorCredentialInputField', 'function readDraftCredentialField'),
    sourceBlock(source, 'function CredentialInputField', 'function VerifyConnectionPanel'),
    sourceBlock(source, 'function VerifyConnectionPanel', 'export function AccountQuotaSection'),
  ].join('\n');

  assert.match(source, /const accountDetailCredentialPaneDividerClass =/);
  assert.match(source, /const accountDetailCredentialSectionTitleClass =/);
  assert.match(source, /const accountDetailCredentialInputClass =/);
  assert.match(source, /const accountDetailCredentialButtonClass =/);
  assert.match(source, /const accountDetailCredentialMenuClass =/);
  assert.match(targetSource, /data-account-credential-verify-layout="quiet-split"/);
  assert.match(targetSource, /data-account-credential-list-item="capability-endpoints"/);
  assert.match(targetSource, /data-account-credential-list-item="connection"/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.doesNotMatch(targetSource, /btn-swiss/);
  assert.doesNotMatch(targetSource, /input-swiss/);
  assert.doesNotMatch(targetSource, /border-2/);
  assert.doesNotMatch(targetSource, /border-t-2/);
  assert.doesNotMatch(targetSource, /border-l-2/);
  assert.doesNotMatch(targetSource, /bg-\[var\(--bg-main\)\]/);
  assert.doesNotMatch(targetSource, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(targetSource, /font-black/);
  assert.doesNotMatch(targetSource, /uppercase/);
  assert.doesNotMatch(targetSource, /tracking-\[0\.12em\]/);
  assert.doesNotMatch(targetSource, /tracking-\[0\.18em\]/);
  assert.doesNotMatch(source, /color-status-/);
  assert.doesNotMatch(targetSource, /shadow-hard|shadow-\[/);
});

test('account quota and billing editors use the quiet workspace shell', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const targetSource = [
    sourceBlock(source, 'export function AccountQuotaSection', 'function OpenAIQuotaResetConfirmationModal'),
    sourceBlock(source, 'export function AccountBillingSection', 'function RuntimeKV'),
    sourceBlock(source, 'function RuntimeKV', 'export function AccountDetailFooter'),
  ].join('\n');

  assert.match(source, /const accountDetailResourcePaneDividerClass =/);
  assert.match(source, /const accountDetailResourceScriptCardClass =/);
  assert.match(source, /const accountDetailResourceButtonClass =/);
  assert.match(source, /const accountDetailResourceHeadingClass =/);
  assert.match(source, /const accountDetailResourceMessageClass =/);
  assert.match(source, /const accountDetailResourceKvLabelClass =/);
  assert.match(targetSource, /data-account-quota-layout=\{layoutMode\}/);
  assert.match(targetSource, /data-account-quota-pane="script"/);
  assert.match(targetSource, /data-account-quota-script-preview="two-line"/);
  assert.match(targetSource, /data-openai-quota-reset-credit-panel="true"/);
  assert.match(targetSource, /AccountCurlEditorModal/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /--gt-status-success/);
  assert.match(source, /--gt-status-danger/);
  assert.doesNotMatch(targetSource, /btn-swiss/);
  assert.doesNotMatch(targetSource, /border-2/);
  assert.doesNotMatch(targetSource, /border-t-2/);
  assert.doesNotMatch(targetSource, /border-l-2/);
  assert.doesNotMatch(targetSource, /border-y border-dashed/);
  assert.doesNotMatch(targetSource, /bg-\[var\(--bg-main\)\]/);
  assert.doesNotMatch(targetSource, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(targetSource, /color-status-/);
  assert.doesNotMatch(targetSource, /font-black/);
  assert.doesNotMatch(targetSource, /uppercase/);
  assert.doesNotMatch(targetSource, /tracking-\[0\.08em\]|tracking-\[0\.18em\]/);
  assert.doesNotMatch(targetSource, /border-dashed/);
  assert.doesNotMatch(targetSource, /shadow-\[/);
});
