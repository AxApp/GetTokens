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
  DESIGN_SYSTEM_STORYBOOK_DEV_OPEN_PATH,
  DESIGN_SYSTEM_STORYBOOK_URL,
  designSystemStoryGroups,
  flattenDesignSystemStories,
  getDesignSystemStoryStats,
  resolveDesignSystemStorybookOpenURL,
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

  assert.equal(stories.length, stats.storyCount);
  assert.equal(designSystemStoryGroups.length, stats.groupCount);
  assert.ok(stats.storyCount >= 10);
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

test('component stories expose an overview state matrix', async () => {
  const componentGroups = designSystemStoryGroups.filter((group) => admittedComponentGroupIds.includes(group.id));
  assert.equal(componentGroups.length, admittedComponentGroupIds.length);

  for (const group of componentGroups) {
    for (const story of group.stories) {
      const storyFile = story.path.replace('frontend/src/', '../../');
      const source = await readFile(new URL(storyFile, import.meta.url), 'utf8');

      assert.match(source, /export const Overview\s*:/, `${story.path} must export Overview`);
    }
  }
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

test('admitted feature component manifest entries are synced with the story catalog', async () => {
  const featureComponentGroup = getCatalogGroup('feature-components');
  assert.ok(featureComponentGroup);

  const catalogStoriesByPath = new Map(featureComponentGroup.stories.map((story) => [story.path, story]));
  const admittedStories = new Set();

  for (const entry of getAdmittedDesignSystemComponentManifest()) {
    assert.equal(entry.catalogGroupId, 'feature-components', `${entry.id} must target feature-components`);
    assert.ok(entry.storyPath, `${entry.id} must provide a story path`);
    assert.ok(entry.storybookTitle, `${entry.id} must provide a Storybook title`);
    assert.ok(entry.requiredStates?.length > 0, `${entry.id} must document admitted states`);
    assert.ok(entry.mockDataSources?.length > 0, `${entry.id} must document mock data`);

    const catalogStory = catalogStoriesByPath.get(entry.storyPath);
    assert.ok(catalogStory, `${entry.storyPath} must be listed in feature-components catalog`);
    assert.equal(catalogStory.storybookTitle, entry.storybookTitle);
    admittedStories.add(entry.storyPath);

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
  const openAICompatibleDetailSource = await readFile(
    new URL('../../features/accounts/components/OpenAICompatibleDetailPanel.tsx', import.meta.url),
    'utf8',
  );
  const openAICompatibleModalSource = await readFile(
    new URL('../../features/accounts/components/OpenAICompatibleDetailModal.tsx', import.meta.url),
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
  assert.match(primitivesSource, /AccountDetailOverviewGrid/);
  assert.match(primitivesSource, /data-account-detail-overview-grid="runtime-evidence"/);
  assert.match(primitivesSource, /data-account-detail-overview-equal-height="true"/);
  assert.match(primitivesSource, /data-account-detail-overview-slot="runtime"[^>]+h-full/);
  assert.match(primitivesSource, /data-account-detail-overview-slot="evidence"[^>]+h-full/);
  assert.match(primitivesSource, /data-account-detail-module-layout=\{layout\}/);
  assert.match(sectionsSource, /data-account-runtime-resource-grid="quota-balance"/);
  assert.match(modalStorySource, /AccountRuntimeSnapshotSection/);
  assert.match(modalStorySource, /AccountDetailOverviewGrid/);
  assert.match(modalStorySource, /layout="cards"/);
  assert.match(unifiedDetailSource, /layout="cards"/);
  assert.match(unifiedDetailSource, /AccountDetailOverviewGrid/);
  assert.match(openAICompatibleDetailSource, /layout="cards"/);
  assert.match(openAICompatibleModalSource, /AccountDetailOverviewGrid/);
  assert.match(codexDetailSource, /layout="cards"/);
  assert.match(codexDetailSource, /AccountDetailOverviewGrid/);
  assert.match(codexDetailSource, /CodexAccountEvidenceSection/);
  assert.match(codexDetailSource, /componentName="CodexAccountEvidenceSection"/);
  assert.doesNotMatch(sectionsSource, /componentName="AccountQuotaSection"[\s\S]{0,220}span="wide"/);
  assert.doesNotMatch(sectionsSource, /componentName="AccountBillingSection"[\s\S]{0,220}span="wide"/);
  assert.ok(sectionsEntry.requiredStates?.includes('runtime-snapshot'));
  assert.ok(sectionsEntry.requiredStates?.includes('module-layout'));
  assert.ok(sectionsEntry.requiredStates?.includes('card-mode'));
  assert.ok(sectionsEntry.requiredStates?.includes('runtime-evidence-overview'));
  assert.ok(sectionsEntry.requiredStates?.includes('quota-balance-grid'));
  assert.ok(sectionsEntry.requiredStates?.includes('quota-billing-side-by-side'));
  assert.ok(sectionsEntry.requiredStates?.includes('standard-module-header'));
}
);
