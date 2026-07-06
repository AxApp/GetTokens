import { ShieldCheck } from 'lucide-react';
import { Table, Tag } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { main } from '../../../wailsjs/go/models';
import AssetWorkbenchShell from '../../components/ui/AssetWorkbenchShell';
import RefreshActionButton from '../../components/ui/RefreshActionButton';
import SearchInput from '../../components/ui/SearchInput';
import { toErrorMessage } from '../../utils/error';
import { buildCodexDetailFrameHash, clearCodexDetailFrameHash } from '../../utils/pagePersistence';
import {
  applyGetTokensExtensionCodexConfigTransaction,
  loadGetTokensExtensionRegistrySnapshot,
  prepareGetTokensExtensionCodexConfigApply,
  previewGetTokensExtensionCodexConfigDryRun,
  setGetTokensExtensionEnabled,
} from './api';
import {
  deriveGetTokensExtensionCodexConfigDryRunView,
  deriveGetTokensExtensionCodexConfigStagedApplyView,
  deriveGetTokensExtensionRegistryView,
  formatRegistryGeneratedAt,
} from './model';
import {
  getGetTokensExtensionCodexConfigDryRunPreview,
  getGetTokensExtensionRegistryPreviewSnapshot,
} from './previewData';
import { hasWailsAppBindings } from '../../utils/previewMode';
import RegistryAside from './RegistryAside';
import ExtensionDetailModal from './ExtensionDetailModal';

interface GetTokensExtensionRegistryFeatureProps {
  input?: main.GetTokensExtensionRegistrySnapshotInput;
}

const stagedApplyTestTargetPath = '/tmp/gettokens-extension-codex-config-staged-preview.toml';
const stagedApplyTempDir = '/tmp';
const stagedApplyConfigText = [
  '# GetTokens Extension Registry staged test target',
  '# This file is intentionally outside ~/.codex/config.toml.',
  '',
].join('\n');

const extensionRegistryPanelClass = 'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]';
const extensionRegistryMutedPanelClass = 'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';
const extensionRegistrySectionTitleClass = 'flex items-center gap-2 text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]';
const extensionRegistryMetaClass = 'text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]';
const extensionRegistryTinyMetaClass = 'text-[length:var(--gt-font-size-2xs)] font-normal text-[var(--gt-ink-muted)]';
const extensionRegistryChipClass = 'inline-flex items-center gap-1.5 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2 py-1 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]';

export default function GetTokensExtensionRegistryFeature({ input }: GetTokensExtensionRegistryFeatureProps) {
  const [snapshot, setSnapshot] = useState<main.GetTokensExtensionRegistrySnapshot>(() => getGetTokensExtensionRegistryPreviewSnapshot());
  const [query, setQuery] = useState('');
  const [selectedExtensionID, setSelectedExtensionID] = useState('');
  const [loading, setLoading] = useState(false);
  const [mutatingExtensionID, setMutatingExtensionID] = useState('');
  const [codexConfigDryRun, setCodexConfigDryRun] = useState<main.GetTokensExtensionCodexConfigDryRunPreview>(() =>
    getGetTokensExtensionCodexConfigDryRunPreview(),
  );
  const [stagedApplyPlan, setStagedApplyPlan] = useState<main.GetTokensExtensionCodexConfigStagedApplyPlan | null>(null);
  const [stagedApplyResult, setStagedApplyResult] = useState<main.GetTokensExtensionCodexConfigStagedApplyResult | null>(null);
  const [stagedApplyError, setStagedApplyError] = useState('');
  const [stagedApplyPhase, setStagedApplyPhase] = useState<'idle' | 'preparing' | 'applying'>('idle');
  const [message, setMessage] = useState('Registry snapshot 已加载；enable-state 操作仅写 GetTokens 本地 state file。');

  const inputKey = JSON.stringify(input || {});
  const view = useMemo(
    () => deriveGetTokensExtensionRegistryView(snapshot, { query, selectedExtensionID }),
    [query, selectedExtensionID, snapshot],
  );
  const codexConfigDryRunView = useMemo(
    () => deriveGetTokensExtensionCodexConfigDryRunView(codexConfigDryRun),
    [codexConfigDryRun],
  );
  const runtimeAvailable = hasWailsAppBindings();
  const stagedApplyView = useMemo(
    () => deriveGetTokensExtensionCodexConfigStagedApplyView({
      runtimeAvailable,
      targetPath: stagedApplyTestTargetPath,
      tempDir: stagedApplyTempDir,
      operationCount: codexConfigDryRunView.operationCount,
      validationErrorCount: codexConfigDryRunView.validationErrorCount,
      preparing: stagedApplyPhase === 'preparing',
      applying: stagedApplyPhase === 'applying',
      plan: stagedApplyPlan,
      result: stagedApplyResult,
      error: stagedApplyError,
    }),
    [codexConfigDryRunView.operationCount, codexConfigDryRunView.validationErrorCount, runtimeAvailable, stagedApplyError, stagedApplyPhase, stagedApplyPlan, stagedApplyResult],
  );

  useEffect(() => {
    const handleHashChange = () => {
      const params = new URLSearchParams(window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash);
      const detailID = params.get('detail') || '';
      setSelectedExtensionID(detailID);
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  function openExtensionDetail(id: string) {
    window.location.hash = buildCodexDetailFrameHash(window.location.hash, id);
    setSelectedExtensionID(id);
  }

  function closeExtensionDetail() {
    window.location.hash = clearCodexDetailFrameHash(window.location.hash);
    setSelectedExtensionID('');
  }

  useEffect(() => {
    void reloadSnapshot();
  }, [inputKey]);

  async function reloadSnapshot() {
    setLoading(true);
    try {
      const nextSnapshot = await loadGetTokensExtensionRegistrySnapshot(input);
      const nextDryRun = await previewGetTokensExtensionCodexConfigDryRun(mapDryRunInput(input));
      setSnapshot(nextSnapshot);
      setCodexConfigDryRun(nextDryRun);
      resetStagedApplyState();
      setMessage('Registry snapshot 与 Codex config dry-run 已刷新；未读取或写入 Codex Skills/MCP 配置。');
    } catch (error) {
      setMessage(`读取 extension registry snapshot 失败：${toErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function setExtensionEnabled(extensionID: string, enabled: boolean) {
    if (!extensionID || mutatingExtensionID) {
      return;
    }
    setMutatingExtensionID(extensionID);
    try {
      await setGetTokensExtensionEnabled({
        extensionID,
        enabled,
        statePath: input?.statePath,
      } as main.SetGetTokensExtensionEnabledInput);
      setMessage(
        `${extensionID} 已${enabled ? '启用' : '停用'}；只写 GetTokens 本地 enable-state file，未写 Codex config，未执行 capability。`,
      );
      const nextSnapshot = await loadGetTokensExtensionRegistrySnapshot(input);
      const nextDryRun = await previewGetTokensExtensionCodexConfigDryRun(mapDryRunInput(input));
      setSnapshot(nextSnapshot);
      setCodexConfigDryRun(nextDryRun);
      resetStagedApplyState();
    } catch (error) {
      setMessage(`更新 extension enable-state 失败：${toErrorMessage(error)}`);
    } finally {
      setMutatingExtensionID('');
    }
  }

  function resetStagedApplyState() {
    setStagedApplyPlan(null);
    setStagedApplyResult(null);
    setStagedApplyError('');
    setStagedApplyPhase('idle');
  }

  async function prepareStagedApply() {
    if (!stagedApplyView.enabledPrepare) {
      return;
    }
    setStagedApplyPhase('preparing');
    setStagedApplyError('');
    setStagedApplyResult(null);
    try {
      const plan = await prepareGetTokensExtensionCodexConfigApply(main.PrepareGetTokensExtensionCodexConfigApplyInput.createFrom({
        manifestPaths: input?.manifestPaths,
        roots: input?.roots,
        statePath: input?.statePath,
        targetPath: stagedApplyTestTargetPath,
        configText: stagedApplyConfigText,
      }));
      setStagedApplyPlan(plan);
      setMessage('Codex config staged test plan 已准备；目标仅为 /tmp测试文件，未写真实 ~/.codex/config.toml。');
    } catch (error) {
      setStagedApplyError(toErrorMessage(error));
      setMessage(`准备 staged test apply 失败：${toErrorMessage(error)}`);
    } finally {
      setStagedApplyPhase('idle');
    }
  }

  async function applyStagedTransaction() {
    if (!stagedApplyView.enabledApply || !stagedApplyPlan?.confirmationToken) {
      return;
    }
    setStagedApplyPhase('applying');
    setStagedApplyError('');
    try {
      const result = await applyGetTokensExtensionCodexConfigTransaction(main.ApplyGetTokensExtensionCodexConfigTransactionInput.createFrom({
        manifestPaths: input?.manifestPaths,
        roots: input?.roots,
        statePath: input?.statePath,
        targetPath: stagedApplyTestTargetPath,
        tempDir: stagedApplyTempDir,
        configText: stagedApplyConfigText,
        confirmationToken: stagedApplyPlan.confirmationToken,
      }));
      setStagedApplyResult(result);
      setMessage(`Codex config staged test transaction ${result.status || 'finished'}；结果只写入 /tmp 测试目标。`);
    } catch (error) {
      setStagedApplyError(toErrorMessage(error));
      setMessage(`执行 staged test transaction 失败：${toErrorMessage(error)}`);
    } finally {
      setStagedApplyPhase('idle');
    }
  }

  const columns = useMemo(() => [
    {
      title: '扩展名称 / 标识',
      key: 'name',
      render: (_: any, record: ReturnType<typeof deriveGetTokensExtensionRegistryView>['extensions'][number]) => (
        <div className="min-w-0">
          <div className="text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-primary)]">
            {record.name}
          </div>
          <div className="mt-1 flex items-center gap-2 font-mono text-[length:var(--gt-font-size-xs)] text-[var(--gt-ink-muted)]">
            <span>{record.id || 'missing-id'}</span>
            <span className="opacity-40">/</span>
            <span>{record.version}</span>
            <span className="opacity-40">/</span>
            <span data-gettokens-extension-registry-source="true" className="text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)] border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-1 rounded-sm">
              {record.sourceType || 'local'}
            </span>
          </div>
        </div>
      )
    },
    {
      title: '状态 (Enable State)',
      key: 'state',
      width: '10rem',
      render: (_: any, record: ReturnType<typeof deriveGetTokensExtensionRegistryView>['extensions'][number]) => (
        <div className="grid gap-1">
          <div>
            <Tag
              data-gettokens-extension-enable-state={record.enableState.state}
              className="m-0 border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] font-semibold text-[var(--gt-ink-primary)] text-[length:var(--gt-font-size-2xs)] uppercase"
            >
              {record.enableState.label}
            </Tag>
          </div>
          <div
            data-gettokens-extension-action-availability={record.actionAvailability.state}
            className="text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)] font-normal leading-none"
          >
            {record.actionAvailability.label}
          </div>
        </div>
      )
    },
    {
      title: '声明能力',
      key: 'capabilities',
      width: '18rem',
      render: (_: any, record: ReturnType<typeof deriveGetTokensExtensionRegistryView>['extensions'][number]) => (
        <div className="flex flex-wrap gap-1">
          {record.capabilityKinds.length === 0 ? (
            <span className="text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)] font-normal">-</span>
          ) : (
            record.capabilityKinds.map((kind) => (
              <Tag
                key={`${record.id}-${kind}`}
                data-gettokens-extension-registry-capability-kind={kind}
                className="m-0 border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] font-mono text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]"
              >
                {kind}
              </Tag>
            ))
          )}
        </div>
      )
    },
    {
      title: '诊断异常',
      key: 'diagnostics',
      width: '6rem',
      align: 'right' as const,
      render: (_: any, record: ReturnType<typeof deriveGetTokensExtensionRegistryView>['extensions'][number]) => (
        <span className={`text-[length:var(--gt-font-size-sm)] font-semibold ${record.diagnosticCount > 0 ? 'text-[var(--gt-status-danger)]' : 'text-[var(--gt-ink-primary)]'}`}>
          {record.diagnosticCount}
        </span>
      )
    }
  ], []);

  return (
    <AssetWorkbenchShell
      dataCollaborationId="PAGE_GETTOKENS_EXTENSION_REGISTRY"
      title="GetTokens Extension Registry"
      subtitle={[
        `${view.summary.extensionCount} extensions`,
        `${view.summary.invalidCount} invalid`,
        `${view.summary.capabilityKindCount} capability kinds`,
        `${view.summary.rootCount} roots`,
      ].join(' / ')}
      actions={<RefreshActionButton label="刷新 snapshot" loading={loading} onClick={() => void reloadSnapshot()} />}
      toolbar={
        <>
          <div className="grid gap-3">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="搜索 extension、diagnostic、capability"
              clearLabel="清空搜索"
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className={extensionRegistryChipClass}>
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
                Local enable-state only
              </span>
              <span className={extensionRegistryChipClass}>
                contract {snapshot.contractVersion || 'unknown'}
              </span>
              <span className={extensionRegistryChipClass}>
                mode {snapshot.registryMode || 'unknown'}
              </span>
            </div>
          </div>
          <div className={`grid content-start gap-2 ${extensionRegistryMetaClass}`}>
            <div>Generated {formatRegistryGeneratedAt(snapshot.generatedAt)}</div>
            <div>{message}</div>
          </div>
        </>
      }
      notice={
        <div className="border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2 text-[length:var(--gt-font-size-xs)] font-normal leading-5 text-[var(--gt-ink-muted)]">
          此页展示 extension registry snapshot、diagnostics、capability kinds、source/root 信息；enable/disable 仅更新 GetTokens dev/app-local extension enable-state file，不写 Codex config，不执行 capability。
          Codex config preview 是 dry-run diff/validation，不读取或写入真实 ~/.codex/config.toml。
        </div>
      }
      contentClassName="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,26rem)]"
      asideClassName="bg-[var(--gt-surface-muted)] border-l border-[var(--gt-border-subtle)]"
      aside={
        <div data-gettokens-extension-registry-aside="true">
          <RegistryAside
            view={view}
            codexConfigDryRunView={codexConfigDryRunView}
            stagedApplyView={stagedApplyView}
            onPrepareStagedApply={prepareStagedApply}
            onApplyStagedTransaction={applyStagedTransaction}
          />
        </div>
      }
    >
      <div className="grid min-h-0 gap-0" data-gettokens-extension-registry-panel="true">
        <div data-gettokens-extension-registry-list-header="true" className="h-full overflow-auto scrollbar-stable bg-[var(--gt-surface-canvas)]">
          <Table
            dataSource={view.extensions}
            columns={columns}
            rowKey={(record) => record.id || record.manifestPath}
            pagination={false}
            size="middle"
            className="gt-clean-table border-0"
            onRow={(record) => ({
              'data-gettokens-extension-registry-entry': record.id || record.manifestPath,
              'data-gettokens-extension-registry-state': record.state,
              onClick: () => openExtensionDetail(record.id || record.manifestPath),
              className: 'cursor-pointer hover:bg-[var(--gt-surface-muted)]'
            })}
          />
        </div>
      </div>

      <ExtensionDetailModal
        extension={selectedExtensionID ? view.selectedExtension : null}
        mutatingExtensionID={mutatingExtensionID}
        onSetEnabled={setExtensionEnabled}
        onClose={closeExtensionDetail}
      />
    </AssetWorkbenchShell>
  );
}

function mapDryRunInput(
  input: main.GetTokensExtensionRegistrySnapshotInput | undefined,
): main.PreviewGetTokensExtensionCodexConfigDryRunInput {
  return Object.assign(main.PreviewGetTokensExtensionCodexConfigDryRunInput.createFrom({
    manifestPaths: input?.manifestPaths,
    roots: input?.roots,
    statePath: input?.statePath,
    targetPath: '~/.codex/config.toml',
  }), {
    configText: '',
  });
}
