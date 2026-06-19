import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildAccountDetailModulePlan } from '../model/accountDetailLayout.ts';
import {
  findAccountDetailByID,
  patchAccountDetailByID,
  resolveAccountDetailSelection,
} from '../model/accountDetailSelection.ts';
import { normalizeQuotaTestDisplay } from '../model/accountQuota.ts';

function sourceBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

test('account detail no longer mounts runtime evidence overview sections', async () => {
  const unifiedSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(unifiedSource, /AccountDetailOverviewGrid/);
  assert.doesNotMatch(unifiedSource, /AccountRuntimeEvidenceSection/);
});

test('account detail frame uses the fullscreen detail modal shell', async () => {
  const frameSource = await readFile(new URL('../components/AccountDetailModalFrame.tsx', import.meta.url), 'utf8');
  const modalFrameSource = await readFile(new URL('../../../components/ui/ModalFrame.tsx', import.meta.url), 'utf8');

  assert.match(frameSource, /size="detail"/);
  assert.match(modalFrameSource, /const detailFullscreen = size === 'detail'/);
  assert.match(modalFrameSource, /position === 'fixed' && !detailFullscreen/);
  assert.match(modalFrameSource, /detailFullscreen[\s\S]*\? 'items-start justify-items-center overflow-hidden px-4 pb-4 pt-8 sm:px-6 sm:pb-6 sm:pt-10'/);
  assert.match(modalFrameSource, /detailFullscreen[\s\S]*h-\[calc\(100vh-3rem\)\]/);
  assert.match(modalFrameSource, /sm:h-\[calc\(100vh-4rem\)\]/);
  assert.match(modalFrameSource, /createPortal\(modal, document\.body\)/);
});

test('account detail keeps auth-file modules scoped to oauth operations and quota reset', () => {
  const modulePlan = buildAccountDetailModulePlan({ credentialSource: 'auth-file' });

  assert.deepEqual(modulePlan, ['runtime', 'auth-file-actions', 'models', 'model-probe', 'rate-limit', 'quota']);
  assert.equal(modulePlan.includes('billing'), false);
  assert.equal(modulePlan.includes('model-routing'), false);
});

test('accounts page loads auth-file rows from unified account store only', async () => {
  const source = await readFile(new URL('../hooks/useAccountsPageState.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /ListAuthFiles/);
  assert.doesNotMatch(source, /mapAuthFileToRecord/);
  assert.doesNotMatch(source, /resolveLoadedAuthFileRecords/);
  assert.doesNotMatch(source, /getAccountsPreviewAuthFiles/);
  assert.doesNotMatch(source, /setAuthFiles/);
  assert.doesNotMatch(source, /setDerivedAuthFileRecords/);
});

test('auth-file account detail exposes single-account OAuth model probe', async () => {
  const modalSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const featureSource = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');

  assert.match(modalSource, /<OAuthModelProbeSection/);
  assert.match(modalSource, /onOAuthModelProbe/);
  assert.match(featureSource, /ProbeCodexAccountRouting/);
  assert.match(featureSource, /allowAccountIDs:\s*\[selectedAccount\.id\]/);
  assert.match(featureSource, /orderAccountIDs:\s*\[selectedAccount\.id\]/);
  assert.match(featureSource, /allowFallback:\s*false/);
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
  const quotaModelSource = await readFile(new URL('../model/accountQuota.ts', import.meta.url), 'utf8');

  assert.match(source, /normalizeQuotaTestDisplay\(testResult\)/);
  assert.match(source, /<QuotaBars quotaDisplay=\{visibleQuotaDisplay\} t=\{t\} showDivider=\{false\} \/>/);
  assert.match(quotaModelSource, /export function normalizeQuotaTestDisplay/);
  assert.match(quotaModelSource, /status: 'success'/);
  assert.doesNotMatch(source, /data-account-quota-progress-track/);
  assert.doesNotMatch(source, /data-account-quota-progress-fill/);
});

test('quota curl test result normalizes returned windows for detail quota bars', () => {
  const display = normalizeQuotaTestDisplay({
    planType: 'PRO',
    windows: [
      {
        id: 'one-hour',
        label: '1H',
        remainingPercent: 77.4,
        usedTokens: 2260,
        limitTokens: 10000,
        resetAtUnix: 1800000000,
      },
    ],
  });

  assert.equal(display?.status, 'success');
  assert.equal(display?.planType, 'PRO');
  assert.equal(display?.windows.length, 1);
  assert.equal(display?.windows[0].remainingPercent, 77);
  assert.equal(display?.windows[0].usedLabel, '23%');
  assert.equal(display?.windows[0].usedTokens, 2260);
  assert.equal(display?.windows[0].limitTokens, 10000);
  assert.equal(display?.windows[0].resetAtUnix, 1800000000);
});

test('api key credential module uses left-right credential and connection layout', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const modalSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');

  assert.match(source, /export function AccountCredentialVerifySection/);
  assert.match(source, /data-account-credential-verify-layout="quiet-split"/);
  assert.match(source, /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)\]/);
  assert.match(source, /data-account-credential-left-pane="credential-connection"/);
  assert.match(source, /data-account-credential-right-pane="route"/);
  assert.match(source, /accountDetailCredentialPaneDividerClass/);
  assert.match(source, /lg:border-l lg:border-t-0/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /data-account-credential-fields="balanced-grid"/);
  assert.match(source, /label="账号名称"/);
  assert.match(source, /data-account-credential-field-label="above"/);
  assert.doesNotMatch(source, /data-account-credential-field-label="embedded"/);
  assert.match(source, /data-account-credential-list-item="credential"/);
  assert.match(source, /账号凭据/);
  assert.match(source, /连通验证/);
  assert.match(source, /data-account-credential-list-item="capability-endpoints"/);
  assert.match(source, /label: 'OpenAI'/);
  assert.match(source, /label: 'Codex'/);
  assert.match(source, /label: 'Anthropic'/);
  assert.match(source, /formatBaseUrls/);
  assert.match(source, /data-account-credential-list-item="connection"/);
  assert.match(source, /data-account-credential-list-item="proxy-route"/);
  assert.ok(
    source.indexOf('data-account-credential-left-pane="credential-connection"') < source.indexOf('<VerifyConnectionPanel'),
    'connection short-message panel should be in the left credential module',
  );
  assert.ok(
    source.indexOf('data-account-credential-left-pane="credential-connection"') < source.indexOf('data-account-credential-list-item="credential"'),
    'left pane should still start with account credential fields',
  );
  assert.ok(
    source.indexOf('data-account-credential-right-pane="route"') < source.indexOf('<CredentialProxyRoutePanel'),
    'right pane should only own the route panel',
  );
  assert.ok(
    source.indexOf('data-account-credential-right-pane="route"') < source.indexOf('<CapabilityEndpointsPanel'),
    'protocol endpoint overrides should live in the right connection pane',
  );
  assert.ok(
    source.indexOf('<CapabilityEndpointsPanel') < source.indexOf('<CredentialProxyRoutePanel'),
    'protocol endpoint overrides should sit above route proxy controls',
  );
  assert.match(modalSource, /<AccountCredentialVerifySection[\s\S]*?span="wide"/);
  assert.doesNotMatch(source, /export function AccountCredentialsSection/);
  assert.doesNotMatch(source, /export function AccountVerifySection/);
  assert.doesNotMatch(source, /data-account-credential-verify-layout="v09-low-nesting"/);
});

test('credential endpoint copy explains default base url versus protocol overrides', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const endpointsBlock = source.match(/function CapabilityEndpointsPanel[\s\S]*?\nfunction CredentialProxyRoutePanel/)?.[0] ?? '';
  const credentialBlock = source.match(/data-account-credential-list-item="credential"[\s\S]*?\n\s*<\/section>/)?.[0] ?? '';
  const connectionBlock = source.match(/data-account-credential-list-item="connection"[\s\S]*?\n\s*<\/section>/)?.[0] ?? '';

  assert.match(source, /label="默认基础 URL"/);
  assert.doesNotMatch(credentialBlock, /默认入口/);
  assert.doesNotMatch(credentialBlock, /专用端点留空时使用/);
  assert.doesNotMatch(credentialBlock, />\s*CREDENTIAL\s*</);
  assert.doesNotMatch(connectionBlock, />\s*CONNECTION\s*</);
  assert.doesNotMatch(connectionBlock, /发送一条短消息验证连通性/);
  assert.doesNotMatch(connectionBlock, /send one short chat message only/);
  assert.match(endpointsBlock, /协议端点/);
  assert.match(endpointsBlock, /留空使用默认基础 URL/);
  assert.match(endpointsBlock, /\{CAPABILITY_ENDPOINTS\.length\} 端/);
  assert.match(endpointsBlock, /data-account-credential-list-item="capability-endpoints" className="grid gap-3"/);
  assert.doesNotMatch(endpointsBlock, /data-account-credential-list-item="capability-endpoints" className="[^"]*border-t-2/);
  assert.doesNotMatch(endpointsBlock, /分别覆盖 OpenAI-compatible、Codex Responses 和 Anthropic 请求/);
});

test('credential module edits account name before credential secrets', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const configSource = await readFile(new URL('../model/accountDetailConfig.ts', import.meta.url), 'utf8');
  const actionsSource = await readFile(new URL('../hooks/useAccountsActions.ts', import.meta.url), 'utf8');
  const featureSource = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');
  const credentialBlock = source.match(/<div data-account-credential-fields="balanced-grid"[\s\S]*?<\/div>\n\s*<\/section>/)?.[0] ?? '';

  assert.match(configSource, /label: string;/);
  assert.match(configSource, /label: account\.displayName \?\? ""/);
  assert.match(configSource, /current\.label !== draft\.label/);
  assert.match(credentialBlock, /label="账号名称"[\s\S]*label="API 密钥"/);
  assert.ok(
    credentialBlock.indexOf('label="账号名称"') < credentialBlock.indexOf('label="API 密钥"'),
    'account name should be edited before API key in the credential module',
  );
  assert.match(actionsSource, /const nextLabel = draft\.label\.trim\(\)/);
  assert.match(actionsSource, /UpdateCodexAPIKeyLabel/);
  assert.match(featureSource, /const nextLabel = draft\.label\.trim\(\)/);
  assert.match(featureSource, /name: nextLabel \|\| selectedAccount\.provider/);
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
    ['runtime', 'credentials', 'models', 'rate-limit', 'quota', 'billing'],
  );
});

test('account detail surfaces a narrow runtime route section instead of the removed overview wall', async () => {
  const sectionSource = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const unifiedSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const featureSource = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');

  assert.match(sectionSource, /export function AccountRuntimeRouteSection/);
  assert.match(sectionSource, /componentName="AccountRuntimeRouteSection"/);
  assert.match(sectionSource, /title="运行态路由"/);
  assert.match(sectionSource, /data-account-runtime-route-layout="summary"/);
  assert.match(sectionSource, /data-account-runtime-route-evidence="detail"/);
  assert.match(sectionSource, /data-account-runtime-route-repair="diagnostics"/);
  assert.match(sectionSource, /data-account-runtime-route-decisions="recent"/);
  assert.match(sectionSource, /data-account-runtime-route-resilience="evidence"/);
  assert.match(sectionSource, /data-account-runtime-route-reason-details="current-decision"/);
  assert.match(sectionSource, /data-account-runtime-route-reason-detail=\{reasonDetail\.routeBlocking \? 'blocking' : 'observe'\}/);
  assert.match(sectionSource, /Route Resilience Evidence/);
  assert.match(sectionSource, /Reason Details/);
  assert.match(sectionSource, /Stable Target ID/);
  assert.match(sectionSource, /Latest Evidence/);
  assert.match(sectionSource, /First Seen/);
  assert.match(sectionSource, /Last Seen/);
  assert.match(sectionSource, /Relevant Decisions/);
  assert.match(sectionSource, /Digest Coverage/);
  assert.match(sectionSource, /This Decision/);
  assert.match(sectionSource, /Digest Above/);
  assert.match(sectionSource, /共享 digest · 共 /);
  assert.match(sectionSource, /reasonDetail\.routeBlocking \? 'BLOCKING' : 'OBSERVE'/);
  assert.match(sectionSource, /Reason Summary/);
  assert.match(sectionSource, /Source \/ Scope \/ Model/);
  assert.match(sectionSource, /最近真实路由/);
  assert.match(sectionSource, /Bounded Reconcile/);
  assert.match(sectionSource, /Failure Class/);
  assert.match(sectionSource, /Repair Outcome/);
  assert.match(sectionSource, /Repair Action/);
  assert.match(sectionSource, /Trigger Class/);
  assert.match(sectionSource, /Routeability/);
  assert.match(sectionSource, /Registered Models/);
  assert.match(sectionSource, /Requestable/);
  assert.match(unifiedSource, /case 'runtime':/);
  assert.match(unifiedSource, /<AccountRuntimeRouteSection[\s\S]*span="wide"/);
  assert.match(unifiedSource, /buildAccountRecentRouteDecisionSummaries/);
  assert.match(featureSource, /ListChannelRouteDecisions/);
  assert.match(featureSource, /routeDecisions=\{detailRouteDecisions\}/);
  assert.doesNotMatch(sectionSource, /AccountRuntimeEvidenceSection/);
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

test('quota and billing script controls live in section headers', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const quotaBlock = source.match(/export function AccountQuotaSection[\s\S]*?\nexport function AccountBillingSection/)?.[0] ?? '';
  const billingBlock = source.match(/export function AccountBillingSection[\s\S]*?\nfunction RuntimeKV/)?.[0] ?? '';
  const quotaActionsBlock = quotaBlock.match(/const quotaActions = \([\s\S]*?\n  \);/)?.[0] ?? '';
  const billingActionsBlock = billingBlock.match(/const billingActions = \([\s\S]*?\n  \);/)?.[0] ?? '';

  assert.match(quotaBlock, /actions=\{quotaActions\}/);
  assert.match(quotaBlock, /const quotaActions = \(/);
  assert.match(billingBlock, /actions=\{billingActions\}/);
  assert.match(billingBlock, /const billingActions = \(/);
  assert.match(quotaActionsBlock, /编辑脚本/);
  assert.match(billingActionsBlock, /编辑脚本/);
  assert.doesNotMatch(quotaActionsBlock, /启用额度/);
  assert.doesNotMatch(billingActionsBlock, /启用余额/);
  assert.doesNotMatch(quotaActionsBlock, /quotaEnabled: event\.target\.checked/);
  assert.doesNotMatch(billingActionsBlock, /billingEnabled: event\.target\.checked/);
  assert.doesNotMatch(quotaBlock, /<div className="flex flex-wrap items-center gap-2">\s*<button onClick=\{runQuotaTest\}/);
  assert.doesNotMatch(billingBlock, /<div className="flex flex-wrap items-center gap-2">\s*<button onClick=\{runBillingTest\}/);
  assert.ok(
    quotaActionsBlock.indexOf('编辑脚本') < quotaActionsBlock.indexOf('onClick={runQuotaTest}'),
    'quota edit control should be before the test action in the header',
  );
});

test('quota and billing detail share empty-state and script-card structure', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const quotaBlock = source.match(/export function AccountQuotaSection[\s\S]*?\nexport function AccountBillingSection/)?.[0] ?? '';
  const billingBlock = source.match(/export function AccountBillingSection[\s\S]*?\nfunction RuntimeKV/)?.[0] ?? '';

  assert.match(quotaBlock, /const hasQuotaScript = draft\.quotaCurl\.trim\(\)\.length > 0/);
  assert.match(quotaBlock, /<AccountDetailEmptyState/);
  assert.match(quotaBlock, /暂无额度脚本/);
  assert.match(quotaBlock, /\{hasQuotaScript \? \(/);
  assert.doesNotMatch(quotaBlock, /justify-between gap-3/);
  assert.match(billingBlock, /const hasBillingScript = draft\.billingCurl\.trim\(\)\.length > 0/);
  assert.match(billingBlock, /const liveBalances = liveBilling\?\.isAvailable \? liveBilling\.balances : \[\]/);
  assert.match(billingBlock, /<AccountDetailEmptyState/);
  assert.match(billingBlock, />\s*添加\s*<\/button>/);
  assert.match(billingBlock, /\{hasBillingScript \? \(/);
  assert.doesNotMatch(billingBlock, /justify-between gap-3/);
});

test('quota script preview uses a fixed two-line readable height', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const quotaBlock = source.match(/export function AccountQuotaSection[\s\S]*?\nexport function AccountBillingSection/)?.[0] ?? '';

  assert.match(quotaBlock, /data-account-quota-script-preview="two-line"/);
  assert.match(quotaBlock, /min-h-\[2\.75rem\]/);
  assert.match(quotaBlock, /line-clamp-2/);
  assert.doesNotMatch(quotaBlock, /<div className="truncate font-mono[^"]*" title=\{draft\.quotaCurl \|\| undefined\}>/);
});

test('quota split layout removes quota window divider and stretches script card', async () => {
  const sectionSource = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const cardSectionsSource = await readFile(new URL('../components/CardSections.tsx', import.meta.url), 'utf8');

  assert.match(cardSectionsSource, /showDivider = true/);
  assert.match(cardSectionsSource, /showDivider \? 'border-b border-dashed border-\[var\(--gt-border-subtle\)\]' : ''/);
  assert.match(sectionSource, /<QuotaBars quotaDisplay=\{visibleQuotaDisplay\} t=\{t\} showDivider=\{false\} \/>/);
  assert.match(sectionSource, /grid-rows-\[auto_minmax\(0,1fr\)\]/);
  assert.match(sectionSource, /const quotaScriptCardClassName = layoutMode === 'split'/);
  assert.match(sectionSource, /grid h-full min-h-\[8\.75rem\] content-start gap-3/);
});

test('runtime evidence section is removed from account detail surfaces', async () => {
  const sectionSource = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const unifiedSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
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
    { id: 'acct_preview_codex_plus_nightly_json', name: 'codex-plus-nightly.json', credentialSource: 'auth-file', provider: 'codex', displayName: 'Pro', status: 'active' },
    { id: 'codex-api-key:stable-001', credentialSource: 'api-key', provider: 'codex', displayName: 'Stable', status: 'configured' },
  ];

  assert.equal(findAccountDetailByID(accounts, 'acct_preview_codex_plus_nightly_json')?.displayName, 'Pro');
  assert.equal(findAccountDetailByID(accounts, 'codex-plus-nightly.json')?.id, 'acct_preview_codex_plus_nightly_json');
  assert.equal(findAccountDetailByID(accounts, 'missing'), null);
});

test('account detail resolves legacy filename to unified oauth account after records are loaded', () => {
  const selected = {
    id: 'acct_codex_pro',
    name: 'codex-plus-nightly.json',
    credentialSource: 'auth-file',
    provider: 'codex',
    displayName: 'Pro',
    status: 'active',
  };

  assert.equal(
    resolveAccountDetailSelection([selected], 'codex-plus-nightly.json', selected, true),
    selected,
  );
  assert.equal(
    resolveAccountDetailSelection([], 'acct_codex_pro', selected, false),
    selected,
  );
});

test('account detail save patches the local list copy by stable id', () => {
  const accounts = [
    {
      id: 'acct_00000000-0000-4000-8000-000000000001',
      accountKind: 'codex-api-key',
      credentialSource: 'api-key',
      provider: 'codex',
      displayName: 'Old',
      status: 'active',
      apiKey: 'sk-old',
      baseUrl: 'https://old.example.com/v1',
      prefix: 'old',
      formatBaseUrls: {
        openai_responses: 'https://old.example.com/responses',
      },
    },
    {
      id: 'acct_00000000-0000-4000-8000-000000000002',
      accountKind: 'codex-api-key',
      credentialSource: 'api-key',
      provider: 'codex',
      displayName: 'Other',
      status: 'active',
      apiKey: 'sk-other',
      baseUrl: 'https://other.example.com/v1',
    },
  ];

  const next = patchAccountDetailByID(accounts, accounts[0].id, {
    displayName: 'New',
    apiKey: 'sk-new',
    baseUrl: 'https://new.example.com/v1',
    prefix: 'new',
    formatBaseUrls: {
      openai_responses: 'https://new.example.com/responses',
    },
  });

  assert.equal(next[0].id, accounts[0].id);
  assert.equal(next[0].displayName, 'New');
  assert.equal(next[0].apiKey, 'sk-new');
  assert.equal(next[0].baseUrl, 'https://new.example.com/v1');
  assert.equal(next[0].prefix, 'new');
  assert.equal(next[0].formatBaseUrls.openai_responses, 'https://new.example.com/responses');
  assert.equal(accounts[0].apiKey, 'sk-old');
  assert.equal(next[1], accounts[1]);
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

test('account detail save failures are visible inside the modal instead of looking inert', async () => {
  const source = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const saveBlock = source.match(/async function saveConfig\(\) \{[\s\S]*?\n  \}/)?.[0] ?? '';

  assert.match(source, /const \[saveError, setSaveError\] = useState\(''\)/);
  assert.match(source, /const saveErrorMessage = useMemo/);
  assert.match(source, /useEffect\(\(\) => \{[\s\S]*setSaveError\(''\);[\s\S]*\}, \[configDraft\]\)/);
  assert.match(saveBlock, /setSaveError\(''\)/);
  assert.match(saveBlock, /catch \(error\) \{[\s\S]*setSaveError\(toErrorMessage\(error\)\)/);
  assert.match(source, /saveErrorMessage \? \([\s\S]*<AccountDetailStatusNotice message=\{saveErrorMessage\}/);
  assert.ok(
    saveBlock.indexOf('await onSaveConfig(configDraft)') < saveBlock.indexOf('onClose();'),
    'save must not close the detail modal until the failing save path has been skipped',
  );
});

test('api-key config save has an explicit browser preview path', async () => {
  const source = await readFile(new URL('../hooks/useAccountsActions.ts', import.meta.url), 'utf8');
  const saveBlock = source.match(/const updateSelectedApiKeyConfig = useCallback\([\s\S]*?\n  \);/)?.[0] ?? '';

  assert.match(saveBlock, /if \(!hasWailsAppBindings\(\)\) \{/);
  assert.match(saveBlock, /patchAccountLocally\(selectedAccount\.id, \{/);
  assert.match(saveBlock, /formatBaseUrls: nextFormatBaseURLs/);
  assert.match(saveBlock, /quotaCurl: nextQuotaCurl/);
  assert.match(saveBlock, /return;/);
});

test('api-key detail rename and priority saves patch the local list copy before reload', async () => {
  const source = await readFile(new URL('../hooks/useAccountsActions.ts', import.meta.url), 'utf8');
  const renameStart = source.indexOf('const renameSelectedApiKey = useCallback(');
  const priorityStart = source.indexOf('const updateSelectedApiKeyPriority = useCallback(', renameStart);
  const configStart = source.indexOf('const updateSelectedApiKeyConfig = useCallback(', priorityStart);
  const renameBlock = source.slice(renameStart, priorityStart);
  const priorityBlock = source.slice(priorityStart, configStart);

  assert.ok(renameStart >= 0, 'renameSelectedApiKey block should exist');
  assert.ok(priorityStart > renameStart, 'updateSelectedApiKeyPriority block should follow renameSelectedApiKey');
  assert.match(renameBlock, /patchAccountLocally\(selectedAccount\.id, \{/);
  assert.match(renameBlock, /displayName: trimmedName \|\| fallbackAPIKeyDisplayName\(selectedAccount\.apiKey \|\| ''\)/);
  assert.ok(
    renameBlock.indexOf('patchAccountLocally(selectedAccount.id') < renameBlock.indexOf('await loadAccounts({ refreshSupplementalData: false })'),
    'rename should patch local records before relying on reload',
  );
  assert.doesNotMatch(renameBlock, /setSelectedAccount\(\(prev\) =>/);

  assert.match(priorityBlock, /patchAccountLocally\(selectedAccount\.id, \{\s*priority: nextPriority,\s*\}\)/);
  assert.ok(
    priorityBlock.indexOf('patchAccountLocally(selectedAccount.id') < priorityBlock.indexOf('await loadAccounts({ refreshSupplementalData: false })'),
    'priority should patch local records before relying on reload',
  );
  assert.doesNotMatch(priorityBlock, /setSelectedAccount\(\(prev\) =>/);
});

test('openai-compatible detail config save patches the local list copy before reload', async () => {
  const source = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');
  const saveStart = source.indexOf('const saveSelectedApiLikeConfig = useCallback(');
  const nextBlockStart = source.indexOf('const resolveLocalCliMappingsForAccount = useCallback(', saveStart);
  const saveBlock = source.slice(saveStart, nextBlockStart);
  const patchCalls = saveBlock.match(/patchAccountLocally\(selectedAccount\.id, \{/g) ?? [];

  assert.ok(saveStart >= 0, 'saveSelectedApiLikeConfig block should exist');
  assert.match(source, /patchAccountLocally,/);
  assert.equal(patchCalls.length, 2);
  assert.match(saveBlock, /formatBaseUrls: nextFormatBaseURLs/);
  assert.match(saveBlock, /apiKeys: nextAPIKeys/);
  assert.ok(
    saveBlock.lastIndexOf('patchAccountLocally(selectedAccount.id') < saveBlock.indexOf('await loadAccounts({ refreshSupplementalData: false })'),
    'openai-compatible save should patch local records before relying on reload',
  );
  assert.doesNotMatch(saveBlock, /setSelectedAccount\(\(prev\) =>/);
});
test('account detail header removes status pill and uses type label for codex auth-file', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /const operationalState = resolveAccountOperationalState/);
  assert.doesNotMatch(source, /operationalState\.label/);
  assert.match(source, /function resolveAccountHeaderTypeLabel/);
  assert.match(source, /return 'CODEX OAUTH'/);
  assert.match(source, /return 'CODEX API KEY'/);
  assert.match(source, /return 'OPENAI COMPATIBLE'/);
  assert.doesNotMatch(source, /resolveAccountPrimaryLabel\(account\)/);
});

test('account detail verify copy is scoped to sending one short message', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');

  assert.match(source, /连通验证/);
  assert.match(source, /发送验证/);
  assert.doesNotMatch(source, /发送一条短消息验证连通性/);
  assert.doesNotMatch(source, /send one short chat message only/);
  assert.doesNotMatch(source, /验证连接/);
  assert.doesNotMatch(source, /credential \+ proxy \+ model route/);
});
test('account detail footer status copy stays on a single line', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');

  assert.match(source, /data-account-detail-footer-status="single-line"/);
  assert.match(source, /whitespace-nowrap/);
  assert.match(source, /overflow-hidden/);
  assert.match(source, /text-ellipsis/);
});
test('account detail credential fields are plaintext and use balanced grid spacing hooks', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');

  assert.match(source, /data-account-credential-fields="balanced-grid"/);
  assert.match(source, /data-account-credential-field="plaintext"/);
  assert.doesNotMatch(source, /type=\{secret \? 'password' : 'text'\}/);
  assert.doesNotMatch(source, /type="password"/);
});

test('codex auth-file detail is database config management, not raw file summary', async () => {
  const source = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');

  assert.match(source, /账号名称/);
  assert.match(source, /配置预览/);
  assert.match(source, /下载配置/);
  assert.match(source, /应用配置/);
  assert.match(source, /SQLite account store/);
  assert.doesNotMatch(source, /文件摘要/);
  assert.doesNotMatch(source, /脱敏/);
  assert.doesNotMatch(source, /复制原文/);
});
test('account detail proxy route only selects saved proxy nodes', async () => {
  const source = await readFile(new URL('../components/AccountProxyRouteSection.tsx', import.meta.url), 'utf8');

  assert.match(source, /data-account-proxy-route-editor="saved-node-only"/);
  assert.doesNotMatch(source, /\(\['inherit', 'direct', 'custom'\] as const\)\.map/);
  assert.doesNotMatch(source, /onModeChange: \(mode: AccountProxyMode\) => void/);
  assert.match(source, /账号详情只选择已保存的代理池节点/);
});

test('auth-file compatible model catalog renders source-to-route mapping cards', async () => {
  const source = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const modelGridBlock = source.match(/<div data-account-model-mapping-grid="source-route"[\s\S]*?<datalist id="account-detail-model-source-options">/)?.[0] ?? '';

  assert.match(source, /data-account-model-mapping-grid="source-route"/);
  assert.match(source, /data-account-model-mapping-card=\{editable \? 'editable' : 'readonly'\}/);
  assert.match(source, /data-account-model-mapping-input="source"/);
  assert.match(source, /data-account-model-mapping-input="alias"/);
  assert.doesNotMatch(source, /data-account-model-default-list="true"/);
  assert.doesNotMatch(source, /当前账号支持模型<\/div>/);
  assert.match(source, /import \{ RefreshCw, Trash2 \} from 'lucide-react'/);
  assert.match(source, /aria-label="拉取模型"/);
  assert.match(source, /<RefreshCw/);
  assert.match(source, /填入支持模型/);
  assert.doesNotMatch(source, />默认模型</);
  assert.doesNotMatch(source, />Source Model</);
  assert.doesNotMatch(source, />Alias \/ Route</);
  assert.match(source, /sourceModelOptionNames/);
  assert.match(source, /aliasModelOptionNames/);
  assert.match(source, /import \{ Combobox \} from '..\/..\/..\/components\/ui\/Combobox\.tsx'/);
  assert.match(source, /data-account-model-mapping-input="source"[\s\S]*<Combobox[\s\S]*options=\{sourceModelOptionNames\}/);
  assert.match(source, /data-account-model-mapping-input="alias"[\s\S]*<Combobox[\s\S]*options=\{aliasModelOptionNames\}/);
  assert.doesNotMatch(source, /align="right"/);
  assert.doesNotMatch(source, /account-detail-model-source-options/);
  assert.doesNotMatch(source, /account-detail-model-alias-options/);
  assert.doesNotMatch(modelGridBlock, /max-h-40/);
  assert.doesNotMatch(modelGridBlock, /overflow-auto/);
  assert.match(source, /aria-label="删除映射"/);
  assert.match(source, /<Trash2/);
  assert.match(source, /暂无模型映射；可拉取模型后添加映射，或直接手动添加。/);
  assert.match(source, /title="模型映射"/);
  assert.match(source, /title="模型映射"[\s\S]*bandActionDivider=\{false\}/);
  assert.match(source, /onAddModelMapping/);
  assert.match(source, /fetchRemoteModelMappings/);
  assert.match(source, /applyDefaultModelMappings/);
  assert.match(source, /已新增映射/);
  assert.match(source, /暂无当前账号支持模型，可先拉取模型或手动添加映射/);
  assert.match(source, /sourceModelOptionNames\.map\(\(name\) => \(\{ name, alias: '' \}\)\)/);
  const fetchBlock = source.match(/async function fetchRemoteModelMappings\(\)[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.doesNotMatch(fetchBlock, /setConfigDraftModels/);
  assert.match(fetchBlock, /已缓存 \$\{nextNames\.length\} 个当前账号支持模型/);
  const defaultModelBlock = source.match(/function resolveDefaultModelMappingNames[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(defaultModelBlock, /accountModelNames/);
  assert.match(defaultModelBlock, /presetModelNames/);
  assert.doesNotMatch(defaultModelBlock, /modelNames/);
  assert.doesNotMatch(defaultModelBlock, /gpt-5\.4/);
});

test('api-key detail model mappings are part of the saved config draft', async () => {
  const configSource = await readFile(new URL('../model/accountDetailConfig.ts', import.meta.url), 'utf8');
  const modalSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const actionsSource = await readFile(new URL('../hooks/useAccountsActions.ts', import.meta.url), 'utf8');
  const featureSource = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');

  assert.match(configSource, /models: Array<\{ name: string; alias\?: string \}>/);
  assert.match(configSource, /normalizeApiKeyConfigModels\(account\.models\)/);
  assert.match(configSource, /!isSameApiKeyConfigModels\(current\.models, draft\.models\)/);
  assert.match(modalSource, /setDraft\(\(prev\) => \(\{ \.\.\.prev, models: nextModels \}\)\)/);
  assert.match(actionsSource, /models: normalizeApiKeyConfigModels\(draft\.models\)/);
  assert.match(actionsSource, /models: nextModels/);
  assert.match(featureSource, /selectedAccountCanSaveApiConfig/);
  assert.match(featureSource, /UpdateOpenAICompatibleProvider/);
  assert.match(featureSource, /models: nextModels/);
  assert.match(modalSource, /onFetchModels\?: \(input: \{ apiKey: string; baseUrl: string; headers\?: Record<string, string> \}/);
  assert.match(modalSource, /localModelNames\?: string\[\]/);
  assert.match(modalSource, /cachedModelNames\?: string\[\]/);
  assert.match(featureSource, /localModelNames=\{relayModelNames\}/);
  assert.match(featureSource, /cachedModelNames=\{accountModelNamesByID\[selectedAccount\.id\] \?\? \[\]\}/);
  assert.match(featureSource, /setAccountModelNamesByID/);
  assert.match(modalSource, /resolveDefaultModelMappingNames/);
  assert.match(featureSource, /FetchOpenAICompatibleProviderModels/);
});

test('account copy import and model fetch preserve multi-endpoint account config', async () => {
  const actionsSource = await readFile(new URL('../hooks/useAccountsActions.ts', import.meta.url), 'utf8');
  const modalSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');

  assert.match(actionsSource, /formatBaseUrls:\s*item\.formatBaseUrls/);
  assert.match(modalSource, /resolveManagementBaseUrl\(\{ baseUrl: draft\.baseUrl, formatBaseUrls: draft\.formatBaseUrls \}\)/);
  assert.match(modalSource, /baseUrl:\s*resolveManagementBaseUrl\(\{ baseUrl: draft\.baseUrl, formatBaseUrls: draft\.formatBaseUrls \}\)/);
});
test('auth-file config management keeps apply API boundary explicit', async () => {
  const source = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const primitiveSource = await readFile(new URL('../components/AccountDetailPrimitives.tsx', import.meta.url), 'utf8');
  const authFileBlock = source.match(/function AuthFileSummarySection[\s\S]*?\nfunction CompatibleModelsSection/)?.[0] ?? '';

  assert.match(source, /data-auth-file-config-management="ui-placeholder"/);
  assert.match(source, /data-auth-file-config-action="preview"/);
  assert.match(source, /data-auth-file-config-action="download"/);
  assert.match(source, /data-auth-file-config-action="apply"/);
  assert.match(authFileBlock, /bandActionDivider=\{false\}/);
  assert.match(authFileBlock, /data-auth-file-config-action="preview"[\s\S]*data-auth-file-config-action="download"[\s\S]*data-auth-file-config-action="apply"/);
  assert.doesNotMatch(authFileBlock, /md:grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(primitiveSource, /bandActionDivider = true/);
  assert.match(primitiveSource, /bandActionDividerClassName = bandActionDivider/);
  assert.match(source, /待接入 account-store management API/);
  assert.doesNotMatch(source, /ApplyAuthFileConfig/);
  assert.doesNotMatch(source, /SaveAuthFileConfig/);
});
test('real account detail modal uses v09 band row layout instead of card grid', async () => {
  const primitiveSource = await readFile(new URL('../components/AccountDetailPrimitives.tsx', import.meta.url), 'utf8');
  const modalSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');

  assert.match(primitiveSource, /AccountDetailModuleStackLayout = 'flow' \| 'cards' \| 'bands'/);
  assert.match(primitiveSource, /data-account-detail-section-layout="band"/);
  assert.match(primitiveSource, /data-account-detail-band-index/);
  assert.match(modalSource, /<AccountDetailModuleStack layout="bands">/);
  assert.doesNotMatch(modalSource, /<AccountDetailModuleStack layout="cards">/);
});
test('real account detail header uses the quiet two-column summary', async () => {
  const sectionSource = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const primitiveSource = await readFile(new URL('../components/AccountDetailPrimitives.tsx', import.meta.url), 'utf8');
  const modalSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');

  assert.match(sectionSource, /const accountDetailHeaderShellClass =/);
  assert.match(sectionSource, /const accountDetailHeaderRailClass =/);
  assert.match(sectionSource, /const accountDetailHeaderPillClass =/);
  assert.match(sectionSource, /data-account-detail-header="quiet"/);
  assert.match(sectionSource, /grid-cols-\[10\.5rem_minmax\(0,1fr\)\]/);
  assert.match(primitiveSource, /grid-cols-\[10\.5rem_minmax\(0,1fr\)\]/);
  assert.match(sectionSource, /data-account-detail-header-account-type/);
  assert.match(sectionSource, /\{accountTypeLabel\}/);
  assert.match(sectionSource, /data-account-detail-header-chips/);
  assert.match(sectionSource, /data-account-detail-header-description/);
  assert.match(sectionSource, /--gt-border-subtle/);
  assert.match(sectionSource, /--gt-surface-canvas/);
  assert.doesNotMatch(sectionSource, /data-account-detail-header-last/);
  assert.doesNotMatch(sectionSource, /Last<\/span><span>runtime/);
  assert.doesNotMatch(sectionSource, /Latency<\/span><span>—/);
  assert.match(sectionSource, /类型/);
  assert.match(sectionSource, /凭据/);
  assert.match(sectionSource, /验证/);
  assert.match(sectionSource, /路由/);
  assert.doesNotMatch(sectionSource, /text-base font-black uppercase italic/);
  assert.match(sectionSource, /whitespace-normal break-words \[overflow-wrap:break-word\]/);
  assert.doesNotMatch(sectionSource, /<span className="block truncate">\{primaryLabel\}/);
  assert.doesNotMatch(sectionSource, /onClick=\{\(\) => \(onRename \? setEditing\(true\) : null\)\}/);
  assert.match(modalSource, /headerClassName="p-0"/);
});

test('account detail shell primitives use the quiet workspace shell', async () => {
  const primitiveSource = await readFile(new URL('../components/AccountDetailPrimitives.tsx', import.meta.url), 'utf8');
  const targetSource = [
    sourceBlock(primitiveSource, 'export function AccountDetailSectionHeader({', 'export function AccountDetailSection({'),
    sourceBlock(primitiveSource, 'export function AccountDetailSection({', 'export function AccountDetailBody({'),
    sourceBlock(primitiveSource, 'export function AccountDetailBody({', 'export function AccountDetailOverviewGrid({'),
    sourceBlock(primitiveSource, 'export function AccountDetailModuleGrid({', 'export function AccountDetailModuleStack({'),
    sourceBlock(primitiveSource, 'export function AccountDetailModuleStack({', 'export function AccountDetailStatGrid({'),
  ].join('\n');

  assert.match(primitiveSource, /const accountDetailSectionHeaderDividerClass =/);
  assert.match(primitiveSource, /const accountDetailBandShellClass =/);
  assert.match(primitiveSource, /const accountDetailSectionShellBaseClass =/);
  assert.match(primitiveSource, /const accountDetailBodyClass =/);
  assert.match(primitiveSource, /const accountDetailModuleBandsClass =/);
  assert.match(targetSource, /data-account-detail-section-layout="band"/);
  assert.match(targetSource, /data-account-detail-body="module-surface"/);
  assert.match(targetSource, /data-account-detail-module-layout=\{layout\}/);
  assert.match(primitiveSource, /--gt-surface-canvas/);
  assert.match(primitiveSource, /--gt-surface-muted/);
  assert.match(primitiveSource, /--gt-border-subtle/);
  assert.doesNotMatch(targetSource, /border-2/);
  assert.doesNotMatch(targetSource, /border-t-2/);
  assert.doesNotMatch(targetSource, /border-r-2/);
  assert.doesNotMatch(targetSource, /border-l-2/);
  assert.doesNotMatch(targetSource, /bg-\[var\(--bg-main\)\]/);
  assert.doesNotMatch(targetSource, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(targetSource, /font-black/);
  assert.doesNotMatch(targetSource, /uppercase/);
  assert.doesNotMatch(targetSource, /tracking-\[0\.14em\]|tracking-\[0\.06em\]/);
});

test('account detail header chips and description are spaced without an internal divider', async () => {
  const sectionSource = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const middleHeaderBlock = sectionSource.match(/<div className="grid min-w-0 content-center gap-1[\s\S]*?<\/div>\n\s*<\/div>\n\s*\);/)?.[0] ?? '';

  assert.match(middleHeaderBlock, /content-center gap-1/);
  assert.match(middleHeaderBlock, /data-account-detail-header-description/);
  assert.doesNotMatch(middleHeaderBlock, /data-account-detail-header-description="true" className="[^"]*border-t/);
  assert.doesNotMatch(middleHeaderBlock, /border-r-2/);
});

test('account detail quota and billing render as v09 equal split only when billing is displayable', async () => {
  const source = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');

  assert.match(source, /hasDisplayableBilling/);
  assert.match(source, /const hasBillingModule = hasDisplayableBilling\(liveBilling\) \|\| configDraft\.billingEnabled/);
  assert.match(source, /const showBillingModule = hasBillingModule \|\| props\.activeScriptEditor === 'billing'/);
  assert.match(source, /\{showBalanceSplit \? \(/);
  assert.match(source, /data-account-balance-panel="quota-billing"/);
  assert.match(source, /data-account-balance-pane="quota-left"/);
  assert.match(source, /data-account-balance-pane="billing-right"/);
  assert.match(source, /data-account-balance-divider="full-height"/);
  assert.match(source, /grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)\]/);
  assert.match(source, /componentName="AccountBalanceSplitSection"/);
});

test('account detail balance keeps one quota module with windows left and script right when billing is empty', async () => {
  const source = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const sectionSource = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const quotaOnlyBlock = source.match(/data-account-balance-panel="quota-only"[\s\S]*?data-account-balance-pane="quota-full"[\s\S]*?\{quotaSection\}/)?.[0] ?? '';

  assert.match(source, /data-account-balance-panel="quota-only"/);
  assert.match(source, /data-account-balance-pane="quota-full"/);
  assert.match(quotaOnlyBlock, /className="grid min-w-0"/);
  assert.doesNotMatch(quotaOnlyBlock, /data-account-balance-divider="full-height"/);
  assert.doesNotMatch(quotaOnlyBlock, /billing-right/);
  assert.match(sectionSource, /layoutMode = 'split'/);
  assert.match(sectionSource, /data-account-quota-layout=\{layoutMode\}/);
  assert.match(sectionSource, /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)\]/);
  assert.match(sectionSource, /data-account-quota-pane="windows"/);
  assert.match(sectionSource, /data-account-quota-pane="script"/);
  assert.match(source, /layoutMode=\{showBalanceSplit \? 'stack' : 'split'\}/);
  assert.ok(
    sectionSource.indexOf('data-account-quota-pane="windows"') < sectionSource.indexOf('data-account-quota-pane="script"'),
    'quota windows should stay left and curl/script preview should move to the right pane',
  );
});

test('account detail hides quota section when quota module is unchecked and shows billing-only panel', async () => {
  const source = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const splitBlock = source.match(/\{showBalanceSplit \? \([\s\S]*?\) : showQuotaModule \? \(/)?.[0] ?? '';
  const quotaOnlyBlock = source.match(/\) : showQuotaModule \? \([\s\S]*?\) : showBillingModule \? \(/)?.[0] ?? '';
  const billingOnlyBlock = source.match(/\) : showBillingModule \? \([\s\S]*?\) : \(/)?.[0] ?? '';

  assert.match(source, /const showQuotaModule = configDraft\.quotaEnabled \|\| props\.activeScriptEditor === 'quota'/);
  assert.match(source, /const showBillingModule = hasBillingModule \|\| props\.activeScriptEditor === 'billing'/);
  assert.match(source, /const showBalanceSplit = showQuotaModule && showBillingModule/);
  assert.match(source, /data-account-balance-panel="billing-only"/);
  assert.match(source, /data-account-balance-pane="billing-full"/);
  assert.match(billingOnlyBlock, /\{billingSection\}/);
  assert.doesNotMatch(billingOnlyBlock, /\{quotaSection\}/);
  assert.match(quotaOnlyBlock, /\{quotaSection\}/);
  assert.doesNotMatch(quotaOnlyBlock, /\{billingSection\}/);
  assert.match(splitBlock, /\{quotaSection\}[\s\S]*\{billingSection\}/);
});

test('account detail uses vertical quota internals when quota and billing are both visible', async () => {
  const sectionSource = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const source = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');

  assert.match(sectionSource, /type AccountQuotaLayoutMode = 'split' \| 'stack'/);
  assert.match(sectionSource, /const quotaLayoutClassName = layoutMode === 'split'/);
  assert.match(sectionSource, /: 'grid min-w-0 gap-3'/);
  assert.match(source, /layoutMode=\{showBalanceSplit \? 'stack' : 'split'\}/);
  assert.match(source, /data-account-balance-panel="quota-billing"/);
});

test('account detail quota pane renders runtime windows before falling back to test result', async () => {
  const sectionSource = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');

  assert.match(sectionSource, /buildQuotaDisplay\(\{/);
  assert.match(sectionSource, /runtimeQuotaDisplay\.windows\.length/);
  assert.match(sectionSource, /visibleQuotaDisplay = quotaDisplay\?\.windows\?\.length[\s\S]*runtimeQuotaDisplay\.windows\.length[\s\S]*testQuotaDisplay/);
  assert.match(sectionSource, /visibleQuotaSource === 'runtime'/);
  assert.match(sectionSource, /visibleQuotaSource === 'test' \? 'QUOTA \(TEST\)' : 'QUOTA'/);
});

test('balance rail exposes quota and billing module checkboxes instead of a top-right add button', async () => {
  const source = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const primitiveSource = await readFile(new URL('../components/AccountDetailPrimitives.tsx', import.meta.url), 'utf8');

  assert.match(primitiveSource, /railControls\?: ReactNode/);
  assert.match(primitiveSource, /data-account-detail-band-rail-controls/);
  assert.match(source, /railControls=\{balanceRailControls\}/);
  assert.match(source, /data-account-balance-rail-toggle="quota"/);
  assert.match(source, /data-account-balance-rail-toggle="billing"/);
  assert.match(source, /checked=\{configDraft\.quotaEnabled\}/);
  assert.match(source, /checked=\{hasBillingModule\}/);
  assert.match(source, /const hasBillingModule = hasDisplayableBilling\(liveBilling\) \|\| configDraft\.billingEnabled/);
  assert.match(source, /const showBillingModule = hasBillingModule \|\| props\.activeScriptEditor === 'billing'/);
  assert.doesNotMatch(source, /添加余额模块/);
  const quotaToggleBlock = source.match(/const handleQuotaModuleToggle = \(checked: boolean\) => \{[\s\S]*?\n                \};/)?.[0] ?? '';
  const billingToggleBlock = source.match(/const handleBillingModuleToggle = \(checked: boolean\) => \{[\s\S]*?\n                \};/)?.[0] ?? '';

  assert.match(quotaToggleBlock, /quotaEnabled: checked/);
  assert.match(billingToggleBlock, /billingEnabled: checked/);
  assert.doesNotMatch(quotaToggleBlock, /onOpenScriptEditor/);
  assert.doesNotMatch(billingToggleBlock, /onOpenScriptEditor/);
  assert.match(source, /onOpenEditor=\{\(\) => props\.onOpenScriptEditor\?\.\('billing'\)\}/);
});

test('openai compatible account detail uses the single unified detail page', async () => {
  const featureSource = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');
  const unifiedSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(featureSource, /OpenAICompatibleDetailModal/);
  assert.doesNotMatch(featureSource, /openAICompatibleState\.detailDraft/);
  assert.doesNotMatch(featureSource, /openAICompatibleState\.openDetailModal/);
  assert.match(featureSource, /findOpenAICompatibleAccountForProvider/);
  assert.match(featureSource, /setSelectedAccount\(providerAccount\)/);
  assert.match(unifiedSource, /<AccountDetailModuleStack layout="bands">/);
});

test('account detail production path has one detail modal surface', async () => {
  const source = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');

  assert.equal((source.match(/<UnifiedAccountDetailModal/g) || []).length, 1);
  assert.doesNotMatch(source, /<OpenAICompatibleDetailModal/);
  assert.doesNotMatch(source, /<ApiKeyDetailModal/);
});

test('band detail sections reset nested modules so quota titles share the action row', async () => {
  const primitiveSource = await readFile(new URL('../components/AccountDetailPrimitives.tsx', import.meta.url), 'utf8');
  const sectionsSource = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const bandBlock = primitiveSource.match(/if \(isBandLayout\) \{[\s\S]*?\n  \}/)?.[0] ?? '';
  const quotaBlock = sectionsSource.match(/export function AccountQuotaSection[\s\S]*?\nexport function AccountBillingSection/)?.[0] ?? '';

  assert.match(
    bandBlock,
    /<AccountDetailModuleLayoutContext\.Provider value="flow">/,
    'band content must not force nested quota or billing sections to render another left rail',
  );
  assert.match(quotaBlock, /title="额度追踪"[\s\S]*?actions=\{quotaActions\}/);
  assert.doesNotMatch(quotaBlock, /data-account-detail-band-index/);
});

test('balance split child headers do not add extra top or dashed divider lines', async () => {
  const primitiveSource = await readFile(new URL('../components/AccountDetailPrimitives.tsx', import.meta.url), 'utf8');
  const sectionsSource = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const modalSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');

  assert.match(primitiveSource, /topBorder = true/);
  assert.match(primitiveSource, /headerDivider = true/);
  assert.match(primitiveSource, /dividerClassName = divider/);
  assert.equal((modalSource.match(/topBorder=\{false\}/g) || []).length, 2);
  assert.equal((modalSource.match(/headerDivider=\{false\}/g) || []).length, 2);
  assert.equal((sectionsSource.match(/!border-0 !bg-transparent/g) || []).length, 2);
});

test('nested account detail section headers use a compact title and action row', async () => {
  const primitiveSource = await readFile(new URL('../components/AccountDetailPrimitives.tsx', import.meta.url), 'utf8');

  assert.match(primitiveSource, /data-account-detail-section-title-row="compact"/);
  assert.match(primitiveSource, /data-account-detail-section-action-row="compact"/);
  assert.match(primitiveSource, /sm:items-center sm:justify-between/);
  assert.doesNotMatch(primitiveSource, /<div className="min-w-0 space-y-1">/);
});
