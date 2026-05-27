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
