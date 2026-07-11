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
  if (!endMarker) {
    return source.slice(start);
  }
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
  assert.match(modalFrameSource, /import \{ Modal \} from 'antd'/);
  assert.match(modalFrameSource, /const detailFullscreen = size === 'detail'/);
  assert.match(modalFrameSource, /const insetForSidebar = position === 'fixed' && !detailFullscreen && !coverViewport/);
  assert.match(modalFrameSource, /const modalWidth = insetForSidebar \? sidebarInsetModalWidths\[size\] : modalWidths\[size\]/);
  assert.match(modalFrameSource, /100vw - var\(--app-sidebar-width, 0px\) - 3rem/);
  assert.match(modalFrameSource, /detailFullscreen[\s\S]*\? 'items-start justify-items-center overflow-hidden px-6 py-6 sm:px-8 sm:py-8'/);
  assert.match(modalFrameSource, /detailFullscreen[\s\S]*h-\[calc\(100vh_-_3rem\)\]/);
  assert.match(modalFrameSource, /sm:h-\[calc\(100vh_-_4rem\)\]/);
  assert.doesNotMatch(modalFrameSource, /calc\([^)]*[a-z%]\-[0-9.]/);
  assert.doesNotMatch(modalFrameSource, /max-[hw]-\[calc\([^'"]* - /);
  assert.match(modalFrameSource, /const shouldUseBodyContainer = detailFullscreen \|\| portal/);
  assert.match(modalFrameSource, /getContainer=\{getModalContainer\}/);
  assert.match(modalFrameSource, /width=\{modalWidth\}/);
  assert.doesNotMatch(modalFrameSource, /createPortal\(/);
});

test('account detail keeps auth-file modules scoped to oauth operations and quota reset', () => {
  const modulePlan = buildAccountDetailModulePlan({ credentialSource: 'auth-file' });

  assert.deepEqual(modulePlan, ['runtime', 'auth-file-actions', 'models', 'model-probe', 'rate-limit', 'quota']);
  assert.equal(modulePlan.includes('billing'), false);
  assert.equal(modulePlan.includes('model-routing'), false);
});

test('account detail section nav exposes local CLI apply actions from the account mapping', async () => {
  const featureSource = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');
  const modalSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const layoutSource = await readFile(new URL('../components/AccountDetailLayout.tsx', import.meta.url), 'utf8');
  const authFileSource = await readFile(new URL('../components/AccountDetailAuthFileSection.tsx', import.meta.url), 'utf8');
  const sectionsSource = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const styleSource = await readFile(new URL('../../../style.css', import.meta.url), 'utf8');
  const footerSource = sourceBlock(sectionsSource, 'export function AccountDetailFooter', 'function normalizeBillingDisplay');

  assert.match(featureSource, /localCliActions=\{resolveLocalCliActionsForAccount\(selectedAccount\)\.map/);
  assert.match(featureSource, /onSelect: \(\) => action\.onSelect\(\)/);
  assert.match(modalSource, /<AuthFileSummarySection[\s\S]*localCliActions=\{props\.localCliActions\}/);
  assert.match(authFileSource, /localCliActions\.map/);
  assert.match(authFileSource, /data-auth-file-config-local-cli-action=\{action\.id\}/);
  assert.match(authFileSource, /action\.disabledReason \|\| action\.detail \|\| action\.label/);
  assert.match(authFileSource, /disabled=\{action\.disabled\}/);
  assert.doesNotMatch(layoutSource, /data-account-detail-nav-local-cli-actions/);
  assert.doesNotMatch(layoutSource, /data-account-detail-nav-local-cli-action/);
  assert.match(layoutSource, /account-detail-section-nav-menu/);
  assert.match(styleSource, /\.account-detail-section-nav-menu \.ant-menu-item-selected \.ant-menu-title-content\s*\{[\s\S]*font-weight: 600;/);
  assert.doesNotMatch(footerSource, /localCliActions/);
  assert.doesNotMatch(footerSource, /data-account-detail-local-cli-actions/);
});

test('account detail layout delegates close to ModalFrame', async () => {
  const layoutSource = await readFile(new URL('../components/AccountDetailLayout.tsx', import.meta.url), 'utf8');
  const sectionsSource = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const modalSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const footerSource = sourceBlock(sectionsSource, 'export function AccountDetailFooter', 'function normalizeBillingDisplay');
  const layoutComponentSource = sourceBlock(layoutSource, 'export function AccountDetailLayout', undefined);
  const layoutReturnSource = sourceBlock(layoutComponentSource, 'return (', ');\n}');

  assert.match(layoutSource, /import \{ Menu \} from 'antd'/);
  assert.doesNotMatch(layoutSource, /import \{ Button, Menu, Tooltip \} from 'antd'/);
  assert.doesNotMatch(layoutSource, /import \{ X \} from 'lucide-react'/);
  assert.doesNotMatch(layoutSource, /onClose:\s*\(\) => void/);
  assert.doesNotMatch(layoutReturnSource, /data-account-detail-layout-close/);
  assert.doesNotMatch(layoutReturnSource, /aria-label="关闭面板"/);
  assert.doesNotMatch(modalSource, /<AccountDetailLayout[\s\S]*onClose=\{props\.onClose\}/);
  assert.doesNotMatch(footerSource, /onClose/);
  assert.doesNotMatch(footerSource, /data-account-detail-footer-leading-actions/);
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
  const modelsSource = await readFile(new URL('../components/AccountDetailModelsSection.tsx', import.meta.url), 'utf8');
  const accountProbeBlock = modalSource.match(/const canProbeOAuthAccount = account\.credentialSource === 'auth-file';[\s\S]*?return \(\n\s*<OAuthModelProbeSection/)?.[0] ?? '';

  assert.match(modalSource, /<OAuthModelProbeSection/);
  assert.match(modalSource, /onOAuthModelProbe/);
  assert.match(modalSource, /authFileModelNames/);
  assert.match(modalSource, /onAuthFileModelNamesChange=\{setAuthFileModelNames\}/);
  assert.match(accountProbeBlock, /\.\.\.authFileModelNames/);
  assert.doesNotMatch(accountProbeBlock, /props\.modelNames/);
  assert.doesNotMatch(accountProbeBlock, /props\.localModelNames/);
  assert.match(modelsSource, /onAuthFileModelNamesChange\?: \(modelNames: string\[\]\) => void/);
  assert.match(modelsSource, /onAuthFileModelNamesChange\?\.\(normalizeAuthFileModelNames\(nextModels\)\)/);
  assert.match(featureSource, /ProbeCodexAccountRouting/);
  assert.match(featureSource, /allowAccountIDs:\s*\[selectedAccount\.id\]/);
  assert.match(featureSource, /orderAccountIDs:\s*\[selectedAccount\.id\]/);
  assert.match(featureSource, /allowFallback:\s*false/);
  assert.doesNotMatch(featureSource, /selectedAccountCanProbeOAuthModel[\s\S]{0,140}startsWith\("acct_"\)/);
});

test('OAuthModelProbeSection uses the quiet workspace control shell', async () => {
  const source = await readFile(new URL('../components/OAuthModelProbeSection.tsx', import.meta.url), 'utf8');
  const styleSource = await readFile(new URL('../../../style.css', import.meta.url), 'utf8');
  const comboboxBlock = source.match(/<Combobox[\s\S]*?\/>/)?.[0] ?? '';

  assert.match(source, /const oauthModelProbeFieldLabelClass =/);
  assert.match(source, /import \{ Button \} from 'antd'/);
  assert.match(source, /<Button[\s\S]*data-oauth-model-probe-button="run"/);
  assert.match(source, /data-oauth-model-probe-shell="quiet"/);
  assert.match(source, /data-oauth-model-probe-button="run"/);
  assert.match(source, /data-oauth-model-probe-status=\{currentStatus\}/);
  assert.match(source, /Combobox/);
  assert.match(comboboxBlock, /className="w-full"/);
  assert.match(comboboxBlock, /popupMatchSelectWidth=\{false\}/);
  assert.match(comboboxBlock, /popupClassName="gettokens-oauth-model-probe-combobox-popup"/);
  assert.match(source, /probeState\?\.message \|\| ''/);
  assert.match(source, /\[accountID, defaultModel, options, probeState\?\.model\]/);
  assert.doesNotMatch(source, /只允许当前 OAuth 账号参与本次路由探测/);
  assert.doesNotMatch(source, /fallback 已关闭/);
  assert.match(styleSource, /\.gettokens-oauth-model-probe-combobox-popup\s*\{/);
  assert.doesNotMatch(source, /btn-swiss/);
  assert.doesNotMatch(source, /border-2/);
  assert.doesNotMatch(source, /font-(?:medium|bold|extrabold|black)/);
  assert.doesNotMatch(source, /uppercase/);
  assert.doesNotMatch(source, /tracking-\[/);
  assert.doesNotMatch(source, /--color-status-/);
});

test('Combobox exposes AntD popup sizing hooks for long model options', async () => {
  const source = await readFile(new URL('../../../components/ui/Combobox.tsx', import.meta.url), 'utf8');

  assert.match(source, /popupMatchSelectWidth\?: boolean \| number/);
  assert.match(source, /popupClassName\?: string/);
  assert.match(source, /popupMatchSelectWidth = true/);
  assert.match(source, /popupClassName = ''/);
  assert.match(source, /popupMatchSelectWidth=\{popupMatchSelectWidth\}/);
  assert.match(source, /classNames=\{popupClassName \? \{ popup: \{ root: popupClassName \} \} : undefined\}/);
});

test('auth-file summary keeps raw content hidden and retains model catalog', async () => {
  const source = await readFile(new URL('../components/AccountDetailAuthFileSection.tsx', import.meta.url), 'utf8');
  const modalSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const modelSource = await readFile(new URL('../components/AccountDetailModelsSection.tsx', import.meta.url), 'utf8');

  assert.match(source, /componentName="AuthFileSummarySection"/);
  assert.doesNotMatch(source, /componentName="AuthFileSummarySection"[\s\S]{0,180}span="wide"/);
  assert.match(modelSource, /componentName="CompatibleModelsSection"/);
  assert.match(modalSource, /case 'models':/);
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

test('api key credential module uses vertical credential and connection layout', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const modalSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const targetSource = sourceBlock(source, 'export function AccountCredentialVerifySection', 'function CapabilityEndpointsPanel');

  assert.match(source, /export function AccountCredentialVerifySection/);
  assert.match(source, /data-account-credential-verify-layout="card-vertical"/);
  assert.match(targetSource, /flex flex-col/);
  assert.doesNotMatch(targetSource, /lg:grid-cols-/);
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

test('api key credential module keeps fields and verify row from clipping in the modal', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const inputSource = sourceBlock(source, 'function CredentialInputField', 'function VerifyConnectionPanel');
  const verifySource = sourceBlock(source, 'function VerifyConnectionPanel', 'export function AccountQuotaSection');

  assert.doesNotMatch(inputSource, /max-w-sm/);
  assert.match(inputSource, /<Input[\s\S]*className="w-full font-mono"/);
  assert.match(verifySource, /grid gap-3 sm:grid-cols-\[minmax\(0,1fr\)_auto\] sm:items-center/);
  assert.match(verifySource, /<Select[\s\S]*className="w-full"/);
  assert.match(verifySource, /<Button[\s\S]*className="whitespace-nowrap"/);
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
  assert.match(endpointsBlock, /data-account-credential-list-item="capability-endpoints" className="rounded-lg border border-\[var\(--gt-border-subtle\)\] bg-\[var\(--gt-surface-canvas\)\] p-5 shadow-sm grid gap-4"/);
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
  const authFileSource = await readFile(new URL('../components/AccountDetailAuthFileSection.tsx', import.meta.url), 'utf8');
  const modelSource = await readFile(new URL('../components/AccountDetailModelsSection.tsx', import.meta.url), 'utf8');

  assert.match(featureSource, /getAccountsPreviewRelayModelNames/);
  assert.match(featureSource, /if \(!hasWailsAppBindings\(\)\) \{/);
  assert.match(authFileSource, /getAccountsPreviewAuthFileContent/);
  assert.match(modelSource, /getAccountsPreviewAuthFileModels/);
  assert.match(authFileSource, /setRawContent\(content\);[\s\S]*?setLoading\(false\);[\s\S]*?return;/);
  assert.match(modelSource, /setModels\(previewModels\);[\s\S]*?setLoading\(false\);[\s\S]*?return;/);
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

test('unified compose modal uses the quiet workspace shell', async () => {
  const source = await readFile(new URL('../components/UnifiedComposeModal.tsx', import.meta.url), 'utf8');
  const targetSource = [
    sourceBlock(source, 'export default function UnifiedComposeModal', 'function UnifiedComposeCredentialFieldsSection'),
    sourceBlock(source, 'function CredentialFieldGroup', 'function readUnifiedComposeCredentialField'),
    sourceBlock(source, 'function UnifiedComposeCurlConfigSection', 'function UnifiedComposeHeader'),
    sourceBlock(source, 'function UnifiedComposeHeader', 'function UnifiedComposeFooter'),
    sourceBlock(source, 'function UnifiedComposeFooter', null),
  ].join('\n');

  assert.match(source, /const unifiedComposeProviderCardClass =/);
  assert.match(source, /const unifiedComposeProviderChipClass =/);
  assert.match(source, /const unifiedComposeEndpointRowClass =/);
  assert.match(source, /const unifiedComposeCurlButtonClass =/);
  assert.match(source, /const unifiedComposeFooterPrimaryButtonClass =/);
  assert.match(targetSource, /data-unified-compose-provider-picker/);
  assert.match(targetSource, /data-unified-compose-provider-grid/);
  assert.match(targetSource, /data-unified-compose-provider-card/);
  assert.match(targetSource, /data-unified-compose-endpoint-row/);
  assert.match(targetSource, /data-unified-compose-curl-card=\{kind\}/);
  assert.match(targetSource, /data-unified-compose-header/);
  assert.match(targetSource, /data-unified-compose-footer/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(targetSource, /AccountDetailPill/);
  assert.doesNotMatch(targetSource, /btn-swiss|input-swiss|select-swiss/);
  assert.doesNotMatch(targetSource, /border-2|border-t-2|border-b-2/);
  assert.doesNotMatch(targetSource, /border-dashed/);
  assert.doesNotMatch(targetSource, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(targetSource, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(targetSource, /color-status-/);
  assert.doesNotMatch(targetSource, /font-(?:medium|bold|extrabold|black)/);
  assert.doesNotMatch(targetSource, /uppercase/);
  assert.doesNotMatch(targetSource, /tracking-\[0\.08em\]|tracking-\[0\.12em\]|tracking-\[0\.14em\]|tracking-\[0\.18em\]|tracking-\[0\.2em\]/);
  assert.doesNotMatch(targetSource, /shadow-hard|shadow-\[/);
});

test('account detail modal frame forwards footer slots to the shared modal shell', async () => {
  const source = await readFile(new URL('../components/AccountDetailModalFrame.tsx', import.meta.url), 'utf8');

  assert.match(source, /footer=\{footer\}/);
  assert.match(source, /footerClassName=\{footerClassName\}/);
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

test('account curl editor modal uses the quiet workspace shell', async () => {
  const source = await readFile(new URL('../components/AccountCurlEditorModal.tsx', import.meta.url), 'utf8');
  const targetSource = sourceBlock(source, 'export function AccountCurlEditorModal', 'export function buildCurlVariables');

  assert.match(source, /const accountCurlEditorHeaderClass =/);
  assert.match(source, /const accountCurlEditorPanelClass =/);
  assert.match(source, /import \{ Button, Checkbox \} from 'antd'/);
  assert.match(source, /<textarea[\s\S]*ref=\{textareaRef\}/);
  assert.match(source, /className=\{accountCurlEditorTextareaClass\}/);
  assert.match(source, /const accountCurlEditorTextareaClass =/);
  assert.match(source, /const accountCurlEditorVariableButtonClass =/);
  assert.match(targetSource, /data-account-curl-editor-header/);
  assert.match(targetSource, /data-account-curl-editor-body/);
  assert.match(targetSource, /data-account-curl-editor-script-panel/);
  assert.match(targetSource, /data-account-curl-editor-variable-grid/);
  assert.match(targetSource, /data-account-curl-editor-template-panel/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.doesNotMatch(targetSource, /btn-swiss/);
  assert.doesNotMatch(targetSource, /input-swiss/);
  assert.doesNotMatch(targetSource, /border-2|border-t-2|border-b-2|border-r-2/);
  assert.doesNotMatch(targetSource, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(targetSource, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(targetSource, /font-(?:medium|bold|extrabold|black)/);
  assert.doesNotMatch(targetSource, /uppercase/);
  assert.doesNotMatch(targetSource, /tracking-\[0\.08em\]|tracking-\[0\.14em\]|tracking-\[0\.18em\]|tracking-\[0\.2em\]/);
  assert.doesNotMatch(targetSource, /shadow-\[/);
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
  assert.match(billingBlock, /aria-label="添加"/);
  assert.match(billingBlock, /icon=\{<Plus size=\{14\} \/>}/);
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
});

test('quota and billing curl editors are driven by account detail script hash routes', async () => {
  const featureSource = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');
  const detailSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const sectionSource = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const navigationSource = await readFile(new URL('../../../hooks/useAppNavigation.ts', import.meta.url), 'utf8');

  assert.match(featureSource, /buildAccountDetailScriptFrameHash/);
  assert.match(featureSource, /clearAccountDetailScriptFrameHash/);
  assert.match(featureSource, /setAccountDetailScriptFromHash\(hashState\?\.accountDetailScript \?\? [\"'][\"']\)/);
  assert.match(featureSource, /activeScriptEditor=\{[\s\S]*?selectedAccount\.id === accountDetailIDFromHash[\s\S]*?\? accountDetailScriptFromHash \|\| null[\s\S]*?: null[\s\S]*?\}/);
  assert.match(detailSource, /activeScriptEditor\?: 'quota' \| 'billing' \| null/);
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

  assert.match(source, /async function saveConfig\(\) \{/);
  assert.match(source, /await props\.onSaveConfig\(configDraft\)/);
  assert.match(source, /const saved = await rateLimitRulesRef\.current\?\.save\(\)/);
  assert.match(source, /if \(saved === false\) return;/);
  assert.match(source, /props\.onClose\(\);/);
  assert.ok(
    source.indexOf('await props.onSaveConfig(configDraft)') < source.indexOf('props.onClose();'),
    'detail modal must close after save completes',
  );
});

test('account detail save failures are visible inside the modal instead of looking inert', async () => {
  const source = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');

  assert.match(source, /const \[saveError, setSaveError\] = useState\(''\)/);
  assert.match(source, /const saveErrorMessage = useMemo/);
  assert.match(source, /useEffect\(\(\) => \{[\s\S]*setSaveError\(''\);[\s\S]*\}, \[configDraft\]\)/);
  assert.match(source, /setSaveError\(''\)/);
  assert.match(source, /catch \(error\) \{[\s\S]*setSaveError\(toErrorMessage\(error\)\)/);
  assert.match(source, /saveErrorMessage \? \([\s\S]*<AccountDetailNotice tone="danger"/);
  assert.ok(
    source.indexOf('await props.onSaveConfig(configDraft)') < source.indexOf('props.onClose();'),
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

test('api-key detail rename and priority saves consume mutation records without inventory reload', async () => {
  const source = await readFile(new URL('../hooks/useAccountsActions.ts', import.meta.url), 'utf8');
  const renameStart = source.indexOf('const renameSelectedApiKey = useCallback(');
  const priorityStart = source.indexOf('const updateSelectedApiKeyPriority = useCallback(', renameStart);
  const configStart = source.indexOf('const updateSelectedApiKeyConfig = useCallback(', priorityStart);
  const renameBlock = source.slice(renameStart, priorityStart);
  const priorityBlock = source.slice(priorityStart, configStart);

  assert.ok(renameStart >= 0, 'renameSelectedApiKey block should exist');
  assert.ok(priorityStart > renameStart, 'updateSelectedApiKeyPriority block should follow renameSelectedApiKey');
  assert.match(renameBlock, /const updatedAccount = await trackRequest/);
  assert.match(renameBlock, /expectedRevision: selectedAccount\.revision/);
  assert.match(renameBlock, /patchAccountLocally\(selectedAccount\.id, mapBackendAccountRecord\(updatedAccount\)\)/);
  assert.doesNotMatch(renameBlock, /loadAccounts/);
  assert.doesNotMatch(renameBlock, /setSelectedAccount\(\(prev\) =>/);

  assert.match(priorityBlock, /const updatedAccount = await trackRequest/);
  assert.match(priorityBlock, /expectedRevision: selectedAccount\.revision/);
  assert.match(priorityBlock, /patchAccountLocally\(selectedAccount\.id, mapBackendAccountRecord\(updatedAccount\)\)/);
  assert.doesNotMatch(priorityBlock, /loadAccounts/);
  assert.doesNotMatch(priorityBlock, /setSelectedAccount\(\(prev\) =>/);
});

test('openai-compatible detail config save consumes mutation record without inventory reload', async () => {
  const source = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');
  const saveStart = source.indexOf('const saveSelectedApiLikeConfig = useCallback(');
  const nextBlockStart = source.indexOf('const resolveLocalCliMappingsForAccount = useCallback(', saveStart);
  const saveBlock = source.slice(saveStart, nextBlockStart);
  assert.ok(saveStart >= 0, 'saveSelectedApiLikeConfig block should exist');
  assert.match(source, /patchAccountLocally,/);
  assert.match(saveBlock, /const updatedAccount = await trackRequest/);
  assert.match(saveBlock, /patchAccountLocally\(selectedAccount\.id, mapBackendAccountRecord\(updatedAccount\)\)/);
  assert.doesNotMatch(saveBlock, /loadAccounts/);
  assert.doesNotMatch(saveBlock, /setSelectedAccount\(\(prev\) =>/);
});

test('api-key config save is one atomic mutation and consumes its returned record', async () => {
  const source = await readFile(new URL('../hooks/useAccountsActions.ts', import.meta.url), 'utf8');
  const saveStart = source.indexOf('const updateSelectedApiKeyConfig = useCallback(');
  const saveEnd = source.indexOf('const formatBulkActionMessage = useCallback(', saveStart);
  const saveBlock = source.slice(saveStart, saveEnd);

  assert.match(saveBlock, /label: nextLabel/);
  assert.match(saveBlock, /expectedRevision: selectedAccount\.revision/);
  assert.equal((saveBlock.match(/UpdateCodexAPIKeyConfig\(/g) ?? []).length, 1);
  assert.doesNotMatch(saveBlock, /UpdateCodexAPIKeyLabel\(/);
  assert.match(saveBlock, /const updatedAccount = await trackRequest/);
  assert.match(saveBlock, /patchAccountLocally\(selectedAccount\.id, mapBackendAccountRecord\(updatedAccount\)\)/);
  assert.doesNotMatch(saveBlock, /loadAccounts/);
});

test('generated account mutation bindings return AccountRecord', async () => {
  const source = await readFile(new URL('../../../../wailsjs/go/main/App.d.ts', import.meta.url), 'utf8');

  assert.match(source, /SetAccountDisabled\(arg1:string,arg2:boolean\):Promise<main\.AccountRecord>/);
  assert.match(source, /UpdateCodexAPIKeyConfig\(arg1:main\.UpdateCodexAPIKeyConfigInput\):Promise<main\.AccountRecord>/);
  assert.match(source, /UpdateCodexAPIKeyLabel\(arg1:main\.UpdateCodexAPIKeyLabelInput\):Promise<main\.AccountRecord>/);
  assert.match(source, /UpdateCodexAPIKeyPriority\(arg1:main\.UpdateCodexAPIKeyPriorityInput\):Promise<main\.AccountRecord>/);
  assert.match(source, /UpdateOpenAICompatibleProvider\(arg1:main\.UpdateOpenAICompatibleProviderInput\):Promise<main\.AccountRecord>/);
});

test('account revision conflicts reload the latest detail instead of auto-merging writes', async () => {
  const featureSource = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');
  const pageStateSource = await readFile(new URL('../hooks/useAccountsPageState.ts', import.meta.url), 'utf8');
  const actionsSource = await readFile(new URL('../hooks/useAccountsActions.ts', import.meta.url), 'utf8');
  const revisionSource = await readFile(new URL('../model/accountRevision.ts', import.meta.url), 'utf8');

  assert.match(revisionSource, /account_revision_conflict/);
  assert.match(featureSource, /reason: "revision-conflict"/);
  assert.match(pageStateSource, /reason: 'revision-conflict'/);
  assert.match(featureSource, /GetAccountDetail\(accountID\)/);
  assert.match(pageStateSource, /GetAccountDetail\(accountID\)/);
  assert.match(actionsSource, /recoverAccountRevisionConflict\(error, selectedAccount\.id\)/);
  assert.doesNotMatch(revisionSource, /retry|merge/i);
});

test('account list summaries stay secret-free and details load on demand', async () => {
  const featureSource = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');
  const stateSource = await readFile(new URL('../hooks/useAccountsPageState.ts', import.meta.url), 'utf8');
  const summarySource = await readFile(new URL('../model/accountSummary.ts', import.meta.url), 'utf8');

  assert.match(featureSource, /GetAccountDetail\(accountID\)/);
  assert.match(featureSource, /selectedAccount\.detailLoaded/);
  assert.match(stateSource, /sanitizeAccountSummaryPatch\(patch\)/);
  for (const field of ['apiKey', 'apiKeys', 'headers', 'proxyUrl', 'authIndex', 'platformCookie', 'quotaCurl', 'billingCurl']) {
    assert.match(summarySource, new RegExp(`${field}: undefined`));
  }
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

test('account detail footer uses the quiet workspace action shell', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const layoutSource = await readFile(new URL('../components/AccountDetailLayout.tsx', import.meta.url), 'utf8');
  const targetSource = sourceBlock(source, 'export function AccountDetailFooter', 'function normalizeBillingDisplay');
  const sectionNavSource = sourceBlock(layoutSource, 'function SectionNav', '/* ── Layout: sidebar + scrollable content with scroll-spy ── */');

  assert.match(source, /const accountDetailFooterStatusClass =/);
  assert.match(source, /const accountDetailFooterActionsClass =/);
  assert.match(source, /import \{ .*Button, Input, Select, Tooltip.*\} from 'antd'/);
  assert.doesNotMatch(layoutSource, /const accountDetailNavLocalActionButtonClass =/);
  assert.doesNotMatch(sectionNavSource, /data-account-detail-nav-local-cli-actions/);
  assert.match(targetSource, /data-account-detail-footer-status="single-line"/);
  assert.match(targetSource, /data-account-detail-footer-actions/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.doesNotMatch(targetSource, /btn-swiss/);
  assert.doesNotMatch(targetSource, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(targetSource, /font-(?:medium|bold|extrabold|black)/);
  assert.doesNotMatch(targetSource, /uppercase/);
  assert.doesNotMatch(targetSource, /tracking-\[0\.08em\]/);
});

test('account detail credential fields are plaintext and use balanced grid spacing hooks', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');

  assert.match(source, /data-account-credential-fields="balanced-grid"/);
  assert.match(source, /data-account-credential-field="plaintext"/);
  assert.doesNotMatch(source, /type=\{secret \? 'password' : 'text'\}/);
  assert.doesNotMatch(source, /type="password"/);
});

test('codex auth-file detail exposes CPA data and local apply actions in config management', async () => {
  const source = await readFile(new URL('../components/AccountDetailAuthFileSection.tsx', import.meta.url), 'utf8');

  assert.match(source, /账号名称/);
  assert.match(source, /CPA 文件预览/);
  assert.match(source, /下载 CPA 文件/);
  assert.match(source, /data-auth-file-config-preview="cpa-json"/);
  assert.match(source, /h-\[52vh\]/);
  assert.match(source, /max-h-\[34rem\]/);
  assert.doesNotMatch(source, /title="配置管理"/);
  assert.match(source, /data-auth-file-config-local-cli-action=\{action\.id\}/);
  assert.match(source, /buildCPAAuthFileContentText/);
  assert.match(source, /downloadTextFile/);
  assert.doesNotMatch(source, /文件摘要/);
  assert.doesNotMatch(source, /脱敏/);
  assert.doesNotMatch(source, /复制原文/);
  assert.doesNotMatch(source, /配置预览基于账号数据库生成/);
});
test('account detail proxy route edits the account proxy url without proxy pool dependencies', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const targetSource = sourceBlock(source, 'function CredentialProxyRoutePanel', 'function VendorCredentialInputField');

  assert.match(targetSource, /data-account-credential-list-item="proxy-route"/);
  assert.match(targetSource, /direct 表示直连/);
  assert.match(targetSource, /onProxyUrlChange\?\.\(nextDraft\.proxyUrl\)/);
  assert.doesNotMatch(source, /AccountProxyRouteSection/);
  assert.doesNotMatch(source, /proxy-pool/);
  assert.doesNotMatch(source, /readStoredProxyNodes/);
  assert.doesNotMatch(source, /代理池/);
});

test('auth-file compatible model catalog renders source-to-route mapping cards', async () => {
  const source = await readFile(new URL('../components/AccountDetailModelsSection.tsx', import.meta.url), 'utf8');
  const modelGridBlock = source.match(/<div data-account-model-mapping-grid="source-route"[\s\S]*?<datalist id="account-detail-model-source-options">/)?.[0] ?? '';

  assert.match(source, /data-account-model-mapping-grid="source-route"/);
  assert.match(source, /data-account-model-mapping-card=\{editable \? 'editable' : 'readonly'\}/);
  assert.match(source, /modelReadonlyCardClass/);
  assert.match(source, /grid-cols-\[minmax\(0,1fr\)_2rem_minmax\(0,1fr\)\]/);
  assert.match(source, /data-account-model-mapping-input="source"/);
  assert.match(source, /data-account-model-mapping-input="alias"/);
  assert.match(source, /data-account-model-mapping-route-status/);
  assert.doesNotMatch(source, />只读</);
  assert.doesNotMatch(source, /<AccountDetailPill/);
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
  const modalSource = await readFile(new URL('../components/AccountDetailModelsSection.tsx', import.meta.url), 'utf8');
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
  const modalSource = await readFile(new URL('../components/AccountDetailModelsSection.tsx', import.meta.url), 'utf8');

  assert.match(actionsSource, /formatBaseUrls:\s*item\.formatBaseUrls/);
  assert.match(modalSource, /resolveManagementBaseUrl\(\{ baseUrl: draft\.baseUrl, formatBaseUrls: draft\.formatBaseUrls \}\)/);
  assert.match(modalSource, /baseUrl:\s*resolveManagementBaseUrl\(\{ baseUrl: draft\.baseUrl, formatBaseUrls: draft\.formatBaseUrls \}\)/);
});
test('auth-file config management downloads CPA files and moves local apply actions into the module header', async () => {
  const source = await readFile(new URL('../components/AccountDetailAuthFileSection.tsx', import.meta.url), 'utf8');
  const authFileBlock = sourceBlock(source, 'export function AuthFileSummarySection', 'function resolveCPAFilename');

  assert.match(source, /data-auth-file-config-management="quiet"/);
  assert.match(source, /data-auth-file-config-action="download-cpa"/);
  assert.match(source, /data-auth-file-config-local-cli-action=\{action\.id\}/);
  assert.match(authFileBlock, /data-auth-file-config-action="download-cpa"[\s\S]*localCliActions\.map/);
  assert.doesNotMatch(authFileBlock, /md:grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(source, /NormalizeAuthFileContent/);
  assert.match(source, /trackRequest\('NormalizeAuthFileContent'/);
  assert.doesNotMatch(source, /ApplyAuthFileConfig/);
  assert.doesNotMatch(source, /写回账号数据库并刷新运行时配置/);
  assert.doesNotMatch(source, /待接入 account-store management API/);
  assert.doesNotMatch(source, /SaveAuthFileConfig/);
});
test('real account detail modal uses section-nav layout instead of legacy band grid', async () => {
  const layoutSource = await readFile(new URL('../components/AccountDetailLayout.tsx', import.meta.url), 'utf8');
  const modalSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');

  assert.match(layoutSource, /function SectionNav/);
  assert.match(layoutSource, /aria-label="Account detail sections"/);
  assert.match(layoutSource, /data-account-detail-section/);
  assert.match(layoutSource, /accountDetailSection/);
  assert.match(layoutSource, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(layoutSource, /IntersectionObserver/);
  assert.match(layoutSource, /data-account-detail-section-nav="antd"/);
  assert.doesNotMatch(layoutSource, /data-account-detail-nav-local-cli-actions/);
  assert.match(layoutSource, /activeSectionID\?: string/);
  assert.match(layoutSource, /onActiveSectionChange\?: \(id: string\) => void/);
  assert.doesNotMatch(layoutSource, /!text-xs/);
  assert.match(modalSource, /header=\{<AccountDetailModalTitleBar/);
  assert.match(modalSource, /activeSectionID=\{activeSectionID\}/);
  assert.match(modalSource, /onActiveSectionChange=\{setActiveSectionID\}/);
  assert.doesNotMatch(modalSource, /<AccountDetailLayout[\s\S]*onClose=\{props\.onClose\}/);
  assert.doesNotMatch(modalSource, /<AccountDetailModuleStack layout="bands">/);
  assert.doesNotMatch(modalSource, /<AccountDetailModuleStack layout="cards">/);
});

test('real account detail modal titlebar uses account type and active section title', async () => {
  const sectionSource = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const modalSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const titlebarSource = sourceBlock(modalSource, 'const accountDetailModalTitleBarClass', 'const codexAccountDetailHeaderClass');

  assert.match(sectionSource, /data-account-detail-header="quiet"/);
  assert.match(sectionSource, /\{accountTypeLabel\}/);
  assert.match(sectionSource, /return 'CODEX OAUTH'/);
  assert.match(sectionSource, /return 'CODEX API KEY'/);
  assert.match(sectionSource, /return 'OPENAI COMPATIBLE'/);
  assert.match(modalSource, /function AccountDetailModalTitleBar/);
  assert.match(modalSource, /data-account-detail-modal-titlebar/);
  assert.match(modalSource, /data-account-detail-modal-type/);
  assert.match(modalSource, /data-account-detail-modal-title-divider/);
  assert.match(modalSource, /data-account-detail-modal-section-title/);
  assert.match(titlebarSource, /accountDetailModalTitleTypeClass[\s\S]*var\(--gt-font-size-lg\)/);
  assert.match(titlebarSource, /accountDetailModalSectionTitleClass[\s\S]*var\(--gt-font-size-lg\)/);
  assert.match(modalSource, /min-h-16/);
  assert.match(modalSource, /pr-16/);
  assert.doesNotMatch(modalSource, /headerClassName="hidden"/);
  assert.doesNotMatch(modalSource, /header=\{<AccountDetailHeader \{\.\.\.props\} \/>\}/);
  assert.doesNotMatch(titlebarSource, /accountDetailModalSectionTitleClass[\s\S]*var\(--gt-font-size-sm\)/);
  assert.doesNotMatch(sectionSource, /data-account-detail-header-chips/);
  assert.doesNotMatch(sectionSource, /!?text-(?:xs|sm|base|lg|xl|2xl|3xl)\b/);
  assert.doesNotMatch(sectionSource, /text-base font-(?:medium|bold|extrabold|black)/);
});

test('account detail primitives use the current quiet token shell', async () => {
  const primitiveSource = await readFile(new URL('../components/AccountDetailPrimitives.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(primitiveSource, /data-design-system-/);
  assert.match(primitiveSource, /bg-\[var\(--gt-surface-canvas\)\]/);
  assert.match(primitiveSource, /bg-\[var\(--gt-surface-muted\)\]/);
  assert.match(primitiveSource, /border-\[var\(--gt-border-subtle\)\]/);
  assert.match(primitiveSource, /--gt-status-success/);
  assert.match(primitiveSource, /--gt-status-warning/);
  assert.match(primitiveSource, /--gt-status-danger/);
  assert.match(primitiveSource, /text-\[length:var\(--gt-font-size-xs\)\]/);
  assert.doesNotMatch(primitiveSource, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(primitiveSource, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(primitiveSource, /font-(?:medium|bold|extrabold|black)/);
  assert.doesNotMatch(primitiveSource, /\btext-xs\b/);
});

test('account detail stat and evidence primitives render values without antd child extraction', async () => {
  const primitiveSource = await readFile(new URL('../components/AccountDetailPrimitives.tsx', import.meta.url), 'utf8');
  const statGridSource = sourceBlock(primitiveSource, 'export function AccountDetailStatGrid', 'export function AccountDetailStatCell');
  const statCellSource = sourceBlock(primitiveSource, 'export function AccountDetailStatCell', '/* ── Pill ── */');
  const evidenceGridSource = sourceBlock(primitiveSource, 'export function AccountDetailEvidenceGrid', 'export function AccountDetailEvidenceRow');
  const evidenceRowSource = sourceBlock(primitiveSource, 'export function AccountDetailEvidenceRow', '/* ── Legacy backward-compatible exports ── */');

  assert.doesNotMatch(primitiveSource, /Descriptions/);
  assert.match(statGridSource, /data-account-detail-stat-grid/);
  assert.match(statCellSource, /data-account-detail-stat-cell/);
  assert.match(statCellSource, /data-account-detail-stat-value/);
  assert.match(statCellSource, /\{value\}/);
  assert.match(evidenceGridSource, /data-account-detail-evidence-grid/);
  assert.match(evidenceRowSource, /data-account-detail-evidence-row/);
  assert.match(evidenceRowSource, /data-account-detail-evidence-value/);
  assert.match(evidenceRowSource, /\{value\}/);
});

test('account detail quota and billing render as stacked section-nav modules', async () => {
  const source = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');

  assert.match(source, /hasDisplayableBilling/);
  assert.match(source, /const hasBillingModule = hasDisplayableBilling\(liveBilling\) \|\| configDraft\.billingEnabled/);
  assert.match(source, /const showQuotaModule = configDraft\.quotaEnabled \|\| props\.activeScriptEditor === 'quota'/);
  assert.match(source, /const showBillingModule = hasBillingModule \|\| props\.activeScriptEditor === 'billing'/);
  assert.match(source, /<div className="space-y-6">/);
  assert.match(source, /<AccountQuotaSection[\s\S]*editorOpen=\{props\.activeScriptEditor === 'quota'\}/);
  assert.match(source, /<AccountBillingSection[\s\S]*editorOpen=\{props\.activeScriptEditor === 'billing'\}/);
  assert.doesNotMatch(source, /data-account-balance-panel=/);
  assert.doesNotMatch(source, /showBalanceSplit/);
});

test('account detail quota pane renders runtime windows before falling back to test result', async () => {
  const sectionSource = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(sectionSource, /text-\[10px\]/);
  assert.match(sectionSource, /buildQuotaDisplay\(\{/);
  assert.match(sectionSource, /runtimeQuotaDisplay\.windows\.length/);
  assert.match(sectionSource, /visibleQuotaDisplay = quotaDisplay\?\.windows\?\.length[\s\S]*runtimeQuotaDisplay\.windows\.length[\s\S]*testQuotaDisplay/);
  assert.match(sectionSource, /visibleQuotaSource === 'runtime'/);
  assert.match(sectionSource, /visibleQuotaSource === 'test' \? 'QUOTA \(TEST\)' : 'QUOTA'/);
});

test('unified account detail modal internals use the section-nav quiet workspace shell', async () => {
  const modalSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const layoutSource = await readFile(new URL('../components/AccountDetailLayout.tsx', import.meta.url), 'utf8');
  const authSource = await readFile(new URL('../components/AccountDetailAuthFileSection.tsx', import.meta.url), 'utf8');
  const modelSource = await readFile(new URL('../components/AccountDetailModelsSection.tsx', import.meta.url), 'utf8');

  assert.match(modalSource, /panelAttributes=\{\{ 'data-account-detail-modal': 'unified' \}\}/);
  assert.match(modalSource, /headerClassName="min-h-16 px-6 py-0 pr-16"/);
  assert.match(layoutSource, /bg-\[var\(--gt-surface-canvas\)\]/);
  assert.match(layoutSource, /border-\[var\(--gt-border-subtle\)\]/);
  assert.doesNotMatch(layoutSource, /fontSize:/);
  assert.match(authSource, /data-auth-file-config-management="quiet"/);
  assert.match(authSource, /data-auth-file-config-preview="cpa-json"/);
  assert.doesNotMatch(authSource, /data-auth-file-config-notice/);
  assert.match(modelSource, /data-account-model-mapping-grid="source-route"/);
  assert.match(modelSource, /data-account-model-mapping-card/);
  assert.doesNotMatch(modelSource, /text-\[10px\]/);
  assert.doesNotMatch(modalSource, /btn-swiss/);
  assert.doesNotMatch(modalSource, /input-swiss/);
  assert.doesNotMatch(modalSource, /data-account-balance-rail-toggle/);
});

test('openai compatible account detail uses the single unified detail page', async () => {
  const featureSource = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');
  const unifiedSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(featureSource, /OpenAICompatibleDetailModal/);
  assert.doesNotMatch(featureSource, /openAICompatibleState\.detailDraft/);
  assert.doesNotMatch(featureSource, /openAICompatibleState\.openDetailModal/);
  assert.match(featureSource, /findOpenAICompatibleAccountForProvider/);
  assert.match(featureSource, /setSelectedAccount\(providerAccount\)/);
  assert.match(unifiedSource, /<AccountDetailLayout[\s\S]*sectionNavItems=\{sectionNavItems\}/);
});

test('account detail production path has one detail modal surface', async () => {
  const source = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');

  assert.equal((source.match(/<UnifiedAccountDetailModal/g) || []).length, 1);
  assert.doesNotMatch(source, /<OpenAICompatibleDetailModal/);
  assert.doesNotMatch(source, /<ApiKeyDetailModal/);
});

test('section-nav detail sections keep quota actions in the section header', async () => {
  const sectionsSource = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const quotaBlock = sectionsSource.match(/export function AccountQuotaSection[\s\S]*?\nexport function AccountBillingSection/)?.[0] ?? '';

  assert.match(quotaBlock, /title="额度追踪"[\s\S]*?actions=\{quotaActions\}/);
  assert.doesNotMatch(quotaBlock, /data-account-detail-band-index/);
});

test('section-nav detail primitives do not carry legacy band divider controls', async () => {
  const primitiveSource = await readFile(new URL('../components/AccountDetailPrimitives.tsx', import.meta.url), 'utf8');
  const sectionsSource = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
  const modalSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(primitiveSource, /topBorder\?: boolean/);
  assert.doesNotMatch(primitiveSource, /headerDivider\?: boolean/);
  assert.doesNotMatch(sectionsSource, /topBorder\?: boolean/);
  assert.doesNotMatch(sectionsSource, /headerDivider\?: boolean/);
  assert.doesNotMatch(primitiveSource, /dividerClassName = divider/);
  assert.equal((modalSource.match(/topBorder=\{false\}/g) || []).length, 0);
  assert.equal((modalSource.match(/headerDivider=\{false\}/g) || []).length, 0);
});

test('nested account detail section headers use the current compact title and action stack', async () => {
  const primitiveSource = await readFile(new URL('../components/AccountDetailPrimitives.tsx', import.meta.url), 'utf8');

  assert.match(primitiveSource, /<Typography\.Title level=\{5\} className="!m-0 !font-semibold">/);
  assert.match(primitiveSource, /className="flex shrink-0 items-center gap-1"/);
  assert.doesNotMatch(primitiveSource, /<div className="min-w-0 space-y-1">/);
});
