import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildAccountDetailModulePlan } from '../model/accountDetailLayout.ts';
import { findAccountDetailByID } from '../model/accountDetailSelection.ts';

test('account detail runtime evidence is no longer mounted through the split overview grid', async () => {
  const unifiedSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const openAICompatibleSource = await readFile(new URL('../components/OpenAICompatibleDetailModal.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(unifiedSource, /AccountDetailOverviewGrid/);
  assert.doesNotMatch(openAICompatibleSource, /AccountDetailOverviewGrid/);
  assert.match(unifiedSource, /<AccountRuntimeEvidenceSection/);
  assert.match(openAICompatibleSource, /<AccountRuntimeEvidenceSection/);
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

test('api key credential, verify, and proxy route stack vertically in one module', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const modalSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');

  assert.match(source, /export function AccountCredentialVerifySection/);
  assert.match(source, /data-account-credential-verify-layout="vertical"/);
  assert.match(source, /data-account-credential-fields="stacked"/);
  assert.match(source, /data-account-credential-field-label="above"/);
  assert.doesNotMatch(source, /data-account-credential-field-label="embedded"/);
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

test('quota and billing test actions live in section headers', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const quotaBlock = source.match(/export function AccountQuotaSection[\s\S]*?\nexport function AccountRuntimeEvidenceSection/)?.[0] ?? '';
  const billingBlock = source.match(/export function AccountBillingSection[\s\S]*?\nfunction RuntimeKV/)?.[0] ?? '';
  const billingActionsBlock = billingBlock.match(/const billingActions = \([\s\S]*?\n  \);/)?.[0] ?? '';

  assert.match(quotaBlock, /actions=\{quotaActions\}/);
  assert.match(quotaBlock, /const quotaActions = \(/);
  assert.match(billingBlock, /actions=\{billingActions\}/);
  assert.match(billingBlock, /const billingActions = \(/);
  assert.doesNotMatch(quotaBlock, /<div className="flex flex-wrap items-center gap-2">\s*<button onClick=\{runQuotaTest\}/);
  assert.doesNotMatch(billingBlock, /<div className="flex flex-wrap items-center gap-2">\s*<button onClick=\{runBillingTest\}/);
  assert.ok(
    billingActionsBlock.indexOf('onClick={runBillingTest}') < billingActionsBlock.indexOf('onClick={openEditor}'),
    'billing add button should be the rightmost header action',
  );
});

test('quota and billing detail share empty-state and script-card structure', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const quotaBlock = source.match(/export function AccountQuotaSection[\s\S]*?\nexport function AccountRuntimeEvidenceSection/)?.[0] ?? '';
  const billingBlock = source.match(/export function AccountBillingSection[\s\S]*?\nfunction RuntimeKV/)?.[0] ?? '';
  const billingActionsBlock = billingBlock.match(/const billingActions = \([\s\S]*?\n  \);/)?.[0] ?? '';

  assert.match(quotaBlock, /const hasQuotaScript = draft\.quotaCurl\.trim\(\)\.length > 0/);
  assert.match(quotaBlock, /<AccountDetailEmptyState/);
  assert.match(quotaBlock, /暂无额度脚本/);
  assert.match(quotaBlock, /\{hasQuotaScript \? \(/);
  assert.match(billingBlock, /const hasBillingScript = draft\.billingCurl\.trim\(\)\.length > 0/);
  assert.match(billingBlock, /const liveBalances = liveBilling\?\.isAvailable \? liveBilling\.balances : \[\]/);
  assert.match(billingBlock, /<AccountDetailEmptyState/);
  assert.match(billingBlock, />\s*添加\s*<\/button>/);
  assert.match(billingBlock, /\{hasBillingScript \? \(/);
  assert.doesNotMatch(billingActionsBlock, /编辑脚本/);
});

test('runtime snapshot and evidence render as one merged account detail section', async () => {
  const sectionSource = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const unifiedSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const openAICompatibleSource = await readFile(new URL('../components/OpenAICompatibleDetailModal.tsx', import.meta.url), 'utf8');
  const storySource = await readFile(new URL('../components/AccountModalComponents.stories.tsx', import.meta.url), 'utf8');

  assert.match(sectionSource, /export function AccountRuntimeEvidenceSection/);
  assert.match(sectionSource, /componentName="AccountRuntimeEvidenceSection"/);
  assert.match(sectionSource, /data-account-runtime-evidence-layout="merged"/);
  assert.match(sectionSource, /data-account-runtime-evidence-slot="snapshot"/);
  assert.match(sectionSource, /data-account-runtime-evidence-slot="audit"/);
  assert.match(sectionSource, /AUDIT EVIDENCE/);
  assert.doesNotMatch(sectionSource, /export function AccountRuntimeSnapshotSection/);
  assert.doesNotMatch(sectionSource, /export function AccountEvidenceSection/);

  assert.match(unifiedSource, /<AccountRuntimeEvidenceSection[\s\S]*?account=\{account\}/);
  assert.doesNotMatch(unifiedSource, /AccountDetailOverviewGrid/);
  assert.doesNotMatch(unifiedSource, /AccountEvidenceSection/);

  assert.match(openAICompatibleSource, /<AccountRuntimeEvidenceSection[\s\S]*?evidenceRows=\{buildOpenAICompatibleEvidenceRows/);
  assert.doesNotMatch(openAICompatibleSource, /OpenAICompatibleEvidenceSection/);
  assert.doesNotMatch(openAICompatibleSource, /AccountDetailOverviewGrid/);

  assert.match(storySource, /<AccountRuntimeEvidenceSection/);
  assert.doesNotMatch(storySource, /AccountRuntimeSnapshotSection/);
  assert.doesNotMatch(storySource, /AccountEvidenceSection/);
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
