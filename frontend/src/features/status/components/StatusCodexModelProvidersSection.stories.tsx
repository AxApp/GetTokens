import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import type {
  CodexFeatureConfigSnapshot,
  CodexFeaturePreview,
  CodexFeatureRow,
} from '../model/codexFeatureConfig';
import StatusCodexModelProvidersSection from './StatusCodexModelProvidersSection';

const meta = {
  title: 'Design System/业务组件/状态页 Codex Model Providers',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const copy: Record<string, string> = {
  'common.refresh': '刷新',
  'common.save': '保存',
  'status.codex_model_providers_title': 'Codex Model Providers',
  'status.codex_model_providers_unavailable': '未读取到 config.toml',
  'status.codex_model_providers_visible': 'VISIBLE',
  'status.codex_model_providers_changed': 'CHANGED',
  'status.codex_model_providers_loading': '加载中',
  'status.codex_model_providers_empty': '没有可配置的 model provider 字段',
  'status.codex_model_providers_preview_title': '预览变更',
  'status.codex_model_providers_save_hint': '保存前会先生成本地配置预览',
  'status.codex_model_providers_reset': '重置',
  'status.codex_model_providers_preview': '预览',
  'status.codex_model_providers_saving': '保存中',
  'status.codex_model_providers_no_description': '暂无描述',
};

const t = (key: string) => copy[key] ?? key;

function providerRow(
  row: Omit<CodexFeatureRow, 'id' | 'path' | 'draftValue' | 'dirty' | 'changeKind' | 'removed'> & {
    valueType: string;
    options?: string[];
    draftValue: unknown;
    dirty: boolean;
    changeKind: CodexFeatureRow['changeKind'];
  }
): CodexFeatureRow {
  return {
    id: `model_providers.gettokens.${row.key}`,
    path: ['model_providers', 'gettokens', row.key],
    removed: false,
    ...row,
    options: row.options ?? [],
  } as CodexFeatureRow;
}

const rows: CodexFeatureRow[] = [
  providerRow({
    section: 'model_providers',
    key: 'name',
    description: '模型提供方显示名称。',
    stage: 'stable',
    valueType: 'string',
    options: [],
    defaultValue: 'GetTokens',
    localValue: 'GetTokens',
    localRawValue: '"GetTokens"',
    effectiveValue: 'GetTokens',
    hasLocalValue: true,
    legacyAliases: [],
    canonicalKey: 'name',
    unsupported: false,
    readOnly: false,
    hiddenByDefault: false,
    draftValue: 'GetTokens',
    dirty: false,
    changeKind: 'none',
  }),
  providerRow({
    section: 'model_providers',
    key: 'base_url',
    description: '模型提供方的 API base URL。',
    stage: 'stable',
    valueType: 'string',
    options: [],
    defaultValue: 'https://api.example.test/v1',
    localValue: 'https://api.example.test/v1',
    localRawValue: '"https://api.example.test/v1"',
    effectiveValue: 'https://api.example.test/v1',
    hasLocalValue: true,
    legacyAliases: [],
    canonicalKey: 'base_url',
    unsupported: false,
    readOnly: false,
    hiddenByDefault: false,
    draftValue: 'https://relay.example.test/v1',
    dirty: true,
    changeKind: 'modified',
  }),
  providerRow({
    section: 'model_providers',
    key: 'wire_api',
    description: '选择对外 wire API 类型。',
    stage: 'stable',
    valueType: 'enum',
    options: ['responses', 'chat', 'chat_completions'],
    defaultValue: 'responses',
    localValue: 'responses',
    localRawValue: '"responses"',
    effectiveValue: 'responses',
    hasLocalValue: true,
    legacyAliases: [],
    canonicalKey: 'wire_api',
    unsupported: false,
    readOnly: false,
    hiddenByDefault: false,
    draftValue: 'chat',
    dirty: true,
    changeKind: 'modified',
  }),
  providerRow({
    section: 'model_providers',
    key: 'requires_openai_auth',
    description: '是否仍然需要 OpenAI auth 透传。',
    stage: 'advanced',
    valueType: 'boolean',
    options: [],
    defaultValue: false,
    localValue: false,
    localRawValue: 'false',
    effectiveValue: false,
    hasLocalValue: true,
    legacyAliases: [],
    canonicalKey: 'requires_openai_auth',
    unsupported: false,
    readOnly: false,
    hiddenByDefault: false,
    draftValue: true,
    dirty: true,
    changeKind: 'modified',
  }),
  providerRow({
    section: 'model_providers',
    key: 'env_key',
    description: '注入给 provider 的环境变量名。',
    stage: 'advanced',
    valueType: 'string',
    options: [],
    defaultValue: 'OPENAI_API_KEY',
    localValue: 'OPENAI_API_KEY',
    localRawValue: '"OPENAI_API_KEY"',
    effectiveValue: 'OPENAI_API_KEY',
    hasLocalValue: true,
    legacyAliases: [],
    canonicalKey: 'env_key',
    unsupported: false,
    readOnly: false,
    hiddenByDefault: false,
    draftValue: 'GETTOKENS_API_KEY',
    dirty: true,
    changeKind: 'modified',
  }),
  providerRow({
    section: 'model_providers',
    key: 'query_params',
    description: '只读的 query 参数映射。',
    stage: 'advanced',
    valueType: 'toml',
    options: [],
    defaultValue: 'headers = { "x-source" = "gettokens" }',
    localValue: 'headers = { "x-source" = "gettokens" }',
    localRawValue: 'headers = { "x-source" = "gettokens" }',
    effectiveValue: 'headers = { "x-source" = "gettokens" }',
    hasLocalValue: true,
    legacyAliases: [],
    canonicalKey: 'query_params',
    unsupported: false,
    readOnly: true,
    hiddenByDefault: false,
    draftValue: 'headers = { "x-source" = "gettokens" }',
    dirty: false,
    changeKind: 'none',
  }),
];

const snapshot: CodexFeatureConfigSnapshot = {
  codexHomePath: '/Users/preview/.codex',
  configPath: '/Users/preview/.codex/config.toml',
  items: rows,
  warnings: [],
  loadedAt: '2026-05-23T12:00:00Z',
};

const preview: CodexFeaturePreview = {
  configPath: snapshot.configPath,
  summary: '4 modified',
  changes: [
    {
      id: 'model_providers.gettokens.base_url',
      section: 'model_providers',
      key: 'base_url',
      path: ['model_providers', 'gettokens', 'base_url'],
      valueType: 'string',
      before: 'https://api.example.test/v1',
      after: 'https://relay.example.test/v1',
      kind: 'modified',
    },
    {
      id: 'model_providers.gettokens.wire_api',
      section: 'model_providers',
      key: 'wire_api',
      path: ['model_providers', 'gettokens', 'wire_api'],
      valueType: 'enum',
      before: 'responses',
      after: 'chat',
      kind: 'modified',
    },
    {
      id: 'model_providers.gettokens.requires_openai_auth',
      section: 'model_providers',
      key: 'requires_openai_auth',
      path: ['model_providers', 'gettokens', 'requires_openai_auth'],
      valueType: 'boolean',
      before: false,
      after: true,
      kind: 'modified',
    },
    {
      id: 'model_providers.gettokens.env_key',
      section: 'model_providers',
      key: 'env_key',
      path: ['model_providers', 'gettokens', 'env_key'],
      valueType: 'string',
      before: 'OPENAI_API_KEY',
      after: 'GETTOKENS_API_KEY',
      kind: 'modified',
    },
  ],
};

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DesignSystemStoryFrame label={label}>
      <div className="min-w-0 border-2 border-[var(--gt-border-strong)] bg-[var(--gt-surface-canvas)] p-4">{children}</div>
    </DesignSystemStoryFrame>
  );
}

function ProviderSectionSample({
  label,
  sampleRows = rows,
  sampleSnapshot = snapshot,
  samplePreview = null,
  message = '',
  dirtyCount = 0,
  isLoading = false,
  isSaving = false,
}: {
  label: string;
  sampleRows?: CodexFeatureRow[];
  sampleSnapshot?: CodexFeatureConfigSnapshot | null;
  samplePreview?: CodexFeaturePreview | null;
  message?: string;
  dirtyCount?: number;
  isLoading?: boolean;
  isSaving?: boolean;
}) {
  return (
    <Frame label={label}>
      <StatusCodexModelProvidersSection
        t={t}
        snapshot={sampleSnapshot}
        rows={sampleRows}
        preview={samplePreview}
        message={message}
        dirtyCount={dirtyCount}
        isLoading={isLoading}
        isSaving={isSaving}
        onReload={() => undefined}
        onChangeSetting={() => undefined}
        onPreview={() => undefined}
        onSave={() => undefined}
        onReset={() => undefined}
      />
    </Frame>
  );
}

function StatusCodexModelProvidersOverview() {
  return (
    <div className="grid w-full gap-5 bg-[var(--gt-surface-panel)] p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">状态页 Codex Model Providers</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold text-[var(--gt-ink-muted)]">
          Codex model provider 面板展示 provider 名称、base URL、wire API、认证依赖和只读参数，覆盖 string、enum、bool 与 TOML 文本控件。
        </p>
      </div>

      <section className="grid gap-3 border-2 border-[var(--gt-border-strong)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-semibold tracking-normal">Provider states</h3>
        <div className="grid gap-4">
          <ProviderSectionSample label="DS-CODEX-PROVIDERS-READY" message="loaded from config.toml" />
          <ProviderSectionSample
            label="DS-CODEX-PROVIDERS-DIRTY-PREVIEW"
            samplePreview={preview}
            dirtyCount={4}
            message="4 pending changes"
          />
          <ProviderSectionSample label="DS-CODEX-PROVIDERS-SAVING" samplePreview={preview} dirtyCount={4} isSaving />
          <div className="grid gap-4 xl:grid-cols-3">
            <ProviderSectionSample label="DS-CODEX-PROVIDERS-LOADING" sampleRows={[]} sampleSnapshot={null} isLoading />
            <ProviderSectionSample label="DS-CODEX-PROVIDERS-EMPTY" sampleRows={[]} dirtyCount={0} />
            <ProviderSectionSample
              label="DS-CODEX-PROVIDERS-UNAVAILABLE"
              sampleRows={[]}
              sampleSnapshot={null}
              message="local config unavailable"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export const Overview: Story = {
  render: () => <StatusCodexModelProvidersOverview />,
};
