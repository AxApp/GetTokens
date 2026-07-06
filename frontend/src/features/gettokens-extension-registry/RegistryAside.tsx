import { AlertTriangle, FileDiff, FolderTree } from 'lucide-react';
import { Button, Collapse, Tag, Tooltip } from 'antd';
import {
  GetTokensExtensionRegistryView,
  GetTokensExtensionCodexConfigDryRunView,
  GetTokensExtensionCodexConfigStagedApplyView
} from './model';

interface RegistryAsideProps {
  view: GetTokensExtensionRegistryView;
  codexConfigDryRunView: GetTokensExtensionCodexConfigDryRunView;
  stagedApplyView: GetTokensExtensionCodexConfigStagedApplyView;
  onPrepareStagedApply: () => void | Promise<void>;
  onApplyStagedTransaction: () => void | Promise<void>;
}

const extensionRegistryPanelClass = 'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]';
const extensionRegistryMutedPanelClass = 'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';
const extensionRegistrySectionTitleClass = 'flex items-center gap-2 text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]';
const extensionRegistryTinyMetaClass = 'text-[length:var(--gt-font-size-2xs)] font-normal text-[var(--gt-ink-muted)]';

export default function RegistryAside({
  view,
  codexConfigDryRunView,
  stagedApplyView,
  onPrepareStagedApply,
  onApplyStagedTransaction,
}: RegistryAsideProps) {
  return (
    <div data-gettokens-extension-registry-aside="true" className="grid min-h-0 content-start gap-4">
      {/* 模块一：Dry-run 概览与 Staged Apply */}
      <section className="border-b border-[var(--gt-border-subtle)] px-4 pb-4 pt-2">
        <div className={extensionRegistrySectionTitleClass}>
          <FileDiff className="h-4 w-4" strokeWidth={2.5} />
          Codex Config Dry-run
        </div>
        <div
          data-gettokens-extension-codex-config-dry-run="true"
          className={`${extensionRegistryPanelClass} mt-3 grid gap-3 px-3 py-3`}
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[length:var(--gt-font-size-xs)]">
            <KeyValueRow label="运行模式" value={codexConfigDryRunView.dryRun ? '仅 Dry-run' : '未知'} />
            <KeyValueRow label="目标文件" value={codexConfigDryRunView.targetPath} monospace />
            <KeyValueRow label="已启用扩展" value={String(codexConfigDryRunView.enabledExtensionCount)} />
            <KeyValueRow label="拟执行操作" value={String(codexConfigDryRunView.operationCount)} />
            <KeyValueRow label="校验错误" value={String(codexConfigDryRunView.validationErrorCount)} />
          </div>

          {/* 字段折叠面板 - 减少长代码干扰 */}
          {codexConfigDryRunView.operationCount > 0 && (
            <Collapse
              size="small"
              ghost
              className="border-t border-[var(--gt-border-subtle)] pt-2"
              items={[
                {
                  key: 'plan',
                  label: (
                    <span className="text-[length:var(--gt-font-size-xs)] text-[var(--gt-ink-muted)] font-semibold">
                      配置片段与拟执行计划 ({codexConfigDryRunView.operationCount})
                    </span>
                  ),
                  children: (
                    <div className="grid gap-3 mt-1 max-h-72 overflow-y-auto">
                      {codexConfigDryRunView.sections.map((section) => (
                        <div
                          key={section.id}
                          data-gettokens-extension-codex-config-dry-run-section={section.id}
                          className={`${extensionRegistryMutedPanelClass} px-2.5 py-2`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-primary)]">
                              {section.label}
                            </div>
                            <div className={extensionRegistryTinyMetaClass}>
                              {section.status}
                            </div>
                          </div>
                          <details className="group mt-1.5">
                            <summary className="text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)] hover:text-[var(--gt-ink-primary)] select-none cursor-pointer">
                              <span className="group-open:hidden">▶ 显示 TOML Diff</span>
                              <span className="hidden group-open:inline">▼ 隐藏 TOML Diff</span>
                            </summary>
                            <pre className="mt-1.5 whitespace-pre-wrap break-words font-mono text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)] border-t border-dashed border-[var(--gt-border-subtle)] pt-1.5">
                              {section.diffPreview.join('\n')}
                            </pre>
                          </details>
                        </div>
                      ))}

                      {codexConfigDryRunView.operations.map((operation) => (
                        <div
                          key={operation.id}
                          data-gettokens-extension-codex-config-dry-run-operation={operation.target}
                          className={`${extensionRegistryMutedPanelClass} px-2.5 py-2`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-primary)]">
                              {operation.target}
                            </div>
                            <div className={extensionRegistryTinyMetaClass}>
                              {operation.action}
                            </div>
                          </div>
                          <details className="group mt-1.5">
                            <summary className="text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)] hover:text-[var(--gt-ink-primary)] select-none cursor-pointer">
                              <span className="group-open:hidden">▶ 显示计划详情</span>
                              <span className="hidden group-open:inline">▼ 隐藏计划详情</span>
                            </summary>
                            <div className="mt-1.5 grid gap-1.5 font-mono text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)] border-t border-dashed border-[var(--gt-border-subtle)] pt-1.5">
                              <KeyValueRow label="Section" value={operation.patchPlan.targetSection} monospace />
                              <KeyValueRow label="Operation" value={operation.patchPlan.operation} monospace />
                              <div className="grid gap-1 mt-1">
                                <div>Before:</div>
                                <pre className="whitespace-pre-wrap break-words rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2 py-1 max-h-24 overflow-y-auto">
                                  {operation.patchPlan.beforeSnippet}
                                </pre>
                                <div>After:</div>
                                <pre className="whitespace-pre-wrap break-words rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2 py-1 max-h-24 overflow-y-auto">
                                  {operation.patchPlan.afterSnippet || operation.preview}
                                </pre>
                              </div>
                            </div>
                          </details>
                        </div>
                      ))}
                    </div>
                  ),
                },
              ]}
            />
          )}

          {codexConfigDryRunView.validationErrorCount > 0 && (
            <div className="grid gap-2 border-t border-[var(--gt-border-subtle)] pt-3">
              <div className="text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-status-danger)]">
                校验错误提醒
              </div>
              {codexConfigDryRunView.validation.map((item, index) => (
                <div
                  key={`${item.code}-${item.extensionID}-${item.capabilityID}-${index}`}
                  data-gettokens-extension-codex-config-dry-run-validation={item.code}
                  className="rounded border border-[color-mix(in_srgb,var(--gt-status-danger)_20%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-danger)_5%,transparent)] px-2.5 py-2 text-[length:var(--gt-font-size-xs)]"
                >
                  <div className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-status-danger)]">
                    {item.code}
                  </div>
                  <div className="mt-1 font-semibold text-[var(--gt-ink-primary)]">{item.message}</div>
                </div>
              ))}
            </div>
          )}

          {/* Staged Apply Panel */}
          <div
            data-gettokens-extension-codex-config-staged-apply="true"
            data-gettokens-extension-codex-config-staged-apply-status={stagedApplyView.status}
            className="grid gap-3 rounded border border-[var(--gt-border-subtle)] bg-[color-mix(in_srgb,var(--gt-status-info)_5%,var(--gt-surface-canvas))] px-3 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)]">
                  Staged Temp Apply
                </div>
                <div className={`mt-0.5 ${extensionRegistryTinyMetaClass}`}>
                  状态: <span className="font-mono">{stagedApplyView.status}</span>
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button
                  size="small"
                  type="text"
                  disabled={!stagedApplyView.enabledPrepare}
                  data-gettokens-extension-codex-config-staged-apply-action="prepare"
                  onClick={() => void onPrepareStagedApply()}
                  className="text-[length:var(--gt-font-size-xs)] font-semibold border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]"
                >
                  准备测试
                </Button>
                <Button
                  size="small"
                  type="primary"
                  disabled={!stagedApplyView.enabledApply}
                  data-gettokens-extension-codex-config-staged-apply-action="apply"
                  onClick={() => void onApplyStagedTransaction()}
                  className="text-[length:var(--gt-font-size-xs)] font-semibold"
                >
                  应用测试
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[length:var(--gt-font-size-xs)] border-t border-dashed border-[var(--gt-border-subtle)] pt-2.5">
              <KeyValueRow label="测试文件" value={stagedApplyView.targetPath} monospace />
              <KeyValueRow label="凭证签名" value={stagedApplyView.confirmationLabel} monospace />
              <KeyValueRow label="写入状态" value={stagedApplyView.resultLabel} />
              <KeyValueRow label="回滚信息" value={stagedApplyView.rollbackLabel} />
            </div>

            {stagedApplyView.disabledReason && (
              <div className="rounded border border-dashed border-[var(--gt-border-subtle)] px-2 py-1.5 text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)] leading-relaxed bg-[var(--gt-surface-canvas)]">
                {stagedApplyView.disabledReason}
              </div>
            )}

            {stagedApplyView.errorDetail && (
              <div className="rounded border border-[color-mix(in_srgb,var(--gt-status-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-danger)_8%,transparent)] px-2.5 py-1.5 text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-status-danger)]">
                {stagedApplyView.errorDetail}
              </div>
            )}

            {stagedApplyView.diffPreview.length > 0 && (
              <details className="group">
                <summary className="text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)] hover:text-[var(--gt-ink-primary)] select-none cursor-pointer">
                  ▶ 查看计划 Diff
                </summary>
                <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2 py-1.5 font-mono text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">
                  {stagedApplyView.diffPreview.join('\n')}
                </pre>
              </details>
            )}
          </div>
        </div>
      </section>

      {/* 模块二：Roots扫描路径 */}
      <section className="border-b border-[var(--gt-border-subtle)] px-4 pb-4">
        <div className={extensionRegistrySectionTitleClass}>
          <FolderTree className="h-4 w-4" strokeWidth={2.5} />
          Roots
        </div>
        <div className="mt-3 grid gap-2">
          {view.roots.map((root) => {
            // 获取路径的最后几级，方便扫读
            const shortPath = root.path.length > 30 ? `.../${root.path.split('/').slice(-2).join('/')}` : root.path;
            return (
              <div
                key={root.id}
                data-gettokens-extension-registry-root={root.id}
                className={`${extensionRegistryPanelClass} px-3 py-2 flex items-center justify-between gap-3`}
              >
                <div className="min-w-0">
                  <div className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)]">
                    {root.id}
                  </div>
                  <Tooltip title={root.path} placement="left">
                    <div className="mt-0.5 font-mono text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)] truncate select-all cursor-help">
                      {shortPath}
                    </div>
                  </Tooltip>
                </div>
                <Tag className="m-0 border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] text-[var(--gt-ink-muted)] text-[length:var(--gt-font-size-2xs)]">
                  {root.extensionCount}
                </Tag>
              </div>
            );
          })}
        </div>
      </section>

      {/* 模块三：Registry Diagnostics */}
      <section className="px-4 pb-4">
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
    </div>
  );
}

function KeyValueRow({
  label,
  value,
  monospace,
}: {
  label: string;
  value: string;
  monospace?: boolean;
}) {
  const shortValue = monospace && value.length > 25 ? `...${value.slice(-22)}` : value;
  const needTooltip = monospace && value.length > 25;

  const renderedValue = (
    <div className={monospace ? 'font-mono text-[var(--gt-ink-muted)] truncate max-w-[12rem]' : 'text-[var(--gt-ink-muted)]'}>
      {shortValue}
    </div>
  );

  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <div className="font-semibold text-[var(--gt-ink-primary)]">{label}</div>
      {needTooltip ? (
        <Tooltip title={value} placement="top">
          {renderedValue}
        </Tooltip>
      ) : (
        renderedValue
      )}
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
      className={`${extensionRegistryMutedPanelClass} px-3 py-2 text-[length:var(--gt-font-size-xs)]`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-primary)]">
          {diagnostic.code}
        </div>
        <Tag className="m-0 text-[length:var(--gt-font-size-2xs)] border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] text-[var(--gt-ink-muted)]">
          {diagnostic.severity}
        </Tag>
      </div>
      <div className="mt-1 text-[var(--gt-ink-primary)] leading-normal">{diagnostic.message}</div>
    </div>
  );
}
