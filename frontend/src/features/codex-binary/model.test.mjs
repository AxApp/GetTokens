import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCodexBinaryRows,
  filterCodexBinaryRows,
  formatTaskProgress,
  getCodexBinaryRowActions,
  isActiveDownloadTask,
} from './model.ts';

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
  assert.equal(rows[0].isSelected, true);
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
    primaryAction: 'download_activate',
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
      activateAfterInstall: true,
      updatedAt: '2026-05-12T00:00:00Z',
    },
  };

  assert.equal(isActiveDownloadTask(row.task), true);
  assert.deepEqual(getCodexBinaryRowActions(row), { primary: 'none', secondary: 'cancel' });
  assert.equal(formatTaskProgress(row.task), 50);
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
  assert.equal(filterCodexBinaryRows(rows, 'all').length, 3);
});
