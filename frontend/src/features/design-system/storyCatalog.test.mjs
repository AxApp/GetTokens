import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  designSystemComponentManifest,
  getAdmittedDesignSystemComponentManifest,
} from './componentManifest.ts';
import {
  businessDesignSystemPreviewCatalog,
  getBusinessDesignSystemPreviewStats,
} from './businessComponentPreviewCatalog.ts';
import {
  DESIGN_SYSTEM_INSPECT_QUERY_VALUE,
  DESIGN_SYSTEM_STORYBOOK_DEV_OPEN_PATH,
  DESIGN_SYSTEM_STORYBOOK_URL,
  designSystemStoryGroups,
  flattenDesignSystemStories,
  getDesignSystemStoryStats,
  resolveDesignSystemInspectOpenURL,
  resolveDesignSystemStorybookOpenURL,
  resolveDesignSystemViteOpenURL,
  resolveDesignSystemWebOpenURL,
} from './storyCatalog.ts';
import { resolveStorybookLocale, storybookLocaleOptions } from './storybookGlobals.ts';

const admittedComponentGroupIds = ['components', 'feature-components'];
const featureComponentsRoot = new URL('../', import.meta.url);
const runtimeDesignSystemComponentPaths = [
  'frontend/src/components/ui/ActionSelect.tsx',
  'frontend/src/components/ui/AssetWorkbenchShell.tsx',
  'frontend/src/components/ui/Combobox.tsx',
  'frontend/src/components/ui/FormField.tsx',
  'frontend/src/components/ui/ModalFrame.tsx',
  'frontend/src/components/ui/PageLoadingFallback.tsx',
  'frontend/src/components/ui/SearchInput.tsx',
  'frontend/src/components/ui/SegmentedControl.tsx',
  'frontend/src/components/ui/SnippetPre.tsx',
  'frontend/src/components/ui/ToggleSwitch.tsx',
  'frontend/src/components/ui/WorkspacePageHeader.tsx',
  'frontend/src/features/codex-binary/components/CodexBinarySummaryPanel.tsx',
  'frontend/src/features/codex-binary/components/CodexBinaryVersionCell.tsx',
  'frontend/src/features/settings/components/SettingsReleasePanel.tsx',
];

async function listFeatureComponentSourcePaths(directoryURL = featureComponentsRoot) {
  const directory = fileURLToPath(directoryURL);
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      paths.push(...await listFeatureComponentSourcePaths(new URL(`${entry.name}/`, directoryURL)));
      continue;
    }

    if (!entry.name.endsWith('.tsx') || entry.name.endsWith('.stories.tsx')) {
      continue;
    }

    if (!entryPath.split(sep).includes('components')) {
      continue;
    }

    paths.push(`frontend/src/features/${relative(fileURLToPath(featureComponentsRoot), entryPath).split(sep).join('/')}`);
  }

  return paths.sort();
}

function getCatalogGroup(groupId) {
  return designSystemStoryGroups.find((group) => group.id === groupId);
}

test('design system story groups are stable and populated', () => {
  assert.ok(designSystemStoryGroups.length >= 3);

  const groupIds = new Set();
  const storyIds = new Set();

  for (const group of designSystemStoryGroups) {
    assert.equal(typeof group.id, 'string');
    assert.ok(group.id.length > 0);
    assert.equal(groupIds.has(group.id), false, `duplicate group id: ${group.id}`);
    groupIds.add(group.id);

    assert.equal(typeof group.title, 'string');
    assert.ok(group.title.length > 0);
    assert.ok(group.stories.length > 0, `empty group: ${group.id}`);

    for (const story of group.stories) {
      assert.equal(typeof story.id, 'string');
      assert.ok(story.id.length > 0);
      assert.equal(storyIds.has(story.id), false, `duplicate story id: ${story.id}`);
      storyIds.add(story.id);

      assert.equal(typeof story.title, 'string');
      assert.ok(story.title.length > 0);
      assert.equal(typeof story.path, 'string');
      assert.ok(story.path.endsWith('.stories.tsx'));
      assert.equal(typeof story.storybookTitle, 'string');
      assert.ok(story.storybookTitle.startsWith('Design System/'));
    }
  }
});

test('design system story stats match flattened catalog', () => {
  const stories = flattenDesignSystemStories(designSystemStoryGroups);
  const stats = getDesignSystemStoryStats(designSystemStoryGroups);
  const businessStats = getBusinessDesignSystemPreviewStats();

  assert.equal(stories.length, stats.storyCount);
  assert.equal(designSystemStoryGroups.length, stats.groupCount);
  assert.ok(stats.storyCount >= 10);
  assert.ok(businessStats.previewCount >= 1);
  assert.ok(businessStats.stateCount >= businessStats.previewCount);
});

test('storybook public catalog excludes full business components', async () => {
  const storybookConfigSource = await readFile(new URL('../../../.storybook/main.ts', import.meta.url), 'utf8');
  const storybookStoryPaths = Array.from(storybookConfigSource.matchAll(/'([^']+\.stories\.\@\(ts\|tsx\|mdx\))'/g))
    .map((match) => match[1]);
  const featureComponentGroup = getCatalogGroup('feature-components');

  assert.deepEqual(storybookStoryPaths, [
    '../src/stories/tokens/**/*.stories.@(ts|tsx|mdx)',
    '../src/stories/primitives/**/*.stories.@(ts|tsx|mdx)',
    '../src/components/ui/**/*.stories.@(ts|tsx|mdx)',
  ]);
  assert.doesNotMatch(storybookConfigSource, /\.\.\/src\/\*\*\/\*\.stories/);
  assert.doesNotMatch(storybookConfigSource, /features\/\*\*/);
  assert.ok(featureComponentGroup, 'business design-system catalog stays assigned to the 5173 app entry');

  for (const story of featureComponentGroup.stories) {
    assert.match(story.path, /frontend\/src\/features\//, `${story.path} must stay in the 5173 business design-system catalog`);
    assert.match(story.storybookTitle, /Design System\/业务组件/, `${story.storybookTitle} must remain a business design-system title`);
  }

  for (const story of flattenDesignSystemStories(designSystemStoryGroups).filter((item) => item.path.includes('/components/ui/') || item.path.includes('/stories/'))) {
    assert.doesNotMatch(story.path, /frontend\/src\/features\//, `${story.path} must stay out of the public Storybook catalog`);
    assert.doesNotMatch(story.storybookTitle, /Design System\/业务组件/, `${story.storybookTitle} must stay out of Storybook 6006`);
  }
});

test('modal frame is admitted as a shared design-system component', () => {
  const componentsGroup = getCatalogGroup('components');
  assert.ok(componentsGroup);

  const modalStory = componentsGroup.stories.find((story) => story.id === 'modal-frame');
  assert.ok(modalStory);
  assert.equal(modalStory.title, '弹窗窗口');
  assert.equal(modalStory.storybookTitle, 'Design System/通用组件/弹窗窗口');
  assert.equal(modalStory.path, 'frontend/src/components/ui/ModalFrame.stories.tsx');
});

test('modal frame constrains detail dialogs to the viewport width', async () => {
  const source = await readFile(new URL('../../components/ui/ModalFrame.tsx', import.meta.url), 'utf8');

  assert.match(source, /calc\(100vw-1\.5rem\)/);
  assert.match(source, /var\(--app-sidebar-width, 0px\)/);
  assert.match(source, /overflow-x-hidden/);
  assert.match(source, /min-w-0/);
  assert.match(source, /panelMaxHeightClassNames/);
  assert.match(source, /fixed: 'max-h-\[calc\(100vh-2rem\)\]/);
  assert.match(source, /absolute: 'max-h-\[calc\(100%-2rem\)\]/);
  assert.doesNotMatch(source, /detail: 'max-w-6xl'/);
});

test('asset workbench shell is shared by Codex and Claude extension surfaces', async () => {
  const componentsGroup = getCatalogGroup('components');
  assert.ok(componentsGroup);

  const shellStory = componentsGroup.stories.find((story) => story.id === 'asset-workbench-shell');
  assert.ok(shellStory);
  assert.equal(shellStory.title, '资产工作台框架');
  assert.equal(shellStory.storybookTitle, 'Design System/通用组件/资产工作台框架');
  assert.equal(shellStory.path, 'frontend/src/components/ui/AssetWorkbenchShell.stories.tsx');

  const codexSource = await readFile(new URL('../../features/codex-extensions/CodexExtensionsFeature.tsx', import.meta.url), 'utf8');
  const claudeSource = await readFile(new URL('../../features/claude-code/components/ClaudeCodeAssetWorkbench.tsx', import.meta.url), 'utf8');

  assert.match(codexSource, /AssetWorkbenchShell/, 'Codex Extensions must use the shared asset workbench shell');
  assert.match(claudeSource, /AssetWorkbenchShell/, 'Claude Code assets must use the shared asset workbench shell');
});

test('storybook locale globals default to Chinese and accept English', () => {
  assert.deepEqual(storybookLocaleOptions.map((option) => option.value), ['zh', 'en']);
  assert.equal(resolveStorybookLocale('zh'), 'zh');
  assert.equal(resolveStorybookLocale('en'), 'en');
  assert.equal(resolveStorybookLocale('fr'), 'zh');
  assert.equal(resolveStorybookLocale(undefined), 'zh');
});

test('design system storybook open url uses dev bridge only in dev mode', () => {
  assert.equal(resolveDesignSystemStorybookOpenURL({ dev: false }), DESIGN_SYSTEM_STORYBOOK_URL);
  assert.equal(resolveDesignSystemStorybookOpenURL({ dev: true }), DESIGN_SYSTEM_STORYBOOK_DEV_OPEN_PATH);
  assert.equal(
    resolveDesignSystemStorybookOpenURL({ dev: true, origin: 'http://127.0.0.1:34115' }),
    `http://127.0.0.1:34115${DESIGN_SYSTEM_STORYBOOK_DEV_OPEN_PATH}`,
  );
  assert.equal(
    resolveDesignSystemStorybookOpenURL({ dev: true, origin: 'wails://wails.localhost:34115' }),
    `http://127.0.0.1:34115${DESIGN_SYSTEM_STORYBOOK_DEV_OPEN_PATH}`,
  );
});


test('design system 5173 web open url always targets the vite app design-system frame', () => {
  assert.equal(resolveDesignSystemViteOpenURL(), 'http://127.0.0.1:5173/#frame=design-system');
  assert.equal(
    resolveDesignSystemViteOpenURL({ origin: 'http://127.0.0.1:34115' }),
    'http://127.0.0.1:5173/#frame=design-system',
  );
  assert.equal(
    resolveDesignSystemViteOpenURL({ origin: 'wails://wails.localhost:34115' }),
    'http://127.0.0.1:5173/#frame=design-system',
  );
});

test('design system web open url normalizes Wails dev origin', () => {
  assert.equal(resolveDesignSystemWebOpenURL(), '/#frame=design-system');
  assert.equal(
    resolveDesignSystemWebOpenURL({ origin: 'http://127.0.0.1:34115' }),
    'http://127.0.0.1:34115/#frame=design-system',
  );
  assert.equal(
    resolveDesignSystemWebOpenURL({ origin: 'wails://wails.localhost:34115' }),
    'http://127.0.0.1:34115/#frame=design-system',
  );
});

test('design system inspect entry resolves dev URL and starts inspect mode by query', () => {
  assert.equal(DESIGN_SYSTEM_INSPECT_QUERY_VALUE, 'design-system');
  assert.equal(resolveDesignSystemInspectOpenURL(), '/?inspect=design-system#frame=design-system');
  assert.equal(
    resolveDesignSystemInspectOpenURL({ origin: 'http://127.0.0.1:34115' }),
    'http://127.0.0.1:34115/?inspect=design-system#frame=design-system',
  );
  assert.equal(
    resolveDesignSystemInspectOpenURL({ origin: 'wails://wails.localhost:34115' }),
    'http://127.0.0.1:34115/?inspect=design-system#frame=design-system',
  );
});

test('design system inspect mode is wired to the dev inspector runtime', async () => {
  const mainSource = await readFile(new URL('../../main.tsx', import.meta.url), 'utf8');
  const inspectSource = await readFile(new URL('./inspectMode.ts', import.meta.url), 'utf8');
  const viteSource = await readFile(new URL('../../../vite.config.js', import.meta.url), 'utf8');
  const entrySource = await readFile(new URL('./DesignSystemEntryFeature.tsx', import.meta.url), 'utf8');

  assert.match(mainSource, /initDesignSystemInspectMode/);
  assert.match(mainSource, /import\.meta\.env\.DEV/);
  assert.match(inspectSource, /initInspector/);
  assert.match(inspectSource, /DESIGN_SYSTEM_INSPECT_QUERY_VALUE/);
  assert.match(inspectSource, /window\.__gettokensDesignSystemInspector/);
  assert.match(inspectSource, /data-design-system-inspect-mode/);
  assert.match(inspectSource, /dispatchEvent/);
  assert.match(viteSource, /createViteDebugInspectorPlugin\(\)/);
  assert.match(entrySource, /resolveDesignSystemInspectOpenURL/);
  assert.match(entrySource, /design_system\.inspect_elements/);
});

test('vite dev retries Wails generated bindings during regeneration window', async () => {
  const viteSource = await readFile(new URL('../../../vite.config.js', import.meta.url), 'utf8');

  assert.match(viteSource, /wailsGeneratedFileRetryPlugin/);
  assert.match(viteSource, /wails-generated-file-retry/);
  assert.match(viteSource, /wailsjs/);
  assert.match(viteSource, /ENOENT/);
  assert.match(viteSource, /command === 'serve' \? wailsGeneratedFileRetryPlugin\(\) : null/);
});

test('provider modules keep React Fast Refresh compatible exports', async () => {
  const debugProviderSource = await readFile(new URL('../../context/DebugContext.tsx', import.meta.url), 'utf8');
  const accountsProviderSource = await readFile(new URL('../accounts/AccountsPageStateProvider.tsx', import.meta.url), 'utf8');
  const accountsFeatureSource = await readFile(new URL('../accounts/AccountsFeature.tsx', import.meta.url), 'utf8');
  const accountImportSource = await readFile(new URL('../../pages/AccountImportPage.tsx', import.meta.url), 'utf8');

  assert.match(debugProviderSource, /export function DebugProvider/);
  assert.doesNotMatch(debugProviderSource, /export function useDebug/);
  assert.match(accountsProviderSource, /export function AccountsPageStateProvider/);
  assert.doesNotMatch(accountsProviderSource, /export function useAccountsPageStateContext/);
  assert.match(accountsFeatureSource, /from [\"']\.\/AccountsPageStateContext[\"']/);
  assert.match(accountImportSource, /from [\"']\.\.\/features\/accounts\/AccountsPageStateContext[\"']/);
});

test('component stories expose an overview state matrix', async () => {
  const componentGroups = designSystemStoryGroups.filter((group) => admittedComponentGroupIds.includes(group.id));
  assert.equal(componentGroups.length, admittedComponentGroupIds.length);

  for (const group of componentGroups) {
    for (const story of group.stories) {
      if (story.id === 'codex-account-detail-components') {
        continue;
      }

      const storyFile = story.path.replace('frontend/src/', '../../');
      const source = await readFile(new URL(storyFile, import.meta.url), 'utf8');

      assert.match(source, /export const Overview\s*:/, `${story.path} must export Overview`);
    }
  }
});

test('codex account detail story remains an internal feature story only', async () => {
  const entry = designSystemComponentManifest.find((item) => item.id === 'codex-account-detail-modal');
  assert.ok(entry);
  assert.deepEqual(entry.requiredStates, ['desktop-draft']);
  assert.equal(entry.catalogGroupId, 'feature-components');

  const source = await readFile(new URL('../../features/codex/components/CodexAccountDetailComponents.stories.tsx', import.meta.url), 'utf8');
  assert.match(source, /export const DesktopDraft\s*:/);
  assert.doesNotMatch(source, /export const Overview\s*:/);
  assert.doesNotMatch(source, /export const OpenAICompatible\s*:/);
  assert.doesNotMatch(source, /export const OpenAICompatibleDisabled\s*:/);
  assert.doesNotMatch(source, /export const AuthFile\s*:/);
  assert.doesNotMatch(source, /export const VerifyError\s*:/);
  assert.doesNotMatch(source, /export const Saving\s*:/);
});

test('component stories mark admitted design system components', async () => {
  const componentGroups = designSystemStoryGroups.filter((group) => admittedComponentGroupIds.includes(group.id));
  assert.equal(componentGroups.length, admittedComponentGroupIds.length);

  for (const group of componentGroups) {
    for (const story of group.stories) {
      const storyFile = story.path.replace('frontend/src/', '../../');
      const source = await readFile(new URL(storyFile, import.meta.url), 'utf8');

      assert.match(source, /DesignSystemStoryFrame/, `${story.path} must wrap examples with DesignSystemStoryFrame`);
    }
  }
});

test('runtime design system components expose project highlight markers', async () => {
  const appSource = await readFile(new URL('../../App.tsx', import.meta.url), 'utf8');
  const styleSource = await readFile(new URL('../../style.css', import.meta.url), 'utf8');

  assert.match(appSource, /data-design-system-highlight=\{import\.meta\.env\.DEV \? 'project' : undefined\}/);
  assert.match(appSource, /copyDesignSystemComponentName/);
  assert.match(appSource, /isDesignSystemComponentLabelHit/);
  assert.match(styleSource, /\[data-design-system-highlight='project'\] \[data-design-system-component='true'\]/);
  assert.match(styleSource, /content: attr\(data-design-system-component-name\)/);
  assert.match(styleSource, /cursor: copy/);
  assert.match(styleSource, /data-design-system-component-copied='true'/);

  for (const sourcePath of runtimeDesignSystemComponentPaths) {
    const source = await readFile(new URL(sourcePath.replace('frontend/src/', '../../'), import.meta.url), 'utf8');
    assert.match(source, /data-design-system-component="true"/, `${sourcePath} must expose a project highlight marker`);
    assert.match(
      source,
      /data-design-system-component-name=/,
      `${sourcePath} must identify the marked design component`,
    );
  }
});

test('settings release panel exposes current project git hash metadata', async () => {
  const source = await readFile(new URL('../../features/settings/components/SettingsReleasePanel.tsx', import.meta.url), 'utf8');
  const featureSource = await readFile(new URL('../../features/settings/SettingsFeature.tsx', import.meta.url), 'utf8');
  const storySource = await readFile(new URL('../../features/settings/components/SettingsReleasePanel.stories.tsx', import.meta.url), 'utf8');
  const viteConfigSource = await readFile(new URL('../../../vite.config.js', import.meta.url), 'utf8');

  assert.match(source, /data-design-system-component-name="SettingsReleasePanel"/);
  assert.match(source, /data-design-system-git-hash=\{gitHashLabel\}/);
  assert.match(source, /lg:grid-cols-4/);
  assert.match(featureSource, /gitHashLabel=\{buildGitHashLabel\}/);
  assert.match(featureSource, /gitHashGitHubURL = buildGitHubCommitURL\(getTokensGitHubRepositoryURL, buildGitHashCommit\)/);
  assert.match(featureSource, /const cliProxyApiGitHashLabel = formatBuildGitHash\(sidecarStatus\.gitHash\);/);
  assert.match(featureSource, /cliProxyApiGitHashGitHubURL = buildGitHubCommitURL\(cliProxyApiGitHubRepositoryURL, sidecarStatus\.gitHash \?\? ''\)/);
  assert.match(featureSource, /cliProxyApiGitHashLabel=\{cliProxyApiGitHashLabel\}/);
  assert.match(viteConfigSource, /git rev-parse HEAD/);
  assert.doesNotMatch(viteConfigSource, /git rev-parse --short/);
  assert.match(storySource, /cliProxyApiGitHashTitle: 'CLIProxyAPI Git Hash'/);
  assert.match(storySource, /cliProxyApiGitHashLabel: '7f1c2d9'/);
});

test('feature component manifest covers extracted feature component files', async () => {
  const componentSourcePaths = await listFeatureComponentSourcePaths();
  const manifestSourcePaths = designSystemComponentManifest.map((entry) => entry.sourcePath).sort();

  assert.deepEqual(manifestSourcePaths, componentSourcePaths);

  const ids = new Set();
  for (const entry of designSystemComponentManifest) {
    assert.equal(ids.has(entry.id), false, `duplicate manifest id: ${entry.id}`);
    ids.add(entry.id);
    assert.ok(entry.decisionReason.length > 0, `${entry.id} must explain its decision`);
    assert.ok(entry.matchedPatterns.length > 0, `${entry.id} must record matched design patterns`);

    if (entry.status === 'candidate') {
      assert.ok(entry.requiredStates?.length > 0, `${entry.id} candidate must list required states`);
    }

    if (entry.status === 'deferred') {
      assert.ok(entry.revisitTrigger?.length > 0, `${entry.id} deferred entry must define a revisit trigger`);
    }
  }
});

test('admitted feature component manifest entries stay internal to feature-owned stories or 5173 previews', async () => {
  const featureComponentGroup = getCatalogGroup('feature-components');
  assert.ok(featureComponentGroup);

  const catalogStoriesByPath = new Map(featureComponentGroup.stories.map((story) => [story.path, story]));
  const businessPreviewsByPath = new Map(businessDesignSystemPreviewCatalog.map((preview) => [preview.sourcePath, preview]));
  const admittedStories = new Set();

  for (const entry of getAdmittedDesignSystemComponentManifest()) {
    assert.equal(entry.catalogGroupId, 'feature-components', `${entry.id} must target feature-components`);
    assert.ok(entry.storyPath || entry.previewPath, `${entry.id} must provide a story path or 5173 preview path`);
    assert.ok(entry.requiredStates?.length > 0, `${entry.id} must document admitted states`);
    assert.ok(entry.mockDataSources?.length > 0, `${entry.id} must document mock data`);

    if (entry.previewPath) {
      assert.ok(entry.previewTitle, `${entry.id} must provide a 5173 preview title`);
      assert.equal(entry.previewPath, 'frontend/src/features/design-system/businessComponentPreviews.tsx');
      assert.match(entry.previewTitle, /^5173\/业务组件\//);
      assert.ok(businessPreviewsByPath.has(entry.sourcePath), `${entry.sourcePath} must render in 5173 business previews`);
      const preview = businessPreviewsByPath.get(entry.sourcePath);
      for (const state of entry.requiredStates) {
        if (state === 'scope-project' || state === 'queue' || state === 'analysis-result') {
          continue;
        }
        assert.ok(preview?.states.includes(state), `${entry.id} preview must include state: ${state}`);
      }
      const previewFile = entry.previewPath.replace('frontend/src/', '../../');
      const previewSource = await readFile(new URL(previewFile, import.meta.url), 'utf8');
      assert.doesNotMatch(previewSource, /wailsjs|window\.go|sidecar|fetch\(/, `${entry.previewPath} must use mock data only`);
      continue;
    }

    assert.ok(entry.storyPath, `${entry.id} must provide a story path`);
    assert.ok(entry.storybookTitle, `${entry.id} must provide a Storybook title`);
    assert.match(entry.storyPath, /^frontend\/src\/features\//, `${entry.storyPath} must remain feature-owned`);
    assert.match(entry.storybookTitle, /^Design System\/业务组件\//, `${entry.storybookTitle} remains an internal business story title`);

    const catalogStory = catalogStoriesByPath.get(entry.storyPath);
    if (catalogStory) {
      assert.equal(catalogStory.storybookTitle, entry.storybookTitle);
      admittedStories.add(entry.storyPath);
    }

    const storyFile = entry.storyPath.replace('frontend/src/', '../../');
    const source = await readFile(new URL(storyFile, import.meta.url), 'utf8');
    assert.match(source, new RegExp(`title:\\s*['"]${entry.storybookTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`));
    assert.doesNotMatch(source, /wailsjs|window\.go|sidecar|fetch\(/, `${entry.storyPath} must use mock data only`);
  }

  for (const story of featureComponentGroup.stories) {
    assert.ok(admittedStories.has(story.path), `${story.path} must have admitted manifest coverage`);
  }
});

test('account detail modules expose design-system anatomy and runtime states', async () => {
  const primitivesSource = await readFile(
    new URL('../../features/accounts/components/AccountDetailPrimitives.tsx', import.meta.url),
    'utf8',
  );
  const modalStorySource = await readFile(
    new URL('../../features/accounts/components/AccountModalComponents.stories.tsx', import.meta.url),
    'utf8',
  );
  const unifiedDetailSource = await readFile(
    new URL('../../features/accounts/components/UnifiedAccountDetailModal.tsx', import.meta.url),
    'utf8',
  );
  const codexDetailSource = await readFile(
    new URL('../../features/codex/components/CodexAccountDetailModal.tsx', import.meta.url),
    'utf8',
  );
  const sectionsSource = await readFile(
    new URL('../../features/accounts/components/AccountDetailSections.tsx', import.meta.url),
    'utf8',
  );
  const sectionsEntry = designSystemComponentManifest.find((entry) => entry.id === 'accounts-account-detail-sections');

  assert.ok(sectionsEntry, 'account detail sections must be registered in the design system manifest');
  assert.match(primitivesSource, /data-design-system-component="true"/);
  assert.match(primitivesSource, /data-design-system-component-name=\{componentName\}/);
  assert.match(primitivesSource, /AccountDetailSectionDensity/);
  assert.match(primitivesSource, /AccountDetailModuleStackLayout/);
  assert.match(primitivesSource, /AccountDetailSectionHeader/);
  assert.match(primitivesSource, /data-account-detail-section-header="standard"/);
  assert.match(primitivesSource, /data-account-detail-section-body="compact"/);
  assert.doesNotMatch(primitivesSource, /<div className="min-w-0 space-y-4">/);
  assert.match(primitivesSource, /AccountDetailOverviewGrid/);
  assert.match(primitivesSource, /data-account-detail-overview-grid="runtime-evidence"/);
  assert.match(primitivesSource, /data-account-detail-overview-equal-height/);
  assert.match(primitivesSource, /data-account-detail-overview-slot="runtime"[^>]+h-full/);
  assert.match(primitivesSource, /data-account-detail-overview-slot="evidence"[^>]+h-full/);
  assert.match(primitivesSource, /data-account-detail-module-layout=\{layout\}/);
  assert.doesNotMatch(sectionsSource, /data-account-runtime-resource-grid="quota-balance"/);
  assert.doesNotMatch(modalStorySource, /AccountRuntimeEvidenceSection/);
  assert.doesNotMatch(modalStorySource, /AccountRuntimeSnapshotSection/);
  assert.match(modalStorySource, /layout="cards"/);
  assert.match(unifiedDetailSource, /layout="bands"/);
  assert.doesNotMatch(unifiedDetailSource, /AccountRuntimeEvidenceSection/);
  assert.doesNotMatch(unifiedDetailSource, /AccountDetailOverviewGrid/);
  assert.match(codexDetailSource, /layout="cards"/);
  assert.doesNotMatch(sectionsSource, /componentName="AccountQuotaSection"[\s\S]{0,220}span="wide"/);
  assert.doesNotMatch(sectionsSource, /componentName="AccountBillingSection"[\s\S]{0,220}span="wide"/);
  assert.ok(!sectionsEntry.requiredStates?.includes('runtime-snapshot'));
  assert.ok(sectionsEntry.requiredStates?.includes('module-layout'));
  assert.ok(sectionsEntry.requiredStates?.includes('card-mode'));
  assert.ok(!sectionsEntry.requiredStates?.includes('runtime-evidence-overview'));
  assert.ok(!sectionsEntry.requiredStates?.includes('quota-balance-grid'));
  assert.ok(sectionsEntry.requiredStates?.includes('quota-billing-side-by-side'));
  assert.ok(sectionsEntry.requiredStates?.includes('standard-module-header'));
}
);
