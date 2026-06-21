import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  blue,
  cyan,
  geekblue,
  gold,
  green,
  lime,
  magenta,
  orange,
  purple,
  red,
  volcano,
  yellow,
} from '@ant-design/colors';

const sourceRoot = resolve(import.meta.dirname, '..');
const repoFrontendRoot = resolve(import.meta.dirname, '../..');
const tailwindConfig = resolve(repoFrontendRoot, 'tailwind.config.js');

const antDesignNeutralPalette = [
  '#ffffff',
  '#fafafa',
  '#f5f5f5',
  '#f0f0f0',
  '#d9d9d9',
  '#bfbfbf',
  '#8c8c8c',
  '#595959',
  '#434343',
  '#262626',
  '#1f1f1f',
  '#141414',
  '#000000',
];

const antDesignPalette = new Set(
  [
    ...blue,
    ...purple,
    ...cyan,
    ...green,
    ...magenta,
    ...red,
    ...orange,
    ...yellow,
    ...volcano,
    ...geekblue,
    ...gold,
    ...lime,
    ...antDesignNeutralPalette,
  ].map((color) => color.toLowerCase()),
);

const sourceExtensions = new Set(['.css', '.js', '.ts', '.tsx']);

function listRuntimeSourceFiles(root) {
  const files = [];
  for (const entry of readdirSync(root)) {
    const path = resolve(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...listRuntimeSourceFiles(path));
      continue;
    }
    if (entry.includes('.test.') || entry.includes('.stories.')) {
      continue;
    }
    const ext = entry.slice(entry.lastIndexOf('.'));
    if (sourceExtensions.has(ext)) {
      files.push(path);
    }
  }
  return files;
}

function normalizeHex(hex) {
  const value = hex.toLowerCase();
  if (value.length === 4) {
    return '#' + value[1] + value[1] + value[2] + value[2] + value[3] + value[3];
  }
  return value;
}

function isAllowedBlackAlphaColor(value) {
  const normalized = value.toLowerCase().replace(/\s+/g, '');
  return /^rgba?\(0,?0,?0(?:[,/](?:0?\.\d+|1|0))?\)$/.test(normalized);
}

test('runtime color literals are restricted to the Ant Design color specification', () => {
  const findings = [];
  const files = [...listRuntimeSourceFiles(sourceRoot), tailwindConfig];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const relativePath = file.replace(repoFrontendRoot + '/', '');

    for (const match of source.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      const color = normalizeHex(match[0]);
      if (!antDesignPalette.has(color)) {
        findings.push(relativePath + ': unsupported hex ' + match[0]);
      }
    }

    for (const match of source.matchAll(/rgba?\([^)]*\)/g)) {
      if (!isAllowedBlackAlphaColor(match[0])) {
        findings.push(relativePath + ': unsupported rgb color ' + match[0]);
      }
    }
  }

  assert.deepEqual(findings, []);
});
