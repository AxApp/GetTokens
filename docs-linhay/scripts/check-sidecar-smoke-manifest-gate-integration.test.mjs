#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const checkDocsPath = path.join(scriptDir, 'check-docs.sh');
const checkerPath = path.join(
  repoRoot,
  'docs-linhay',
  'references',
  'CLIProxyAPI',
  'scripts',
  'check-sidecar-smoke-manifest.mjs',
);
const fixturePath = path.join(
  repoRoot,
  'docs-linhay',
  'references',
  'CLIProxyAPI',
  'fixtures',
  'sidecar-smoke',
  'cli-proxy-api-round26-smoke-manifest.fixture.json',
);
const latestPath = '/private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round26-smoke-manifest.json';
const execFileAsync = promisify(execFile);

const [checkDocs, checkerSource, fixtureSource] = await Promise.all([
  readFile(checkDocsPath, 'utf8'),
  readFile(checkerPath, 'utf8'),
  readFile(fixturePath, 'utf8'),
]);

assert.match(
  checkDocs,
  /check-sidecar-smoke-manifest\.mjs" fixture/,
  'docs check must invoke the sidecar smoke manifest checker in fixture mode',
);
assert.match(
  checkerSource,
  /binarySha256Volatile/,
  'checker must require the binarySha256Volatile boundary field',
);
assert.match(
  checkerSource,
  /dirtyStatusEvidenceOnly/,
  'checker must require the dirtyStatusEvidenceOnly release boundary field',
);

{
  const result = await execFileAsync(process.execPath, [checkerPath, 'fixture'], {
    cwd: repoRoot,
    maxBuffer: 10 * 1024 * 1024,
  });
  assert.match(result.stdout, /manifest ok/);
  assert.match(result.stdout, /mode=fixture/);
  assert.match(result.stdout, /binarySha256Volatile=true/);
  assert.match(result.stdout, /dirtyStatusEvidenceOnly=true/);
}

await mkdir(path.dirname(latestPath), { recursive: true });
let previousLatestManifest;
try {
  previousLatestManifest = await readFile(latestPath, 'utf8');
} catch {
  previousLatestManifest = undefined;
}
await writeFile(latestPath, fixtureSource);
try {
  const result = await execFileAsync(process.execPath, [checkerPath, 'latest'], {
    cwd: repoRoot,
    maxBuffer: 10 * 1024 * 1024,
  });
  assert.match(result.stdout, /manifest ok/);
  assert.match(result.stdout, /mode=latest/);
} finally {
  if (previousLatestManifest === undefined) {
    await rm(latestPath, { force: true });
  } else {
    await writeFile(latestPath, previousLatestManifest);
  }
}

const tmpRoot = await mkdtemp(path.join(tmpdir(), 'gettokens-sidecar-manifest-gate-'));
try {
  const invalidPath = path.join(tmpRoot, 'invalid-sidecar-smoke-manifest.json');
  const invalidManifest = JSON.parse(fixtureSource);
  delete invalidManifest.reproducibilityBoundary.binarySha256Volatile;
  await writeFile(invalidPath, JSON.stringify(invalidManifest, null, 2));
  await assert.rejects(
    execFileAsync(process.execPath, [checkerPath, invalidPath], {
      cwd: repoRoot,
      maxBuffer: 10 * 1024 * 1024,
    }),
    (error) => {
      const stderr = String(error.stderr || '');
      assert.match(stderr, /binarySha256Volatile/);
      return true;
    },
  );
} finally {
  await rm(tmpRoot, { recursive: true, force: true });
}

console.log('Sidecar smoke manifest gate integration policy passed.');
