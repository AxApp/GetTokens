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
  const [source, apiSource, codexPageSource, sidebarSource] = await Promise.all([
    readFile(new URL('./GetTokensExtensionRegistryFeature.tsx', import.meta.url), 'utf8'),
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
  assert.match(source, /data-gettokens-extension-registry-root=/);
  assert.match(source, /data-gettokens-extension-registry-diagnostic=/);
  assert.match(source, /data-gettokens-extension-registry-capability-kind=/);
  assert.match(source, /data-gettokens-extension-registry-source="true"/);
  assert.match(source, /data-gettokens-extension-enable-state=/);
  assert.match(source, /data-gettokens-extension-action-availability=/);
  assert.match(source, /Action Availability/);
  assert.match(source, /Enable State/);
  assert.match(source, /data-gettokens-extension-enable-action=/);
  assert.match(source, /dev\/app-local extension enable-state file/);
  assert.match(source, /不写 Codex config，不执行 capability/);
  assert.match(source, /data-gettokens-extension-codex-config-staged-apply="true"/);
  assert.match(source, /data-gettokens-extension-codex-config-staged-apply-action="prepare"/);
  assert.match(source, /data-gettokens-extension-codex-config-staged-apply-action="apply"/);
  assert.match(source, /stagedApplyTestTargetPath = '\/tmp\/gettokens-extension-codex-config-staged-preview\.toml'/);
  assert.match(source, /未写真实 ~\/\.codex\/config\.toml/);
  assert.match(source, /展示 extension registry snapshot、diagnostics、capability kinds、source\/root 信息/);
  assert.doesNotMatch(source, /SaveCodex|RemoveCodex|OpenCodexSkillInFinder|PreflightCodexMcpServer/);
  assert.doesNotMatch(source, /marketplace/i);
  assert.doesNotMatch(source, /SaveGetTokensExtension|EnableGetTokensExtension|DisableGetTokensExtension|RunGetTokensExtensionCapability/);
});

test('extension registry feature uses the quiet workspace shell', async () => {
  const source = await readFile(new URL('./GetTokensExtensionRegistryFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /const extensionRegistryButtonClass = 'inline-flex h-8 items-center justify-center rounded border border-\[var\(--gt-border-subtle\)\]/);
  assert.match(source, /const extensionRegistryPanelClass = 'rounded border border-\[var\(--gt-border-subtle\)\] bg-\[var\(--gt-surface-canvas\)\]/);
  assert.match(source, /data-gettokens-extension-registry-list-header="true"/);
  assert.match(source, /data-gettokens-extension-registry-aside="true"/);
  assert.match(source, /data-gettokens-extension-registry-selected="true"/);
  assert.doesNotMatch(source, /border-b-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /border-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(source, /font-black uppercase/);
  assert.doesNotMatch(source, /uppercase tracking-\[0\.18em\]/);
});
