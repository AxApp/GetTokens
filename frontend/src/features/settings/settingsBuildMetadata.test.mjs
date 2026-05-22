import test from 'node:test';
import assert from 'node:assert/strict';

import { formatBuildGitHash } from './settingsBuildMetadata.ts';

test('formatBuildGitHash keeps short hashes stable', () => {
  assert.equal(formatBuildGitHash('960ebd9fd83f'), '960ebd9fd83f');
});

test('formatBuildGitHash truncates full hashes to the UI label length', () => {
  assert.equal(formatBuildGitHash('960ebd9fd83f5168e2f67b9d3c0b2d7a123456789'), '960ebd9fd83f');
});

test('formatBuildGitHash falls back for missing build metadata', () => {
  assert.equal(formatBuildGitHash(''), 'DEV');
  assert.equal(formatBuildGitHash(undefined), 'DEV');
  assert.equal(formatBuildGitHash('   ', 'UNKNOWN'), 'UNKNOWN');
});
