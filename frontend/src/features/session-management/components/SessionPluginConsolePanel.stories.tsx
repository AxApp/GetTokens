import type { Meta, StoryObj } from '@storybook/react-vite';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import SessionPluginConsolePanel from './SessionPluginConsolePanel';
import type {
  SessionPluginConsoleMode,
  SessionPluginConsolePanelProps,
} from './SessionPluginConsolePanel';

const meta = {
  title: 'Design System/业务组件/会话插件控制台',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const commonConsoleProps: Omit<SessionPluginConsolePanelProps, 'mode' | 'execution'> = {
  pluginHostTitle: '会话插件',
  pluginHostSubtitle: 'CODEX / SESSION MANAGEMENT / 426 sessions / 19 projects',
  pluginHint: '会话深度分析作为第一个内置插件，后续复盘、对比和导出复用同一宿主协议。',
  refreshLabel: '刷新',
  runLabel: '运行当前插件',
  currentProjectLabel: 'current project',
  actionStatusLabel: 'status',
  pluginListTitle: '插件注册表',
  scopeTitle: '分析作用域',
  executionTitle: '执行状态',
  sessionsTitle: '会话列表',
  queueTitle: '执行队列',
  outputTitle: '插件输出',
  metricsTitle: '摘要指标',
  keywordsTitle: '关键词',
  topicsTitle: '主题线索',
  plugins: [
    {
      id: 'analysis',
      icon: '分',
      name: '会话深度分析',
      description: 'jieba keywords, roles, topics',
      tags: ['内置', 'Go', '批量'],
      active: true,
    },
    {
      id: 'review',
      icon: '复',
      name: '行动项复盘',
      description: 'decisions and next steps',
      tags: ['草案', 'LLM'],
    },
    {
      id: 'compare',
      icon: '比',
      name: '项目对比',
      description: 'topic drift between projects',
      tags: ['草案', '趋势'],
    },
    {
      id: 'export',
      icon: '导',
      name: '归档导出',
      description: 'markdown bundle and evidence pack',
      tags: ['未启用'],
      disabled: true,
    },
  ],
  scopes: [
    {
      id: 'project',
      title: '当前项目',
      subtitle: 'GetTokens / 86 sessions',
      active: true,
    },
    {
      id: 'recent',
      title: '最近 20 条',
      subtitle: 'visible sessions slice',
    },
    {
      id: 'all',
      title: '全部会话',
      subtitle: '426 sessions, async batch',
    },
  ],
  sessions: [
    {
      id: 'session-space',
      title: '整理 session-management 插件系统',
      metadata: '2026-05-28 / codex / docs + Go analysis',
      score: '96',
      selected: true,
    },
    {
      id: 'session-jieba',
      title: 'jieba 批量分析接入',
      metadata: '2026-05-28 / Go side / keywords, roles, spread',
      score: '91',
      selected: true,
    },
    {
      id: 'session-import',
      title: '账号导入统一弹窗',
      metadata: '2026-05-28 / unrelated workspace / ignored scope',
      score: '44',
    },
    {
      id: 'session-plugin',
      title: '插件注册表和执行状态模型讨论',
      metadata: '2026-05-28 / roadmap / host protocol',
      score: '88',
      selected: true,
    },
  ],
  queue: [
    {
      id: 'queue-analysis',
      title: '深度分析',
      detail: 'scope=current project, limit=86',
      tone: 'blue',
      active: true,
    },
    {
      id: 'queue-cache',
      title: '结果缓存',
      detail: 'waiting for stable cache key',
      tone: 'orange',
    },
    {
      id: 'queue-review',
      title: '复盘插件',
      detail: 'disabled until contract lands',
      tone: 'green',
    },
  ],
  metrics: [
    { value: '86', label: 'sessions analyzed', meta: 'current project' },
    { value: '9.4k', label: 'messages scanned', meta: 'jsonl detail scan' },
    { value: '312', label: 'keywords kept', meta: 'stop words removed' },
    { value: '7', label: 'topic clusters', meta: 'reviewable hints' },
  ],
  keywords: [
    { term: '插件系统', width: 96 },
    { term: '会话分析', width: 88 },
    { term: 'jieba 分词', width: 78 },
    { term: '执行状态', width: 72 },
    { term: '结果缓存', width: 61 },
    { term: 'space 治理', width: 48 },
  ],
  topics: [
    {
      title: 'Go 侧批处理优先',
      summary: '批量会话分析不适合放在前端 runtime 中长期占用线程。',
    },
    {
      title: '插件宿主统一入口',
      summary: '会话列表、详情、选择作用域和执行队列由宿主负责。',
    },
    {
      title: '一期先让深度分析成型',
      summary: '后续插件复用相同输入输出结构，不重写会话管理面板。',
    },
  ],
};

const executions: Record<SessionPluginConsoleMode, SessionPluginConsolePanelProps['execution']> = {
  ready: {
    dialLabel: '0%',
    progress: 0,
    headline: '等待输入',
    detail: '预计样本 86 sessions',
    footer: 'plugin: session-analysis',
  },
  running: {
    dialLabel: '64%',
    progress: 64,
    headline: '分词聚合',
    detail: '277 / 426 sessions scanned',
    footer: '可取消任务，原会话列表继续可读',
  },
  done: {
    dialLabel: '100%',
    progress: 100,
    headline: '完成',
    detail: 'generated at 14:33:08',
    footer: '缓存键 scope/project',
    tone: 'green',
  },
};

function buildConsoleProps(mode: SessionPluginConsoleMode): SessionPluginConsolePanelProps {
  return {
    ...commonConsoleProps,
    mode,
    execution: executions[mode],
    actionStatusLabel: mode,
  };
}

function ConsoleSample({ label, mode }: { label: string; mode: SessionPluginConsoleMode }) {
  return (
    <DesignSystemStoryFrame label={label}>
      <div className="min-w-0 bg-[var(--bg-surface)] p-5">
        <SessionPluginConsolePanel {...buildConsoleProps(mode)} />
      </div>
    </DesignSystemStoryFrame>
  );
}

function SessionPluginConsoleOverview() {
  return (
    <div className="grid gap-6 bg-[var(--bg-surface)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">会话插件控制台</h2>
        <p className="mt-2 max-w-4xl text-[length:var(--font-size-ui-md)] font-bold leading-relaxed text-[var(--text-muted)]">
          会话插件控制台把插件注册表、分析作用域、执行状态、会话选择、队列和结果输出收敛到一个业务组件，用于后续替换 session-management 的临时分析面板。
        </p>
      </div>
      <ConsoleSample label="DS-SESSION-PLUGIN-CONSOLE-READY" mode="ready" />
      <ConsoleSample label="DS-SESSION-PLUGIN-CONSOLE-RUNNING" mode="running" />
      <ConsoleSample label="DS-SESSION-PLUGIN-CONSOLE-DONE" mode="done" />
    </div>
  );
}

export const Overview: Story = {
  render: () => <SessionPluginConsoleOverview />,
};

export const Ready: Story = {
  render: () => <ConsoleSample label="DS-SESSION-PLUGIN-CONSOLE-READY" mode="ready" />,
};

export const Running: Story = {
  render: () => <ConsoleSample label="DS-SESSION-PLUGIN-CONSOLE-RUNNING" mode="running" />,
};

export const Done: Story = {
  render: () => <ConsoleSample label="DS-SESSION-PLUGIN-CONSOLE-DONE" mode="done" />,
};
