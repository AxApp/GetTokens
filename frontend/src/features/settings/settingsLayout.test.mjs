import test from 'node:test';
import assert from 'node:assert/strict';

import { getSettingsSectionBadge, settingsSectionOrder } from './settingsLayout.ts';

test('settings section order puts daily preferences before maintenance actions', () => {
  assert.deepEqual(settingsSectionOrder, [
    'appearance',
    'app_lifecycle',
    'local_usage_refresh',
    'network_proxy',
    'updates',
  ]);
});

test('getSettingsSectionBadge reflects settings section order', () => {
  assert.equal(getSettingsSectionBadge('appearance'), '01');
  assert.equal(getSettingsSectionBadge('app_lifecycle'), '02');
  assert.equal(getSettingsSectionBadge('local_usage_refresh'), '03');
  assert.equal(getSettingsSectionBadge('network_proxy'), '04');
  assert.equal(getSettingsSectionBadge('updates'), '05');
});
