import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildAccountDetailModulePlan } from '../model/accountDetailLayout.ts';
import { findAccountDetailByID } from '../model/accountDetailSelection.ts';

test('account detail overview keeps runtime snapshot and evidence as a 50/50 desktop split', async () => {
  const source = await readFile(new URL('../components/AccountDetailPrimitives.tsx', import.meta.url), 'utf8');

  assert.match(source, /data-account-detail-overview-layout.*'split-50-50'/);
  assert.match(source, /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)\]/);
  assert.doesNotMatch(source, /xl:grid-cols-\[minmax\(0,1fr\)_24rem\]/);
});

test('account detail keeps auth-file modules lightweight', () => {
  assert.deepEqual(
    buildAccountDetailModulePlan({ credentialSource: 'auth-file' }),
    ['auth-file-actions', 'models', 'rate-limit'],
  );
});

test('auth-file summary keeps raw content hidden and retains model catalog', async () => {
  const source = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');

  assert.match(source, /componentName="AuthFileSummarySection"/);
  assert.doesNotMatch(source, /componentName="AuthFileSummarySection"[\s\S]{0,180}span="wide"/);
  assert.match(source, /componentName="CompatibleModelsSection"/);
  assert.doesNotMatch(source, /tReadonlyProxyReason/);
});

test('runtime quota rows use a full-width visible progress track', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');

  assert.match(source, /<QuotaBars quotaDisplay=\{quotaDisplay\} t=\{t\} \/>/);
  assert.doesNotMatch(source, /data-account-quota-progress-track/);
  assert.doesNotMatch(source, /data-account-quota-progress-fill/);
});

test('runtime stats render as a compact strip instead of a large stat grid', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');

  assert.match(source, /data-account-runtime-stat-strip/);
  assert.match(source, /md:grid-cols-3/);
  assert.doesNotMatch(source, /<AccountDetailStatGrid columns=\{6\}>/);
});

test('api key credential fields stack vertically with embedded labels', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const modalSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');

  assert.match(source, /export function AccountCredentialVerifySection/);
  assert.match(source, /data-account-credential-fields="stacked"/);
  assert.match(source, /data-account-credential-field-label="embedded"/);
  assert.match(source, /data-account-credential-verify-layout="combined"/);
  assert.match(source, /data-account-credential-list-item="credential"/);
  assert.match(source, /data-account-credential-list-item="connection"/);
  assert.match(source, /data-account-credential-list-item="proxy-route"/);
  assert.match(modalSource, /<AccountCredentialVerifySection[\s\S]*?span="wide"/);
  assert.doesNotMatch(source, /export function AccountCredentialsSection/);
  assert.doesNotMatch(source, /export function AccountVerifySection/);
  assert.doesNotMatch(source, /xl:grid-cols-\[minmax\(0,1\.15fr\)_minmax\(0,0\.85fr\)\]/);
});

test('browser preview account detail uses local detail data without Wails bindings', async () => {
  const featureSource = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');
  const detailSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');

  assert.match(featureSource, /getAccountsPreviewRelayModelNames/);
  assert.match(featureSource, /if \(!hasWailsAppBindings\(\)\) \{/);
  assert.match(detailSource, /getAccountsPreviewAuthFileContent/);
  assert.match(detailSource, /getAccountsPreviewAuthFileModels/);
  assert.match(detailSource, /setRawContent\(content\);[\s\S]*?setLoading\(false\);[\s\S]*?return;/);
  assert.match(detailSource, /setModels\(previewModels\);[\s\S]*?setLoading\(false\);[\s\S]*?return;/);
});

test('account detail preserves api-key edit modules', () => {
  assert.deepEqual(
    buildAccountDetailModulePlan({ credentialSource: 'api-key' }),
    ['credentials', 'rate-limit', 'quota', 'billing'],
  );
});

test('quota and billing curl editors are modal draft editors without local save buttons', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const modalSource = await readFile(new URL('../components/AccountCurlEditorModal.tsx', import.meta.url), 'utf8');

  assert.match(source, /AccountCurlEditorModal/);
  assert.doesNotMatch(source, /function CurlEditorModal/);
  assert.match(modalSource, /export function AccountCurlEditorModal/);
  assert.match(modalSource, /lg:grid-cols-\[minmax\(0,1fr\)_22rem\]/);
  assert.match(modalSource, /DEFAULT VARIABLES/);
  assert.match(modalSource, /TEMPLATES/);
  assert.match(modalSource, /onApplyTemplate/);
  assert.doesNotMatch(modalSource, /保存模板/);
});

test('quota and billing curl editors are driven by account detail script hash routes', async () => {
  const featureSource = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');
  const detailSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const sectionSource = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const navigationSource = await readFile(new URL('../../../hooks/useAppNavigation.ts', import.meta.url), 'utf8');

  assert.match(featureSource, /buildAccountDetailScriptFrameHash/);
  assert.match(featureSource, /clearAccountDetailScriptFrameHash/);
  assert.match(featureSource, /setAccountDetailScriptFromHash\(hashState\?\.accountDetailScript \?\? ''\)/);
  assert.match(featureSource, /activeScriptEditor=\{selectedAccount\.id === accountDetailIDFromHash \? accountDetailScriptFromHash : ''\}/);
  assert.match(detailSource, /activeScriptEditor\?: AccountDetailScriptRoute \| ''/);
  assert.match(detailSource, /editorOpen=\{props\.activeScriptEditor === 'quota'\}/);
  assert.match(detailSource, /onOpenEditor=\{\(\) => props\.onOpenScriptEditor\?\.\('quota'\)\}/);
  assert.match(detailSource, /editorOpen=\{props\.activeScriptEditor === 'billing'\}/);
  assert.match(sectionSource, /editorOpen: routedEditorOpen/);
  assert.match(sectionSource, /const editorOpen = routedEditorOpen \?\? localEditorOpen/);
  assert.match(navigationSource, /accountDetailScript: hashState\?\.accountDetailScript \?\? null/);
});

test('curl editor variable buttons insert at cursor or copy when no cursor is active', async () => {
  const source = await readFile(new URL('../components/AccountCurlEditorModal.tsx', import.meta.url), 'utf8');

  assert.match(source, /const textareaRef = useRef<HTMLTextAreaElement \| null>\(null\)/);
  assert.match(source, /const cursorRangeRef = useRef<\{ start: number; end: number \} \| null>\(null\)/);
  assert.match(source, /function rememberCursor\(\)/);
  assert.match(source, /async function insertOrCopyVariable\(label: string\)/);
  assert.match(source, /await writeAccountClipboardText\(token\)/);
  assert.match(source, /onClick=\{\(\) => void insertOrCopyVariable\(variable\.label\)\}/);
  assert.match(source, /\{hasCursor \? '插入' : copiedToken === token \? '已复制' : '复制'\}/);
});

test('account detail deep link resolves an account by stable id', () => {
  const accounts = [
    { id: 'auth-file:codex-pro.json', credentialSource: 'auth-file', provider: 'codex', displayName: 'Pro', status: 'active' },
    { id: 'codex-api-key:stable-001', credentialSource: 'api-key', provider: 'codex', displayName: 'Stable', status: 'configured' },
  ];

  assert.equal(findAccountDetailByID(accounts, 'auth-file:codex-pro.json')?.displayName, 'Pro');
  assert.equal(findAccountDetailByID(accounts, 'missing'), null);
});

test('account detail close clears local hash state before selected account can rehydrate', async () => {
  const source = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');
  const closeHashBlock = source.match(/const clearAccountDetailInHash = useCallback\(\(\) => \{[\s\S]*?\n  \}, \[\]\);/)?.[0] ?? '';

  assert.match(closeHashBlock, /setAccountDetailIDFromHash\(''\);/);
  assert.match(closeHashBlock, /clearAccountDetailFrameHash\(window\.location\.hash\)/);
  assert.ok(
    closeHashBlock.indexOf("setAccountDetailIDFromHash('');") < closeHashBlock.indexOf('clearAccountDetailFrameHash(window.location.hash)'),
    'local detail state must be cleared before hashchange can re-run account hydration',
  );
});

test('account detail save closes only after config and rate-limit saves finish', async () => {
  const source = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const saveBlock = source.match(/async function saveConfig\(\) \{[\s\S]*?\n  \}/)?.[0] ?? '';

  assert.match(saveBlock, /await onSaveConfig\(configDraft\)/);
  assert.match(saveBlock, /const saved = await rateLimitRulesRef\.current\?\.save\(\)/);
  assert.match(saveBlock, /if \(saved === false\) \{[\s\S]*?return;/);
  assert.match(saveBlock, /onClose\(\);/);
  assert.ok(
    saveBlock.indexOf('await onSaveConfig(configDraft)') < saveBlock.indexOf('onClose();'),
    'detail modal must close after save completes',
  );
});

test('api-key config save has an explicit browser preview path', async () => {
  const source = await readFile(new URL('../hooks/useAccountsActions.ts', import.meta.url), 'utf8');
  const saveBlock = source.match(/const updateSelectedApiKeyConfig = useCallback\([\s\S]*?\n  \);/)?.[0] ?? '';

  assert.match(saveBlock, /if \(!hasWailsAppBindings\(\)\) \{/);
  assert.match(saveBlock, /setSelectedAccount\(\(prev\) =>/);
  assert.match(saveBlock, /quotaCurl: nextQuotaCurl/);
  assert.match(saveBlock, /return;/);
});
