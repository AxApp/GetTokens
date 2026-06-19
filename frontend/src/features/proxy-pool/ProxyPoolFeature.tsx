import { Download, FileInput, ListChecks, MoreVertical, Pencil, Play, Plus, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { AutoComplete, Button } from 'antd';
import { FetchProxySubscription, ProbeProxyNode } from '../../../wailsjs/go/main/App';

import SearchInput from '../../components/ui/SearchInput';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import { useDebug } from '../../context/useDebug';
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
  formatRelativeProxyCheckedTime,
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
  proxyNodeProtocols,
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
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [probingIDs, setProbingIDs] = useState<string[]>([]);

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

  function disableSelectionMode() {
    setSelectedIDs([]);
    setIsSelectionMode(false);
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
    setProbingIDs(nodesToProbe.map((node) => node.id));

    const nextByID = new Map<string, ProxyNodeRecord>();
    try {
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
    } finally {
      setProbingIDs([]);
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
      const nextNodes = upsertProxyNode(nodes, composeDraft);
      setNodes(nextNodes);
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

  const summaryText = `显示 ${filteredNodes.length} / ${summary.totalCount} · 可用 ${summary.availableCount} · 待复查 ${summary.reviewCount} · 平均延时 ${summary.averageLatencyMs} ms · 平均可用率 ${summary.averageAvailabilityRate}% · ${feedback}`;
  const probeTargetOptions = probeTargetHistory.slice(0, 5).map((url) => ({
    value: url,
    label: (
      <span className="block truncate font-mono text-[length:var(--font-size-ui-lg)]" title={url}>
        {url}
      </span>
    ),
  }));

  return (
    <section className="flex h-full flex-col overflow-auto bg-[var(--gt-surface-canvas)] text-[var(--text-primary)]">
      <div className="mx-auto flex w-full max-w-[1480px] flex-1 flex-col gap-4 px-6 py-5">
        <WorkspacePageHeader
          title="代理池"
          meta={
            <span
              data-proxy-pool-summary="true"
              className="block max-w-[min(62rem,70vw)] truncate text-[length:var(--font-size-ui-sm)] font-medium text-[var(--text-muted)]"
              title={summaryText}
            >
              {summaryText}
            </span>
          }
          actionsClassName="gap-2"
          actions={
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleImportFileChange}
              />
              <button
                type="button"
                aria-label="新增代理"
                title="新增代理"
                onClick={openCreateModal}
                className="inline-flex h-10 w-10 items-center justify-center rounded border border-[var(--gt-border-strong)] bg-[var(--text-primary)] text-[var(--bg-main)] shadow-sm transition hover:opacity-90"
              >
                <Plus className="h-5 w-5" strokeWidth={2.5} />
              </button>
              <div ref={headerMenuRef} className="relative">
                <button
                  type="button"
                  aria-label="更多操作"
                  title="更多操作"
                  onClick={() => setIsHeaderMenuOpen((prev) => !prev)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] text-[var(--text-primary)] transition hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)]"
                >
                  <MoreVertical className="h-5 w-5" strokeWidth={2.5} />
                </button>
                {isHeaderMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 flex min-w-[240px] flex-col gap-1 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] p-1.5 shadow-[var(--gt-elevation-raised-2)]">
                    <MenuActionButton
                      icon={<Upload className="h-4 w-4" strokeWidth={2.3} />}
                      label="导入列表"
                      description="粘贴文本或导入 JSON"
                      onClick={openImportModal}
                    />
                    <MenuActionButton
                      icon={<FileInput className="h-4 w-4" strokeWidth={2.3} />}
                      label="导入订阅"
                      description="从纯文本订阅拉取节点"
                      onClick={openSubscriptionModal}
                    />
                    <MenuActionButton
                      icon={<ListChecks className="h-4 w-4" strokeWidth={2.3} />}
                      label="订阅源"
                      description="查看、刷新和删除订阅源"
                      onClick={openSubscriptionManager}
                    />
                    <MenuActionButton
                      icon={<Download className="h-4 w-4" strokeWidth={2.3} />}
                      label="导出全部"
                      description={`导出当前 ${nodes.length} 条节点`}
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        exportNodes();
                      }}
                    />
                    <MenuActionButton
                      icon={<ListChecks className="h-4 w-4" strokeWidth={2.3} />}
                      label={isSelectionMode ? '结束选择' : '批量选择'}
                      description={isSelectionMode ? '退出当前批量选择模式' : '显示选择列并启用批量操作'}
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        if (isSelectionMode) {
                          disableSelectionMode();
                          return;
                        }
                        setIsSelectionMode(true);
                      }}
                    />
                    <MenuActionButton
                      icon={<RefreshCw className="h-4 w-4" strokeWidth={2.3} />}
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

        <section
          data-proxy-pool-toolbar="true"
          className="contents"
        >
          <div className="grid items-center gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(26rem,36rem)]">
            <div className="min-w-0">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="搜索协议 / IP / 端口 / 来源"
                className="rounded-md"
              />
            </div>
            <div className="min-w-0">
              <label className="grid min-w-0 items-center gap-2 sm:grid-cols-[max-content_minmax(0,1fr)]">
                <span className="text-left text-sm font-medium text-[var(--text-muted)]">测速网址</span>
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <AutoComplete
                    allowClear
                    options={probeTargetOptions}
                    popupMatchSelectWidth
                    size="large"
                    value={probeTargetURL}
                    onChange={setProbeTargetURL}
                    onSelect={(url) => {
                      setProbeTargetURL(url);
                      commitProbeTargetURL(url);
                      setProbeTargetHistory((current) => rememberProxyProbeTargetURL(current, url));
                    }}
                    onBlur={() => {
                      commitProbeTargetURL(probeTargetURL);
                    }}
                    showSearch={{ filterOption: false }}
                    className="w-full"
                    rootClassName="proxy-pool-probe-target-autocomplete"
                    placeholder="https://example.com"
                  />
                  <Button
                    htmlType="button"
                    size="large"
                    aria-label={probingIDs.length > 0 ? '测速中' : '执行测速'}
                    title={probingIDs.length > 0 ? '测速中' : '执行测速'}
                    icon={<Play className="h-3.5 w-3.5" fill="currentColor" strokeWidth={2.4} />}
                    loading={probingIDs.length > 0}
                    disabled={filteredNodes.length === 0}
                    className="proxy-pool-probe-target-button"
                    onClick={handleBatchRetest}
                  />
                </div>
              </label>
            </div>
          </div>

          {isSelectionMode ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--gt-border-subtle)] pt-3 text-[length:var(--font-size-ui-xs)] font-medium text-[var(--text-muted)]">
              <span className="mr-1">{selectedCount > 0 ? `已选 ${selectedCount}` : '选择模式'}</span>
              <button type="button" onClick={toggleSelectCurrentPage} className="inline-flex h-8 items-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-2.5 text-[length:var(--font-size-ui-xs)] font-medium text-[var(--text-primary)] transition hover:border-[var(--gt-border-strong)]">
                {allCurrentPageSelected ? '取消当前页' : '全选当前页'}
              </button>
              <button type="button" onClick={toggleSelectAllFiltered} className="inline-flex h-8 items-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-2.5 text-[length:var(--font-size-ui-xs)] font-medium text-[var(--text-primary)] transition hover:border-[var(--gt-border-strong)]">
                {allFilteredSelected ? '取消当前筛选' : '全选当前筛选'}
              </button>
              {selectedCount > 0 ? (
                <>
                  <button type="button" onClick={handleSelectedRetest} className="inline-flex h-8 items-center gap-1.5 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-2.5 text-[length:var(--font-size-ui-xs)] font-medium text-[var(--text-primary)] transition hover:border-[var(--gt-border-strong)]">
                    <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.4} />
                    测速
                  </button>
                  <button type="button" onClick={exportSelectedNodes} className="inline-flex h-8 items-center gap-1.5 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-2.5 text-[length:var(--font-size-ui-xs)] font-medium text-[var(--text-primary)] transition hover:border-[var(--gt-border-strong)]">
                    <Download className="h-3.5 w-3.5" strokeWidth={2.4} />
                    导出
                  </button>
                  <button type="button" onClick={clearSelection} className="inline-flex h-8 items-center gap-1.5 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-2.5 text-[length:var(--font-size-ui-xs)] font-medium text-[var(--text-primary)] transition hover:border-[var(--gt-border-strong)]">
                    <X className="h-3.5 w-3.5" strokeWidth={2.4} />
                    清空
                  </button>
                  <button type="button" onClick={handleBatchDelete} className="inline-flex h-8 items-center gap-1.5 rounded border border-[color-mix(in_srgb,var(--gt-status-danger)_34%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,transparent)] px-2.5 text-[length:var(--font-size-ui-xs)] font-medium text-[var(--gt-status-danger)] transition hover:bg-[color-mix(in_srgb,var(--gt-status-danger)_16%,transparent)]">
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2.4} />
                    删除
                  </button>
                </>
              ) : null}
              <button type="button" onClick={disableSelectionMode} className="ml-auto inline-flex h-8 items-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-2.5 text-[length:var(--font-size-ui-xs)] font-medium text-[var(--text-muted)] transition hover:border-[var(--gt-border-strong)] hover:text-[var(--text-primary)]">
                结束选择
              </button>
            </div>
          ) : null}
        </section>

        <section data-proxy-pool-table="true" className="overflow-hidden rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr className="bg-[var(--gt-surface-muted)]">
                  {isSelectionMode ? (
                    <TableHead compact>
                      <span className="sr-only">选择</span>
                    </TableHead>
                  ) : null}
                  <SortableTableHead className="w-[88px] whitespace-nowrap" sortKey="availability" activeKey={sortKey} direction={sortDirection} onSort={handleSort}>
                    状态
                  </SortableTableHead>
                  <TableHead className="w-[88px] whitespace-nowrap">协议</TableHead>
                  <TableHead className="w-[180px] max-w-[180px]">地址</TableHead>
                  <SortableTableHead className="w-[96px] whitespace-nowrap" sortKey="latency" activeKey={sortKey} direction={sortDirection} onSort={handleSort}>
                    延时
                  </SortableTableHead>
                  <SortableTableHead className="w-[112px] whitespace-nowrap" sortKey="lastCheckedAt" activeKey={sortKey} direction={sortDirection} onSort={handleSort}>
                    检测
                  </SortableTableHead>
                  <TableHead className="min-w-[180px]">来源</TableHead>
                  <TableHead className="w-[112px] whitespace-nowrap">操作</TableHead>
                </tr>
              </thead>
              <tbody>
                {filteredNodes.length === 0 ? (
                  <tr>
                    <td colSpan={isSelectionMode ? 8 : 7} className="px-4 py-16 text-center text-[length:var(--font-size-ui-sm)] font-medium text-[var(--text-muted)]">
                      当前筛选结果为空
                    </td>
                  </tr>
                ) : (
                  pageNodes.map((node) => (
                    <ProxyNodeRow
                      key={node.id}
                      node={node}
                      selected={selectedIDs.includes(node.id)}
                      selectionEnabled={isSelectionMode}
                      probing={probingIDs.includes(node.id)}
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

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-4 py-3">
            <div className="flex flex-wrap items-center gap-3 text-[length:var(--font-size-ui-xs)] font-medium text-[var(--text-muted)]">
              <span>
                第 {pagination.page} / {pagination.pageCount} 页
              </span>
              <span>
                当前页 {pageNodes.length} 条 / 筛选后 {filteredNodes.length} 条
              </span>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="h-8 min-w-[96px] rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-2 text-[length:var(--font-size-ui-xs)] font-medium text-[var(--text-primary)] outline-none"
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
                className="inline-flex h-8 items-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-3 text-[length:var(--font-size-ui-xs)] font-medium text-[var(--text-primary)] transition hover:border-[var(--gt-border-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={pagination.page <= 1}
              >
                上一页
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(pagination.pageCount, current + 1))}
                className="inline-flex h-8 items-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-3 text-[length:var(--font-size-ui-xs)] font-medium text-[var(--text-primary)] transition hover:border-[var(--gt-border-strong)] disabled:cursor-not-allowed disabled:opacity-50"
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

function StatusAvailabilityPill({
  status,
  availabilityRate,
}: {
  status: ProxyNodeRecord['status'];
  availabilityRate: number;
}) {
  const isAvailable = status === 'available';
  return (
    <div
      className={`inline-flex min-w-[64px] items-center justify-center rounded-full border px-2.5 py-1 text-center ${
        isAvailable
          ? 'border-[color-mix(in_srgb,var(--gt-status-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-success)_10%,transparent)] text-[var(--gt-status-success)]'
          : 'border-[color-mix(in_srgb,var(--gt-status-warning)_34%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-warning)_12%,transparent)] text-[var(--gt-status-warning)]'
      }`}
    >
      <span className="text-[length:var(--font-size-ui-xs)] font-semibold">{availabilityRate}%</span>
    </div>
  );
}

function ProxyNodeRow({
  node,
  selected,
  selectionEnabled,
  probing,
  onToggleSelect,
  onRetest,
  onEdit,
  onDelete,
}: {
  node: ProxyNodeRecord;
  selected: boolean;
  selectionEnabled: boolean;
  probing: boolean;
  onToggleSelect: (id: string) => void;
  onRetest: (id: string) => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <tr className="border-t border-[var(--gt-border-subtle)] first:border-t-0 hover:bg-[var(--gt-surface-muted)]">
      {selectionEnabled ? (
        <td className="w-10 px-2 py-3 align-middle">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(node.id)}
            className="h-4 w-4 accent-[var(--accent-red)]"
          />
        </td>
      ) : null}
      <td className="w-[88px] px-3 py-3 align-middle">
        <StatusAvailabilityPill status={node.status} availabilityRate={node.availabilityRate} />
      </td>
      <td className="w-[88px] whitespace-nowrap px-3 py-3 align-middle font-mono text-[length:var(--font-size-ui-sm)] font-semibold uppercase text-[var(--text-primary)]">{node.protocol}</td>
      <td
        className="w-[180px] max-w-[180px] break-words px-3 py-3 align-middle font-mono text-[length:var(--font-size-ui-sm)] font-medium text-[var(--text-primary)]"
        title={`${node.host}:${node.port}`}
      >
        {node.host}:{node.port}
      </td>
      <td className="w-[96px] whitespace-nowrap px-3 py-3 align-middle text-[length:var(--font-size-ui-sm)] font-medium text-[var(--text-primary)]">{node.latencyMs} ms</td>
      <td className="w-[112px] whitespace-nowrap px-3 py-3 align-middle text-[length:var(--font-size-ui-sm)] font-medium text-[var(--text-muted)]">{formatRelativeProxyCheckedTime(node.lastCheckedAt)}</td>
      <td className="min-w-[180px] px-3 py-3 align-middle">
        <div className="truncate text-[length:var(--font-size-ui-sm)] font-medium text-[var(--text-primary)]" title={node.sourceLabel || '未标记'}>
          {node.sourceLabel || '未标记'}
        </div>
      </td>
      <td className="w-[112px] px-3 py-3 align-middle">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={probing ? '测速中' : '测速'}
            title={probing ? '测速中' : '测速'}
            onClick={() => onRetest(node.id)}
            disabled={probing}
            className="flex h-8 w-8 items-center justify-center rounded bg-transparent text-[var(--text-primary)] transition hover:bg-[var(--gt-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${probing ? 'animate-spin' : ''}`} strokeWidth={2.4} />
          </button>
          <ProxyNodeActionsMenu onEdit={onEdit} onDelete={() => onDelete(node.id)} />
        </div>
      </td>
    </tr>
  );
}

function ProxyNodeActionsMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label="更多操作"
        onClick={() => setOpen((current) => !current)}
        className="flex h-8 w-8 items-center justify-center rounded bg-transparent text-[var(--text-primary)] transition hover:bg-[var(--gt-surface-muted)] active:scale-95"
      >
        <MoreVertical className="h-4 w-4" strokeWidth={2.4} />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-10 flex min-w-[140px] flex-col gap-1 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] p-1.5 shadow-[var(--gt-elevation-raised-2)]">
          <ActionButton
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={2.4} />
            <span>编辑</span>
          </ActionButton>
          <ActionButton
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            tone="danger"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2.4} />
            <span>删除</span>
          </ActionButton>
        </div>
      ) : null}
    </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim-80)] p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex w-full max-w-4xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b-2 border-[var(--border-color)] px-6 py-4">
          <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Proxy Node</div>
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
              className="input-swiss min-h-28 w-full resize-y !text-[length:var(--font-size-ui-md)] leading-6"
              placeholder="补充这条本地节点的用途、风险或说明。"
            />
          </FormField>
          {error ? (
            <div className="md:col-span-2 border-2 border-[var(--color-status-danger)] bg-[color-mix(in_srgb,var(--color-status-danger)_10%,transparent)] px-4 py-3 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide text-[var(--color-status-danger)]">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim-80)] p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex w-full max-w-3xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b-2 border-[var(--border-color)] px-6 py-4">
          <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Import</div>
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
            <button onClick={onOpenFilePicker} className="btn-swiss !px-3 !py-2 !text-[length:var(--font-size-ui-xs)]">
              读取本地 JSON 文件
            </button>
            <div className="text-[length:var(--font-size-ui-sm)] font-bold leading-6 text-[var(--text-muted)]">
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
          {error ? <div className="text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide text-[var(--color-status-danger)]">{error}</div> : null}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim-80)] p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex w-full max-w-3xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b-2 border-[var(--border-color)] px-6 py-4">
          <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Subscription</div>
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
          <div className="text-[length:var(--font-size-ui-sm)] font-bold leading-6 text-[var(--text-muted)]">
            当前支持拉取纯文本订阅，每行一条 `scheme://host:port` 或 `host:port`。导入后的所有节点都会打上这个来源标签。
          </div>
          {error ? <div className="text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide text-[var(--color-status-danger)]">{error}</div> : null}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim-80)] p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex w-full max-w-4xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[var(--border-color)] px-6 py-4">
          <div className="min-w-0">
            <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Subscriptions</div>
            <h3 className="mt-1 text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">订阅源管理</h3>
            <p className="mt-2 text-[length:var(--font-size-ui-sm)] font-bold leading-5 text-[var(--text-muted)]">
              管理本地订阅源，集中查看同步状态，并执行刷新或删除。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">{sources.length} 个订阅源</span>
            <button onClick={onRefreshAll} className="btn-swiss !px-3 !py-2 !text-[length:var(--font-size-ui-xs)]">
              刷新全部
            </button>
          </div>
        </header>
        <div className="max-h-[70vh] overflow-auto p-4 md:p-6">
          {sources.length === 0 ? (
            <div className="py-16 text-center text-[length:var(--font-size-ui-md-compact)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
              当前没有已保存的订阅源
            </div>
          ) : (
            <div className="space-y-3">
              {sources.map((source) => {
                const isHealthy = !source.lastError;
                return (
                  <section key={source.id} className="border border-[var(--border-color)] bg-[var(--bg-main)]">
                    <div className="flex flex-col gap-4 p-4 md:p-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-[length:var(--font-size-ui-md)] font-black uppercase tracking-[0.06em] text-[var(--text-primary)]">{source.label}</h4>
                            <span
                              className={`border px-2 py-1 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.14em] ${
                                isHealthy
                                  ? 'border-[var(--border-color)] text-[var(--text-primary)]'
                                  : 'border-[var(--color-status-danger)] text-[var(--color-status-danger)]'
                              }`}
                            >
                              {isHealthy ? '正常' : '异常'}
                            </span>
                          </div>
                          <p className="mt-2 break-all font-mono text-[length:var(--font-size-ui-sm)] leading-5 text-[var(--text-muted)]">{source.url}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 md:justify-end">
                          <ActionButton onClick={() => onRefresh(source)}>刷新</ActionButton>
                          <ActionButton onClick={() => onDeleteSource(source, false)} tone="danger">
                            删源
                          </ActionButton>
                          <ActionButton onClick={() => onDeleteSource(source, true)} tone="danger">
                            删源并清节点
                          </ActionButton>
                        </div>
                      </div>
                      <div className="grid gap-2 text-[length:var(--font-size-ui-sm)] font-bold text-[var(--text-muted)] md:grid-cols-3">
                        <div className="border-t border-dashed border-[var(--border-color)] pt-3">
                          <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.14em]">最近同步</div>
                          <div className="mt-1 text-[length:var(--font-size-ui-md-compact)] text-[var(--text-primary)]">{formatTableTime(source.lastSyncedAt)}</div>
                        </div>
                        <div className="border-t border-dashed border-[var(--border-color)] pt-3">
                          <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.14em]">上次导入</div>
                          <div className="mt-1 text-[length:var(--font-size-ui-md-compact)] text-[var(--text-primary)]">{source.lastImportCount} 条</div>
                        </div>
                        <div className="border-t border-dashed border-[var(--border-color)] pt-3">
                          <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.14em]">状态详情</div>
                          <div className={`mt-1 text-[length:var(--font-size-ui-md-compact)] ${isHealthy ? 'text-[var(--text-primary)]' : 'text-[var(--color-status-danger)]'}`}>
                            {isHealthy ? '最近一次同步正常' : source.lastError}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
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

function TableHead({ children, compact = false, className = '' }: { children: ReactNode; compact?: boolean; className?: string }) {
  return (
    <th
      className={`${compact ? 'w-10 px-2' : 'px-3'} ${className} border-b border-[var(--gt-border-subtle)] py-2.5 text-left text-[length:var(--font-size-ui-xs)] font-semibold text-[var(--text-muted)]`}
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
  className = '',
}: {
  children: ReactNode;
  sortKey: ProxyPoolSortKey;
  activeKey: ProxyPoolSortKey;
  direction: ProxyPoolSortDirection;
  onSort: (key: ProxyPoolSortKey) => void;
  className?: string;
}) {
  const isActive = activeKey === sortKey;
  const arrow = !isActive ? '↕' : direction === 'asc' ? '↑' : '↓';

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1.5 transition-colors hover:text-[var(--text-primary)]"
      >
        <span>{children}</span>
        <span className={isActive ? 'text-[var(--gt-status-info)]' : 'text-[var(--text-muted)]'}>{arrow}</span>
      </button>
    </TableHead>
  );
}

function ActionButton({
  children,
  onClick,
  tone = 'default',
  className = '',
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: 'default' | 'danger';
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 items-center justify-start gap-1.5 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-2.5 text-left text-[length:var(--font-size-ui-xs)] font-medium text-[var(--text-primary)] transition hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50 ${tone === 'danger' ? '!text-[var(--gt-status-danger)]' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

function MenuActionButton({
  icon,
  label,
  description,
  onClick,
}: {
  icon?: ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-2 rounded px-2.5 py-2 text-left transition hover:bg-[var(--gt-surface-muted)]"
    >
      {icon ? <span className="mt-0.5 shrink-0 text-[var(--text-muted)]">{icon}</span> : null}
      <span className="min-w-0">
        <span className="block text-[length:var(--font-size-ui-sm)] font-medium text-[var(--text-primary)]">{label}</span>
        <span className="mt-0.5 block text-[length:var(--font-size-ui-xs)] font-medium leading-4 text-[var(--text-muted)]">{description}</span>
      </span>
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
      <span className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
  );
}
