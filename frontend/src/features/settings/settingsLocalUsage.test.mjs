import test from 'node:test';
import assert from 'node:assert/strict';

import {
  localProjectedUsageRefreshIntervalOptions,
  parseLocalProjectedUsageRefreshIntervalMinutes,
  resolveLocalProjectedUsageRefreshIntervalID,
} from './settingsLocalUsage.ts';

test('resolveLocalProjectedUsageRefreshIntervalID falls back to 15 minutes', () => {
  assert.equal(resolveLocalProjectedUsageRefreshIntervalID(5), '5');
  assert.equal(resolveLocalProjectedUsageRefreshIntervalID(30), '30');
  assert.equal(resolveLocalProjectedUsageRefreshIntervalID(7), '15');
});

test('parseLocalProjectedUsageRefreshIntervalMinutes converts segmented value to minutes', () => {
  assert.equal(parseLocalProjectedUsageRefreshIntervalMinutes('5'), 5);
  assert.equal(parseLocalProjectedUsageRefreshIntervalMinutes('60'), 60);
});

test('localProjectedUsageRefreshIntervalOptions keep expected order', () => {
  assert.deepEqual(
    localProjectedUsageRefreshIntervalOptions.map((option) => option.id),
    ['5', '15', '30', '60'],
  );
});
