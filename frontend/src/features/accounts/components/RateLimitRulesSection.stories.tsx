import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { useI18n } from '../../../context/I18nContext';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import type { RateLimitRule, RateLimitState } from '../model/rateLimit';
import RateLimitRulesSection, { type RateLimitRulesAPI } from './RateLimitRulesSection';

const meta = {
  title: 'Design System/Feature Components/Rate Limit Rules',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const rules: RateLimitRule[] = [
  {
    id: 'tokens-24h',
    accountKey: 'account-card-primary',
    matchKey: 'codex-workbench',
    strategy: 'token-window',
    window: '24h',
    limitValue: 1000000,
    action: 'warn',
    enabled: true,
    label: 'Daily token warning',
    createdAt: 1779140000000,
    updatedAt: 1779145200000,
  },
  {
    id: 'requests-1h',
    accountKey: 'account-card-primary',
    matchKey: 'codex-workbench',
    strategy: 'request-window',
    window: '1h',
    limitValue: 120,
    action: 'block',
    enabled: true,
    label: 'Burst request block',
    createdAt: 1779140000000,
    updatedAt: 1779145200000,
  },
];

const rateLimitStatus: RateLimitState = {
  accountKey: 'account-card-primary',
  matchKey: 'codex-workbench',
  blocked: true,
  blockReason: '1H REQUEST LIMIT',
  updatedAt: '2026-05-19 22:20',
  rules: [
    {
      exceeded: false,
      usagePct: 42,
      currentUsage: 420000,
      rule: rules[0],
    },
    {
      exceeded: true,
      usagePct: 112,
      currentUsage: 134,
      rule: rules[1],
    },
  ],
};

const mockAPI: RateLimitRulesAPI = {
  list: async () => rules,
  create: async (rule) => [...rules, { ...rule, id: 'created-rule', createdAt: 1779145300000, updatedAt: 1779145300000 }],
  update: async (rule) => rules.map((item) => (item.id === rule.id ? { ...rule, updatedAt: 1779145400000 } : item)),
  delete: async () => undefined,
};

function RateLimitViewport({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <DesignSystemStoryFrame label={label}>
      <div className="min-w-0 border-2 border-[var(--border-color)] bg-[var(--bg-main)]">
        {children}
      </div>
    </DesignSystemStoryFrame>
  );
}

function RateLimitRulesSample({
  label,
  status = rateLimitStatus,
  api = mockAPI,
}: {
  label: string;
  status?: RateLimitState;
  api?: RateLimitRulesAPI;
}) {
  const { t } = useI18n();
  return (
    <RateLimitViewport label={label}>
      <RateLimitRulesSection
        accountKey="account-card-primary"
        matchKey="codex-workbench"
        rateLimitStatus={status}
        rateLimitRulesAPI={api}
        onRateLimitRulesChanged={() => undefined}
        t={t}
      />
    </RateLimitViewport>
  );
}

function RateLimitRulesOverview() {
  return (
    <div className="grid w-full gap-5 bg-[var(--bg-surface)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">Rate Limit Rules</h2>
        <p className="mt-2 max-w-3xl text-sm font-bold text-[var(--text-muted)]">
          路由守卫规则编辑区块进入设计系统后，用 mock CRUD API 覆盖规则列表、空规则和评估超限状态。
        </p>
      </div>

      <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">Rule states</h3>
        <div className="grid gap-4">
          <RateLimitRulesSample label="DS-RATE-LIMIT-RULES-ACTIVE" />
          <RateLimitRulesSample
            label="DS-RATE-LIMIT-RULES-EMPTY"
            status={{ accountKey: 'account-card-primary', blocked: false, updatedAt: '2026-05-19 22:20', rules: [] }}
            api={{ ...mockAPI, list: async () => [] }}
          />
          <RateLimitRulesSample
            label="DS-RATE-LIMIT-RULES-PREVIEW-FALLBACK"
            api={undefined}
          />
        </div>
      </section>
    </div>
  );
}

export const Overview: Story = {
  render: () => <RateLimitRulesOverview />,
};

export const ActiveRules: Story = {
  render: () => <RateLimitRulesSample label="DS-RATE-LIMIT-RULES-ACTIVE" />,
};

export const EmptyRules: Story = {
  render: () => (
    <RateLimitRulesSample
      label="DS-RATE-LIMIT-RULES-EMPTY"
      status={{ accountKey: 'account-card-primary', blocked: false, updatedAt: '2026-05-19 22:20', rules: [] }}
      api={{ ...mockAPI, list: async () => [] }}
    />
  ),
};
