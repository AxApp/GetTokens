import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useI18n } from '../../context/I18nContext';
import DesignSystemStoryFrame from '../../features/design-system/DesignSystemStoryFrame';
import ToggleSwitch from './ToggleSwitch';

const meta = {
  title: 'Design System/通用组件/开关',
  parameters: {
    layout: 'centered',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function SwitchSample({ disabled = false, initial = false }: { disabled?: boolean; initial?: boolean }) {
  const { locale } = useI18n();
  const [checked, setChecked] = useState(initial);
  return (
    <DesignSystemStoryFrame>
      <div className="flex items-center gap-4">
        <ToggleSwitch
          label={locale === 'zh' ? '启用路由' : 'Route enabled'}
          checked={checked}
          disabled={disabled}
          onChange={setChecked}
        />
        <span className="font-mono text-[length:var(--gt-font-size-sm)] font-black uppercase tracking-normal">
          {checked ? (locale === 'zh' ? '开' : 'ON') : locale === 'zh' ? '关' : 'OFF'}
        </span>
      </div>
    </DesignSystemStoryFrame>
  );
}

function ToggleSwitchOverview() {
  const { locale } = useI18n();
  const zh = locale === 'zh';

  return (
    <div className="grid w-full max-w-4xl gap-4 bg-[var(--gt-surface-panel)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">ToggleSwitch</h2>
        <p className="mt-2 max-w-2xl text-sm font-bold text-[var(--gt-ink-muted)]">
          {zh
            ? '同屏检查关闭、开启和禁用状态，保证开关尺寸和布局不随状态跳动。'
            : 'Off, on, and disabled states on one page so switch sizing and layout stay stable.'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="grid min-h-[8rem] content-center gap-3 border-2 border-[var(--gt-border-strong)] bg-[var(--gt-surface-canvas)] p-4">
          <h3 className="text-sm font-black uppercase italic tracking-normal">{zh ? '关闭' : 'Off'}</h3>
          <SwitchSample />
        </section>
        <section className="grid min-h-[8rem] content-center gap-3 border-2 border-[var(--gt-border-strong)] bg-[var(--gt-surface-canvas)] p-4">
          <h3 className="text-sm font-black uppercase italic tracking-normal">{zh ? '开启' : 'On'}</h3>
          <SwitchSample initial />
        </section>
        <section className="grid min-h-[8rem] content-center gap-3 border-2 border-[var(--gt-border-strong)] bg-[var(--gt-surface-canvas)] p-4">
          <h3 className="text-sm font-black uppercase italic tracking-normal">{zh ? '禁用' : 'Disabled'}</h3>
          <SwitchSample disabled />
        </section>
      </div>
    </div>
  );
}

export const Overview: Story = {
  parameters: {
    layout: 'fullscreen',
  },
  render: () => <ToggleSwitchOverview />,
};

export const Off: Story = {
  render: () => <SwitchSample />,
};

export const On: Story = {
  render: () => <SwitchSample initial />,
};

export const Disabled: Story = {
  render: () => <SwitchSample disabled />,
};
