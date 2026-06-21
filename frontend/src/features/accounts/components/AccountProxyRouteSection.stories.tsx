import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import type { ProxyNodeRecord } from '../../proxy-pool/model';
import { buildProxyURLFromNode } from '../../proxy-pool/model';
import AccountProxyRouteSection from './AccountProxyRouteSection';

const meta = {
  title: 'Design System/业务组件/账号代理出口',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const proxyNodes: ProxyNodeRecord[] = [
  {
    id: 'proxy-sha-alpha',
    name: 'Shanghai Alpha',
    group: 'primary',
    protocol: 'SOCKS5',
    sourceLabel: 'manual',
    sourceURL: '',
    host: '127.0.0.1',
    port: 7890,
    latencyMs: 42,
    availabilityRate: 99,
    lastCheckedAt: '2026-05-19 09:30',
    status: 'available',
    note: 'Primary exit.',
  },
  {
    id: 'proxy-sg-beta',
    name: 'Singapore Beta',
    group: 'backup',
    protocol: 'HTTPS',
    sourceLabel: 'subscription',
    sourceURL: 'https://proxy.example/sub',
    host: '10.0.0.8',
    port: 8443,
    latencyMs: 168,
    availabilityRate: 91,
    lastCheckedAt: '2026-05-19 09:20',
    status: 'review',
    note: 'Backup exit.',
  },
];

function ProxyRouteViewport({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <DesignSystemStoryFrame label={label}>
      <div className="min-w-0 border-2 border-[var(--gt-border-strong)] bg-[var(--gt-surface-canvas)] p-5">
        {children}
      </div>
    </DesignSystemStoryFrame>
  );
}

function AccountProxyRouteSample({
  label,
  proxyUrl = '',
  nodes = proxyNodes,
  readonlyReason = '',
}: {
  label: string;
  proxyUrl?: string;
  nodes?: ProxyNodeRecord[];
  readonlyReason?: string;
}) {
  return (
    <ProxyRouteViewport label={label}>
      <AccountProxyRouteSection
        proxyUrl={proxyUrl}
        proxyNodes={nodes}
        readonlyReason={readonlyReason}
        onProxyUrlChange={() => undefined}
        onValidityChange={() => undefined}
      />
    </ProxyRouteViewport>
  );
}

function AccountProxyRouteOverview() {
  return (
    <div className="grid w-full gap-5 bg-[var(--gt-surface-panel)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">账号代理出口</h2>
        <p className="mt-2 max-w-3xl text-sm font-bold text-[var(--gt-ink-muted)]">
          账号详情里的出口选择区块进入设计系统后，用注入的 proxy nodes mock 覆盖继承、直连、自定义、无节点和只读状态。
        </p>
      </div>

      <section className="grid gap-3 border-2 border-[var(--gt-border-strong)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">Proxy route states</h3>
        <div className="grid gap-4 xl:grid-cols-2">
          <AccountProxyRouteSample label="DS-PROXY-INHERIT" />
          <AccountProxyRouteSample label="DS-PROXY-DIRECT" proxyUrl="direct" />
          <AccountProxyRouteSample label="DS-PROXY-CUSTOM" proxyUrl={buildProxyURLFromNode(proxyNodes[0])} />
          <AccountProxyRouteSample label="DS-PROXY-DETACHED" proxyUrl="socks5://10.10.10.10:7000" />
          <AccountProxyRouteSample label="DS-PROXY-NO-NODES" nodes={[]} />
          <AccountProxyRouteSample
            label="DS-PROXY-READONLY"
            proxyUrl={buildProxyURLFromNode(proxyNodes[1])}
            readonlyReason="Provider preset locks proxy routing"
          />
        </div>
      </section>
    </div>
  );
}

export const Overview: Story = {
  render: () => <AccountProxyRouteOverview />,
};

export const Custom: Story = {
  render: () => <AccountProxyRouteSample label="DS-PROXY-CUSTOM" proxyUrl={buildProxyURLFromNode(proxyNodes[0])} />,
};

export const Readonly: Story = {
  render: () => (
    <AccountProxyRouteSample
      label="DS-PROXY-READONLY"
      proxyUrl={buildProxyURLFromNode(proxyNodes[1])}
      readonlyReason="Provider preset locks proxy routing"
    />
  ),
};
