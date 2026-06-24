import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import test from 'node:test';

const srcRoot = new URL('../../', import.meta.url);

const runtimeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
const ignoredFilePatterns = [
  /\.test\.[cm]?[jt]sx?$/,
  /\.stories\.[cm]?[jt]sx?$/,
];

const legacyRuntimeStylePattern =
  /btn-swiss|input-swiss|select-swiss|card-swiss|shadow-\[|shadow-(?:lg|xl|2xl)|drop-shadow|border-2|bg-\[var\(--bg-(main|surface)\)\]|font-(?:medium|bold|extrabold|black)|\buppercase\b|tracking-\[|backdrop-blur|\btransition(?![-\[])|transition-all|transition-transform|transition-opacity|hover:opacity|active:opacity|group-hover:opacity|active:scale|animate-pulse|animate-spin|grayscale|text-\[(?:9|10|11)px\]|opacity-(?:10|30)(?!\d)|usage-desk-(?:curve|area|point)|rangeAnimationVersion|curveMotion|detailTransitionActive|codex-live-(?:chart-enter|point-pulse)|codex-success-hud/;

const inlineTypographyGateFiles = [
  'features/debug/components/DebugEntryCard.tsx',
  'features/debug/components/DebugHeader.tsx',
  'features/debug/components/DebugEmptyState.tsx',
  'features/design-system/DesignSystemEntryFeature.tsx',
  'features/accounts/components/AccountsToolbar.tsx',
  'features/settings/SettingsFeature.tsx',
  'features/accounts/components/AttributionCard.tsx',
  'features/accounts/components/AccountGroupSectionView.tsx',
  'features/settings/components/SettingsReleasePanel.tsx',
  'features/codex-live-sessions/components/CodexLiveSessionDetail.tsx',
  'features/accounts/components/usage-desk/UsageDeskChart.tsx',
];

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

test('storybook examples do not teach legacy heavy workspace styling', async () => {
  const findings = [];
  const legacyStoryStylePattern = /border-2|shadow-\[|gt-surface-panel|gt-shadow-panel|border-muted|SwissPrimitives/;

  for await (const filePath of walk(srcRoot.pathname)) {
    const relativePath = relative(srcRoot.pathname, filePath);
    if (!/\.stories\.[cm]?[jt]sx?$/.test(relativePath)) {
      continue;
    }

    if (/SwissPrimitives/.test(relativePath)) {
      findings.push(`${relativePath}:1:legacy story filename`);
    }

    const source = await readFile(filePath, 'utf8');
    const lines = source.split('\n');
    lines.forEach((line, index) => {
      if (legacyStoryStylePattern.test(line)) {
        findings.push(`${relativePath}:${index + 1}:${line.trim()}`);
      }
    });
  }

  assert.deepEqual(findings, []);
});

test('selected UI sources keep static typography and colors in classes', async () => {
  const findings = [];
  const inlineTypographyPattern = /style=\{\{[^\n}]*(fontFamily|fontSize|fontWeight|color|lineHeight)/;

  for (const relativePath of inlineTypographyGateFiles) {
    const source = await readFile(join(srcRoot.pathname, relativePath), 'utf8');
    const lines = source.split('\n');
    lines.forEach((line, index) => {
      if (inlineTypographyPattern.test(line)) {
        findings.push(`${relativePath}:${index + 1}:${line.trim()}`);
      }
    });
  }

  assert.deepEqual(findings, []);
});
