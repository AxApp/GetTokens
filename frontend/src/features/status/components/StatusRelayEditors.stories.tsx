import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useI18n } from '../../../context/I18nContext';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import type {
  RelayKeyEditorState,
  RelayModelEditorState,
  RelayProviderEditorState,
} from '../model/relayLocalState';
import {
  RelayKeyEditorModal,
  RelayModelEditorModal,
  RelayProviderEditorModal,
} from './RelayEditors';

const meta = {
  title: 'Design System/业务组件/状态页 Relay 编辑器',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const copy = {
  zh: {
    'common.cancel': '取消',
    'common.save': '保存',
    'status.service_api_keys': '服务 API Keys',
    'status.service_key_create_title': '创建 Relay Key',
    'status.service_key_rename': '重命名 Relay Key',
    'status.service_key_name_label': '名称',
    'status.service_key_name_placeholder': '例如 Local Codex',
    'status.service_key_value_label': 'Key',
    'status.service_key_value_placeholder': 'gt-relay-...',
    'status.service_key_value_generate': '生成',
    'status.service_key_create_submit': '创建',
    'status.provider_title': '模型供应商',
    'status.provider_create_title': '新增供应商',
    'status.provider_id_label': 'model_provider',
    'status.provider_id_placeholder': 'gettokens',
    'status.provider_create_submit': '添加供应商',
    'status.model_name_title': '模型名称',
    'status.model_name_create_title': '新增模型名称',
    'status.model_name_label': 'Model',
    'status.model_name_placeholder': 'gpt-5.2',
    'status.model_name_create_submit': '添加模型',
  },
  en: {
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'status.service_api_keys': 'Service API keys',
    'status.service_key_create_title': 'Create relay key',
    'status.service_key_rename': 'Rename relay key',
    'status.service_key_name_label': 'Name',
    'status.service_key_name_placeholder': 'For example Local Codex',
    'status.service_key_value_label': 'Key',
    'status.service_key_value_placeholder': 'gt-relay-...',
    'status.service_key_value_generate': 'Generate',
    'status.service_key_create_submit': 'Create',
    'status.provider_title': 'Model provider',
    'status.provider_create_title': 'Add provider',
    'status.provider_id_label': 'model_provider',
    'status.provider_id_placeholder': 'gettokens',
    'status.provider_create_submit': 'Add provider',
    'status.model_name_title': 'Model name',
    'status.model_name_create_title': 'Add model name',
    'status.model_name_label': 'Model',
    'status.model_name_placeholder': 'gpt-5.2',
    'status.model_name_create_submit': 'Add model',
  },
} as const;

function useStoryCopy() {
  const { locale } = useI18n();
  const dictionary = locale === 'zh' ? copy.zh : copy.en;
  return {
    locale,
    t: (key: string) => dictionary[key as keyof typeof dictionary] || key,
  };
}

function ModalViewport({ children, label }: { children: ReactNode; label: string }) {
  return (
    <DesignSystemStoryFrame label={label}>
      <div className="relative h-[25rem] min-w-0 overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-surface)] [transform:translateZ(0)]">
        {children}
      </div>
    </DesignSystemStoryFrame>
  );
}

function KeyEditorSample({
  mode = 'create',
  error = '',
}: {
  mode?: RelayKeyEditorState['mode'];
  error?: string;
}) {
  const { t } = useStoryCopy();
  const [editor, setEditor] = useState<RelayKeyEditorState>({
    mode,
    index: mode === 'rename' ? 0 : null,
    name: mode === 'rename' ? 'Local Codex' : '',
    apiKey: mode === 'rename' ? 'gt-relay-local-codex-preview' : 'gt-relay-preview-key',
    error,
  });

  return (
    <ModalViewport label="DS-KEY">
      <RelayKeyEditorModal
        editor={editor}
        t={t}
        onClose={() => undefined}
        onChange={setEditor}
        onSubmit={() => undefined}
      />
    </ModalViewport>
  );
}

function ProviderEditorSample({ error = '' }: { error?: string }) {
  const { t } = useStoryCopy();
  const [editor, setEditor] = useState<RelayProviderEditorState>({
    providerID: 'gettokens',
    providerName: 'gettokens',
    error,
  });

  return (
    <ModalViewport label="DS-PROVIDER">
      <RelayProviderEditorModal
        editor={editor}
        t={t}
        onClose={() => undefined}
        onChange={setEditor}
        onSubmit={() => undefined}
      />
    </ModalViewport>
  );
}

function ModelEditorSample({ error = '' }: { error?: string }) {
  const { t } = useStoryCopy();
  const [editor, setEditor] = useState<RelayModelEditorState>({
    value: 'gpt-5.2',
    error,
  });

  return (
    <ModalViewport label="DS-MODEL">
      <RelayModelEditorModal
        editor={editor}
        t={t}
        onClose={() => undefined}
        onChange={setEditor}
        onSubmit={() => undefined}
      />
    </ModalViewport>
  );
}

function StatusRelayEditorsOverview() {
  const { locale } = useStoryCopy();
  const zh = locale === 'zh';

  return (
    <div className="grid w-full gap-5 bg-[var(--bg-surface)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">状态页 Relay 编辑器</h2>
        <p className="mt-2 max-w-3xl text-sm font-bold text-[var(--text-muted)]">
          {zh
            ? '把 Status 页中用于 Relay key、provider 和 model 的编辑弹窗纳入设计系统，统一检查 modal shell、表单密度、错误态和禁用输入。'
            : 'Admitted relay key, provider, and model editor dialogs from Status for modal shell, form density, error states, and disabled inputs.'}
        </p>
      </div>

      <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">{zh ? 'Key 编辑器' : 'Key editor'}</h3>
        <div className="grid gap-4 xl:grid-cols-3">
          <KeyEditorSample />
          <KeyEditorSample mode="rename" />
          <KeyEditorSample error="Key name already exists" />
        </div>
      </section>

      <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">{zh ? 'Provider / Model 编辑器' : 'Provider / Model editors'}</h3>
        <div className="grid gap-4 xl:grid-cols-3">
          <ProviderEditorSample />
          <ProviderEditorSample error="Provider ID is required" />
          <ModelEditorSample error="Model name is required" />
        </div>
      </section>
    </div>
  );
}

export const Overview: Story = {
  render: () => <StatusRelayEditorsOverview />,
};

export const KeyCreate: Story = {
  render: () => <KeyEditorSample />,
};

export const KeyRename: Story = {
  render: () => <KeyEditorSample mode="rename" />,
};

export const ProviderEditor: Story = {
  render: () => <ProviderEditorSample />,
};

export const ModelEditor: Story = {
  render: () => <ModelEditorSample />,
};
