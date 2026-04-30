import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { FetchProxySubscription, ProbeProxyNode } from '../../../wailsjs/go/main/App';

import SegmentedControl from '../../components/ui/SegmentedControl';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import { useDebug } from '../../context/DebugContext';
import { toErrorMessage } from '../../utils/error';
import {
  applyProxyProbeResult,
  buildProxyPoolExportFilename,
  buildProxyURLFromNode,
  createEmptyProxyNodeDraft,
  createProxyNodeDraftFromRecord,
  DEFAULT_PROXY_PROBE_TARGET_URL,
  deriveProxySourceLabel,
  downloadProxyPool,
  filterProxyNodes,
  getDefaultSortDirection,
  mergeImportedProxyNodes,
  normalizeProxyProbeTargetURL,
  paginateProxyNodes,
  parseImportedProxyNodes,
  persistProxyNodes,
  persistProxyProbeTargetHistory,
  persistProxyProbeTargetURL,
  persistProxySubscriptions,
  proxyNodeGroups,
  proxyPoolPageSizeOptions,
  proxyPoolSortOptions,
  proxyNodeProtocols,
  proxyPoolFilterOptions,
  readStoredProxySubscriptions,
  readStoredProxyNodes,
  readStoredProxyProbeTargetHistory,
  readStoredProxyProbeTargetURL,
  removeProxyNodesBySource,
  removeProxySubscriptionSource,
  rememberProxyProbeTargetURL,
  serializeProxyNodes,
  sortProxyNodes,
  summarizeProxyNodes,
  toggleProxyPoolSort,
  type ProxyImportOptions,
  type ProxyNodeDraft,
  type ProxyNodeRecord,
  type ProxyProbeResult,
  type ProxyPoolFilter,
  type ProxyPoolSortDirection,
  type ProxyPoolSortKey,
  type ProxySubscriptionSourceRecord,
  upsertProxySubscriptionSource,
  upsertProxyNode,
} from './model';

export default function ProxyPoolFeature() {
  const { trackRequest } = useDebug();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const headerMenuRef = useRef<HTMLDivElement | null>(null);
  const [nodes, setNodes] = useState<ProxyNodeRecord[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    return readStoredProxyNodes(window.localStorage);
  });
  const [subscriptionSources, setSubscriptionSources] = useState<ProxySubscriptionSourceRecord[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    return readStoredProxySubscriptions(window.localStorage);
  });
  const [filter, setFilter] = useState<ProxyPoolFilter>('all');
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);
  const [sortKey, setSortKey] = useState<ProxyPoolSortKey>('latency');
  const [sortDirection, setSortDirection] = useState<ProxyPoolSortDirection>(() => getDefaultSortDirection('latency'));
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState('本地维护');
  const [probeTargetURL, setProbeTargetURL] = useState(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_PROXY_PROBE_TARGET_URL;
    }

    return readStoredProxyProbeTargetURL(window.localStorage);
  });
  const [probeTargetHistory, setProbeTargetHistory] = useState<string[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    return readStoredProxyProbeTargetHistory(window.localStorage);
  });
  const [composeDraft, setComposeDraft] = useState<ProxyNodeDraft>(createEmptyProxyNodeDraft);
  const [composeError, setComposeError] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [editingID, setEditingID] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importOptions, setImportOptions] = useState<ProxyImportOptions>({});
  const [importError, setImportError] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [subscriptionURL, setSubscriptionURL] = useState('');
  const [subscriptionSourceLabel, setSubscriptionSourceLabel] = useState('');
  const [subscriptionError, setSubscriptionError] = useState('');
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [isSubscriptionManagerOpen, setIsSubscriptionManagerOpen] = useState(false);
  const [selectedIDs, setSelectedIDs] = useState<string[]>([]);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    persistProxyNodes(window.localStorage, nodes);
  }, [nodes]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    persistProxySubscriptions(window.localStorage, subscriptionSources);
  }, [subscriptionSources]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    persistProxyProbeTargetURL(window.localStorage, probeTargetURL);
  }, [probeTargetURL]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    persistProxyProbeTargetHistory(window.localStorage, probeTargetHistory);
  }, [probeTargetHistory]);

  useEffect(() => {
    setSelectedIDs((current) => current.filter((id) => nodes.some((node) => node.id === id)));
  }, [nodes]);

  useEffect(() => {
    if (!isHeaderMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!headerMenuRef.current?.contains(event.target as Node)) {
        setIsHeaderMenuOpen(false);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isHeaderMenuOpen]);

  useEffect(() => {
    setPage(1);
  }, [filter, query, pageSize]);

  const filteredNodes = sortProxyNodes(filterProxyNodes(nodes, filter, query), sortKey, sortDirection);
  const pagination = paginateProxyNodes(filteredNodes, page, pageSize);
  const pageNodes = pagination.items;
  const summary = summarizeProxyNodes(nodes);
  const filteredIDs = filteredNodes.map((node) => node.id);
  const currentPageIDs = pageNodes.map((node) => node.id);
  const selectedNodes = nodes.filter((node) => selectedIDs.includes(node.id));
  const allFilteredSelected = filteredNodes.length > 0 && filteredNodes.every((node) => selectedIDs.includes(node.id));
  const allCurrentPageSelected = pageNodes.length > 0 && pageNodes.every((node) => selectedIDs.includes(node.id));
  const selectedCount = selectedIDs.length;

  useEffect(() => {
    if (pagination.page !== page) {
      setPage(pagination.page);
    }
  }, [page, pagination.page]);

  function handleDelete(id: string) {
    setNodes((current) => current.filter((node) => node.id !== id));
    setFeedback('已从本地代理池移除该节点。');
  }

  function toggleSelect(id: string) {
    setSelectedIDs((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleSelectAllFiltered() {
    if (allFilteredSelected) {
      setSelectedIDs((current) => current.filter((id) => !filteredIDs.includes(id)));
      return;
    }

    setSelectedIDs((current) => Array.from(new Set([...current, ...filteredIDs])));
  }

  function toggleSelectCurrentPage() {
    if (allCurrentPageSelected) {
      setSelectedIDs((current) => current.filter((id) => !currentPageIDs.includes(id)));
      return;
    }

    setSelectedIDs((current) => Array.from(new Set([...current, ...currentPageIDs])));
  }

  function clearSelection() {
    setSelectedIDs([]);
  }

  function handleRetest(id: string) {
    void probeNodesByIDs([id], '已完成 1 条节点测速。');
  }

  function handleBatchRetest() {
    if (filteredNodes.length === 0) {
      setFeedback('当前筛选条件下没有可测速节点。');
      return;
    }

    void probeNodesByIDs(filteredNodes.map((node) => node.id), `已对当前筛选结果内的 ${filteredNodes.length} 条节点完成测速。`);
  }

  function handleBatchDelete() {
    if (selectedIDs.length === 0) {
      setFeedback('当前没有选中的代理节点。');
      return;
    }

    const targetIDs = new Set(selectedIDs);
    setNodes((current) => current.filter((node) => !targetIDs.has(node.id)));
    setSelectedIDs([]);
    setFeedback(`已从本地代理池移除 ${targetIDs.size} 条选中节点。`);
  }

  function handleSelectedRetest() {
    if (selectedIDs.length === 0) {
      setFeedback('当前没有选中的代理节点。');
      return;
    }

    void probeNodesByIDs(selectedIDs, `已对 ${selectedIDs.length} 条选中节点完成测速。`);
  }

  function handleSort(nextKey: ProxyPoolSortKey) {
    const nextSort = toggleProxyPoolSort(sortKey, sortDirection, nextKey);
    setSortKey(nextSort.key);
    setSortDirection(nextSort.direction);
  }

  function commitProbeTargetURL(raw: string): string | null {
    try {
      const normalized = normalizeProxyProbeTargetURL(raw);
      setProbeTargetURL(normalized);
      setProbeTargetHistory((current) => rememberProxyProbeTargetURL(current, normalized));
      return normalized;
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '测速网址不合法。');
      return null;
    }
  }

  async function probeNodesByIDs(ids: readonly string[], successMessage: string) {
    const targetUrl = commitProbeTargetURL(probeTargetURL);
    if (!targetUrl) {
      return;
    }

    const targetIDs = new Set(ids);
    const nodesToProbe = nodes.filter((node) => targetIDs.has(node.id));
    if (nodesToProbe.length === 0) {
      setFeedback('没有找到可测速的代理节点。');
      return;
    }

    setFeedback(`正在测速 ${nodesToProbe.length} 条代理节点...`);

    const nextByID = new Map<string, ProxyNodeRecord>();
    for (const node of nodesToProbe) {
      const proxyUrl = buildProxyURLFromNode(node);
      try {
        const result = await trackRequest<ProxyProbeResult>(
          'ProbeProxyNode',
          { proxyUrl, targetUrl },
          () => ProbeProxyNode({ proxyUrl, targetUrl }),
        );
        nextByID.set(node.id, applyProxyProbeResult(node, result));
      } catch (error) {
        nextByID.set(
          node.id,
          applyProxyProbeResult(node, {
            success: false,
            latencyMs: node.latencyMs,
            checkedAt: new Date().toISOString(),
            message: formatProxyPoolRuntimeError('代理检测', error),
          }),
        );
      }
    }

    setNodes((current) => current.map((node) => nextByID.get(node.id) ?? node));
    setFeedback(successMessage);
  }

  function openCreateModal() {
    setEditingID(null);
    setComposeDraft(createEmptyProxyNodeDraft());
    setComposeError('');
    setIsComposeOpen(true);
  }

  function openEditModal(node: ProxyNodeRecord) {
    setEditingID(node.id);
    setComposeDraft(createProxyNodeDraftFromRecord(node));
    setComposeError('');
    setIsComposeOpen(true);
  }

  function closeComposeModal() {
    setIsComposeOpen(false);
    setComposeError('');
  }

  function handleComposeChange(field: keyof ProxyNodeDraft, value: string) {
    setComposeDraft((current) => ({ ...current, [field]: value }));
  }

  function submitCompose() {
    try {
      setNodes((current) => upsertProxyNode(current, composeDraft));
      setFeedback(editingID ? '已更新该本地代理节点。' : '已新增一条本地代理节点。');
      closeComposeModal();
    } catch (error) {
      setComposeError(error instanceof Error ? error.message : '保存代理节点失败。');
    }
  }

  function openImportModal() {
    setIsHeaderMenuOpen(false);
    setImportText('');
    setImportOptions({});
    setImportError('');
    setIsImportOpen(true);
  }

  function closeImportModal() {
    setIsImportOpen(false);
    setImportError('');
  }

  function submitImport() {
    try {
      const importedNodes = parseImportedProxyNodes(importText, new Date(), importOptions);
      setNodes((current) => mergeImportedProxyNodes(current, importedNodes));
      setFeedback(`已导入 ${importedNodes.length} 条本地代理节点。重复 ID 已自动覆盖。`);
      closeImportModal();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : '导入代理节点失败。');
    }
  }

  function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    void file.text().then(
      (content) => {
        setImportText(content);
        setImportError('');
      },
      () => {
        setImportError('读取本地文件失败。');
      },
    );

    event.target.value = '';
  }

  function handleSubscriptionURLChange(value: string) {
    setSubscriptionURL(value);
    setSubscriptionSourceLabel((current) => (current.trim() ? current : deriveProxySourceLabel(value)));
  }

  function exportNodes() {
    downloadProxyPool(buildProxyPoolExportFilename(), serializeProxyNodes(nodes));
    setFeedback(`已导出当前本地代理池，共 ${nodes.length} 条节点。`);
  }

  function openSubscriptionModal() {
    setIsHeaderMenuOpen(false);
    setSubscriptionURL('');
    setSubscriptionSourceLabel('');
    setSubscriptionError('');
    setIsSubscriptionOpen(true);
  }

  function closeSubscriptionModal() {
    setIsSubscriptionOpen(false);
    setSubscriptionError('');
  }

  function openSubscriptionManager() {
    setIsHeaderMenuOpen(false);
    setIsSubscriptionManagerOpen(true);
  }

  function closeSubscriptionManager() {
    setIsSubscriptionManagerOpen(false);
  }

  async function fetchSubscriptionNodes(url: string, sourceLabel: string) {
    const trimmedURL = url.trim();
    const normalizedSourceLabel = sourceLabel.trim() || deriveProxySourceLabel(trimmedURL);
    const subscription = await trackRequest<{ url: string; sourceLabel: string; content: string }>(
      'FetchProxySubscription',
      { url: trimmedURL, sourceLabel: normalizedSourceLabel },
      () => FetchProxySubscription({ url: trimmedURL, sourceLabel: normalizedSourceLabel }),
    );

    return {
      source: {
        url: subscription.url || trimmedURL,
        label: subscription.sourceLabel || normalizedSourceLabel,
      },
      nodes: parseImportedProxyNodes(subscription.content, new Date(), {
        sourceLabel: subscription.sourceLabel || normalizedSourceLabel,
        sourceURL: subscription.url || trimmedURL,
      }),
    };
  }

  async function submitSubscription() {
    const trimmedURL = subscriptionURL.trim();
    const sourceLabel = subscriptionSourceLabel.trim() || deriveProxySourceLabel(trimmedURL);
    if (!trimmedURL) {
      setSubscriptionError('订阅链接不能为空。');
      return;
    }

    try {
      const { source, nodes: importedNodes } = await fetchSubscriptionNodes(trimmedURL, sourceLabel);
      setNodes((current) => mergeImportedProxyNodes(current, importedNodes));
      setSubscriptionSources((current) =>
        upsertProxySubscriptionSource(current, {
          url: source.url,
          label: source.label,
          lastSyncedAt: new Date().toISOString(),
          lastImportCount: importedNodes.length,
        }),
      );
      setFeedback(`已从订阅源导入 ${importedNodes.length} 条代理节点。`);
      closeSubscriptionModal();
    } catch (error) {
      setSubscriptionError(error instanceof Error ? error.message : '拉取订阅失败。');
    }
  }

  async function refreshSubscriptionSource(source: ProxySubscriptionSourceRecord) {
    setFeedback(`正在刷新订阅源 ${source.label}...`);
    try {
      const { source: normalizedSource, nodes: importedNodes } = await fetchSubscriptionNodes(source.url, source.label);
      setNodes((current) => mergeImportedProxyNodes(current, importedNodes));
      setSubscriptionSources((current) =>
        upsertProxySubscriptionSource(current, {
          url: normalizedSource.url,
          label: normalizedSource.label,
          lastSyncedAt: new Date().toISOString(),
          lastImportCount: importedNodes.length,
        }),
      );
      setFeedback(`已刷新订阅源 ${normalizedSource.label}，导入 ${importedNodes.length} 条节点。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '拉取订阅失败。';
      setSubscriptionSources((current) =>
        upsertProxySubscriptionSource(current, {
          url: source.url,
          label: source.label,
          lastSyncedAt: new Date().toISOString(),
          lastImportCount: source.lastImportCount,
          lastError: message,
        }),
      );
      setFeedback(`刷新订阅源失败：${message}`);
    }
  }

  async function refreshAllSubscriptionSources() {
    if (subscriptionSources.length === 0) {
      setFeedback('当前没有可刷新的订阅源。');
      return;
    }

    for (const source of subscriptionSources) {
      // Keep sequential refresh to avoid overwhelming remote sources and to preserve clear feedback.
      // eslint-disable-next-line no-await-in-loop
      await refreshSubscriptionSource(source);
    }
  }

  function handleDeleteSubscriptionSource(source: ProxySubscriptionSourceRecord, deleteNodes: boolean) {
    setSubscriptionSources((current) => removeProxySubscriptionSource(current, source.id));
    if (deleteNodes) {
      setNodes((current) => removeProxyNodesBySource(current, source));
      setFeedback(`已删除订阅源 ${source.label}，并清理其对应节点。`);
      return;
    }

    setFeedback(`已删除订阅源 ${source.label}，现有节点已保留。`);
  }

  function exportSelectedNodes() {
    if (selectedNodes.length === 0) {
      setFeedback('当前没有选中的代理节点。');
      return;
    }

    downloadProxyPool(buildProxyPoolExportFilename(), serializeProxyNodes(selectedNodes));
    setFeedback(`已导出 ${selectedNodes.length} 条选中节点。`);
  }

  return (
    <section className="flex h-full flex-col overflow-auto bg-[var(--bg-surface)] text-[var(--text-primary)]">
      <div className="mx-auto flex w-full max-w-[1480px] flex-1 flex-col gap-5 p-7">
        <WorkspacePageHeader
          title="代理池"
          subtitle={`网络代理池 / 本地维护 / ${filteredNodes.length} / ${summary.totalCount} / 可用 ${summary.availableCount} / 待复查 ${summary.reviewCount} / 平均延时 ${summary.averageLatencyMs} ms`}
          actions={
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleImportFileChange}
              />
              <button type="button" onClick={openCreateModal} className="btn-swiss !px-3 !py-2 !text-[0.5625rem]">
                新增代理
              </button>
              <div ref={headerMenuRef} className="relative">
                <button type="button" onClick={() => setIsHeaderMenuOpen((prev) => !prev)} className="btn-swiss !px-3 !py-2 !text-[0.5625rem]">
                  更多操作
                </button>
                {isHeaderMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.75rem)] z-20 flex min-w-[220px] flex-col gap-2 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-2 shadow-[6px_6px_0_var(--shadow-color)]">
                    <MenuActionButton
                      label="导入列表"
                      description="粘贴文本或导入 JSON"
                      onClick={openImportModal}
                    />
                    <MenuActionButton
                      label="导入订阅"
                      description="从纯文本订阅拉取节点"
                      onClick={openSubscriptionModal}
                    />
                    <MenuActionButton
                      label="订阅源"
                      description="查看、刷新和删除订阅源"
                      onClick={openSubscriptionManager}
                    />
                    <MenuActionButton
                      label="导出全部"
                      description={`导出当前 ${nodes.length} 条节点`}
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        exportNodes();
                      }}
                    />
                    <MenuActionButton
                      label="批量测速"
                      description={`对当前筛选内 ${filteredNodes.length} 条执行测速`}
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        handleBatchRetest();
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </>
          }
        />

        <section>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <div className="w-full">
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="input-swiss w-full uppercase"
                  placeholder="搜索协议 / IP / 端口 / 来源"
                />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-2">
                  <span className="text-[0.5625rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">测速网址</span>
                  <input
                    type="text"
                    list="proxy-probe-target-history"
                    value={probeTargetURL}
                    onChange={(event) => setProbeTargetURL(event.target.value)}
                    onBlur={(event) => {
                      commitProbeTargetURL(event.target.value);
                    }}
                    className="input-swiss w-full"
                    placeholder="https://example.com"
                  />
                  <datalist id="proxy-probe-target-history">
                    {probeTargetHistory.map((url) => (
                      <option key={url} value={url} />
                    ))}
                  </datalist>
                </div>
                {probeTargetHistory.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.5625rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">历史</span>
                    {probeTargetHistory.slice(0, 5).map((url) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => {
                          setProbeTargetURL(url);
                          setProbeTargetHistory((current) => rememberProxyProbeTargetURL(current, url));
                        }}
                        className="border border-[var(--border-color)] px-2 py-1 text-[0.5625rem] font-black uppercase tracking-[0.14em] text-[var(--text-primary)] transition hover:bg-[var(--bg-surface)]"
                      >
                        {url}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {selectedCount > 0 ? (
                <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-[var(--border-color)] pt-4 text-[0.5625rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  <span className="mr-2">已选 {selectedCount}</span>
                  <button type="button" onClick={toggleSelectCurrentPage} className="btn-swiss !px-2.5 !py-1.5 !text-[0.5625rem]">
                    {allCurrentPageSelected ? '取消当前页' : '全选当前页'}
                  </button>
                  <button type="button" onClick={toggleSelectAllFiltered} className="btn-swiss !px-2.5 !py-1.5 !text-[0.5625rem]">
                    {allFilteredSelected ? '取消当前筛选' : '全选当前筛选'}
                  </button>
                  <button type="button" onClick={handleSelectedRetest} className="btn-swiss !px-2.5 !py-1.5 !text-[0.5625rem]">
                    测速
                  </button>
                  <button type="button" onClick={exportSelectedNodes} className="btn-swiss !px-2.5 !py-1.5 !text-[0.5625rem]">
                    导出
                  </button>
                  <button type="button" onClick={clearSelection} className="btn-swiss !px-2.5 !py-1.5 !text-[0.5625rem]">
                    清空
                  </button>
                  <button type="button" onClick={handleBatchDelete} className="btn-swiss !px-2.5 !py-1.5 !text-[0.5625rem] !text-red-500">
                    删除
                  </button>
                </div>
              ) : null}
            </div>

          </div>
        </section>

        <section className="border-2 border-[var(--border-color)] bg-[var(--bg-main)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse">
              <thead>
                <tr className="bg-[var(--bg-surface)]">
                  <TableHead compact>
                    <span className="sr-only">选择</span>
                  </TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>协议</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>端口</TableHead>
                  <SortableTableHead sortKey="latency" activeKey={sortKey} direction={sortDirection} onSort={handleSort}>
                    延时
                  </SortableTableHead>
                  <SortableTableHead sortKey="availability" activeKey={sortKey} direction={sortDirection} onSort={handleSort}>
                    可用率
                  </SortableTableHead>
                  <SortableTableHead sortKey="lastCheckedAt" activeKey={sortKey} direction={sortDirection} onSort={handleSort}>
                    最近检测
                  </SortableTableHead>
                  <TableHead>来源</TableHead>
                  <TableHead>操作</TableHead>
                </tr>
              </thead>
              <tbody>
                {filteredNodes.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-16 text-center text-[0.6875rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      当前筛选结果为空
                    </td>
                  </tr>
                ) : (
                  pageNodes.map((node) => (
                    <ProxyNodeRow
                      key={node.id}
                      node={node}
                      selected={selectedIDs.includes(node.id)}
                      onToggleSelect={toggleSelect}
                      onRetest={handleRetest}
                      onDelete={handleDelete}
                      onEdit={() => openEditModal(node)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-5 py-3">
            <div className="flex flex-wrap items-center gap-3 text-[0.5625rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
              <span>
                第 {pagination.page} / {pagination.pageCount} 页
              </span>
              <span>
                当前页 {pageNodes.length} 条 / 筛选后 {filteredNodes.length} 条
              </span>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="input-swiss min-w-[96px] !py-1.5 !text-[0.5625rem]"
              >
                {proxyPoolPageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size} / 页
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="btn-swiss !px-3 !py-1.5 !text-[0.5625rem]"
                disabled={pagination.page <= 1}
              >
                上一页
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(pagination.pageCount, current + 1))}
                className="btn-swiss !px-3 !py-1.5 !text-[0.5625rem]"
                disabled={pagination.page >= pagination.pageCount}
              >
                下一页
              </button>
            </div>
          </div>
        </section>
      </div>

      {isComposeOpen ? (
        <ProxyNodeComposeModal
          draft={composeDraft}
          error={composeError}
          isEditing={editingID !== null}
          onChange={handleComposeChange}
          onClose={closeComposeModal}
          onSubmit={submitCompose}
        />
      ) : null}

      {isImportOpen ? (
        <ProxyPoolImportModal
          value={importText}
          options={importOptions}
          error={importError}
          onChange={setImportText}
          onChangeOptions={setImportOptions}
          onClose={closeImportModal}
          onOpenFilePicker={() => fileInputRef.current?.click()}
          onSubmit={submitImport}
        />
      ) : null}

      {isSubscriptionOpen ? (
        <ProxyPoolSubscriptionModal
          url={subscriptionURL}
          sourceLabel={subscriptionSourceLabel}
          error={subscriptionError}
          onChangeURL={handleSubscriptionURLChange}
          onChangeSourceLabel={setSubscriptionSourceLabel}
          onClose={closeSubscriptionModal}
          onSubmit={() => void submitSubscription()}
        />
      ) : null}

      {isSubscriptionManagerOpen ? (
        <ProxyPoolSubscriptionManagerModal
          sources={subscriptionSources}
          onClose={closeSubscriptionManager}
          onRefresh={(source) => void refreshSubscriptionSource(source)}
          onRefreshAll={() => void refreshAllSubscriptionSources()}
          onDeleteSource={handleDeleteSubscriptionSource}
        />
      ) : null}
    </section>
  );
}

function formatProxyPoolRuntimeError(action: string, error: unknown) {
  const message = toErrorMessage(error);
  if (message.includes('is not a function')) {
    return `${action}失败：当前运行中的 Wails 实例还没加载新的代理池桥接方法，请重启应用或开发进程。`;
  }
  return `${action}失败：${message}`;
}

function formatTableTime(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return '未同步';
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return normalized;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hour = String(parsed.getHours()).padStart(2, '0');
  const minute = String(parsed.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function ProxyNodeRow({
  node,
  selected,
  onToggleSelect,
  onRetest,
  onEdit,
  onDelete,
}: {
  node: ProxyNodeRecord;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onRetest: (id: string) => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <tr className="border-t border-dashed border-[var(--border-color)] first:border-t-0 hover:bg-[var(--bg-main)]/50">
      <td className="px-4 py-5 align-middle">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(node.id)}
          className="h-4 w-4 accent-[var(--accent-red)]"
        />
      </td>
      <td className="px-4 py-5 align-middle">
        <StatusPill status={node.status} />
      </td>
      <td className="px-4 py-5 align-middle font-mono text-[0.6875rem] font-black uppercase text-[var(--text-primary)]">{node.protocol}</td>
      <td className="px-4 py-5 align-middle font-mono text-[0.6875rem] font-bold text-[var(--text-primary)]">{node.host}</td>
      <td className="px-4 py-5 align-middle font-mono text-[0.6875rem] font-bold text-[var(--text-primary)]">{node.port}</td>
      <td className="px-4 py-5 align-middle text-[0.6875rem] font-bold text-[var(--text-primary)]">{node.latencyMs} ms</td>
      <td className="px-4 py-5 align-middle text-[0.6875rem] font-bold text-[var(--text-primary)]">{node.availabilityRate}%</td>
      <td className="px-4 py-5 align-middle text-[0.625rem] font-bold text-[var(--text-primary)]">{node.lastCheckedAt}</td>
      <td className="px-4 py-5 align-middle text-[0.6875rem] font-bold text-[var(--text-primary)]">{node.sourceLabel || '未标记'}</td>
      <td className="px-4 py-5 align-middle">
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={() => onRetest(node.id)}>测速</ActionButton>
          <ActionButton onClick={onEdit}>编辑</ActionButton>
          <ActionButton onClick={() => onDelete(node.id)} tone="danger">
            删除
          </ActionButton>
        </div>
      </td>
    </tr>
  );
}

function ProxyNodeComposeModal({
  draft,
  error,
  isEditing,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: ProxyNodeDraft;
  error: string;
  isEditing: boolean;
  onChange: (field: keyof ProxyNodeDraft, value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex w-full max-w-4xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b-2 border-[var(--border-color)] px-6 py-4">
          <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Proxy Node</div>
          <h3 className="mt-1 text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">
            {isEditing ? '编辑本地代理节点' : '新增本地代理节点'}
          </h3>
        </header>
        <div className="grid gap-4 p-6 md:grid-cols-2">
          <FormField label="节点名称">
            <input value={draft.name} onChange={(event) => onChange('name', event.target.value)} className="input-swiss w-full" placeholder="例如：首尔 Lambda" />
          </FormField>
          <FormField label="分组">
            <select value={draft.group} onChange={(event) => onChange('group', event.target.value)} className="input-swiss w-full">
              {proxyNodeGroups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="协议">
            <select value={draft.protocol} onChange={(event) => onChange('protocol', event.target.value)} className="input-swiss w-full">
              {proxyNodeProtocols.map((protocol) => (
                <option key={protocol} value={protocol}>
                  {protocol}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="来源标签">
            <input value={draft.sourceLabel} onChange={(event) => onChange('sourceLabel', event.target.value)} className="input-swiss w-full" placeholder="例如：hookzof/socks5_list" />
          </FormField>
          <FormField label="来源链接">
            <input value={draft.sourceURL} onChange={(event) => onChange('sourceURL', event.target.value)} className="input-swiss w-full" placeholder="例如：https://example.com/proxy.txt" />
          </FormField>
          <FormField label="代理地址">
            <input value={draft.host} onChange={(event) => onChange('host', event.target.value)} className="input-swiss w-full" placeholder="例如：127.0.0.1" />
          </FormField>
          <FormField label="端口">
            <input value={draft.port} onChange={(event) => onChange('port', event.target.value)} className="input-swiss w-full" inputMode="numeric" placeholder="1080" />
          </FormField>
          <FormField label="状态">
            <select value={draft.status} onChange={(event) => onChange('status', event.target.value)} className="input-swiss w-full">
              <option value="available">可用</option>
              <option value="review">待复查</option>
            </select>
          </FormField>
          <FormField label="延时（ms）">
            <input value={draft.latencyMs} onChange={(event) => onChange('latencyMs', event.target.value)} className="input-swiss w-full" inputMode="numeric" placeholder="180" />
          </FormField>
          <FormField label="可用率（%）">
            <input
              value={draft.availabilityRate}
              onChange={(event) => onChange('availabilityRate', event.target.value)}
              className="input-swiss w-full"
              inputMode="numeric"
              placeholder="95"
            />
          </FormField>
          <FormField label="备注" className="md:col-span-2">
            <textarea
              value={draft.note}
              onChange={(event) => onChange('note', event.target.value)}
              className="input-swiss min-h-28 w-full resize-y !text-[0.75rem] leading-6"
              placeholder="补充这条本地节点的用途、风险或说明。"
            />
          </FormField>
          {error ? (
            <div className="md:col-span-2 border-2 border-red-500 bg-red-500/10 px-4 py-3 text-[0.625rem] font-black uppercase tracking-wide text-red-500">
              {error}
            </div>
          ) : null}
        </div>
        <footer className="flex items-center justify-between border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4">
          <button onClick={onClose} className="btn-swiss">
            取消
          </button>
          <button onClick={onSubmit} className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)]">
            {isEditing ? '保存修改' : '添加节点'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function ProxyPoolImportModal({
  value,
  options,
  error,
  onChange,
  onChangeOptions,
  onClose,
  onOpenFilePicker,
  onSubmit,
}: {
  value: string;
  options: ProxyImportOptions;
  error: string;
  onChange: (value: string) => void;
  onChangeOptions: (value: ProxyImportOptions) => void;
  onClose: () => void;
  onOpenFilePicker: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex w-full max-w-3xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b-2 border-[var(--border-color)] px-6 py-4">
          <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Import</div>
          <h3 className="mt-1 text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">导入本地代理列表</h3>
        </header>
        <div className="space-y-4 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="来源标签">
              <input
                value={options.sourceLabel ?? ''}
                onChange={(event) => onChangeOptions({ ...options, sourceLabel: event.target.value })}
                className="input-swiss w-full"
                placeholder="例如：hookzof/socks5_list"
              />
            </FormField>
            <FormField label="来源链接">
              <input
                value={options.sourceURL ?? ''}
                onChange={(event) => onChangeOptions({ ...options, sourceURL: event.target.value })}
                className="input-swiss w-full"
                placeholder="例如：https://example.com/proxy.txt"
              />
            </FormField>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={onOpenFilePicker} className="btn-swiss !px-3 !py-2 !text-[0.5625rem]">
              读取本地 JSON 文件
            </button>
            <div className="text-[0.625rem] font-bold leading-6 text-[var(--text-muted)]">
              支持粘贴导出的 JSON 数组，也支持逐行填写 `scheme://host:port` 或 `host:port`。重复 ID 会在导入时自动覆盖。
            </div>
          </div>
          <textarea
            autoFocus
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="input-swiss h-72 w-full resize-none font-mono text-xs leading-6"
            placeholder={'[{"id":"proxy-sha-01","name":"上海 Alpha",...}]\n或\nsocks5://127.0.0.1:1080\n10.0.0.8:8080'}
          />
          {error ? <div className="text-[0.625rem] font-black uppercase tracking-wide text-red-500">{error}</div> : null}
        </div>
        <footer className="flex items-center justify-between border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4">
          <button onClick={onClose} className="btn-swiss">
            取消
          </button>
          <button onClick={onSubmit} className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)]">
            导入列表
          </button>
        </footer>
      </div>
    </div>
  );
}

function ProxyPoolSubscriptionModal({
  url,
  sourceLabel,
  error,
  onChangeURL,
  onChangeSourceLabel,
  onClose,
  onSubmit,
}: {
  url: string;
  sourceLabel: string;
  error: string;
  onChangeURL: (value: string) => void;
  onChangeSourceLabel: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex w-full max-w-3xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b-2 border-[var(--border-color)] px-6 py-4">
          <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Subscription</div>
          <h3 className="mt-1 text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">导入代理订阅</h3>
        </header>
        <div className="grid gap-4 p-6">
          <FormField label="订阅链接">
            <input
              autoFocus
              value={url}
              onChange={(event) => onChangeURL(event.target.value)}
              className="input-swiss w-full"
              placeholder="例如：https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt"
            />
          </FormField>
          <FormField label="来源标签">
            <input
              value={sourceLabel}
              onChange={(event) => onChangeSourceLabel(event.target.value)}
              className="input-swiss w-full"
              placeholder="例如：hookzof/socks5_list"
            />
          </FormField>
          <div className="text-[0.625rem] font-bold leading-6 text-[var(--text-muted)]">
            当前支持拉取纯文本订阅，每行一条 `scheme://host:port` 或 `host:port`。导入后的所有节点都会打上这个来源标签。
          </div>
          {error ? <div className="text-[0.625rem] font-black uppercase tracking-wide text-red-500">{error}</div> : null}
        </div>
        <footer className="flex items-center justify-between border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4">
          <button onClick={onClose} className="btn-swiss">
            取消
          </button>
          <button onClick={onSubmit} className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)]">
            拉取并导入
          </button>
        </footer>
      </div>
    </div>
  );
}

function ProxyPoolSubscriptionManagerModal({
  sources,
  onClose,
  onRefresh,
  onRefreshAll,
  onDeleteSource,
}: {
  sources: readonly ProxySubscriptionSourceRecord[];
  onClose: () => void;
  onRefresh: (source: ProxySubscriptionSourceRecord) => void;
  onRefreshAll: () => void;
  onDeleteSource: (source: ProxySubscriptionSourceRecord, deleteNodes: boolean) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex w-full max-w-5xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-4 border-b-2 border-[var(--border-color)] px-6 py-4">
          <div>
            <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Subscriptions</div>
            <h3 className="mt-1 text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">订阅源管理</h3>
          </div>
          <button onClick={onRefreshAll} className="btn-swiss !px-3 !py-2 !text-[0.5625rem]">
            刷新全部
          </button>
        </header>
        <div className="max-h-[70vh] overflow-auto">
          {sources.length === 0 ? (
            <div className="px-6 py-16 text-center text-[0.6875rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
              当前没有已保存的订阅源
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[var(--bg-surface)]">
                  <TableHead>标签</TableHead>
                  <TableHead>链接</TableHead>
                  <TableHead>最近同步</TableHead>
                  <TableHead>上次导入</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.id} className="border-t border-dashed border-[var(--border-color)] first:border-t-0">
                    <td className="px-4 py-4 align-top text-[0.6875rem] font-bold text-[var(--text-primary)]">{source.label}</td>
                    <td className="px-4 py-4 align-top font-mono text-[0.625rem] text-[var(--text-primary)]">{source.url}</td>
                    <td className="px-4 py-4 align-top text-[0.6875rem] font-bold text-[var(--text-primary)]">{formatTableTime(source.lastSyncedAt)}</td>
                    <td className="px-4 py-4 align-top text-[0.6875rem] font-bold text-[var(--text-primary)]">{source.lastImportCount} 条</td>
                    <td className="px-4 py-4 align-top text-[0.625rem] font-bold text-[var(--text-primary)]">
                      {source.lastError ? <span className="text-red-500">{source.lastError}</span> : '正常'}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        <ActionButton onClick={() => onRefresh(source)}>刷新</ActionButton>
                        <ActionButton onClick={() => onDeleteSource(source, false)} tone="danger">
                          删源
                        </ActionButton>
                        <ActionButton onClick={() => onDeleteSource(source, true)} tone="danger">
                          删源并清节点
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <footer className="flex items-center justify-end border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4">
          <button onClick={onClose} className="btn-swiss">
            关闭
          </button>
        </footer>
      </div>
    </div>
  );
}

function TableHead({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <th
      className={`border-b-2 border-[var(--border-color)] px-4 py-3 text-left text-[0.625rem] font-black tracking-[0.12em] text-[var(--text-primary)] ${
        compact ? 'w-16' : ''
      }`}
    >
      {children}
    </th>
  );
}

function SortableTableHead({
  children,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  children: ReactNode;
  sortKey: ProxyPoolSortKey;
  activeKey: ProxyPoolSortKey;
  direction: ProxyPoolSortDirection;
  onSort: (key: ProxyPoolSortKey) => void;
}) {
  const isActive = activeKey === sortKey;
  const arrow = !isActive ? '↕' : direction === 'asc' ? '↑' : '↓';

  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-2 uppercase transition-opacity hover:opacity-70"
      >
        <span>{children}</span>
        <span className={isActive ? 'text-[var(--accent-red)]' : 'text-[var(--text-muted)]'}>{arrow}</span>
      </button>
    </TableHead>
  );
}

function StatusPill({ status }: { status: ProxyNodeRecord['status'] }) {
  const tone =
    status === 'available'
      ? 'border-emerald-700 bg-emerald-50 text-emerald-700'
      : 'border-amber-700 bg-amber-50 text-amber-700';

  return (
    <span className={`inline-flex border px-2 py-1 text-[0.5625rem] font-black uppercase tracking-[0.14em] ${tone}`}>
      {status === 'available' ? '可用' : '待复查'}
    </span>
  );
}

function ActionButton({
  children,
  onClick,
  tone = 'default',
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn-swiss !px-2.5 !py-1.5 !text-[0.5625rem] ${tone === 'danger' ? '!text-red-500' : ''}`}
    >
      {children}
    </button>
  );
}

function MenuActionButton({
  label,
  description,
  onClick,
}: {
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col items-start gap-1 border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 text-left transition-transform hover:translate-x-[-1px] hover:translate-y-[-1px]"
    >
      <span className="text-[0.625rem] font-black uppercase tracking-[0.14em] text-[var(--text-primary)]">{label}</span>
      <span className="text-[0.5625rem] font-bold leading-5 text-[var(--text-muted)]">{description}</span>
    </button>
  );
}

function FormField({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`space-y-2 ${className}`}>
      <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
  );
}
