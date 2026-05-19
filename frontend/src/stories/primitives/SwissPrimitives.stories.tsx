import type { Meta, StoryObj } from '@storybook/react-vite';
import { useI18n } from '../../context/I18nContext';

const meta = {
  title: 'Design System/基础样式/瑞士风基础样式',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function ControlsAndSurfacesSample() {
  const { locale } = useI18n();
  const zh = locale === 'zh';
  return (
    <div className="grid gap-6 bg-[var(--bg-surface)] p-8">
      <section className="card-swiss grid gap-4">
        <h3 className="text-xl font-black uppercase italic tracking-normal">{zh ? '按钮' : 'Buttons'}</h3>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-swiss">
            {zh ? '默认' : 'Default'}
          </button>
          <button type="button" className="btn-swiss bg-[var(--border-color)] !text-[var(--bg-main)]">
            {zh ? '主要操作' : 'Primary'}
          </button>
          <button type="button" className="btn-swiss !border-[var(--accent-red)] !text-[var(--accent-red)]">
            {zh ? '危险操作' : 'Danger'}
          </button>
          <button type="button" className="btn-swiss disabled:cursor-not-allowed disabled:opacity-50" disabled>
            {zh ? '禁用' : 'Disabled'}
          </button>
        </div>
      </section>

      <section className="card-swiss grid gap-4">
        <h3 className="text-xl font-black uppercase italic tracking-normal">{zh ? '表单' : 'Forms'}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <input className="input-swiss" value={zh ? 'gettokens.local' : 'gettokens.local'} readOnly />
          <input className="input-swiss opacity-50" value={zh ? '禁用值' : 'disabled value'} disabled readOnly />
          <select className="select-swiss" defaultValue="codex">
            <option value="codex">Codex</option>
            <option value="openai-compatible">{zh ? 'OpenAI 兼容供应商' : 'OpenAI Compatible'}</option>
          </select>
          <select className="select-swiss opacity-50" disabled defaultValue="disabled">
            <option value="disabled">{zh ? '禁用' : 'Disabled'}</option>
          </select>
        </div>
      </section>

      <section className="card-swiss grid gap-3">
        <h3 className="text-xl font-black uppercase italic tracking-normal">{zh ? '徽标' : 'Badges'}</h3>
        <div className="flex flex-wrap gap-2">
          {[
            ['neutral', '中性'],
            ['success', '成功'],
            ['warning', '警告'],
            ['danger', '危险'],
            ['muted', '弱化'],
          ].map(([tone, zhTone]) => (
            <span
              key={tone}
              className={`border-2 px-2 py-1 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase ${
                tone === 'danger'
                  ? 'border-[var(--accent-red)] text-[var(--accent-red)]'
                  : tone === 'success'
                    ? 'border-[var(--color-status-success)] text-[var(--color-status-success)]'
                    : tone === 'warning'
                      ? 'border-[var(--color-status-warning)] text-[var(--color-status-warning)]'
                      : 'border-[var(--border-color)] text-[var(--text-primary)]'
              }`}
            >
              {zh ? zhTone : tone}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

export const ControlsAndSurfaces: Story = {
  render: () => <ControlsAndSurfacesSample />,
};
