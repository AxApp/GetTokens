import test from 'node:test';
import assert from 'node:assert/strict';

import { getSettingsSectionBadge, settingsSectionOrder } from './settingsLayout.ts';

test('settings section order puts daily preferences before maintenance actions', () => {
  assert.deepEqual(settingsSectionOrder, [
    'appearance',
    'local_usage_refresh',
    'updates',
  ]);
});

test('getSettingsSectionBadge reflects settings section order', () => {
  assert.equal(getSettingsSectionBadge('appearance'), '01');
  assert.equal(getSettingsSectionBadge('local_usage_refresh'), '02');
  assert.equal(getSettingsSectionBadge('updates'), '03');
});
