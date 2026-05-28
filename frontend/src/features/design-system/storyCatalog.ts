export interface DesignSystemStory {
  id: string;
  title: string;
  storybookTitle: string;
  path: string;
}

export interface DesignSystemStoryGroup {
  id: string;
  title: string;
  description: string;
  stories: readonly DesignSystemStory[];
}

export const DESIGN_SYSTEM_STORYBOOK_PORT = 6006;
export const DESIGN_SYSTEM_STORYBOOK_URL = `http://127.0.0.1:${DESIGN_SYSTEM_STORYBOOK_PORT}`;
export const DESIGN_SYSTEM_STORYBOOK_DEV_OPEN_PATH = '/__dev/design-system/storybook/open';
export const DESIGN_SYSTEM_WEB_FRAME_HASH = '#frame=design-system';
export const DESIGN_SYSTEM_INSPECT_QUERY_PARAM = 'inspect';
export const DESIGN_SYSTEM_INSPECT_QUERY_VALUE = 'design-system';
export const DESIGN_SYSTEM_STORYBOOK_COMMAND = 'npm --prefix frontend run storybook';
export const DESIGN_SYSTEM_SCREENSHOT_PATH =
  'docs-linhay/spaces/20260519-design-system-workbench/screenshots/20260519/design-system/20260519-design-system-storybook-web-after-v01.png';

export function resolveDesignSystemStorybookOpenURL(input?: {
  dev?: boolean;
  origin?: string;
}) {
  const dev = input?.dev ?? ((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true);
  if (!dev) {
    return DESIGN_SYSTEM_STORYBOOK_URL;
  }

  return `${resolveDesignSystemDevServerOrigin(input?.origin)}${DESIGN_SYSTEM_STORYBOOK_DEV_OPEN_PATH}`;
}

export function resolveDesignSystemWebOpenURL(input?: {
  origin?: string;
}) {
  const origin = resolveDesignSystemDevServerOrigin(input?.origin);
  if (!origin) {
    return `/${DESIGN_SYSTEM_WEB_FRAME_HASH}`;
  }
  return `${origin}/${DESIGN_SYSTEM_WEB_FRAME_HASH}`;
}

export function resolveDesignSystemInspectOpenURL(input?: {
  origin?: string;
}) {
  const origin = resolveDesignSystemDevServerOrigin(input?.origin);
  const inspectQuery = `?${DESIGN_SYSTEM_INSPECT_QUERY_PARAM}=${DESIGN_SYSTEM_INSPECT_QUERY_VALUE}`;
  if (!origin) {
    return `/${inspectQuery}${DESIGN_SYSTEM_WEB_FRAME_HASH}`;
  }
  return `${origin}/${inspectQuery}${DESIGN_SYSTEM_WEB_FRAME_HASH}`;
}

function resolveDesignSystemDevServerOrigin(origin = '') {
  if (!origin) {
    return '';
  }

  try {
    const url = new URL(origin);
    if (url.protocol === 'wails:' && url.port) {
      return `http://127.0.0.1:${url.port}`;
    }
    return url.origin;
  } catch {
    return origin;
  }
}

export const designSystemStoryGroups = [
  {
    id: 'tokens',
    title: '令牌',
    description: 'GetTokens UI 使用的颜色、字体、间距、边框和阴影令牌。',
    stories: [
      {
        id: 'color-tokens',
        title: '颜色令牌',
        storybookTitle: 'Design System/令牌/颜色',
        path: 'frontend/src/stories/tokens/ColorTokens.stories.tsx',
      },
      {
        id: 'typography-tokens',
        title: '字体令牌',
        storybookTitle: 'Design System/令牌/字体',
        path: 'frontend/src/stories/tokens/TypographyTokens.stories.tsx',
      },
    ],
  },
  {
    id: 'primitives',
    title: '基础样式',
    description: '定义产品视觉材料语言的 Swiss 基础 class。',
    stories: [
      {
        id: 'swiss-primitives',
        title: '瑞士风基础样式',
        storybookTitle: 'Design System/基础样式/瑞士风基础样式',
        path: 'frontend/src/stories/primitives/SwissPrimitives.stories.tsx',
      },
    ],
  },
  {
    id: 'components',
    title: '通用组件',
    description: '位于 frontend/src/components/ui 的可复用 React 组件。',
    stories: [
      {
        id: 'segmented-control',
        title: '分段控制',
        storybookTitle: 'Design System/通用组件/分段控制',
        path: 'frontend/src/components/ui/SegmentedControl.stories.tsx',
      },
      {
        id: 'asset-workbench-shell',
        title: '资产工作台框架',
        storybookTitle: 'Design System/通用组件/资产工作台框架',
        path: 'frontend/src/components/ui/AssetWorkbenchShell.stories.tsx',
      },
      {
        id: 'toggle-switch',
        title: '开关',
        storybookTitle: 'Design System/通用组件/开关',
        path: 'frontend/src/components/ui/ToggleSwitch.stories.tsx',
      },
      {
        id: 'action-select',
        title: '操作选择',
        storybookTitle: 'Design System/通用组件/操作选择',
        path: 'frontend/src/components/ui/ActionSelect.stories.tsx',
      },
      {
        id: 'form-field',
        title: '表单字段',
        storybookTitle: 'Design System/通用组件/表单字段',
        path: 'frontend/src/components/ui/FormField.stories.tsx',
      },
      {
        id: 'modal-frame',
        title: '弹窗窗口',
        storybookTitle: 'Design System/通用组件/弹窗窗口',
        path: 'frontend/src/components/ui/ModalFrame.stories.tsx',
      },
      {
        id: 'combobox',
        title: '组合框',
        storybookTitle: 'Design System/通用组件/组合框',
        path: 'frontend/src/components/ui/Combobox.stories.tsx',
      },
      {
        id: 'search-input',
        title: '搜索输入',
        storybookTitle: 'Design System/通用组件/搜索输入',
        path: 'frontend/src/components/ui/SearchInput.stories.tsx',
      },
      {
        id: 'snippet-pre',
        title: '代码片段区域',
        storybookTitle: 'Design System/通用组件/代码片段区域',
        path: 'frontend/src/components/ui/SnippetPre.stories.tsx',
      },
      {
        id: 'workspace-page-header',
        title: '工作区页头',
        storybookTitle: 'Design System/通用组件/工作区页头',
        path: 'frontend/src/components/ui/WorkspacePageHeader.stories.tsx',
      },
      {
        id: 'page-loading-fallback',
        title: '页面加载态',
        storybookTitle: 'Design System/通用组件/页面加载态',
        path: 'frontend/src/components/ui/PageLoadingFallback.stories.tsx',
      },
    ],
  },
  {
    id: 'feature-components',
    title: '业务组件',
    description: '已用 mock 数据纳入 5173 应用开发态设计系统的业务级组件。',
    stories: [
      {
        id: 'debug-panel-components',
        title: '调试面板组件',
        storybookTitle: 'Design System/业务组件/调试面板',
        path: 'frontend/src/features/debug/components/DebugPanelComponents.stories.tsx',
      },
      {
        id: 'codex-binary-components',
        title: 'Codex 二进制组件',
        storybookTitle: 'Design System/业务组件/Codex 二进制',
        path: 'frontend/src/features/codex-binary/components/CodexBinaryComponents.stories.tsx',
      },
      {
        id: 'account-card-components',
        title: '账号卡片组件',
        storybookTitle: 'Design System/业务组件/账号卡片',
        path: 'frontend/src/features/accounts/components/AccountCardComponents.stories.tsx',
      },
      {
        id: 'accounts-header-components',
        title: '账号页头组件',
        storybookTitle: 'Design System/业务组件/账号页头',
        path: 'frontend/src/features/accounts/components/AccountsHeaderComponents.stories.tsx',
      },
      {
        id: 'accounts-toolbar-components',
        title: '账号工具栏组件',
        storybookTitle: 'Design System/业务组件/账号工具栏',
        path: 'frontend/src/features/accounts/components/AccountsToolbarComponents.stories.tsx',
      },
      {
        id: 'accounts-list-components',
        title: '账号列表组件',
        storybookTitle: 'Design System/业务组件/账号列表',
        path: 'frontend/src/features/accounts/components/AccountsListComponents.stories.tsx',
      },
      {
        id: 'account-group-section-components',
        title: '账号分组组件',
        storybookTitle: 'Design System/业务组件/账号分组',
        path: 'frontend/src/features/accounts/components/AccountGroupSectionComponents.stories.tsx',
      },
      {
        id: 'account-proxy-route',
        title: '账号代理出口',
        storybookTitle: 'Design System/业务组件/账号代理出口',
        path: 'frontend/src/features/accounts/components/AccountProxyRouteSection.stories.tsx',
      },
      {
        id: 'rate-limit-rules',
        title: '限流规则',
        storybookTitle: 'Design System/业务组件/限流规则',
        path: 'frontend/src/features/accounts/components/RateLimitRulesSection.stories.tsx',
      },
      {
        id: 'openai-compatible-components',
        title: 'OpenAI 兼容组件',
        storybookTitle: 'Design System/业务组件/OpenAI 兼容',
        path: 'frontend/src/features/accounts/components/OpenAICompatibleComponents.stories.tsx',
      },
      {
        id: 'status-relay-editors',
        title: '状态页 Relay 编辑器',
        storybookTitle: 'Design System/业务组件/状态页 Relay 编辑器',
        path: 'frontend/src/features/status/components/StatusRelayEditors.stories.tsx',
      },
      {
        id: 'status-codex-features',
        title: '状态页 Codex 功能',
        storybookTitle: 'Design System/业务组件/状态页 Codex 功能',
        path: 'frontend/src/features/status/components/StatusCodexFeaturesSection.stories.tsx',
      },
      {
        id: 'status-codex-root-settings',
        title: '状态页 Codex Root Settings',
        storybookTitle: 'Design System/业务组件/状态页 Codex Root Settings',
        path: 'frontend/src/features/status/components/StatusCodexRootSettingsSection.stories.tsx',
      },
      {
        id: 'status-codex-model-providers',
        title: '状态页 Codex Model Providers',
        storybookTitle: 'Design System/业务组件/状态页 Codex Model Providers',
        path: 'frontend/src/features/status/components/StatusCodexModelProvidersSection.stories.tsx',
      },
      {
        id: 'status-codex-notices',
        title: '状态页 Codex Notices',
        storybookTitle: 'Design System/业务组件/状态页 Codex Notices',
        path: 'frontend/src/features/status/components/StatusCodexNoticeSection.stories.tsx',
      },
      {
        id: 'status-local-cli-apply',
        title: '状态页本地 CLI 应用',
        storybookTitle: 'Design System/业务组件/状态页本地 CLI 应用',
        path: 'frontend/src/features/status/components/StatusLocalCliApplyPanel.stories.tsx',
      },
      {
        id: 'status-snippet-panel',
        title: '状态页片段面板',
        storybookTitle: 'Design System/业务组件/状态页片段面板',
        path: 'frontend/src/features/status/components/StatusSnippetPanel.stories.tsx',
      },
      {
        id: 'settings-release-panel',
        title: '设置更新面板',
        storybookTitle: 'Design System/业务组件/设置更新面板',
        path: 'frontend/src/features/settings/components/SettingsReleasePanel.stories.tsx',
      },
      {
        id: 'usage-desk-components',
        title: '用量工作台组件',
        storybookTitle: 'Design System/业务组件/用量工作台',
        path: 'frontend/src/features/accounts/components/usage-desk/UsageDeskComponents.stories.tsx',
      },
      {
        id: 'account-modal-components',
        title: '账号弹窗组件',
        storybookTitle: 'Design System/业务组件/账号弹窗',
        path: 'frontend/src/features/accounts/components/AccountModalComponents.stories.tsx',
      },
      {
        id: 'codex-route-probe',
        title: 'Codex 路由探测',
        storybookTitle: 'Design System/业务组件/Codex 路由探测',
        path: 'frontend/src/features/codex/components/CodexRouteProbeCard.stories.tsx',
      },
      {
        id: 'codex-live-sessions-components',
        title: 'Codex 运行会话',
        storybookTitle: 'Design System/业务组件/Codex 运行会话',
        path: 'frontend/src/features/codex-live-sessions/components/CodexLiveSessionsComponents.stories.tsx',
      },
      {
        id: 'claude-code-account-list-components',
        title: 'Claude Code 账号列表组件',
        storybookTitle: 'Design System/业务组件/Claude Code 账号列表',
        path: 'frontend/src/features/claude-code/components/ClaudeCodeAccountListWorkbench.stories.tsx',
      },
      {
        id: 'claude-code-asset-workbench',
        title: 'Claude Code 资产工作台',
        storybookTitle: 'Design System/业务组件/Claude Code 资产工作台',
        path: 'frontend/src/features/claude-code/components/ClaudeCodeAssetWorkbench.stories.tsx',
      },
      {
        id: 'claude-code-subagent-catalog',
        title: 'Claude Code Subagent Catalog',
        storybookTitle: 'Design System/业务组件/Claude Code Subagent Catalog',
        path: 'frontend/src/features/claude-code/components/ClaudeCodeSubagentCatalog.stories.tsx',
      },
      {
        id: 'claude-code-memory-files-panel',
        title: 'Claude Code Memory Files Panel',
        storybookTitle: 'Design System/业务组件/Claude Code Memory Files Panel',
        path: 'frontend/src/features/claude-code/components/ClaudeCodeMemoryFilesPanel.stories.tsx',
      },
      {
        id: 'claude-code-settings-scope-stack',
        title: 'Claude Code Settings Scope Stack',
        storybookTitle: 'Design System/业务组件/Claude Code Settings Scope Stack',
        path: 'frontend/src/features/claude-code/components/ClaudeCodeSettingsScopeStack.stories.tsx',
      },
      {
        id: 'account-rotation-components',
        title: '账号轮换组件',
        storybookTitle: 'Design System/业务组件/账号轮换',
        path: 'frontend/src/features/accounts/components/account-rotation/AccountRotationComponents.stories.tsx',
      },
      {
        id: 'codex-account-order-components',
        title: 'Codex 账号顺序组件',
        storybookTitle: 'Design System/业务组件/Codex 账号顺序',
        path: 'frontend/src/features/codex/components/CodexAccountOrderComponents.stories.tsx',
      },
    ],
  },
] as const satisfies readonly DesignSystemStoryGroup[];

export function flattenDesignSystemStories(
  groups: readonly DesignSystemStoryGroup[] = designSystemStoryGroups,
): DesignSystemStory[] {
  return groups.flatMap((group) => [...group.stories]);
}

export function getDesignSystemStoryStats(
  groups: readonly DesignSystemStoryGroup[] = designSystemStoryGroups,
) {
  return {
    groupCount: groups.length,
    storyCount: flattenDesignSystemStories(groups).length,
  };
}
