import { AlertTriangle, FileDiff, FolderTree, Layers3, Power, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { main } from '../../../wailsjs/go/models';
import AssetWorkbenchShell from '../../components/ui/AssetWorkbenchShell';
import RefreshActionButton from '../../components/ui/RefreshActionButton';
import SearchInput from '../../components/ui/SearchInput';
import { toErrorMessage } from '../../utils/error';
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
  formatRegistryStateLabel,
} from './model';
import {
  getGetTokensExtensionCodexConfigDryRunPreview,
  getGetTokensExtensionRegistryPreviewSnapshot,
} from './previewData';
import { hasWailsAppBindings } from '../../utils/previewMode';

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

const extensionRegistryButtonClass = 'inline-flex h-8 items-center justify-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-2.5 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-primary)] transition hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)] disabled:cursor-not-allowed disabled:border-dashed disabled:text-[var(--gt-ink-muted)] disabled:opacity-60';
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
    if (view.selectedExtension?.id && view.selectedExtension.id !== selectedExtensionID) {
      setSelectedExtensionID(view.selectedExtension.id);
    }
    if (!view.selectedExtension && selectedExtensionID) {
      setSelectedExtensionID('');
    }
  }, [selectedExtensionID, view.selectedExtension]);

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
      setMessage('Codex config staged test plan 已准备；目标仅为 /tmp 测试文件，未写真实 ~/.codex/config.toml。');
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
              placeholder="搜索 extension、diagnostic、capability、source path"
              clearLabel="清空 extension registry 搜索"
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
      contentClassName="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,30rem)]"
      asideClassName="bg-[var(--gt-surface-muted)]"
      aside={
        <GetTokensExtensionRegistryAside
          view={view}
          codexConfigDryRunView={codexConfigDryRunView}
          stagedApplyView={stagedApplyView}
          mutatingExtensionID={mutatingExtensionID}
          onSetEnabled={setExtensionEnabled}
          onPrepareStagedApply={prepareStagedApply}
          onApplyStagedTransaction={applyStagedTransaction}
        />
      }
    >
      <div className="grid min-h-0 gap-0" data-gettokens-extension-registry-panel="true">
        <div
          data-gettokens-extension-registry-list-header="true"
          className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-3 border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-4 py-3 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]"
        >
          <span>Extension</span>
          <span>Enable State</span>
          <span>Capabilities</span>
          <span>Diagnostics</span>
        </div>
        <div className="scrollbar-stable min-h-0 overflow-auto">
          {view.extensions.length === 0 ? (
            <div className="grid place-items-center px-6 py-10 text-center text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-muted)]">
              当前过滤条件下没有 extension snapshot。
            </div>
          ) : (
            view.extensions.map((extension) => {
              const selected = extension.id === view.selectedExtension?.id;
              return (
                <button
                  key={extension.id || extension.manifestPath}
                  type="button"
                  data-gettokens-extension-registry-entry={extension.id || extension.manifestPath}
                  data-gettokens-extension-registry-state={extension.state}
                  onClick={() => setSelectedExtensionID(extension.id)}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-3 border-b border-[var(--gt-border-subtle)] px-4 py-3 text-left transition-colors ${
                    selected ? 'bg-[color-mix(in_srgb,var(--gt-status-info)_10%,var(--gt-surface-canvas))]' : 'hover:bg-[var(--gt-surface-muted)]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-primary)]">{extension.name}</div>
                    <div className="mt-1 truncate font-mono text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]">
                      {extension.id || 'missing-id'} / {extension.version}
                    </div>
                    <div
                      data-gettokens-extension-registry-source="true"
                      className="mt-2 truncate font-mono text-[length:var(--gt-font-size-xs)] text-[var(--gt-ink-muted)]"
                    >
                      {extension.manifestPath}
                    </div>
                  </div>
                  <div className="grid justify-items-end gap-1 self-start text-right">
                    <div
                      data-gettokens-extension-enable-state={extension.enableState.state}
                      className="rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2 py-1 text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-primary)]"
                    >
                      {extension.enableState.label}
                    </div>
                    <div
                      data-gettokens-extension-action-availability={extension.actionAvailability.state}
                      className="rounded border border-dashed border-[var(--gt-border-subtle)] px-2 py-1 text-[length:var(--gt-font-size-2xs)] font-normal text-[var(--gt-ink-muted)]"
                    >
                      {extension.actionAvailability.label}
                    </div>
                    <div className="max-w-[15rem] text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">
                      {extension.enableState.reasonSummary}
                    </div>
                    <ExtensionEnableActionButton
                      extension={extension}
                      busy={mutatingExtensionID === extension.id}
                      onSetEnabled={setExtensionEnabled}
                    />
                  </div>
                  <div className="flex min-w-[8rem] flex-wrap justify-end gap-1 self-start">
                    {extension.capabilityKinds.map((kind) => (
                      <span
                        key={`${extension.id}-${kind}`}
                        data-gettokens-extension-registry-capability-kind={kind}
                        className="rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2 py-1 font-mono text-[length:var(--gt-font-size-2xs)] font-normal text-[var(--gt-ink-muted)]"
                      >
                        {kind}
                      </span>
                    ))}
                  </div>
                  <div className="self-start text-right text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
                    {extension.diagnosticCount}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
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

function GetTokensExtensionRegistryAside({
  view,
  codexConfigDryRunView,
  stagedApplyView,
  mutatingExtensionID,
  onSetEnabled,
  onPrepareStagedApply,
  onApplyStagedTransaction,
}: {
  view: ReturnType<typeof deriveGetTokensExtensionRegistryView>;
  codexConfigDryRunView: ReturnType<typeof deriveGetTokensExtensionCodexConfigDryRunView>;
  stagedApplyView: ReturnType<typeof deriveGetTokensExtensionCodexConfigStagedApplyView>;
  mutatingExtensionID: string;
  onSetEnabled: (extensionID: string, enabled: boolean) => void | Promise<void>;
  onPrepareStagedApply: () => void | Promise<void>;
  onApplyStagedTransaction: () => void | Promise<void>;
}) {
  return (
    <div data-gettokens-extension-registry-aside="true" className="grid min-h-0 content-start gap-0">
      <section className="border-b border-[var(--gt-border-subtle)] px-4 py-4">
        <div className={extensionRegistrySectionTitleClass}>
          <FileDiff className="h-4 w-4" strokeWidth={2.5} />
          Codex Config Dry-run
        </div>
        <div
          data-gettokens-extension-codex-config-dry-run="true"
          className={`${extensionRegistryPanelClass} mt-3 grid gap-3 px-3 py-3`}
        >
          <div className="grid grid-cols-2 gap-2 text-[length:var(--gt-font-size-xs)]">
            <KeyValueRow label="Mode" value={codexConfigDryRunView.dryRun ? 'DRY RUN ONLY' : 'UNKNOWN'} />
            <KeyValueRow label="Target" value={codexConfigDryRunView.targetPath} monospace />
            <KeyValueRow label="Enabled" value={String(codexConfigDryRunView.enabledExtensionCount)} />
            <KeyValueRow label="Operations" value={String(codexConfigDryRunView.operationCount)} />
            <KeyValueRow label="Validation Errors" value={String(codexConfigDryRunView.validationErrorCount)} />
          </div>
          <div className="grid gap-2">
            {codexConfigDryRunView.sections.map((section) => (
              <div
                key={section.id}
                data-gettokens-extension-codex-config-dry-run-section={section.id}
                className={`${extensionRegistryMutedPanelClass} px-2 py-2`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-primary)]">
                    {section.label}
                  </div>
                  <div className={extensionRegistryTinyMetaClass}>
                    {section.status}
                  </div>
                </div>
                <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">
                  {section.diffPreview.join('\n')}
                </pre>
              </div>
            ))}
          </div>
          <div className="grid gap-2">
            {codexConfigDryRunView.operations.length === 0 ? (
              <div className="rounded border border-dashed border-[var(--gt-border-subtle)] px-3 py-3 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]">
                No candidate operations
              </div>
            ) : (
              codexConfigDryRunView.operations.map((operation) => (
                <div
                  key={operation.id}
                  data-gettokens-extension-codex-config-dry-run-operation={operation.target}
                  className={`${extensionRegistryMutedPanelClass} px-2 py-2`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-primary)]">
                      {operation.target}
                    </div>
                    <div className={extensionRegistryTinyMetaClass}>
                      {operation.action}
                    </div>
                  </div>
                  <div className="mt-1 break-all font-mono text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">
                    {[operation.extensionID, operation.capabilityID].filter(Boolean).join(' / ')}
                  </div>
                  <div className="mt-2 grid gap-2 font-mono text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">
                    <KeyValueRow label="Section" value={operation.patchPlan.targetSection} monospace />
                    <KeyValueRow label="Operation" value={operation.patchPlan.operation} monospace />
                    <pre className="whitespace-pre-wrap break-words rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2 py-2">
                      {operation.patchPlan.beforeSnippet}
                    </pre>
                    <pre className="whitespace-pre-wrap break-words rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2 py-2">
                      {operation.patchPlan.afterSnippet || operation.preview}
                    </pre>
                    <pre className="whitespace-pre-wrap break-words rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2 py-2">
                      {operation.patchPlan.validation.join('\n')}
                    </pre>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="grid gap-2">
            {codexConfigDryRunView.validation.length === 0 ? (
              <div className="rounded border border-dashed border-[var(--gt-border-subtle)] px-3 py-3 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]">
                No dry-run validation errors
              </div>
            ) : (
              codexConfigDryRunView.validation.map((item, index) => (
                <div
                  key={`${item.code}-${item.extensionID}-${item.capabilityID}-${index}`}
                  data-gettokens-extension-codex-config-dry-run-validation={item.code}
                  className={`${extensionRegistryMutedPanelClass} px-2 py-2`}
                >
                  <div className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-primary)]">
                    {item.code}
                  </div>
                  <div className="mt-1 text-[length:var(--gt-font-size-xs)] text-[var(--gt-ink-primary)]">{item.message}</div>
                  <div className="mt-1 break-all font-mono text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">
                    {[item.extensionID, item.capabilityID, item.target].filter(Boolean).join(' / ')}
                  </div>
                </div>
              ))
            )}
          </div>
          <div
            data-gettokens-extension-codex-config-staged-apply="true"
            data-gettokens-extension-codex-config-staged-apply-status={stagedApplyView.status}
            className="grid gap-3 rounded border border-[var(--gt-border-subtle)] bg-[color-mix(in_srgb,var(--gt-status-info)_8%,var(--gt-surface-canvas))] px-3 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)]">
                  Staged Temp Apply
                </div>
                <div className={`mt-1 ${extensionRegistryTinyMetaClass}`}>
                  status={stagedApplyView.status}
                </div>
                <div className={`mt-2 max-w-[18rem] leading-4 ${extensionRegistryTinyMetaClass}`}>
                  Only an explicit /tmp test target is allowed; real ~/.codex/config.toml apply remains blocked.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!stagedApplyView.enabledPrepare}
                  data-gettokens-extension-codex-config-staged-apply-action="prepare"
                  onClick={() => void onPrepareStagedApply()}
                  className={extensionRegistryButtonClass}
                >
                  Prepare Test Plan
                </button>
                <button
                  type="button"
                  disabled={!stagedApplyView.enabledApply}
                  data-gettokens-extension-codex-config-staged-apply-action="apply"
                  onClick={() => void onApplyStagedTransaction()}
                  className={extensionRegistryButtonClass}
                >
                  Apply Test Transaction
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[length:var(--gt-font-size-xs)]">
              <KeyValueRow label="Target" value={stagedApplyView.targetPath} monospace />
              <KeyValueRow label="Temp Dir" value={stagedApplyView.tempDir} monospace />
              <KeyValueRow label="Confirmation" value={stagedApplyView.confirmationLabel} monospace />
              <KeyValueRow label="Result" value={stagedApplyView.resultLabel} monospace />
              <KeyValueRow label="Rollback" value={stagedApplyView.rollbackLabel} monospace />
              <KeyValueRow label="Operations" value={stagedApplyView.appliedOperations.join(', ') || '-'} monospace />
            </div>
            {stagedApplyView.disabledReason ? (
              <div className="rounded border border-dashed border-[var(--gt-border-subtle)] px-2 py-2 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]">
                {stagedApplyView.disabledReason}
              </div>
            ) : null}
            {stagedApplyView.errorDetail ? (
              <div className="border px-2 py-2 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-status-danger)]" style={{ borderColor: 'color-mix(in srgb, var(--gt-status-danger) 34%, transparent)', backgroundColor: 'color-mix(in srgb, var(--gt-status-danger) 10%, transparent)' }}>
                {stagedApplyView.errorDetail}
              </div>
            ) : null}
            {stagedApplyView.diffPreview.length > 0 ? (
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2 py-2 font-mono text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">
                {stagedApplyView.diffPreview.join('\n')}
              </pre>
            ) : null}
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--gt-border-subtle)] px-4 py-4">
        <div className={extensionRegistrySectionTitleClass}>
          <FolderTree className="h-4 w-4" strokeWidth={2.5} />
          Roots
        </div>
        <div className="mt-3 grid gap-2">
          {view.roots.map((root) => (
            <div
              key={root.id}
              data-gettokens-extension-registry-root={root.id}
              className={`${extensionRegistryPanelClass} px-3 py-2`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)]">{root.id}</div>
                <div className={extensionRegistryTinyMetaClass}>
                  {root.extensionCount} extensions
                </div>
              </div>
              <div className="mt-1 break-all font-mono text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">{root.path}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-[var(--gt-border-subtle)] px-4 py-4">
        <div className={extensionRegistrySectionTitleClass}>
          <AlertTriangle className="h-4 w-4" strokeWidth={2.5} />
          Registry Diagnostics
        </div>
        <div className="mt-3 grid gap-2">
          {view.registryDiagnostics.length === 0 ? (
            <div className="rounded border border-dashed border-[var(--gt-border-subtle)] px-3 py-3 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]">
              No registry diagnostics
            </div>
          ) : (
            view.registryDiagnostics.map((diagnostic, index) => (
              <DiagnosticRow key={`${diagnostic.code}-${index}`} diagnostic={diagnostic} />
            ))
          )}
        </div>
      </section>

      <section className="px-4 py-4">
        <div className={extensionRegistrySectionTitleClass}>
          <Layers3 className="h-4 w-4" strokeWidth={2.5} />
          Selected Extension
        </div>
        {view.selectedExtension ? (
          <div data-gettokens-extension-registry-selected="true" className="mt-3 grid gap-3">
            <div className={`${extensionRegistryPanelClass} px-3 py-3`}>
              <div className="text-[length:var(--gt-font-size-lg)] font-semibold text-[var(--gt-ink-primary)]">{view.selectedExtension.name}</div>
              <div className="mt-1 font-mono text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]">
                {view.selectedExtension.id || 'missing-id'} / {view.selectedExtension.version}
              </div>
              <div className="mt-3 grid gap-2 text-[length:var(--gt-font-size-xs)]">
                <KeyValueRow label="Enable State" value={view.selectedExtension.enableState.label} />
                <KeyValueRow label="Action Availability" value={view.selectedExtension.actionAvailability.label} />
                <ExtensionEnableActionButton
                  extension={view.selectedExtension}
                  busy={mutatingExtensionID === view.selectedExtension.id}
                  onSetEnabled={onSetEnabled}
                />
                <KeyValueRow label="State" value={formatRegistryStateLabel(view.selectedExtension.state)} />
                <KeyValueRow label="Root" value={view.selectedExtension.rootID} />
                <KeyValueRow label="Manifest" value={view.selectedExtension.manifestPath} monospace />
                <KeyValueRow label="Source" value={view.selectedExtension.sourceURI || view.selectedExtension.sourceType || 'local'} monospace />
                <KeyValueRow label="Permissions" value={view.selectedExtension.permissions.join(', ') || '-'} monospace />
              </div>
            </div>

            <div className={`${extensionRegistryPanelClass} px-3 py-3`}>
              <div className="text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)]">
                Enable State Reasons
              </div>
              <div className="mt-3 grid gap-2">
                {view.selectedExtension.enableState.reasons.map((reason) => (
                  <ReasonRow key={`enable-${reason.code}`} reason={reason} />
                ))}
              </div>
            </div>

            <div className={`${extensionRegistryPanelClass} px-3 py-3`}>
              <div className="text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)]">
                Action Availability
              </div>
              <div className="mt-3 grid gap-2">
                {view.selectedExtension.actionAvailability.reasons.map((reason) => (
                  <ReasonRow key={`action-${reason.code}`} reason={reason} />
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              {view.selectedExtension.capabilities.map((capability) => (
                <div
                  key={`${view.selectedExtension?.id}-${capability.id || capability.kind}`}
                  className={`${extensionRegistryPanelClass} px-3 py-3`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)]">
                        {capability.id || capability.kind}
                      </div>
                      <div
                        data-gettokens-extension-registry-capability-kind={capability.kind}
                        className={`mt-1 ${extensionRegistryTinyMetaClass}`}
                      >
                        {capability.kind} / {formatRegistryStateLabel(capability.state)}
                      </div>
                    </div>
                    <div className={`text-right ${extensionRegistryTinyMetaClass}`}>
                      {capability.declaredContributions.length} contributions
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-[length:var(--gt-font-size-xs)]">
                    <KeyValueRow label="Required" value={capability.requiredPermissions.join(', ') || '-'} monospace />
                    <KeyValueRow label="Declared" value={capability.declaredContributions.join(', ') || '-'} monospace />
                  </div>
                  {capability.diagnostics.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {capability.diagnostics.map((diagnostic, index) => (
                        <DiagnosticRow
                          key={`${capability.id || capability.kind}-${diagnostic.code}-${index}`}
                          diagnostic={diagnostic}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="grid gap-2">
              {view.selectedExtension.diagnostics.length === 0 ? (
                <div className="rounded border border-dashed border-[var(--gt-border-subtle)] px-3 py-3 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]">
                  No extension diagnostics
                </div>
              ) : (
                view.selectedExtension.diagnostics.map((diagnostic, index) => (
                  <DiagnosticRow key={`${diagnostic.code}-${index}`} diagnostic={diagnostic} />
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded border border-dashed border-[var(--gt-border-subtle)] px-3 py-4 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]">
            选择一个 extension 查看 diagnostics、capability kinds 与 source/root 信息。
          </div>
        )}
      </section>
    </div>
  );
}

function ExtensionEnableActionButton({
  extension,
  busy,
  onSetEnabled,
}: {
  extension: ReturnType<typeof deriveGetTokensExtensionRegistryView>['extensions'][number];
  busy: boolean;
  onSetEnabled: (extensionID: string, enabled: boolean) => void | Promise<void>;
}) {
  const action = extension.actionAvailability.action;
  if (!action) {
    return (
      <button
        type="button"
        disabled
        data-gettokens-extension-enable-action="disabled"
        className="inline-flex h-8 items-center justify-center gap-2 rounded border border-dashed border-[var(--gt-border-subtle)] px-2.5 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]"
      >
        <Power className="h-3.5 w-3.5" strokeWidth={2.5} />
        Disabled
      </button>
    );
  }

  const enabled = action === 'enable';
  return (
    <button
      type="button"
      disabled={busy}
      data-gettokens-extension-enable-action={action}
      onClick={(event) => {
        event.stopPropagation();
        void onSetEnabled(extension.id, enabled);
      }}
      className={`${extensionRegistryButtonClass} gap-2 disabled:cursor-wait`}
      title="Only writes the GetTokens app-local enable-state file. Codex config and capabilities are untouched."
    >
      <Power className="h-3.5 w-3.5" strokeWidth={2.5} />
      {busy ? 'Updating' : extension.actionAvailability.label}
    </button>
  );
}

function ReasonRow({
  reason,
}: {
  reason: {
    code: string;
    label: string;
    message: string;
  };
}) {
  return (
    <div className={`${extensionRegistryMutedPanelClass} px-3 py-3`}>
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-primary)]">
          {reason.code}
        </div>
        <div className={extensionRegistryTinyMetaClass}>
          {reason.label}
        </div>
      </div>
      <div className="mt-2 text-[length:var(--gt-font-size-xs)] text-[var(--gt-ink-primary)]">{reason.message}</div>
    </div>
  );
}

function DiagnosticRow({
  diagnostic,
}: {
  diagnostic: {
    severity: string;
    code: string;
    path: string;
    message: string;
    source: string;
    scope: string;
  };
}) {
  return (
    <div
      data-gettokens-extension-registry-diagnostic={diagnostic.code}
      className={`${extensionRegistryMutedPanelClass} px-3 py-3`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)]">
          {diagnostic.code}
        </div>
        <div className={extensionRegistryTinyMetaClass}>
          {diagnostic.scope} / {diagnostic.severity}
        </div>
      </div>
      <div className="mt-2 text-[length:var(--gt-font-size-xs)] text-[var(--gt-ink-primary)]">{diagnostic.message}</div>
      {diagnostic.path ? (
        <div className="mt-2 font-mono text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">{diagnostic.path}</div>
      ) : null}
      {diagnostic.source ? (
        <div className="mt-1 break-all font-mono text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">{diagnostic.source}</div>
      ) : null}
    </div>
  );
}

function KeyValueRow({
  label,
  value,
  monospace = false,
}: {
  label: string;
  value: string;
  monospace?: boolean;
}) {
  return (
    <div className="grid gap-1">
      <div className={extensionRegistryTinyMetaClass}>{label}</div>
      <div className={monospace ? 'break-all font-mono text-[length:var(--gt-font-size-xs)] text-[var(--gt-ink-primary)]' : 'text-[var(--gt-ink-primary)]'}>
        {value}
      </div>
    </div>
  );
}
