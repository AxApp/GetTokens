import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCodexFeatureChangeInput,
  buildCodexFeatureDraft,
  normalizeCodexFeatureConfigSnapshot,
  normalizeCodexFeaturePreview,
  selectCodexFeatureRows,
  setCodexFeatureDraftValue,
} from '../model/codexFeatureConfig.ts';

const snapshot = normalizeCodexFeatureConfigSnapshot({
  codexHomePath: '/Users/test/.codex',
  configPath: '/Users/test/.codex/config.toml',
  features: [
    {
      key: 'tool_search',
      stage: 'stable',
      defaultValue: true,
      description: 'tool discovery',
    },
    {
      key: 'goals',
      stage: 'experimental',
      defaultValue: false,
      localValue: true,
      description: 'persistent goals',
    },
    {
      key: 'old_flag',
      stage: 'deprecated',
      defaultValue: false,
    },
    {
      key: 'removed_local',
      stage: 'removed',
      defaultValue: false,
      localValue: true,
    },
    {
      key: 'multi_agent',
      stage: 'recommended',
      defaultValue: true,
      localValue: true,
      legacyAliases: ['collab'],
      description: 'canonical feature',
    },
    {
      key: 'custom_flag',
      stage: 'unknown',
      localValue: false,
    },
    {
      key: 'compound_table',
      type: 'table',
      localRawValue: '{ enabled = true }',
    },
  ],
});

test('selectCodexFeatureRows groups and filters by stage and query', () => {
  const draft = buildCodexFeatureDraft(snapshot);

  assert.deepEqual(
    selectCodexFeatureRows(snapshot, draft, { stageFilter: 'experimental' }).map((row) => row.key),
    ['goals']
  );
  assert.deepEqual(
    selectCodexFeatureRows(snapshot, draft, { query: 'tool' }).map((row) => row.key),
    ['tool_search']
  );
  assert.deepEqual(
    selectCodexFeatureRows(snapshot, draft, { stageFilter: 'compat' }).map((row) => row.key),
    ['removed_local']
  );
});

test('deprecated and removed features are hidden by default unless local config exists', () => {
  const draft = buildCodexFeatureDraft(snapshot);
  const defaultRows = selectCodexFeatureRows(snapshot, draft).map((row) => row.key);

  assert.equal(defaultRows.includes('old_flag'), false);
  assert.equal(defaultRows.includes('removed_local'), true);
  assert.deepEqual(
    selectCodexFeatureRows(snapshot, draft, { stageFilter: 'deprecated' }).map((row) => row.key),
    ['old_flag']
  );
});

test('dirty state and change input follow edited bool values', () => {
  const initialDraft = buildCodexFeatureDraft(snapshot);
  const draft = setCodexFeatureDraftValue(initialDraft, 'tool_search', false);
  const row = selectCodexFeatureRows(snapshot, draft, { query: 'tool_search' })[0];

  assert.equal(row.dirty, true);
  assert.equal(row.changeKind, 'added');
  assert.deepEqual(buildCodexFeatureChangeInput(snapshot, draft), {
    values: {
      tool_search: false,
    },
  });
});

test('legacy aliases are searchable and surfaced on rows', () => {
  const draft = buildCodexFeatureDraft(snapshot);
  const rows = selectCodexFeatureRows(snapshot, draft, { query: 'collab' });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].key, 'multi_agent');
  assert.deepEqual(rows[0].legacyAliases, ['collab']);
});

test('unsupported non-bool feature is visible as read-only local hint', () => {
  const draft = buildCodexFeatureDraft(snapshot);
  const row = selectCodexFeatureRows(snapshot, draft, { stageFilter: 'unsupported' })[0];

  assert.equal(row.key, 'compound_table');
  assert.equal(row.readOnly, true);
  assert.equal(row.unsupported, true);
});

test('normalizes backend definitions values and unknownValues shape', () => {
  const backendSnapshot = normalizeCodexFeatureConfigSnapshot({
    definitions: [
      { key: 'tool_search', stage: 'stable', defaultEnabled: true, description: 'Enable app tool discovery.' },
      { key: 'goals', stage: 'experimental', defaultEnabled: false, description: 'Set a persistent goal.' },
      { key: 'runtime_metrics', stage: 'under_development', defaultEnabled: false },
      { key: 'collab', stage: 'legacy', defaultEnabled: true, legacyAlias: true, canonicalKey: 'multi_agent' },
    ],
    values: {
      goals: true,
      collab: true,
    },
    unknownValues: {
      future_feature: false,
    },
  });
  const draft = buildCodexFeatureDraft(backendSnapshot);

  assert.deepEqual(
    selectCodexFeatureRows(backendSnapshot, draft, { stageFilter: 'experimental' }).map((row) => [
      row.key,
      row.description,
      row.defaultValue,
      row.localValue,
      row.effectiveValue,
    ]),
    [['goals', 'Set a persistent goal.', false, true, true]]
  );
  assert.deepEqual(
    selectCodexFeatureRows(backendSnapshot, draft, { stageFilter: 'advanced' }).map((row) => row.key),
    ['runtime_metrics']
  );
  assert.deepEqual(
    selectCodexFeatureRows(backendSnapshot, draft, { query: 'collab' }).map((row) => [
      row.key,
      row.readOnly,
      row.canonicalKey,
    ]),
    [['collab', true, 'multi_agent']]
  );
  assert.deepEqual(
    selectCodexFeatureRows(backendSnapshot, draft, { stageFilter: 'unknown' }).map((row) => [
      row.key,
      row.localValue,
    ]),
    [['future_feature', false]]
  );
});

test('normalizes backend preview previousEnabled and nextEnabled fields', () => {
  const preview = normalizeCodexFeaturePreview(
    {
      changes: [
        {
          key: 'goals',
          type: 'updated',
          previousEnabled: false,
          nextEnabled: true,
        },
      ],
    },
    { values: { goals: true } },
    '/tmp/config.toml'
  );

  assert.deepEqual(preview.changes, [
    {
      key: 'goals',
      before: false,
      after: true,
      kind: 'updated',
    },
  ]);
});
