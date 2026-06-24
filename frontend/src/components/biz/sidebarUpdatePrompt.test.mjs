import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { resolveSidebarUpdatePrompt } from './sidebarUpdatePrompt.ts';

const release = {
  version: '1.0.27',
  releaseUrl: 'https://github.com/AxApp/GetTokens/releases/tag/v1.0.27',
  assetName: 'GetTokens_macOS_AppleSilicon.dmg',
  releaseNote: 'Update notes',
};

test('sidebar update prompt stays hidden until a new release is known', () => {
  assert.equal(
    resolveSidebarUpdatePrompt({
      availableRelease: null,
      canApplyUpdate: true,
      usesNativeUpdaterUI: false,
    }),
    null,
  );
});

test('sidebar update prompt applies directly when in-place updates are supported', () => {
  assert.deepEqual(
    resolveSidebarUpdatePrompt({
      availableRelease: release,
      canApplyUpdate: true,
      usesNativeUpdaterUI: false,
    }),
    {
      action: 'apply',
      releaseVersion: '1.0.27',
    },
  );
});

test('sidebar update prompt opens the release page when in-place updates are unavailable', () => {
  assert.deepEqual(
    resolveSidebarUpdatePrompt({
      availableRelease: release,
      canApplyUpdate: false,
      usesNativeUpdaterUI: false,
    }),
    {
      action: 'open-release-page',
      releaseVersion: '1.0.27',
    },
  );
});

test('sidebar update prompt delegates to native updater UI when present', () => {
  assert.deepEqual(
    resolveSidebarUpdatePrompt({
      availableRelease: release,
      canApplyUpdate: true,
      usesNativeUpdaterUI: true,
    }),
    {
      action: 'native',
      releaseVersion: '1.0.27',
    },
  );
});

test('sidebar update prompt UI uses green success styling and carries the release version', async () => {
  const source = await readFile(new URL('./Sidebar.tsx', import.meta.url), 'utf8');

  assert.match(source, /--gt-status-success/);
  assert.match(source, /!text-\[var\(--gt-ink-inverse\)\]/);
  assert.match(source, /updateButtonLabel[\s\S]*updatePrompt\?\.releaseVersion/);
  assert.doesNotMatch(source, /\{t\('nav\.update_available'\)\}\s*\{updatePrompt\.releaseVersion\}/);
});
