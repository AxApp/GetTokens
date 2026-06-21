import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import test from 'node:test';

const srcRoot = new URL('../../', import.meta.url);

const runtimeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
const ignoredFilePatterns = [
  /\.test\.[cm]?[jt]sx?$/,
  /\.stories\.[cm]?[jt]sx?$/,
  /^style\.css$/,
];

const legacyRuntimeStylePattern =
  /btn-swiss|input-swiss|select-swiss|card-swiss|shadow-\[|border-2|bg-\[var\(--bg-(main|surface)\)\]|font-(?:medium|bold|extrabold|black)|\buppercase\b|tracking-\[/;

function extensionOf(filePath) {
  const match = filePath.match(/(\.[^.]+)$/);
  return match ? match[1] : '';
}

async function* walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const nextPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      yield* walk(nextPath);
      continue;
    }
    yield nextPath;
  }
}

test('runtime UI sources do not reintroduce legacy heavy workspace styling', async () => {
  const findings = [];

  for await (const filePath of walk(srcRoot.pathname)) {
    const relativePath = relative(srcRoot.pathname, filePath);
    if (!runtimeExtensions.has(extensionOf(filePath))) {
      continue;
    }
    if (ignoredFilePatterns.some((pattern) => pattern.test(relativePath))) {
      continue;
    }

    const source = await readFile(filePath, 'utf8');
    const lines = source.split('\n');
    lines.forEach((line, index) => {
      if (legacyRuntimeStylePattern.test(line)) {
        findings.push(`${relativePath}:${index + 1}:${line.trim()}`);
      }
    });
  }

  assert.deepEqual(findings, []);
});
