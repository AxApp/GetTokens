export interface BusinessDesignSystemPreviewCatalogEntry {
  id: string;
  title: string;
  description: string;
  sourcePath: string;
  states: readonly string[];
}

export const businessDesignSystemPreviewCatalog = [
  {
    id: 'session-plugin-console',
    title: '会话插件控制台',
    description: '会话插件宿主的业务控制台样板，覆盖插件注册表、执行状态、作用域、队列和输出。',
    sourcePath: 'frontend/src/features/session-management/components/SessionPluginConsolePanel.tsx',
    states: ['ready', 'running', 'done'],
  },
  {
    id: 'account-detail-primitives',
    title: '账号详情原语',
    description: 'AccountDetailPrimitives 组件预览：Section、StatGrid、Pill、Notice、EmptyState、EvidenceGrid。',
    sourcePath: 'frontend/src/features/accounts/components/AccountDetailPrimitives.tsx',
    states: ['default', 'with-actions', 'empty'],
  },
] as const satisfies readonly BusinessDesignSystemPreviewCatalogEntry[];

export function getBusinessDesignSystemPreviewStats(
  previews: readonly BusinessDesignSystemPreviewCatalogEntry[] = businessDesignSystemPreviewCatalog,
) {
  return {
    previewCount: previews.length,
    stateCount: previews.reduce((sum, preview) => sum + preview.states.length, 0),
  };
}
