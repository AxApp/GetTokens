import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildFrameHash,
  isCodexWorkspace,
  readFrameHashState,
  resolveInitialCodexWorkspace,
} from '../../utils/pagePersistence.ts';

test('extension registry is parsed as a codex workspace hash entry', () => {
  assert.equal(isCodexWorkspace('extension-registry'), true);
  assert.equal(resolveInitialCodexWorkspace('extension-registry'), 'extension-registry');
  assert.deepEqual(readFrameHashState('#frame=codex&workspace=extension-registry'), {
    page: 'codex',
    codexWorkspace: 'extension-registry',
  });
  assert.equal(
    buildFrameHash('codex', 'all', 'extension-registry', 'codex', 'codex'),
    '#frame=codex&workspace=extension-registry',
  );
});

test('extension registry feature consumes snapshot plus local enable-state binding and renders diagnostics/source metadata', async () => {
  const [source, asideSource, modalSource, apiSource, codexPageSource, sidebarSource] = await Promise.all([
    readFile(new URL('./GetTokensExtensionRegistryFeature.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./RegistryAside.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./ExtensionDetailModal.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./api.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../pages/CodexPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../components/biz/Sidebar.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(apiSource, /GetGetTokensExtensionRegistrySnapshot/);
  assert.match(apiSource, /SetGetTokensExtensionEnabled/);
  assert.match(apiSource, /PrepareGetTokensExtensionCodexConfigApply/);
  assert.match(apiSource, /ApplyGetTokensExtensionCodexConfigTransaction/);
  assert.match(apiSource, /Wails runtime is required before staged Codex config apply/);
  assert.match(codexPageSource, /workspace === 'extension-registry'/);
  assert.match(codexPageSource, /<GetTokensExtensionRegistryFeature \/>/);
  assert.match(sidebarSource, /id: 'extension-registry'/);
  assert.match(sidebarSource, /label: 'nav\.codex_extension_registry'/);
  assert.match(source, /data-gettokens-extension-registry-panel="true"/);
  assert.match(asideSource, /data-gettokens-extension-registry-root=/);
  assert.match(asideSource, /data-gettokens-extension-registry-diagnostic=/);
  assert.match(source, /data-gettokens-extension-registry-capability-kind=/);
  assert.match(source, /data-gettokens-extension-registry-source="true"/);
  assert.match(source, /data-gettokens-extension-enable-state=/);
  assert.match(source, /data-gettokens-extension-action-availability=/);
  assert.match(modalSource, /Action Availability/);
  assert.match(modalSource, /Enable State/);
  assert.match(modalSource, /data-gettokens-extension-enable-action=/);
  assert.match(modalSource, /data-gettokens-extension-detail-close="true"/);
  assert.match(source, /Local enable-state only/);
  assert.match(source, /mode \{snapshot\.registryMode \|\| 'unknown'\}/);
  assert.match(asideSource, /data-gettokens-extension-codex-config-staged-apply="true"/);
  assert.match(asideSource, /data-gettokens-extension-codex-config-staged-apply-action="prepare"/);
  assert.match(asideSource, /data-gettokens-extension-codex-config-staged-apply-action="apply"/);
  assert.match(source, /stagedApplyTestTargetPath = '\/tmp\/gettokens-extension-codex-config-staged-preview\.toml'/);
  assert.match(source, /outside ~\/\.codex\/config\.toml/);
  assert.doesNotMatch(source, /Generated \{formatRegistryGeneratedAt\(snapshot\.generatedAt\)\}/);
  assert.doesNotMatch(source, /展示 extension registry snapshot、diagnostics、capability kinds、source\/root 信息/);
  assert.doesNotMatch(source, /SaveCodex|RemoveCodex|OpenCodexSkillInFinder|PreflightCodexMcpServer/);
  assert.doesNotMatch(source, /marketplace/i);
  assert.doesNotMatch(source, /SaveGetTokensExtension|EnableGetTokensExtension|DisableGetTokensExtension|RunGetTokensExtensionCapability/);
});

test('extension registry feature uses the quiet workspace shell', async () => {
  const [source, asideSource, modalSource] = await Promise.all([
    readFile(new URL('./GetTokensExtensionRegistryFeature.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./RegistryAside.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./ExtensionDetailModal.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(source, /import \{ Table, Tag \} from 'antd';/);
  assert.match(source, /<Table/);
  assert.match(asideSource, /import \{ Button, Collapse, Tag, Tooltip \} from 'antd';/);
  assert.match(modalSource, /import \{ Button, Tag, Divider, Tabs, Tooltip \} from 'antd';/);
  assert.match(source, /buildCodexDetailFrameHash/);
  assert.match(source, /clearCodexDetailFrameHash/);
  assert.match(source, /openExtensionDetail\(record\.id \|\| record\.manifestPath\)/);
  assert.match(asideSource, /items=\{\[/);
  assert.match(modalSource, /items=\{tabs\}/);
  assert.match(source, /const extensionRegistryPanelClass = 'rounded border border-\[var\(--gt-border-subtle\)\] bg-\[var\(--gt-surface-canvas\)\]/);
  assert.match(source, /<div className="grid w-full gap-3">/);
  assert.match(source, /<SearchInput[\s\S]*className="w-full"/);
  assert.match(source, /data-gettokens-extension-registry-list-header="true"/);
  assert.match(source, /data-gettokens-extension-registry-aside="true"/);
  assert.match(modalSource, /data-gettokens-extension-registry-selected="true"/);
  assert.doesNotMatch(source, /border-b-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /border-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(source, /font-(?:medium|bold|extrabold|black)/);
  assert.doesNotMatch(source, /uppercase tracking-\[0\.18em\]/);
  assert.doesNotMatch(source, /text-\[\d+px\]/);
  assert.doesNotMatch(source, /transition-/);

  assert.doesNotMatch(asideSource, /border-b-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(asideSource, /border-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(asideSource, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(asideSource, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(asideSource, /font-(?:medium|bold|extrabold|black)/);
  assert.doesNotMatch(asideSource, /uppercase tracking-\[0\.18em\]/);
  assert.doesNotMatch(asideSource, /Collapse\.Panel/);
  assert.doesNotMatch(asideSource, /text-\[\d+px\]/);
  assert.doesNotMatch(asideSource, /transition-/);

  assert.doesNotMatch(modalSource, /border-b-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(modalSource, /border-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(modalSource, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(modalSource, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(modalSource, /font-(?:medium|bold|extrabold|black)/);
  assert.doesNotMatch(modalSource, /uppercase tracking-\[0\.18em\]/);
  assert.doesNotMatch(modalSource, /Tabs\.TabPane/);
  assert.doesNotMatch(modalSource, /text-\[\d+px\]/);
  assert.doesNotMatch(modalSource, /transition-/);
});
