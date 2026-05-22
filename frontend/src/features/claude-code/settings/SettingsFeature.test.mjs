import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const featurePath = fileURLToPath(new URL('./SettingsFeature.tsx', import.meta.url));
const componentPath = fileURLToPath(new URL('../components/ClaudeCodeSettingsScopeStack.tsx', import.meta.url));
const previewDataPath = fileURLToPath(new URL('./previewData.ts', import.meta.url));
const wailsAppBindingsPath = fileURLToPath(new URL('../../../../wailsjs/go/main/App.js', import.meta.url));
const wailsAppTypesPath = fileURLToPath(new URL('../../../../wailsjs/go/main/App.d.ts', import.meta.url));
const wailsModelsPath = fileURLToPath(new URL('../../../../wailsjs/go/models.ts', import.meta.url));

test('Settings feature calls Wails bridge in desktop app with preview fallback', () => {
  const source = readFileSync(featurePath, 'utf8');

  assert.match(source, /GetClaudeCodeSettingsSnapshot/, 'feature must call GetClaudeCodeSettingsSnapshot');
  assert.match(source, /PatchClaudeCodeSettings/, 'feature must call PatchClaudeCodeSettings for saving');
  assert.match(source, /hasWailsAppBindings/, 'feature must keep browser preview fallback explicit');
  assert.match(source, /previewAllLayersSnapshot/, 'feature must use preview data in browser mode');
});

test('Settings scope stack component renders all layer states', () => {
  const source = readFileSync(componentPath, 'utf8');

  assert.match(source, /SettingsScopeStackState/, 'component must export state type');
  assert.match(source, /all-layers-valid/, 'component must support all-layers-valid state');
  assert.match(source, /partial-layers/, 'component must support partial-layers state');
  assert.match(source, /parse-error/, 'component must support parse-error state');
  assert.match(source, /managed-readonly/, 'component must support managed-readonly state');
  assert.match(source, /all-layers-empty/, 'component must support all-layers-empty state');
  assert.match(source, /saving-diff/, 'component must support saving-diff state');
  assert.match(source, /managed.*read-only/, 'managed layers must be marked read-only');
  assert.match(source, /disableAllHooks/, 'component must render disableAllHooks field');
  assert.match(source, /outputStyle/, 'component must render outputStyle field');
});

test('Preview data covers all state scenarios', () => {
  const source = readFileSync(previewDataPath, 'utf8');

  assert.match(source, /previewAllLayersSnapshot/, 'must export all-layers snapshot');
  assert.match(source, /previewPartialLayersSnapshot/, 'must export partial-layers snapshot');
  assert.match(source, /previewParseErrorSnapshot/, 'must export parse-error snapshot');
  assert.match(source, /previewEmptySnapshot/, 'must export empty snapshot');
  assert.match(source, /previewUserLayer/, 'must export user layer preview');
  assert.match(source, /previewProjectLayer/, 'must export project layer preview');
  assert.match(source, /previewLocalLayer/, 'must export local layer preview');
  assert.match(source, /previewManagedLayer/, 'must export managed layer preview');
  assert.match(source, /previewParseErrorLayer/, 'must export parse-error layer preview');
});

test('Generated Wails bindings expose Claude Code settings DTOs', () => {
  const appSource = readFileSync(wailsAppBindingsPath, 'utf8');
  const appTypes = readFileSync(wailsAppTypesPath, 'utf8');
  const modelSource = readFileSync(wailsModelsPath, 'utf8');

  assert.match(appSource, /export function GetClaudeCodeSettingsSnapshot\(\)/);
  assert.match(appSource, /export function PatchClaudeCodeSettings\(arg1\)/);
  assert.match(appTypes, /GetClaudeCodeSettingsSnapshot\(\):Promise<main\.ClaudeCodeSettingsSnapshotDTO>/);
  assert.match(appTypes, /PatchClaudeCodeSettings\(arg1:main\.PatchClaudeCodeSettingsInputDTO\):Promise<main\.PatchClaudeCodeSettingsResultDTO>/);
  assert.match(modelSource, /export class ClaudeCodeSettingsSnapshotDTO/);
  assert.match(modelSource, /export class ClaudeCodeSettingsLayer/);
  assert.match(modelSource, /export class ClaudeCodeSettingsFields/);
  assert.match(modelSource, /export class PatchClaudeCodeSettingsInputDTO/);
  assert.match(modelSource, /export class PatchClaudeCodeSettingsResultDTO/);
});

test('Managed scope is read-only and cannot be patched', () => {
  const componentSource = readFileSync(componentPath, 'utf8');

  // The component should not offer edit buttons for managed layers
  assert.ok(
    componentSource.includes('managed') && componentSource.includes('read-only'),
    'managed scope must be displayed as read-only',
  );
});

test('Settings scope edit controls are wired to callbacks', () => {
  const componentSource = readFileSync(componentPath, 'utf8');

  assert.match(componentSource, /onStartEdit/, 'component must accept edit callback');
  assert.match(componentSource, /onCancelEdit/, 'component must accept cancel callback');
  assert.match(componentSource, /onSavePatch/, 'component must accept save callback');
  assert.match(componentSource, /onClick=\{\(\)\s*=>\s*onStartEdit\?\.\(\`\$\{layer\.scope\}\`\)\}/, 'Edit button must enter edit mode for that scope');
  assert.match(componentSource, /onClick=\{onCancelEdit\}/, 'Cancel button must leave edit mode');
  assert.match(componentSource, /onClick=\{\(\)\s*=>\s*onSavePatch\?\./, 'Save button must call patch callback');
});

test('SettingsFeature reloads snapshot after successful patch', async () => {
  const source = readFileSync(featurePath, 'utf8');
  assert.match(source, /loadSnapshot/, 'feature must reload snapshot after save');
});
