import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import type { CodexAccountRow } from '../model/codexAccountList';
import { RouteProbeCard } from './CodexRouteProbeCard';

const meta = {
  title: 'Design System/业务组件/Codex 路由探测',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const copy: Record<string, string> = {
  'common.close': 'Close',
  'common.reset': 'Reset',
  'codex.account_list_policy_title': 'Route policy',
  'codex.account_list_policy_headline': 'Preview the account order used for the next request.',
  'codex.account_list_probe_terminal': 'Probe terminal',
  'codex.account_list_probe_open': 'Route probe',
  'codex.account_list_probe_model': 'Model',
  'codex.account_list_policy_preview_count': 'Candidates',
  'codex.account_list_probe_result': 'Result',
  'codex.account_list_probe_running': 'Running',
  'codex.account_list_probe_fallback_hit': 'Fallback used',
  'codex.account_list_probe_idle': 'Idle',
  'codex.account_list_probe_once': 'Probe once',
  'codex.account_list_probe_series': 'Probe series',
  'codex.account_list_policy_fallback_scope': 'Fallback scope',
  'codex.account_list_policy_fallback': 'Allow fallback',
  'codex.account_list_policy_fallback_hint': 'Keep lower-priority accounts available if every preferred account misses.',
  'codex.account_list_policy_preview': 'Policy preview',
  'codex.account_list_policy_order': 'Candidate queue',
  'codex.account_list_probe_no_account': 'No requestable accounts',
  'codex.account_list_source_auth_file': 'Auth file',
  'codex.account_list_source_api_key': 'API key',
  'codex.account_list_source_openai_compatible': 'OpenAI compatible',
};

function t(key: string) {
  return copy[key] || key;
}

const rows: CodexAccountRow[] = [
  {
    id: 'auth-file:team-codex',
    label: 'team-codex@example.com',
    sourceKind: 'codex-auth-file',
    provider: 'codex',
    quotaKey: 'team-codex',
    priority: 3,
    requestable: true,
    blockReason: '',
    status: 'active',
    baseUrl: 'https://chatgpt.com/backend-api',
    prefix: '',
    keySuffix: '',
    modelMappings: [
      { realModel: 'gpt-5.2', codexModel: 'gpt-5.2' },
      { realModel: 'gpt-5.2-mini', codexModel: 'gpt-5.2-mini' },
    ],
  },
  {
    id: 'codex-api-key:local-relay',
    label: 'Local Relay Key',
    sourceKind: 'codex-api-key',
    provider: 'codex',
    priority: 2,
    requestable: true,
    blockReason: '',
    status: 'configured',
    baseUrl: 'http://127.0.0.1:18317/v1',
    prefix: 'GT',
    keySuffix: '8F21',
    modelMappings: [{ realModel: 'gpt-5.2', codexModel: 'gpt-5.2' }],
  },
  {
    id: 'openai-compatible:cpa-host',
    label: 'cpa.host.dxy',
    sourceKind: 'openai-compatible',
    provider: 'cpa.host.dxy',
    priority: 1,
    requestable: true,
    blockReason: '',
    status: 'configured',
    baseUrl: 'https://cpa.host.dxy/v1',
    prefix: '',
    keySuffix: '',
    modelMappings: [{ realModel: 'gpt-5.2', codexModel: 'gpt-5.2' }],
  },
];

const idleLines = [
  {
    key: 'command',
    marker: '$',
    label: 'probe --model gpt-5.2 --attempts 1',
    detail: 'ready',
    status: 'command' as const,
  },
  {
    key: 'queued-team',
    marker: '01',
    label: 'team-codex@example.com',
    detail: 'Auth file · codex',
    status: 'queued' as const,
  },
  {
    key: 'queued-relay',
    marker: '02',
    label: 'Local Relay Key',
    detail: 'API key · codex',
    status: 'queued' as const,
  },
];

const hitLines = [
  {
    key: 'command',
    marker: '$',
    label: 'probe --model gpt-5.2 --attempts 3',
    detail: 'completed',
    status: 'command' as const,
  },
  {
    key: 'passed-team',
    marker: '01',
    label: 'team-codex@example.com',
    detail: 'HTTP 429',
    status: 'passed' as const,
  },
  {
    key: 'hit-relay',
    marker: '02',
    label: 'Local Relay Key',
    detail: 'HTTP 200',
    status: 'hit' as const,
  },
];

function ModalViewport({ children, label = 'DS-PROBE' }: { children: ReactNode; label?: string }) {
  return (
    <DesignSystemStoryFrame label={label}>
      <div className="relative h-[38rem] min-w-0 overflow-hidden rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-panel)] [transform:translateZ(0)]">
        {children}
      </div>
    </DesignSystemStoryFrame>
  );
}

function ProbeSample({
  running = false,
  fallback = false,
  empty = false,
}: {
  running?: boolean;
  fallback?: boolean;
  empty?: boolean;
}) {
  const [model, setModel] = useState('gpt-5.2');
  const visibleRows = empty ? [] : rows;

  return (
    <ModalViewport label={running ? 'DS-RUN' : fallback ? 'DS-FALLBACK' : empty ? 'DS-EMPTY' : 'DS-PROBE'}>
      <RouteProbeCard
        t={t}
        routingProbeModel={model}
        routingProbeModelOptions={['gpt-5.2', 'gpt-5.2-mini', 'gpt-5.4']}
        routingProbeRunning={running}
        routingProbeDisabled={running}
        routePolicyPreviewRows={visibleRows}
        routingProbeStreamLines={empty ? [] : fallback ? hitLines : idleLines}
        onClose={() => undefined}
        onModelChange={setModel}
        onProbeOnce={() => undefined}
        onProbeSeries={() => undefined}
        onReset={() => undefined}
      />
    </ModalViewport>
  );
}

function CodexRouteProbeOverview() {
  return (
    <div className="grid w-full gap-5 bg-[var(--gt-surface-panel)] p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">Codex Route Probe</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold text-[var(--gt-ink-muted)]">
          把 Codex 账号请求顺序里的路由探测工作台纳入设计系统，用固定队列和终端日志检查候选队列、运行态、fallback 命中和空候选状态。
        </p>
      </div>

      <section className="grid gap-3 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-semibold tracking-normal">Probe states</h3>
        <div className="grid gap-4 xl:grid-cols-2">
          <ProbeSample />
          <ProbeSample running />
          <ProbeSample fallback />
          <ProbeSample empty />
        </div>
      </section>
    </div>
  );
}

export const Overview: Story = {
  render: () => <CodexRouteProbeOverview />,
};

export const Idle: Story = {
  render: () => <ProbeSample />,
};

export const Running: Story = {
  render: () => <ProbeSample running />,
};

export const Fallback: Story = {
  render: () => <ProbeSample fallback />,
};
