import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const featurePath = fileURLToPath(new URL('./ClaudeMdFeature.tsx', import.meta.url));
const componentPath = fileURLToPath(new URL('../components/ClaudeCodeMemoryFilesPanel.tsx', import.meta.url));
const previewDataPath = fileURLToPath(new URL('./previewData.ts', import.meta.url));
const wailsAppBindingsPath = fileURLToPath(new URL('../../../../wailsjs/go/main/App.js', import.meta.url));
const wailsAppTypesPath = fileURLToPath(new URL('../../../../wailsjs/go/main/App.d.ts', import.meta.url));
const wailsModelsPath = fileURLToPath(new URL('../../../../wailsjs/go/models.ts', import.meta.url));

test('CLAUDE.md feature calls Wails bridge with preview fallback', () => {
  const source = readFileSync(featurePath, 'utf8');

  assert.match(source, /GetClaudeCodeMemoryFilesSnapshot/, 'feature must call GetClaudeCodeMemoryFilesSnapshot');
  assert.match(source, /SaveClaudeCodeMemoryFile/, 'feature must call SaveClaudeCodeMemoryFile');
  assert.match(source, /hasWailsAppBindings/, 'feature must keep browser preview fallback explicit');
  assert.match(source, /previewAllFilesSnapshot/, 'feature must use preview data in browser mode');
  assert.match(source, /loadSnapshot/, 'feature must reload after save');
});

test('Memory Files Panel component renders all file states', () => {
  const source = readFileSync(componentPath, 'utf8');

  assert.match(source, /MemoryFilesPanelState/, 'component must export state type');
  assert.match(source, /all-files-present/, 'must support all-files-present');
  assert.match(source, /partial-files/, 'must support partial-files');
  assert.match(source, /import-exists/, 'must support import-exists');
  assert.match(source, /import-missing/, 'must support import-missing');
  assert.match(source, /import-recursion/, 'must support import-recursion');
  assert.match(source, /local-not-gitignored/, 'must support local-not-gitignored');
  assert.match(source, /save-preview/, 'must support save-preview');
  assert.match(source, /empty/, 'must support empty');
  assert.match(source, /import-depth-limit/, 'must support import-depth-limit');
  assert.match(source, /parse-error/, 'must support parse-error');
  assert.match(source, /imports/, 'component must render @imports section');
  assert.match(source, /CLAUDE\.local\.md/, 'must identify local scope file');
  assert.match(source, /gitignored/, 'must show gitignored status');
});

test('ClaudeCodeMemoryFilesPanel uses the quiet workspace shell', () => {
  const source = readFileSync(componentPath, 'utf8');

  assert.match(source, /from 'antd';/);
  assert.match(source, /<Button/);
  assert.match(source, /const memoryFilesPanelRowClass =/);
  assert.match(source, /const memoryFilesPanelPanelClass =/);
  assert.match(source, /<Input\.TextArea/);
  assert.match(source, /data-claude-memory-files-panel="quiet"/);
  assert.match(source, /data-claude-memory-file-row=\{file\.path\}/);
  assert.match(source, /data-claude-memory-editor="quiet"/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);

  assert.doesNotMatch(source, /border-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /border-t-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /divide-y-2 divide-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-subtle\)\]/);
});

test('Preview data covers all CLAUDE.md scenarios', () => {
  const source = readFileSync(previewDataPath, 'utf8');

  assert.match(source, /previewAllFilesSnapshot/, 'must export all-files snapshot');
  assert.match(source, /previewPartialFilesSnapshot/, 'must export partial-files snapshot');
  assert.match(source, /previewMissingImportSnapshot/, 'must export missing-import snapshot');
  assert.match(source, /previewLocalNotGitignoredSnapshot/, 'must export local-not-gitignored snapshot');
  assert.match(source, /previewDeepImportSnapshot/, 'must export deep-import snapshot');
  assert.match(source, /previewEmptySnapshot/, 'must export empty snapshot');
  assert.match(source, /previewUserClaudeMd/, 'must export user file preview');
  assert.match(source, /previewProjectClaudeMd/, 'must export project file preview');
  assert.match(source, /previewLocalClaudeMd/, 'must export local file preview');
  assert.match(source, /previewLocalNotGitignored/, 'must export local-not-gitignored file');
  assert.match(source, /previewMissingImportFile/, 'must export missing-import file');
  assert.match(source, /previewDeepImportFile/, 'must export deep-import file');
  assert.match(source, /previewEditContent/, 'must export edit content example');
});

test('Generated Wails bindings expose CLAUDE.md DTOs', () => {
  const appSource = readFileSync(wailsAppBindingsPath, 'utf8');
  const appTypes = readFileSync(wailsAppTypesPath, 'utf8');
  const modelSource = readFileSync(wailsModelsPath, 'utf8');

  assert.match(appSource, /export function GetClaudeCodeMemoryFilesSnapshot\(\)/);
  assert.match(appSource, /export function SaveClaudeCodeMemoryFile\(arg1\)/);
  assert.match(appTypes, /GetClaudeCodeMemoryFilesSnapshot\(\):Promise<main\.ClaudeCodeMemoryFilesSnapshotDTO>/);
  assert.match(appTypes, /SaveClaudeCodeMemoryFile\(arg1:main\.SaveClaudeCodeMemoryFileInputDTO\):Promise<main\.SaveClaudeCodeMemoryFileResultDTO>/);
  assert.match(modelSource, /export class ClaudeCodeMemoryFilesSnapshotDTO/);
  assert.match(modelSource, /export class ClaudeCodeMemoryFileRecordDTO/);
  assert.match(modelSource, /export class ClaudeCodeMemoryFileImportDTO/);
  assert.match(modelSource, /export class SaveClaudeCodeMemoryFileInputDTO/);
  assert.match(modelSource, /export class SaveClaudeCodeMemoryFileResultDTO/);
});

test('Local file not gitignored shows warning', () => {
  const componentSource = readFileSync(componentPath, 'utf8');
  assert.ok(
    componentSource.includes('not gitignored'),
    'must show warning when local file is not gitignored',
  );
});

test('ClaudeMdFeature reloads after save', () => {
  const source = readFileSync(featurePath, 'utf8');
  assert.match(source, /loadSnapshot\(\)/, 'must reload snapshot after successful save');
});
