import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { ApplyRequestOrchestration, RestoreRequestOrchestration, SaveRequestOrchestrationConfig } from '../../../wailsjs/go/main/App';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import { useI18n } from '../../context/I18nContext';
import type { SidecarStatus } from '../../types';
import { hasWailsAppBindings } from '../../utils/previewMode';
import useRequestOrchestrationData from './hooks/useRequestOrchestrationData';
import {
  buildFlowTest,
  cloneRequestFlows,
  computeRequestAccount,
  enableProxyPoolForFlowAccount,
  getCompatibleAccountsForGroup,
  getCurrentAccount,
  getUsableAccountsForGroup,
  getVisibleRoutesForAccount,
  initialRequestFlows,
  persistRequestAccountOverrides,
  persistRequestFlows,
  readStoredRequestAccountOverrides,
  readStoredRequestFlows,
  reconcileRequestFlows,
  requestEntries,
  selectFirstCompatibleAccount,
  toggleFlowAccountEnabled,
  type ComputedRequestAccount,
  type RequestAccount,
  type RequestAccountOverrides,
  type RequestFlow,
} from './model';

const copy = {
  zh: {
    title: '请求编排',
    subtitle: 'APP 层请求路径 / 入口 / 账号 / 出口 / 测试',
    newFlow: '+ 自定义组',
    cloneFlow: '复制当前',
    deleteFlow: '删除当前',
    applyFlow: '应用当前组',
    reset: '恢复默认',
    expand: '展开',
    collapse: '收起',
    unapplied: '未应用',
    applied: '已应用',
    pending: '待测试',
    accepted: '测试通过',
    blocked: '测试未通过',
    ready: '可用',
    unavailable: '灰态',
    direct: '直连',
    proxy: '代理',
    entryPanel: '1. 请求入口',
    entryHint: '只选 CLI。',
    accountPanel: '2. 账号',
    accountHint: '先选组，再选账号；代理开关跟着账号走。',
    exitPanel: '3. 出口与测试',
    exitHint: '当前账号的出口和连通性。',
    accountGroup: '账号组',
    account: '账号',
    currentAccount: '当前账号',
    testConfig: '测试配置',
    runTest: '测试当前流程组',
    enableProxy: '启用代理池',
    disableProxy: '关闭代理池',
    enableAccount: '启用账号资产',
    disableAccount: '禁用账号资产',
    included: '参与',
    excluded: '排除',
    checkedAccounts: '已勾选',
    usableAccounts: '可用',
    noAccount: '无可用账号',
    noProxyRoutes: '当前没有可用代理出口',
    proxyLocked: '启用账号代理池后再选择代理出口',
    cannotApply: '当前链路不可应用',
    appliedAction: '已应用当前组',
    newAction: '已新建流程组',
    clonedAction: '已复制流程组',
    entryAction: '已切换入口',
    groupAction: '已切换账号组',
    accountAction: '已选择账号',
    routeAction: '已更新账号出口',
    proxyOnAction: '已启用账号代理池',
    proxyOffAction: '已关闭账号代理池',
    accountOnAction: '已启用账号',
    accountOffAction: '已禁用账号',
    renamedAction: '已重命名流程组',
    refreshData: '刷新数据',
    sourceLive: '真实数据',
    sourcePreview: '预览数据',
    sourceBlocked: '等待 sidecar',
    sourceError: '读取失败',
    applying: '应用中',
    restoring: '恢复中',
    previewApplyMessage: '预览模式仅标记 APP 层状态',
    applySuccessMessage: '已写入请求编排快照并应用账号参与状态',
    restoreSuccessMessage: '已按请求编排快照恢复账号参与状态',
  },
  en: {
    title: 'Request Orchestration',
    subtitle: 'APP-layer route / entry / account / exit / test',
    newFlow: '+ Custom',
    cloneFlow: 'Clone',
    deleteFlow: 'Delete',
    applyFlow: 'Apply Flow',
    reset: 'Reset',
    expand: 'Expand',
    collapse: 'Collapse',
    unapplied: 'Unapplied',
    applied: 'Applied',
    pending: 'Pending',
    accepted: 'Passed',
    blocked: 'Blocked',
    ready: 'Ready',
    unavailable: 'Muted',
    direct: 'Direct',
    proxy: 'Proxy',
    entryPanel: '1. Entry',
    entryHint: 'Choose CLI only.',
    accountPanel: '2. Account',
    accountHint: 'Choose group and account; proxy pool follows the account.',
    exitPanel: '3. Exit & Test',
    exitHint: 'Current account exit and connectivity.',
    accountGroup: 'Account Group',
    account: 'Account',
    currentAccount: 'Current Account',
    testConfig: 'Test',
    runTest: 'Test Current Flow',
    enableProxy: 'Enable Proxy Pool',
    disableProxy: 'Disable Proxy Pool',
    enableAccount: 'Enable Account Asset',
    disableAccount: 'Disable Account Asset',
    included: 'Included',
    excluded: 'Excluded',
    checkedAccounts: 'Checked',
    usableAccounts: 'Usable',
    noAccount: 'No Account',
    noProxyRoutes: 'No available proxy exits',
    proxyLocked: 'Enable account proxy pool to choose proxy exits',
    cannotApply: 'Current route cannot be applied',
    appliedAction: 'Current flow applied',
    newAction: 'Flow created',
    clonedAction: 'Flow cloned',
    entryAction: 'Entry switched',
    groupAction: 'Group switched',
    accountAction: 'Account selected',
    routeAction: 'Exit updated',
    proxyOnAction: 'Proxy pool enabled',
    proxyOffAction: 'Proxy pool disabled',
    accountOnAction: 'Account enabled',
    accountOffAction: 'Account disabled',
    renamedAction: 'Flow renamed',
    refreshData: 'Refresh',
    sourceLive: 'Live Data',
    sourcePreview: 'Preview Data',
    sourceBlocked: 'Waiting Sidecar',
    sourceError: 'Load Failed',
    applying: 'Applying',
    restoring: 'Restoring',
    previewApplyMessage: 'Preview mode only marks APP-layer state',
    applySuccessMessage: 'Request orchestration snapshot saved and account participation applied',
    restoreSuccessMessage: 'Request orchestration snapshot restored',
  },
} as const;

type RequestOrchestrationCopy = { [K in keyof typeof copy.zh]: string };

function statusLabel(flow: RequestFlow, c: RequestOrchestrationCopy) {
  if (flow.test?.status === 'accepted') return c.accepted;
  if (flow.test?.status === 'blocked') return c.blocked;
  return c.pending;
}

function statusClass(flow: RequestFlow) {
  if (flow.test?.status === 'accepted') return 'border-[#148247] bg-[#e8f6ee] text-[#148247]';
  if (flow.test?.status === 'blocked') return 'border-[var(--accent-red)] bg-[rgba(239,68,68,0.10)] text-[var(--accent-red)]';
  return 'border-[#8b6400] bg-[#fff3c8] text-[#8b6400]';
}

function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex min-h-[1.375rem] items-center border px-2 font-mono text-[0.625rem] font-black uppercase ${className}`}>
      {children}
    </span>
  );
}

function readInitialFlows(): RequestFlow[] {
  if (typeof window === 'undefined') {
    return cloneRequestFlows(initialRequestFlows);
  }
  return readStoredRequestFlows(window.localStorage) ?? cloneRequestFlows(initialRequestFlows);
}

function readInitialAccountOverrides(): RequestAccountOverrides {
  if (typeof window === 'undefined') {
    return {};
  }
  return readStoredRequestAccountOverrides(window.localStorage);
}

function getNextFlowSerial(flows: readonly RequestFlow[]): number {
  let maxSerial = 1;
  for (const flow of flows) {
    const match = /^custom-flow-(\d+)$/.exec(flow.id);
    if (!match) {
      continue;
    }
    maxSerial = Math.max(maxSerial, Number(match[1]) || 1);
  }
  return maxSerial + 1;
}

function sourceClass(sourceKind: string) {
  if (sourceKind === 'live') return 'border-[#148247] bg-[#e8f6ee] text-[#148247]';
  if (sourceKind === 'error') return 'border-[var(--accent-red)] bg-[rgba(239,68,68,0.10)] text-[var(--accent-red)]';
  if (sourceKind === 'blocked') return 'border-[#8b6400] bg-[#fff3c8] text-[#8b6400]';
  return 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)]';
}

function sourceLabel(sourceKind: string, c: RequestOrchestrationCopy) {
  if (sourceKind === 'live') return c.sourceLive;
  if (sourceKind === 'error') return c.sourceError;
  if (sourceKind === 'blocked') return c.sourceBlocked;
  return c.sourcePreview;
}

function buildBackendConfig(
  flows: readonly RequestFlow[],
  activeFlowID: string | null,
  accountOverrides: RequestAccountOverrides,
) {
  return {
    activeFlowID: activeFlowID ?? '',
    flows: flows.map((flow) => ({
      id: flow.id,
      label: flow.label,
      cli: flow.cli,
      groupID: flow.groupID,
      accountID: flow.accountID ?? '',
      enabledAccountIDs: flow.enabledAccountIDs,
      routes: Object.fromEntries(Object.entries(flow.routes).map(([accountID, routeID]) => [accountID, routeID ?? ''])),
      applied: flow.applied,
      test: flow.test,
    })),
    accountOverrides,
  };
}

function FlowPath({
  flow,
  account,
  groupLabel,
  c,
}: {
  flow: RequestFlow;
  account: ComputedRequestAccount | null;
  groupLabel: string;
  c: RequestOrchestrationCopy;
}) {
  const nodes = [
    { label: '入口', value: flow.cli, tone: 'ok' },
    { label: '账号组', value: groupLabel, tone: 'ok' },
    {
      label: '账号 / 出口',
      value: `${account?.name ?? c.noAccount} -> ${account?.route.label ?? 'none'}`,
      tone: account?.active ? 'ok' : 'warn',
    },
    { label: '测试', value: statusLabel(flow, c), tone: flow.test?.status === 'accepted' ? 'ok' : 'warn' },
  ];

  return (
    <div className="grid grid-cols-4 border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[4px_4px_0_var(--shadow-color)]">
      {nodes.map((node, index) => (
        <div
          key={node.label}
          className={`relative min-w-0 border-l-2 border-[var(--border-color)] p-3 first:border-l-0 ${
            node.tone === 'ok' ? 'bg-[#e8f6ee]' : 'bg-[#fff3c8]'
          }`}
        >
          {index < nodes.length - 1 ? (
            <span className="absolute right-[-0.625rem] top-1/2 z-10 grid h-5 w-5 -translate-y-1/2 place-items-center border-2 border-[var(--border-color)] bg-[var(--bg-main)] font-mono text-[0.5625rem] font-black">
              &gt;
            </span>
          ) : null}
          <div className="font-mono text-[0.625rem] font-black uppercase text-[var(--text-muted)]">{node.label}</div>
          <div className="mt-1 truncate text-sm font-black uppercase text-[var(--text-primary)]">{node.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function RequestOrchestrationFeature({ sidecarStatus }: { sidecarStatus: SidecarStatus }) {
  const { locale } = useI18n();
  const c = copy[locale];
  const data = useRequestOrchestrationData(sidecarStatus);
  const [accountOverrides, setAccountOverrides] = useState<RequestAccountOverrides>(readInitialAccountOverrides);
  const accounts = useMemo(
    () => data.accounts.map((account) => ({ ...account, ...(accountOverrides[account.id] || {}) })),
    [accountOverrides, data.accounts],
  );
  const groups = data.groups;
  const routes = data.routes;
  const [flows, setFlows] = useState<RequestFlow[]>(readInitialFlows);
  const [activeFlowID, setActiveFlowID] = useState<string | null>(null);
  const [mutationState, setMutationState] = useState<'idle' | 'applying' | 'restoring'>('idle');
  const [mutationMessage, setMutationMessage] = useState('');
  const activeFlow = flows.find((flow) => flow.id === activeFlowID) ?? null;

  const activeAccount = useMemo(
    () => (activeFlow ? getCurrentAccount(activeFlow, accounts, routes) : null),
    [accounts, activeFlow, routes],
  );

  useEffect(() => {
    setFlows((current) => reconcileRequestFlows(current, accounts, groups, routes));
  }, [accounts, groups, routes]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    persistRequestFlows(window.localStorage, flows);
  }, [flows]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    persistRequestAccountOverrides(window.localStorage, accountOverrides);
  }, [accountOverrides]);

  const updateFlow = (flowID: string, updater: (flow: RequestFlow) => RequestFlow) => {
    setFlows((current) => current.map((flow) => (flow.id === flowID ? updater(flow) : flow)));
  };

  const invalidate = (flow: RequestFlow): RequestFlow => ({
    ...flow,
    applied: false,
    test: null,
  });

  const createFlow = (source?: RequestFlow) => {
    const serial = String(getNextFlowSerial(flows)).padStart(2, '0');
    const base = source ?? initialRequestFlows[0];
    const nextFlow: RequestFlow = {
      ...cloneRequestFlows([base])[0],
      id: `custom-flow-${serial}`,
      label: source ? `${source.label} 副本 ${serial}` : `自定义组 ${serial}`,
      applied: false,
      test: null,
    };
    setFlows((current) => [...current, nextFlow]);
    setActiveFlowID(nextFlow.id);
  };

  const applyActiveFlow = async () => {
    if (!activeFlow) return;
    if (!activeAccount?.active) {
      updateFlow(activeFlow.id, (flow) => ({ ...flow, applied: false }));
      return;
    }
    if (!hasWailsAppBindings() || data.sourceKind !== 'live') {
      updateFlow(activeFlow.id, (flow) => ({ ...flow, applied: true }));
      setMutationMessage(c.previewApplyMessage);
      return;
    }
    setMutationState('applying');
    setMutationMessage('');
    try {
      const nextFlows = flows.map((flow) => (flow.id === activeFlow.id ? { ...flow, applied: true } : flow));
      await SaveRequestOrchestrationConfig(buildBackendConfig(nextFlows, activeFlow.id, accountOverrides) as any);
      const result = await ApplyRequestOrchestration();
      setFlows(nextFlows);
      setMutationMessage(result.message || c.applySuccessMessage);
      data.refresh();
    } catch (error) {
      setMutationMessage(error instanceof Error ? error.message : String(error));
      updateFlow(activeFlow.id, (flow) => ({ ...flow, applied: false }));
    } finally {
      setMutationState('idle');
    }
  };

  const restoreRequestOrchestration = async () => {
    if (!hasWailsAppBindings() || data.sourceKind !== 'live') {
      setFlows(cloneRequestFlows(initialRequestFlows));
      setAccountOverrides({});
      setActiveFlowID(null);
      setMutationMessage(c.previewApplyMessage);
      return;
    }
    setMutationState('restoring');
    setMutationMessage('');
    try {
      const result = await RestoreRequestOrchestration();
      setFlows((current) => current.map((flow) => ({ ...flow, applied: false, test: null })));
      setMutationMessage(result.message || c.restoreSuccessMessage);
      data.refresh();
    } catch (error) {
      setMutationMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setMutationState('idle');
    }
  };

  const runFlowTest = (flowID: string) => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    updateFlow(flowID, (current) => ({
      ...current,
      test: buildFlowTest(current, getCurrentAccount(current, accounts, routes), time),
    }));
  };

  const groupByID = new Map(groups.map((group) => [group.id, group]));
  const currentGroupLabel = activeFlow ? groupByID.get(activeFlow.groupID)?.label ?? 'none' : 'none';

  return (
    <div className="h-full overflow-auto bg-[var(--bg-surface)] p-6" data-collaboration-id="RO.APP_PAGE">
      <WorkspacePageHeader
        title={c.title}
        subtitle={c.subtitle}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge className={sourceClass(data.sourceKind)}>{sourceLabel(data.sourceKind, c)}</Badge>
            <button
              className="h-10 border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-3 font-mono text-xs font-black uppercase active:scale-95 disabled:opacity-40"
              disabled={data.loading}
              onClick={data.refresh}
              title={data.sourceMessage}
            >
              {data.loading ? '...' : c.refreshData}
            </button>
            <input
              value={activeFlow?.label ?? ''}
              onChange={(event) => {
                if (!activeFlow) return;
                const label = event.target.value.trim() || '未命名流程';
                updateFlow(activeFlow.id, (flow) => invalidate({ ...flow, label }));
              }}
              disabled={!activeFlow}
              className="h-10 w-56 border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-3 font-mono text-xs font-black outline-none disabled:opacity-40"
              aria-label="当前流程组名称"
            />
            <button className="h-10 border-2 border-[var(--border-color)] bg-[var(--border-color)] px-3 font-mono text-xs font-black uppercase text-[var(--bg-main)] active:scale-95" onClick={() => createFlow()}>
              {c.newFlow}
            </button>
            <button
              className="h-10 border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-3 font-mono text-xs font-black uppercase active:scale-95 disabled:opacity-40"
              disabled={!activeFlow}
              onClick={() => activeFlow && createFlow(activeFlow)}
            >
              {c.cloneFlow}
            </button>
            <button
              className="h-10 border-2 border-[var(--border-color)] bg-[#fff3c8] px-3 font-mono text-xs font-black uppercase text-[#8b6400] active:scale-95 disabled:opacity-40"
              disabled={!activeFlow || activeFlow.id === 'default' || flows.length <= 1}
              onClick={() => {
                if (!activeFlow || activeFlow.id === 'default') return;
                setFlows((current) => current.filter((flow) => flow.id !== activeFlow.id));
                setActiveFlowID(null);
              }}
            >
              {c.deleteFlow}
            </button>
            <button
              className="h-10 border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-3 font-mono text-xs font-black uppercase shadow-[4px_4px_0_var(--shadow-color)] active:scale-95"
              disabled={mutationState !== 'idle'}
              onClick={restoreRequestOrchestration}
            >
              {mutationState === 'restoring' ? c.restoring : c.reset}
            </button>
            <button
              className="h-10 border-2 border-[var(--border-color)] bg-[var(--border-color)] px-3 font-mono text-xs font-black uppercase text-[var(--bg-main)] shadow-[4px_4px_0_var(--shadow-color)] active:scale-95 disabled:opacity-40"
              disabled={!activeFlow || mutationState !== 'idle'}
              onClick={applyActiveFlow}
            >
              {mutationState === 'applying' ? c.applying : c.applyFlow}
            </button>
          </div>
        }
      />

      <div className="mx-auto mt-5 grid max-w-[80rem] gap-3">
        {mutationMessage ? (
          <div className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-3 font-mono text-xs font-black uppercase text-[var(--text-primary)] shadow-[4px_4px_0_var(--shadow-color)]">
            {mutationMessage}
          </div>
        ) : null}
        {flows.map((flow, index) => {
          const expanded = activeFlowID === flow.id;
          const account = getCurrentAccount(flow, accounts, routes);
          const visibleRoutes = getVisibleRoutesForAccount(account, routes);
          const groupLabel = groupByID.get(flow.groupID)?.label ?? 'none';
          const ready = accounts
            .map((accountItem) => computeRequestAccount(accountItem, flow, routes))
            .filter((accountItem) => accountItem.groupID === flow.groupID && accountItem.active).length;

          return (
            <section key={flow.id} className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[6px_6px_0_var(--shadow-color)]" data-collaboration-id={`RO.FLOW.${flow.id}`}>
              <button
                type="button"
                onClick={() => setActiveFlowID((current) => (current === flow.id ? null : flow.id))}
                className={`grid w-full grid-cols-[4.5rem_minmax(0,1fr)_11rem] border-0 text-left active:scale-[0.997] ${
                  expanded ? 'bg-[var(--bg-surface)]' : 'bg-[var(--bg-main)]'
                }`}
              >
                <span className="grid place-items-center border-r-2 border-[var(--border-color)] bg-[var(--border-color)] font-mono text-lg font-black text-[var(--bg-main)]">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 p-3">
                  <span className="block text-sm font-black uppercase text-[var(--text-primary)]">{flow.label}</span>
                  <span className="mt-1 block truncate font-mono text-[0.6875rem] font-bold uppercase text-[var(--text-muted)]">
                    01 {flow.cli} / 02 {groupLabel} / 03 {account?.name ?? 'none'} / 04 test
                  </span>
                  <span className="mt-2 flex flex-wrap gap-2">
                    <Badge className={flow.applied ? 'border-[#148247] bg-[#e8f6ee] text-[#148247]' : 'border-[#8b6400] bg-[#fff3c8] text-[#8b6400]'}>
                      {flow.applied ? c.applied : c.unapplied}
                    </Badge>
                    <Badge className={statusClass(flow)}>{statusLabel(flow, c)}</Badge>
                    <Badge className="border-[var(--accent-red)] bg-[rgba(239,68,68,0.10)] text-[var(--accent-red)]">ready {ready}</Badge>
                    <Badge className="border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)]">{account?.route.label ?? 'none'}</Badge>
                  </span>
                </span>
                <span className="grid place-items-center border-l-2 border-[var(--border-color)] p-3">
                  <Badge className={expanded ? 'border-[#148247] bg-[#e8f6ee] text-[#148247]' : 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)]'}>
                    {expanded ? c.collapse : c.expand}
                  </Badge>
                </span>
              </button>

              {expanded ? (
                <div className="grid gap-3 border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
                  <FlowPath flow={flow} account={account} groupLabel={groupLabel} c={c} />

                  <div className="grid grid-cols-[14rem_minmax(26rem,1fr)_17rem] items-start gap-3">
                    <section className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[4px_4px_0_var(--shadow-color)]">
                      <div className="border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
                        <div className="text-xs font-black uppercase">{c.entryPanel}</div>
                        <div className="mt-1 font-mono text-[0.625rem] font-bold uppercase text-[var(--text-muted)]">{c.entryHint}</div>
                      </div>
                      <div className="grid gap-2 p-3">
                        {requestEntries.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => {
                              updateFlow(flow.id, (current) => {
                                const next = selectFirstCompatibleAccount({ ...current, cli: entry.id }, accounts, groups, routes);
                                return invalidate(next);
                              });
                            }}
                            className={`border-2 p-2 text-left font-mono text-xs font-black uppercase active:scale-95 ${
                              flow.cli === entry.id
                                ? 'border-[var(--border-color)] bg-[var(--border-color)] text-[var(--bg-main)]'
                                : 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)]'
                            }`}
                          >
                            <span className="block text-[0.5625rem] text-[var(--accent-red)]">RO.ENTRY.{entry.id.toUpperCase()}</span>
                            {entry.label}
                            <span className="mt-1 block text-[0.5625rem] text-current opacity-70">{entry.note}</span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[4px_4px_0_var(--shadow-color)]">
                      <div className="border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
                        <div className="text-xs font-black uppercase">{c.accountPanel}</div>
                        <div className="mt-1 font-mono text-[0.625rem] font-bold uppercase text-[var(--text-muted)]">{c.accountHint}</div>
                      </div>
                      <div className="grid gap-3 p-3">
                        <div>
                          <div className="mb-2 font-mono text-[0.625rem] font-black uppercase text-[var(--text-muted)]">{c.accountGroup}</div>
                          <div className="grid grid-cols-2 gap-2">
                            {groups.map((group) => {
                              const ready = getCompatibleAccountsForGroup(flow, group.id, accounts, routes).length;
                              const usable = getUsableAccountsForGroup(flow, group.id, accounts, routes).length;
                              const selected = flow.groupID === group.id;
                              return (
                                <button
                                  key={group.id}
                                  type="button"
                                  onClick={() => {
                                    updateFlow(flow.id, (current) => {
                                      const next = selectFirstCompatibleAccount({ ...current, groupID: group.id }, accounts, groups, routes);
                                      return invalidate(next);
                                    });
                                  }}
                                  className={`border-2 p-2 text-left font-mono text-xs font-black uppercase active:scale-95 ${
                                    selected
                                      ? 'border-[var(--border-color)] bg-[var(--border-color)] text-[var(--bg-main)]'
                                      : 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)]'
                                  }`}
                                >
                                  <span className="block text-[0.5625rem] text-[var(--accent-red)]">RO.GROUP.{group.id.toUpperCase()}</span>
                                  {group.label}
                                  <span className="mt-1 block text-[0.5625rem] text-current opacity-70">
                                    {c.checkedAccounts} {ready} / {c.usableAccounts} {usable}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <div className="mb-2 font-mono text-[0.625rem] font-black uppercase text-[var(--text-muted)]">{c.account}</div>
                          <div className="grid gap-2">
                            {accounts
                              .map((accountItem) => computeRequestAccount(accountItem, flow, routes))
                              .filter((accountItem) => accountItem.groupID === flow.groupID)
                              .map((accountItem) => (
                                <div
                                  key={accountItem.id}
                                  className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-2 p-2 text-left ${
                                    flow.accountID === accountItem.id
                                      ? 'border-[var(--border-color)] bg-[var(--border-color)] text-[var(--bg-main)]'
                                      : 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)]'
                                  } ${accountItem.usable ? '' : 'opacity-55'}`}
                                >
                                  <label className="grid h-7 w-7 cursor-pointer place-items-center border-2 border-current bg-[var(--bg-main)] text-[var(--text-primary)]">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 accent-[var(--border-color)]"
                                      checked={accountItem.included}
                                      onChange={() => {
                                        updateFlow(flow.id, (current) => invalidate(toggleFlowAccountEnabled(current, accountItem.id, accounts, routes)));
                                      }}
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateFlow(flow.id, (current) => invalidate({ ...current, accountID: accountItem.id }));
                                    }}
                                    className="min-w-0 text-left active:scale-[0.995]"
                                  >
                                    <span className="block truncate text-base font-black">{accountItem.name}</span>
                                    <span className="block truncate font-mono text-[0.625rem] font-bold opacity-75">
                                      {accountItem.usable ? `${accountItem.provider} / ${accountItem.targetModel}` : accountItem.reasons.filter((reason) => reason !== '未勾选参与').join(' / ')}
                                    </span>
                                  </button>
                                  <span className="flex gap-2">
                                    <Badge className={accountItem.active ? 'border-[#148247] bg-[#e8f6ee] text-[#148247]' : 'border-[#8b6400] bg-[#fff3c8] text-[#8b6400]'}>
                                      {accountItem.included ? c.included : c.excluded}
                                    </Badge>
                                    <Badge className={accountItem.proxyPoolEnabled ? 'border-[var(--accent-red)] bg-[rgba(239,68,68,0.10)] text-[var(--accent-red)]' : 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)]'}>
                                      {accountItem.proxyPoolEnabled ? c.proxy : c.direct}
                                    </Badge>
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2">
                          <span className="font-mono text-[0.625rem] font-black uppercase text-[var(--text-muted)]">{c.currentAccount}</span>
                          <span className="flex gap-2">
                            <button
                              type="button"
                              className="border-2 border-[var(--border-color)] bg-[var(--border-color)] px-3 py-2 font-mono text-[0.625rem] font-black uppercase text-[var(--bg-main)] active:scale-95"
                              onClick={() => {
                                if (!account) return;
                                const willEnableProxyPool = !account.proxyPoolEnabled;
                                setAccountOverrides((current) => ({
                                  ...current,
                                  [account.id]: {
                                    ...current[account.id],
                                    proxyPoolEnabled: willEnableProxyPool,
                                  },
                                }));
                                updateFlow(flow.id, (current) =>
                                  invalidate(willEnableProxyPool ? enableProxyPoolForFlowAccount(current, account.id, routes) : current),
                                );
                              }}
                            >
                              {account?.proxyPoolEnabled ? c.disableProxy : c.enableProxy}
                            </button>
                            <button
                              type="button"
                              className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 font-mono text-[0.625rem] font-black uppercase active:scale-95"
                              onClick={() => {
                                if (!account) return;
                                setAccountOverrides((current) => ({
                                  ...current,
                                  [account.id]: {
                                    ...current[account.id],
                                    disabled: !account.disabled,
                                  },
                                }));
                                updateFlow(flow.id, (current) =>
                                  invalidate(current),
                                );
                              }}
                            >
                              {account?.disabled ? c.enableAccount : c.disableAccount}
                            </button>
                          </span>
                        </div>
                      </div>
                    </section>

                    <section className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[4px_4px_0_var(--shadow-color)]">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
                        <div className="min-w-0">
                          <div className="text-xs font-black uppercase">{c.exitPanel}</div>
                          <div className="mt-1 truncate font-mono text-[0.625rem] font-bold uppercase text-[var(--text-muted)]">{c.exitHint}</div>
                        </div>
                        <button
                          type="button"
                          className="h-8 border-2 border-[var(--border-color)] bg-[var(--border-color)] px-3 font-mono text-[0.625rem] font-black uppercase text-[var(--bg-main)] active:scale-95"
                          onClick={() => runFlowTest(flow.id)}
                        >
                          {c.runTest}
                        </button>
                      </div>
                      <div className="grid gap-2 p-3">
                        {visibleRoutes.length > 0 ? (
                          visibleRoutes.map((route) => (
                            <button
                              key={route.id}
                              type="button"
                              onClick={() => {
                                if (!account || route.disabled) return;
                                updateFlow(flow.id, (current) =>
                                  invalidate(
                                    {
                                      ...current,
                                      routes: {
                                        ...current.routes,
                                        [account.id]: route.id === 'direct' ? null : route.id,
                                      },
                                    },
                                  ),
                                );
                              }}
                              className={`border-2 p-2 text-left font-mono text-xs font-black uppercase active:scale-95 ${
                                account?.routeID === route.id
                                  ? 'border-[var(--border-color)] bg-[var(--border-color)] text-[var(--bg-main)]'
                                  : 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)]'
                              }`}
                            >
                              <span className="block text-[0.5625rem] text-[var(--accent-red)]">RO.ROUTE.{route.id.toUpperCase()}</span>
                              {route.label}
                              <span className="mt-1 block text-[0.5625rem] text-current opacity-70">
                                {account?.proxyPoolEnabled ? route.note : c.proxyLocked}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] p-3 font-mono text-xs font-black uppercase text-[var(--text-muted)]">
                            {c.noProxyRoutes}
                          </div>
                        )}
                      </div>
                      <div className="grid gap-2 border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[0.625rem] font-black uppercase text-[var(--text-muted)]">{c.testConfig}</span>
                          <Badge className={statusClass(flow)}>{statusLabel(flow, c)}</Badge>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
