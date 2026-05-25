import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCodexFeatureChangeInput,
  buildCodexFeatureDraft,
  groupCodexFeatureRows,
  normalizeCodexFeatureConfigSnapshot,
  normalizeCodexFeaturePreview,
  selectCodexFeatureRows,
  setCodexFeatureDraftValue,
} from '../model/codexFeatureConfig.ts';
import {
  getCodexFeatureConfig,
  previewCodexFeatureConfig,
  saveCodexFeatureConfig,
} from '../api/codexFeatures.ts';
import { selectCodexValueEditorKind } from '../model/codexValueEditorModel.ts';

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
      unsupported: true,
    },
  ],
});

function makeRow(overrides) {
  const section = overrides.section;
  const key = overrides.key;
  const path =
    overrides.path ||
    (section === 'root'
      ? [key]
      : section === 'model_providers'
        ? ['model_providers', 'gettokens', key]
        : [section, key]);

  return {
    id: `${section}.${key}`,
    section,
    key,
    path,
    description: '',
    stage: 'stable',
    valueType: 'boolean',
    options: [],
    defaultValue: false,
    localValue: false,
    localRawValue: 'false',
    effectiveValue: false,
    hasLocalValue: false,
    legacyAliases: [],
    canonicalKey: key,
    unsupported: false,
    readOnly: false,
    hiddenByDefault: false,
    draftValue: false,
    dirty: false,
    changeKind: 'none',
    ...overrides,
  };
}

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

test('selectCodexFeatureRows applies query filters across codex config sections', () => {
  const mixedSnapshot = normalizeCodexFeatureConfigSnapshot({
    features: [
      {
        key: 'model',
        section: 'root',
        valueType: 'string',
        defaultValue: 'gpt-5',
        description: 'default model setting',
      },
      {
        key: 'base_url',
        section: 'model_providers',
        path: ['model_providers', 'gettokens', 'base_url'],
        valueType: 'string',
        defaultValue: 'https://relay.example.test/v1',
        description: 'relay endpoint',
      },
      {
        key: 'tool_search',
        section: 'features',
        defaultValue: true,
        description: 'tool discovery',
      },
      {
        key: 'model_migrations',
        section: 'notice',
        valueType: 'table',
        defaultValue: {},
        description: 'migration notices',
      },
    ],
  });
  const draft = buildCodexFeatureDraft(mixedSnapshot);

  assert.deepEqual(
    selectCodexFeatureRows(mixedSnapshot, draft, { sectionFilter: 'root', query: 'default model' }).map((row) => row.key),
    ['model']
  );
  assert.deepEqual(
    selectCodexFeatureRows(mixedSnapshot, draft, { sectionFilter: 'model_providers', query: 'relay' }).map((row) => row.key),
    ['base_url']
  );
  assert.deepEqual(
    selectCodexFeatureRows(mixedSnapshot, draft, { sectionFilter: 'notice', query: 'migration' }).map((row) => row.key),
    ['model_migrations']
  );
  assert.deepEqual(
    selectCodexFeatureRows(mixedSnapshot, draft, { sectionFilter: 'features', query: 'relay' }).map((row) => row.key),
    []
  );
});

test('codex feature api returns browser preview data when Wails bindings are missing', async () => {
  const previousWindow = globalThis.window;
  globalThis.window = {
    location: { protocol: 'http:' },
    go: { main: { App: {} } },
  };

  try {
    const previewSnapshot = await getCodexFeatureConfig();
    const draft = buildCodexFeatureDraft(previewSnapshot);

    assert.equal(previewSnapshot.configPath, '/Users/preview/.codex/config.toml');
    assert.ok(selectCodexFeatureRows(previewSnapshot, draft, { sectionFilter: 'root' }).length > 0);
    assert.ok(selectCodexFeatureRows(previewSnapshot, draft, { sectionFilter: 'model_providers' }).length > 0);
    assert.ok(selectCodexFeatureRows(previewSnapshot, draft, { sectionFilter: 'features' }).length > 0);
    assert.ok(selectCodexFeatureRows(previewSnapshot, draft, { sectionFilter: 'notice' }).length > 0);
    assert.deepEqual(
      selectCodexFeatureRows(previewSnapshot, draft, { query: 'relay' }).map((row) => row.section),
      ['model_providers'],
    );

    const input = {
      values: {},
      changes: [
        {
          id: 'root.model',
          section: 'root',
          key: 'model',
          path: ['model'],
          valueType: 'string',
          value: 'gpt-5.5-preview',
        },
      ],
    };
    const preview = await previewCodexFeatureConfig(input, previewSnapshot.configPath);
    assert.equal(preview.changes[0].before, 'gpt-5.4');
    assert.equal(preview.changes[0].after, 'gpt-5.5-preview');

    await saveCodexFeatureConfig(input);
    const savedSnapshot = await getCodexFeatureConfig();
    const savedDraft = buildCodexFeatureDraft(savedSnapshot);
    assert.equal(
      selectCodexFeatureRows(savedSnapshot, savedDraft, { sectionFilter: 'root', query: 'model' })[0].effectiveValue,
      'gpt-5.5-preview',
    );
  } finally {
    if (typeof previousWindow === 'undefined') {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
});

test('groupCodexFeatureRows groups sections into stable UI buckets', () => {
  const rows = [
    makeRow({ section: 'root', key: 'profile' }),
    makeRow({ section: 'root', key: 'model' }),
    makeRow({ section: 'root', key: 'approval_policy', valueType: 'enum', options: ['on-request'] }),
    makeRow({ section: 'notice', key: 'hide_full_access_warning' }),
    makeRow({ section: 'notice', key: 'model_migrations', valueType: 'toml' }),
    makeRow({ section: 'features', key: 'tool_search', stage: 'stable' }),
    makeRow({ section: 'features', key: 'goals', stage: 'experimental' }),
    makeRow({ section: 'model_providers', key: 'name', path: ['model_providers', 'gettokens', 'name'] }),
    makeRow({ section: 'model_providers', key: 'auth', valueType: 'toml', path: ['model_providers', 'gettokens', 'auth'] }),
  ];

  assert.deepEqual(
    groupCodexFeatureRows(rows).map((group) => [group.section, group.id, group.rows.map((row) => row.key)]),
    [
      ['root', 'launch', ['profile']],
      ['root', 'model', ['model']],
      ['root', 'policy', ['approval_policy']],
      ['features', 'core', ['tool_search']],
      ['features', 'experimental', ['goals']],
      ['notice', 'safety', ['hide_full_access_warning']],
      ['notice', 'raw', ['model_migrations']],
      ['model_providers', 'gettokens', ['name', 'auth']],
    ]
  );
});

test('selectCodexValueEditorKind uses toggles for booleans and segments for fixed enums', () => {
  assert.equal(
    selectCodexValueEditorKind(makeRow({ section: 'root', key: 'web_search', valueType: 'boolean', draftValue: true })),
    'toggle'
  );
  assert.equal(
    selectCodexValueEditorKind(
      makeRow({
        section: 'root',
        key: 'approval_policy',
        valueType: 'enum',
        options: ['untrusted', 'on-failure', 'on-request', 'never'],
        draftValue: 'on-request',
      })
    ),
    'segment'
  );
  assert.equal(
    selectCodexValueEditorKind(
      makeRow({
        section: 'root',
        key: 'approval_policy',
        valueType: 'enum',
        options: ['untrusted', 'on-failure', 'on-request', 'never'],
        draftValue: 'legacy-custom-value',
      })
    ),
    'segment'
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
    changes: [
      {
        id: 'tool_search',
        section: 'features',
        key: 'tool_search',
        path: ['tool_search'],
        valueType: 'boolean',
        value: false,
      },
    ],
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

test('raw TOML definitions are editable and scoped as typed changes', () => {
  const backendSnapshot = normalizeCodexFeatureConfigSnapshot({
    definitions: [
      {
        section: 'features',
        key: 'multi_agent_v2',
        valueType: 'toml',
        stage: 'advanced',
        path: ['features', 'multi_agent_v2'],
      },
      {
        section: 'root',
        key: 'skills',
        valueType: 'toml',
        stage: 'advanced',
        path: ['skills'],
      },
    ],
    typedValues: {
      'features.multi_agent_v2': '[features.multi_agent_v2]\nenabled = false\n',
    },
    rawValues: {
      'features.multi_agent_v2': '[features.multi_agent_v2]\nenabled = false\n',
    },
  });
  const draft = setCodexFeatureDraftValue(
    buildCodexFeatureDraft(backendSnapshot),
    'features.multi_agent_v2',
    '[features.multi_agent_v2]\nenabled = true\n'
  );

  const rows = selectCodexFeatureRows(backendSnapshot, draft, { sectionFilter: 'features' });

  assert.equal(rows[0].readOnly, false);
  assert.equal(rows[0].dirty, true);
  assert.deepEqual(buildCodexFeatureChangeInput(backendSnapshot, draft, { sectionFilter: 'features' }), {
    values: {},
    changes: [
      {
        id: 'features.multi_agent_v2',
        section: 'features',
        key: 'multi_agent_v2',
        path: ['features', 'multi_agent_v2'],
        valueType: 'toml',
        value: '[features.multi_agent_v2]\nenabled = true\n',
      },
    ],
  });
});

test('normalizes backend definitions values and unknownValues shape', () => {
  const backendSnapshot = normalizeCodexFeatureConfigSnapshot({
    definitions: [
      { key: 'tool_search', stage: 'stable', defaultEnabled: true, description: 'Enable app tool discovery.' },
      { key: 'goals', stage: 'experimental', defaultEnabled: false, description: 'Set a persistent goal.' },
      { key: 'runtime_metrics', stage: 'under_development', defaultEnabled: false },
      { key: 'collab', stage: 'legacy', defaultEnabled: true, legacyAlias: true, canonicalKey: 'multi_agent' },
    ],
    typedValues: {
      goals: true,
      collab: true,
    },
    rawValues: {
      goals: 'true',
      collab: 'true',
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

test('normalizes typed root definitions without coercing missing defaults to false', () => {
  const backendSnapshot = normalizeCodexFeatureConfigSnapshot({
    definitions: [
      {
        section: 'root',
        key: 'approval_policy',
        stage: 'stable',
        valueType: 'enum',
        options: ['untrusted', 'on-failure', 'on-request', 'never'],
      },
      {
        section: 'root',
        key: 'model',
        stage: 'stable',
        valueType: 'string',
      },
      {
        section: 'root',
        key: 'model_context_window',
        stage: 'stable',
        valueType: 'integer',
      },
      {
        section: 'root',
        key: 'notify',
        stage: 'stable',
        valueType: 'string_array',
      },
    ],
  });

  const draft = buildCodexFeatureDraft(backendSnapshot);
  const rows = selectCodexFeatureRows(backendSnapshot, draft, { sectionFilter: 'root' });
  const rowByKey = Object.fromEntries(rows.map((row) => [row.key, row]));

  assert.equal(rowByKey.approval_policy.draftValue, undefined);
  assert.equal(rowByKey.model.draftValue, undefined);
  assert.equal(rowByKey.model_context_window.draftValue, undefined);
  assert.equal(rowByKey.notify.draftValue, undefined);
  assert.equal(rowByKey.model.dirty, false);
  assert.equal(rowByKey.notify.dirty, false);

  const updatedDraft = setCodexFeatureDraftValue(draft, 'model_context_window', 200000);
  assert.deepEqual(buildCodexFeatureChangeInput(backendSnapshot, updatedDraft, { sectionFilter: 'root' }), {
    values: {},
    changes: [
      {
        id: 'root.model_context_window',
        section: 'root',
        key: 'model_context_window',
        path: ['model_context_window'],
        valueType: 'integer',
        value: 200000,
      },
    ],
  });
});

test('normalizes notice definitions and builds section-scoped changes', () => {
  const backendSnapshot = normalizeCodexFeatureConfigSnapshot({
    definitions: [
      { section: 'features', key: 'goals', stage: 'experimental', defaultEnabled: false },
      {
        section: 'notice',
        key: 'hide_rate_limit_model_nudge',
        stage: 'stable',
        defaultEnabled: false,
        description: 'Hide rate limit model switch reminder.',
      },
      {
        section: 'notice',
        key: 'fast_default_opt_out',
        stage: 'stable',
        defaultEnabled: false,
        description: 'Opt out of Codex-managed fast defaults.',
      },
    ],
    values: {
      fast_default_opt_out: false,
      hide_rate_limit_model_nudge: false,
    },
    unknownValues: {
      future_notice: true,
    },
    unknownSections: {
      future_notice: 'notice',
    },
  });
  const draft = setCodexFeatureDraftValue(
    buildCodexFeatureDraft(backendSnapshot),
    'notice.hide_rate_limit_model_nudge',
    true
  );

  assert.deepEqual(
    selectCodexFeatureRows(backendSnapshot, draft, { sectionFilter: 'notice' }).map((row) => [
      row.key,
      row.section,
      row.dirty,
    ]),
    [
      ['fast_default_opt_out', 'notice', false],
      ['hide_rate_limit_model_nudge', 'notice', true],
      ['future_notice', 'notice', false],
    ]
  );
  assert.deepEqual(buildCodexFeatureChangeInput(backendSnapshot, draft, { sectionFilter: 'notice' }), {
    values: {
      hide_rate_limit_model_nudge: true,
    },
    changes: [
      {
        id: 'notice.hide_rate_limit_model_nudge',
        section: 'notice',
        key: 'hide_rate_limit_model_nudge',
        path: ['notice', 'hide_rate_limit_model_nudge'],
        valueType: 'boolean',
        value: true,
      },
    ],
  });
  assert.deepEqual(buildCodexFeatureChangeInput(backendSnapshot, draft, { sectionFilter: 'features' }), {
    values: {},
    changes: [],
  });
});

test('normalizes root bool definitions and builds section-scoped changes', () => {
  const backendSnapshot = normalizeCodexFeatureConfigSnapshot({
    definitions: [
      { section: 'features', key: 'goals', stage: 'experimental', defaultEnabled: false },
      {
        section: 'root',
        key: 'hide_agent_reasoning',
        stage: 'stable',
        defaultEnabled: false,
        description: 'Hide AgentReasoning events.',
      },
      {
        section: 'root',
        key: 'include_permissions_instructions',
        stage: 'advanced',
        defaultEnabled: true,
        description: 'Inject permissions instructions.',
      },
    ],
    values: {
      hide_agent_reasoning: false,
      include_permissions_instructions: true,
    },
    unknownValues: {
      future_root_flag: true,
    },
    unknownSections: {
      future_root_flag: 'root',
    },
  });
  const draft = setCodexFeatureDraftValue(
    buildCodexFeatureDraft(backendSnapshot),
    'root.hide_agent_reasoning',
    true
  );

  assert.deepEqual(
    selectCodexFeatureRows(backendSnapshot, draft, { sectionFilter: 'root' }).map((row) => [
      row.key,
      row.section,
      row.dirty,
    ]),
    [
      ['hide_agent_reasoning', 'root', true],
      ['include_permissions_instructions', 'root', false],
      ['future_root_flag', 'root', false],
    ]
  );
  assert.deepEqual(buildCodexFeatureChangeInput(backendSnapshot, draft, { sectionFilter: 'root' }), {
    values: {
      hide_agent_reasoning: true,
    },
    changes: [
      {
        id: 'root.hide_agent_reasoning',
        section: 'root',
        key: 'hide_agent_reasoning',
        path: ['hide_agent_reasoning'],
        valueType: 'boolean',
        value: true,
      },
    ],
  });
  assert.deepEqual(buildCodexFeatureChangeInput(backendSnapshot, draft, { sectionFilter: 'notice' }), {
    values: {},
    changes: [],
  });
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
      id: 'goals',
      section: '',
      key: 'goals',
      path: ['goals'],
      valueType: 'boolean',
      before: false,
      after: true,
      kind: 'updated',
    },
  ]);
});
