import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  designSystemStoryGroups,
  flattenDesignSystemStories,
  getDesignSystemStoryStats,
} from './storyCatalog.ts';
import { resolveStorybookLocale, storybookLocaleOptions } from './storybookGlobals.ts';

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
  assert.ok(stats.storyCount >= 9);
});

test('storybook locale globals default to Chinese and accept English', () => {
  assert.deepEqual(storybookLocaleOptions.map((option) => option.value), ['zh', 'en']);
  assert.equal(resolveStorybookLocale('zh'), 'zh');
  assert.equal(resolveStorybookLocale('en'), 'en');
  assert.equal(resolveStorybookLocale('fr'), 'zh');
  assert.equal(resolveStorybookLocale(undefined), 'zh');
});

test('component stories expose an overview state matrix', async () => {
  const componentGroup = designSystemStoryGroups.find((group) => group.id === 'components');
  assert.ok(componentGroup);

  for (const story of componentGroup.stories) {
    const storyFile = story.path.replace('frontend/src/', '../../');
    const source = await readFile(new URL(storyFile, import.meta.url), 'utf8');

    assert.match(source, /export const Overview\s*:/, `${story.path} must export Overview`);
  }
});

test('component stories mark admitted design system components', async () => {
  const componentGroup = designSystemStoryGroups.find((group) => group.id === 'components');
  assert.ok(componentGroup);

  for (const story of componentGroup.stories) {
    const storyFile = story.path.replace('frontend/src/', '../../');
    const source = await readFile(new URL(storyFile, import.meta.url), 'utf8');

    assert.match(source, /DesignSystemStoryFrame/, `${story.path} must wrap examples with DesignSystemStoryFrame`);
  }
});
