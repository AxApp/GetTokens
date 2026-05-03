import test from 'node:test';
import assert from 'node:assert/strict';

import { mapCheckedRelease } from './settingsRelease.ts';

test('mapCheckedRelease keeps release page url for manual update flow', () => {
  const release = mapCheckedRelease({
    version: 'v0.1.4',
    releaseUrl: 'https://github.com/AxApp/GetTokens/releases/tag/v0.1.4',
    assetName: 'GetTokens_macOS_AppleSilicon.dmg',
    releaseNote: 'Bug fixes',
  });

  assert.deepEqual(release, {
    version: 'v0.1.4',
    releaseUrl: 'https://github.com/AxApp/GetTokens/releases/tag/v0.1.4',
    assetName: 'GetTokens_macOS_AppleSilicon.dmg',
    releaseNote: 'Bug fixes',
  });
});

test('mapCheckedRelease returns null when updater has no newer release', () => {
  assert.equal(mapCheckedRelease(null), null);
  assert.equal(mapCheckedRelease(undefined), null);
});
