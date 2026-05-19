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
  designSystemStoryGroups,
  flattenDesignSystemStories,
  getDesignSystemStoryStats,
} from './storyCatalog.ts';
import { resolveStorybookLocale, storybookLocaleOptions } from './storybookGlobals.ts';

const admittedComponentGroupIds = ['components', 'feature-components'];
const featureComponentsRoot = new URL('../', import.meta.url);

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

test('storybook locale globals default to Chinese and accept English', () => {
  assert.deepEqual(storybookLocaleOptions.map((option) => option.value), ['zh', 'en']);
  assert.equal(resolveStorybookLocale('zh'), 'zh');
  assert.equal(resolveStorybookLocale('en'), 'en');
  assert.equal(resolveStorybookLocale('fr'), 'zh');
  assert.equal(resolveStorybookLocale(undefined), 'zh');
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
