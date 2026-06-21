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

test('status page uses AntD workbench shell for the redesigned status frame', async () => {
  const statusFeatureSource = await readFile(new URL('../StatusFeature.tsx', import.meta.url), 'utf8');

  assert.match(statusFeatureSource, /from 'antd'/);
  assert.match(statusFeatureSource, /<Card\b/);
  assert.match(statusFeatureSource, /<Tag\b/);
  assert.match(statusFeatureSource, /<Badge\b/);
  assert.match(statusFeatureSource, /<Typography\.Title\b/);
  assert.match(statusFeatureSource, /<Space\b/);
  assert.match(statusFeatureSource, /data-status-hero="true"/);
  assert.match(statusFeatureSource, /data-status-overview-grid="true"/);
  assert.match(statusFeatureSource, /data-status-workbench-grid="true"/);
  assert.match(statusFeatureSource, /data-status-primary-rail="true"/);
  assert.match(statusFeatureSource, /data-status-diagnostics-rail="true"/);
  assert.doesNotMatch(statusFeatureSource, /data-status-hero="true"[\s\S]{0,500}shadow-/);
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

test('status relay editor modals use the quiet workspace shell', async () => {
  const relayEditorsSource = await readFile(new URL('../components/RelayEditors.tsx', import.meta.url), 'utf8');

  assert.match(relayEditorsSource, /const relayEditorModalPanelClass =/);
  assert.match(relayEditorsSource, /const relayEditorPrimaryButtonClass =/);
  assert.match(relayEditorsSource, /data-status-relay-editor-modal/);
  assert.match(relayEditorsSource, /--gt-surface-canvas/);
  assert.match(relayEditorsSource, /--gt-border-subtle/);
  assert.match(relayEditorsSource, /--gt-status-danger/);
  assert.doesNotMatch(relayEditorsSource, /btn-swiss/);
  assert.doesNotMatch(relayEditorsSource, /border-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(relayEditorsSource, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(relayEditorsSource, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(relayEditorsSource, /font-(?:medium|bold|extrabold|black)/);
  assert.doesNotMatch(relayEditorsSource, /uppercase/);
  assert.doesNotMatch(relayEditorsSource, /shadow-hard/);
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
  assert.match(statusPanelSource, /<tbody className="divide-y divide-\[var\(--gt-border-subtle\)\]"/);
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

test('status panels use the quiet workspace shell', async () => {
  const statusPanelSource = await readFile(new URL('../components/StatusPanels.tsx', import.meta.url), 'utf8');
  const actionSelectSource = await readFile(new URL('../../../components/ui/ActionSelect.tsx', import.meta.url), 'utf8');
  const snippetPanelSource = await readFile(new URL('../components/StatusSnippetPanel.tsx', import.meta.url), 'utf8');

  assert.match(statusPanelSource, /const statusPanelClass =/);
  assert.match(statusPanelSource, /const statusMutedPanelClass =/);
  assert.match(statusPanelSource, /const statusPrimaryButtonClass =/);
  assert.match(statusPanelSource, /from 'antd'/);
  assert.match(statusPanelSource, /<Segmented\b/);
  assert.match(statusPanelSource, /data-status-local-cli-panel="true"/);
  assert.match(statusPanelSource, /data-status-local-cli-target=\{activeTarget\}/);
  assert.match(statusPanelSource, /data-status-quota-evidence-section="true"/);
  assert.match(statusPanelSource, /--gt-surface-canvas/);
  assert.match(statusPanelSource, /--gt-border-subtle/);
  assert.doesNotMatch(statusPanelSource, /card-swiss grid gap-4 p-4/);
  assert.doesNotMatch(statusPanelSource, /btn-swiss/);
  assert.doesNotMatch(statusPanelSource, /border-2 border-\[var\(--gt-border-strong\)\] bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(statusPanelSource, /relative overflow-visible border-2 border-\[var\(--gt-border-strong\)\] bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(statusPanelSource, /SegmentedControl/);
  assert.doesNotMatch(statusPanelSource, /shadow-sm/);
  assert.doesNotMatch(statusPanelSource, /shadow-\[/);
  assert.doesNotMatch(statusPanelSource, /tracking-(wide|wider|widest|tight|tighter|tightest|normal|\[)/);
  assert.doesNotMatch(statusPanelSource, /--text-on-accent|--bg-(main|surface|subtle|warning)/);
  assert.match(actionSelectSource, /--gt-surface-raised/);
  assert.match(snippetPanelSource, /--gt-border-subtle/);
  assert.match(snippetPanelSource, /--gt-status-success/);
  assert.match(snippetPanelSource, /--gt-status-danger/);
  assert.match(snippetPanelSource, /--gt-ink-primary/);
  assert.match(snippetPanelSource, /--gt-ink-muted/);
  assert.doesNotMatch(actionSelectSource, /btn-swiss/);
  assert.doesNotMatch(snippetPanelSource, /btn-swiss/);
  assert.doesNotMatch(snippetPanelSource, /--color-status-/);
  assert.doesNotMatch(snippetPanelSource, /--text-primary|--text-muted/);
});

test('status local CLI apply panel uses the workbench plan layout', async () => {
  const statusPanelSource = await readFile(new URL('../components/StatusPanels.tsx', import.meta.url), 'utf8');
  const zh = JSON.parse(await readFile(new URL('../../../locales/zh.json', import.meta.url), 'utf8'));
  const en = JSON.parse(await readFile(new URL('../../../locales/en.json', import.meta.url), 'utf8'));

  assert.match(statusPanelSource, /data-status-local-cli-summary="true"/);
  assert.match(statusPanelSource, /data-status-local-cli-config-rail="true"/);
  assert.match(statusPanelSource, /data-status-local-cli-plan-rail="true"/);
  assert.match(statusPanelSource, /data-status-local-cli-plan-status="true"/);
  assert.match(statusPanelSource, /statusLocalCliCapabilityRowClass/);
  assert.match(statusPanelSource, /status\.local_cli_target_label/);
  assert.match(statusPanelSource, /status\.local_cli_preflight_title/);
  assert.match(statusPanelSource, /status\.local_cli_apply_plan_title/);
  assert.match(statusPanelSource, /status\.local_cli_capability_websocket_title/);
  assert.match(statusPanelSource, /status\.local_cli_capability_model_catalog_title/);
  assert.doesNotMatch(statusPanelSource, /<div className="mb-2 flex w-full">\s*<SegmentedControl/);

  assert.equal(zh.status.local_cli_target_label, '目标客户端');
  assert.equal(zh.status.local_cli_preflight_title, '运行前检查');
  assert.equal(zh.status.local_cli_apply_plan_title, '写入计划');
  assert.equal(zh.status.local_cli_config_input_title, '配置输入');
  assert.equal(zh.status.local_cli_capability_websocket_title, 'WebSocket 转发');
  assert.equal(zh.status.local_cli_capability_model_catalog_title, '模型目录同步');
  assert.equal(en.status.local_cli_target_label, 'Target client');
  assert.equal(en.status.local_cli_preflight_title, 'Preflight');
  assert.equal(en.status.local_cli_apply_plan_title, 'Apply plan');
  assert.equal(en.status.local_cli_config_input_title, 'Configuration input');
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

test('codex value editors use the quiet workspace input shell', async () => {
  const valueEditorSource = await readFile(new URL('../model/codexValueEditor.tsx', import.meta.url), 'utf8');

  assert.match(valueEditorSource, /const codexValueEditorInputClass =/);
  assert.match(valueEditorSource, /const codexValueEditorTextareaClass =/);
  assert.match(valueEditorSource, /const codexValueEditorResetButtonClass =/);
  assert.match(valueEditorSource, /data-codex-value-editor-reset/);
  assert.match(valueEditorSource, /--gt-surface-canvas/);
  assert.match(valueEditorSource, /--gt-surface-muted/);
  assert.match(valueEditorSource, /--gt-border-subtle/);
  assert.doesNotMatch(valueEditorSource, /input-swiss/);
  assert.doesNotMatch(valueEditorSource, /border-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(valueEditorSource, /bg-\[var\(--bg-(main|surface)\)\]/);
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
  assert.match(configRowsSource, /const codexConfigRowsChipClass =/);
  assert.match(configRowsSource, /--gt-border-subtle/);
  assert.match(configRowsSource, /--gt-surface-muted/);
  assert.match(configRowsSource, /divide-y divide-\[var\(--gt-border-subtle\)\]/);
  assert.doesNotMatch(configRowsSource, /divide-y-2 divide-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(configRowsSource, /border-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(configRowsSource, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(configRowsSource, /--codex-panel-border/);
  assert.doesNotMatch(configRowsSource, /border-l-4 border-\[var\(--gt-border-strong\)\]/);
});

test('codex config sibling sections use the quiet workspace shell', async () => {
  const sectionPaths = [
    '../components/StatusCodexRootSettingsSection.tsx',
    '../components/StatusCodexModelProvidersSection.tsx',
    '../components/StatusCodexNoticeSection.tsx',
  ];
  const sources = await Promise.all(
    sectionPaths.map((path) => readFile(new URL(path, import.meta.url), 'utf8'))
  );

  for (const source of sources) {
    assert.match(source, /const codexConfigSectionPanelClass =/);
    assert.match(source, /const codexConfigSectionPrimaryButtonClass =/);
    assert.match(source, /--gt-surface-canvas/);
    assert.match(source, /--gt-border-subtle/);
    assert.doesNotMatch(source, /btn-swiss/);
    assert.doesNotMatch(source, /border-2 border-\[var\(--gt-border-strong\)\]/);
    assert.doesNotMatch(source, /bg-\[var\(--bg-(main|surface)\)\]/);
    assert.doesNotMatch(source, /bg-\[var\(--bg-surface\)\]/);
    assert.doesNotMatch(source, /font-(?:medium|bold|extrabold|black)/);
    assert.doesNotMatch(source, /uppercase/);
  }
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
  assert.match(featureSectionSource, /const codexFeaturePanelClass =/);
  assert.match(featureSectionSource, /const codexFeaturePrimaryButtonClass =/);
  assert.match(featureSectionSource, /--gt-surface-canvas/);
  assert.match(featureSectionSource, /--gt-border-subtle/);
  assert.match(featureSectionSource, /divide-y divide-\[var\(--gt-border-subtle\)\]/);
  assert.doesNotMatch(featureSectionSource, /btn-swiss/);
  assert.doesNotMatch(featureSectionSource, /border-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(featureSectionSource, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(featureSectionSource, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(featureSectionSource, /--codex-blue/);
  assert.doesNotMatch(featureSectionSource, /--codex-panel/);
  assert.match(featureSectionSource, /data-codex-feature-primary-heading=\{pathGroup\.primaryLabel\}/);
  assert.match(featureSectionSource, /resolveFeatureRowPathLabels\(pathDisplay, nested\)/);
  assert.match(featureSectionSource, /pathDisplay\.childLabels/);
  assert.doesNotMatch(featureSectionSource, /<div className="divide-y-2 divide-\[var\(--gt-border-strong\)\]">\s*\{groupFeatureRowsByPrimaryPath/);
});

test('codex feature panel suppresses project design-system highlight overlays', async () => {
  const styleSource = await readFile(new URL('../../../style.css', import.meta.url), 'utf8');

  assert.match(styleSource, /\[data-design-system-inspect-mode='active'\] \[data-design-system-highlight='project'\] \[data-codex-feature-config-panel='true'\] \[data-design-system-component='true'\]/);
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

test('status page diagnostics and header status use the quiet workspace shell', async () => {
  const source = await readFile(new URL('../StatusFeature.tsx', import.meta.url), 'utf8');
  const diagnosticsBlock = source.match(/function AccountStoreDiagnosticsPanel[\s\S]*?function normalizeRelayEndpointURL/)?.[0] || '';
  const headerBlock = source.match(/data-status-hero="true"[\s\S]*?data-status-workbench-grid="true"/)?.[0] || '';

  assert.match(source, /const statusDiagnosticsPanelClass =/);
  assert.match(source, /const statusDiagnosticsToneClass =/);
  assert.match(source, /const statusHeroCardClass =/);
  assert.match(source, /const statusOverviewGridClass =/);
  assert.match(source, /const statusWorkbenchGridClass =/);
  assert.match(source, /<Card\b/);
  assert.match(source, /<Badge\b/);
  assert.match(source, /<Tag\b/);
  assert.match(source, /<Typography\.Title\b/);
  assert.match(source, /<Space\b/);
  assert.match(source, /data-account-store-diagnostics-panel="quiet"/);
  assert.match(source, /data-status-header-health="quiet"/);
  assert.match(source, /data-status-hero="true"/);
  assert.match(source, /data-status-overview-grid="true"/);
  assert.match(source, /data-status-workbench-grid="true"/);
  assert.match(source, /data-status-primary-rail="true"/);
  assert.match(source, /data-status-diagnostics-rail="true"/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /--gt-status-danger/);
  assert.doesNotMatch(source, /<WorkspacePageHeader/);
  assert.doesNotMatch(source, /direction="vertical"/);

  for (const block of [diagnosticsBlock, headerBlock]) {
    assert.doesNotMatch(block, /card-swiss/);
    assert.doesNotMatch(block, /border-2/);
    assert.doesNotMatch(block, /bg-\[var\(--bg-(main|surface)\)\]/);
    assert.doesNotMatch(block, /font-(?:medium|bold|extrabold|black)/);
    assert.doesNotMatch(block, /\buppercase\b/);
    assert.doesNotMatch(block, /tracking-\[0\.(04|08|14|18)em\]|tracking-widest/);
    assert.doesNotMatch(block, /color-status-/);
  }
});
