import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import SettingsReleasePanel from './SettingsReleasePanel';

const meta: Meta<typeof SettingsReleasePanel> = {
  title: 'Design System/业务组件/设置更新面板',
  component: SettingsReleasePanel,
  parameters: {
    layout: 'padded',
  },
};

export default meta;

type Story = StoryObj<typeof SettingsReleasePanel>;

const baseProps = {
  currentVersionTitle: '当前版本',
  currentVersionLabel: '0.2.1',
  gitHashTitle: 'Git Hash',
  gitHashLabel: '960ebd9fd83f',
  cliProxyApiGitHashTitle: 'CLIProxyAPI Git Hash',
  cliProxyApiGitHashLabel: '7f1c2d9',
  latestReleaseTitle: '最新版本',
  latestReleaseLabel: '0.2.2',
  latestReleaseGitHubURL: 'https://github.com/AxApp/GetTokens/releases/tag/v0.2.2',
  currentReleaseGitHubURL: 'https://github.com/AxApp/GetTokens/releases/tag/v0.2.1',
  gitHashGitHubURL: 'https://github.com/AxApp/GetTokens/commit/960ebd9fd83f',
  cliProxyApiGitHashGitHubURL: 'https://github.com/AxApp/CLIProxyAPI/commit/7f1c2d9',
  openGitHubLabel: '打开 GitHub',
  onOpenGitHubURL: () => undefined,
  updateMessage: '',
  checkUpdateLabel: '检查更新',
  checkingUpdateLabel: '检查中',
  isCheckingUpdate: false,
  onCheckUpdate: () => undefined,
  showPrimaryUpdateAction: true,
  primaryUpdateLabel: '应用更新',
  primaryUpdateDisabled: false,
  onPrimaryUpdateAction: () => undefined,
  updateActionHint: '保留当前版本、构建批次、app 源码 hash 与 CLIProxyAPI hash，便于复现发布包。',
} satisfies ComponentProps<typeof SettingsReleasePanel>;

function ReleasePanelSample({
  label,
  props,
}: {
  label: string;
  props?: Partial<ComponentProps<typeof SettingsReleasePanel>>;
}) {
  return (
    <DesignSystemStoryFrame label={label}>
      <SettingsReleasePanel {...baseProps} {...props} />
    </DesignSystemStoryFrame>
  );
}

export const Overview: Story = {
  render: () => (
    <div className="grid gap-5">
      <ReleasePanelSample label="DS-SETTINGS-RELEASE-READY" />
      <ReleasePanelSample
        label="DS-SETTINGS-RELEASE-CHECKING"
        props={{
          latestReleaseLabel: '—',
          isCheckingUpdate: true,
          primaryUpdateDisabled: true,
          updateMessage: '正在检查 GitHub Releases。',
        }}
      />
      <ReleasePanelSample
        label="DS-SETTINGS-RELEASE-NATIVE"
        props={{
          showPrimaryUpdateAction: false,
          updateActionHint: '点击检查更新会唤起系统更新界面。',
          updateMessage: '已调用原生更新器。',
        }}
      />
    </div>
  ),
};

export const Ready: Story = {
  render: () => <ReleasePanelSample label="DS-SETTINGS-RELEASE-READY" />,
};
