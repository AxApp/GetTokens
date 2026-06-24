import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from 'antd';
import { useI18n } from '../../context/I18nContext';
import DesignSystemStoryFrame from '../../features/design-system/DesignSystemStoryFrame';
import ModalFrame from './ModalFrame';

const meta = {
  title: 'Design System/通用组件/弹窗窗口',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function ModalHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">
        {eyebrow}
      </div>
      <h3 className="mt-1 text-sm font-semibold tracking-normal text-[var(--gt-ink-primary)]">
        {title}
      </h3>
    </div>
  );
}

function ModalFooter({ confirmLabel, cancelLabel }: { confirmLabel: string; cancelLabel: string }) {
  return (
    <>
      <div className="text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">
        {confirmLabel}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button>
          {cancelLabel}
        </Button>
        <Button type="primary">
          {confirmLabel}
        </Button>
      </div>
    </>
  );
}

function ModalContent({ long = false }: { long?: boolean }) {
  const rows = long ? 9 : 3;
  return (
    <div className="grid gap-3 p-6">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="grid gap-2 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-3">
          <div className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">
            FIELD {String(index + 1).padStart(2, '0')}
          </div>
          <div className="h-8 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]" />
        </div>
      ))}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="shrink-0 border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-6 py-3 text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-status-danger)]">
      {message}
    </div>
  );
}

function ModalFrameSample({
  variant = 'default',
}: {
  variant?: 'default' | 'long' | 'error' | 'confirm' | 'detail';
}) {
  const { locale } = useI18n();
  const zh = locale === 'zh';
  const isConfirm = variant === 'confirm';
  const isDetail = variant === 'detail';
  const title = resolveModalSampleTitle({ isConfirm, isDetail, zh });

  return (
    <DesignSystemStoryFrame>
      <div className="relative min-h-[32rem] overflow-hidden rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]">
        <ModalFrame
          onClose={() => undefined}
          size={isConfirm ? 'sm' : isDetail ? 'detail' : 'md'}
          position="absolute"
          header={<ModalHeader eyebrow={zh ? '弹窗窗口' : 'Modal Frame'} title={title} />}
          error={variant === 'error' ? <ErrorBanner message={zh ? '保存失败：凭据格式无效' : 'Save failed: invalid credential format'} /> : undefined}
          ariaLabel={title}
        >
          <ModalContent long={variant === 'long' || isDetail} />
        </ModalFrame>
      </div>
    </DesignSystemStoryFrame>
  );
}

function resolveModalSampleTitle({
  isConfirm,
  isDetail,
  zh,
}: {
  isConfirm: boolean;
  isDetail: boolean;
  zh: boolean;
}) {
  if (isConfirm) {
    return zh ? '确认删除凭据' : 'Confirm Credential Removal';
  }
  if (isDetail) {
    return zh ? '账号运行详情' : 'Account Runtime Detail';
  }
  return zh ? '编辑账号配置' : 'Edit Account Configuration';
}

function ModalFrameOverview() {
  const { locale } = useI18n();
  const zh = locale === 'zh';

  return (
    <div className="grid w-full gap-5 bg-[var(--gt-surface-muted)] p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">ModalFrame</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold text-[var(--gt-ink-muted)]">
          {zh
            ? '统一遮罩、窗口材质、尺寸、滚动边界、分区和设计系统准入标记。'
            : 'Shared scrim, panel material, sizing, scroll boundary, slots, and design-system admission marker.'}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ModalFrameSample variant="default" />
        <ModalFrameSample variant="error" />
        <ModalFrameSample variant="long" />
        <ModalFrameSample variant="confirm" />
      </div>
      <ModalFrameSample variant="detail" />
    </div>
  );
}

export const Overview: Story = {
  render: () => <ModalFrameOverview />,
};

export const Default: Story = {
  render: () => <ModalFrameSample />,
};

export const Error: Story = {
  render: () => <ModalFrameSample variant="error" />,
};

export const LongContent: Story = {
  render: () => <ModalFrameSample variant="long" />,
};
