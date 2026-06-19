import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { buildAccountCardContentText } from '../model/accountCardActions.ts';
import { buildAccountCardRefreshAction } from '../model/accountCardRefresh.ts';
import { shouldOpenAccountDetailsFromTarget } from '../model/accountCardInteractions.ts';

function node(tagName, parentElement = null, dataset) {
  return { tagName, parentElement, dataset };
}

function sourceBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing source block start: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, `missing source block end: ${endMarker}`);
  return source.slice(start, end);
}

test('shouldOpenAccountDetailsFromTarget allows plain card body clicks', () => {
  const card = node('div');
  const content = node('div', card);

  assert.equal(shouldOpenAccountDetailsFromTarget(content, card), true);
});

test('shouldOpenAccountDetailsFromTarget allows direct account card frame clicks', () => {
  const card = node('div');

  assert.equal(shouldOpenAccountDetailsFromTarget(card, card), true);
});

test('shouldOpenAccountDetailsFromTarget ignores direct interactive elements', () => {
  const card = node('div');
  const button = node('button', card);

  assert.equal(shouldOpenAccountDetailsFromTarget(button, card), false);
});

test('shouldOpenAccountDetailsFromTarget ignores nested elements inside buttons', () => {
  const card = node('div');
  const button = node('button', card);
  const icon = node('span', button);

  assert.equal(shouldOpenAccountDetailsFromTarget(icon, card), false);
});

test('shouldOpenAccountDetailsFromTarget respects explicit ignore markers', () => {
  const card = node('div');
  const wrapper = node('div', card, { accountCardIgnoreClick: 'true' });
  const inner = node('span', wrapper);

  assert.equal(shouldOpenAccountDetailsFromTarget(inner, card), false);
});

test('buildAccountCardContentText returns structured account summary json', () => {
  const content = buildAccountCardContentText({
    id: 'acct_stable_001',
    accountKind: 'codex-api-key',
    provider: 'codex',
    credentialSource: 'api-key',
    displayName: 'Primary API Key',
    status: 'configured',
    apiKey: 'sk-test-1111',
    baseUrl: 'https://api.openai.com/v1',
    prefix: 'team-a',
  });

  assert.deepEqual(JSON.parse(content), {
    schema: 'gettokens.account-card.v1',
    credentialSource: 'api-key',
    account: {
      id: 'acct_stable_001',
      provider: 'codex',
      displayName: 'Primary API Key',
      status: 'configured',
      disabled: false,
      localOnly: false,
    },
    codexAPIKey: {
      label: 'Primary API Key',
      apiKey: 'sk-test-1111',
      baseUrl: 'https://api.openai.com/v1',
      prefix: 'team-a',
      supportedFormats: [],
      formatBaseUrls: {},
    },
  });
});

test('account card action menu uses explicit copy labels', async () => {
  const source = await readFile(new URL('../components/AccountCard.tsx', import.meta.url), 'utf8');

  assert.match(source, /t\('accounts\.copy_account_config'\)/);
  assert.match(source, /writeAccountClipboardText/);
  assert.doesNotMatch(source, /t\('accounts\.copy_account_name'\)/);
  assert.doesNotMatch(source, /t\('common\.copy_content'\)/);
  assert.doesNotMatch(source, /navigator\.clipboard\.writeText/);
});

test('account card action menu includes reauth for every codex auth-file account', async () => {
  const source = await readFile(new URL('../components/AccountCard.tsx', import.meta.url), 'utf8');

  assert.match(source, /RotateCw/);
  assert.match(source, /isCodexAuthFile/);
  assert.match(source, /const canMenuReauth = isCodexAuthFile\(account\)/);
  assert.match(source, /\{canMenuReauth \? \(/);
  assert.match(source, /onStartReauth\(account\)/);
  assert.match(source, /isOAuthPending \? t\('accounts\.reauth_pending'\) : t\('accounts\.reauth'\)/);
  assert.match(source, /disabled=\{isOAuthPending\}/);
});

test('account card refresh action stays visible for openai-compatible runtime-only cards', () => {
  const action = buildAccountCardRefreshAction({
    account: {
      id: 'openai-compatible:together',
      accountKind: 'openai-compatible',
      provider: 'together',
      credentialSource: 'api-key',
      displayName: 'OPENAI-COMPATIBLE · TOGETHER',
      status: 'configured',
      baseUrl: 'https://api.together.xyz/v1',
      supportedFormats: ['openai_chat', 'openai_responses'],
    },
  });

  assert.deepEqual(action, {
    visible: true,
    labelKey: 'accounts.refresh_runtime',
    disabled: false,
  });
});

test('account card refresh action keeps quota label for quota-capable accounts', () => {
  const action = buildAccountCardRefreshAction({
    account: {
      id: 'codex-api-key:stable',
      accountKind: 'codex-api-key',
      provider: 'codex',
      credentialSource: 'api-key',
      displayName: 'Stable Codex Key',
      status: 'configured',
      quotaKey: 'codex-api-key:stable',
      quotaCurl: 'curl https://quota.example.test',
      quotaEnabled: true,
    },
  });

  assert.deepEqual(action, {
    visible: true,
    labelKey: 'accounts.refresh_quota',
    disabled: false,
  });
});

test('account card exposes refresh as a top icon action only', async () => {
  const source = await readFile(new URL('../components/AccountCard.tsx', import.meta.url), 'utf8');
  const attributionSource = await readFile(new URL('../components/AttributionCard.tsx', import.meta.url), 'utf8');

  assert.match(source, /RefreshCw/);
  assert.match(source, /aria-label=\{t\(refreshAction\.labelKey\)\}/);
  assert.match(source, /title=\{t\(refreshAction\.labelKey\)\}/);
  assert.match(source, /onClick=\{\(\) => onRefreshQuota\(account\)\}/);
  assert.match(source, /<MoreVertical size=\{16\} strokeWidth=\{2\} \/>/);
  assert.match(source, /className="flex shrink-0 items-center"/);
  assert.doesNotMatch(source, /className="-mr-4 flex shrink-0 items-center gap-1"/);
  assert.doesNotMatch(source, /account-card-footer-refresh-button/);
  assert.match(attributionSource, /topActions \? <div className="col-start-2 shrink-0 justify-self-end">\{topActions\}<\/div> : null/);
  assert.match(attributionSource, /topActions \? <div className="shrink-0">\{topActions\}<\/div> : null/);
});

test('accounts import modal opens with app-local copied account payload when available', async () => {
  const source = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /readAccountClipboardFallback/);
  assert.match(source, /setInitialImportPasteContent\(readAccountClipboardFallback\(\)\)/);
});

test('account import queue candidates render with account card styling', async () => {
  const modalSource = await readFile(new URL('../components/AccountImportModal.tsx', import.meta.url), 'utf8');
  const queueSource = await readFile(new URL('../components/AccountImportQueueList.tsx', import.meta.url), 'utf8');

  assert.match(modalSource, /<AccountImportQueueList/);
  assert.match(queueSource, /data-account-card/);
  assert.match(queueSource, /data-account-import-queue-viewport/);
  assert.match(queueSource, /data-account-import-queue-rendered-item/);
  assert.match(queueSource, /resolveAccountImportQueueRenderWindow/);
  assert.match(queueSource, /resolveAccountImportPayloadPreview\(item\.payload\)/);
  assert.doesNotMatch(queueSource, /grid-cols-\[2\.25rem_minmax\(0,1fr\)_auto\]/);
});

test('account import modal uses merged input panel beside account preview', async () => {
  const source = await readFile(new URL('../components/AccountImportModal.tsx', import.meta.url), 'utf8');
  const pageSource = await readFile(new URL('../../../pages/AccountImportPage.tsx', import.meta.url), 'utf8');

  assert.match(source, /data-account-import-input-panel/);
  assert.match(source, /lg:grid-cols-\[minmax\(0,0\.92fr\)_minmax\(0,1\.08fr\)\]/);
  assert.equal((source.match(/data-account-import-input-panel/g) || []).length, 1);

  const inputPanelIndex = source.indexOf('data-account-import-input-panel');
  const fileIndex = source.indexOf("t('accounts.import_account_files')");
  const pasteIndex = source.indexOf("t('accounts.import_account_paste')");
  const queueIndex = source.indexOf("t('accounts.import_account_queue')");
  assert.ok(inputPanelIndex >= 0 && inputPanelIndex < fileIndex);
  assert.ok(fileIndex < pasteIndex);
  assert.ok(pasteIndex < queueIndex);
  assert.match(source, /onDrop=\{handleFileDrop\}/);
  assert.match(pageSource, /onDrop=\{handleFileDrop\}/);
  assert.match(source, /readAccountClipboardText/);
  assert.match(pageSource, /readAccountClipboardText/);
  assert.match(source, /onClick=\{\(\) => void handlePasteFromClipboard\(\)\}/);
  assert.match(pageSource, /onClick=\{\(\) => void handlePasteFromClipboard\(\)\}/);
  assert.match(source, /data-account-import-dropzone/);
  assert.match(pageSource, /data-account-import-dropzone/);
  assert.match(source, /accept="\.json,\.zip,\.tar,\.tar\.gz,\.tgz,\.gz,\.gzip,application\/json,application\/zip,application\/gzip,application\/x-tar"/);
  assert.match(pageSource, /accept="\.json,\.zip,\.tar,\.tar\.gz,\.tgz,\.gz,\.gzip,application\/json,application\/zip,application\/gzip,application\/x-tar"/);
});

test('account import page uses the quiet workspace shell', async () => {
  const source = await readFile(new URL('../../../pages/AccountImportPage.tsx', import.meta.url), 'utf8');
  const targetSource = sourceBlock(source, 'export default function AccountImportPage', 'function createQueueItem');

  assert.match(source, /const accountImportPageShellClass =/);
  assert.match(source, /const accountImportHeaderClass =/);
  assert.match(source, /const accountImportPanelClass =/);
  assert.match(source, /const accountImportButtonClass =/);
  assert.match(source, /const accountImportDropzoneClass =/);
  assert.match(source, /const accountImportMetaChipClass =/);
  assert.match(targetSource, /data-account-import-page/);
  assert.match(targetSource, /data-account-import-header/);
  assert.match(targetSource, /data-account-import-input-panel/);
  assert.match(targetSource, /data-account-import-dropzone/);
  assert.match(targetSource, /data-account-import-queue-panel/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /--gt-status-danger/);
  assert.doesNotMatch(targetSource, /btn-swiss/);
  assert.doesNotMatch(targetSource, /border-2|border-b-4|border-t-4|border-t-2|border-b-2/);
  assert.doesNotMatch(targetSource, /border-dashed/);
  assert.doesNotMatch(targetSource, /bg-\[var\(--bg-main\)\]/);
  assert.doesNotMatch(targetSource, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(targetSource, /color-status-/);
  assert.doesNotMatch(targetSource, /font-black/);
  assert.doesNotMatch(targetSource, /uppercase/);
  assert.doesNotMatch(targetSource, /tracking-\[0\.1em\]|tracking-\[0\.12em\]|tracking-\[0\.14em\]|tracking-\[0\.2em\]/);
  assert.doesNotMatch(targetSource, /shadow-\[/);
});

test('pasted codex api key copies use numbered duplicate titles', async () => {
  const source = await readFile(new URL('../hooks/useAccountsActions.ts', import.meta.url), 'utf8');

  assert.match(source, /resolveNumberedDuplicateTitle\(item\.label/);
  assert.match(source, /label,/);
});

test('account card frame exposes card-level detail expansion semantics', async () => {
  const source = await readFile(new URL('../components/AccountCardFrame.tsx', import.meta.url), 'utf8');

  assert.match(source, /data-account-card-open-details/);
  assert.match(source, /<Card/);
  assert.match(source, /aria-label=\{interactive \? openDetailsLabel : undefined\}/);
  assert.match(source, /role=\{interactive \? 'button' : undefined\}/);
  assert.match(source, /hoverable=\{interactive\}/);
});

test('account card runtime warning banner summarizes stale reasons but keeps full tooltip', async () => {
  const source = await readFile(new URL('../components/CardSections.tsx', import.meta.url), 'utf8');

  assert.match(source, /buildRuntimeWarningDisplay/);
  assert.match(source, /title=\{display\.full\}/);
  assert.match(source, /\{display\.summary\}/);
  assert.doesNotMatch(source, /title=\{runtimeWarning\}/);
  assert.match(source, /data-account-quota-runtime-warning/);
  assert.match(source, /data-account-route-guard-runtime-warning/);
});
