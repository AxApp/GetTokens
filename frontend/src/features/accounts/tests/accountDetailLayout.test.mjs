import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildAccountDetailModulePlan } from '../model/accountDetailLayout.ts';
import { findAccountDetailByID } from '../model/accountDetailSelection.ts';

test('account detail no longer mounts runtime evidence overview sections', async () => {
  const unifiedSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const openAICompatibleSource = await readFile(new URL('../components/OpenAICompatibleDetailModal.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(unifiedSource, /AccountDetailOverviewGrid/);
  assert.doesNotMatch(openAICompatibleSource, /AccountDetailOverviewGrid/);
  assert.doesNotMatch(unifiedSource, /AccountRuntimeEvidenceSection/);
  assert.doesNotMatch(openAICompatibleSource, /AccountRuntimeEvidenceSection/);
});

test('account detail frame uses the fullscreen detail modal shell', async () => {
  const frameSource = await readFile(new URL('../components/AccountDetailModalFrame.tsx', import.meta.url), 'utf8');
  const modalFrameSource = await readFile(new URL('../../../components/ui/ModalFrame.tsx', import.meta.url), 'utf8');

  assert.match(frameSource, /size="detail"/);
  assert.match(modalFrameSource, /const detailFullscreen = size === 'detail'/);
  assert.match(modalFrameSource, /position === 'fixed' && !detailFullscreen/);
  assert.match(modalFrameSource, /detailFullscreen[\s\S]*\? 'place-items-center overflow-hidden p-4 sm:p-6'/);
  assert.match(modalFrameSource, /detailFullscreen[\s\S]*h-\[calc\(100vh-2rem\)\]/);
  assert.match(modalFrameSource, /sm:h-\[calc\(100vh-3rem\)\]/);
  assert.match(modalFrameSource, /createPortal\(modal, document\.body\)/);
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


test('unified compose config page starts with plaintext credentials then endpoint and script modules', async () => {
  const source = await readFile(new URL('../components/UnifiedComposeModal.tsx', import.meta.url), 'utf8');

  const credentialIndex = source.indexOf('componentName="UnifiedComposeCredentialsSection"');
  const endpointIndex = source.indexOf('componentName="UnifiedComposeEndpointSection"');
  const quotaIndex = source.indexOf('componentName="UnifiedComposeQuotaSection"');
  const billingIndex = source.indexOf('componentName="UnifiedComposeBillingSection"');

  assert.ok(credentialIndex > 0, 'credentials section should exist');
  assert.ok(endpointIndex > 0, 'endpoint section should exist');
  assert.ok(quotaIndex > 0, 'quota script section should exist');
  assert.ok(billingIndex > 0, 'billing script section should exist');
  assert.ok(credentialIndex < endpointIndex, 'credentials should be the first config module');
  assert.ok(endpointIndex < quotaIndex, 'endpoint config should follow credentials');
  assert.ok(quotaIndex < billingIndex, 'quota should appear before billing');
  assert.doesNotMatch(source, /title=\{copy\.apiKeyLabel\}[\s\S]{0,220}type="password"/);
  assert.match(source, /data-unified-compose-api-key-plaintext="true"/);
});

test('unified compose quota and billing use account-detail curl script card pattern', async () => {
  const source = await readFile(new URL('../components/UnifiedComposeModal.tsx', import.meta.url), 'utf8');

  assert.match(source, /function UnifiedComposeCurlConfigSection/);
  assert.match(source, /AccountCurlEditorModal/);
  assert.match(source, /AccountDetailEmptyState/);
  assert.match(source, /data-unified-compose-curl-card=\{kind\}/);
  assert.match(source, /kind="quota"/);
  assert.match(source, /kind="billing"/);
  assert.doesNotMatch(source, /componentName="UnifiedComposeAdvancedSection"[\s\S]*?<textarea/);
  assert.doesNotMatch(source, /componentName="UnifiedComposeBillingSection"[\s\S]*?<textarea/);
});

test('unified compose submits third-party vendors as openai-compatible accounts', async () => {
  const source = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');
  const submitStart = source.indexOf('const handleUnifiedComposeSubmit = useCallback(async () => {');
  const submitEnd = source.indexOf('}, [unifiedComposeForm, unifiedComposePreset, trackRequest, loadAccounts]);', submitStart);
  const submitBlock = submitStart >= 0 && submitEnd > submitStart
    ? source.slice(submitStart, submitEnd)
    : '';

  assert.match(submitBlock, /CreateOpenAICompatibleProvider/);
  assert.match(submitBlock, /main\.CreateOpenAICompatibleProviderInput\.createFrom/);
  assert.match(submitBlock, /[\"']CreateOpenAICompatibleProvider[\"']/);
  assert.match(submitBlock, /formatBaseUrls/);
  assert.match(submitBlock, /quotaCurl: unifiedComposeForm\.quotaCurl/);
  assert.match(submitBlock, /quotaEnabled: unifiedComposeForm\.quotaEnabled/);
  assert.match(submitBlock, /billingCurl: unifiedComposeForm\.billingCurl/);
  assert.match(submitBlock, /billingEnabled: unifiedComposeForm\.billingEnabled/);
  assert.match(submitBlock, /models: models\.length > 0 \? models : undefined/);
  assert.doesNotMatch(submitBlock, /CreateCodexAPIKey/);
  assert.doesNotMatch(submitBlock, /main\.CreateCodexAPIKeyInput\.createFrom/);
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
  const quotaBlock = source.match(/export function AccountQuotaSection[\s\S]*?\nexport function AccountBillingSection/)?.[0] ?? '';
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
  const quotaBlock = source.match(/export function AccountQuotaSection[\s\S]*?\nexport function AccountBillingSection/)?.[0] ?? '';
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

test('runtime evidence section is removed from account detail surfaces', async () => {
  const sectionSource = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const unifiedSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const openAICompatibleSource = await readFile(new URL('../components/OpenAICompatibleDetailModal.tsx', import.meta.url), 'utf8');
  const storySource = await readFile(new URL('../components/AccountModalComponents.stories.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(sectionSource, /export function AccountRuntimeEvidenceSection/);
  assert.doesNotMatch(sectionSource, /componentName="AccountRuntimeEvidenceSection"/);
  assert.doesNotMatch(sectionSource, /data-account-runtime-evidence-layout="merged"/);
  assert.doesNotMatch(sectionSource, /data-account-runtime-evidence-slot="snapshot"/);
  assert.doesNotMatch(sectionSource, /data-account-runtime-evidence-slot="audit"/);
  assert.doesNotMatch(sectionSource, /export function AccountRuntimeSnapshotSection/);
  assert.doesNotMatch(sectionSource, /export function AccountEvidenceSection/);

  assert.doesNotMatch(unifiedSource, /AccountRuntimeEvidenceSection/);
  assert.doesNotMatch(unifiedSource, /AccountDetailOverviewGrid/);
  assert.doesNotMatch(unifiedSource, /AccountEvidenceSection/);

  assert.doesNotMatch(openAICompatibleSource, /AccountRuntimeEvidenceSection/);
  assert.doesNotMatch(openAICompatibleSource, /buildOpenAICompatibleEvidenceRows/);
  assert.doesNotMatch(openAICompatibleSource, /OpenAICompatibleEvidenceSection/);
  assert.doesNotMatch(openAICompatibleSource, /AccountDetailOverviewGrid/);

  assert.doesNotMatch(storySource, /AccountRuntimeEvidenceSection/);
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
  assert.match(featureSource, /setAccountDetailScriptFromHash\(hashState\?\.accountDetailScript \?\? [\"'][\"']\)/);
  assert.match(featureSource, /activeScriptEditor=\{[\s\S]*?selectedAccount\.id === accountDetailIDFromHash[\s\S]*?\? accountDetailScriptFromHash[\s\S]*?: [\"'][\"'][\s\S]*?\}/);
  assert.match(detailSource, /activeScriptEditor\?: AccountDetailScriptRoute \| [\"'][\"']/);
  assert.match(detailSource, /editorOpen=\{props\.activeScriptEditor === [\"']quota[\"']\}/);
  assert.match(detailSource, /onOpenEditor=\{\(\) => props\.onOpenScriptEditor\?\.\([\"']quota[\"']\)\}/);
  assert.match(detailSource, /editorOpen=\{props\.activeScriptEditor === [\"']billing[\"']\}/);
  assert.match(sectionSource, /editorOpen: routedEditorOpen/);
  assert.match(sectionSource, /const editorOpen = routedEditorOpen \?\? localEditorOpen/);
  assert.match(navigationSource, /accountDetailScript: hashState\?\.accountDetailScript \?\? null/);
  assert.match(navigationSource, /modal: hashState\.modal \?\? null/);
  assert.match(navigationSource, /function shouldPreserveModalHash/);
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

  assert.match(closeHashBlock, /setAccountDetailIDFromHash\([\"'][\"']\);/);
  assert.match(closeHashBlock, /clearAccountDetailFrameHash\(window\.location\.hash\)/);
  assert.ok(
    Math.max(closeHashBlock.indexOf("setAccountDetailIDFromHash('');"), closeHashBlock.indexOf('setAccountDetailIDFromHash("");')) < closeHashBlock.indexOf('clearAccountDetailFrameHash(window.location.hash)'),
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
