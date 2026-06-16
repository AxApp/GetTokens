import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('local CLI apply controls preserve the source casing of displayed values', async () => {
  const styleSource = await readFile(new URL('../../../style.css', import.meta.url), 'utf8');
  const formFieldSource = await readFile(new URL('../../../components/ui/FormField.tsx', import.meta.url), 'utf8');
  const statusPanelSource = await readFile(new URL('../components/StatusPanels.tsx', import.meta.url), 'utf8');

  const btnSwissRule = styleSource.match(/\.btn-swiss\s*\{[\s\S]*?\n\s*\}/)?.[0] || '';
  const selectSwissRule = styleSource.match(/\.select-swiss\s*\{[\s\S]*?\n\s*\}/)?.[0] || '';
  assert.doesNotMatch(btnSwissRule, /text-transform:\s*uppercase/);
  assert.doesNotMatch(selectSwissRule, /text-transform:\s*uppercase/);
  assert.doesNotMatch(formFieldSource, /data-design-system-component-name="FieldLabel"[\s\S]{0,220}uppercase/);

  assert.doesNotMatch(
    statusPanelSource,
    /selectedEndpointBaseUrl[\s\S]{0,180}uppercase/
  );
  assert.doesNotMatch(statusPanelSource, /codexLocalApplyGuidance[\s\S]{0,240}uppercase/);
  assert.doesNotMatch(statusPanelSource, /localApplyMessage[\s\S]{0,220}uppercase/);
  assert.doesNotMatch(statusPanelSource, /claudeApplyMessage[\s\S]{0,220}uppercase/);
});

test('status local CLI Chinese copy keeps product and field casing explicit', async () => {
  const zh = JSON.parse(await readFile(new URL('../../../locales/zh.json', import.meta.url), 'utf8'));
  const status = zh.status;

  assert.equal(status.provider_title, 'Provider');
  assert.equal(status.provider_create_title, '新增 Provider');
  assert.equal(status.provider_id_label, 'model_provider');
  assert.equal(status.reasoning_effort_title, 'Reasoning Effort');
  assert.equal(status.auth_strategy_title, 'Auth Strategy');
  assert.equal(status.codex_local_auth_state_title, '本地 auth 状态');
  assert.equal(status.model_name_title, 'Model 名称');
  assert.equal(status.model_name_label, 'Model 名称');
  assert.equal(status.model_name_create_title, '新增 Model 名称');
});

test('status provider picker labels show only the model_provider id', async () => {
  const statusPanelSource = await readFile(new URL('../components/StatusPanels.tsx', import.meta.url), 'utf8');
  const storySource = await readFile(new URL('../components/StatusLocalCliApplyPanel.stories.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(statusPanelSource, /\$\{provider\.name\}\s*\/\s*\$\{provider\.id\}/);
  assert.doesNotMatch(storySource, /\{provider\.name\}\s*\/\s*\{provider\.id\}/);
  const labelFormatterSource = statusPanelSource.match(/export function formatRelayProviderSelectLabel[\s\S]*?\n}/)?.[0] || '';
  assert.match(labelFormatterSource, /return providerID;/);
  assert.doesNotMatch(labelFormatterSource, /ID:/);
});

test('status page header does not expose the retired sidecar management web panel', async () => {
  const statusFeatureSource = await readFile(new URL('../StatusFeature.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(statusFeatureSource, /resolveSidecarManagementWebOpenURL/);
  assert.doesNotMatch(statusFeatureSource, /function openStatusWeb/);
  assert.doesNotMatch(statusFeatureSource, /common\.open_web/);
  assert.doesNotMatch(statusFeatureSource, /BrowserOpenURL/);
  assert.doesNotMatch(statusFeatureSource, /management\.html/);
  assert.doesNotMatch(statusFeatureSource, /#frame=status/);
  assert.doesNotMatch(statusFeatureSource, /window\.location\.origin/);
});

test('status provider creation only asks for model_provider value', async () => {
  const relayEditorsSource = await readFile(new URL('../components/RelayEditors.tsx', import.meta.url), 'utf8');
  const statusFeatureSource = await readFile(new URL('../StatusFeature.tsx', import.meta.url), 'utf8');
  const zh = JSON.parse(await readFile(new URL('../../../locales/zh.json', import.meta.url), 'utf8'));

  const providerModalSource = relayEditorsSource.match(/export function RelayProviderEditorModal[\s\S]*?interface RelayModelEditorModalProps/)?.[0] || '';
  assert.match(providerModalSource, /status\.provider_id_label/);
  assert.doesNotMatch(providerModalSource, /status\.provider_name_label/);
  assert.doesNotMatch(providerModalSource, /editor\.providerName/);
  assert.equal(zh.status.provider_id_label, 'model_provider');
  assert.ok(!('provider_name_label' in zh.status));
  assert.match(statusFeatureSource, /providerName:\s*relayProviderEditor\.providerID/);
});

test('status model picker does not inject legacy GT fallback', async () => {
  const relayLocalStateSource = await readFile(new URL('../model/relayLocalState.ts', import.meta.url), 'utf8');
  const statusPanelSource = await readFile(new URL('../components/StatusPanels.tsx', import.meta.url), 'utf8');
  const statusFeatureSource = await readFile(new URL('../StatusFeature.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(relayLocalStateSource, /defaultRelayModelOptions\s*=\s*\[\s*['"]GT['"]/);
  assert.doesNotMatch(relayLocalStateSource, /\|\|\s*['"]GT['"]/);
  assert.doesNotMatch(statusPanelSource, /\|\|\s*['"]GT['"]/);
  assert.doesNotMatch(statusFeatureSource, /\|\|\s*['"]GT['"]/);
  assert.match(relayLocalStateSource, /defaultRelayModelOptions\s*=\s*\[RELAY_CODEX_DEFAULT_MODEL\]/);
});

test('status model catalog sync label opens a preview modal', async () => {
  const statusPanelSource = await readFile(new URL('../components/StatusPanels.tsx', import.meta.url), 'utf8');

  assert.match(statusPanelSource, /setModelCatalogPreviewOpen\(true\)/);
  assert.match(statusPanelSource, /aria-label="preview sync_model_catalog"/);
  assert.match(statusPanelSource, /Codex \/model 模型目录预览/);
  assert.match(statusPanelSource, /modelCatalogPreviewModels\.map/);
  assert.match(statusPanelSource, /<table className="w-max min-w-full border-collapse"/);
  assert.match(statusPanelSource, /<th scope="col"/);
  assert.match(statusPanelSource, /<tbody className="divide-y-2/);
  assert.match(statusPanelSource, /whitespace-nowrap/);
  assert.doesNotMatch(statusPanelSource, /md:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)_10rem\]/);
  assert.doesNotMatch(statusPanelSource, /md:grid-cols-\[max-content_max-content_max-content\]/);
});

test('status model catalog toggle writes config in both directions', async () => {
  const statusFeatureSource = await readFile(new URL('../StatusFeature.tsx', import.meta.url), 'utf8');

  assert.match(statusFeatureSource, /EnableGetTokensCodexModelCatalogProjection/);
  assert.match(statusFeatureSource, /DisableGetTokensCodexModelCatalogProjection/);
  assert.match(statusFeatureSource, /enableCodexModelCatalogProjection/);
  assert.match(statusFeatureSource, /disableCodexModelCatalogProjection/);
  assert.doesNotMatch(statusFeatureSource, /if \(nextValue\) \{\s*setSyncCodexModelCatalog\(true\);\s*return;/);
});

test('codex model provider option descriptions are localized in Chinese', async () => {
  const zh = JSON.parse(await readFile(new URL('../../../locales/zh.json', import.meta.url), 'utf8'));
  const descriptions = zh.status.codex_model_provider_descriptions;

  for (const key of [
    'base_url',
    'name',
    'wire_api',
    'auth',
    'aws',
    'env_http_headers',
    'http_headers',
    'query_params',
    'env_key_instructions',
  ]) {
    assert.equal(typeof descriptions[key], 'string', `${key} should have a localized description`);
    assert.doesNotMatch(descriptions[key], /^Model provider .* field /);
  }
  assert.match(descriptions.base_url, /API base URL/);
  assert.match(descriptions.env_http_headers, /环境变量/);
});

test('codex root settings value editors keep a responsive control column', async () => {
  const rootSettingsSource = await readFile(
    new URL('../components/StatusCodexRootSettingsSection.tsx', import.meta.url),
    'utf8'
  );
  const modelProvidersSource = await readFile(
    new URL('../components/StatusCodexModelProvidersSection.tsx', import.meta.url),
    'utf8'
  );
  const configRowsSource = await readFile(
    new URL('../components/StatusCodexConfigRows.tsx', import.meta.url),
    'utf8'
  );
  const valueEditorSource = await readFile(new URL('../model/codexValueEditor.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(configRowsSource, /md:grid-cols-\[minmax\(0,1fr\)_5rem\]/);
  assert.match(configRowsSource, /md:grid-cols-\[minmax\(0,1fr\)_minmax\(16rem,22rem\)\]/);
  assert.match(configRowsSource, /className="flex min-w-0 w-full justify-start md:justify-end"/);
  assert.match(configRowsSource, /className="w-full"/);
  assert.match(rootSettingsSource, /<StatusCodexConfigRows/);
  assert.match(modelProvidersSource, /<StatusCodexConfigRows/);
  assert.doesNotMatch(modelProvidersSource, /md:justify-center/);
  assert.doesNotMatch(valueEditorSource, /className="mx-auto h-9 w-16"/);
  assert.match(valueEditorSource, /className="ml-auto h-9 w-16"/);
});

test('codex feature config page keeps readable text selectable for copy', async () => {
  const codexFeatureSource = await readFile(new URL('../../codex/CodexFeature.tsx', import.meta.url), 'utf8');
  const configRowsSource = await readFile(
    new URL('../components/StatusCodexConfigRows.tsx', import.meta.url),
    'utf8'
  );

  assert.match(codexFeatureSource, /data-collaboration-id="PAGE_CODEX"[\s\S]{0,120}select-text/);
  assert.match(configRowsSource, /min-w-0 select-text/);
});

test('codex config rows render hierarchical path labels instead of flat dotted titles', async () => {
  const rootSettingsSource = await readFile(
    new URL('../components/StatusCodexRootSettingsSection.tsx', import.meta.url),
    'utf8'
  );
  const modelProvidersSource = await readFile(
    new URL('../components/StatusCodexModelProvidersSection.tsx', import.meta.url),
    'utf8'
  );
  const configRowsSource = await readFile(
    new URL('../components/StatusCodexConfigRows.tsx', import.meta.url),
    'utf8'
  );

  assert.match(rootSettingsSource, /parentMode="section"/);
  assert.match(modelProvidersSource, /parentMode="hidden"/);
  assert.match(configRowsSource, /resolveCodexFeatureRowPathDisplay\(row\)/);
  assert.match(configRowsSource, /data-codex-path-primary-heading/);
  assert.match(configRowsSource, /resolveRowPathLabels\(pathDisplay, nested\)/);
  assert.match(configRowsSource, /pathDisplay\.childLabels/);
  assert.doesNotMatch(modelProvidersSource, /\{row\.path\.join\('\.'\)\}/);
  assert.doesNotMatch(modelProvidersSource, /\{pathDisplay\.primaryLabel\}/);
});

test('codex config rows render as a settings table rather than heavy nested cards', async () => {
  const configRowsSource = await readFile(
    new URL('../components/StatusCodexConfigRows.tsx', import.meta.url),
    'utf8'
  );

  assert.match(configRowsSource, /data-codex-config-table="settings"/);
  assert.match(configRowsSource, /data-codex-config-table-row=\{row\.id\}/);
  assert.match(configRowsSource, /md:grid-cols-\[minmax\(0,1fr\)_minmax\(16rem,22rem\)\]/);
  assert.match(configRowsSource, /divide-y-2 divide-\[var\(--border-color\)\]/);
  assert.match(configRowsSource, /border-2 border-\[var\(--border-color\)\]/);
  assert.doesNotMatch(configRowsSource, /--codex-panel-border/);
  assert.doesNotMatch(configRowsSource, /border-l-4 border-\[var\(--border-color\)\]/);
});

test('codex feature rows render a settings table and a grouped multi_agent_v2 complex panel', async () => {
  const featureSectionSource = await readFile(
    new URL('../components/StatusCodexFeaturesSection.tsx', import.meta.url),
    'utf8'
  );

  assert.match(featureSectionSource, /groupFeatureRowsByPrimaryPath\(group\.rows\)/);
  assert.match(featureSectionSource, /renderFeatureObjectCard\(pathGroup\)/);
  assert.match(featureSectionSource, /data-codex-feature-object-card=\{pathGroup\.primaryLabel\}/);
  assert.match(featureSectionSource, /data-codex-feature-object-list="settings-table"/);
  assert.match(featureSectionSource, /data-codex-feature-config-panel="true"/);
  assert.match(featureSectionSource, /data-codex-complex-feature-panel="multi_agent_v2"/);
  assert.match(featureSectionSource, /\{ id: 'runtime-capacity'/);
  assert.match(featureSectionSource, /\{ id: 'wait-timeouts'/);
  assert.match(featureSectionSource, /\{ id: 'usage-hints'/);
  assert.match(featureSectionSource, /\{ id: 'tool-metadata'/);
  assert.match(featureSectionSource, /data-codex-complex-feature-group=\{section\.id\}/);
  assert.match(featureSectionSource, /findMultiAgentV2Row\(pathGroup, 'enabled'\)/);
  assert.match(featureSectionSource, /findMultiAgentV2Row\(pathGroup, 'max_concurrent_threads_per_session'\)/);
  assert.match(featureSectionSource, /findMultiAgentV2Row\(pathGroup, 'default_wait_timeout_ms'\)/);
  assert.match(featureSectionSource, /findMultiAgentV2Row\(pathGroup, 'subagent_usage_hint_text'\)/);
  assert.match(featureSectionSource, /findMultiAgentV2Row\(pathGroup, 'non_code_mode_only'\)/);
  assert.doesNotMatch(featureSectionSource, /handshake_ms/);
  assert.doesNotMatch(featureSectionSource, /execution_ttl_sec/);
  assert.doesNotMatch(featureSectionSource, /retry_backoff_factor/);
  assert.doesNotMatch(featureSectionSource, /account-card-grid-full grid/);
  assert.doesNotMatch(featureSectionSource, /card-swiss relative/);
  assert.doesNotMatch(featureSectionSource, /account-card-header/);
  assert.doesNotMatch(featureSectionSource, /border-l-\[6px\]/);
  assert.match(featureSectionSource, /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(13rem,18rem\)\]/);
  assert.match(featureSectionSource, /border-2 border-\[var\(--border-color\)\]/);
  assert.match(featureSectionSource, /divide-y-2 divide-\[var\(--border-color\)\]/);
  assert.doesNotMatch(featureSectionSource, /--codex-blue/);
  assert.doesNotMatch(featureSectionSource, /--codex-panel/);
  assert.match(featureSectionSource, /data-codex-feature-primary-heading=\{pathGroup\.primaryLabel\}/);
  assert.match(featureSectionSource, /resolveFeatureRowPathLabels\(pathDisplay, nested\)/);
  assert.match(featureSectionSource, /pathDisplay\.childLabels/);
  assert.doesNotMatch(featureSectionSource, /<div className="divide-y-2 divide-\[var\(--border-color\)\]">\s*\{groupFeatureRowsByPrimaryPath/);
});

test('codex feature panel suppresses project design-system highlight overlays', async () => {
  const styleSource = await readFile(new URL('../../../style.css', import.meta.url), 'utf8');

  assert.match(styleSource, /\[data-design-system-highlight='project'\] \[data-codex-feature-config-panel='true'\] \[data-design-system-component='true'\]/);
  assert.match(styleSource, /outline:\s*none/);
  assert.match(styleSource, /\[data-codex-feature-config-panel='true'\] \[data-design-system-component='true'\]\[data-design-system-component-name\]::before/);
  assert.match(styleSource, /content:\s*none/);
});

test('status page exposes account-store diagnostics panel with summarized errors', async () => {
  const source = await readFile(new URL('../StatusFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /GetAccountStoreDiagnostics/);
  assert.match(source, /buildAccountStoreDiagnosticsView/);
  assert.match(source, /data-account-store-diagnostics-panel/);
  assert.match(source, /data-account-store-diagnostics-error/);
  assert.match(source, /title=\{view\.fullError\}/);
});
