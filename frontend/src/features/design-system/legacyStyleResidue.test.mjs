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
  /btn-swiss|input-swiss|select-swiss|card-swiss|shadow-\[|shadow-(?:lg|xl|2xl)|drop-shadow|border-2|bg-\[var\(--bg-(main|surface)\)\]|--color-(?:chart|status)-|--font-size-|font-(?:medium|bold|extrabold|black)|\buppercase\b|tracking-\[|backdrop-blur|\btransition(?![-\[])|transition-all|transition-transform|transition-opacity|hover:opacity|active:opacity|group-hover:opacity|active:scale|animate-pulse|animate-spin|grayscale|text-\[(?:9|10|11)px\]|opacity-(?:10|30)(?!\d)|usage-desk-(?:curve|area|point)|rangeAnimationVersion|curveMotion|detailTransitionActive|codex-live-(?:chart-enter|point-pulse)|codex-success-hud/;

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
  const legacyStoryStylePattern = /border-2|shadow-\[|gt-surface-panel|gt-shadow-panel|border-muted|--color-(?:chart|status)-|SwissPrimitives/;

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

test('tailwind config does not expose retired visual aliases', async () => {
  const relativePath = '../tailwind.config.js';
  const source = await readFile(join(srcRoot.pathname, relativePath), 'utf8');
  const retiredConfigPatterns = [
    /darkMode:\s*'class'/,
    /'hard(?:-sm|-lg)?':/,
    /\bbg:\s*\{/,
    /\btext:\s*\{/,
    /\bstatus:\s*\{/,
    /\bchart:\s*\{/,
    /gt-surface-panel/,
    /['"]?DEFAULT['"]?:\s*'2px'/,
  ];
  const findings = [];

  source.split('\n').forEach((line, index) => {
    if (retiredConfigPatterns.some((pattern) => pattern.test(line))) {
      findings.push('tailwind.config.js:' + (index + 1) + ':' + line.trim());
    }
  });

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

test('workspace page header uses gt typography tokens', async () => {
  const source = await readFile(join(srcRoot.pathname, 'components/ui/WorkspacePageHeader.tsx'), 'utf8');

  assert.doesNotMatch(source, /\btext-(?:sm|base|lg|xl|2xl|3xl|4xl)\b/);
  assert.match(source, /text-\[length:var\(--gt-font-size-page-title\)\]/);
  assert.match(source, /text-\[length:var\(--gt-font-size-sm\)\]/);
});

test('snippet pre uses gt typography tokens', async () => {
  const source = await readFile(join(srcRoot.pathname, 'components/ui/SnippetPre.tsx'), 'utf8');

  assert.doesNotMatch(source, /\btext-xs\b/);
  assert.match(source, /text-\[length:var\(--gt-font-size-xs\)\]/);
});

test('debug components use gt typography tokens and class-based card styling', async () => {
  const debugFiles = [
    'features/debug/components/DebugHeader.tsx',
    'features/debug/components/DebugEmptyState.tsx',
    'features/debug/components/DebugEntryCard.tsx',
  ];
  const sources = await Promise.all(debugFiles.map((relativePath) => readFile(join(srcRoot.pathname, relativePath), 'utf8')));
  const combined = sources.join('\n');

  assert.doesNotMatch(combined, /\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl)\b/);
  assert.doesNotMatch(sources[2], /style=\{/);
  assert.doesNotMatch(sources[2], /styles=\{\{\s*body/);
  assert.match(combined, /text-\[length:var\(--gt-font-size-page-title\)\]/);
  assert.match(combined, /text-\[length:var\(--gt-font-size-sm\)\]/);
  assert.match(combined, /text-\[length:var\(--gt-font-size-xs\)\]/);
});

test('status feature cards keep static body padding in classes', async () => {
  const source = await readFile(join(srcRoot.pathname, 'features/status/StatusFeature.tsx'), 'utf8');

  assert.doesNotMatch(source, /styles=\{\{\s*body:\s*\{\s*padding:\s*16\s*\}\s*\}\}/);
  assert.match(source, /classNames=\{\{ body: '!p-4' \}\}/);
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

  assert.match(source, /text-\[length:var\(--gt-font-size-xs\)\]/);
  assert.doesNotMatch(source, /!?text-(?:xs|sm|base|lg|xl|2xl|3xl)\b/);

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

test('account import queue keeps fixed card item height in classes', async () => {
  const relativePath = 'features/accounts/components/AccountImportQueueList.tsx';
  const source = await readFile(join(srcRoot.pathname, relativePath), 'utf8');
  const findings = [];

  source.split('\n').forEach((line, index) => {
    if (/height:\s*ACCOUNT_IMPORT_QUEUE_ITEM_HEIGHT - 12/.test(line)) {
      findings.push(`${relativePath}:${index + 1}:${line.trim()}`);
    }
  });

  assert.deepEqual(findings, []);
});

test('usage desk chart keeps static layout tokens in classes', async () => {
  const relativePath = 'features/accounts/components/usage-desk/UsageDeskChart.tsx';
  const source = await readFile(join(srcRoot.pathname, relativePath), 'utf8');
  const findings = [];
  const staticInlineStylePatterns = [
    /^\s*height:.*chartHeight/,
    /opacity:\s*'var\(--usage-chart-axis-opacity\)'/,
  ];

  source.split('\n').forEach((line, index) => {
    if (staticInlineStylePatterns.some((pattern) => pattern.test(line))) {
      findings.push(`${relativePath}:${index + 1}:${line.trim()}`);
    }
  });

  assert.deepEqual(findings, []);
});

test('usage desk chart cards keep static body padding in classes', async () => {
  const source = await readFile(join(srcRoot.pathname, 'features/accounts/components/usage-desk/UsageDeskChart.tsx'), 'utf8');

  assert.doesNotMatch(source, /styles=\{\{\s*body:\s*\{\s*padding:\s*0/);
  assert.match(source, /classNames=\{\{ body: '!p-0' \}\}/);
});

test('account card frame keeps static card body layout in classes', async () => {
  const source = await readFile(join(srcRoot.pathname, 'features/accounts/components/AccountCardFrame.tsx'), 'utf8');

  assert.doesNotMatch(source, /styles=\{\{\s*body:/);
  assert.match(source, /classNames=\{\{ body: 'flex h-full flex-col !p-0' \}\}/);
});

test('runtime inline styles stay limited to approved dynamic rendering boundaries', async () => {
  const allowedInlineStyleBlocks = [
    { path: 'features/design-system/DesignSystemEntryFeature.tsx', pattern: /backgroundColor: value|borderRadius: value|boxShadow: value/ },
    { path: 'features/codex-binary/components/CodexBinaryVersionCell.tsx', pattern: /progress/ },
    { path: 'features/session-management/components/SessionPluginConsolePanel.tsx', pattern: /execution\.progress|keyword\.width/ },
    { path: 'features/session-management/SessionManagementView.tsx', pattern: /item\.weight/ },
    { path: 'features/accounts/components/AccountHealthBar.tsx', pattern: /statusBar\.blocks\.length/ },
    { path: 'features/accounts/components/CardSections.tsx', pattern: /fillPercent|row\.fillPercent|activityPercent/ },
    { path: 'features/accounts/components/AccountImportQueueList.tsx', pattern: /renderWindow\.totalHeight|renderWindow\.topOffset/ },
    { path: 'features/accounts/components/AccountGroupSectionView.tsx', pattern: /renderWindow\.topSpacerHeight|renderWindow\.bottomSpacerHeight/ },
    { path: 'features/accounts/components/usage-desk/UsageDeskChart.tsx', pattern: /chartWidth|helperY - y/ },
  ];
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
    for (const block of collectInlineStyleBlocks(source)) {
      const allowed = allowedInlineStyleBlocks.some(
        (entry) => entry.path === relativePath && entry.pattern.test(block.text),
      );
      if (!allowed) {
        findings.push(relativePath + ':' + block.line + ':' + block.text.replace(/\s+/g, ' ').trim());
      }
    }
  }

  assert.deepEqual(findings, []);
});

function collectInlineStyleBlocks(source) {
  const blocks = [];
  const lines = source.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].includes('style={{')) {
      continue;
    }

    const blockLines = [lines[index].trim()];
    if (!lines[index].includes('}}')) {
      for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
        blockLines.push(lines[nextIndex].trim());
        if (lines[nextIndex].includes('}}')) {
          break;
        }
      }
    }
    blocks.push({ line: index + 1, text: blockLines.join(' ') });
  }

  return blocks;
}

test('selected UI sources keep discrete conditional styles in classes', async () => {
  const relativePaths = [
    'components/ui/Combobox.tsx',
    'features/codex-live-sessions/components/CodexLiveSessionDetail.tsx',
    'features/session-management/components/SessionPluginConsolePanel.tsx',
  ];
  const conditionalInlineStylePatterns = [
    /textAlign:\s*align === 'right'/,
    /style=\{\{ background: seriesPaint \}\}/,
    /height:.*chartHeight/,
    /width:\s*'100%'/,
    /style=\{\{ width: svgWidthStyle \}\}/,
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
