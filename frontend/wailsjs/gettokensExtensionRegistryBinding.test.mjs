import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function extractClass(source, className) {
  const start = source.indexOf(`export class ${className}`);
  assert.notEqual(start, -1, `missing generated class ${className}`);
  const nextClass = source.indexOf('\n\texport class ', start + 1);
  return source.slice(start, nextClass === -1 ? source.length : nextClass);
}

test('GetTokens extension registry Wails binding declares snapshot and local enable-state mutation', () => {
  const appJS = fs.readFileSync(path.join(repoRoot, 'frontend/wailsjs/go/main/App.js'), 'utf8');
  const appTypes = fs.readFileSync(path.join(repoRoot, 'frontend/wailsjs/go/main/App.d.ts'), 'utf8');
  const models = fs.readFileSync(path.join(repoRoot, 'frontend/wailsjs/go/models.ts'), 'utf8');
  const rootTypes = fs.readFileSync(path.join(repoRoot, 'app_types.go'), 'utf8');

  assert.match(appJS, /export function GetGetTokensExtensionRegistrySnapshot\(arg1\)/);
  assert.match(appJS, /window\['go'\]\['main'\]\['App'\]\['GetGetTokensExtensionRegistrySnapshot'\]\(arg1\)/);
  assert.match(appJS, /export function SetGetTokensExtensionEnabled\(arg1\)/);
  assert.match(appJS, /window\['go'\]\['main'\]\['App'\]\['SetGetTokensExtensionEnabled'\]\(arg1\)/);
  assert.match(appJS, /export function PreviewGetTokensExtensionCodexConfigDryRun\(arg1\)/);
  assert.match(appJS, /window\['go'\]\['main'\]\['App'\]\['PreviewGetTokensExtensionCodexConfigDryRun'\]\(arg1\)/);
  assert.match(appTypes, /GetGetTokensExtensionRegistrySnapshot\(arg1:main\.GetTokensExtensionRegistrySnapshotInput\):Promise<main\.GetTokensExtensionRegistrySnapshot>/);
  assert.match(appTypes, /SetGetTokensExtensionEnabled\(arg1:main\.SetGetTokensExtensionEnabledInput\):Promise<main\.GetTokensExtensionEnableStateFile>/);
  assert.match(appTypes, /PreviewGetTokensExtensionCodexConfigDryRun\(arg1:main\.PreviewGetTokensExtensionCodexConfigDryRunInput\):Promise<main\.GetTokensExtensionCodexConfigDryRunPreview>/);
  assert.match(models, /export class GetTokensExtensionRegistrySnapshot/);
  assert.match(models, /export class SetGetTokensExtensionEnabledInput/);
  assert.match(models, /export class PreviewGetTokensExtensionCodexConfigDryRunInput/);
  assert.match(rootTypes, /ConfigText\s+string\s+`json:"configText,omitempty"`/);
  assert.match(models, /extensionID: string/);
  assert.match(models, /enabled: boolean/);
  assert.match(models, /export class GetTokensExtensionEnableStateFile/);
  assert.match(models, /export class GetTokensExtensionCodexConfigDryRunPreview/);
  assert.match(models, /dryRun: boolean/);
  assert.match(models, /sections: GetTokensExtensionCodexConfigDryRunSection\[\]/);
  assert.match(models, /operations: GetTokensExtensionCodexConfigDryRunOperation\[\]/);
  assert.match(models, /validation: GetTokensExtensionCodexConfigDryRunValidation\[\]/);
  assert.match(models, /capabilityID\?: string/);
  assert.match(models, /extensions: GetTokensExtensionEnableState\[\]/);
  assert.match(models, /registryMode: string/);
  assert.match(models, /readOnly: boolean/);
  assert.match(models, /roots: GetTokensExtensionRoot\[\]/);
  assert.match(models, /extensions: GetTokensExtensionSnapshot\[\]/);
  assert.match(models, /diagnostics: GetTokensExtensionDiagnostic\[\]/);
  assert.match(models, /source: GetTokensExtensionSource/);
  assert.match(models, /capabilities\?: GetTokensExtensionCapability\[\]/);
  assert.match(models, /requiredPermissions\?: string\[\]/);
});

test('GetTokens extension dry-run binding preserves readonly input and typed patch plans', () => {
  const appTypes = fs.readFileSync(path.join(repoRoot, 'frontend/wailsjs/go/main/App.d.ts'), 'utf8');
  const models = fs.readFileSync(path.join(repoRoot, 'frontend/wailsjs/go/models.ts'), 'utf8');
  const rootTypes = fs.readFileSync(path.join(repoRoot, 'app_types.go'), 'utf8');
  const rootMappers = fs.readFileSync(path.join(repoRoot, 'app_mappers.go'), 'utf8');

  assert.match(appTypes, /PreviewGetTokensExtensionCodexConfigDryRun\(arg1:main\.PreviewGetTokensExtensionCodexConfigDryRunInput\):Promise<main\.GetTokensExtensionCodexConfigDryRunPreview>/);
  assert.match(rootTypes, /ConfigText\s+string\s+`json:"configText,omitempty"`/);
  assert.match(rootTypes, /PatchPlan\s+GetTokensExtensionCodexConfigTomlPatchPlan\s+`json:"patchPlan"`/);
  assert.match(rootMappers, /ConfigText:\s+input\.ConfigText/);
  assert.match(rootMappers, /PatchPlan:\s+mapGetTokensExtensionCodexConfigTomlPatchPlan\(item\.PatchPlan\)/);

  const inputClass = extractClass(models, 'PreviewGetTokensExtensionCodexConfigDryRunInput');
  assert.match(inputClass, /manifestPaths\?: string\[\]/);
  assert.match(inputClass, /roots\?: GetTokensExtensionRoot\[\]/);
  assert.match(inputClass, /statePath\?: string/);
  assert.match(inputClass, /targetPath\?: string/);
  assert.match(inputClass, /configText\?: string/);
  assert.match(inputClass, /this\.configText\s*=\s*source\["configText"\]/);

  const patchPlanClass = extractClass(models, 'GetTokensExtensionCodexConfigTomlPatchPlan');
  for (const field of ['targetSection', 'operation', 'beforeSnippet', 'afterSnippet']) {
    assert.match(patchPlanClass, new RegExp(`${field}:\\s+string;`));
    assert.match(patchPlanClass, new RegExp(`this\\.${field}\\s*=\\s*source\\["${field}"\\]`));
  }
  assert.match(patchPlanClass, /validation: string\[\]/);
  assert.match(patchPlanClass, /this\.validation\s*=\s*source\["validation"\]/);

  const operationClass = extractClass(models, 'GetTokensExtensionCodexConfigDryRunOperation');
  assert.match(operationClass, /patchPlan: GetTokensExtensionCodexConfigTomlPatchPlan/);
  assert.match(
    operationClass,
    /this\.patchPlan\s*=\s*this\.convertValues\(source\["patchPlan"\],\s*GetTokensExtensionCodexConfigTomlPatchPlan\)/,
  );

  const previewClass = extractClass(models, 'GetTokensExtensionCodexConfigDryRunPreview');
  assert.match(previewClass, /operations: GetTokensExtensionCodexConfigDryRunOperation\[\]/);
  assert.match(
    previewClass,
    /this\.operations\s*=\s*this\.convertValues\(source\["operations"\],\s*GetTokensExtensionCodexConfigDryRunOperation\)/,
  );
});
