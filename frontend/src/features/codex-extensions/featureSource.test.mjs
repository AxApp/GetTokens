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

test('Codex extension modals use the quiet workspace shell', async () => {
  const mcpSource = await readFile(new URL('./McpModals.tsx', import.meta.url), 'utf8');
  const skillsSource = await readFile(new URL('./SkillsModals.tsx', import.meta.url), 'utf8');
  const combined = `${mcpSource}\n${skillsSource}`;

  assert.match(mcpSource, /const codexExtensionModalPanelClass =/);
  assert.match(mcpSource, /import \{ Button, Input, Select \} from 'antd';/);
  assert.match(mcpSource, /<Button/);
  assert.match(skillsSource, /const codexSkillModalPanelClass =/);
  assert.match(skillsSource, /import \{ Button, Input \} from 'antd';/);
  assert.match(skillsSource, /<Button/);
  assert.match(mcpSource, /data-codex-extension-mcp-modal/);
  assert.match(mcpSource, /data-codex-extension-config-modal/);
  assert.match(skillsSource, /data-codex-extension-skill-install-modal/);
  assert.match(skillsSource, /data-codex-extension-skill-preview-modal/);
  assert.match(skillsSource, /data-codex-extension-skill-remove-alert/);
  assert.match(combined, /--gt-surface-canvas/);
  assert.match(combined, /--gt-surface-muted/);
  assert.match(combined, /--gt-border-subtle/);
  assert.match(combined, /--gt-status-success/);
  assert.match(combined, /--gt-status-warning/);
  assert.match(combined, /--gt-status-danger/);
  assert.doesNotMatch(combined, /card-swiss/);
  assert.doesNotMatch(combined, /btn-swiss/);
  assert.doesNotMatch(combined, /input-swiss/);
  assert.doesNotMatch(combined, /select-swiss/);
  assert.doesNotMatch(combined, /border-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(combined, /border-b-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(combined, /border-t-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(combined, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(combined, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(combined, /font-(?:medium|bold|extrabold|black)/);
  assert.doesNotMatch(combined, /uppercase/);
  assert.doesNotMatch(combined, /tracking-\[/);
  assert.doesNotMatch(combined, /tracking-(wide|wider|widest|tight|tighter|tightest|normal)/);
  assert.match(skillsSource, /text-\[length:var\(--gt-font-size-sm\)\]/);
  assert.doesNotMatch(skillsSource, /!?text-(?:xs|sm|base|lg|xl|2xl|3xl)\b/);
  assert.doesNotMatch(combined, /italicer/);
  assert.doesNotMatch(combined, /shadow-\[8px_8px_0_var\(--gt-shadow-panel\)\]/);
  assert.doesNotMatch(combined, /shadow-hard/);
});

test('Codex extension workspaces use the quiet list shell', async () => {
  const source = await readFile(new URL('./CodexExtensionsFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /import \{ Button \} from 'antd';/);
  assert.match(source, /<Button/);
  assert.match(source, /const codexExtensionsNoticeClass =/);
  assert.match(source, /const codexExtensionsListContentClass =/);
  assert.match(source, /const codexExtensionsListRowClass =/);
  assert.match(source, /!border-b !border-\[var\(--gt-border-subtle\)\]/);
  assert.match(source, /last:!border-b-0/);
  assert.match(source, /data-codex-extension-workspace-list="skills"/);
  assert.match(source, /data-codex-extension-workspace-list="mcp"/);
  assert.match(source, /type="text"[\s\S]{0,220}aria-label=\{`\$\{skill\.name\}/);
  assert.match(source, /type="text"[\s\S]{0,360}data-codex-extension-workspace-list="mcp"/);
  assert.match(source, /!px-4 !py-3[\s\S]{0,180}data-codex-extension-workspace-list="mcp"/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);

  assert.doesNotMatch(source, /btn-swiss/);
  assert.doesNotMatch(source, /border-b-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /divide-y-2 divide-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /border-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(source, /font-(?:medium|bold|extrabold|black)/);
  assert.doesNotMatch(source, /uppercase/);
  assert.doesNotMatch(source, /tracking-\[0\.(16|18)em\]|tracking-wide/);
});
