import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGitHubCommitURL,
  buildGetTokensReleaseURL,
  mapCheckedRelease,
} from './settingsRelease.ts';

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

test('buildGitHubCommitURL links valid hashes to the selected repository', () => {
  assert.equal(
    buildGitHubCommitURL('https://github.com/AxApp/GetTokens', '960ebd9fd83f'),
    'https://github.com/AxApp/GetTokens/commit/960ebd9fd83f',
  );
  assert.equal(
    buildGitHubCommitURL('https://github.com/AxApp/CLIProxyAPI', ' e5bcdfb6 '),
    'https://github.com/AxApp/CLIProxyAPI/commit/e5bcdfb6',
  );
});

test('buildGitHubCommitURL ignores placeholder build hashes', () => {
  assert.equal(buildGitHubCommitURL('https://github.com/AxApp/GetTokens', 'DEV'), '');
  assert.equal(buildGitHubCommitURL('https://github.com/AxApp/GetTokens', '—'), '');
  assert.equal(buildGitHubCommitURL('https://github.com/AxApp/GetTokens', ''), '');
});

test('buildGetTokensReleaseURL prefers checked release url and falls back to current version tag', () => {
  assert.equal(
    buildGetTokensReleaseURL('1.0.23', 'https://github.com/AxApp/GetTokens/releases/tag/v1.0.24'),
    'https://github.com/AxApp/GetTokens/releases/tag/v1.0.24',
  );
  assert.equal(
    buildGetTokensReleaseURL('1.0.23'),
    'https://github.com/AxApp/GetTokens/releases/tag/v1.0.23',
  );
  assert.equal(buildGetTokensReleaseURL('DEV'), '');
});
