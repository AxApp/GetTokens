import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCodexFeatureChangeInput,
  buildCodexFeatureDraft,
  groupCodexFeatureRows,
  normalizeCodexFeatureConfigSnapshot,
  normalizeCodexFeaturePreview,
  removeCodexFeatureDraftValue,
  resolveCodexFeatureRowPathDisplay,
  selectCodexFeatureRows,
  setCodexFeatureDraftValue,
} from '../model/codexFeatureConfig.ts';
import {
  getCodexFeatureConfig,
  previewCodexFeatureConfig,
  saveCodexFeatureConfig,
} from '../api/codexFeatures.ts';
import { coerceCodexBooleanEditorValue, selectCodexValueEditorKind } from '../model/codexValueEditorModel.ts';

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
    removed: false,
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

test('resolveCodexFeatureRowPathDisplay separates top-level options from nested children', () => {
  assert.deepEqual(
    resolveCodexFeatureRowPathDisplay(
      makeRow({
        section: 'root',
        key: 'marketplaces.openai-bundled.source',
        path: ['marketplaces', 'openai-bundled', 'source'],
      })
    ),
    {
      primaryLabel: 'marketplaces',
      childLabels: ['openai-bundled', 'source'],
      fullLabel: 'marketplaces.openai-bundled.source',
    }
  );

  assert.deepEqual(
    resolveCodexFeatureRowPathDisplay(
      makeRow({
        section: 'model_providers',
        key: 'env_key_instructions',
        path: ['model_providers', 'gettokens', 'env_key_instructions'],
      })
    ),
    {
      primaryLabel: 'gettokens',
      childLabels: ['env_key_instructions'],
      fullLabel: 'model_providers.gettokens.env_key_instructions',
    }
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
        key: 'hide_full_access_warning',
        valueType: 'string',
        draftValue: 'false',
      })
    ),
    'toggle'
  );
  assert.equal(
    selectCodexValueEditorKind(
      makeRow({
        section: 'root',
        key: 'show_raw_events',
        valueType: 'enum',
        options: ['true', 'false'],
        draftValue: 'true',
      })
    ),
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
  assert.equal(
    selectCodexValueEditorKind(
      makeRow({
        section: 'root',
        key: 'model_auto_compact_token_limit',
        valueType: 'integer',
        draftValue: false,
      })
    ),
    'number'
  );
  assert.equal(
    selectCodexValueEditorKind(
      makeRow({
        section: 'root',
        key: 'tool_output_token_limit',
        valueType: 'integer',
        draftValue: 'false',
      })
    ),
    'number'
  );
});

test('coerces string booleans for toggle checked state', () => {
  assert.equal(coerceCodexBooleanEditorValue(true), true);
  assert.equal(coerceCodexBooleanEditorValue(false), false);
  assert.equal(coerceCodexBooleanEditorValue('true'), true);
  assert.equal(coerceCodexBooleanEditorValue('false'), false);
  assert.equal(coerceCodexBooleanEditorValue('FALSE'), false);
  assert.equal(coerceCodexBooleanEditorValue('never'), false);
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

test('numeric root setting uses explicit remove draft instead of treating zero as removal', () => {
  const backendSnapshot = normalizeCodexFeatureConfigSnapshot({
    definitions: [
      {
        section: 'root',
        key: 'model_auto_compact_token_limit',
        valueType: 'integer',
        stage: 'advanced',
        path: ['model_auto_compact_token_limit'],
      },
    ],
    typedValues: {
      'root.model_auto_compact_token_limit': 180000,
    },
    rawValues: {
      'root.model_auto_compact_token_limit': '180000',
    },
  });

  const zeroDraft = setCodexFeatureDraftValue(
    buildCodexFeatureDraft(backendSnapshot),
    'root.model_auto_compact_token_limit',
    0
  );
  assert.deepEqual(buildCodexFeatureChangeInput(backendSnapshot, zeroDraft, { sectionFilter: 'root' }), {
    values: {},
    changes: [
      {
        id: 'root.model_auto_compact_token_limit',
        section: 'root',
        key: 'model_auto_compact_token_limit',
        path: ['model_auto_compact_token_limit'],
        valueType: 'integer',
        value: 0,
      },
    ],
  });

  const removeDraft = removeCodexFeatureDraftValue(zeroDraft, 'root.model_auto_compact_token_limit');
  const row = selectCodexFeatureRows(backendSnapshot, removeDraft, { sectionFilter: 'root' })[0];

  assert.equal(row.removed, true);
  assert.equal(row.dirty, true);
  assert.equal(row.draftValue, undefined);
  assert.deepEqual(buildCodexFeatureChangeInput(backendSnapshot, removeDraft, { sectionFilter: 'root' }), {
    values: {},
    changes: [
      {
        id: 'root.model_auto_compact_token_limit',
        section: 'root',
        key: 'model_auto_compact_token_limit',
        path: ['model_auto_compact_token_limit'],
        valueType: 'integer',
        value: undefined,
        remove: true,
      },
    ],
  });
});

test('non-numeric typed root settings use explicit remove drafts', () => {
  const backendSnapshot = normalizeCodexFeatureConfigSnapshot({
    definitions: [
      {
        section: 'root',
        key: 'model',
        valueType: 'string',
        stage: 'stable',
        path: ['model'],
      },
      {
        section: 'root',
        key: 'model_reasoning_effort',
        valueType: 'enum',
        options: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'],
        stage: 'stable',
        path: ['model_reasoning_effort'],
      },
      {
        section: 'root',
        key: 'notify',
        valueType: 'string_array',
        stage: 'stable',
        path: ['notify'],
      },
      {
        section: 'root',
        key: 'experimental_thread_store',
        valueType: 'toml',
        stage: 'advanced',
        path: ['experimental_thread_store'],
      },
    ],
    typedValues: {
      'root.model': 'gpt-5.4',
      'root.model_reasoning_effort': 'medium',
      'root.notify': ['terminal-notifier', '-message', 'Codex'],
      'root.experimental_thread_store': '[experimental_thread_store]\nenabled = true\n',
    },
    rawValues: {
      'root.model': '"gpt-5.4"',
      'root.model_reasoning_effort': '"medium"',
      'root.notify': '["terminal-notifier", "-message", "Codex"]',
      'root.experimental_thread_store': '[experimental_thread_store]\nenabled = true\n',
    },
  });

  let draft = buildCodexFeatureDraft(backendSnapshot);
  draft = removeCodexFeatureDraftValue(draft, 'root.model');
  draft = removeCodexFeatureDraftValue(draft, 'root.model_reasoning_effort');
  draft = removeCodexFeatureDraftValue(draft, 'root.notify');
  draft = removeCodexFeatureDraftValue(draft, 'root.experimental_thread_store');

  const rows = selectCodexFeatureRows(backendSnapshot, draft, { sectionFilter: 'root' });
  assert.deepEqual(
    rows.map((row) => [row.id, row.removed, row.dirty, row.draftValue]),
    [
      ['root.model', true, true, undefined],
      ['root.model_reasoning_effort', true, true, undefined],
      ['root.notify', true, true, undefined],
      ['root.experimental_thread_store', true, true, undefined],
    ]
  );
  assert.deepEqual(buildCodexFeatureChangeInput(backendSnapshot, draft, { sectionFilter: 'root' }), {
    values: {},
    changes: [
      {
        id: 'root.model',
        section: 'root',
        key: 'model',
        path: ['model'],
        valueType: 'string',
        value: undefined,
        remove: true,
      },
      {
        id: 'root.model_reasoning_effort',
        section: 'root',
        key: 'model_reasoning_effort',
        path: ['model_reasoning_effort'],
        valueType: 'enum',
        value: undefined,
        remove: true,
      },
      {
        id: 'root.notify',
        section: 'root',
        key: 'notify',
        path: ['notify'],
        valueType: 'string_array',
        value: undefined,
        remove: true,
      },
      {
        id: 'root.experimental_thread_store',
        section: 'root',
        key: 'experimental_thread_store',
        path: ['experimental_thread_store'],
        valueType: 'toml',
        value: undefined,
        remove: true,
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
        key: 'network_proxy',
        valueType: 'toml',
        stage: 'advanced',
        path: ['features', 'network_proxy'],
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
      'features.network_proxy': '[features.network_proxy]\nenabled = false\n',
    },
    rawValues: {
      'features.network_proxy': '[features.network_proxy]\nenabled = false\n',
    },
  });
  const draft = setCodexFeatureDraftValue(
    buildCodexFeatureDraft(backendSnapshot),
    'features.network_proxy',
    '[features.network_proxy]\nenabled = true\n'
  );

  const rows = selectCodexFeatureRows(backendSnapshot, draft, { sectionFilter: 'features' });

  assert.equal(rows[0].readOnly, false);
  assert.equal(rows[0].dirty, true);
  assert.deepEqual(buildCodexFeatureChangeInput(backendSnapshot, draft, { sectionFilter: 'features' }), {
    values: {},
    changes: [
      {
        id: 'features.network_proxy',
        section: 'features',
        key: 'network_proxy',
        path: ['features', 'network_proxy'],
        valueType: 'toml',
        value: '[features.network_proxy]\nenabled = true\n',
      },
    ],
  });
});

test('multi_agent_v2 backend definitions render as nested switch and config rows', () => {
  const backendSnapshot = normalizeCodexFeatureConfigSnapshot({
    definitions: [
      {
        section: 'features',
        key: 'multi_agent_v2.enabled',
        valueType: 'boolean',
        stage: 'advanced',
        path: ['features', 'multi_agent_v2', 'enabled'],
        defaultValue: false,
      },
      {
        section: 'features',
        key: 'multi_agent_v2.max_concurrent_threads_per_session',
        valueType: 'integer',
        stage: 'advanced',
        path: ['features', 'multi_agent_v2', 'max_concurrent_threads_per_session'],
        defaultValue: 4,
      },
      {
        section: 'features',
        key: 'multi_agent_v2.usage_hint_text',
        valueType: 'textarea',
        stage: 'advanced',
        path: ['features', 'multi_agent_v2', 'usage_hint_text'],
      },
    ],
    typedValues: {
      'features.multi_agent_v2.enabled': true,
      'features.multi_agent_v2.max_concurrent_threads_per_session': 5,
    },
    rawValues: {
      'features.multi_agent_v2.enabled': 'true',
      'features.multi_agent_v2.max_concurrent_threads_per_session': '5',
    },
  });
  const draft = setCodexFeatureDraftValue(
    buildCodexFeatureDraft(backendSnapshot),
    'features.multi_agent_v2.default_wait_timeout_ms',
    30000
  );
  const rows = selectCodexFeatureRows(backendSnapshot, draft, { sectionFilter: 'features', query: 'multi_agent_v2' });

  assert.deepEqual(
    rows.map((row) => [row.id, row.key, row.valueType, row.effectiveValue, row.draftValue, row.dirty]),
    [
      ['features.multi_agent_v2.enabled', 'multi_agent_v2.enabled', 'boolean', true, true, false],
      [
        'features.multi_agent_v2.max_concurrent_threads_per_session',
        'multi_agent_v2.max_concurrent_threads_per_session',
        'integer',
        5,
        5,
        false,
      ],
      [
        'features.multi_agent_v2.usage_hint_text',
        'multi_agent_v2.usage_hint_text',
        'textarea',
        undefined,
        undefined,
        false,
      ],
    ]
  );
  assert.deepEqual(resolveCodexFeatureRowPathDisplay(rows[0]), {
    primaryLabel: 'multi_agent_v2',
    childLabels: ['enabled'],
    fullLabel: 'features.multi_agent_v2.enabled',
  });
  assert.deepEqual(buildCodexFeatureChangeInput(backendSnapshot, draft, { sectionFilter: 'features' }), {
    values: {},
    changes: [],
  });
});

test('multi_agent_v2 nested boolean changes do not fall back to simple feature values', () => {
  const backendSnapshot = normalizeCodexFeatureConfigSnapshot({
    definitions: [
      {
        section: 'features',
        key: 'multi_agent_v2.enabled',
        valueType: 'boolean',
        stage: 'advanced',
        path: ['features', 'multi_agent_v2', 'enabled'],
        defaultValue: false,
      },
    ],
  });
  const draft = setCodexFeatureDraftValue(
    buildCodexFeatureDraft(backendSnapshot),
    'features.multi_agent_v2.enabled',
    true
  );

  assert.deepEqual(buildCodexFeatureChangeInput(backendSnapshot, draft, { sectionFilter: 'features' }), {
    values: {},
    changes: [
      {
        id: 'features.multi_agent_v2.enabled',
        section: 'features',
        key: 'multi_agent_v2.enabled',
        path: ['features', 'multi_agent_v2', 'enabled'],
        valueType: 'boolean',
        value: true,
      },
    ],
  });
});

test('expands simple root TOML tables into leaf setting rows', () => {
  const backendSnapshot = normalizeCodexFeatureConfigSnapshot({
    definitions: [
      {
        section: 'root',
        key: 'marketplaces',
        valueType: 'toml',
        stage: 'advanced',
        path: ['marketplaces'],
      },
      {
        section: 'root',
        key: 'plugins',
        valueType: 'toml',
        stage: 'advanced',
        path: ['plugins'],
      },
    ],
    typedValues: {
      marketplaces: {
        'openai-bundled': {
          last_updated: '2026-05-27T07:30:43Z',
          source_type: 'local',
          source: '/Users/linhey/.codex/.tmp/bundled-marketplaces/openai-bundled',
        },
      },
      plugins: {
        'browser@openai-bundled': {
          enabled: true,
        },
        'chrome@openai-bundled': {
          enabled: true,
        },
      },
    },
  });
  const draft = setCodexFeatureDraftValue(
    buildCodexFeatureDraft(backendSnapshot),
    'plugins.browser@openai-bundled.enabled',
    false
  );
  const rows = selectCodexFeatureRows(backendSnapshot, draft, { sectionFilter: 'root' });

  assert.deepEqual(
    rows.map((row) => [row.id, row.key, row.path, row.valueType, row.draftValue, row.dirty]),
    [
      [
        'marketplaces.openai-bundled.last_updated',
        'marketplaces.openai-bundled.last_updated',
        ['marketplaces', 'openai-bundled', 'last_updated'],
        'string',
        '2026-05-27T07:30:43Z',
        false,
      ],
      [
        'marketplaces.openai-bundled.source',
        'marketplaces.openai-bundled.source',
        ['marketplaces', 'openai-bundled', 'source'],
        'string',
        '/Users/linhey/.codex/.tmp/bundled-marketplaces/openai-bundled',
        false,
      ],
      [
        'marketplaces.openai-bundled.source_type',
        'marketplaces.openai-bundled.source_type',
        ['marketplaces', 'openai-bundled', 'source_type'],
        'string',
        'local',
        false,
      ],
      [
        'plugins.browser@openai-bundled.enabled',
        'plugins.browser@openai-bundled.enabled',
        ['plugins', 'browser@openai-bundled', 'enabled'],
        'boolean',
        false,
        true,
      ],
      [
        'plugins.chrome@openai-bundled.enabled',
        'plugins.chrome@openai-bundled.enabled',
        ['plugins', 'chrome@openai-bundled', 'enabled'],
        'boolean',
        true,
        false,
      ],
    ]
  );
  assert.deepEqual(buildCodexFeatureChangeInput(backendSnapshot, draft, { sectionFilter: 'root' }), {
    values: {
      'plugins.browser@openai-bundled.enabled': false,
    },
    changes: [
      {
        id: 'plugins.browser@openai-bundled.enabled',
        section: 'root',
        key: 'plugins.browser@openai-bundled.enabled',
        path: ['plugins', 'browser@openai-bundled', 'enabled'],
        valueType: 'boolean',
        value: false,
      },
    ],
  });
  assert.deepEqual(
    groupCodexFeatureRows(rows).map((group) => [group.section, group.id, group.rows.map((row) => row.key)]),
    [
      [
        'root',
        'integrations',
        [
          'marketplaces.openai-bundled.last_updated',
          'marketplaces.openai-bundled.source',
          'marketplaces.openai-bundled.source_type',
          'plugins.browser@openai-bundled.enabled',
          'plugins.chrome@openai-bundled.enabled',
        ],
      ],
    ]
  );
  assert.deepEqual(
    resolveCodexFeatureRowPathDisplay(rows.find((row) => row.id === 'plugins.browser@openai-bundled.enabled')),
    {
      primaryLabel: 'plugins',
      childLabels: ['browser@openai-bundled', 'enabled'],
      fullLabel: 'plugins.browser@openai-bundled.enabled',
    }
  );
  assert.deepEqual(
    resolveCodexFeatureRowPathDisplay(rows.find((row) => row.id === 'marketplaces.openai-bundled.source_type')),
    {
      primaryLabel: 'marketplaces',
      childLabels: ['openai-bundled', 'source_type'],
      fullLabel: 'marketplaces.openai-bundled.source_type',
    }
  );
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

test('normalizes removed preview changes without requiring next value', () => {
  const preview = normalizeCodexFeaturePreview(
    {
      changes: [
        {
          id: 'root.model_auto_compact_token_limit',
          section: 'root',
          key: 'model_auto_compact_token_limit',
          path: ['model_auto_compact_token_limit'],
          valueType: 'integer',
          type: 'removed',
          previousValue: 180000,
        },
      ],
    },
    {
      values: {},
      changes: [
        {
          id: 'root.model_auto_compact_token_limit',
          section: 'root',
          key: 'model_auto_compact_token_limit',
          path: ['model_auto_compact_token_limit'],
          valueType: 'integer',
          value: undefined,
          remove: true,
        },
      ],
    },
    '/tmp/config.toml'
  );

  assert.deepEqual(preview.changes, [
    {
      id: 'root.model_auto_compact_token_limit',
      section: 'root',
      key: 'model_auto_compact_token_limit',
      path: ['model_auto_compact_token_limit'],
      valueType: 'integer',
      before: 180000,
      after: undefined,
      kind: 'removed',
    },
  ]);
});
