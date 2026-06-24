import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Card, Input, Select, Tag } from 'antd';
import { useI18n } from '../../context/I18nContext';

const meta = {
  title: 'Design System/基础样式/AntD 基础样式',
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
    <div className="grid gap-6 bg-[var(--gt-surface-muted)] p-8">
      <Card title={zh ? '按钮' : 'Buttons'}>
        <div className="flex flex-wrap gap-3">
          <Button>
            {zh ? '默认' : 'Default'}
          </Button>
          <Button type="primary">
            {zh ? '主要操作' : 'Primary'}
          </Button>
          <Button danger>
            {zh ? '危险操作' : 'Danger'}
          </Button>
          <Button disabled>
            {zh ? '禁用' : 'Disabled'}
          </Button>
        </div>
      </Card>

      <Card title={zh ? '表单' : 'Forms'}>
        <div className="grid gap-4 md:grid-cols-2">
          <Input value={zh ? 'gettokens.local' : 'gettokens.local'} readOnly />
          <Input value={zh ? '禁用值' : 'disabled value'} disabled readOnly />
          <Select
            defaultValue="codex"
            options={[
              { value: 'codex', label: 'Codex' },
              { value: 'openai-compatible', label: zh ? 'OpenAI 兼容供应商' : 'OpenAI Compatible' },
            ]}
          />
          <Select disabled defaultValue="disabled" options={[{ value: 'disabled', label: zh ? '禁用' : 'Disabled' }]} />
        </div>
      </Card>

      <Card title={zh ? '徽标' : 'Badges'}>
        <div className="flex flex-wrap gap-2">
          <Tag>{zh ? '中性' : 'neutral'}</Tag>
          <Tag color="success">{zh ? '成功' : 'success'}</Tag>
          <Tag color="warning">{zh ? '警告' : 'warning'}</Tag>
          <Tag color="error">{zh ? '危险' : 'danger'}</Tag>
          <Tag color="default">{zh ? '弱化' : 'muted'}</Tag>
        </div>
      </Card>
    </div>
  );
}

export const ControlsAndSurfaces: Story = {
  render: () => <ControlsAndSurfacesSample />,
};
