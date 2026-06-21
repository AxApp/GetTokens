import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const featurePath = fileURLToPath(new URL('./ClaudeCodeAssetWorkbenchFeature.tsx', import.meta.url));
const componentPath = fileURLToPath(new URL('./components/ClaudeCodeAssetWorkbench.tsx', import.meta.url));
const accountListWorkbenchPath = fileURLToPath(new URL('./components/ClaudeCodeAccountListWorkbench.tsx', import.meta.url));
const pagePath = fileURLToPath(new URL('../../pages/ClaudePage.tsx', import.meta.url));
const wailsAppBindingsPath = fileURLToPath(new URL('../../../wailsjs/go/main/App.js', import.meta.url));
const wailsAppTypesPath = fileURLToPath(new URL('../../../wailsjs/go/main/App.d.ts', import.meta.url));
const wailsModelsPath = fileURLToPath(new URL('../../../wailsjs/go/models.ts', import.meta.url));

test('Claude Code asset workbench uses real Wails snapshot in desktop app with preview fallback', () => {
  const source = readFileSync(featurePath, 'utf8');

  assert.match(source, /GetClaudeCodeExtensionsSnapshot/, 'feature must call the Wails bridge in desktop app');
  assert.match(source, /SaveClaudeCodeMcpServer/, 'feature must save MCP edits through the Wails bridge in desktop app');
  assert.match(source, /hasWailsAppBindings/, 'feature must keep browser preview fallback explicit');
  assert.match(source, /claudeCodePreviewSkills/, 'feature must retain preview skills for browser mode');
  assert.match(source, /mapBackendSkillAsset/, 'feature must adapt backend skill DTOs before rendering');
  assert.match(source, /mapBackendMcpAsset/, 'feature must adapt backend MCP DTOs before rendering');
  assert.match(source, /mapFrontendMcpAssetToBackend/, 'feature must adapt frontend MCP edits before saving');
});

test('generated Wails bindings expose Claude Code extensions snapshot DTOs', () => {
  const appSource = readFileSync(wailsAppBindingsPath, 'utf8');
  const appTypes = readFileSync(wailsAppTypesPath, 'utf8');
  const modelSource = readFileSync(wailsModelsPath, 'utf8');

  assert.match(appSource, /export function GetClaudeCodeExtensionsSnapshot\(\)/);
  assert.match(appSource, /export function SaveClaudeCodeMcpServer\(arg1\)/);
  assert.match(appTypes, /GetClaudeCodeExtensionsSnapshot\(\):Promise<main\.ClaudeCodeExtensionsSnapshot>/);
  assert.match(appTypes, /SaveClaudeCodeMcpServer\(arg1:main\.SaveClaudeCodeMcpServerInput\):Promise<main\.SaveClaudeCodeMcpServerResult>/);
  assert.match(modelSource, /export class ClaudeCodeExtensionsSnapshot/);
  assert.match(modelSource, /export class ClaudeCodeSkillAsset/);
  assert.match(modelSource, /export class ClaudeCodeMcpAsset/);
  assert.match(modelSource, /export class SaveClaudeCodeMcpServerInput/);
  assert.match(modelSource, /export class SaveClaudeCodeMcpServerResult/);
});

test('Claude page exposes Skills and MCP as separate secondary pages', () => {
  const pageSource = readFileSync(pagePath, 'utf8');
  const featureSource = readFileSync(featurePath, 'utf8');

  assert.match(pageSource, /workspace === 'skills'/, 'Claude skills workspace must route directly to asset workbench');
  assert.match(pageSource, /workspace === 'mcp-servers'/, 'Claude MCP workspace must route directly to asset workbench');
  assert.match(featureSource, /function ClaudeCodeSkillsWorkspace/, 'skills must be its own workspace component');
  assert.match(featureSource, /function ClaudeCodeMcpServersWorkspace/, 'mcp servers must be its own workspace component');
  assert.doesNotMatch(featureSource, /workspaceToAssetTab/, 'secondary pages must not be implemented as a route-synced tab');
  assert.doesNotMatch(featureSource, /assetTabToWorkspace/, 'page-internal tab changes must not drive Claude workspace routing');
  assert.doesNotMatch(featureSource, /onWorkspaceChange/, 'Claude asset pages should follow the Codex workspace split, not a local tab router');
});

test('Claude Code asset workbench uses the quiet workspace shell', () => {
  const source = readFileSync(componentPath, 'utf8');

  assert.match(source, /const claudeAssetPanelClass =/);
  assert.match(source, /const claudeAssetButtonClass =/);
  assert.match(source, /const claudeAssetInputClass =/);
  assert.match(source, /data-claude-asset-workbench-shell/);
  assert.match(source, /data-claude-asset-skill-matrix/);
  assert.match(source, /data-claude-asset-mcp-matrix/);
  assert.match(source, /data-claude-asset-diff-panel/);
  assert.match(source, /data-claude-asset-plan-panel/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /--gt-status-success/);
  assert.match(source, /--gt-status-warning/);
  assert.match(source, /--gt-status-danger/);
  assert.doesNotMatch(source, /card-swiss/);
  assert.doesNotMatch(source, /btn-swiss/);
  assert.doesNotMatch(source, /input-swiss/);
  assert.doesNotMatch(source, /select-swiss/);
  assert.doesNotMatch(source, /border-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /border-b-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /border-t-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(source, /font-black/);
  assert.doesNotMatch(source, /uppercase/);
  assert.doesNotMatch(source, /shadow-\[4px_4px_0_var\(--gt-shadow-panel\)\]/);
  assert.doesNotMatch(source, /shadow-\[8px_8px_0_var\(--gt-shadow-panel\)\]/);
  assert.doesNotMatch(source, /shadow-hard/);
});

test('Claude Code account list workbench uses the quiet workspace shell', () => {
  const source = readFileSync(accountListWorkbenchPath, 'utf8');

  assert.match(source, /const claudeAccountWorkbenchShellClass =/);
  assert.match(source, /const claudeAccountPanelClass =/);
  assert.match(source, /const claudeAccountButtonClass =/);
  assert.match(source, /const claudeAccountStatusToneClass =/);
  assert.match(source, /data-claude-account-workbench-shell/);
  assert.match(source, /data-claude-account-workbench-header/);
  assert.match(source, /data-claude-account-queue/);
  assert.match(source, /data-claude-account-queue-row/);
  assert.match(source, /data-claude-account-mapping-panel/);
  assert.match(source, /data-claude-account-probe-panel/);
  assert.match(source, /data-claude-account-profile-list/);
  assert.match(source, /data-claude-account-profile-card/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /--gt-status-success/);
  assert.match(source, /--gt-status-warning/);
  assert.match(source, /--gt-status-danger/);
  assert.doesNotMatch(source, /btn-swiss|input-swiss|select-swiss|card-swiss/);
  assert.doesNotMatch(source, /border-2|border-t-2|border-b-2/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(source, /color-status-/);
  assert.doesNotMatch(source, /font-black/);
  assert.doesNotMatch(source, /uppercase/);
  assert.doesNotMatch(source, /shadow-hard|shadow-\[/);
});
