import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const scanRoots = [
  path.join(repoRoot, 'frontend/src'),
  path.join(repoRoot, 'internal'),
  path.join(repoRoot, 'cmd/gettokens/app.go'),
  path.join(repoRoot, 'cmd/gettokens/app_types.go'),
  path.join(repoRoot, 'cmd/gettokens/app_codex_live_sessions.go'),
];
const forbiddenPatterns = [
  /requestableOnly/,
  /blockedOnly/,
  /disabledOnly/,
  /errorsOnly/,
  /AccountsAvailabilityFilter/,
  /filters\.availability/,
];

test('active account filter code does not use legacy only-style filter names', async () => {
  const files = await collectSourceFiles(scanRoots);
  const offenders = [];

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf8');
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(content)) {
        offenders.push(`${path.relative(repoRoot, filePath)} :: ${pattern}`);
      }
    }
  }

  assert.deepEqual(offenders, []);
});

async function collectSourceFiles(inputs) {
  const files = [];
  for (const input of inputs) {
    const inputStat = await stat(input);
    if (inputStat.isDirectory()) {
      files.push(...(await walk(input)));
    } else if (isSourceFile(input)) {
      files.push(input);
    }
  }
  return files;
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
      continue;
    }
    const nextPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(nextPath)));
      continue;
    }
    if (isSourceFile(nextPath)) {
      files.push(nextPath);
    }
  }
  return files;
}

function isSourceFile(filePath) {
  return !/(\.test|_test)\.[^.]+$/.test(filePath) && !/\.(spec|stories)\.[^.]+$/.test(filePath);
}
