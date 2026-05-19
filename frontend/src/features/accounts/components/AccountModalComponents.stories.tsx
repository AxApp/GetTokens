import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useI18n } from '../../../context/I18nContext';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import AccountDetailModalFrame from './AccountDetailModalFrame';
import PasteAuthModal from './PasteAuthModal';

const meta = {
  title: 'Design System/Feature Components/Account Modals',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function ModalViewport({ children, label = 'DS-MODAL' }: { children: ReactNode; label?: string }) {
  return (
    <DesignSystemStoryFrame label={label}>
      <div className="relative h-[32rem] min-w-0 overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-surface)] [transform:translateZ(0)]">
        {children}
      </div>
    </DesignSystemStoryFrame>
  );
}

function Header({ title = 'Codex Account Detail', eyebrow = 'ACCOUNT DETAIL' }: { title?: string; eyebrow?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="font-mono text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
          {eyebrow}
        </div>
        <h3 className="mt-2 text-xl font-black uppercase italic tracking-normal text-[var(--text-primary)]">
          {title}
        </h3>
      </div>
      <span className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1 font-mono text-[0.625rem] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]">
        READY
      </span>
    </div>
  );
}

function Body({ long = false }: { long?: boolean }) {
  const rows = long
    ? [
        ['Provider', 'OpenAI'],
        ['Credential source', 'auth-file'],
        ['Email', 'team-codex@example.com'],
        ['Plan', 'Pro'],
        ['Quota window', '5H / 62% remaining'],
        ['Weekly window', '84% remaining'],
        ['Relay route', 'managed local relay'],
        ['Last activity', '2026-05-19 22:40'],
        ['Model aliases', 'gpt-5.2, gpt-5.2-mini, gpt-5.4'],
        ['Health', '99.5% success across current window'],
      ]
    : [
        ['Provider', 'OpenAI'],
        ['Credential source', 'auth-file'],
        ['Quota window', '5H / 62% remaining'],
      ];

  return (
    <div className="grid gap-4 p-6">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
          <div className="font-mono text-[0.5625rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Requests
          </div>
          <div className="mt-2 text-2xl font-black italic tracking-normal text-[var(--text-primary)]">1,248</div>
        </div>
        <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
          <div className="font-mono text-[0.5625rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Tokens
          </div>
          <div className="mt-2 text-2xl font-black italic tracking-normal text-[var(--text-primary)]">1.0M</div>
        </div>
        <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
          <div className="font-mono text-[0.5625rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Latency
          </div>
          <div className="mt-2 text-2xl font-black italic tracking-normal text-[var(--text-primary)]">182MS</div>
        </div>
      </div>
      <div className="grid overflow-hidden border-2 border-[var(--border-color)]">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-2 border-b border-dashed border-[var(--border-color)] px-4 py-3 last:border-b-0 md:grid-cols-[12rem_minmax(0,1fr)]">
            <div className="font-mono text-[0.625rem] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
              {label}
            </div>
            <div className="min-w-0 break-all text-[0.75rem] font-black text-[var(--text-primary)]">
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <>
      <div className="font-mono text-[0.625rem] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
        Preview only
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-swiss">
          Cancel
        </button>
        <button type="button" className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)]">
          Save
        </button>
      </div>
    </>
  );
}

function ErrorMessage() {
  return (
    <div className="border-t-2 border-red-500 bg-red-500/10 px-6 py-4 text-[0.625rem] font-black uppercase tracking-[0.12em] text-red-500">
      Quota probe returned 429 in the latest check.
    </div>
  );
}

function ModalSample({
  long = false,
  error = false,
  footer = true,
}: {
  long?: boolean;
  error?: boolean;
  footer?: boolean;
}) {
  return (
    <ModalViewport>
      <AccountDetailModalFrame
        onClose={() => undefined}
        header={<Header title={error ? 'Route Backup Detail' : 'Codex Primary Detail'} />}
        error={error ? <ErrorMessage /> : undefined}
        footer={footer ? <Footer /> : undefined}
      >
        <Body long={long} />
      </AccountDetailModalFrame>
    </ModalViewport>
  );
}

function PasteAuthSample({
  content = '',
  error = '',
  label,
}: {
  content?: string;
  error?: string;
  label: string;
}) {
  const { t } = useI18n();
  return (
    <ModalViewport label={label}>
      <PasteAuthModal
        t={t}
        pasteContent={content}
        pasteError={error}
        onClose={() => undefined}
        onChange={() => undefined}
        onSubmit={() => undefined}
      />
    </ModalViewport>
  );
}

const pastedAuthContent = JSON.stringify(
  {
    type: 'codex',
    email: 'team-codex@example.com',
    access_token: 'preview-access-token',
    refresh_token: 'preview-refresh-token',
    account_id: 'acct_preview',
  },
  null,
  2,
);

function AccountModalsOverview() {
  return (
    <div className="grid w-full gap-5 bg-[var(--bg-surface)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">Account Modals</h2>
        <p className="mt-2 max-w-3xl text-sm font-bold text-[var(--text-muted)]">
          把账号详情弹窗的基础 shell 纳入设计系统，用固定内容检查 header、可滚动 body、错误条和 footer action 布局。
        </p>
      </div>

      <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">Modal shell states</h3>
        <div className="grid gap-4 xl:grid-cols-2">
          <ModalSample />
          <ModalSample long />
          <ModalSample error />
          <ModalSample footer={false} />
        </div>
      </section>

      <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">Paste auth states</h3>
        <div className="grid gap-4 xl:grid-cols-3">
          <PasteAuthSample label="DS-PASTE-EMPTY" />
          <PasteAuthSample label="DS-PASTE-READY" content={pastedAuthContent} />
          <PasteAuthSample label="DS-PASTE-ERROR" content="{ broken auth payload" error="JSON 解析失败：缺少结束括号" />
        </div>
      </section>
    </div>
  );
}

export const Overview: Story = {
  render: () => <AccountModalsOverview />,
};

export const Default: Story = {
  render: () => <ModalSample />,
};

export const LongContent: Story = {
  render: () => <ModalSample long />,
};

export const Error: Story = {
  render: () => <ModalSample error />,
};

export const PasteAuth: Story = {
  render: () => <PasteAuthSample label="DS-PASTE-READY" content={pastedAuthContent} />,
};
