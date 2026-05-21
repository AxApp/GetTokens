import type { Meta, StoryObj } from '@storybook/react-vite';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import CodexLiveSessionsWorkbench from './CodexLiveSessionsWorkbench';
import {
  codexLiveSessionsEmptySnapshot,
  codexLiveSessionsHighVolumeSnapshot,
  codexLiveSessionsPreviewSnapshot,
  codexLiveSessionsSidecarNotReadySnapshot,
} from '../model/mockData';

const meta = {
  title: 'Design System/业务组件/Codex 运行会话',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Overview: Story = {
  render: () => (
    <DesignSystemStoryFrame label="DS-CODEX-LIVE-SESSIONS">
      <CodexLiveSessionsWorkbench snapshot={codexLiveSessionsPreviewSnapshot} />
    </DesignSystemStoryFrame>
  ),
};

export const ActiveWebsocket: Story = {
  render: () => (
    <DesignSystemStoryFrame label="DS-ACTIVE-WS">
      <CodexLiveSessionsWorkbench
        snapshot={{
          ...codexLiveSessionsPreviewSnapshot,
          sessions: [codexLiveSessionsPreviewSnapshot.sessions[0]],
        }}
      />
    </DesignSystemStoryFrame>
  ),
};

export const Reconnecting: Story = {
  render: () => (
    <DesignSystemStoryFrame label="DS-RECONNECTING">
      <CodexLiveSessionsWorkbench
        snapshot={{
          ...codexLiveSessionsPreviewSnapshot,
          sessions: [codexLiveSessionsPreviewSnapshot.sessions[1]],
        }}
      />
    </DesignSystemStoryFrame>
  ),
};

export const DegradedHttp: Story = {
  render: () => (
    <DesignSystemStoryFrame label="DS-DEGRADED">
      <CodexLiveSessionsWorkbench
        snapshot={{
          ...codexLiveSessionsPreviewSnapshot,
          sessions: [codexLiveSessionsPreviewSnapshot.sessions[2]],
        }}
      />
    </DesignSystemStoryFrame>
  ),
};

export const Failed: Story = {
  render: () => (
    <DesignSystemStoryFrame label="DS-FAILED">
      <CodexLiveSessionsWorkbench
        snapshot={{
          ...codexLiveSessionsPreviewSnapshot,
          sessions: [codexLiveSessionsPreviewSnapshot.sessions[3]],
        }}
      />
    </DesignSystemStoryFrame>
  ),
};

export const SidecarNotReady: Story = {
  render: () => (
    <DesignSystemStoryFrame label="DS-SIDECAR-NOT-READY">
      <CodexLiveSessionsWorkbench snapshot={codexLiveSessionsSidecarNotReadySnapshot} />
    </DesignSystemStoryFrame>
  ),
};

export const Empty: Story = {
  render: () => (
    <DesignSystemStoryFrame label="DS-EMPTY">
      <CodexLiveSessionsWorkbench snapshot={codexLiveSessionsEmptySnapshot} />
    </DesignSystemStoryFrame>
  ),
};

export const HighVolume: Story = {
  render: () => (
    <DesignSystemStoryFrame label="DS-HIGH-VOLUME">
      <CodexLiveSessionsWorkbench snapshot={codexLiveSessionsHighVolumeSnapshot} />
    </DesignSystemStoryFrame>
  ),
};

export const RedactedDiagnostic: Story = {
  render: () => (
    <DesignSystemStoryFrame label="DS-REDACTED">
      <CodexLiveSessionsWorkbench
        snapshot={{
          ...codexLiveSessionsPreviewSnapshot,
          sessions: [codexLiveSessionsPreviewSnapshot.sessions[3]],
        }}
      />
    </DesignSystemStoryFrame>
  ),
};
