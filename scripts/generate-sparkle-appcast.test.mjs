import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

test('generate-sparkle-appcast stages dmg assets and preserves appcast output only', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sparkle-appcast-test-'));
  const releaseDir = path.join(root, 'release');
  const outputDir = path.join(root, 'output');
  const toolDir = path.join(root, 'tools');
  const fakeBin = path.join(toolDir, 'generate_appcast');
  const argsLog = path.join(root, 'args.txt');
  const stdinLog = path.join(root, 'stdin.txt');

  fs.mkdirSync(releaseDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(toolDir, { recursive: true });

  fs.writeFileSync(path.join(releaseDir, 'GetTokens_macOS_AppleSilicon.dmg'), 'arm64');
  fs.writeFileSync(path.join(releaseDir, 'GetTokens_macOS_Intel.dmg'), 'amd64');
  fs.writeFileSync(path.join(releaseDir, 'GetTokens_macOS_AppleSilicon.tar.gz'), 'legacy-updater');
  fs.writeFileSync(path.join(outputDir, 'appcast.xml'), '<rss>old</rss>');

  fs.writeFileSync(
    fakeBin,
    [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      `printf '%s\\n' "$@" > "${argsLog}"`,
      `cat > "${stdinLog}"`,
      'archive_dir="${!#}"',
      'test -f "${archive_dir}/GetTokens_macOS_AppleSilicon.dmg"',
      'test -f "${archive_dir}/GetTokens_macOS_Intel.dmg"',
      'test ! -f "${archive_dir}/GetTokens_macOS_AppleSilicon.tar.gz"',
      'test -f "${archive_dir}/appcast.xml"',
      'printf \'<rss>new</rss>\' > "${archive_dir}/appcast.xml"',
      '',
    ].join('\n'),
    { mode: 0o755 },
  );

  execFileSync('bash', ['scripts/generate-sparkle-appcast.sh', releaseDir, outputDir], {
    cwd: '/Users/linhey/Desktop/linhay-open-sources/GetTokens',
    env: {
      ...process.env,
      SPARKLE_PRIVATE_ED_KEY: 'test-private-key',
      SPARKLE_RELEASE_BASE_URL: 'https://example.com/releases/download/v0.1.7',
      SPARKLE_FULL_RELEASE_NOTES_URL: 'https://example.com/releases/tag/v0.1.7',
      SPARKLE_PRODUCT_URL: 'https://example.com/GetTokens',
      SPARKLE_TOOL_BIN_DIR: toolDir,
    },
  });

  assert.equal(fs.readFileSync(path.join(outputDir, 'appcast.xml'), 'utf8'), '<rss>new</rss>');
  assert.ok(!fs.existsSync(path.join(outputDir, 'GetTokens_macOS_AppleSilicon.dmg')));

  const args = fs.readFileSync(argsLog, 'utf8');
  assert.match(args, /--download-url-prefix\nhttps:\/\/example.com\/releases\/download\/v0.1.7\//);
  assert.match(args, /--full-release-notes-url\nhttps:\/\/example.com\/releases\/tag\/v0.1.7/);
  assert.match(args, /--link\nhttps:\/\/example.com\/GetTokens/);
  assert.equal(fs.readFileSync(stdinLog, 'utf8'), 'test-private-key');
});
