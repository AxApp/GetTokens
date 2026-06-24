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
  'features/accounts/components/CardSections.tsx',
  'features/accounts/components/AccountDetailPrimitives.tsx',
  'components/ui/WorkspacePageHeader.tsx',
  'components/biz/Sidebar.tsx',
  'features/gettokens-extension-registry/GetTokensExtensionRegistryFeature.tsx',
];

const inlineStaticSurfaceGateFiles = [
  'features/accounts/components/AccountCardSkeleton.tsx',
  'components/biz/Sidebar.tsx',
  'features/accounts/components/AttributionCard.tsx',
  'features/debug/DebugFeature.tsx',
  'components/ui/ModalFrame.tsx',
  'components/ui/WorkspacePageHeader.tsx',
  'features/settings/components/SettingsReleasePanel.tsx',
  'features/settings/SettingsFeature.tsx',
  'features/accounts/components/AccountsToolbar.tsx',
  'features/accounts/components/AccountHealthBar.tsx',
  'features/design-system/DesignSystemEntryFeature.tsx',
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

test('selected UI sources keep static surface and border tokens in classes', async () => {
  const findings = [];
  const inlineSurfacePattern = /style=\{\{[^\n}]*(backgroundColor|borderColor|border(?:Top|Right|Bottom|Left)?):\s*['"][^'"]*var\(--gt-(surface|border|ink|status)/;

  for (const relativePath of inlineStaticSurfaceGateFiles) {
    const source = await readFile(join(srcRoot.pathname, relativePath), 'utf8');
    const lines = source.split('\n');
    lines.forEach((line, index) => {
      if (inlineSurfacePattern.test(line)) {
        findings.push(`${relativePath}:${index + 1}:${line.trim()}`);
      }
    });
  }

  assert.deepEqual(findings, []);
});

test('DesignSystemEntryFeature keeps inline styles limited to dynamic token demos', async () => {
  const relativePath = 'features/design-system/DesignSystemEntryFeature.tsx';
  const allowedInlineStylePatterns = [
    /style=\{\{ backgroundColor: value \}\}/,
    /style=\{\{ borderRadius: value \}\}/,
    /style=\{\{ boxShadow: value \|\| 'none' \}\}/,
  ];
  const findings = [];
  const source = await readFile(join(srcRoot.pathname, relativePath), 'utf8');
  const lines = source.split('\n');

  lines.forEach((line, index) => {
    if (!line.includes('style={{')) {
      return;
    }
    if (allowedInlineStylePatterns.some((pattern) => pattern.test(line))) {
      return;
    }
    findings.push(`${relativePath}:${index + 1}:${line.trim()}`);
  });

  assert.deepEqual(findings, []);
});

test('account detail shell keeps static selection and menu styling in classes', async () => {
  const relativePaths = [
    'features/accounts/components/AccountDetailLayout.tsx',
    'features/accounts/components/AccountDetailPrimitives.tsx',
  ];
  const staticInlineStylePatterns = [
    /userSelect:\s*'text'/,
    /fontFamily:\s*'var\(--gt-font-family-sans\)'/,
    /background:\s*'transparent'/,
    /borderInlineEnd:\s*0/,
  ];
  const findings = [];

  for (const relativePath of relativePaths) {
    const source = await readFile(join(srcRoot.pathname, relativePath), 'utf8');
    const lines = source.split('\n');
    lines.forEach((line, index) => {
      if (staticInlineStylePatterns.some((pattern) => pattern.test(line))) {
        findings.push(`${relativePath}:${index + 1}:${line.trim()}`);
      }
    });
  }

  assert.deepEqual(findings, []);
});

test('selected UI sources keep small static layout styles in classes', async () => {
  const relativePaths = [
    'App.tsx',
    'components/biz/Sidebar.tsx',
    'features/accounts/components/AccountCardFrame.tsx',
    'features/accounts/components/usage-desk/UsageDeskPanels.tsx',
    'features/accounts/components/AccountsToolbar.tsx',
    'features/accounts/components/OpenAICompatibleProviderCard.tsx',
  ];
  const staticInlineLayoutPatterns = [
    /overscrollBehavior:\s*'contain'/,
    /borderInlineEnd:\s*0/,
    /background:\s*'transparent'/,
    /fontFamily:\s*'var\(--gt-font-family-sans\)'/,
    /tableLayout:\s*'auto'/,
    /visibility:\s*'hidden'/,
    /minHeight:\s*'48rem'/,
    /style=\{\{/,
    /--app-sidebar-width':/,
  ];
  const findings = [];

  for (const relativePath of relativePaths) {
    const source = await readFile(join(srcRoot.pathname, relativePath), 'utf8');
    const lines = source.split('\n');
    lines.forEach((line, index) => {
      if (staticInlineLayoutPatterns.some((pattern) => pattern.test(line))) {
        findings.push(`${relativePath}:${index + 1}:${line.trim()}`);
      }
    });
  }

  assert.deepEqual(findings, []);
});

test('selected UI sources keep discrete conditional styles in classes', async () => {
  const relativePaths = [
    'components/ui/Combobox.tsx',
    'features/session-management/components/SessionPluginConsolePanel.tsx',
  ];
  const conditionalInlineStylePatterns = [
    /textAlign:\s*align === 'right'/,
    /borderColor:/,
    /borderRightColor:/,
  ];
  const findings = [];

  for (const relativePath of relativePaths) {
    const source = await readFile(join(srcRoot.pathname, relativePath), 'utf8');
    const lines = source.split('\n');
    lines.forEach((line, index) => {
      if (conditionalInlineStylePatterns.some((pattern) => pattern.test(line))) {
        findings.push(`${relativePath}:${index + 1}:${line.trim()}`);
      }
    });
  }

  assert.deepEqual(findings, []);
});
