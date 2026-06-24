import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildCodexBinaryRows,
  DEFAULT_CODEX_BINARY_RELEASE_FILTER,
  filterCodexBinaryRows,
  formatBinarySize,
  formatTaskProgress,
  getCodexBinaryRowActions,
  isActiveDownloadTask,
} from './model.ts';

test('default release filter is stable', () => {
  assert.equal(DEFAULT_CODEX_BINARY_RELEASE_FILTER, 'stable');
});

test('buildCodexBinaryRows merges installed and remote release into one cell', () => {
  const rows = buildCodexBinaryRows({
    manifestPath: '/tmp/manifest.json',
    managedBinPath: '/tmp/bin/codex',
    selectedVersionID: '0.119.0-a',
    versions: [
      {
        id: '0.119.0-a',
        displayName: 'Codex 0.119.0',
        detectedVersion: '0.119.0',
        releaseTag: 'rust-v0.119.0',
        sourceID: 'openai-codex-github',
        sourceType: 'download',
        installedAt: '2026-05-11T00:00:00Z',
        isSelected: true,
        existsOnDisk: true,
      },
    ],
    remoteVersions: [
      {
        sourceID: 'openai-codex-github',
        version: '0.119.0',
        tag: 'rust-v0.119.0',
        title: 'rust-v0.119.0',
        downloadURL: 'https://example.com/codex.tar.gz',
        htmlURL: 'https://github.com/openai/codex/releases/tag/rust-v0.119.0',
        assetSize: 18400000,
        publishedAt: '2026-05-11T00:00:00Z',
        isPrerelease: false,
        isInstalled: true,
      },
    ],
    doctor: { severity: 'ok', message: 'ok' },
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].isInstalled, true);
  assert.equal(rows[0].hasRemote, true);
  assert.equal(rows[0].htmlURL, 'https://github.com/openai/codex/releases/tag/rust-v0.119.0');
  assert.equal(rows[0].assetSize, 18400000);
  assert.equal(rows[0].isSelected, true);
});

test('formatBinarySize renders compact binary units', () => {
  assert.equal(formatBinarySize(undefined), '');
  assert.equal(formatBinarySize(0), '');
  assert.equal(formatBinarySize(1024), '1.0 KB');
  assert.equal(formatBinarySize(18400000), '18 MB');
});

test('row actions keep download cancel inside active cell task', () => {
  const row = {
    rowID: 'remote:rust-v0.120.0',
    version: '0.120.0',
    tag: 'rust-v0.120.0',
    sourceID: 'openai-codex-github',
    isInstalled: false,
    isSelected: false,
    isRollback: false,
    hasRemote: true,
    notesState: 'none',
    primaryAction: 'download',
    task: {
      id: 'dl-1',
      sourceID: 'openai-codex-github',
      tag: 'rust-v0.120.0',
      version: '0.120.0',
      status: 'downloading',
      phase: 'download',
      bytesDone: 50,
      bytesTotal: 100,
      installAfterDownload: true,
      activateAfterInstall: false,
      updatedAt: '2026-05-12T00:00:00Z',
    },
  };

  assert.equal(isActiveDownloadTask(row.task), true);
  assert.deepEqual(getCodexBinaryRowActions(row), { primary: 'none', secondary: 'cancel' });
  assert.equal(formatTaskProgress(row.task), 50);
});

test('remote version uses download action before activation', () => {
  const rows = buildCodexBinaryRows({
    manifestPath: '/tmp/manifest.json',
    managedBinPath: '/tmp/bin/codex',
    versions: [],
    remoteVersions: [
      {
        sourceID: 'openai-codex-github',
        version: '0.121.0',
        tag: 'rust-v0.121.0',
        title: 'rust-v0.121.0',
        downloadURL: 'https://example.com/codex.tar.gz',
        htmlURL: 'https://github.com/openai/codex/releases/tag/rust-v0.121.0',
        assetSize: 18400000,
        publishedAt: '2026-05-11T01:00:00Z',
        isPrerelease: false,
        isInstalled: false,
      },
    ],
    doctor: { severity: 'ok', message: 'ok' },
  });

  assert.equal(rows[0].primaryAction, 'download');
  assert.equal(rows[0].htmlURL, 'https://github.com/openai/codex/releases/tag/rust-v0.121.0');
  assert.equal(rows[0].assetSize, 18400000);
  assert.equal(getCodexBinaryRowActions(rows[0]).primary, 'download');
});

test('downloaded newer remote version uses activate action when not selected', () => {
  const rows = buildCodexBinaryRows({
    manifestPath: '/tmp/manifest.json',
    managedBinPath: '/tmp/bin/codex',
    selectedVersionID: '0.120.0-active',
    versions: [
      {
        id: '0.120.0-active',
        displayName: 'Codex 0.120.0',
        detectedVersion: '0.120.0',
        releaseTag: 'rust-v0.120.0',
        sourceID: 'openai-codex-github',
        sourceType: 'download',
        installedAt: '2026-05-10T00:00:00Z',
        isSelected: true,
        existsOnDisk: true,
      },
      {
        id: '0.121.0-installed',
        displayName: 'Codex 0.121.0',
        detectedVersion: '0.121.0',
        releaseTag: 'rust-v0.121.0',
        sourceID: 'openai-codex-github',
        sourceType: 'download',
        installedAt: '2026-05-11T00:00:00Z',
        isSelected: false,
        existsOnDisk: true,
      },
    ],
    doctor: { severity: 'ok', message: 'ok' },
  });

  const downloaded = rows.find((row) => row.version === '0.121.0');
  assert.equal(getCodexBinaryRowActions(downloaded).primary, 'activate');
});

test('installed old version uses rollback action', () => {
  const rows = buildCodexBinaryRows({
    manifestPath: '/tmp/manifest.json',
    managedBinPath: '/tmp/bin/codex',
    selectedVersionID: '0.120.0-b',
    versions: [
      {
        id: '0.116.0-a',
        displayName: 'Codex 0.116.0',
        detectedVersion: '0.116.0',
        sourceID: 'openai-codex-github',
        sourceType: 'download',
        installedAt: '2026-05-10T00:00:00Z',
        isSelected: false,
        existsOnDisk: true,
      },
      {
        id: '0.120.0-b',
        displayName: 'Codex 0.120.0',
        detectedVersion: '0.120.0',
        sourceID: 'openai-codex-github',
        sourceType: 'download',
        installedAt: '2026-05-12T00:00:00Z',
        isSelected: true,
        existsOnDisk: true,
      },
    ],
    doctor: { severity: 'ok', message: 'ok' },
  });

  const oldRow = rows.find((row) => row.version === '0.116.0');
  assert.equal(getCodexBinaryRowActions(oldRow).primary, 'rollback');
});

test('filterCodexBinaryRows separates stable and alpha releases', () => {
  const rows = buildCodexBinaryRows({
    manifestPath: '/tmp/manifest.json',
    managedBinPath: '/tmp/bin/codex',
    selectedVersionID: '0.120.0-stable',
    versions: [
      {
        id: '0.120.0-stable',
        displayName: 'Codex 0.120.0',
        detectedVersion: '0.120.0',
        releaseTag: 'rust-v0.120.0',
        sourceID: 'openai-codex-github',
        sourceType: 'download',
        installedAt: '2026-05-12T00:00:00Z',
        isSelected: true,
        existsOnDisk: true,
      },
    ],
    remoteVersions: [
      {
        sourceID: 'openai-codex-github',
        version: '0.131.0-alpha.9',
        tag: 'rust-v0.131.0-alpha.9',
        title: 'rust-v0.131.0-alpha.9',
        downloadURL: 'https://example.com/codex-alpha.tar.gz',
        publishedAt: '2026-05-12T01:00:00Z',
        isPrerelease: true,
        isInstalled: false,
      },
      {
        sourceID: 'openai-codex-github',
        version: '0.122.0-beta.1',
        tag: 'rust-v0.122.0-beta.1',
        title: 'rust-v0.122.0-beta.1',
        downloadURL: 'https://example.com/codex-beta.tar.gz',
        publishedAt: '2026-05-12T02:00:00Z',
        isPrerelease: true,
        isInstalled: false,
      },
      {
        sourceID: 'openai-codex-github',
        version: '0.121.0',
        tag: 'rust-v0.121.0',
        title: 'rust-v0.121.0',
        downloadURL: 'https://example.com/codex-stable.tar.gz',
        publishedAt: '2026-05-11T01:00:00Z',
        isPrerelease: false,
        isInstalled: false,
      },
    ],
    doctor: { severity: 'ok', message: 'ok' },
  });

  assert.deepEqual(filterCodexBinaryRows(rows, 'alpha').map((row) => row.version), ['0.131.0-alpha.9']);
  assert.deepEqual(filterCodexBinaryRows(rows, 'stable').map((row) => row.version), ['0.121.0', '0.120.0']);
  assert.equal(filterCodexBinaryRows(rows, 'all').length, 4);
});

test('CodexBinaryVersionCell uses the quiet workspace shell', () => {
  const source = readFileSync(new URL('./components/CodexBinaryVersionCell.tsx', import.meta.url), 'utf8');

  assert.match(source, /const codexBinaryVersionCellShellClass =/);
  assert.match(source, /import \{ Button \} from 'antd';/);
  assert.match(source, /<Button/);
  assert.match(source, /data-codex-binary-version-cell="quiet"/);
  assert.match(source, /data-codex-binary-version-progress/);
  assert.match(source, /data-codex-binary-version-notes/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /--gt-status-success/);
  assert.match(source, /--gt-status-warning/);

  assert.doesNotMatch(source, /btn-swiss/);
  assert.doesNotMatch(source, /border-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /border-t-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(source, /shadow-\[4px_4px_0_var\(--gt-shadow-panel\)\]/);
  assert.doesNotMatch(source, /font-(?:medium|bold|extrabold|black)/);
  assert.doesNotMatch(source, /\buppercase\b/);
  assert.doesNotMatch(source, /tracking-\[/);
});

test('Codex binary summary and list use the quiet workspace shell', () => {
  const summarySource = readFileSync(new URL('./components/CodexBinarySummaryPanel.tsx', import.meta.url), 'utf8');
  const listSource = readFileSync(new URL('./components/CodexBinaryVersionList.tsx', import.meta.url), 'utf8');
  const combined = `${summarySource}\n${listSource}`;

  assert.match(summarySource, /const codexBinarySummaryPanelClass =/);
  assert.match(summarySource, /import \{ Button \} from 'antd';/);
  assert.match(summarySource, /<Button/);
  assert.match(summarySource, /const codexBinarySummaryStatusClass =/);
  assert.match(summarySource, /data-codex-binary-summary-panel="quiet"/);
  assert.match(summarySource, /text-\[length:var\(--gt-font-size-xl\)\]/);
  assert.match(summarySource, /text-\[length:var\(--gt-font-size-xs\)\]/);
  assert.match(summarySource, /--gt-surface-canvas/);
  assert.match(summarySource, /--gt-surface-muted/);
  assert.match(summarySource, /--gt-border-subtle/);
  assert.match(summarySource, /--gt-status-success/);
  assert.match(summarySource, /--gt-status-danger/);
  assert.match(summarySource, /--gt-status-warning/);

  assert.match(listSource, /const codexBinaryVersionListLabelClass =/);
  assert.match(listSource, /const codexBinaryVersionListEmptyClass =/);
  assert.match(listSource, /data-codex-binary-version-list="quiet"/);
  assert.match(listSource, /data-codex-binary-version-empty="quiet"/);
  assert.match(listSource, /text-\[length:var\(--gt-font-size-sm\)\]/);

  assert.doesNotMatch(combined, /btn-swiss/);
  assert.doesNotMatch(combined, /border-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(combined, /border-2 border-dashed border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(combined, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(combined, /shadow-\[5px_5px_0_var\(--gt-shadow-panel\)\]/);
  assert.doesNotMatch(combined, /font-(?:medium|bold|extrabold|black)/);
  assert.doesNotMatch(combined, /\btext-(?:xs|sm|xl)\b/);
  assert.doesNotMatch(combined, /\buppercase\b/);
  assert.doesNotMatch(combined, /tracking-\[/);
});
