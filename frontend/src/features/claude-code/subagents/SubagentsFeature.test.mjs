import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const featurePath = fileURLToPath(new URL('./SubagentsFeature.tsx', import.meta.url));
const componentPath = fileURLToPath(new URL('../components/ClaudeCodeSubagentCatalog.tsx', import.meta.url));
const previewDataPath = fileURLToPath(new URL('./previewData.ts', import.meta.url));
const wailsAppBindingsPath = fileURLToPath(new URL('../../../../wailsjs/go/main/App.js', import.meta.url));
const wailsAppTypesPath = fileURLToPath(new URL('../../../../wailsjs/go/main/App.d.ts', import.meta.url));
const wailsModelsPath = fileURLToPath(new URL('../../../../wailsjs/go/models.ts', import.meta.url));

test('Subagents feature calls Wails bridge with preview fallback', () => {
  const source = readFileSync(featurePath, 'utf8');

  assert.match(source, /GetClaudeCodeSubagentsSnapshot/, 'feature must call GetClaudeCodeSubagentsSnapshot');
  assert.match(source, /SaveClaudeCodeSubagent/, 'feature must call SaveClaudeCodeSubagent');
  assert.match(source, /DeleteClaudeCodeSubagent/, 'feature must call DeleteClaudeCodeSubagent');
  assert.match(source, /hasWailsAppBindings/, 'feature must keep browser preview fallback explicit');
  assert.match(source, /previewFullSnapshot/, 'feature must use preview data in browser mode');
  assert.match(source, /loadSnapshot/, 'feature must reload after save/delete');
});

test('Subagent Catalog component renders all states', () => {
  const source = readFileSync(componentPath, 'utf8');

  assert.match(source, /SubagentCatalogState/, 'component must export state type');
  assert.match(source, /valid-agents/, 'must support valid-agents');
  assert.match(source, /missing-name/, 'must support missing-name');
  assert.match(source, /missing-description/, 'must support missing-description');
  assert.match(source, /plugin-ignored-fields/, 'must support plugin-ignored-fields');
  assert.match(source, /parse-error/, 'must support parse-error');
  assert.match(source, /empty/, 'must support empty');
  assert.match(source, /creating-agent/, 'must support creating-agent');
  assert.match(source, /saving-agent/, 'must support saving-agent');
  assert.match(source, /ignoredFields/, 'must render ignored fields for plugin agents');
  assert.match(source, /validationErrors/, 'must render validation errors');
  assert.match(source, /frontmatterError/, 'must render frontmatter parse errors');
  assert.match(source, /Delete/, 'must support delete action');
});

test('Preview data covers all subagent scenarios', () => {
  const source = readFileSync(previewDataPath, 'utf8');

  assert.match(source, /previewValidSubagent/, 'must export valid subagent');
  assert.match(source, /previewValidProjectSubagent/, 'must export project subagent');
  assert.match(source, /previewMissingNameSubagent/, 'must export missing-name subagent');
  assert.match(source, /previewMissingDescSubagent/, 'must export missing-desc subagent');
  assert.match(source, /previewPluginSubagent/, 'must export plugin subagent');
  assert.match(source, /previewParseErrorSubagent/, 'must export parse-error subagent');
  assert.match(source, /previewFullSnapshot/, 'must export full snapshot');
  assert.match(source, /previewErrorSnapshot/, 'must export error snapshot');
  assert.match(source, /previewEmptySnapshot/, 'must export empty snapshot');
  assert.match(source, /previewNewAgentContent/, 'must export new agent content');
});

test('Generated Wails bindings expose subagent DTOs', () => {
  const appSource = readFileSync(wailsAppBindingsPath, 'utf8');
  const appTypes = readFileSync(wailsAppTypesPath, 'utf8');
  const modelSource = readFileSync(wailsModelsPath, 'utf8');

  assert.match(appSource, /export function GetClaudeCodeSubagentsSnapshot\(\)/);
  assert.match(appSource, /export function SaveClaudeCodeSubagent\(arg1\)/);
  assert.match(appSource, /export function DeleteClaudeCodeSubagent\(arg1\)/);
  assert.match(appTypes, /GetClaudeCodeSubagentsSnapshot\(\):Promise<main\.ClaudeCodeSubagentsSnapshot>/);
  assert.match(appTypes, /SaveClaudeCodeSubagent\(arg1:main\.SaveClaudeCodeSubagentInput\):Promise<main\.SaveClaudeCodeSubagentResult>/);
  assert.match(appTypes, /DeleteClaudeCodeSubagent\(arg1:main\.DeleteClaudeCodeSubagentInput\):Promise<void>/);
  assert.match(modelSource, /export class ClaudeCodeSubagentsSnapshot/);
  assert.match(modelSource, /export class ClaudeCodeSubagentRecord/);
  assert.match(modelSource, /export class SaveClaudeCodeSubagentInput/);
  assert.match(modelSource, /export class SaveClaudeCodeSubagentResult/);
});

test('Create/edit form requires name and description', () => {
  const featureSource = readFileSync(featurePath, 'utf8');

  assert.match(featureSource, /draftName/, 'must track draft name');
  assert.match(featureSource, /draftDescription/, 'must track draft description');
  assert.match(featureSource, /handleStartCreate/, 'must support creating new agents');
  assert.match(featureSource, /handleStartEdit/, 'must support editing existing agents');
  assert.match(featureSource, /handleDeleteAgent/, 'must support deleting agents');
  assert.match(featureSource, /previewEmptySnapshot/, 'must fall back to empty snapshot on error');
});

test('Plugin subagents show ignored fields', () => {
  const componentSource = readFileSync(componentPath, 'utf8');
  assert.ok(
    componentSource.includes('Plugin') || componentSource.includes('plugin'),
    'must indicate plugin subagents',
  );
  assert.ok(
    componentSource.includes('ignored') || componentSource.includes('Ignored'),
    'must show ignored field warnings for plugin agents',
  );
});
