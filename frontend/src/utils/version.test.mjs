import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDateHourLabel, formatSidebarVersion } from './version.ts';

test('buildDateHourLabel formats local date as YYYY.MM.DD.HH', () => {
  const date = new Date(2026, 3, 26, 8, 15, 0);

  assert.equal(buildDateHourLabel(date), '2026.04.26.08');
});

test('formatSidebarVersion normalizes date-like version strings', () => {
  assert.equal(formatSidebarVersion('2026-04-26 08:30:00'), '2026.04.26.08');
  assert.equal(formatSidebarVersion('2026042608'), '2026.04.26.08');
  assert.equal(formatSidebarVersion('2026.04.26.08'), '2026.04.26.08');
});

test('formatSidebarVersion falls back to current date-hour for dev builds', () => {
  const now = new Date(2026, 3, 26, 9, 0, 0);

  assert.equal(formatSidebarVersion('dev', now), '2026.04.26.09');
});

test('formatSidebarVersion keeps opaque versions unchanged', () => {
  assert.equal(formatSidebarVersion('v0.1.0'), 'v0.1.0');
});
