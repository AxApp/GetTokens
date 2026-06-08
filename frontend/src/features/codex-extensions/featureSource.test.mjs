import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Codex MCP workspace blocks structured edits while raw config editor is dirty', async () => {
  const source = await readFile(new URL('./CodexExtensionsFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /const isConfigEditorDirty = configEditor\.content !== configEditor\.originalContent/);
  assert.match(source, /if \(isConfigEditorDirty\) \{/);
  assert.match(source, /codex_extensions\.config_dirty_blocks_structured_edit/);
  assert.match(source, /codex_extensions\.config_dirty_blocks_structured_save/);
  assert.match(source, /SaveCodexMcpServer[\s\S]*toBackendMcpServer\(draft\)/);
});

test('Codex Skills workspace wires detail modal to independent hash helpers', async () => {
  const source = await readFile(new URL('./CodexExtensionsFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /buildCodexSkillDetailFrameHash/);
  assert.match(source, /clearCodexSkillDetailFrameHash/);
  assert.match(source, /readFrameHashState/);
  assert.match(source, /hashchange/);
  assert.match(source, /window\.history\.replaceState\(null, '', buildCodexSkillDetailFrameHash\(window\.location\.hash, skill\.id\)\)/);
  assert.match(source, /window\.history\.replaceState\(null, '', clearCodexSkillDetailFrameHash\(window\.location\.hash\)\)/);
});

test('Skill preview modal renders backend scan warnings', async () => {
  const source = await readFile(new URL('./SkillsModals.tsx', import.meta.url), 'utf8');

  assert.match(source, /skill\.warnings/);
  assert.match(source, /codex_extensions\.skill_scan_warnings/);
});
