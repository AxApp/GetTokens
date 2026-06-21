import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useI18n } from '../../../context/I18nContext';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import DebugEmptyState from './DebugEmptyState';
import DebugEntryCard from './DebugEntryCard';
import DebugHeader from './DebugHeader';

const meta = {
  title: 'Design System/业务组件/调试面板',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const requestText = `POST /v0/management/api-call
Authorization: Bearer gettokens-local-management-key
Content-Type: application/json

{
  "method": "GET",
  "url": "https://api.openai.com/v1/models"
}`;

const successResponseText = `HTTP/2 200
{
  "object": "list",
  "data": [
    { "id": "gpt-5.2", "owned_by": "openai" }
  ]
}`;

const errorResponseText = `HTTP/2 429
{
  "error": {
    "message": "Rate limit exceeded",
    "type": "rate_limit_error"
  }
}`;

function HeaderSample({
  count = 3,
  selectedCount = 1,
  copyState = 'idle',
}: {
  count?: number;
  selectedCount?: number;
  copyState?: 'idle' | 'success' | 'error';
}) {
  return (
    <DesignSystemStoryFrame>
      <DebugHeader
        count={count}
        allSelected={count > 0 && selectedCount === count}
        selectedCount={selectedCount}
        copyState={copyState}
        onToggleSelectAll={() => undefined}
        onClearSelection={() => undefined}
        onCopySelected={() => undefined}
        onClearAll={() => undefined}
      />
    </DesignSystemStoryFrame>
  );
}

function EntryCardSample({
  status = 'success',
  expanded = true,
  selected = false,
}: {
  status?: 'success' | 'error' | 'pending';
  expanded?: boolean;
  selected?: boolean;
}) {
  const { locale } = useI18n();
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [isSelected, setIsSelected] = useState(selected);
  const name =
    locale === 'zh'
      ? status === 'error'
        ? '模型列表请求失败'
        : '模型列表请求'
      : status === 'error'
        ? 'Model list request failed'
        : 'Model list request';

  return (
    <DesignSystemStoryFrame>
      <DebugEntryCard
        entry={{
          id: `debug-${status}`,
          name,
          transport: status === 'pending' ? 'SSE' : 'HTTP',
          status,
          startedAt: '23:14:08',
          durationMs: status === 'pending' ? undefined : status === 'error' ? 782 : 128,
          isExpanded,
          requestText,
          responseText: status === 'error' ? errorResponseText : successResponseText,
        }}
        isSelected={isSelected}
        onToggleEntry={() => setIsSelected((value) => !value)}
        onToggleExpanded={() => setIsExpanded((value) => !value)}
      />
    </DesignSystemStoryFrame>
  );
}

function EmptyStateSample() {
  return (
    <DesignSystemStoryFrame>
      <DebugEmptyState />
    </DesignSystemStoryFrame>
  );
}

function DebugPanelOverview() {
  const { locale } = useI18n();
  const zh = locale === 'zh';

  return (
    <div className="grid w-full gap-5 bg-[var(--gt-surface-panel)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">调试面板组件</h2>
        <p className="mt-2 max-w-3xl text-sm font-bold text-[var(--gt-ink-muted)]">
          {zh
            ? '把调试面板中已经提取的业务组件纳入设计系统，统一检查工具栏、日志卡片、错误态、折叠态和空状态。'
            : 'Admitted debug panel feature components for toolbar, trace card, error, collapsed, and empty states.'}
        </p>
      </div>

      <section className="grid gap-3 border-2 border-[var(--gt-border-strong)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">{zh ? '工具栏状态' : 'Header states'}</h3>
        <HeaderSample />
        <HeaderSample count={2} selectedCount={2} copyState="success" />
      </section>

      <section className="grid gap-3 border-2 border-[var(--gt-border-strong)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">{zh ? '日志卡片状态' : 'Entry card states'}</h3>
        <div className="grid gap-4 xl:grid-cols-2">
          <EntryCardSample selected />
          <EntryCardSample status="error" />
          <EntryCardSample status="pending" expanded={false} />
        </div>
      </section>

      <section className="grid gap-3 border-2 border-[var(--gt-border-strong)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">{zh ? '空状态' : 'Empty state'}</h3>
        <EmptyStateSample />
      </section>
    </div>
  );
}

export const Overview: Story = {
  render: () => <DebugPanelOverview />,
};

export const Header: Story = {
  render: () => <HeaderSample />,
};

export const EntrySuccess: Story = {
  render: () => <EntryCardSample selected />,
};

export const EntryError: Story = {
  render: () => <EntryCardSample status="error" />,
};

export const Empty: Story = {
  render: () => <EmptyStateSample />,
};
